import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Ship, Package, Banknote, UsersRound, Box, UserPlus, Plus, ChevronRight, ChevronDown,
  Search, Bell, ArrowRight, TrendingUp, Truck,
} from 'lucide-react';
import api from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fmtMoney, DEFAULT_EXCHANGE_RATE_JMD_PER_USD } from '../../lib/freight';

interface Customer {
  id: string;
  customerCode: string | null;
  name: string;
  email: string;
  lastActiveAt: string | null;
  createdAt: string;
}
interface Shipment { id: string; status: string; destination: string; createdAt: string }
interface Order { id: string; total: number; status: string; createdAt: string }

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: 'Processing', PICKED_UP: 'Picked Up', IN_TRANSIT: 'In Transit',
  CUSTOMS_CLEARANCE: 'Customs', OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered', EXCEPTION: 'Exception', RETURNED: 'Returned',
};
const STATUS_COLOR: Record<string, string> = {
  PROCESSING: '#60a5fa', PICKED_UP: '#a78bfa', IN_TRANSIT: '#38bdf8',
  CUSTOMS_CLEARANCE: '#fbbf24', OUT_FOR_DELIVERY: '#2dd4bf',
  DELIVERED: '#4ade80', EXCEPTION: '#f87171', RETURNED: '#9ca3af',
};

// Soft, flat Apple-style card — solid surface + hairline border, no blur/glow.
const CARD = 'bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/[0.07] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.16)] dark:shadow-none';

