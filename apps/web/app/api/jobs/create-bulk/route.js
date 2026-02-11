import { initDb } from "@/lib/initDb";
import { getPool } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(req) {
  await initDb();
  const pool = getPool();

  const body = await req.json();
  const keywords = (body.keywords || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const locations = (body.locations || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const limit = Math.max(5, Math.min(200, Number(body.limit || 40)));

  if (!keywords.length || !locations.length) {
    return Response.json(
      { error: "Keywords and locations are required" },
      { status: 400 }
    );
  }

  let created = 0;
  for (const keyword of keywords) {
    for (const location of locations) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO jobs (id, keyword, location, status) VALUES ($1,$2,$3,'pending')`,
        [id, keyword, location]
      );
      created++;
    }
  }

  return Response.json({ created, limit });
}
