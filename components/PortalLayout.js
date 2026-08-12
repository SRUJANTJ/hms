import Link from "next/link";
import { useRouter } from "next/router";

const THEMES = {
  admin: { bar: "bg-gray-900", accent: "text-primary-400", ring: "bg-gray-800" },
  warden: { bar: "bg-emerald-800", accent: "text-emerald-200", ring: "bg-emerald-700" },
  student: { bar: "bg-primary-700", accent: "text-primary-100", ring: "bg-primary-600" },
};

export default function PortalLayout({ role, user, links, title, children }) {
  const router = useRouter();
  const theme = THEMES[role] || THEMES.admin;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(role === "admin" ? "/admin/login" : role === "warden" ? "/warden/login" : "/login");
  }

  return (
    <div className="min-h-screen flex bg-[#f4f5fb]">
      <aside className={`w-60 shrink-0 ${theme.bar} text-white flex flex-col`}>
        <div className="px-5 py-5 border-b border-white/10">
          <p className="font-bold text-lg leading-tight">Hostel MS</p>
          <p className={`text-xs uppercase tracking-wide ${theme.accent}`}>{role} panel</p>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const active = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active ? `${theme.ring} text-white` : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold overflow-hidden">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="w-full h-full object-cover" />
              ) : (
                (user?.name || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-1 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg px-3 py-2 text-left"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-gray-100 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
