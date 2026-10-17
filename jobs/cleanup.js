import { database } from '../lib/database.js';
import { summarizeRequests } from '../lib/requests.js';

try {
  const { rows } = await summarizeRequests(database);
  console.log('Saved daily request totals (UTC):', rows);
} catch (error) {
  console.error('Daily summary failed:', error.message || error.code || error);
  process.exitCode = 1;
} finally {
  await database.end();
}
