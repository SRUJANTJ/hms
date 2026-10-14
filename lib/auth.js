// lib/auth.js
import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const BASE_COOKIE = "hms_token"; // old single-session cookie (legacy)
const MAX_AGE = 60 * 60 * 24; // 24 hours

export const PORTALS = ["admin", "warden", "student"];

// "staff" signs in through the warden portal, so it shares the warden cookie.
export function portalOfRole(role) {
  if (role === "staff") return "warden";
  return PORTALS.includes(role) ? role : null;
}

// admin -> hms_token_admin, warden -> hms_token_warden, student -> hms_token_student
export function cookieNameFor(role) {
  const portal = portalOfRole(role);
  return portal ? `${BASE_COOKIE}_${portal}` : BASE_COOKIE;
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MAX_AGE });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

// setHeader("Set-Cookie", x) would overwrite earlier cookies; this appends.
function appendCookie(res, cookieString) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", cookieString);
  else res.setHeader("Set-Cookie", [].concat(existing, cookieString));
}

export function setAuthCookie(res, token, role) {
  appendCookie(
    res,
    serialize(cookieNameFor(role), token, { ...baseCookieOptions(), maxAge: MAX_AGE })
  );
  // Remove the old shared cookie so it can't shadow a per-role session.
  appendCookie(res, serialize(BASE_COOKIE, "", { ...baseCookieOptions(), maxAge: -1 }));
}

// Logout one role (others stay logged in). With no role, clear everything.
export function clearAuthCookie(res, role) {
  const names = role
    ? [cookieNameFor(role)]
    : [...PORTALS.map(cookieNameFor), BASE_COOKIE];
  names.forEach((name) =>
    appendCookie(res, serialize(name, "", { ...baseCookieOptions(), maxAge: -1 }))
  );
}

function firstSegment(pathname = "") {
  return pathname.split("/").filter(Boolean)[0] || null;
}

// Which portal is this request from?
// 1) x-hms-role header  2) Referer path  3) /api/student|warden prefix
export function getRequestedRole(req) {
  const header = req.headers["x-hms-role"];
  if (header && portalOfRole(String(header))) return portalOfRole(String(header));

  if (req.headers.referer) {
    try {
      const seg = firstSegment(new URL(req.headers.referer).pathname);
      if (PORTALS.includes(seg)) return seg;
    } catch (e) {}
  }

  const apiMatch = (req.url || "").match(/^\/api\/(student|warden)\//);
  if (apiMatch) return apiMatch[1];

  return null;
}

export function getTokenFromReq(req, role) {
  const wanted = role ? portalOfRole(role) : getRequestedRole(req);
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};

  if (wanted) {
    if (cookies[cookieNameFor(wanted)]) return cookies[cookieNameFor(wanted)];
  } else if (cookies[BASE_COOKIE]) {
    return cookies[BASE_COOKIE];
  }

  if (req.headers.authorization?.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
}

export function getUserFromReq(req, role) {
  const token = getTokenFromReq(req, role);
  if (!token) return null;
  return verifyToken(token);
}

// All roles logged in on this browser: [{ role, user }]
export function getAllSessions(req) {
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  return PORTALS.map((portal) => {
    const token = cookies[cookieNameFor(portal)];
    const user = token ? verifyToken(token) : null;
    return user ? { role: portal, user } : null;
  }).filter(Boolean);
}

export function withAuth(handler, roles = []) {
  return async (req, res) => {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }
    req.user = user;
    return handler(req, res);
  };
}

export const AUTH_COOKIE_NAME = BASE_COOKIE;