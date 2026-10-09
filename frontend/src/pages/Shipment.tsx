import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Box, Truck, ClipboardCheck, CheckCircle2, Package, Plane, Ship, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { STATUS_OPTIONS, STATUS_LABEL, STATUS_STYLE } from '../lib/freight';
import { ModalShipment, ShipmentItemRow } from '../components/shipment/ShipmentItemsModal';
import ShipmentDetailCard from '../components/shipment/ShipmentDetailCard';

// Dark-mode complements for the shared (light-only) STATUS_STYLE badge colors.
const STATUS_STYLE_DARK: Record<string, string> = {
  PROCESSING: 'dark:bg-orange-500/15 dark:text-orange-300',
  IN_TRANSIT: 'dark:bg-blue-500/15 dark:text-blue-300',
  AT_PORT_JAMAICA: 'dark:bg-orange-500/15 dark:text-orange-300',
  OUT_FOR_DELIVERY: 'dark:bg-green-500/15 dark:text-green-300',
  DELIVERED: 'dark:bg-green-500/15 dark:text-green-300',
};

interface Shipment extends ModalShipment {
  weight: number | null;
  createdAt: string;
  items: ShipmentItemRow[];
}

const PAGE_SIZE = 6;

export default function Shipment() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  // Clicking a shipment expands an inline preview panel above the table instead of
  // navigating away — toggled by re-clicking the same row, or the panel's close button.
  const [expandedShipment, setExpandedShipment] = useState<Shipment | null>(null);
  const [layout, setLayout] = useState<'table' | 'bubble'>('table');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get('/shipments/mine')
      .then(r => setShipments(r.data))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => ({
    total: shipments.length,
    inTransit: shipments.filter(s => s.status === 'IN_TRANSIT').length,
    readyForPickup: shipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length,
    delivered: shipments.filter(s => s.status === 'DELIVERED').length,
  }), [shipments]);

  const filtered = useMemo(() => {
    let list = shipments;
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.trackingNumber.toLowerCase().includes(q) ||
        (s.batch?.batchNumber || '').toLowerCase().includes(q) ||
        s.origin.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q)
      );
    }
    return list;
  }, [shipments, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statCards = [
    { label: 'Total Shipments', value: stats.total, icon: Box, color: 'bg-sky-500' },
    { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'bg-green-500' },
    { label: 'Ready for Pickup', value: stats.readyForPickup, icon: ClipboardCheck, color: 'bg-green-500' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'bg-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)]">
      {/* Header */}
      <div className="bg-white dark:bg-transparent border-b border-gray-100 dark:border-none shadow-none dark:shadow-none text-gray-900 dark:text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1.5">Shipments</h1>
          <p className="text-gray-600 dark:text-white/50 text-sm">Manage and track all your shipments in one place.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        {!user ? (
          <div className="panel-glass rounded-2xl text-center py-16">
            <Package className="w-14 h-14 text-gray-200 dark:text-white/10 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-white/50 mb-4">Sign in to view your shipments.</p>
            <Link to="/login" className="inline-block bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white px-5 py-2.5 rounded-xl text-sm font-medium">Sign In</Link>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search shipments..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => setFilterOpen(v => !v)}
                  className={`p-2.5 rounded-xl border transition-colors ${statusFilter ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300' : 'bg-white dark:bg-white/[0.06] border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50'}`}
                  aria-label="Filter by status"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1b1c24] rounded-xl shadow-xl dark-depth border border-gray-200 dark:border-white/10 py-1.5 z-50">
                      <button
                        onClick={() => { setStatusFilter(''); setFilterOpen(false); setPage(1); }}
                        className={`w-full text-left px-3.5 py-2 text-sm ${!statusFilter ? 'text-brand-700 dark:text-brand-300 font-medium' : 'text-gray-600 dark:text-white/60'} hover:bg-gray-50 dark:hover:bg-white/5`}
                      >
                        All statuses
                      </button>
                      {STATUS_OPTIONS.map(s => (
                        <button
                          key={s.value}
                          onClick={() => { setStatusFilter(s.value); setFilterOpen(false); setPage(1); }}
                          className={`w-full text-left px-3.5 py-2 text-sm ${statusFilter === s.value ? 'text-brand-700 dark:text-brand-300 font-medium' : 'text-gray-600 dark:text-white/60'} hover:bg-gray-50 dark:hover:bg-white/5`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/10 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setLayout('table')}
                  title="Table layout"
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${layout === 'table' ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('bubble')}
                  title="Bubble layout"
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${layout === 'bubble' ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}
                >
                  Bubble
                </button>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="panel-glass rounded-2xl p-4 flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{loading ? '—' : value}</p>
                    <p className="text-xs text-gray-400 dark:text-white/40 mt-1.5 truncate">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Shipment preview panel — expands upward above the table when a shipment
                row is clicked, no navigation. Pure-CSS grid-rows transition so arbitrary
                content height animates smoothly without JS measuring. Renders the full
                shipment detail card (status, courier & tracking list, invoice upload,
                print, etc.) inline — the same content as the standalone Shipment
                Details page. */}
            <div className={`grid transition-all duration-300 ease-out ${expandedShipment ? 'grid-rows-[1fr] opacity-100 mb-1' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                {expandedShipment && (
                  <ShipmentDetailCard
                    key={expandedShipment.id}
                    id={expandedShipment.id}
                    onClose={() => setExpandedShipment(null)}
                    showOpenLink
                  />
                )}
              </div>
            </div>

            {/* Table / Bubble */}
            <div className="panel-glass rounded-2xl overflow-hidden">
              {layout === 'bubble' ? (
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center gap-4 px-3 text-xs font-semibold text-gray-400 dark:text-white/40">
                    <div className="min-w-[220px]">Shipment</div>
                    <div className="flex-1 hidden sm:block">Route</div>
                    <div className="w-[170px] flex-shrink-0">Status</div>
                    <div className="w-20 flex-shrink-0 text-right">Price</div>
                  </div>
                  {loading ? (
                    <div className="text-center py-16 text-gray-400 dark:text-white/30">Loading…</div>
                  ) : pageItems.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 dark:text-white/30">
                      {shipments.length === 0 ? 'No shipments on your account yet.' : 'No shipments match your search.'}
                    </div>
                  ) : pageItems.map(s => {
                    const TypeIcon = s.type === 'SEA' ? Ship : Plane;
                    const hasIssue = !!s.issueStatus && s.issueStatus !== 'No issue';
                    return (
                      <div
                        key={s.id}
                        onClick={() => setExpandedShipment(prev => prev?.id === s.id ? null : s)}
                        className={`cursor-pointer rounded-2xl px-4 py-3.5 flex items-center gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_-10px_rgba(0,0,0,0.2)] transition-colors ${expandedShipment?.id === s.id ? 'bg-brand-50/60 dark:bg-brand-500/10' : 'bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.07]'}`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.type === 'SEA' ? 'bg-teal-50 dark:bg-teal-500/10' : 'bg-blue-50 dark:bg-blue-500/10'} ${hasIssue ? 'shadow-glow-red animate-pulse' : ''}`}>
                          <TypeIcon className={`w-4 h-4 ${s.type === 'SEA' ? 'text-teal-600 dark:text-teal-400' : 'text-blue-600 dark:text-blue-400'}`} />
                        </div>
                        <div className="min-w-[220px] flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{s.batch?.batchNumber || s.trackingNumber}</p>
                            {hasIssue && (
                              <span title={`Action needed: ${s.issueStatus}`} className="flex-shrink-0">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-white/30">{s.trackingNumber} · {s.itemCount} item{s.itemCount === 1 ? '' : 's'} · {s.type}</p>
                        </div>
                        <div className="flex-1 hidden sm:block text-sm text-gray-600 dark:text-white/60 truncate">Florida, USA → Montego Bay, JA</div>
                        <div className="w-[170px] flex-shrink-0">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status] || 'bg-gray-100 text-gray-600'} ${STATUS_STYLE_DARK[s.status] || 'dark:bg-white/10 dark:text-white/60'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </div>
                        <div className="w-20 flex-shrink-0 text-right text-sm font-semibold text-gray-900 dark:text-white">${s.totalUSD.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/10 text-left text-gray-400 dark:text-white/40">
                      <th className="px-6 py-3.5 font-medium">Shipment</th>
                      <th className="px-6 py-3.5 font-medium">Route</th>
                      <th className="px-6 py-3.5 font-medium">Status</th>
                      <th className="px-6 py-3.5 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} className="text-center py-16 text-gray-400 dark:text-white/30">Loading…</td></tr>
                    ) : pageItems.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-16 text-gray-400 dark:text-white/30">
                        {shipments.length === 0 ? 'No shipments on your account yet.' : 'No shipments match your search.'}
                      </td></tr>
                    ) : pageItems.map(s => {
                      const TypeIcon = s.type === 'SEA' ? Ship : Plane;
                      const hasIssue = !!s.issueStatus && s.issueStatus !== 'No issue';
                      return (
                      <tr key={s.id} onClick={() => setExpandedShipment(prev => prev?.id === s.id ? null : s)} className={`cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-b-0 transition-colors ${expandedShipment?.id === s.id ? 'bg-brand-50/60 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.type === 'SEA' ? 'bg-teal-50 dark:bg-teal-500/10' : 'bg-blue-50 dark:bg-blue-500/10'} ${hasIssue ? 'shadow-glow-red animate-pulse' : ''}`}>
                              <TypeIcon className={`w-4 h-4 ${s.type === 'SEA' ? 'text-teal-600 dark:text-teal-400' : 'text-blue-600 dark:text-blue-400'}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">{s.batch?.batchNumber || s.trackingNumber}</p>
                                {hasIssue && (
                                  <span title={`Action needed: ${s.issueStatus}`} className="flex-shrink-0">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 dark:text-white/30">{s.trackingNumber} · {s.itemCount} item{s.itemCount === 1 ? '' : 's'} · {s.type}</p>
                              {hasIssue && <p className="text-[11px] text-red-500 font-medium mt-0.5">{s.issueStatus} — please check this shipment</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-white/60 whitespace-nowrap">Florida, USA → Montego Bay, JA</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status] || 'bg-gray-100 text-gray-600'} ${STATUS_STYLE_DARK[s.status] || 'dark:bg-white/10 dark:text-white/60'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold whitespace-nowrap">${s.totalUSD.toFixed(2)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}

              {!loading && filtered.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/10 text-sm text-gray-400 dark:text-white/40">
                  <span>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} shipment{filtered.length === 1 ? '' : 's'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: pages }).slice(0, 6).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i + 1)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === i + 1 ? 'bg-brand-800 text-white' : 'border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(pages, p + 1))}
                      disabled={page === pages}
                      className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
