import { useState, useEffect } from 'react';
import { Search, Plus, X, Tag } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { PICKUP_LOCATIONS, downloadCsv, copyTableToClipboard, fmtMoney } from '../../lib/freight';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

type Tab = 'transactions' | 'outstanding' | 'outstanding-by-batch' | 'profit-loss';
type PLSubTab = 'overview' | 'batches' | 'expense-labels';

const TABS: { key: Tab; label: string; subtitle: string }[] = [
  { key: 'profit-loss', label: 'Profit & Loss', subtitle: 'Income vs. expenses' },
  { key: 'transactions', label: 'Transaction Report', subtitle: 'End of day' },
  { key: 'outstanding', label: 'Outstanding Payment Report', subtitle: 'Items Already Picked Up' },
  { key: 'outstanding-by-batch', label: 'Outstanding Payment Report By Batch', subtitle: 'Items Already Picked Up' },
];

interface TxRow { id: string; customerName: string; batchLabel: string | null; itemCount: number; paymentType: string; referenceNumber: string; comment: string; date: string; totalCharges: number; amountPaid: number; amountOwed: number }
interface OutRow { id: string; customerName: string; batchLabel: string | null; itemCount: number; email: string; phone: string; totalCharges: number; amountPaid: number; amountOwed: number }
interface Totals { items: number; totalCharges: number; amountPaid: number; amountOwed: number }
interface PLEntry { id: string; title: string; currency: string; amount: number; amountUSD: number; createdAt: string }
interface PLData {
  freightRevenue: number; otherIncome: number; totalIncome: number; totalExpenses: number; netProfit: number;
  expenseByCategory: { title: string; amount: number }[];
  incomeEntries: PLEntry[]; expenseEntries: PLEntry[]; jmdPerUsd: number; usdPerJmd: number;
}

