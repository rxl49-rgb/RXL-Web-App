import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings, Truck, LogOut, Phone, MapPin, Calendar, ArrowRight, X, Copy, Check, Package } from 'lucide-react';
import MailIcon from '../components/icons/MailIcon';
import { useAuth } from '../context/AuthContext';

type Tab = 'overview' | 'profile';

export default function Dashboard() {
  const { user, logout, updateProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [showAddressInfo, setShowAddressInfo] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const suiteCode = user?.customerCode || '—';
  const warehouseAddressLines = [
    user?.name ? `${user.name} ${suiteCode}` : '',
    '10380 West State Road 84 STE 2',
    'Davie, Florida 33324',
    'USA',
  ].filter(Boolean);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(warehouseAddressLines.join('\n'));
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(profileForm);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)]">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6 flex items-center justify-between">
        <div>
          <p className="text-gray-400 dark:text-white/50 text-sm mb-1">Welcome back</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user?.name}</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-gray-400 dark:text-white/60 hover:text-red-500 dark:hover:text-white text-sm transition-colors">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex flex-col lg:flex-row gap-7">
          {/* Sidebar */}
          <aside className="lg:w-52 flex-shrink-0">
            <nav className="panel-glass rounded-2xl overflow-hidden">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors border-b last:border-b-0 ${tab === id ? 'bg-brand-800 text-white' : 'text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
              <button onClick={logout} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border-t transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </nav>
          </aside>

          {/* Main */}
          <div className="flex-1">
            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Account summary */}
                <div className="panel-glass rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-brand-800 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate">{user?.name}</p>
                      <p className="text-sm text-gray-400 dark:text-white/40 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-white/60">
                      <MailIcon className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-white/30" />
                      <span className="truncate">{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-white/60">
                      <Phone className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-white/30" />
                      <span className="truncate">{user?.phone || 'No phone on file'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-white/60">
                      <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-white/30" />
                      <span className="truncate">{user?.address || 'No address on file'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link to="/shipment" className="panel-glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow group">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-brand-700 dark:text-brand-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">My Shipments</p>
                      <p className="text-xs text-gray-400 dark:text-white/40">View and track all your shipments</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-white/30 group-hover:text-brand-700 dark:group-hover:text-white transition-colors flex-shrink-0" />
                  </Link>
                  <button onClick={() => setShowAddressInfo(true)} className="panel-glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow group text-left">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-brand-700 dark:text-brand-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Shipping Address Info</p>
                      <p className="text-xs text-gray-400 dark:text-white/40">Your U.S. warehouse address for purchases</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-white/30 group-hover:text-brand-700 dark:group-hover:text-white transition-colors flex-shrink-0" />
                  </button>
                </div>

                {user?.createdAt && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-white/30 px-1">
                    <Calendar className="w-3.5 h-3.5" /> Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            )}

            {/* Profile tab */}
            {tab === 'profile' && (
              <div className="panel-glass rounded-2xl p-6">
                <h2 className="font-bold text-gray-900 dark:text-white mb-6">My Profile</h2>
                <div className="flex items-center gap-4 mb-7 pb-7 border-b">
                  <div className="w-16 h-16 bg-brand-800 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{user?.name}</p>
                    <p className="text-sm text-gray-400 dark:text-white/40">{user?.email}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${user?.role === 'ADMIN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{user?.role}</span>
                  </div>
                </div>
                <form onSubmit={handleProfileSave} className="space-y-4 max-w-md">
                  {[['name', 'Full Name', 'text'], ['phone', 'Phone', 'tel'], ['address', 'Default Shipping Address', 'text']].map(([key, label, type]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">{label}</label>
                      <input type={type} value={(profileForm as any)[key]} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Email</label>
                    <input type="email" value={user?.email || ''} disabled className="w-full border rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-white/[0.03] text-gray-400 dark:text-white/30 cursor-not-allowed" />
                    <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Email cannot be changed</p>
                  </div>
                  <button type="submit" className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${profileSaved ? 'bg-green-500 text-white' : 'bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white'}`}>
                    {profileSaved ? '✓ Saved!' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddressInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl dark-depth max-w-md w-full p-7">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand-800 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-white" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Shipping Address Info</h3>
                  <p className="text-xs text-gray-400 dark:text-white/40">Use this as your delivery address when shopping online</p>
                </div>
              </div>
              <button onClick={() => setShowAddressInfo(false)} className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-gray-200 dark:border-white/10 rounded-xl p-4 bg-gray-50 dark:bg-white/5">
              {warehouseAddressLines.map((line, i) => (
                <p key={i} className={`text-sm ${i === 0 ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/60'}`}>{line}</p>
              ))}
            </div>

            <p className="text-xs text-gray-400 dark:text-white/40 mt-3 leading-relaxed">
              Always include your suite number (<strong className="text-gray-500 dark:text-white/60">{suiteCode}</strong>) on every package so it can be matched to your account when it arrives at the warehouse.
            </p>

            <button onClick={handleCopyAddress}
              className="w-full flex items-center justify-center gap-2 mt-5 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-2.5 rounded-xl text-sm">
              {addressCopied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy Address</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
