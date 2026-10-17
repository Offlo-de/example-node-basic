import { database } from './lib/database.js';
import { createQueueClient, QUEUE, PROCESSING } from './lib/queue.js';
import { saveRequest } from './lib/requests.js';

const queue = createQueueClient();
let stopping = false;
process.once('SIGINT', () => { stopping = true; });
process.once('SIGTERM', () => { stopping = true; });

try {
  await database.query('SELECT 1');
  await queue.connect();
  console.log('Worker connected to PostgreSQL and Redis; waiting for requests');

  while (!stopping) {
    // Resume an unacknowledged item after a restart. Run one worker for this demo.
    const pending = await queue.lIndex(PROCESSING, -1);
    const item = pending ?? await queue.blMove(QUEUE, PROCESSING, 'RIGHT', 'LEFT', 1);
    if (!item) continue;
    const message = JSON.parse(item);
    await saveRequest(database, message);
    console.log(message.message, message.method, message.path, message.arrivedAt);
    await queue.lRem(PROCESSING, 1, item);
  }
} catch (error) {
  console.error('Worker failed:', error.message || error.code || error);
  process.exitCode = 1;
} finally {
  if (queue.isOpen) queue.destroy();
  await database.end();
  console.log('Worker stopped');
}
