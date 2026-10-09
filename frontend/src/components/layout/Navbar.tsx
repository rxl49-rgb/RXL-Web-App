import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, X, LogOut, LayoutDashboard, ChevronDown, Settings, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import CartDrawer from '../store/CartDrawer';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount, setOpen } = useCart();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  // `!text-white` (important) is required here to beat the global `a { color }` base
  // rule in index.css, which would otherwise tint these nav links brand-blue instead
  // of the intended solid white.
  //
  // The active desktop nav item gets a glowing blue-bordered "pill" box
  // (nav-pill-glow) instead of the plain text glow used elsewhere/on mobile.
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm !text-white transition-all ${isActive ? 'nav-pill-glow font-bold' : 'font-medium hover:text-glow-white dark:hover:text-glow-royal-blue'}`;

  return (
    <>
      <nav className="bg-[var(--rxl-menubar-bg,#000000)] sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo.png" alt="RXL Logistics" className="h-14 w-14 object-contain" />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <NavLink to="/" end className={navLinkClass}>Home</NavLink>
              <NavLink to="/shipment" className={navLinkClass}>Shipment</NavLink>
              <NavLink to="/store" className={navLinkClass}>Store</NavLink>
              <NavLink to="/quote" className={navLinkClass}>Get Quote</NavLink>
              <NavLink to="/track" className={navLinkClass}>Track</NavLink>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Cart */}
              <button
                onClick={() => setOpen(true)}
                className="relative p-2 text-white/80 hover:text-white transition-colors"
                aria-label="Open cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>

              {/* Settings / appearance */}
              <div className="relative">
                <button
                  onClick={() => setSettingsOpen(v => !v)}
                  className="p-2 text-white/80 hover:text-white transition-colors"
                  aria-label="Appearance settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-[var(--rxl-menubar-bg,#000000)] rounded-xl shadow-xl dark-depth border border-white/10 py-2 z-50">
                      <p className="px-3.5 pb-2 text-xs font-semibold text-white/40 tracking-wide">APPEARANCE</p>
                      <div className="px-2 flex gap-1.5">
                        <button
                          onClick={() => { setTheme('light'); setSettingsOpen(false); }}
                          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-colors ${theme === 'light' ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/5'}`}
                        >
                          <Sun className="w-4 h-4" /> Light
                        </button>
                        <button
                          onClick={() => { setTheme('dark'); setSettingsOpen(false); }}
                          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/5'}`}
                        >
                          <Moon className="w-4 h-4" /> Dark
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User menu */}
              {user ? (
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setUserMenuOpen(v => !v)}
                    className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium"
                  >
                    <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-[var(--rxl-menubar-bg,#000000)] rounded-xl shadow-xl dark-depth border border-white/10 py-1 z-50">
                      <Link to="/dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <hr className="my-1 border-white/10" />
                      <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 w-full text-left">
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link to="/login" className="text-white hover:text-glow-white dark:hover:text-glow-royal-blue transition-all text-sm font-medium px-3 py-1.5">Sign in</Link>
                  <Link to="/register" className="bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">Sign up</Link>
                </div>
              )}

              {/* Mobile toggle */}
              <button onClick={() => setMobileOpen(v => !v)} className="md:hidden p-2 text-white/80 hover:text-white">
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[var(--rxl-menubar-bg,#000000)] border-t border-white/10 px-4 py-4 space-y-3">
            {[['/', 'Home'], ['/shipment', 'Shipment'], ['/store', 'Store'], ['/quote', 'Get Quote'], ['/track', 'Track']].map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `block text-sm font-medium !text-white py-1 transition-all ${isActive ? 'text-glow-royal-blue dark:text-glow-royal-blue font-semibold' : 'hover:text-glow-white dark:hover:text-glow-royal-blue'}`}>
                {label}
              </NavLink>
            ))}
            <hr className="border-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 mr-1">Appearance</span>
              <button onClick={() => setTheme('light')} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${theme === 'light' ? 'bg-white/15 text-white' : 'text-white/50'}`}>
                <Sun className="w-3.5 h-3.5" /> Light
              </button>
              <button onClick={() => setTheme('dark')} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${theme === 'dark' ? 'bg-white/15 text-white' : 'text-white/50'}`}>
                <Moon className="w-3.5 h-3.5" /> Dark
              </button>
            </div>
            <hr className="border-white/10" />
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm text-white/80 py-1">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex items-center gap-2 text-sm text-red-400 py-1">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </>
            ) : (
              <div className="flex gap-3 pt-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center border border-white/30 text-white text-sm py-2 rounded-lg">Sign in</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="flex-1 text-center bg-brand-800 hover:bg-brand-700 text-white text-sm py-2 rounded-lg">Sign up</Link>
              </div>
            )}
          </div>
        )}
      </nav>

      <CartDrawer />
    </>
  );
}
