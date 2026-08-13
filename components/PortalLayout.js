import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Users,
  BedDouble,
  Wallet,
  CalendarClock,
  MessageSquareWarning,
  ClipboardList,
  UserCog,
  Bell,
  UserCircle,
  Circle,
} from 'lucide-react';

const NAV_ICONS = {
  Dashboard: LayoutDashboard,
  Students: Users,
  'Rooms & Hostels': BedDouble,
  Fees: Wallet,
  Attendance: CalendarClock,
  Complaints: MessageSquareWarning,
  'Leave Requests': ClipboardList,
  Leave: ClipboardList,
  'Staff & Wardens': UserCog,
  Notifications: Bell,
  'My Profile': UserCircle,
};

const THEMES = {
  admin: {
    bar: 'bg-gray-900',
    accent: 'text-primary-400',
    ring: 'bg-gray-800',
  },
  warden: {
    bar: 'bg-emerald-800',
    accent: 'text-emerald-200',
    ring: 'bg-emerald-700',
  },
  student: {
    bar: 'bg-primary-700',
    accent: 'text-primary-100',
    ring: 'bg-primary-600',
  },
};

export default function PortalLayout({
  role,
  user,
  links = [],
  title,
  children,
}) {
  const router = useRouter();

  const theme = THEMES[role] || THEMES.admin;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loginPath =
    role === 'admin'
      ? '/admin/login'
      : role === 'warden'
        ? '/warden/login'
        : '/login';

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((current) => !current);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      closeMobileMenu();
      router.push(loginPath);
    }
  };

  /*
    Close the mobile menu by pressing Escape.
  */
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  /*
    Prevent background page scrolling when mobile menu is open.
  */
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const SidebarContent = ({ mobile = false }) => (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
        <div>
          <p className="font-bold text-lg leading-tight">
            Hostel MS
          </p>

          <p
            className={`text-xs uppercase tracking-wide ${theme.accent}`}
          >
            {role} panel
          </p>
        </div>

        {mobile && (
          <button
            type="button"
            onClick={closeMobileMenu}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-2xl leading-none text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {links.map((link, index) => {
          const active =
            router.pathname === link.href ||
            router.pathname.startsWith(`${link.href}/`);

          const Icon = NAV_ICONS[link.label] || Circle;

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMobileMenu}
              style={{ animationDelay: `${index * 35}ms` }}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 animate-fade-in-up ${
                active
                  ? `${theme.ring} text-white shadow-sm`
                  : 'text-white/70 hover:translate-x-0.5 hover:bg-white/10 hover:text-white'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-0 h-full w-0.5 bg-white/90" />
              )}

              <Icon
                size={17}
                strokeWidth={2}
                className={`shrink-0 transition-transform duration-200 ${
                  active ? '' : 'group-hover:scale-110'
                }`}
              />

              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs font-semibold">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user?.name || 'User profile'}
                className="h-full w-full object-cover"
              />
            ) : (
              (user?.name || '?').charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.name || 'User'}
            </p>

            <p className="truncate text-xs text-white/50">
              {user?.email || ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f5fb]">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden w-60 shrink-0 text-white md:flex ${theme.bar}`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-black/50 md:hidden animate-fade-in"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] text-white shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        } ${theme.bar}`}
      >
        <SidebarContent mobile />
      </aside>

      {/* Main content */}
      <main className="min-h-screen md:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
          {/* Hamburger button for mobile */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-label={
              mobileMenuOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            aria-expanded={mobileMenuOpen}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition-colors duration-200 hover:bg-gray-100 md:hidden"
          >
            <span
              className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileMenuOpen ? 'rotate-45' : '-translate-y-1.5'
              }`}
            />
            <span
              className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${
                mobileMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileMenuOpen ? '-rotate-45' : 'translate-y-1.5'
              }`}
            />
          </button>

          <h1 className="truncate text-lg font-semibold text-gray-800">
            {title}
          </h1>
        </header>

        <div key={router.asPath} className="p-4 sm:p-6 animate-fade-in-up">
          {children}
        </div>
      </main>
    </div>
  );
}