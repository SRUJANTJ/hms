// lib/auth.js
import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "hms_token";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

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

export function setAuthCookie(res, token) {
  const cookie = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  res.setHeader("Set-Cookie", cookie);
}

export function clearAuthCookie(res) {
  const cookie = serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: -1,
    path: "/",
  });
  res.setHeader("Set-Cookie", cookie);
}

export function getTokenFromReq(req) {
  // 1. cookie
  if (req.headers.cookie) {
    const cookies = parse(req.headers.cookie);
    if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  }
  // 2. Authorization header (Bearer)
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
}

export function getUserFromReq(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  return verifyToken(token);
}

// Wrap an API handler, requiring one of `roles` (array). Attaches req.user.
export function withAuth(handler, roles = []) {
  return async (req, res) => {
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }
    req.user = user;
    return handler(req, res);
  };
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
