// lib/rateLimit.js
import { query } from "./db";

// Tuning knobs — adjust freely.
const MAX_ATTEMPTS = 5;         // failed attempts allowed...
const WINDOW_MINUTES = 15;      // ...within this rolling window...
const LOCKOUT_MINUTES = 15;     // ...before locking out for this long.

// Best-effort extraction of the caller's IP behind proxies/load balancers.
export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

// One identifier per (IP + email + role) so brute-forcing a single
// account's password gets locked out, without one bad actor being able
// to lock a legitimate user out just by guessing their email from a
// different IP.
export function loginIdentifier(req, email, role) {
  const ip = getClientIp(req);
  const normalizedEmail = String(email || "").toLowerCase().trim();
  return `${ip}:${normalizedEmail}:${role}`;
}

// Returns { blocked: false } or { blocked: true, retryAfterSeconds }.
// Call this BEFORE checking credentials.
export async function checkLoginRateLimit(identifier) {
  const result = await query(
    `SELECT attempts, first_attempt_at, locked_until FROM login_attempts WHERE identifier = $1`,
    [identifier]
  );
  if (result.rowCount === 0) return { blocked: false };

  const row = result.rows[0];
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const retryAfterSeconds = Math.ceil((new Date(row.locked_until) - new Date()) / 1000);
    return { blocked: true, retryAfterSeconds };
  }

  return { blocked: false };
}

// Call this AFTER a failed login attempt (wrong password, unknown
// email, etc). Resets the counter if the previous window has expired,
// otherwise increments it and locks out once the threshold is hit.
export async function recordFailedLogin(identifier) {
  const result = await query(
    `SELECT attempts, first_attempt_at FROM login_attempts WHERE identifier = $1`,
    [identifier]
  );

  const now = new Date();
  const windowMs = WINDOW_MINUTES * 60 * 1000;

  if (result.rowCount === 0) {
    await query(
      `INSERT INTO login_attempts (identifier, attempts, first_attempt_at, locked_until)
       VALUES ($1, 1, now(), NULL)
       ON CONFLICT (identifier) DO UPDATE SET attempts = 1, first_attempt_at = now(), locked_until = NULL`,
      [identifier]
    );
    return;
  }

  const row = result.rows[0];
  const windowExpired = now - new Date(row.first_attempt_at) > windowMs;

  if (windowExpired) {
    await query(
      `UPDATE login_attempts SET attempts = 1, first_attempt_at = now(), locked_until = NULL WHERE identifier = $1`,
      [identifier]
    );
    return;
  }

  const newAttempts = row.attempts + 1;
  const lockedUntil =
    newAttempts >= MAX_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000)
      : null;

  await query(
    `UPDATE login_attempts SET attempts = $1, locked_until = $2 WHERE identifier = $3`,
    [newAttempts, lockedUntil, identifier]
  );
}

// Call this AFTER a successful login to clear any prior failed attempts.
export async function clearLoginAttempts(identifier) {
  await query(`DELETE FROM login_attempts WHERE identifier = $1`, [identifier]);
}
