import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Ship, Box, BookOpen, ClipboardList, ScanLine, BarChart3, Settings, Radio, Tags, Smartphone, Menu, X, Palette, Bell, Store, Truck, Ruler, Newspaper, ClipboardCheck, Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DeleteGuardProvider } from '../../context/DeleteGuardContext';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/customers', label: 'Customers', icon: Users, end: false },
  { to: '/admin/batches', label: 'Batches', icon: Ship, end: false },
  { to: '/admin/freight', label: 'Freight', icon: Box, end: false },
  { to: '/admin/store', label: 'Store', icon: Store, end: false },
  { to: '/admin/couriers', label: 'Couriers', icon: Truck, end: false },
  { to: '/admin/loading-guide', label: 'Loading Guide', icon: Ruler, end: false },
  { to: '/admin/newsletter', label: 'Newsletter', icon: Newspaper, end: false },
  { to: '/admin/biz-journal', label: 'Biz Journal', icon: BookOpen, end: false },
  { to: '/admin/manifest', label: 'Manifest', icon: ClipboardList, end: false },
  { to: '/admin/warehouse-scans', label: 'Warehouse Scans', icon: ScanLine, end: false },
  { to: '/admin/tally', label: 'Tally', icon: ClipboardCheck, end: false },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3, end: false },
  { to: '/admin/appearance', label: 'Appearance', icon: Palette, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
  { to: '/admin/bulletins', label: 'Bulletins', icon: Megaphone, end: false },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell, end: false },
  { to: '/admin/advertisement', label: 'Advertisement', icon: Radio, end: false },
  { to: '/admin/presets/pricing', label: 'Pricing Presets', icon: Tags, end: false },
  { to: '/admin/presets/shipping', label: 'Shipping Presets', icon: Tags, end: false },
  { to: '/admin/mobile-info', label: 'Mobile Information / Policies', icon: Smartphone, end: false },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (to: string, end: boolean) =>
    end ? location.pathname === to : location.pathname.startsWith(to);

  const drawerItemClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium !text-white transition-all ${
      active
        ? 'bg-white/15 text-glow-royal-blue'
        : 'hover:bg-white/10 hover:text-glow-blue'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0c0d12] flex flex-col">
      {/* Top bar — just branding + the hamburger trigger, pinned to the right */}
      <header className="bg-[var(--rxl-menubar-bg,#000000)] sticky top-0 z-40 border-b border-white/10">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <Link to="/admin" className="flex items-center gap-2 min-w-0 hover:text-glow-blue transition-all">
            <img src="/logo.png" alt="RXL Logistics" className="w-8 h-8 object-contain flex-shrink-0" />
            <span className="text-white font-bold text-sm leading-none truncate hidden sm:inline">
              RXL Admin
            </span>
          </Link>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block text-right leading-none">
              <p className="text-white text-sm font-medium truncate max-w-[160px]">{user?.name}</p>
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              className="flex items-center gap-2 text-white hover:text-glow-blue text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-all"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
              <span className="hidden md:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Right-side hamburger drawer */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 right-0 z-50 h-full w-[86vw] max-w-xs bg-[var(--rxl-menubar-bg,#000000)] border-l border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 flex-shrink-0">
              <span className="text-white font-bold text-sm">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 text-white hover:text-glow-blue rounded-lg hover:bg-white/10 transition-all"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={drawerItemClass(isActive(to, end))}>
                  <Icon className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
              <div className="px-1 pb-2 sm:hidden">
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium !text-white hover:bg-white/10 hover:text-glow-blue transition-all"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Content */}
      <main className="flex-1 min-w-0">
        <DeleteGuardProvider>
          <Outlet />
        </DeleteGuardProvider>
      </main>
    </div>
  );
}
