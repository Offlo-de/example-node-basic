import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { database } from './lib/database.js';
import { createQueueClient, QUEUE } from './lib/queue.js';
import { renderPage } from './lib/page.js';

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535. Run with mise run start.');
}
const queue = createQueueClient();

const server = createServer(async (request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  try {
    await queue.lPush(QUEUE, JSON.stringify({
      id: randomUUID(),
      message: 'Hey, request arrived!',
      method: request.method,
      path: request.url,
      arrivedAt: new Date().toISOString(),
    }));
    const { rows } = await database.query(
      'SELECT day::text, request_count, calculated_at FROM daily_request_counts ORDER BY day DESC',
    );
    const body = renderPage(rows);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error('Request failed:', error.message || error.code || error);
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Request processing is unavailable. Check PostgreSQL, Redis, and database setup.\n');
  }
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => server.close(resolve));
  if (queue.isOpen) queue.destroy();
  await database.end();
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
server.on('error', async (error) => {
  console.error('Web server failed:', error.message);
  process.exitCode = 1;
  await shutdown();
});

try {
  await database.query('SELECT 1');
  await queue.connect();
  server.listen(port, () => console.log(`Server listening at http://localhost:${port}`));
} catch (error) {
  console.error('Web startup failed:', error.message || error.code || error);
  process.exitCode = 1;
  await shutdown();
}
