// Run against disposable local services after db:setup.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { database } from '../lib/database.js';
import { createQueueClient, QUEUE, PROCESSING } from '../lib/queue.js';

const queue = createQueueClient();
const children = [];
const port = 13000;
const base = `http://127.0.0.1:${port}`;

async function waitFor(check, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${description}`);
}

async function start(file, ready) {
  const child = spawn(process.execPath, [file], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.output = '';
  child.stdout.on('data', (data) => { child.output += data; });
  child.stderr.on('data', (data) => { child.output += data; });
  await waitFor(() => {
    assert.equal(child.exitCode, null, child.output);
    return child.output.includes(ready);
  }, `${file} startup`);
  return child;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timeout);
  assert.equal(child.exitCode, 0, child.output);
}

async function summarize() {
  const child = spawn(process.execPath, ['jobs/cleanup.js'], { stdio: 'inherit' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, 'Cron command must exit successfully');
}

try {
  await queue.connect();
  assert.equal(await queue.lLen(QUEUE), 0, 'Use an idle, disposable demo queue');
  assert.equal(await queue.lLen(PROCESSING), 0, 'Use an idle, disposable processing queue');
  const web = await start('server.js', 'Server listening');

  // Queue requests while the worker is stopped.
  for (let i = 0; i < 3; i++) {
    const response = await fetch(`${base}/verify/${i}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Daily request totals/);
  }
  assert.equal(await queue.lLen(QUEUE), 3);
  console.log('PASS: Web requests queued in Redis while worker was stopped');

  let worker = await start('worker.js', 'waiting for requests');
  await waitFor(async () => (await queue.lLen(QUEUE)) === 0 &&
    (await queue.lLen(PROCESSING)) === 0, 'worker drains queue');
  assert.equal((worker.output.match(/Hey, request arrived!/g) || []).length, 3);
  console.log('PASS: Worker saved and printed all three requests');

  await summarize();
  const { rows: mismatch } = await database.query(`
    SELECT 1 FROM (
      SELECT (arrived_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS count
      FROM requests GROUP BY 1
    ) actual LEFT JOIN daily_request_counts saved USING (day)
    WHERE saved.request_count IS DISTINCT FROM actual.count
  `);
  assert.equal(mismatch.length, 0);
  const { rows: totals } = await database.query(
    'SELECT day::text, request_count FROM daily_request_counts ORDER BY day DESC');
  const html = await (await fetch(base)).text();
  for (const row of totals) {
    assert.ok(html.includes(row.day));
    assert.ok(html.includes(`<td>${row.request_count}</td>`));
  }
  console.log('PASS: Standalone cron saved correct daily totals and web displayed them');

  await waitFor(async () => (await queue.lLen(QUEUE)) === 0 &&
    (await queue.lLen(PROCESSING)) === 0, 'final page request processed');
  await stop(worker);
  // Simulate a crash after a message was saved but before Redis acknowledgement.
  const id = randomUUID();
  const message = { id, message: 'Hey, request arrived!', method: 'GET',
    path: '/verify/recovery', arrivedAt: new Date().toISOString() };
  await queue.lPush(PROCESSING, JSON.stringify(message));
  worker = await start('worker.js', 'waiting for requests');
  await waitFor(async () => (await queue.lLen(PROCESSING)) === 0, 'unfinished message recovered');
  await stop(worker);
  await queue.lPush(PROCESSING, JSON.stringify(message));
  worker = await start('worker.js', 'waiting for requests');
  await waitFor(async () => (await queue.lLen(PROCESSING)) === 0, 'message replay acknowledged');
  const { rows } = await database.query('SELECT COUNT(*) FROM requests WHERE id = $1', [id]);
  assert.equal(Number(rows[0].count), 1);
  console.log('PASS: Worker restart recovers pending messages without duplicate database rows');

  await summarize();
  await stop(worker);
  await stop(web);
  console.log('PASS: Web and worker shut down cleanly');
} finally {
  for (const child of children.reverse()) await stop(child);
  if (queue.isOpen) queue.destroy();
  await database.end();
}
