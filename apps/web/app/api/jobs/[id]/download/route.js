import { initDb } from "@/lib/initDb";
import { getPool } from "@/lib/db";
import { stringify } from "csv-stringify/sync";

export async function GET(req, { params }) {
  await initDb();
  const pool = getPool();

  const jobId = params.id;

  const job = await pool.query(`SELECT * FROM jobs WHERE id=$1`, [jobId]);
  if (!job.rows.length) {
    return new Response("Job not found", { status: 404 });
  }

  const { rows } = await pool.query(
    `SELECT name, category, address, phone, website, rating, reviews_count, lat, lng
     FROM results WHERE job_id=$1 ORDER BY created_at ASC`,
    [jobId]
  );

  const csv = stringify(rows, { header: true });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="job-${jobId}.csv"`
    }
  });
}
