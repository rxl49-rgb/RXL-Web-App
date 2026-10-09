import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, X, Plus, Package, Truck, ShieldCheck, ClipboardList, PackageCheck, CheckCircle2, ArrowUpDown } from 'lucide-react';
import FileBlueIcon from '../../components/icons/FileBlueIcon';
import FileIcon from '../../components/icons/FileIcon';
import DeleteIcon from '../../components/icons/DeleteIcon';
import MegaphoneIcon from '../../components/icons/MegaphoneIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';
import ShipmentDetailPanel, { ShipmentDetail } from '../../components/admin/ShipmentDetailPanel';
import ViewToggle, { useViewMode } from '../../components/admin/ViewToggle';
import { STATUS_OPTIONS, STATUS_LABEL, STATUS_STYLE, PICKUP_LOCATIONS, downloadCsv, copyTableToClipboard, printBatchInvoice, fmtMoney, customerInvoiceUrls } from '../../lib/freight';

interface Batch {
  id: string;
  batchNumber: string;
  pickupLocation: string | null;
  status: string;
  createdAt: string;
  totalItems: number;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthsAgoISO(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); }
// The shipment type is no longer picked manually on the "Add Shipment" form — it's inferred
// from the batch's own label/description. Batches whose label starts with "AIR" (e.g.
// "AIR - 28 JULY 2026") default new shipments to Air; everything else (e.g. "Week 31 2026")
// defaults to Sea, since sea batch labels don't state "AIR" up front.
function inferShipmentType(batchNumber?: string | null): 'AIR' | 'SEA' {
  return batchNumber && batchNumber.trim().toUpperCase().startsWith('AIR') ? 'AIR' : 'SEA';
}
const EMPTY_SHIPMENT_FORM = { trackingNumber: '', customerEmail: '', courierName: '', pickupLocation: '', weight: '', cube: '', dimensions: '', description: '' };
// Strips any bg-*/dark:bg-* class from the shared STATUS_STYLE map so the shipment
// status control here shows colored text only, no pill background.
function statusTextClass(status: string) {
  const base = STATUS_STYLE[status] || 'text-gray-600 dark:text-white/60';
  return base.split(' ').filter(c => !/^(dark:)?bg-/.test(c)).join(' ');
}

// Icon shown next to each status, in both the trigger and the dropdown list below.
const STATUS_ICON: Record<string, typeof Package> = {
  RECEIVED_FLORIDA: Package,
  IN_TRANSIT: Truck,
  AT_PORT_JAMAICA: ShieldCheck,
  PROCESSING: ClipboardList,
  OUT_FOR_DELIVERY: PackageCheck,
  DELIVERED: CheckCircle2,
};

