import { getPool } from "./db";

export async function initDb() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_found INT DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      name TEXT,
      category TEXT,
      address TEXT,
      phone TEXT,
      website TEXT,
      rating REAL,
      reviews_count INT,
      lat REAL,
      lng REAL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_results_job_id ON results(job_id);
  `);
}
