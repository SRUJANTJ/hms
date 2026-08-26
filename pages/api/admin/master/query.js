import { withAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

// Statement timeout so a runaway/expensive query from the console
// can't hang the connection pool for the whole app.
const STATEMENT_TIMEOUT_MS = 15000;

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { sql } = req.body || {};

  if (!sql || typeof sql !== "string" || !sql.trim()) {
    return res.status(400).json({ error: "SQL query is required" });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

    const startedAt = Date.now();
    const result = await client.query(sql);
    const durationMs = Date.now() - startedAt;

    // pg returns an array of results when multiple statements are
    // separated by `;` in one call - normalize to the last one so
    // the UI always has a single result set to show, but report how
    // many statements ran.
    const results = Array.isArray(result) ? result : [result];
    const last = results[results.length - 1];

    return res.status(200).json({
      command: last.command,
      rowCount: last.rowCount,
      fields: (last.fields || []).map((f) => f.name),
      rows: last.rows || [],
      statementCount: results.length,
      durationMs,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Query failed",
      detail: error.detail || undefined,
      hint: error.hint || undefined,
      position: error.position || undefined,
    });
  } finally {
    client.release();
  }
}

export default withAuth(handler, ["admin"]);
