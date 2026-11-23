import {
  ChevronDown,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../types';

function getPageTitle(pathname: string): string {
  if (pathname === '/app' || pathname === '/app/dashboard') return 'Dashboard';
  if (pathname.startsWith('/app/absensi-karyawan')) return 'Absensi Karyawan';
  if (pathname.startsWith('/app/absensi-siswa')) return 'Absensi Siswa';
  if (pathname.startsWith('/app/rekap-absensi/karyawan')) return 'Rekap Absensi Karyawan';
  if (pathname.startsWith('/app/rekap-absensi/siswa')) return 'Rekap Absensi Siswa';
  if (pathname.startsWith('/app/data-siswa')) return 'Data Siswa';
  if (pathname.startsWith('/app/user-management')) return 'User Management';
  return 'Portal Absensi';
}

export default function AppLayout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [rekapOpen, setRekapOpen] = useState(true);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-red-700" />
          <p className="mt-3 text-sm font-medium text-neutral-600">Memuat sesi pengguna...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'admin';
  const isGuru = user.role === 'guru';
  const canAccessRekap = isAdmin || isGuru;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-red-700 text-white font-semibold'
        : 'text-neutral-700 hover:bg-red-50 hover:text-red-800'
    }`;

  const subNavItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg py-2 pl-10 pr-3 text-sm transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-red-50 font-semibold text-red-700'
        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
    }`;

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-white border-r border-neutral-200">
      {/* Brand Block */}
      <div className="flex h-16 items-center justify-between border-b border-neutral-200 bg-red-800 px-5 text-white">
        <Link
          to="/"
          className="text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          SMK Prima Unggul
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-red-100 hover:bg-red-700 lg:hidden"
          aria-label="Tutup menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Navigation */}
      <nav aria-label="Menu Aplikasi" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink
          to="/app/dashboard"
          end
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            navItemClass({ isActive: isActive || location.pathname === '/app' })
          }
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/app/absensi-karyawan"
          onClick={() => setMobileOpen(false)}
          className={navItemClass}
        >
          <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Absensi Karyawan</span>
        </NavLink>

        {(isAdmin || isGuru) && (
          <NavLink
            to="/app/absensi-siswa"
            onClick={() => setMobileOpen(false)}
            className={navItemClass}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Absensi Siswa</span>
          </NavLink>
        )}

        {canAccessRekap && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setRekapOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-red-50 hover:text-red-800"
              aria-expanded={rekapOpen}
            >
              <span className="flex items-center gap-3 whitespace-nowrap">
                <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Rekap Absensi</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${rekapOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {rekapOpen && (
              <div className="mt-1 space-y-1">
                {isAdmin && (
                  <NavLink
                    to="/app/rekap-absensi/karyawan"
                    onClick={() => setMobileOpen(false)}
                    className={subNavItemClass}
                  >
                    <span>Absensi Karyawan</span>
                  </NavLink>
                )}
                <NavLink
                  to="/app/rekap-absensi/siswa"
                  onClick={() => setMobileOpen(false)}
                  className={subNavItemClass}
                >
                  <span>Absensi Siswa</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <>
            <NavLink
              to="/app/data-siswa"
              onClick={() => setMobileOpen(false)}
              className={navItemClass}
            >
              <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Data Siswa</span>
            </NavLink>

            <NavLink
              to="/app/user-management"
              onClick={() => setMobileOpen(false)}
              className={navItemClass}
            >
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>User Management</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Sidebar User Summary Footer */}
      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3.5">
        <p className="truncate text-sm font-semibold text-neutral-900">{user.full_name}</p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {ROLE_LABELS[user.role]}
          {user.jabatan ? ` · ${user.jabatan}` : ''}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* Desktop Left Sidebar */}
      <aside className="hidden w-[260px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-neutral-950/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[260px] max-w-[85vw]">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar — Logout on Top Right */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-neutral-400 sm:inline whitespace-nowrap">
                SMK Prima Unggul
              </span>
              <span className="hidden text-neutral-300 sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="truncate font-bold text-neutral-900">
                {getPageTitle(location.pathname)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-neutral-900 leading-tight">
                {user.full_name}
              </p>
              <p className="text-xs text-neutral-500 leading-tight">
                {ROLE_LABELS[user.role]} · {user.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-700 hover:text-white whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
