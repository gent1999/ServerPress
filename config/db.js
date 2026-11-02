import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// No DATABASE_URL yet — routes that touch the DB check `pool` before querying
// and fall back gracefully until a Neon database is wired up.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,                    // never hold more than 3 connections
      idleTimeoutMillis: 10000,  // release idle connections after 10s
      connectionTimeoutMillis: 5000, // fail fast if no connection available
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
  });
} else {
  console.warn('⚠️  DATABASE_URL not set — DB-backed routes will log and no-op until it is configured.');
}

export default pool;
