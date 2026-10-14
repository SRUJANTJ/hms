// lib/useAuthGuard.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

// Protects a page client-side: redirects to `loginPath` if not authenticated
// or if the user's role isn't in `allowedRoles`. Returns { user, loading }.
export function useAuthGuard(allowedRoles, loginPath) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
fetch("/api/auth/me", { headers: currentPortalHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!active) return;
        if (allowedRoles && !allowedRoles.includes(data.user.role)) {
          router.replace(loginPath);
          return;
        }
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        if (active) router.replace(loginPath);
      });
    return () => {
      active = false;
    };
  }, []);

  return { user, loading };
}

export async function apiFetch(url, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...currentPortalHeaders(),
      ...(headers || {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export function portalFromPath(pathname) {
  const seg = (pathname || "").split("/").filter(Boolean)[0];
  return ["admin", "warden", "student"].includes(seg) ? seg : null;
}

export function currentPortalHeaders() {
  if (typeof window === "undefined") return {};
  const portal = portalFromPath(window.location.pathname);
  return portal ? { "x-hms-role": portal } : {};
}