interface RevenueExpenseLine { label: string; amount: number }
interface RevenueBatchRow {
  id: string; label: string; month: string; revenue: number; collectedAmount: number;
  expenses: RevenueExpenseLine[]; totalExpenses: number; profit: number; outstanding: number;
  createdAt: string; updatedAt: string;
}
interface ExpenseLabelRow { id: string; label: string }
interface MonthlyTotalRow { month: string; batchCount: number; revenue: number; collectedAmount: number; totalExpenses: number; profit: number; outstanding: number }
interface MonthlyTotalsData { months: MonthlyTotalRow[]; overall: MonthlyTotalRow & { batchCount: number } }

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function currentMonthValue() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthDisplay(m: string) {
  const [y, mo] = m.split('-').map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function AdminReports() {
  const { confirmDelete } = useDeleteGuard();
  const [tab, setTab] = useState<Tab>('profit-loss');
  const [plSubTab, setPlSubTab] = useState<PLSubTab>('overview');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const [batchOptions, setBatchOptions] = useState<{ id: string; batchNumber: string }[]>([]);
  useEffect(() => { api.get('/batches', { params: { limit: 200 } }).then(r => setBatchOptions(r.data.batches)).catch(() => {}); }, []);

  // Transaction Report state
  const [txDateFrom, setTxDateFrom] = useState(todayISO());
  const [txDateTo, setTxDateTo] = useState(todayISO());
  const [txPickup, setTxPickup] = useState('ALL');
  const [txSearch, setTxSearch] = useState('');
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [txTotals, setTxTotals] = useState<Totals>({ items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 });
  const [txLoading, setTxLoading] = useState(true);

  const loadTx = () => {
    setTxLoading(true);
    api.get('/reports/transactions', { params: { dateFrom: txDateFrom, dateTo: txDateTo, pickupLocation: txPickup, search: txSearch || undefined } })
      .then(r => { setTxRows(r.data.rows); setTxTotals(r.data.totals); })
      .catch(() => showToast('Failed to load transaction report'))
      .finally(() => setTxLoading(false));
  };

  // Outstanding Payment Report state
  const [outDateFrom, setOutDateFrom] = useState(monthStartISO());
  const [outDateTo, setOutDateTo] = useState(todayISO());
  const [outPickup, setOutPickup] = useState('ALL');
  const [outSearch, setOutSearch] = useState('');
  const [outRows, setOutRows] = useState<OutRow[]>([]);
  const [outTotals, setOutTotals] = useState<Totals>({ items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 });
  const [outLoading, setOutLoading] = useState(true);

  const loadOut = () => {
    setOutLoading(true);
    api.get('/reports/outstanding', { params: { dateFrom: outDateFrom, dateTo: outDateTo, pickupLocation: outPickup, search: outSearch || undefined } })
      .then(r => { setOutRows(r.data.rows); setOutTotals(r.data.totals); })
      .catch(() => showToast('Failed to load outstanding payment report'))
      .finally(() => setOutLoading(false));
  };

  // Outstanding Payment Report By Batch state
  const [batchId, setBatchId] = useState('');
  const [byBatchSearch, setByBatchSearch] = useState('');
  const [byBatchRows, setByBatchRows] = useState<OutRow[]>([]);
  const [byBatchTotals, setByBatchTotals] = useState<Totals>({ items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 });
  const [byBatchLoading, setByBatchLoading] = useState(false);

  const loadByBatch = () => {
    if (!batchId) { setByBatchRows([]); setByBatchTotals({ items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 }); return; }
    setByBatchLoading(true);
    api.get('/reports/outstanding-by-batch', { params: { batchId, search: byBatchSearch || undefined } })
      .then(r => { setByBatchRows(r.data.rows); setByBatchTotals(r.data.totals); })
      .catch(() => showToast('Failed to load report'))
      .finally(() => setByBatchLoading(false));
  };

  // Profit & Loss state
  const [plDateFrom, setPlDateFrom] = useState(monthStartISO());
  const [plDateTo, setPlDateTo] = useState(todayISO());
  const [plData, setPlData] = useState<PLData | null>(null);
  const [plLoading, setPlLoading] = useState(false);

  const loadPL = () => {
    setPlLoading(true);
    api.get('/reports/profit-loss', { params: { dateFrom: plDateFrom, dateTo: plDateTo } })
      .then(r => setPlData(r.data))
      .catch(() => showToast('Failed to load Profit & Loss report'))
      .finally(() => setPlLoading(false));
  };

  // Profit & Loss > Batches / Monthly Totals / Expense Labels — a lightweight
  // manual revenue + expense tracker nested inside Profit & Loss (mirrors the
  // standalone RXL Revenue Tracker app). Distinct from freight Batches.
  const [revBatches, setRevBatches] = useState<RevenueBatchRow[]>([]);
  const [revBatchesLoading, setRevBatchesLoading] = useState(false);
  const [expenseLabels, setExpenseLabels] = useState<ExpenseLabelRow[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotalsData | null>(null);
  const [monthlyTotalsLoading, setMonthlyTotalsLoading] = useState(false);
  const [newExpenseLabel, setNewExpenseLabel] = useState('');

  const loadRevBatches = () => {
    setRevBatchesLoading(true);
    api.get('/revenue-batches').then(r => setRevBatches(r.data)).catch(() => showToast('Failed to load batches')).finally(() => setRevBatchesLoading(false));
  };
  const loadExpenseLabels = () => {
    api.get('/revenue-batches/expense-labels').then(r => setExpenseLabels(r.data)).catch(() => {});
  };
  const loadMonthlyTotals = () => {
    setMonthlyTotalsLoading(true);
    api.get('/revenue-batches/monthly-totals').then(r => setMonthlyTotals(r.data)).catch(() => showToast('Failed to load monthly totals')).finally(() => setMonthlyTotalsLoading(false));
  };

  useEffect(() => {
    if (tab !== 'profit-loss') return;
    if (plSubTab === 'overview') loadMonthlyTotals();
    else if (plSubTab === 'batches') { loadRevBatches(); loadExpenseLabels(); }
    else if (plSubTab === 'expense-labels') loadExpenseLabels();
  }, [tab, plSubTab]);

  const saveLabelToPresets = async (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    try {
      await api.post('/revenue-batches/expense-labels', { label: trimmed });
      loadExpenseLabels();
      showToast(`"${trimmed}" saved as a reusable expense label`);
    } catch {
      showToast('That label already exists');
    }
  };
  const handleAddExpenseLabel = async () => {
    await saveLabelToPresets(newExpenseLabel);
    setNewExpenseLabel('');
  };
  const handleDeleteExpenseLabel = async (l: ExpenseLabelRow) => {
    if (!(await confirmDelete(`Remove expense label "${l.label}"?`))) return;
    try {
      await api.delete(`/revenue-batches/expense-labels/${l.id}`);
      loadExpenseLabels();
    } catch {
      showToast('Failed to remove label');
    }
  };

  // linkedBatchId: '' means "custom label" (free text); any other value is the id of
  // a freight Batch (from the Batches page) whose batchNumber is used as the label.
  const EMPTY_REV_BATCH_FORM = { id: '', label: '', linkedBatchId: '', month: currentMonthValue(), revenue: '0', collectedAmount: '0', expenses: [] as RevenueExpenseLine[] };
  const [revBatchFormOpen, setRevBatchFormOpen] = useState(false);
  const [revBatchForm, setRevBatchForm] = useState(EMPTY_REV_BATCH_FORM);
  const [revBatchSaving, setRevBatchSaving] = useState(false);

  const openNewRevBatch = () => { setRevBatchForm(EMPTY_REV_BATCH_FORM); setRevBatchFormOpen(true); };
  const openEditRevBatch = (b: RevenueBatchRow) => {
    const matched = batchOptions.find(bo => bo.batchNumber === b.label);
    setRevBatchForm({ id: b.id, label: b.label, linkedBatchId: matched ? matched.id : '', month: b.month, revenue: String(b.revenue), collectedAmount: String(b.collectedAmount), expenses: b.expenses });
    setRevBatchFormOpen(true);
  };
  const selectRevBatchLink = (value: string) => {
    if (value === '__custom__') { setRevBatchForm(f => ({ ...f, linkedBatchId: '' })); return; }
    const matched = batchOptions.find(bo => bo.id === value);
    setRevBatchForm(f => ({ ...f, linkedBatchId: value, label: matched ? matched.batchNumber : f.label }));
  };
  const addExpenseLine = (label = '') => setRevBatchForm(f => ({ ...f, expenses: [...f.expenses, { label, amount: 0 }] }));
  const updateExpenseLine = (i: number, patch: Partial<RevenueExpenseLine>) =>
    setRevBatchForm(f => ({ ...f, expenses: f.expenses.map((e, idx) => idx === i ? { ...e, ...patch } : e) }));
  const removeExpenseLine = (i: number) => setRevBatchForm(f => ({ ...f, expenses: f.expenses.filter((_, idx) => idx !== i) }));
  const revBatchExpensesTotal = revBatchForm.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const revBatchProfit = (Number(revBatchForm.revenue) || 0) - revBatchExpensesTotal;

  const saveRevBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revBatchForm.label.trim() || !revBatchForm.month) { showToast('Label and month are required'); return; }
    setRevBatchSaving(true);
    const payload = {
      label: revBatchForm.label.trim(),
      month: revBatchForm.month,
      revenue: Number(revBatchForm.revenue) || 0,
      collectedAmount: Number(revBatchForm.collectedAmount) || 0,
      expenses: revBatchForm.expenses.filter(x => x.label.trim()),
    };
    try {
      if (revBatchForm.id) await api.put(`/revenue-batches/${revBatchForm.id}`, payload);
      else await api.post('/revenue-batches', payload);
      setRevBatchFormOpen(false);
      loadRevBatches();
      showToast(revBatchForm.id ? 'Batch updated' : 'Batch created');
    } catch {
      showToast('Failed to save batch');
    } finally {
      setRevBatchSaving(false);
    }
  };

  const handleDeleteRevBatch = async (b: RevenueBatchRow) => {
    if (!(await confirmDelete(`Remove batch "${b.label}"?`))) return;
    try {
      await api.delete(`/revenue-batches/${b.id}`);
      loadRevBatches();
      showToast('Batch removed');
    } catch {
      showToast('Failed to remove batch');
    }
  };

  useEffect(() => {
    if (tab === 'transactions') loadTx();
    else if (tab === 'outstanding') loadOut();
    else if (tab === 'profit-loss') loadPL();
    else if (batchId) loadByBatch();
  }, [tab]);

  useEffect(() => { if (batchOptions.length > 0 && !batchId) setBatchId(batchOptions[0].id); }, [batchOptions]);
  useEffect(() => { if (tab === 'outstanding-by-batch' && batchId) loadByBatch(); }, [batchId]);

  const activeTab = TABS.find(t => t.key === tab)!;

  const exportRows = (headers: string[], rows: string[][], filename: string, kind: 'copy' | 'csv') => {
    if (kind === 'copy') { copyTableToClipboard(headers, rows); showToast('Copied to clipboard'); }
    else downloadCsv(headers, rows, filename);
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{activeTab.label} <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">{activeTab.subtitle}</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Home <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Report</span></div>
      </div>

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {tab === 'transactions' && (
          <>
            <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <input type="date" value={txDateFrom} onChange={e => setTxDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              <span className="text-gray-400 dark:text-white/40 text-sm">-</span>
              <input type="date" value={txDateTo} onChange={e => setTxDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              <button onClick={loadTx} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Search className="w-4 h-4" /> Search</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => exportRows(['Customer', 'Batch', 'Payment Type', 'Reference #', 'Comment', 'Date', 'Total Charges', 'Amount Paid', 'Amount Owed'], txRows.map(r => [r.customerName, r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '', r.paymentType, r.referenceNumber, r.comment, new Date(r.date).toLocaleString(), fmtMoney(r.totalCharges), fmtMoney(r.amountPaid), fmtMoney(r.amountOwed)]), 'transaction-report.csv', 'copy')} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
              <button onClick={() => exportRows(['Customer', 'Batch', 'Payment Type', 'Reference #', 'Comment', 'Date', 'Total Charges', 'Amount Paid', 'Amount Owed'], txRows.map(r => [r.customerName, r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '', r.paymentType, r.referenceNumber, r.comment, new Date(r.date).toLocaleString(), fmtMoney(r.totalCharges), fmtMoney(r.amountPaid), fmtMoney(r.amountOwed)]), 'transaction-report.csv', 'csv')} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
              <button onClick={() => window.print()} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
              <span className="text-sm text-gray-500 dark:text-white/50 ml-2">Search:</span>
              <input value={txSearch} onChange={e => setTxSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTx()} className="border rounded-lg px-3 py-2 text-sm w-56" />
              <div className="flex-1" />
              <span className="text-sm text-gray-500 dark:text-white/50">Filter by Pickup Location:</span>
              <select value={txPickup} onChange={e => { setTxPickup(e.target.value); }} className="border rounded-lg text-sm px-3 py-2">
                <option value="ALL">All</option>
                {PICKUP_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="panel-glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Batch</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Payment Type</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Reference #</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Comment</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Charges</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Amount Paid</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Amount Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txLoading ? (
                      <tr><td colSpan={9} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                    ) : txRows.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16 text-gray-400 dark:text-white/40">No transactions in this range.</td></tr>
                    ) : (
                      <>
                        {txRows.map(r => (
                          <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{r.customerName}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.paymentType}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.referenceNumber || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.comment || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{new Date(r.date).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.totalCharges)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.amountPaid)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.amountOwed)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-gray-50 dark:bg-white/5">
                          <td className="px-4 py-3">Total:</td>
                          <td className="px-4 py-3">{txTotals.items} Item(s)</td>
                          <td className="px-4 py-3" colSpan={3}></td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3">${fmtMoney(txTotals.totalCharges)}</td>
                          <td className="px-4 py-3">${fmtMoney(txTotals.amountPaid)}</td>
                          <td className="px-4 py-3">${fmtMoney(txTotals.amountOwed)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 text-xs text-gray-400 dark:text-white/40 border-t">Showing 1 to {txRows.length} of {txRows.length} entries</div>
            </div>
          </>
        )}

        {tab === 'outstanding' && (
          <>
            <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <input type="date" value={outDateFrom} onChange={e => setOutDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              <span className="text-gray-400 dark:text-white/40 text-sm">-</span>
              <input type="date" value={outDateTo} onChange={e => setOutDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              <button onClick={loadOut} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Search className="w-4 h-4" /> Search</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => exportRows(['Customer', 'Batch', 'Email', 'Phone Number', 'Total Charges', 'Amount Paid', 'Amount Owed'], outRows.map(r => [r.customerName, r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '', r.email, r.phone, fmtMoney(r.totalCharges), fmtMoney(r.amountPaid), fmtMoney(r.amountOwed)]), 'outstanding-payment-report.csv', 'copy')} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
              <button onClick={() => exportRows(['Customer', 'Batch', 'Email', 'Phone Number', 'Total Charges', 'Amount Paid', 'Amount Owed'], outRows.map(r => [r.customerName, r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '', r.email, r.phone, fmtMoney(r.totalCharges), fmtMoney(r.amountPaid), fmtMoney(r.amountOwed)]), 'outstanding-payment-report.csv', 'csv')} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
              <button onClick={() => window.print()} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
              <span className="text-sm text-gray-500 dark:text-white/50 ml-2">Search:</span>
              <input value={outSearch} onChange={e => setOutSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadOut()} className="border rounded-lg px-3 py-2 text-sm w-56" />
              <div className="flex-1" />
              <span className="text-sm text-gray-500 dark:text-white/50">Filter by Pickup Location:</span>
              <select value={outPickup} onChange={e => { setOutPickup(e.target.value); }} className="border rounded-lg text-sm px-3 py-2">
                <option value="ALL">All</option>
                {PICKUP_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="panel-glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Batch</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Phone Number</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Charges</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Amount Paid</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Amount Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outLoading ? (
                      <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                    ) : outRows.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">No outstanding balances in this range.</td></tr>
                    ) : (
                      <>
                        {outRows.map(r => (
                          <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{r.customerName}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.email || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.phone || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.totalCharges)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.amountPaid)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.amountOwed)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-gray-50 dark:bg-white/5">
                          <td className="px-4 py-3">Total:</td>
                          <td className="px-4 py-3">{outTotals.items} Item(s)</td>
                          <td className="px-4 py-3" colSpan={2}></td>
                          <td className="px-4 py-3">${fmtMoney(outTotals.totalCharges)}</td>
                          <td className="px-4 py-3">${fmtMoney(outTotals.amountPaid)}</td>
                          <td className="px-4 py-3">${fmtMoney(outTotals.amountOwed)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 text-xs text-gray-400 dark:text-white/40 border-t">Showing 1 to {outRows.length} of {outRows.length} entries</div>
            </div>
          </>
        )}

        {tab === 'outstanding-by-batch' && (
          <>
            <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <select value={batchId} onChange={e => setBatchId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[220px]">
                {batchOptions.map(b => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
              </select>
              <button onClick={loadByBatch} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Search className="w-4 h-4" /> Search</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => exportRows(['Customer', 'Batch', 'Email', 'Phone Number', 'Total Charges', 'Amount Paid', 'Amount Owed'], byBatchRows.map(r => [r.customerName, r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '', r.email, r.phone, fmtMoney(r.totalCharges), fmtMoney(r.amountPaid), fmtMoney(r.amountOwed)]), 'outstanding-by-batch.csv', 'copy')} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
              <button onClick={() => exportRows(['Customer', 'Batch', 'Email', 'Phone Number', 'Total Charges', 'Amount Paid', 'Amount Owed'], byBatchRows.map(r => [r.customerName, r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '', r.email, r.phone, fmtMoney(r.totalCharges), fmtMoney(r.amountPaid), fmtMoney(r.amountOwed)]), 'outstanding-by-batch.csv', 'csv')} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
              <button onClick={() => window.print()} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
              <div className="flex-1" />
              <span className="text-sm text-gray-500 dark:text-white/50">Search:</span>
              <input value={byBatchSearch} onChange={e => setByBatchSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadByBatch()} className="border rounded-lg px-3 py-2 text-sm w-56" />
            </div>

            <div className="panel-glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Batch</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Phone Number</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Charges</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Amount Paid</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Amount Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byBatchLoading ? (
                      <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                    ) : byBatchRows.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">No outstanding balances in this batch.</td></tr>
                    ) : (
                      <>
                        {byBatchRows.map(r => (
                          <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{r.customerName}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.batchLabel ? `${r.batchLabel} (${r.itemCount} Items)` : '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.email || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{r.phone || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.totalCharges)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.amountPaid)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(r.amountOwed)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-gray-50 dark:bg-white/5">
                          <td className="px-4 py-3">Total:</td>
                          <td className="px-4 py-3">{byBatchTotals.items} Item(s)</td>
                          <td className="px-4 py-3" colSpan={2}></td>
                          <td className="px-4 py-3">${fmtMoney(byBatchTotals.totalCharges)}</td>
                          <td className="px-4 py-3">${fmtMoney(byBatchTotals.amountPaid)}</td>
                          <td className="px-4 py-3">${fmtMoney(byBatchTotals.amountOwed)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 text-xs text-gray-400 dark:text-white/40 border-t">Showing 1 to {byBatchRows.length} of {byBatchRows.length} entries</div>
            </div>
          </>
        )}

        {tab === 'profit-loss' && (
          <>
            <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 dark:border-white/10 pb-1">
              {([
                ['overview', 'Overview'],
                ['batches', 'Batches'],
                ['expense-labels', 'Expense Labels'],
              ] as [PLSubTab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setPlSubTab(key)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${plSubTab === key ? 'bg-brand-800 text-white' : 'text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                  {label}
                </button>
              ))}
            </div>

            {plSubTab === 'overview' && (
              <>
                <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
                  <input type="date" value={plDateFrom} onChange={e => setPlDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                  <span className="text-gray-400 dark:text-white/40 text-sm">-</span>
                  <input type="date" value={plDateTo} onChange={e => setPlDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                  <button onClick={loadPL} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Search className="w-4 h-4" /> Search</button>
                  <button onClick={() => window.print()} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black ml-auto">PDF</button>
                </div>

                {plLoading ? (
                  <div className="panel-glass rounded-xl p-16 text-center text-gray-400 dark:text-white/40">Loading…</div>
                ) : !plData ? null : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="panel-glass rounded-2xl p-4">
                        <p className="text-xs text-gray-500 dark:text-white/50">Freight Revenue</p>
                        <p className="text-xl font-extrabold text-gray-900 dark:text-white">${fmtMoney(plData.freightRevenue)}</p>
                      </div>
                      <div className="panel-glass rounded-2xl p-4">
                        <p className="text-xs text-gray-500 dark:text-white/50">Other Income</p>
                        <p className="text-xl font-extrabold text-gray-900 dark:text-white">${fmtMoney(plData.otherIncome)}</p>
                      </div>
                      <div className="panel-glass rounded-2xl p-4">
                        <p className="text-xs text-gray-500 dark:text-white/50">Total Expenses</p>
                        <p className="text-xl font-extrabold text-red-600">${fmtMoney(plData.totalExpenses)}</p>
                      </div>
                      <div className="panel-glass rounded-2xl p-4">
                        <p className="text-xs text-gray-500 dark:text-white/50">Net Profit</p>
                        <p className={`text-xl font-extrabold ${plData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmtMoney(plData.netProfit)}</p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-white/40">JMD entries converted to USD at 1 JMD = {plData.usdPerJmd.toFixed(6)} USD (Pricing Presets &gt; Exchange Rate).</p>
                  </>
                )}

                <div className="pt-2 border-t border-gray-100 dark:border-white/10">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Monthly Totals</h3>
                  {monthlyTotalsLoading ? (
                    <div className="panel-glass rounded-xl p-16 text-center text-gray-400 dark:text-white/40">Loading…</div>
                  ) : !monthlyTotals ? null : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="panel-glass rounded-2xl p-4">
                          <p className="text-xs text-gray-500 dark:text-white/50">Batches</p>
                          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{monthlyTotals.overall.batchCount}</p>
                        </div>
                        <div className="panel-glass rounded-2xl p-4">
                          <p className="text-xs text-gray-500 dark:text-white/50">Revenue</p>
                          <p className="text-xl font-extrabold text-gray-900 dark:text-white">${fmtMoney(monthlyTotals.overall.revenue)}</p>
                        </div>
                        <div className="panel-glass rounded-2xl p-4">
                          <p className="text-xs text-gray-500 dark:text-white/50">Collected</p>
                          <p className="text-xl font-extrabold text-gray-900 dark:text-white">${fmtMoney(monthlyTotals.overall.collectedAmount)}</p>
                        </div>
                        <div className="panel-glass rounded-2xl p-4">
                          <p className="text-xs text-gray-500 dark:text-white/50">Expenses</p>
                          <p className="text-xl font-extrabold text-red-600">${fmtMoney(monthlyTotals.overall.totalExpenses)}</p>
                        </div>
                        <div className="panel-glass rounded-2xl p-4">
                          <p className="text-xs text-gray-500 dark:text-white/50">Profit</p>
                          <p className={`text-xl font-extrabold ${monthlyTotals.overall.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmtMoney(monthlyTotals.overall.profit)}</p>
                        </div>
                      </div>

                      <div className="panel-glass rounded-xl overflow-hidden mt-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Month</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Batches</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Revenue</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Collected</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Expenses</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Profit</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Outstanding</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyTotals.months.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">No batches yet.</td></tr>
                              ) : monthlyTotals.months.map(m => (
                                <tr key={m.month} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{monthDisplay(m.month)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">{m.batchCount}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(m.revenue)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(m.collectedAmount)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-red-600">${fmtMoney(m.totalExpenses)}</td>
                                  <td className={`px-4 py-3 whitespace-nowrap font-semibold ${m.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmtMoney(m.profit)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-amber-600">${fmtMoney(m.outstanding)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {plData && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="panel-glass rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b font-semibold text-gray-900 dark:text-white text-sm">Expenses by Category</div>
                      <table className="w-full text-sm">
                        <tbody>
                          {plData.expenseByCategory.length === 0 ? (
                            <tr><td className="text-center py-10 text-gray-400 dark:text-white/40">No expenses in this range.</td></tr>
                          ) : plData.expenseByCategory.map(c => (
                            <tr key={c.title} className="border-b last:border-b-0">
                              <td className="px-4 py-2.5 text-gray-700 dark:text-white/80">{c.title}</td>
                              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">${fmtMoney(c.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="panel-glass rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b font-semibold text-gray-900 dark:text-white text-sm">Other Income Entries</div>
                      <table className="w-full text-sm">
                        <tbody>
                          {plData.incomeEntries.length === 0 ? (
                            <tr><td className="text-center py-10 text-gray-400 dark:text-white/40">No Biz Journal income entries in this range.</td></tr>
                          ) : plData.incomeEntries.map(e => (
                            <tr key={e.id} className="border-b last:border-b-0">
                              <td className="px-4 py-2.5 text-gray-700 dark:text-white/80">{e.title}</td>
                              <td className="px-4 py-2.5 text-gray-400 dark:text-white/40 text-xs whitespace-nowrap">{e.currency !== 'USD' ? `${e.currency} ${fmtMoney(e.amount)}` : ''}</td>
                              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">${fmtMoney(e.amountUSD)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {plSubTab === 'batches' && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-white/50">Manually tracked revenue batches — label, month, revenue, collected amount, and expenses, with profit computed automatically.</p>
                  <button onClick={openNewRevBatch} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-xl flex-shrink-0"><Plus className="w-4 h-4" /> New batch</button>
                </div>

        {revBatchFormOpen && (
          <div className="panel-glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">{revBatchForm.id ? 'Edit batch' : 'New batch'}</h3>
                <button onClick={() => setRevBatchFormOpen(false)} className="text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={saveRevBatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Batch</label>
                  <select value={revBatchForm.linkedBatchId || '__custom__'} onChange={e => selectRevBatchLink(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2">
                    <option value="__custom__">— Custom label —</option>
                    {batchOptions.map(bo => <option key={bo.id} value={bo.id}>{bo.batchNumber}</option>)}
                  </select>
                  {!revBatchForm.linkedBatchId && (
                    <input value={revBatchForm.label} onChange={e => setRevBatchForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. August Air Freight" className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Month</label>
                    <input type="month" value={revBatchForm.month} onChange={e => setRevBatchForm(f => ({ ...f, month: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Revenue (USD)</label>
                    <input type="number" step="0.01" value={revBatchForm.revenue} onChange={e => setRevBatchForm(f => ({ ...f, revenue: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm text-right" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Collected (USD)</label>
                    <input type="number" step="0.01" value={revBatchForm.collectedAmount} onChange={e => setRevBatchForm(f => ({ ...f, collectedAmount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm text-right" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">Expenses</label>
                  {expenseLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {expenseLabels.map(l => (
                        <button key={l.id} type="button" onClick={() => addExpenseLine(l.label)} className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 px-2.5 py-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
                          <Tag className="w-3 h-3" /> {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {revBatchForm.expenses.map((ex, i) => {
                      const trimmed = ex.label.trim();
                      const alreadySaved = !trimmed || expenseLabels.some(l => l.label.toLowerCase() === trimmed.toLowerCase());
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <input value={ex.label} onChange={e => updateExpenseLine(i, { label: e.target.value })} placeholder="Expense label" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                          <input type="number" step="0.01" value={ex.amount} onChange={e => updateExpenseLine(i, { amount: parseFloat(e.target.value) || 0 })} className="w-28 border rounded-lg px-3 py-2 text-sm text-right" />
                          {!alreadySaved && (
                            <button type="button" title="Save as reusable label" onClick={() => saveLabelToPresets(ex.label)} className="w-8 h-8 flex-shrink-0 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/25 flex items-center justify-center transition-colors"><Tag className="w-3.5 h-3.5" /></button>
                          )}
                          <button type="button" onClick={() => removeExpenseLine(i)} className="w-8 h-8 flex-shrink-0 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => addExpenseLine()} className="mt-2 flex items-center gap-1.5 text-sm text-brand-700 dark:text-brand-300 font-medium"><Plus className="w-3.5 h-3.5" /> Add custom expense</button>
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-lg px-4 py-3 text-sm">
                  <span className="text-gray-500 dark:text-white/50">Total expenses: <strong className="text-gray-900 dark:text-white">${fmtMoney(revBatchExpensesTotal)}</strong></span>
                  <span className="text-gray-500 dark:text-white/50">Profit: <strong className={revBatchProfit >= 0 ? 'text-green-600' : 'text-red-600'}>${fmtMoney(revBatchProfit)}</strong></span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setRevBatchFormOpen(false)} className="flex-1 border rounded-xl py-2 text-sm font-semibold text-gray-600 dark:text-white/60 dark:border-white/10 transition-colors">Cancel</button>
                  <button type="submit" disabled={revBatchSaving} className="flex-1 bg-brand-800 hover:bg-brand-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50 transition-colors">{revBatchSaving ? 'Saving…' : revBatchForm.id ? 'Save changes' : 'Create batch'}</button>
                </div>
              </form>
          </div>
        )}

                <div className="panel-glass rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Actions</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Label</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Month</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Revenue</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Collected</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Expenses</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Profit</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revBatchesLoading ? (
                          <tr><td colSpan={8} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                        ) : revBatches.length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-16 text-gray-400 dark:text-white/40">No revenue batches yet. Click "New batch" to add one.</td></tr>
                        ) : revBatches.map(b => (
                          <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <button title="Edit" onClick={() => openEditRevBatch(b)} className="w-7 h-7 rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                                <button title="Remove" onClick={() => handleDeleteRevBatch(b)} className="w-7 h-7 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{b.label}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{monthDisplay(b.month)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(b.revenue)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">${fmtMoney(b.collectedAmount)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-red-600">${fmtMoney(b.totalExpenses)}</td>
                            <td className={`px-4 py-3 whitespace-nowrap font-semibold ${b.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmtMoney(b.profit)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-amber-600">${fmtMoney(b.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {plSubTab === 'expense-labels' && (
              <>
                <p className="text-sm text-gray-500 dark:text-white/50">Reusable expense labels — appear as quick-add chips in the batch form's expense list.</p>
                <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
                  <input value={newExpenseLabel} onChange={e => setNewExpenseLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddExpenseLabel()} placeholder="New expense label…" className="border rounded-lg px-3 py-2 text-sm w-64" />
                  <button onClick={handleAddExpenseLabel} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-xl"><Plus className="w-4 h-4" /> Add label</button>
                </div>

                <div className="panel-glass rounded-xl p-4 flex flex-wrap gap-2">
                  {expenseLabels.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-white/40 py-2">No custom expense labels yet.</p>
                  ) : expenseLabels.map(l => (
                    <span key={l.id} className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white/80 text-sm px-3 py-1.5 rounded-full">
                      <Tag className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" /> {l.label}
                      <button title="Remove label" onClick={() => handleDeleteExpenseLabel(l)} className="text-gray-400 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
