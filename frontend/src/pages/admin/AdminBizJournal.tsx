import { useState, useEffect, useMemo } from 'react';
import { Plus, DollarSign, Receipt, X, Ban, Search } from 'lucide-react';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { downloadCsv, copyTableToClipboard, fmtMoney } from '../../lib/freight';

interface Entry {
  id: string;
  title: string;
  entryType: 'INCOME' | 'EXPENSE';
  currency: 'JMD' | 'USD';
  paymentType: string;
  amount: number;
  notes: string | null;
  createdBy: { name: string } | null;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Summary { income: { JMD: number; USD: number }; expense: { JMD: number; USD: number } }

const PAYMENT_TYPES = ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Other'];

const EMPTY_FORM = { title: '', entryType: 'EXPENSE' as 'INCOME' | 'EXPENSE', currency: 'JMD' as 'JMD' | 'USD', paymentType: 'Cash', amount: '', notes: '' };

function monthStartISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function monthEndISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); }

export default function AdminBizJournal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary>({ income: { JMD: 0, USD: 0 }, expense: { JMD: 0, USD: 0 } });
  const [loading, setLoading] = useState(true);

  const [entryTypeFilter, setEntryTypeFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo] = useState(monthEndISO());
  const [quickSearch, setQuickSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/biz-journal', { params: { entryType: entryTypeFilter, currency: currencyFilter, dateFrom, dateTo } }),
      api.get('/biz-journal/summary'),
    ]).then(([entriesRes, summaryRes]) => {
      setEntries(entriesRes.data);
      setSummary(summaryRes.data);
    }).catch(() => showToast('Failed to load business journal')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!quickSearch) return entries;
    const q = quickSearch.toLowerCase();
    return entries.filter(e => e.title.toLowerCase().includes(q) || e.createdBy?.name.toLowerCase().includes(q));
  }, [entries, quickSearch]);

  const openAdd = () => { setEditingEntry(null); setForm(EMPTY_FORM); setFormError(''); setFormOpen(true); };
  const openEdit = (e: Entry) => {
    setEditingEntry(e);
    setForm({ title: e.title, entryType: e.entryType, currency: e.currency, paymentType: e.paymentType, amount: String(e.amount), notes: e.notes || '' });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingEntry) {
        await api.put(`/biz-journal/${editingEntry.id}`, form);
        showToast('Transaction updated');
      } else {
        await api.post('/biz-journal', form);
        showToast('Transaction added');
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (entry: Entry) => {
    if (!confirm(`${entry.voided ? 'Restore' : 'Void'} "${entry.title}"?`)) return;
    try {
      await api.patch(`/biz-journal/${entry.id}/void`, { voided: !entry.voided });
      showToast(entry.voided ? 'Transaction restored' : 'Transaction voided');
      load();
    } catch {
      showToast('Failed to update transaction');
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      ['Title', 'Currency', 'Payment Type', 'Amount', 'Created By', 'Last Update'],
      filtered.map(e => [e.title, e.currency, e.paymentType, fmtMoney(e.amount), e.createdBy?.name || '', new Date(e.updatedAt).toLocaleString()]),
      'biz-journal.csv'
    );
  };
  const handleExportExcel = () => {
    downloadCsv(
      ['Title', 'Currency', 'Payment Type', 'Amount', 'Created By', 'Last Update'],
      filtered.map(e => [e.title, e.currency, e.paymentType, fmtMoney(e.amount), e.createdBy?.name || '', new Date(e.updatedAt).toLocaleString()]),
      'biz-journal.xls'
    );
  };
  const handleCopy = () => {
    copyTableToClipboard(
      ['Title', 'Currency', 'Payment Type', 'Amount', 'Created By', 'Last Update'],
      filtered.map(e => [e.title, e.currency, e.paymentType, fmtMoney(e.amount), e.createdBy?.name || '', new Date(e.updatedAt).toLocaleString()])
    );
    showToast('Copied to clipboard');
  };
  const handlePrint = () => window.print();

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Journal <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Control panel</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Business Transactions conducted</div>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="panel-glass rounded-xl overflow-hidden flex flex-1 min-w-[280px]">
            <div className="w-20 flex-shrink-0 flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-teal-600 dark:text-teal-300" />
            </div>
            <div className="p-3.5">
              <div className="text-xs font-bold text-gray-500 dark:text-white/50 tracking-wide mb-1.5">INCOME - THIS MONTH</div>
              <div className="text-base font-bold text-gray-900 dark:text-white">JMD ${loading ? '—' : fmtMoney(summary.income.JMD)}</div>
              <div className="text-base font-bold text-gray-900 dark:text-white">USD ${loading ? '—' : fmtMoney(summary.income.USD)}</div>
            </div>
          </div>

          <div className="panel-glass rounded-xl overflow-hidden flex flex-1 min-w-[280px]">
            <div className="w-20 flex-shrink-0 flex items-center justify-center">
              <Receipt className="w-8 h-8 text-red-500 dark:text-red-300" />
            </div>
            <div className="p-3.5">
              <div className="text-xs font-bold text-gray-500 dark:text-white/50 tracking-wide mb-1.5">EXPENSE - THIS MONTH</div>
              <div className="text-base font-bold text-gray-900 dark:text-white">JMD ${loading ? '—' : fmtMoney(summary.expense.JMD)}</div>
              <div className="text-base font-bold text-gray-900 dark:text-white">USD ${loading ? '—' : fmtMoney(summary.expense.USD)}</div>
            </div>
          </div>

          <button onClick={openAdd} title="Add transaction" className="w-14 h-14 rounded-full text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center flex-shrink-0 transition-colors">
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="panel-glass rounded-2xl">
          <div className="flex items-center justify-between px-5 py-3.5 border-b">
            <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Transactions</h2>
          </div>

          <div className="p-4 flex flex-wrap items-center gap-3 border-b">
            <select value={entryTypeFilter} onChange={e => setEntryTypeFilter(e.target.value)} className="border rounded-lg text-sm px-3 py-2">
              <option value="ALL">All</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
            <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="border rounded-lg text-sm px-3 py-2">
              <option value="ALL">ALL</option>
              <option value="JMD">JMD</option>
              <option value="USD">USD</option>
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <span className="text-gray-400 dark:text-white/40 text-sm">-</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <button onClick={load} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><Search className="w-4 h-4" /> Search</button>
          </div>

          <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
            <button onClick={handleCopy} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Copy</button>
            <button onClick={handleExportExcel} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">Excel</button>
            <button onClick={handlePrint} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">PDF</button>
            <button onClick={handleExportCsv} className="border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black">CSV</button>
            <div className="flex-1" />
            <span className="text-sm text-gray-500 dark:text-white/50">Search:</span>
            <input value={quickSearch} onChange={e => setQuickSearch(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-56" />
          </div>

          <div className="overflow-x-auto p-4 pt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-2 py-3 font-semibold whitespace-nowrap"></th>
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">Title</th>
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">Currency</th>
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">Payment Type</th>
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">Amount ($)</th>
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">Created By</th>
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">Last Update</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">No transactions in this range.</td></tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className={`border-b last:border-b-0 ${e.voided ? 'opacity-40' : ''}`}>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="Edit" onClick={() => openEdit(e)} className="w-8 h-8 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button title={e.voided ? 'Restore' : 'Void'} onClick={() => handleVoid(e)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><Ban className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-2 py-3 max-w-sm">
                      <span className={e.entryType === 'INCOME' ? 'text-green-700' : 'text-gray-900'}>{e.title}</span>
                      {e.voided && <span className="ml-2 text-[10px] font-semibold uppercase text-red-500">Voided</span>}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">{e.currency}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{e.paymentType}</td>
                    <td className="px-2 py-3 whitespace-nowrap">${fmtMoney(e.amount)}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{e.createdBy?.name || '—'}</td>
                    <td className="px-2 py-3 whitespace-nowrap text-gray-500 dark:text-white/50">{new Date(e.updatedAt).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 pb-4 text-xs text-gray-400 dark:text-white/40">Showing 1 to {filtered.length} of {filtered.length} entries</div>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{editingEntry ? 'Edit transaction' : 'Add transaction'}</h3>
              <button onClick={() => setFormOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Title *</label>
                <textarea required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-y bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Entry Type</label>
                  <select value={form.entryType} onChange={e => setForm(f => ({ ...f, entryType: e.target.value as 'INCOME' | 'EXPENSE' }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as 'JMD' | 'USD' }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    <option value="JMD">JMD</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Payment Type</label>
                  <select value={form.paymentType} onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    {PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Amount *</label>
                  <input required type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-y bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
                {saving ? 'Saving…' : editingEntry ? 'Update transaction' : 'Add transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
