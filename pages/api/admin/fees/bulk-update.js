import { withAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

const VALID_STATUSES = ["Pending", "Paid", "Overdue"];
const VALID_TYPES = ["Monthly Rent", "Security Deposit", "Late Fee", "Other"];

// Body: { rows: [ { roll_number, fee_type, amount, due_date, status, remarks }, ... ] }
//
// Matches each row to a student by roll_number. If a fee for that
// student with the same fee_type + due_date already exists it is
// updated (amount/status/remarks); otherwise a new fee record is
// created. Each row runs independently so one bad row doesn't block
// the rest of the sheet.
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (rows.length === 0) {
    return res.status(400).json({ error: "No rows to process" });
  }

  if (rows.length > 2000) {
    return res.status(400).json({ error: "Please import 2000 rows or fewer at a time" });
  }

  const pool = getPool();
  const results = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rawRow = rows[index] || {};
    const rowNumber = index + 2;

    const roll_number = String(rawRow.roll_number || "").trim();
    const fee_type = VALID_TYPES.includes(String(rawRow.fee_type || "").trim())
      ? String(rawRow.fee_type).trim()
      : "Monthly Rent";
    const amount = Number(rawRow.amount);
    const due_date = String(rawRow.due_date || "").trim();
    const statusRaw = String(rawRow.status || "").trim();
    const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : null;
    const remarks = String(rawRow.remarks || "").trim() || null;

    if (!roll_number || !amount || Number.isNaN(amount) || !due_date) {
      results.push({
        row: rowNumber,
        roll_number: roll_number || `Row ${rowNumber}`,
        success: false,
        error: "Roll number, amount and due date are required",
      });
      continue;
    }

    try {
      const studentLookup = await pool.query(
        `SELECT s.id FROM students s WHERE lower(s.roll_number) = lower($1) LIMIT 1`,
        [roll_number]
      );

      if (studentLookup.rowCount === 0) {
        results.push({
          row: rowNumber,
          roll_number,
          success: false,
          error: "No student found with this roll number",
        });
        continue;
      }

      const studentId = studentLookup.rows[0].id;

      const existing = await pool.query(
        `SELECT id FROM fees
           WHERE student_id = $1 AND fee_type = $2 AND due_date = $3
           LIMIT 1`,
        [studentId, fee_type, due_date]
      );

      const paid_date = status === "Paid" ? new Date().toISOString().slice(0, 10) : null;

      if (existing.rowCount > 0) {
        await pool.query(
          `UPDATE fees SET
             amount = $1,
             status = COALESCE($2, status),
             remarks = COALESCE($3, remarks),
             paid_date = CASE WHEN $2 = 'Paid' THEN $4 WHEN $2 IS NOT NULL THEN NULL ELSE paid_date END
           WHERE id = $5`,
          [amount, status, remarks, paid_date, existing.rows[0].id]
        );
        results.push({ row: rowNumber, roll_number, success: true, action: "updated" });
      } else {
        await pool.query(
          `INSERT INTO fees (student_id, fee_type, amount, due_date, status, paid_date, remarks)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [studentId, fee_type, amount, due_date, status || "Pending", paid_date, remarks]
        );
        results.push({ row: rowNumber, roll_number, success: true, action: "created" });
      }
    } catch (err) {
      results.push({
        row: rowNumber,
        roll_number,
        success: false,
        error: err.message || "Failed to process this row",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return res.status(200).json({
    successCount,
    failedCount: results.length - successCount,
    results,
  });
}

export default withAuth(handler, ["admin"]);
