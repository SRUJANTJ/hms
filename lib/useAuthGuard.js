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
    fetch("/api/auth/me")
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
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }
  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}
