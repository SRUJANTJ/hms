// lib/db.js
// Postgres connection pool (works with Neon serverless Postgres).
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL is not set. Add it to your .env.local file (see .env.example)."
  );
}

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required by Neon
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  const res = await p.query(text, params);
  return res;
}