function quarterLabel(date: Date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()} Q${q}`;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function initialsOf(name?: string | null) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name.slice(0, 2).toUpperCase();
}

function QuarterlyRevenueChart({ data, dark }: { data: { label: string; value: number }[]; dark: boolean }) {
  const width = 720;
  const height = 240;
  const padL = 90;
  const padB = 30;
  const padT = 10;
  const max = Math.max(1, ...data.map(d => d.value));
  const niceMax = Math.ceil(max / 5) * 5 || 1;
  const xStep = data.length > 1 ? (width - padL - 10) / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padL + i * xStep;
    const y = padT + (1 - d.value / niceMax) * (height - padT - padB);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? padL} ${height - padB} L ${padL} ${height - padB} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const tickTextColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(55,65,81,0.65)';
  const lineColor = dark ? '#3392ff' : '#0071e3';
  const dotStroke = dark ? '#141414' : '#ffffff';

  return (
    <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full h-auto">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.30" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map(t => {
        const y = padT + (1 - t) * (height - padT - padB);
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={width - 5} y2={y} stroke={gridColor} strokeWidth={1} />
            <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="11" fill={tickTextColor}>
              J${Math.round(niceMax * t).toLocaleString()}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#revFill)" stroke="none" />
      <path d={path} fill="none" stroke={lineColor} strokeWidth={2.5} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={lineColor} stroke={dotStroke} strokeWidth={1.5} />
      ))}
      {points.map((p, i) => (
        i % Math.ceil(points.length / 9) === 0 ? (
          <text key={i} x={p.x} y={height + 15} textAnchor="middle" fontSize="10" fill={tickTextColor}>{p.label}</text>
        ) : null
      ))}
    </svg>
  );
}

function EmptyChartAxis({ dark }: { dark: boolean }) {
  const lineColor = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const textColor = dark ? 'rgba(255,255,255,0.3)' : 'rgba(107,114,128,0.9)';
  const months = ['Apr', 'May', 'Jun'];
  return (
    <svg viewBox="0 0 720 30" className="w-full h-auto mt-2">
      <line x1="10" y1="4" x2="710" y2="4" stroke={lineColor} strokeWidth={1} />
      {months.map((m, i) => (
        <text key={m} x={40 + i * ((720 - 80) / (months.length - 1))} y="22" textAnchor="middle" fontSize="11" fill={textColor}>{m}</text>
      ))}
    </svg>
  );
}

function DonutChart({ segments, size = 140, dark }: { segments: { label: string; value: number; color: string }[]; size?: number; dark: boolean }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const trackColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} className="-rotate-90 flex-shrink-0">
      <circle cx="70" cy="70" r={radius} fill="none" stroke={trackColor} strokeWidth="18" />
      {total > 0 && segments.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * circumference;
        const el = (
          <circle
            key={i}
            cx="70" cy="70" r={radius} fill="none"
            stroke={s.color} strokeWidth="18"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// Decorative ascending bar sparkline — a small visual flourish on each dark stat
// card, matching the reference dashboard's little bar-chart accent per card.
function MiniBars({ color }: { color: string }) {
  const heights = [35, 50, 42, 65, 55, 85];
  return (
    <div className="flex items-end gap-1 h-10 flex-shrink-0">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-1.5 rounded-sm"
          style={{ height: `${h}%`, background: color, opacity: 0.55 + (i / heights.length) * 0.45 }}
        />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [jmdPerUsd, setJmdPerUsd] = useState(DEFAULT_EXCHANGE_RATE_JMD_PER_USD);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/customers', { params: { status: 'ALL', limit: 200, sortBy: 'createdAt', sortDir: 'desc' } }),
      api.get('/shipments'),
      api.get('/orders'),
    ]).then(([all, ship, ord]) => {
      setCustomers(all.data.customers);
      setShipments(ship.data);
      setOrders(ord.data);
    }).finally(() => setLoading(false));
    api.get('/currency').then(r => setJmdPerUsd(r.data.jmdPerUsd)).catch(() => { /* keep default */ });
  }, []);

  const monthStart = startOfMonth();

  const packagesStats = useMemo(() => {
    const shippedThisMonth = shipments.filter(s => new Date(s.createdAt) >= monthStart).length;
    const inTransit = shipments.filter(s => s.status === 'IN_TRANSIT').length;
    const inMiami = shipments.filter(s => /miami/i.test(s.destination || '') && s.status !== 'DELIVERED').length;
    return { shippedThisMonth, inTransit, inMiami };
  }, [shipments]);

  const processedStats = useMemo(() => {
    const processing = shipments.filter(s => s.status === 'PROCESSING').length;
    const readyForPickup = shipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length;
    return { processing, readyForPickup };
  }, [shipments]);

  const revenueStats = useMemo(() => {
    const thisMonthOrders = orders.filter(o => new Date(o.createdAt) >= monthStart);
    const revenue = thisMonthOrders.reduce((s, o) => s + o.total, 0);
    const collected = orders.filter(o => o.status === 'DELIVERED' && new Date(o.createdAt) >= monthStart).length;
    return { revenue, collected };
  }, [orders]);

  const memberStats = useMemo(() => {
    const registeredThisMonth = customers.filter(c => new Date(c.createdAt) >= monthStart).length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeThisMonth = customers.filter(c => c.lastActiveAt && new Date(c.lastActiveAt) >= thirtyDaysAgo).length;
    return { registeredThisMonth, activeThisMonth };
  }, [customers]);

  const quarterlyData = useMemo(() => {
    const totals: Record<string, number> = {};
    orders.forEach(o => {
      const label = quarterLabel(new Date(o.createdAt));
      totals[label] = (totals[label] || 0) + o.total * jmdPerUsd;
    });
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, sortKey: label }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [orders, jmdPerUsd]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    shipments.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([status, value]) => ({ label: STATUS_LABEL[status] || status, value, color: STATUS_COLOR[status] || '#9ca3af' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [shipments]);
  const statusTotal = statusBreakdown.reduce((s, x) => s + x.value, 0) || 1;

  const latestMembers = customers.slice(0, 6);

  const cards = [
    {
      barColor: '#38bdf8',
      icon: Ship, title: 'PACKAGES IN TRANSIT',
      big: loading ? '—' : String(packagesStats.shippedThisMonth + packagesStats.inTransit),
      subs: [
        `${loading ? '—' : packagesStats.shippedThisMonth} shipped this month`,
        `${loading ? '—' : packagesStats.inMiami} in Miami  •  ${loading ? '—' : packagesStats.inTransit} in transit`,
      ],
    },
    {
      barColor: '#a78bfa',
      icon: Package, title: 'PROCESSED PACKAGES',
      big: loading ? '—' : String(processedStats.processing),
      subs: [
        `${loading ? '—' : processedStats.processing} processing`,
        `${loading ? '—' : processedStats.readyForPickup} ready for pickup`,
      ],
    },
    {
      barColor: '#60a5fa',
      icon: Banknote, title: 'REVENUE THIS MONTH (JMD)',
      big: loading ? '—' : `J$${fmtMoney(revenueStats.revenue * jmdPerUsd)}`,
      subs: [
        `${loading ? '—' : revenueStats.collected} items collected`,
      ],
    },
    {
      barColor: '#fb923c',
      icon: UsersRound, title: 'MEMBERS',
      big: loading ? '—' : String(memberStats.registeredThisMonth + memberStats.activeThisMonth),
      subs: [
        `${loading ? '—' : memberStats.registeredThisMonth} registered this month`,
        `${loading ? '—' : memberStats.activeThisMonth} active this month`,
      ],
    },
  ];

  const quickActions = [
    { label: 'Create Batch', to: '/admin/batches', icon: Ship, tint: 'bg-blue-500/15 text-blue-500 dark:text-blue-400' },
    { label: 'New Freight Entry', to: '/admin/freight', icon: Box, tint: 'bg-purple-500/15 text-purple-500 dark:text-purple-400' },
    { label: 'Add Customer', to: '/admin/customers', icon: UserPlus, tint: 'bg-brand-500/15 text-brand-600 dark:text-brand-400' },
  ];

  return (
    <div className="min-h-full bg-white dark:bg-black">
      <div className="px-6 pt-5 flex items-center justify-between gap-6 flex-wrap">
        <div className="text-xs text-gray-400 dark:text-white/30 order-2 sm:order-1">Home <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Dashboard</span></div>
        <div className="flex items-center gap-3 order-1 sm:order-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 pr-9 py-2 rounded-xl text-sm bg-gray-100 dark:bg-white/[0.06] border border-transparent dark:border-white/[0.08] text-gray-700 dark:text-white/70 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500/30 w-52 sm:w-64 transition-shadow"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] leading-none text-gray-400 dark:text-white/30 border border-gray-200 dark:border-white/10 rounded px-1.5 py-1">/</kbd>
          </div>
          <button onClick={() => showToast('No new notifications')} className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/60 hover:text-gray-700 dark:hover:text-white transition-colors flex-shrink-0">
            <Bell className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-full bg-brand-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initialsOf(user?.name)}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Dark blue/black gradient hero + stat widgets, with a blue shadow glow for highlight */}
        <div className="rounded-3xl bg-gradient-to-br from-[#0a1730] via-[#0a1420] to-black shadow-glow-blue p-5 sm:p-7">
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-white/50 mt-1 mb-6">Overview of your logistics operations</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ icon: Icon, title, big, subs, barColor }) => (
              <div key={title} className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-white/90" />
                  </div>
                  <span className="text-[11px] font-bold text-white/50 tracking-wide truncate">{title}</span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[26px] font-extrabold text-white leading-tight">{big}</div>
                    <div className="text-[11px] text-white/35 truncate mt-0.5">{subs[0]}</div>
                  </div>
                  <MiniBars color={barColor} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main bento row */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className={`${CARD} p-5`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900 dark:text-white text-[15px]">Quarterly Revenue (JMD)</h2>
              <button className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/50 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors">
                This Quarter <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="text-center py-16 text-gray-400 dark:text-white/40 text-sm">Loading…</div>
            ) : quarterlyData.length === 0 ? (
              <div className="py-8">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-gray-400 dark:text-white/40" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-[15px]">No order history yet</p>
                  <p className="text-sm text-gray-400 dark:text-white/40">Revenue will chart here once orders come in.</p>
                </div>
                <EmptyChartAxis dark={dark} />
              </div>
            ) : (
              <QuarterlyRevenueChart data={quarterlyData} dark={dark} />
            )}
          </div>

          <div className={CARD}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.07]">
              <h2 className="font-semibold text-gray-900 dark:text-white text-[15px]">Latest Members</h2>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-center py-10 text-gray-400 dark:text-white/40 text-sm">Loading…</div>
              ) : latestMembers.length === 0 ? (
                <div className="flex flex-col items-center gap-3 text-center py-8">
                  <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                    <UsersRound className="w-5 h-5 text-gray-400 dark:text-white/40" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-white/40">No members yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestMembers.map(c => (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 flex-shrink-0 rounded-full bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-sm">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">{c.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-white/40">{new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-center mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.07]">
                <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 font-medium">
                  View All Members <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary bento row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`${CARD} p-5`}>
            <h2 className="font-semibold text-gray-900 dark:text-white text-[15px] mb-4">Shipment Status</h2>
            {loading ? (
              <div className="text-center py-10 text-gray-400 dark:text-white/40 text-sm">Loading…</div>
            ) : statusBreakdown.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center py-8">
                <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                  <Truck className="w-5 h-5 text-gray-400 dark:text-white/40" />
                </div>
                <p className="text-sm text-gray-400 dark:text-white/40">No shipments yet.</p>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <DonutChart segments={statusBreakdown} dark={dark} />
                <div className="space-y-2 flex-1 min-w-0">
                  {statusBreakdown.map(s => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-gray-600 dark:text-white/70 truncate flex-1">{s.label}</span>
                      <span className="text-gray-900 dark:text-white/90 font-semibold">{Math.round((s.value / statusTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`${CARD} p-5`}>
            <h2 className="font-semibold text-gray-900 dark:text-white text-[15px] mb-4">Quick Actions</h2>
            <div className="space-y-1.5">
              {quickActions.map(({ label, to, icon: Icon, tint }) => (
                <Link key={label} to={to} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors group">
                  <div className={`w-9 h-9 rounded-xl ${tint} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-white/80 flex-1">{label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/30 group-hover:text-gray-500 dark:group-hover:text-white/60 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          <button
            onClick={() => showToast('Custom dashboard widgets are coming soon.')}
            className="border-2 border-dashed border-gray-200 dark:border-white/[0.10] rounded-2xl flex flex-col items-center justify-center gap-2 py-8 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Add Widget</span>
          </button>
        </div>
      </div>

      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}
    </div>
  );
}
