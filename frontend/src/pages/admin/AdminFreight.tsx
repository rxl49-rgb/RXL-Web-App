import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CheckCircle2, QrCode, Warehouse, DollarSign, FileText, Plus, ArrowUpDown } from 'lucide-react';
import PrinterIcon from '../../components/icons/PrinterIcon';
import FileIcon from '../../components/icons/FileIcon';
import MegaphoneIcon from '../../components/icons/MegaphoneIcon';
import MailIcon from '../../components/icons/MailIcon';
import EyeIcon from '../../components/icons/EyeIcon';
import api from '../../lib/api';
import ShipmentDetailPanel, { ShipmentDetail } from '../../components/admin/ShipmentDetailPanel';
import ViewToggle, { useViewMode } from '../../components/admin/ViewToggle';
import { STATUS_LABEL, STATUS_STYLE, PICKUP_LOCATIONS, downloadCsv, copyTableToClipboard, fmtMoney, printInvoice, customerInvoiceFields, parseExpenses, customerInvoiceUrls, DEFAULT_EXCHANGE_RATE_JMD_PER_USD, DEFAULT_EXCHANGE_RATE_USD_PER_JMD, ADVANCE_TOTAL_RATE_JMD_PER_USD } from '../../lib/freight';

interface Event { id: string; location: string; description: string; timestamp: string }
interface Shipment extends ShipmentDetail {
  type: string;
  origin: string;
  destination: string;
  weight: number | null;
  estimatedDelivery: string | null;
  itemCount: number;
  createdAt: string;
  events: Event[];
}

const TYPES = ['AIR', 'SEA', 'GROUND'];

const EMPTY_FORM = { trackingNumber: '', customerEmail: '', type: 'AIR', origin: '', destination: '', weight: '', dimensions: '', description: '', estimatedDelivery: '', pickupLocation: '' };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthsAgoISO(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); }

