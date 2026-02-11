import { initDb } from "@/lib/initDb";
import { getPool } from "@/lib/db";

export async function GET() {
  await initDb();
  const pool = getPool();

  const { rows } = await pool.query(`
    SELECT * FROM jobs
    ORDER BY created_at DESC
    LIMIT 200
  `);

  return Response.json({ jobs: rows });
}
