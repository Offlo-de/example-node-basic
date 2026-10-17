import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

export const database = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
  max: 2,
});
database.on('error', (error) => console.error('PostgreSQL:', error.message));