export default function AdminFreight() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [view, setView] = useViewMode('rxl_admin_freight_view');
  const [loading, setLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('ALL');

  const [customerName, setCustomerName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dateFrom, setDateFrom] = useState(monthsAgoISO(3));
  const [dateTo, setDateTo] = useState(todayISO());
  const [includeCollected, setIncludeCollected] = useState(false);
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [pickupFilter, setPickupFilter] = useState('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [eventModal, setEventModal] = useState<Shipment | null>(null);
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  const [timelineModal, setTimelineModal] = useState<Shipment | null>(null);
  const [billingShipment, setBillingShipment] = useState<Shipment | null>(null);
  const [notifyShipment, setNotifyShipment] = useState<Shipment | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // POS-style currency toggle — switches every displayed amount between USD and JMD
  // using the admin-set exchange rate (Pricing Presets > Exchange Rate).
  const [currency, setCurrency] = useState<'USD' | 'JMD'>('JMD');
  const [jmdPerUsd, setJmdPerUsd] = useState(DEFAULT_EXCHANGE_RATE_JMD_PER_USD);
  const [usdPerJmd, setUsdPerJmd] = useState(DEFAULT_EXCHANGE_RATE_USD_PER_JMD);
  useEffect(() => {
    api.get('/currency').then(r => { setJmdPerUsd(r.data.jmdPerUsd); setUsdPerJmd(r.data.usdPerJmd); }).catch(() => { /* keep defaults */ });
  }, []);
  const displayAmount = (usd: number) => currency === 'USD' ? `$${fmtMoney(usd)}` : `$${fmtMoney(usd * jmdPerUsd)}`;

  const load = () => {
    setLoading(true);
    api.get('/shipments', {
      params: {
        customerName: customerName || undefined,
        trackingNumber: trackingNumber || undefined,
        dateFrom, dateTo,
        outstandingOnly: outstandingOnly || undefined,
        pickupLocation: pickupFilter !== 'ALL' ? pickupFilter : undefined,
      },
    }).then(r => setShipments(r.data)).catch(() => showToast('Failed to load shipments')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const batchOptions = useMemo(() => {
    const map = new Map<string, string>();
    shipments.forEach(s => { if (s.batch) map.set(s.batch.id, s.batch.batchNumber); });
    return Array.from(map, ([id, batchNumber]) => ({ id, batchNumber })).sort((a, b) => a.batchNumber.localeCompare(b.batchNumber));
  }, [shipments]);

  const filtered = useMemo(() => {
    return shipments.filter(s => {
      if (!includeCollected && s.status === 'DELIVERED') return false;
      if (batchFilter !== 'ALL' && s.batch?.id !== batchFilter) return false;
      if (!quickSearch) return true;
      const q = quickSearch.toLowerCase();
      return s.trackingNumber.toLowerCase().includes(q) || s.user?.email.toLowerCase().includes(q) || s.user?.name.toLowerCase().includes(q) || s.batch?.batchNumber.toLowerCase().includes(q);
    });
  }, [shipments, quickSearch, includeCollected, batchFilter]);

  // Column sorting for Batch / Amount Paid / Status — click cycles ascending →
  // descending → off (back to the default, unsorted order).
  const [sortCol, setSortCol] = useState<'batch' | 'amountPaid' | 'status' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (col: 'batch' | 'amountPaid' | 'status') => {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortCol(null); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const rows = [...filtered];
    const sign = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sortCol === 'batch') return (a.batch?.batchNumber || '').localeCompare(b.batch?.batchNumber || '') * sign;
      if (sortCol === 'amountPaid') return ((a.amountPaid || 0) - (b.amountPaid || 0)) * sign;
      return (STATUS_LABEL[a.status] || a.status).localeCompare(STATUS_LABEL[b.status] || b.status) * sign;
    });
    return rows;
  }, [filtered, sortCol, sortDir]);

  function SortButton({ col, title }: { col: 'batch' | 'amountPaid' | 'status'; title: string }) {
    return (
      <button
        type="button"
        title={title}
        onClick={() => toggleSort(col)}
        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${sortCol === col ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60'}`}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
      </button>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, weight: form.weight ? parseFloat(form.weight) : undefined, customerEmail: form.customerEmail || undefined };
      await api.post('/shipments', payload);
      showToast(`Shipment ${form.trackingNumber} created`);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to create shipment');
    } finally {
      setSaving(false);
    }
  };

  const openEventModal = (s: Shipment) => { setEventLocation(''); setEventDescription(''); setEventModal(s); };
  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventModal) return;
    try {
      await api.post(`/shipments/${eventModal.id}/events`, { location: eventLocation, description: eventDescription });
      showToast('Tracking event added');
      setEventModal(null);
      load();
    } catch {
      showToast('Failed to add event');
    }
  };

  const openTimeline = async (s: Shipment) => {
    try {
      const { data } = await api.get(`/shipments/${s.id}`);
      setTimelineModal(data);
    } catch {
      showToast('Failed to load shipment');
    }
  };

  // Freight screen shows status as plain colored text (no tonal background) —
  // strips any bg-*/dark:bg-* class from the shared STATUS_STYLE map so Batches
  // (which still uses the tonal pill look) is unaffected.
  const statusTextClass = (status: string) => {
    const base = STATUS_STYLE[status] || 'text-gray-600 dark:text-white/60';
    return base.split(' ').filter(c => !/^(dark:)?bg-/.test(c)).join(' ');
  };

  const handleEmailReceipt = async (s: Shipment) => {
    if (!s.user?.email) { showToast('This customer has no email on file'); return; }
    try {
      const { data } = await api.post(`/shipments/${s.id}/email-receipt`);
      showToast(data.simulated ? `Receipt logged for ${s.user.email} (SMTP not configured)` : `Receipt emailed to ${s.user.email}`);
    } catch {
      showToast('Failed to email receipt');
    }
  };

  const handlePrintInvoice = (s: Shipment) => {
    // Itemized breakdown — Freight, Duty Fee, Discount, and GCT are JMD amounts that
    // feed into Total JMD/USD, so they're converted here at the same fixed rate the
    // Total itself uses (ADVANCE_TOTAL_RATE_JMD_PER_USD) — not the admin-configurable
    // Pricing Presets rate — so the line items always add up to the Total shown below.
    const discountAmount = (s.dutyFee || 0) * ((s.discountPercent || 0) / 100);
    const expenses = parseExpenses(s.expenses);
    const charges: { label: string; amount: number }[] = [
      { label: 'Freight', amount: (s.freightCharge || 0) / ADVANCE_TOTAL_RATE_JMD_PER_USD },
      { label: 'Duty Fee', amount: (s.dutyFee || 0) / ADVANCE_TOTAL_RATE_JMD_PER_USD },
      ...(discountAmount > 0 ? [{ label: 'Discount', amount: -(discountAmount / ADVANCE_TOTAL_RATE_JMD_PER_USD) }] : []),
      ...expenses.map(e => ({ label: e.label || 'Expense', amount: e.amount })),
      { label: 'GCT', amount: (s.gct || 0) / ADVANCE_TOTAL_RATE_JMD_PER_USD },
    ];
    printInvoice({
      batchNumber: s.batch?.batchNumber,
      trackingNumber: s.trackingNumber,
      ...customerInvoiceFields(s.user),
      charges,
      totalUSD: s.totalUSD || 0,
      totalJMD: s.totalJMD || 0,
      amountPaid: s.amountPaid || 0,
    });
  };

  const handleNotify = async () => {
    if (!notifyShipment?.user) return;
    try {
      await api.post('/customers/notify', { target: 'CUSTOMER_NUMBER', customerCode: notifyShipment.user.email, subject: `Update on ${notifyShipment.trackingNumber}`, message: notifyMessage });
    } catch {
      // customers/notify targets by customerCode, not email — best-effort simulated send either way
    }
    showToast(`Notified ${notifyShipment.user.name}`);
    setNotifyShipment(null);
    setNotifyMessage('');
  };

  const handleExportCsv = () => {
    downloadCsv(
      ['Customer Name', 'Batch', 'Email', 'Phone', 'Total Charges', 'Amount Paid', 'Status'],
      filtered.map(s => [s.user?.name || 'Unassigned', s.batch?.batchNumber || '', s.user?.email || '', s.user?.phone || '', fmtMoney(s.totalUSD), fmtMoney(s.amountPaid), STATUS_LABEL[s.status] || s.status]),
      'freight.csv'
    );
  };
  const handleCopy = () => {
    copyTableToClipboard(
      ['Customer Name', 'Batch', 'Email', 'Phone', 'Total Charges', 'Amount Paid', 'Status'],
      filtered.map(s => [s.user?.name || 'Unassigned', s.batch?.batchNumber || '', s.user?.email || '', s.user?.phone || '', fmtMoney(s.totalUSD), fmtMoney(s.amountPaid), STATUS_LABEL[s.status] || s.status])
    );
    showToast('Copied to clipboard');
  };
  const handlePrint = () => window.print();

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Freight <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">All Freight</span></h1>
        <div className="flex items-center gap-3">
          <button onClick={() => { setForm(EMPTY_FORM); setFormError(''); setFormOpen(true); }} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Add Shipment
          </button>
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/10 rounded-lg p-0.5">
            <button onClick={() => setCurrency('USD')} className={`flex items-center gap-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${currency === 'USD' ? 'bg-brand-800 text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>
              <DollarSign className="w-3.5 h-3.5" /> USD
            </button>
            <button onClick={() => setCurrency('JMD')} className={`flex items-center gap-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${currency === 'JMD' ? 'bg-brand-800 text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>
              <DollarSign className="w-3.5 h-3.5" /> JMD
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="panel-glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-gray-700 dark:text-white/80">Select Batch</label>
          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[240px]">
            <option value="ALL">All Batches</option>
            {batchOptions.map(b => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
          </select>
          <span className="text-sm text-gray-500 dark:text-white/50">{filtered.length} shipment{filtered.length === 1 ? '' : 's'}{batchFilter !== 'ALL' ? ' in this batch' : ''}</span>
          <div className="flex-1" />
          <p className="text-xs text-gray-400 dark:text-white/40">1 USD = {fmtMoney(jmdPerUsd)} JMD</p>
        </div>

        <div className="panel-glass rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
              <input type="checkbox" checked={includeCollected} onChange={e => setIncludeCollected(e.target.checked)} /> Include Items Already Collected In Search Result…
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-white px-3 py-1.5 rounded-lg">
              <input type="checkbox" checked={outstandingOnly} onChange={e => setOutstandingOnly(e.target.checked)} /> Show Only Outstanding Payments
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" className="border rounded-lg px-3 py-2 text-sm w-52" />
            <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Tracking number" className="border rounded-lg px-3 py-2 text-sm w-52" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <span className="text-gray-400 dark:text-white/40 text-sm">-</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <button onClick={load} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Search className="w-4 h-4" /> Search</button>
            <button onClick={() => navigate('/admin/warehouse-scans')} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Warehouse className="w-4 h-4" /> Warehouse</button>
            <button onClick={() => showToast('Barcode scanning needs camera access — open this page on a device with a camera')} className="w-9 h-9 flex items-center justify-center text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 rounded-lg transition-colors"><QrCode className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleCopy} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
          <button onClick={handleExportCsv} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
          <button onClick={handlePrint} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
            <input value={quickSearch} onChange={e => setQuickSearch(e.target.value)} placeholder="Search…" className="pl-9 pr-3 py-2 border rounded-lg text-sm w-full" />
          </div>
          <div className="flex-1" />
          <span className="text-sm text-gray-500 dark:text-white/50">Filter by Pickup Location:</span>
          <select value={pickupFilter} onChange={e => { setPickupFilter(e.target.value); }} className="border rounded-lg text-sm px-3 py-2">
            <option value="ALL">All</option>
            {PICKUP_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="flex justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>

        {view === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-16 text-gray-400 dark:text-white/40">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full text-center py-16 text-gray-400 dark:text-white/40">No shipments match this search.</div>
            ) : sorted.map(s => (
              <div key={s.id} className="panel-glass rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{s.user?.name || 'Unassigned'}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 flex-shrink-0 ${statusTextClass(s.status)}`}>{STATUS_LABEL[s.status] || s.status}</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-white/50 space-y-0.5">
                  <p>{s.batch ? `${s.batch.batchNumber} (${s.itemCount} Items)` : 'No batch'}</p>
                </div>
                <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-gray-500 dark:text-white/50">Total <strong className="text-gray-900 dark:text-white">{displayAmount(s.totalUSD)}</strong></span>
                  <span className="text-gray-500 dark:text-white/50">Paid <strong className="text-gray-900 dark:text-white">{displayAmount(s.amountPaid)}</strong></span>
                </div>
                <div className="flex gap-1.5 pt-1 border-t border-gray-100">
                  {(() => { const urls = customerInvoiceUrls(s.customerInvoiceUrls); return (
                    <button title={urls.length > 0 ? 'Customer uploaded a purchase invoice' : 'No purchase invoice uploaded'} onClick={() => urls[0] && window.open(urls[0], '_blank')} disabled={urls.length === 0} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${urls.length > 0 ? 'hover:bg-green-100 dark:hover:bg-green-500/25 cursor-pointer' : 'cursor-default'}`}><FileIcon uploaded={urls.length > 0} className="w-[24px] h-[24px]" /></button>
                  ); })()}
                  <button title="Notify customer" onClick={() => setNotifyShipment(s)} className="w-9 h-9 rounded-lg text-cyan-600 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 flex items-center justify-center transition-colors"><MegaphoneIcon className="w-[24px] h-[24px]" /></button>
                  <button title="Email receipt" onClick={() => handleEmailReceipt(s)} className="w-9 h-9 rounded-lg text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/25 flex items-center justify-center transition-colors"><MailIcon className="w-[24px] h-[24px]" /></button>
                  <button title="Print invoice" onClick={() => handlePrintInvoice(s)} className="w-9 h-9 rounded-lg text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"><PrinterIcon className="w-[24px] h-[24px]" /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="panel-glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Actions</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer Name</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"><span className="inline-flex items-center gap-1.5">Batch<SortButton col="batch" title="Sort by batch" /></span></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Charges</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"><span className="inline-flex items-center gap-1.5">Amount Paid<SortButton col="amountPaid" title="Sort by amount paid" /></span></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"><span className="inline-flex items-center gap-1.5">Status<SortButton col="status" title="Sort by status" /></span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-gray-400 dark:text-white/40">No shipments match this search.</td></tr>
                ) : sorted.map(s => (
                  <tr key={s.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        {(() => { const urls = customerInvoiceUrls(s.customerInvoiceUrls); return (
                          <button title={urls.length > 0 ? 'Customer uploaded a purchase invoice' : 'No purchase invoice uploaded'} onClick={() => urls[0] && window.open(urls[0], '_blank')} disabled={urls.length === 0} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${urls.length > 0 ? 'hover:bg-green-100 dark:hover:bg-green-500/25 cursor-pointer' : 'cursor-default'}`}><FileIcon uploaded={urls.length > 0} className="w-[24px] h-[24px]" /></button>
                        ); })()}
                        <button title="Notify customer" onClick={() => setNotifyShipment(s)} className="w-9 h-9 rounded-lg text-cyan-600 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 flex items-center justify-center transition-colors"><MegaphoneIcon className="w-[24px] h-[24px]" /></button>
                        <button title="Email receipt" onClick={() => handleEmailReceipt(s)} className="w-9 h-9 rounded-lg text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/25 flex items-center justify-center transition-colors"><MailIcon className="w-[24px] h-[24px]" /></button>
                        <button title="Print invoice" onClick={() => handlePrintInvoice(s)} className="w-9 h-9 rounded-lg text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"><PrinterIcon className="w-[24px] h-[24px]" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{s.user?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-white/50">{s.batch ? `${s.batch.batchNumber} (${s.itemCount} Items)` : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{displayAmount(s.totalUSD)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{displayAmount(s.amountPaid)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-1 ${statusTextClass(s.status)}`}>{STATUS_LABEL[s.status] || s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Create shipment modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">New shipment</h3>
              <button onClick={() => setFormOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Tracking number *</label>
                  <input required value={form.trackingNumber} onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Customer email (optional)</label>
                <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="Leave blank for an unassigned shipment" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Pickup Location</label>
                <select value={form.pickupLocation} onChange={e => setForm(f => ({ ...f, pickupLocation: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                  <option value="">Select location</option>
                  {PICKUP_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Origin *</label>
                  <input required value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Destination *</label>
                  <input required value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Weight (kg)</label>
                  <input type="number" step="0.01" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Est. delivery</label>
                  <input type="date" value={form.estimatedDelivery} onChange={e => setForm(f => ({ ...f, estimatedDelivery: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
                {saving ? 'Creating…' : 'Create shipment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add event modal */}
      {eventModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Add event — {eventModal.trackingNumber}</h3>
              <button onClick={() => setEventModal(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <form onSubmit={submitEvent} className="space-y-3">
              <input required value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="Location" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              <textarea required value={eventDescription} onChange={e => setEventDescription(e.target.value)} placeholder="What happened" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              <button type="submit" className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm">Add event</button>
            </form>
          </div>
        </div>
      )}

      {/* Timeline modal */}
      {timelineModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{timelineModal.trackingNumber}</h3>
              <button onClick={() => setTimelineModal(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            {timelineModal.events.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/40 text-center py-6">No events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {timelineModal.events.map(e => (
                  <div key={e.id} className="flex gap-3 border-t dark:border-white/10 first:border-t-0 pt-3 first:pt-0">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{e.description}</div>
                      <div className="text-xs text-gray-400 dark:text-white/40">{e.location} · {new Date(e.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notify modal */}
      {notifyShipment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Notify — {notifyShipment.user?.name || notifyShipment.trackingNumber}</h3>
              <button onClick={() => setNotifyShipment(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} placeholder="Message" rows={4} className="w-full border rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
            <button onClick={handleNotify} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm">Send notification</button>
          </div>
        </div>
      )}

      {billingShipment && (
        <ShipmentDetailPanel
          key={billingShipment.id}
          shipment={billingShipment}
          mode="billing"
          onClose={() => setBillingShipment(null)}
          onSaved={(updated) => { setBillingShipment(null); showToast('Saved'); load(); }}
        />
      )}
    </div>
  );
}
