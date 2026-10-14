import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const PORTAL = {
  admin: { href: "/admin", label: "Admin portal" },
  warden: { href: "/warden", label: "Warden portal" },
  student: { href: "/student", label: "Student portal" },
};

export default function Home() {
  const router = useRouter();
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    fetch("/api/auth/sessions")
      .then((r) => r.json())
      .then(({ sessions }) => {
        if (sessions.length === 0) return router.replace("/warden/login");
        if (sessions.length === 1) return router.replace(PORTAL[sessions[0].role].href);
        setSessions(sessions);
      })
      .catch(() => router.replace("/warden/login"));
  }, []);

  if (!sessions) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5fb] px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-gray-800 mb-1">Choose a portal</h1>
        <p className="text-sm text-gray-500 mb-5">You are signed in to more than one role.</p>
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link
              key={s.role}
              href={PORTAL[s.role].href}
              className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
            >
              <p className="text-sm font-medium text-gray-800">{PORTAL[s.role].label}</p>
              <p className="text-xs text-gray-500">{s.name} · {s.email}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}