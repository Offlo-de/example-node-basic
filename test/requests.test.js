import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { saveRequest, summarizeRequests } from '../lib/requests.js';
import { renderPage } from '../lib/page.js';

test('daily summary uses UTC, deduplicates requests, and includes late arrivals on rerun', async () => {
  const db = new PGlite();
  try {
    const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.exec(schema);
    await db.exec("SET TIME ZONE 'Asia/Kathmandu'");
    const message = {
      id: randomUUID(), message: 'Hey, request arrived!', method: 'GET',
      path: "/?name='example'", arrivedAt: '2026-10-17T23:59:59Z',
    };
    await saveRequest(db, message);
    await saveRequest(db, message);
    await saveRequest(db, { ...message, id: randomUUID(), arrivedAt: '2026-10-18T00:00:00Z' });
    await summarizeRequests(db);
    await summarizeRequests(db);
    let result = await db.query('SELECT day::text, request_count FROM daily_request_counts ORDER BY day');
    assert.deepEqual(result.rows.map((r) => [r.day, Number(r.request_count)]),
      [['2026-10-17', 1], ['2026-10-18', 1]]);

    await saveRequest(db, { ...message, id: randomUUID() });
    await summarizeRequests(db);
    result = await db.query('SELECT day::text, request_count FROM daily_request_counts ORDER BY day');
    assert.deepEqual(result.rows.map((r) => [r.day, Number(r.request_count)]),
      [['2026-10-17', 2], ['2026-10-18', 1]]);
    const saved = await db.query('SELECT path FROM requests LIMIT 1');
    assert.equal(saved.rows[0].path, message.path);
  } finally {
    await db.close();
  }
});

test('page shows saved totals and an actionable empty state', () => {
  assert.match(renderPage([]), /No saved totals yet/);
  const html = renderPage([{
    day: '2026-10-18', request_count: '42',
    calculated_at: new Date('2026-10-18T01:00:00Z'),
  }]);
  assert.match(html, /2026-10-18/);
  assert.match(html, /<td>42<\/td>/);
  assert.match(html, /2026-10-18T01:00:00.000Z/);
});
