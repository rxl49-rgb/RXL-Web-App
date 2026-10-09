import { useState, useEffect, useMemo } from 'react';
import { FileText, Search, X } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';
import { downloadCsv, copyTableToClipboard } from '../../lib/freight';

interface Receipt {
  id: string;
  label: string;
  totalItemsScanned: number;
  createdAt: string;
  batch: { id: string; batchNumber: string } | null;
}

interface ScanItem {
  id: string;
  customerName: string;
  trackingNumber: string;
  courier: string | null;
  phone: string | null;
  email: string | null;
  dateReceived: string;
}

interface ReceiptDetail extends Receipt {
  items: ScanItem[];
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthsAgoISO(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); }

export default function AdminWarehouseScans() {
  const { confirmDelete } = useDeleteGuard();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthsAgoISO(2));
  const [dateTo, setDateTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [batchOptions, setBatchOptions] = useState<{ id: string; batchNumber: string }[]>([]);
  const [pendingBatch, setPendingBatch] = useState<Record<string, string>>({});

  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailPage, setDetailPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/warehouse', { params: { dateFrom, dateTo, search: search || undefined, page, limit: 10 } })
      .then(r => { setReceipts(r.data.receipts); setPages(r.data.pages); setTotal(r.data.total); })
      .catch(() => showToast('Failed to load warehouse receipts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    api.get('/batches', { params: { limit: 200 } }).then(r => setBatchOptions(r.data.batches)).catch(() => {});
  }, []);

  const openDetail = async (r: Receipt) => {
    try {
      const { data } = await api.get(`/warehouse/${r.id}`);
      setDetail(data);
      setDetailSearch('');
      setDetailPage(1);
      setSelectedItems(new Set());
    } catch {
      showToast('Failed to load receipt');
    }
  };

  const handleDeleteReceipt = async (r: Receipt) => {
    if (!(await confirmDelete(`Remove receipt "${r.label}" and its ${r.totalItemsScanned} scanned item(s)?`))) return;
    try {
      await api.delete(`/warehouse/${r.id}`);
      showToast('Receipt removed');
      load();
    } catch {
      showToast('Failed to remove receipt');
    }
  };

  const handleAssign = async (r: Receipt) => {
    const batchId = pendingBatch[r.id];
    if (!batchId) return showToast('Select a batch first');
    try {
      await api.patch(`/warehouse/${r.id}/assign-batch`, { batchId });
      showToast(`Assigned ${r.label} to batch`);
      load();
    } catch {
      showToast('Failed to assign batch');
    }
  };

  const handleUnassign = async (r: Receipt) => {
    try {
      await api.patch(`/warehouse/${r.id}/assign-batch`, { batchId: null });
      showToast(`Unassigned ${r.label}`);
      load();
    } catch {
      showToast('Failed to unassign batch');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!detail) return;
    if (!(await confirmDelete('Remove this scanned item?'))) return;
    try {
      await api.delete(`/warehouse/${detail.id}/items/${itemId}`);
      showToast('Item removed');
      const { data } = await api.get(`/warehouse/${detail.id}`);
      setDetail(data);
    } catch {
      showToast('Failed to remove item');
    }
  };

  const detailFiltered = useMemo(() => {
    if (!detail) return [];
    if (!detailSearch) return detail.items;
    const q = detailSearch.toLowerCase();
    return detail.items.filter(i => i.customerName.toLowerCase().includes(q) || i.trackingNumber.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q) || i.courier?.toLowerCase().includes(q));
  }, [detail, detailSearch]);

  const DETAIL_PAGE_SIZE = 10;
  const detailPages = Math.max(1, Math.ceil(detailFiltered.length / DETAIL_PAGE_SIZE));
  const detailPageItems = detailFiltered.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

  const toggleSelectAll = () => {
    if (selectedItems.size === detailPageItems.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(detailPageItems.map(i => i.id)));
  };
  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExportCsv = () => {
    downloadCsv(
      ['Bill Receipt Number', 'Total Items Scanned', 'Date Created', 'Assigned To'],
      receipts.map(r => [r.label, String(r.totalItemsScanned), new Date(r.createdAt).toLocaleDateString(), r.batch?.batchNumber || '']),
      'warehouse-receipts.csv'
    );
  };
  const handleCopy = () => {
    copyTableToClipboard(
      ['Bill Receipt Number', 'Total Items Scanned', 'Date Created', 'Assigned To'],
      receipts.map(r => [r.label, String(r.totalItemsScanned), new Date(r.createdAt).toLocaleDateString(), r.batch?.batchNumber || ''])
    );
    showToast('Copied to clipboard');
  };
  const handlePrint = () => window.print();

  const handleDetailExportCsv = () => {
    if (!detail) return;
    downloadCsv(
      ['Customer Name', 'Tracking Number', 'Courier', 'Phone', 'Email', 'Date Received'],
      detailFiltered.map(i => [i.customerName, i.trackingNumber, i.courier || '', i.phone || '', i.email || '', new Date(i.dateReceived).toLocaleString()]),
      `${detail.label}.csv`
    );
  };
  const handleDetailCopy = () => {
    if (!detail) return;
    copyTableToClipboard(
      ['Customer Name', 'Tracking Number', 'Courier', 'Phone', 'Email', 'Date Received'],
      detailFiltered.map(i => [i.customerName, i.trackingNumber, i.courier || '', i.phone || '', i.email || '', new Date(i.dateReceived).toLocaleString()])
    );
    showToast('Copied to clipboard');
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Warehouse <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">All Bill/Batch Receipts</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Home <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Warehouse</span></div>
      </div>

      <div className="p-6 space-y-4">
        <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          <span className="text-gray-400 dark:text-white/40 text-sm">-</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => { setPage(1); load(); }} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Search className="w-4 h-4" /> Search</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleCopy} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
          <button onClick={handleExportCsv} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
          <button onClick={handlePrint} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500 dark:text-white/50">Search:</span>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }} className="border rounded-lg px-3 py-2 text-sm w-64" />
        </div>

        <div className="panel-glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Action(s)</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Bill Receipt Number</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Items Scanned</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date Created</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : receipts.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">No receipts in this range.</td></tr>
                ) : receipts.map(r => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="View" onClick={() => openDetail(r)} className="w-8 h-8 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/25 flex items-center justify-center transition-colors"><FileText className="w-3.5 h-3.5" /></button>
                        <button title="Remove receipt" onClick={() => handleDeleteReceipt(r)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{r.label}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.totalItemsScanned}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.batch ? (
                        <div className="flex items-center gap-2">
                          <select disabled value={r.batch.id} className="border rounded-lg text-sm px-2 py-2 bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/50">
                            <option value={r.batch.id}>{r.batch.batchNumber}</option>
                          </select>
                          <button onClick={() => handleUnassign(r)} className="bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl whitespace-nowrap transition-colors">Unassign Batch</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select value={pendingBatch[r.id] || ''} onChange={e => setPendingBatch(p => ({ ...p, [r.id]: e.target.value }))} className="border rounded-lg text-sm px-2 py-2">
                            <option value="">-- Select Batch --</option>
                            {batchOptions.map(b => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
                          </select>
                          <button onClick={() => handleAssign(r)} className="bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap">Assign to Batch</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-gray-400 dark:text-white/40">Showing {total === 0 ? 0 : (page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total} entries</div>
          <div className="flex items-center gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-2 rounded-lg text-sm border dark:border-white/10 bg-white dark:bg-white/5 dark:text-white/60 disabled:opacity-40">Previous</button>
            {Array.from({ length: Math.min(pages, 6) }).map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'bg-brand-800 text-white' : 'bg-white dark:bg-white/5 border dark:border-white/10 text-gray-600 dark:text-white/60'}`}>{i + 1}</button>
            ))}
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-2 rounded-lg text-sm border dark:border-white/10 bg-white dark:bg-white/5 dark:text-white/60 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {/* Receipt detail drill-in */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-6xl w-full my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/10">
              <h3 className="font-bold text-gray-900 dark:text-white">Shipment [{detail.label}] Details <span className="text-gray-400 dark:text-white/40 font-normal text-sm">View/Update</span></h3>
              <button onClick={() => setDetail(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleDetailCopy} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
                <button onClick={handleDetailExportCsv} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
                <button onClick={() => window.print()} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
                <div className="flex-1" />
                <span className="text-sm text-gray-500 dark:text-white/50">Search:</span>
                <input value={detailSearch} onChange={e => { setDetailSearch(e.target.value); setDetailPage(1); }} className="border rounded-lg px-3 py-2 text-sm w-64 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>

              <div className="overflow-x-auto border dark:border-white/10 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">
                        <input type="checkbox" checked={detailPageItems.length > 0 && selectedItems.size === detailPageItems.length} onChange={toggleSelectAll} className="mr-2" />All
                      </th>
                      <th className="px-2 py-3"></th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer Name</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Tracking Number</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Courier</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Date Received</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Assigned to:</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPageItems.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400 dark:text-white/40">No scanned items match this search.</td></tr>
                    ) : detailPageItems.map(i => (
                      <tr key={i.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-3"><input type="checkbox" checked={selectedItems.has(i.id)} onChange={() => toggleSelect(i.id)} /></td>
                        <td className="px-2 py-3">
                          <button title="Remove item" onClick={() => handleRemoveItem(i.id)} className="w-7 h-7 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{i.customerName}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{i.trackingNumber}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{i.courier || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{i.phone || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{i.email || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(i.dateReceived).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-400 dark:text-white/40">{detail.batch?.batchNumber || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm text-gray-400 dark:text-white/40">Showing {detailFiltered.length === 0 ? 0 : (detailPage - 1) * DETAIL_PAGE_SIZE + 1} to {Math.min(detailPage * DETAIL_PAGE_SIZE, detailFiltered.length)} of {detailFiltered.length} entries</div>
                <div className="flex items-center gap-1.5">
                  <button disabled={detailPage <= 1} onClick={() => setDetailPage(p => p - 1)} className="px-3 py-2 rounded-lg text-sm border dark:border-white/10 bg-white dark:bg-black dark:text-white disabled:opacity-40">Previous</button>
                  {Array.from({ length: detailPages }).map((_, i) => (
                    <button key={i} onClick={() => setDetailPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm ${detailPage === i + 1 ? 'bg-brand-800 text-white' : 'bg-white dark:bg-black border dark:border-white/10 text-gray-600 dark:text-white/60'}`}>{i + 1}</button>
                  ))}
                  <button disabled={detailPage >= detailPages} onClick={() => setDetailPage(p => p + 1)} className="px-3 py-2 rounded-lg text-sm border dark:border-white/10 bg-white dark:bg-black dark:text-white disabled:opacity-40">Next</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
