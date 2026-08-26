import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { name, page, pageSize } = req.query;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Table name is required" });
  }

  // Validate the table name against the actual catalog before ever
  // putting it into a SQL string. This is what makes it safe to
  // interpolate below - it can only ever be a real table that
  // already exists in this schema, never arbitrary user input.
  const tableCheck = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = $1`,
    [name]
  );

  if (tableCheck.rowCount === 0) {
    return res.status(404).json({ error: "Unknown table" });
  }

  const safeName = tableCheck.rows[0].table_name;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(pageSize, 10) || PAGE_SIZE_DEFAULT));
  const offset = (currentPage - 1) * limit;

  const [columnsResult, countResult, rowsResult] = await Promise.all([
    query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [safeName]
    ),
    query(`SELECT COUNT(*)::int AS count FROM "public"."${safeName}"`),
    query(`SELECT * FROM "public"."${safeName}" ORDER BY 1 LIMIT $1 OFFSET $2`, [limit, offset]),
  ]);

  return res.status(200).json({
    table: safeName,
    columns: columnsResult.rows,
    rowCount: countResult.rows[0]?.count ?? 0,
    page: currentPage,
    pageSize: limit,
    rows: rowsResult.rows,
  });
}

export default withAuth(handler, ["admin"]);
