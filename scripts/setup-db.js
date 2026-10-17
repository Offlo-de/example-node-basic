import { readFile } from 'node:fs/promises';
import { database } from '../lib/database.js';

try {
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await database.query(schema);
  console.log('Database tables ready');
} catch (error) {
  console.error('Database setup failed:', error.message || error.code || error);
  process.exitCode = 1;
} finally {
  await database.end();
}
