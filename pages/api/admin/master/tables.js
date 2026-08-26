import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const tablesResult = await query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  const tables = [];

  for (const row of tablesResult.rows) {
    const tableName = row.table_name;

    // tableName comes straight from information_schema, not from user
    // input, so it's safe to interpolate into an identifier here.
    const [countResult, columnsResult] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM "public"."${tableName}"`),
      query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      ),
    ]);

    tables.push({
      name: tableName,
      rowCount: countResult.rows[0]?.count ?? 0,
      columns: columnsResult.rows,
    });
  }

  return res.status(200).json({ tables });
}

export default withAuth(handler, ["admin"]);
