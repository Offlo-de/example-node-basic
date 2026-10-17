import { createClient } from 'redis';

export const QUEUE = 'demo:requests';
export const PROCESSING = 'demo:requests:processing';

export function createQueueClient() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required.');
  const client = createClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });
  client.on('error', (error) => console.error('Redis:', error.message));
  return client;
}
