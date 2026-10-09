import { useState, useEffect, useRef, useMemo } from 'react';
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Search, ClipboardCheck } from 'lucide-react';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface BatchOption {
  id: string;
  batchNumber: string;
  totalItems: number;
}

interface TallyEntry {
  key: string;
  trackingNumber: string;
  courier: string | null;
  customerName: string;
  tallied: boolean;
  talliedAt: string | null;
}

interface ScanFeedback {
  result: 'matched' | 'duplicate' | 'not_found';
  trackingNumber: string;
  customerName?: string;
}

export default function AdminTally() {
  const { confirmDelete } = useDeleteGuard();
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchId, setBatchId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [entries, setEntries] = useState<TallyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [search, setSearch] = useState('');
  const [resetting, setResetting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const scanInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get('/batches', { params: { limit: 200, sortBy: 'createdAt', sortDir: 'desc' } })
      .then(r => setBatches(r.data.batches))
      .catch(() => showToast('Failed to load batches'));
  }, []);

  const loadTally = (id: string) => {
    setLoading(true);
    api.get(`/batches/${id}/tally`)
      .then(r => { setEntries(r.data.entries); setBatchNumber(r.data.batchNumber); })
      .catch(() => showToast('Failed to load batch tally'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!batchId) { setEntries([]); setBatchNumber(''); return; }
    loadTally(batchId);
  }, [batchId]);

  useEffect(() => {
    if (batchId && !loading) scanInputRef.current?.focus();
  }, [batchId, loading]);

  const talliedCount = entries.filter(e => e.tallied).length;
  const totalCount = entries.length;
  const pct = totalCount === 0 ? 0 : Math.round((talliedCount / totalCount) * 100);

  const flashFeedback = (fb: ScanFeedback) => {
    setFeedback(fb);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3500);
  };

  const handleScan = async (raw: string) => {
    const trackingNumber = raw.trim();
    if (!trackingNumber || !batchId) return;
    setScanning(true);
    try {
      const { data } = await api.post(`/batches/${batchId}/tally/scan`, { trackingNumber });
      flashFeedback(data);
      if (data.result === 'matched') {
        setEntries(prev => prev.map(e => e.trackingNumber.toLowerCase() === trackingNumber.toLowerCase() ? { ...e, tallied: true, talliedAt: new Date().toISOString() } : e));
      }
    } catch {
      showToast('Scan failed — try again');
    } finally {
      setScanning(false);
      setScanInput('');
      scanInputRef.current?.focus();
    }
  };

  const handleReset = async () => {
    if (!batchId) return;
    if (!(await confirmDelete(`Reset all tally progress for batch ${batchNumber}? This clears every scanned checkmark and cannot be undone.`))) return;
    setResetting(true);
    try {
      await api.post(`/batches/${batchId}/tally/reset`);
      showToast('Tally reset');
      loadTally(batchId);
    } catch {
      showToast('Failed to reset tally');
    } finally {
      setResetting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(e => e.trackingNumber.toLowerCase().includes(q) || e.customerName.toLowerCase().includes(q) || e.courier?.toLowerCase().includes(q));
  }, [entries, search]);

  const feedbackStyle = {
    matched: 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/20',
    duplicate: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
    not_found: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20',
  };
  const feedbackIcon = {
    matched: <CheckCircle2 className="w-5 h-5 flex-shrink-0" />,
    duplicate: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
    not_found: <XCircle className="w-5 h-5 flex-shrink-0" />,
  };
  const feedbackText = {
    matched: (fb: ScanFeedback) => `Tallied — ${fb.trackingNumber}${fb.customerName ? ` (${fb.customerName})` : ''}`,
    duplicate: (fb: ScanFeedback) => `Already tallied — ${fb.trackingNumber}`,
    not_found: (fb: ScanFeedback) => `Not part of this batch — ${fb.trackingNumber}`,
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tally <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Batch Tracking Verification</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Tally</span></div>
      </div>

      <div className="p-6 space-y-5">
        <p className="text-sm text-gray-500 dark:text-white/50 -mt-1">
          Select a batch, then scan (or type) each piece's tracking number to verify it's physically present before the batch ships out.
        </p>

        <div className="panel-glass rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Batch</label>
            <select value={batchId} onChange={e => setBatchId(e.target.value)} className="w-full sm:w-96 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
              <option value="">-- Select a batch to tally --</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.batchNumber} ({b.totalItems} item{b.totalItems === 1 ? '' : 's'})</option>)}
            </select>
          </div>

          {batchId && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Scan Tracking Number</label>
                <div className="relative">
                  <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
                  <input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleScan(scanInput); }}
                    disabled={scanning || loading}
                    placeholder="Scan or type a tracking number, then press Enter…"
                    autoComplete="off"
                    className="w-full sm:w-96 pl-9 pr-3 py-2 border rounded-lg text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white disabled:opacity-60"
                  />
                </div>
              </div>

              {feedback && (
                <div className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-medium ${feedbackStyle[feedback.result]}`}>
                  {feedbackIcon[feedback.result]}
                  {feedbackText[feedback.result](feedback)}
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-500 dark:text-white/50 font-medium">Progress</span>
                    <span className="font-bold text-gray-900 dark:text-white">{talliedCount} of {totalCount} tallied ({pct}%)</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  disabled={resetting || totalCount === 0}
                  className="flex items-center gap-1.5 border text-gray-600 dark:text-white/60 dark:border-white/10 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 flex-shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Tally
                </button>
              </div>
            </>
          )}
        </div>

        {batchId && (
          <div className="panel-glass rounded-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b flex-wrap gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-white text-[15px]">Expected Tracking Numbers</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
                <Search className="w-4 h-4 text-gray-400 dark:text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="border rounded-lg px-3 py-2 text-sm w-56 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Tracking Number</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Courier</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Tallied At</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">
                        <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-white/20" />
                        {entries.length === 0 ? 'No tracking numbers on file for this batch.' : 'No entries match this search.'}
                      </td>
                    </tr>
                  ) : filtered.map(e => (
                    <tr key={e.key} className={`border-b last:border-b-0 ${e.tallied ? 'bg-green-50/50 dark:bg-green-500/[0.04]' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {e.tallied ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" /> Tallied
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-white/40">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{e.trackingNumber}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-white/60 whitespace-nowrap">{e.customerName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-white/60 whitespace-nowrap">{e.courier || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 dark:text-white/40 whitespace-nowrap">{e.talliedAt ? new Date(e.talliedAt).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