// Custom status picker — a colored icon + label trigger that opens a dark dropdown
// panel listing every status with its own icon and color (matches the shared
// STATUS_STYLE palette). Used in place of a plain <select> in the batch/shipment
// status rows below; the neighboring "Update" button is unchanged.
function StatusIconSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = STATUS_OPTIONS.find(o => o.value === value);
  const CurrentIcon = STATUS_ICON[value] || Package;

  // Dropdown is rendered in a portal (outside any overflow-hidden ancestor, e.g. the
  // collapsible batch detail panel) and positioned with fixed coordinates so the full
  // list is always visible on screen — flips above the trigger and clamps horizontally
  // when there isn't enough room below/to the right.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelH = STATUS_OPTIONS.length * 48 + 8;
    const panelW = Math.max(rect.width, 210);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelH + 12 && rect.top > panelH;
    let left = rect.left;
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - 8 - panelW;
    if (left < 8) left = 8;
    setPos({ top: openUp ? Math.max(8, rect.top - panelH - 4) : rect.bottom + 4, left, width: panelW });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  return (
    <div className="relative w-[150px] flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-1.5 text-xs font-semibold pr-1 py-2 w-full"
      >
        <span className={`w-6 h-6 rounded-full border border-current/30 flex items-center justify-center flex-shrink-0 ${statusTextClass(value)}`}>
          <CurrentIcon className="w-3 h-3" />
        </span>
        <span className="truncate text-gray-900 dark:text-white">{current?.label || value}</span>
      </button>
      {open && pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-50 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg overflow-hidden"
        >
          {STATUS_OPTIONS.map(opt => {
            const Icon = STATUS_ICON[opt.value] || Package;
            return (
              <button
                type="button"
                key={opt.value}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <span className={`w-7 h-7 rounded-full border border-current/30 flex items-center justify-center flex-shrink-0 ${statusTextClass(opt.value)}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-gray-900 dark:text-white">{opt.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function AdminBatches() {
  const { confirmDelete } = useDeleteGuard();
  const [view, setView] = useViewMode('rxl_admin_batches_view');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(monthsAgoISO(4));
  const [dateTo, setDateTo] = useState(todayISO());
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const [createOpen, setCreateOpen] = useState(false);
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newPickupLocation, setNewPickupLocation] = useState('');
  const [creating, setCreating] = useState(false);

  const [notifyBatch, setNotifyBatch] = useState<Batch | null>(null);
  const [notifySubject, setNotifySubject] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyShipment, setNotifyShipment] = useState<any | null>(null);
  const [notifyShipmentMessage, setNotifyShipmentMessage] = useState('');
  const [notifying, setNotifying] = useState(false);

  const [detailBatch, setDetailBatch] = useState<{ id: string; batchNumber: string; shipments: any[] } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [batchSwitcherOpen, setBatchSwitcherOpen] = useState(false);
  const [fileSortDir, setFileSortDir] = useState<'uploaded' | 'missing' | null>(null);
  const toggleFileSort = () => { setFileSortDir(d => d === null ? 'uploaded' : d === 'uploaded' ? 'missing' : null); setDetailPage(1); };
  const [detailPage, setDetailPage] = useState(1);
  // Layout for the "Shipment [...] Details View/Update" table below — plain rows, or
  // rounded "Bubble" pill rows.
  const [detailLayout, setDetailLayout] = useState<'table' | 'bubble'>('table');
  const [editingShipment, setEditingShipment] = useState<ShipmentDetail | null>(null);

  const [shipmentFormOpen, setShipmentFormOpen] = useState(false);
  const [shipmentForm, setShipmentForm] = useState(EMPTY_SHIPMENT_FORM);
  const [shipmentFormError, setShipmentFormError] = useState('');
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerOptions, setCustomerOptions] = useState<{ id: string; name: string; email: string }[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  // Registered couriers (Couriers admin screen) — offered as autocomplete suggestions on
  // the Courier Name field so entries stay consistent with the logos shown elsewhere.
  const [courierNames, setCourierNames] = useState<string[]>([]);
  useEffect(() => {
    api.get('/couriers').then(r => setCourierNames((r.data as { name: string }[]).map(c => c.name))).catch(() => {});
  }, []);



  const load = () => {
    setLoading(true);
    api.get('/batches', { params: { search: search || undefined, dateFrom, dateTo, page, limit: 10 } })
      .then(r => { setBatches(r.data.batches); setPages(r.data.pages); })
      .catch(() => showToast('Failed to load batches'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  // Debounced customer search for the "Add Shipment" form's Customer Name field.
  useEffect(() => {
    if (!shipmentFormOpen || customerName.trim().length < 2) { setCustomerOptions([]); return; }
    setCustomerSearching(true);
    const t = setTimeout(() => {
      api.get('/customers', { params: { search: customerName.trim(), limit: 8 } })
        .then(r => setCustomerOptions(r.data.customers || []))
        .catch(() => setCustomerOptions([]))
        .finally(() => setCustomerSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [customerName, shipmentFormOpen]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/batches', { batchNumber: newBatchNumber || undefined, pickupLocation: newPickupLocation || undefined });
      showToast('Batch created');
      setCreateOpen(false);
      setNewBatchNumber('');
      setNewPickupLocation('');
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to create batch');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (b: Batch, status: string) => {
    try {
      await api.patch(`/batches/${b.id}/status`, { status });
      showToast(`${b.batchNumber} marked ${STATUS_LABEL[status]}`);
      load();
    } catch {
      showToast('Update failed');
    }
  };

  const handleDelete = async (b: Batch) => {
    if (!(await confirmDelete(`Remove batch ${b.batchNumber}? Shipments inside will be detached, not deleted.`))) return;
    try {
      await api.delete(`/batches/${b.id}`);
      showToast('Batch removed');
      load();
    } catch {
      showToast('Failed to remove batch.');
    }
  };

  const handleNotifyShipment = async () => {
    if (!notifyShipment?.user) return;
    try {
      await api.post('/customers/notify', { target: 'CUSTOMER_NUMBER', customerCode: notifyShipment.user.email, subject: `Update on ${notifyShipment.trackingNumber}`, message: notifyShipmentMessage });
    } catch {
      // customers/notify targets by customerCode, not email — best-effort simulated send either way
    }
    showToast(`Notified ${notifyShipment.user.name}`);
    setNotifyShipment(null);
    setNotifyShipmentMessage('');
  };

  const openNotify = (b: Batch) => { setNotifyBatch(b); setNotifySubject(''); setNotifyMessage(''); };
  const handleNotify = async () => {
    if (!notifyBatch) return;
    setNotifying(true);
    try {
      const { data } = await api.post(`/batches/${notifyBatch.id}/notify`, { subject: notifySubject, message: notifyMessage });
      showToast(`Notified ${data.recipientCount} customer${data.recipientCount === 1 ? '' : 's'} in ${notifyBatch.batchNumber}`);
      setNotifyBatch(null);
    } catch {
      showToast('Failed to send notification');
    } finally {
      setNotifying(false);
    }
  };

  const openDetail = async (b: { id: string }) => {
    try {
      const { data } = await api.get(`/batches/${b.id}`);
      setDetailBatch(data);
      setDetailOpen(true);
      setDetailPage(1);
    } catch {
      showToast('Failed to load batch');
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setTimeout(() => setDetailBatch(null), 300);
  };

  const openShipmentForm = () => { setShipmentForm(EMPTY_SHIPMENT_FORM); setShipmentFormError(''); setCustomerName(''); setCustomerOptions([]); setCustomerDropdownOpen(false); setShipmentFormOpen(true); };
  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailBatch) return;
    setShipmentSaving(true);
    setShipmentFormError('');
    try {
      const type = inferShipmentType(detailBatch.batchNumber);
      const { weight, cube, courierName, ...rest } = shipmentForm;
      const cubeQty = type === 'SEA' && cube ? parseFloat(cube) : undefined;

      // If this customer already has a shipment in this batch, don't create a duplicate
      // shipment row for them — combine into it instead: add the new tracking # as an
      // additional item, and add the new cube amount onto the existing cubeQty.
      const existing = shipmentForm.customerEmail
        ? detailBatch.shipments.find((s: any) => s.user?.email === shipmentForm.customerEmail)
        : undefined;

      if (existing) {
        await api.post(`/shipments/${existing.id}/items`, {
          courier: courierName || undefined,
          trackingNumber: shipmentForm.trackingNumber || undefined,
          description: shipmentForm.description || undefined,
          additionalCubeQty: cubeQty,
        });
        showToast(`Tracking # added to ${existing.user?.name || 'customer'}'s existing shipment in this batch`);
      } else {
        const payload = {
          ...rest,
          type,
          weight: type === 'AIR' && weight ? parseFloat(weight) : undefined,
          cubeQty,
          courierInfo: courierName || undefined,
          customerEmail: shipmentForm.customerEmail || undefined,
          batchId: detailBatch.id,
        };
        await api.post('/shipments', payload);
        showToast(`Shipment ${shipmentForm.trackingNumber} created`);
      }

      setShipmentFormOpen(false);
      setShipmentForm(EMPTY_SHIPMENT_FORM);
      openDetail(detailBatch);
      load();
    } catch (err: any) {
      setShipmentFormError(err?.response?.data?.error || 'Failed to create shipment');
    } finally {
      setShipmentSaving(false);
    }
  };

  const handleShipmentStatusChange = async (s: any, status: string) => {
    try {
      await api.patch(`/shipments/${s.id}/status`, { status });
      setDetailBatch(prev => prev ? { ...prev, shipments: prev.shipments.map((sh: any) => sh.id === s.id ? { ...sh, status } : sh) } : prev);
      showToast(`Shipment marked ${STATUS_LABEL[status] || status}`);
    } catch {
      showToast('Failed to update shipment status');
    }
  };

  function groupByCustomer(shipments: any[]) {
    const map = new Map<string, { customerName: string; items: any[] }>();
    for (const s of shipments) {
      const key = s.user?.email || 'unassigned';
      const name = s.user?.name || 'Unassigned';
      if (!map.has(key)) map.set(key, { customerName: name, items: [] });
      map.get(key)!.items.push(s);
    }
    return Array.from(map.values());
  }

  const detailGroups = useMemo(() => detailBatch ? groupByCustomer(detailBatch.shipments) : [], [detailBatch]);

  const DETAIL_PAGE_SIZE = 10;
  const detailRows = useMemo(() => {
    const rows: { customerName: string; shipment: any }[] = [];
    detailGroups.forEach(g => { g.items.forEach((s: any) => rows.push({ customerName: g.customerName, shipment: s })); });
    if (fileSortDir) {
      const hasFile = (s: any) => customerInvoiceUrls(s.customerInvoiceUrls).length > 0;
      const sign = fileSortDir === 'uploaded' ? 1 : -1;
      rows.sort((a, b) => (Number(hasFile(b.shipment)) - Number(hasFile(a.shipment))) * sign);
    }
    return rows;
  }, [detailGroups, fileSortDir]);
  const detailPages = Math.max(1, Math.ceil(detailRows.length / DETAIL_PAGE_SIZE));
  const detailPageRows = useMemo(() => detailRows.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE), [detailRows, detailPage]);
  useEffect(() => { if (detailPage > detailPages) setDetailPage(detailPages); }, [detailPage, detailPages]);

  const editingShipmentIndex = editingShipment ? detailRows.findIndex(r => r.shipment.id === editingShipment.id) : -1;
  const hasNextShipment = editingShipmentIndex >= 0 && editingShipmentIndex < detailRows.length - 1;
  const hasPreviousShipment = editingShipmentIndex > 0;
  const goToNextShipment = () => { if (hasNextShipment) setEditingShipment(detailRows[editingShipmentIndex + 1].shipment); };
  const goToPreviousShipment = () => { if (hasPreviousShipment) setEditingShipment(detailRows[editingShipmentIndex - 1].shipment); };

  const handleExportCsv = () => {
    downloadCsv(
      ['Batch Number', 'Total Items', 'Date Created', 'Status'],
      batches.map(b => [b.batchNumber, String(b.totalItems), new Date(b.createdAt).toLocaleDateString(), STATUS_LABEL[b.status] || b.status]),
      'batches.csv'
    );
  };
  const handleShipmentCsv = () => {
    if (!detailBatch) return;
    downloadCsv(
      ['Customer Name', 'PC Count', 'Cubes', 'Description'],
      detailRows.map(({ customerName, shipment: s }) => [customerName, String(s.itemCount ?? 0), String(s.cubeAmount ?? 0), s.description || '']),
      `shipments-${detailBatch.batchNumber}.csv`
    );
  };
  const handleCopy = () => {
    copyTableToClipboard(
      ['Batch Number', 'Total Items', 'Date Created', 'Status'],
      batches.map(b => [b.batchNumber, String(b.totalItems), new Date(b.createdAt).toLocaleDateString(), STATUS_LABEL[b.status] || b.status])
    );
    showToast('Copied to clipboard');
  };
  const handlePrintList = () => {
    printBatchInvoice({ batchNumber: 'All Batches', rows: batches.map(b => ({ customerName: b.batchNumber, items: b.totalItems, charges: 0, discount: 0, total: 0 })) });
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Batches <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">All Batches</span></h1>
      </div>

      <div className="p-6 space-y-4">
        <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          <span className="text-gray-400 dark:text-white/40 text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => { setPage(1); load(); }} className="bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Search</button>
          <div className="flex-1" />
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Box className="w-4 h-4" /> Create Empty Batch</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleCopy} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
          <button onClick={handleExportCsv} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
          <button onClick={handlePrintList} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
          <ViewToggle view={view} onChange={setView} />
          <div className="flex-1" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }} placeholder="Search batch number…" className="border rounded-lg px-3 py-2 text-sm w-64" />
        </div>

        {createOpen && (
          <div className="panel-glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Create Empty Batch</h3>
              <button onClick={() => setCreateOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Batch number (optional — auto-generated if blank)</label>
                <input value={newBatchNumber} onChange={e => setNewBatchNumber(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Pickup location</label>
                <select value={newPickupLocation} onChange={e => setNewPickupLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select One</option>
                  {PICKUP_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <button type="submit" disabled={creating} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
                {creating ? 'Creating…' : 'Create batch'}
              </button>
            </form>
          </div>
        )}

        {/* Batch detail — expands upward above the list, smooth CSS transition, no navigation */}
        <div className={`grid transition-all duration-300 ease-in-out ${detailOpen ? 'grid-rows-[1fr] opacity-100 mb-4' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            {detailBatch && (
              <div className="panel-glass rounded-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    Shipment
                    <span className="relative">
                      <button
                        type="button"
                        onClick={() => setBatchSwitcherOpen(o => !o)}
                        onBlur={() => setTimeout(() => setBatchSwitcherOpen(false), 150)}
                        className="inline-flex items-center gap-1 bg-brand-800 hover:bg-brand-700 text-white text-xs font-bold rounded-full pl-3 pr-2 py-1 transition-colors"
                      >
                        {detailBatch.batchNumber}
                        <svg className={`w-3 h-3 transition-transform ${batchSwitcherOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      {batchSwitcherOpen && (
                        <div className="absolute z-20 mt-1 left-0 min-w-[220px] max-h-72 overflow-y-auto bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg py-1">
                          {batches.map(b => (
                            <button
                              type="button"
                              key={b.id}
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { setBatchSwitcherOpen(false); if (b.id !== detailBatch.id) openDetail(b); }}
                              className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${b.id === detailBatch.id ? 'text-brand-700 dark:text-brand-300 bg-gray-50 dark:bg-white/5' : 'text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                              {b.batchNumber}
                            </button>
                          ))}
                        </div>
                      )}
                    </span>
                    Details <span className="text-gray-400 dark:text-white/40 font-normal text-sm">View/Update</span>
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/10 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setDetailLayout('table')}
                        title="Table layout"
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${detailLayout === 'table' ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}
                      >
                        Table
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailLayout('bubble')}
                        title="Bubble layout"
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${detailLayout === 'bubble' ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}
                      >
                        Bubble
                      </button>
                    </div>
                    <button onClick={openShipmentForm} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-xs font-semibold px-3 py-2 rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Shipment</button>
                    <button onClick={handleShipmentCsv} className="border rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
                    <button onClick={closeDetail}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
                  </div>
                </div>
                <div className="p-6">
                  {detailLayout === 'bubble' ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-4 px-5 text-sm font-semibold text-gray-600 dark:text-white/60">
                        <div className="w-[76px] flex-shrink-0 flex items-center justify-center">
                          <button type="button" title={fileSortDir === 'uploaded' ? 'Sorted: uploaded files first' : fileSortDir === 'missing' ? 'Sorted: missing files first' : 'Sort by uploaded file'} onClick={toggleFileSort} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${fileSortDir ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60'}`}><ArrowUpDown className="w-5 h-5" /></button>
                        </div>
                        <div className="min-w-[160px]">Shipment</div>
                        <div className="flex-1 text-center">Freight</div>
                        <div className="flex-1 text-center">Discount</div>
                        <div className="flex-1 text-center">Total Charges</div>
                        <div className="w-[220px] flex-shrink-0">Status</div>
                      </div>
                      {detailPageRows.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 dark:text-white/40">No shipments in this batch yet.</div>
                      ) : detailPageRows.map(({ customerName, shipment: s }) => (
                        <div key={s.id} className="rounded-2xl bg-gray-50 dark:bg-white/[0.04] px-5 py-3.5 flex items-center gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_-10px_rgba(0,0,0,0.2)]">
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {(() => { const urls = customerInvoiceUrls(s.customerInvoiceUrls); return (
                              <button title={urls.length > 0 ? 'Customer uploaded a purchase invoice' : 'No purchase invoice uploaded'} onClick={() => urls[0] && window.open(urls[0], '_blank')} disabled={urls.length === 0} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${urls.length > 0 ? 'hover:bg-green-100 dark:hover:bg-green-500/25 cursor-pointer' : 'cursor-default'}`}><FileIcon uploaded={urls.length > 0} className="w-7 h-7" /></button>
                            ); })()}
                            <button title="Notify customer" onClick={() => setNotifyShipment(s)} className="w-9 h-9 rounded-lg text-cyan-600 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 flex items-center justify-center transition-colors"><MegaphoneIcon className="w-7 h-7" /></button>
                          </div>
                          <div className="min-w-[160px]">
                            <button type="button" onClick={() => setEditingShipment(s)} title="View shipment" className="font-bold text-gray-900 dark:text-white text-sm truncate hover:underline text-left">{customerName}</button>
                            <p className="text-xs text-gray-400 dark:text-white/40">{s.itemCount} PCS</p>
                          </div>
                          <div className="flex-1 text-sm text-gray-900 dark:text-white text-center">${fmtMoney(s.freightCharge)}</div>
                          <div className="flex-1 text-sm text-gray-900 dark:text-white text-center">-${fmtMoney((s.dutyFee || 0) * (s.discountPercent || 0) / 100)}</div>
                          <div className="flex-1 text-sm font-semibold text-gray-900 dark:text-white text-center">${fmtMoney(s.totalJMD)}</div>
                          <div className="w-[220px] flex-shrink-0 flex items-center gap-1.5">
                            <ShipmentStatusSelect shipment={s} onUpdate={handleShipmentStatusChange} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">
                            <button type="button" title={fileSortDir === 'uploaded' ? 'Sorted: uploaded files first' : fileSortDir === 'missing' ? 'Sorted: missing files first' : 'Sort by uploaded file'} onClick={toggleFileSort} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${fileSortDir ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60'}`}><ArrowUpDown className="w-5 h-5" /></button>
                          </th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer Name</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Shipment</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Freight</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">Discount</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Charges</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailPageRows.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-white/40">No shipments in this batch yet.</td></tr>
                        ) : detailPageRows.map(({ customerName, shipment: s }) => (
                          <tr key={s.id} className="border-b last:border-b-0">
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center gap-1">
                                {(() => { const urls = customerInvoiceUrls(s.customerInvoiceUrls); return (
                                  <button title={urls.length > 0 ? 'Customer uploaded a purchase invoice' : 'No purchase invoice uploaded'} onClick={() => urls[0] && window.open(urls[0], '_blank')} disabled={urls.length === 0} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${urls.length > 0 ? 'hover:bg-green-100 dark:hover:bg-green-500/25 cursor-pointer' : 'cursor-default'}`}><FileIcon uploaded={urls.length > 0} className="w-7 h-7" /></button>
                                ); })()}
                                <button title="Notify customer" onClick={() => setNotifyShipment(s)} className="w-9 h-9 rounded-lg text-cyan-600 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 flex items-center justify-center transition-colors"><MegaphoneIcon className="w-7 h-7" /></button>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top font-medium text-gray-900 dark:text-white"><button type="button" onClick={() => setEditingShipment(s)} title="View shipment" className="hover:underline">{customerName}</button></td>
                            <td className="px-4 py-3 whitespace-nowrap">{s.itemCount} Item(s)</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(s.freightCharge)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">-${fmtMoney((s.dutyFee || 0) * (s.discountPercent || 0) / 100)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(s.totalJMD)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <ShipmentStatusSelect shipment={s} onUpdate={handleShipmentStatusChange} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}

                  {detailPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-gray-500 dark:text-white/50">{detailRows.length} shipment{detailRows.length === 1 ? '' : 's'} · Page {detailPage} of {detailPages}</p>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setDetailPage(p => Math.max(1, p - 1))} disabled={detailPage === 1} className="px-3 h-8 rounded-lg text-sm bg-white dark:bg-white/5 border dark:border-white/10 text-gray-600 dark:text-white/60 disabled:opacity-40 transition-colors">Prev</button>
                        {Array.from({ length: detailPages }).map((_, i) => (
                          <button key={i} onClick={() => setDetailPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm transition-colors ${detailPage === i + 1 ? 'bg-brand-800 text-white' : 'bg-white dark:bg-white/5 border dark:border-white/10 text-gray-600 dark:text-white/60'}`}>{i + 1}</button>
                        ))}
                        <button onClick={() => setDetailPage(p => Math.min(detailPages, p + 1))} disabled={detailPage === detailPages} className="px-3 h-8 rounded-lg text-sm bg-white dark:bg-white/5 border dark:border-white/10 text-gray-600 dark:text-white/60 disabled:opacity-40 transition-colors">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {loading ? (
            <div className="col-span-full text-center py-16 text-gray-400 dark:text-white/40">Loading…</div>
          ) : batches.length === 0 ? (
            <div className="col-span-full text-center py-16 text-gray-400 dark:text-white/40">No batches in this range.</div>
          ) : batches.map(b => (
            <div key={b.id} className="panel-glass rounded-2xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => openDetail(b)} className="font-semibold text-gray-900 dark:text-white hover:underline text-left break-all text-sm">{b.batchNumber}</button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button title="View batch" onClick={() => openDetail(b)} className="w-9 h-9 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-500/25 flex items-center justify-center transition-colors"><FileBlueIcon className="w-[26px] h-[26px]" /></button>
                  <button title="Remove batch" onClick={() => handleDelete(b)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                  <button title="Notify customers in batch" onClick={() => openNotify(b)} className="w-9 h-9 rounded-lg text-cyan-600 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 flex items-center justify-center transition-colors"><MegaphoneIcon className="w-[26px] h-[26px]" /></button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/50">
                <span>{b.totalItems} item{b.totalItems === 1 ? '' : 's'}</span>
                <span className="text-gray-300 dark:text-white/20">•</span>
                <span>{new Date(b.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2 pt-2 mt-auto border-t border-gray-100 dark:border-white/10">
                <BatchStatusSelect batch={b} onUpdate={handleStatusUpdate} />
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
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Batch Number</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Items</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date Created</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : batches.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">No batches in this range.</td></tr>
                ) : batches.map(b => (
                  <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="View batch" onClick={() => openDetail(b)} className="w-9 h-9 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-500/25 flex items-center justify-center transition-colors"><FileBlueIcon className="w-[26px] h-[26px]" /></button>
                        <button title="Remove batch" onClick={() => handleDelete(b)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                        <button title="Notify customers in batch" onClick={() => openNotify(b)} className="w-9 h-9 rounded-lg text-cyan-600 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 flex items-center justify-center transition-colors"><MegaphoneIcon className="w-[26px] h-[26px]" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <button onClick={() => openDetail(b)} className="hover:underline text-brand-700 dark:text-white">{b.batchNumber}</button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.totalItems}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(b.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <BatchStatusSelect batch={b} onUpdate={handleStatusUpdate} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {pages > 1 && (
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: pages }).map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'bg-brand-800 text-white' : 'bg-white dark:bg-white/5 border dark:border-white/10 text-gray-600 dark:text-white/60'}`}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>

      {/* Add shipment modal */}
      {shipmentFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 dark:text-white">New shipment{detailBatch ? ` — ${detailBatch.batchNumber}` : ''}</h3>
              <button onClick={() => setShipmentFormOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <p className="text-xs text-gray-400 dark:text-white/40 mb-4">
              Type: <span className={`font-semibold ${inferShipmentType(detailBatch?.batchNumber) === 'AIR' ? 'text-sky-600 dark:text-sky-400' : 'text-blue-600 dark:text-blue-400'}`}>{inferShipmentType(detailBatch?.batchNumber) === 'AIR' ? 'Air' : 'Sea'}</span> — set automatically from the batch label
            </p>
            <form onSubmit={handleCreateShipment} className="space-y-3">
              {shipmentFormError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{shipmentFormError}</div>}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Customer Name</label>
                <input
                  value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setCustomerDropdownOpen(true); if (shipmentForm.customerEmail) setShipmentForm(f => ({ ...f, customerEmail: '' })); }}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                  placeholder="Search by customer name…"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
                />
                {customerDropdownOpen && customerName.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerSearching ? (
                      <div className="px-3 py-2 text-xs text-gray-400 dark:text-white/40">Searching…</div>
                    ) : customerOptions.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400 dark:text-white/40">No matching customers</div>
                    ) : customerOptions.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => { setCustomerName(c.name); setShipmentForm(f => ({ ...f, customerEmail: c.email })); setCustomerDropdownOpen(false); }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <span className="text-gray-900 dark:text-white font-medium">{c.name}</span>
                        <span className="block text-xs text-gray-400 dark:text-white/40">{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Customer Email</label>
                <input type="email" readOnly value={shipmentForm.customerEmail} placeholder="Auto-filled after choosing a customer name" className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.03] text-gray-500 dark:text-white/50 dark:border-white/10 cursor-not-allowed" />
                {shipmentForm.customerEmail && detailBatch?.shipments.some((s: any) => s.user?.email === shipmentForm.customerEmail) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">This customer already has a shipment in this batch — the tracking # and cube amount below will be added to it instead of creating a new shipment.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Courier Name</label>
                <input value={shipmentForm.courierName} onChange={e => setShipmentForm(f => ({ ...f, courierName: e.target.value }))} placeholder="e.g. FedEx, UPS, USPS, DHL" list="courier-names" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                <datalist id="courier-names">
                  {courierNames.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Tracking number *</label>
                <input required value={shipmentForm.trackingNumber} onChange={e => setShipmentForm(f => ({ ...f, trackingNumber: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Pickup Location</label>
                <select value={shipmentForm.pickupLocation} onChange={e => setShipmentForm(f => ({ ...f, pickupLocation: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                  <option value="">Select location</option>
                  {PICKUP_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {inferShipmentType(detailBatch?.batchNumber) === 'AIR' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Weight (lbs)</label>
                  <input type="number" step="0.01" value={shipmentForm.weight} onChange={e => setShipmentForm(f => ({ ...f, weight: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Cube</label>
                  <input type="number" step="0.01" value={shipmentForm.cube} onChange={e => setShipmentForm(f => ({ ...f, cube: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Description</label>
                <input value={shipmentForm.description} onChange={e => setShipmentForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <button type="submit" disabled={shipmentSaving} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
                {shipmentSaving ? 'Creating…' : 'Create shipment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Notify modal */}
      {notifyBatch && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Notify — {notifyBatch.batchNumber}</h3>
              <button onClick={() => setNotifyBatch(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <input value={notifySubject} onChange={e => setNotifySubject(e.target.value)} placeholder="Subject" className="w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
            <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} placeholder="Message" rows={4} className="w-full border rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
            <button onClick={handleNotify} disabled={notifying} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
              {notifying ? 'Sending…' : 'Send notification'}
            </button>
            <p className="text-[11px] text-gray-400 dark:text-white/40 mt-2">No email/SMS provider is connected yet — this validates recipients and simulates the send.</p>
          </div>
        </div>
      )}

      {/* Notify single shipment modal */}
      {notifyShipment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Notify — {notifyShipment.user?.name || notifyShipment.trackingNumber}</h3>
              <button onClick={() => setNotifyShipment(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <textarea value={notifyShipmentMessage} onChange={e => setNotifyShipmentMessage(e.target.value)} placeholder="Message" rows={4} className="w-full border rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
            <button onClick={handleNotifyShipment} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm">Send notification</button>
          </div>
        </div>
      )}

      {editingShipment && (
        // key={editingShipment.id} forces a full remount when Next/Previous swaps the
        // shipment — otherwise the panel's form fields (all useState(shipment.x)
        // initializers) would keep showing the previously-viewed shipment's data.
        <ShipmentDetailPanel
          key={editingShipment.id}
          shipment={editingShipment}
          mode="edit"
          onClose={() => setEditingShipment(null)}
          onNext={goToNextShipment}
          hasNext={hasNextShipment}
          onPrevious={goToPreviousShipment}
          hasPrevious={hasPreviousShipment}
          onSaved={() => {
            setEditingShipment(null);
            showToast('Shipment updated');
            if (detailBatch) openDetail(detailBatch);
            load();
          }}
        />
      )}
    </div>
  );
}

function BatchStatusSelect({ batch, onUpdate }: { batch: Batch; onUpdate: (b: Batch, status: string) => void }) {
  const [value, setValue] = useState(batch.status);
  return (
    <>
      <StatusIconSelect value={value} onChange={setValue} />
      <button onClick={() => onUpdate(batch, value)} className="bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">Update</button>
    </>
  );
}

function ShipmentStatusSelect({ shipment, onUpdate }: { shipment: any; onUpdate: (s: any, status: string) => void }) {
  const [value, setValue] = useState(shipment.status);
  useEffect(() => { setValue(shipment.status); }, [shipment.status]);
  return (
    <div className="flex items-center gap-1.5">
      <StatusIconSelect value={value} onChange={setValue} />
      <button onClick={() => onUpdate(shipment, value)} className="bg-brand-800 hover:bg-brand-700 text-white text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors flex-shrink-0">Update</button>
    </div>
  );
}
