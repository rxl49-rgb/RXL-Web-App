import { useState, useEffect } from 'react';
import { Plus, Minus, X, FileDown, CreditCard, Search, Ruler } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import MailIcon from '../../components/icons/MailIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';
import { LoadingGuideRow } from '../../lib/freight';
import { downloadLoadingGuidePdf, downloadDrLabelPdf } from '../../lib/pdf';

interface LoadingGuide {
  id: string;
  drNumber: string;
  dropOffDate: string;
  destination: string;
  dropOffBy: string;
  consignee: string;
  description: string;
  items: string;
  totalCubes: number;
  totalPieces: number;
  createdAt: string;
  updatedAt: string;
}

interface FormRow {
  description: string;
  pieces: string;
  height: string;
  width: string;
  length: string;
}

function parseItems(raw: string): LoadingGuideRow[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Recomputed from the guide's actual item rows rather than trusting the stored
// totalPieces/totalCubes aggregate columns — guides saved before the piece-count
// feature existed (or whose items JSON predates it) have those columns stuck at 0
// until the record is next edited and re-saved, which showed up as a "Total PC: 0"
// box even when the items clearly had pieces. Deriving it from `items` here is
// self-healing: it's always correct regardless of what's stored on the row.
function sumPieces(itemsJson: string): number {
  return parseItems(itemsJson).reduce((s, i) => s + (Number(i.pieces) || 1), 0);
}
function sumCubes(itemsJson: string): number {
  return parseItems(itemsJson).reduce((s, i) => s + (Number(i.cubes) || 0), 0);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDateInput(iso: string) {
  return iso ? iso.slice(0, 10) : '';
}

// Formats a stored date-only value (e.g. "2026-07-30T00:00:00.000Z") without ever
// routing it through `new Date(isoString)` — that constructor parses the string as UTC
// midnight, and toLocaleDateString() then converts to the browser's local timezone,
// which rolls the date back a day in any negative-UTC-offset timezone (Jamaica is
// UTC-5). Building the Date from the Y/M/D components directly keeps it local-only.
function formatDateOnly(iso: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts);
}

// Cubic feet for ONE unit: (H x W x L in inches) / 1728, rounded — mirrors the
// backend's calculation so the running total shown while editing matches what gets
// saved/printed.
function computeUnitCubes(r: FormRow): number {
  const h = parseFloat(r.height) || 0;
  const w = parseFloat(r.width) || 0;
  const l = parseFloat(r.length) || 0;
  if (!h || !w || !l) return 0;
  return Math.round((h * w * l) / 1728);
}

// Row's TOTAL cubic feet — unit cubes x how many identical pieces this row covers.
function computeRowCubes(r: FormRow): number {
  const pieces = Math.max(1, parseInt(r.pieces) || 1);
  return computeUnitCubes(r) * pieces;
}

const EMPTY_ROW: FormRow = { description: '', pieces: '1', height: '', width: '', length: '' };

// Prefilled defaults for a new loading guide — the most common consignee/description
// this admin team fills in, and the standard drop-off party. All fields stay editable.
const DEFAULT_CONSIGNEE = 'RXL Logistics - Shop 6B Portsville Center, Freeport, Montego Bay.';
const DEFAULT_DESCRIPTION = 'Household items, Groceries, Furniture, Car parts & Tools.';
const DEFAULT_DROP_OFF_BY = 'RXL Logistics';

// Predictive suggestions for the per-row measurement Description field.
const MEASUREMENT_DESCRIPTIONS = ['Pallet', 'Box'];

export default function AdminLoadingGuide() {
  const { confirmDelete } = useDeleteGuard();
  const [guides, setGuides] = useState<LoadingGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drNumber, setDrNumber] = useState('');
  const [dropOffDate, setDropOffDate] = useState(todayISO());
  const [destination, setDestination] = useState('');
  const [dropOffBy, setDropOffBy] = useState(DEFAULT_DROP_OFF_BY);
  const [consignee, setConsignee] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<FormRow[]>([{ ...EMPTY_ROW }]);
  const [suggestOpenIndex, setSuggestOpenIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [emailingGuide, setEmailingGuide] = useState<LoadingGuide | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/loading-guides', { params: search ? { search } : {} })
      .then(r => setGuides(r.data))
      .catch(() => showToast('Failed to load loading guides'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [search]);

  const resetForm = () => {
    setDrNumber('');
    setDropOffDate(todayISO());
    setDestination('');
    setDropOffBy(DEFAULT_DROP_OFF_BY);
    setConsignee(DEFAULT_CONSIGNEE);
    setDescription(DEFAULT_DESCRIPTION);
    setRows([{ ...EMPTY_ROW }]);
  };

  const openAdd = () => {
    setEditingId(null);
    resetForm();
    setFormError('');
    setPanelOpen(true);
    api.get('/loading-guides/next-dr-number').then(r => setDrNumber(r.data.drNumber)).catch(() => {});
  };

  const openEdit = (g: LoadingGuide) => {
    setEditingId(g.id);
    setDrNumber(g.drNumber);
    setDropOffDate(toDateInput(g.dropOffDate));
    setDestination(g.destination);
    setDropOffBy(g.dropOffBy || DEFAULT_DROP_OFF_BY);
    setConsignee(g.consignee);
    setDescription(g.description);
    const items = parseItems(g.items);
    setRows(items.length ? items.map(i => ({
      description: i.description || '',
      pieces: i.pieces ? String(i.pieces) : '1',
      height: i.height ? String(i.height) : '',
      width: i.width ? String(i.width) : '',
      length: i.length ? String(i.length) : '',
    })) : [{ ...EMPTY_ROW }]);
    setFormError('');
    setPanelOpen(true);
  };

  const updateRow = (i: number, patch: Partial<FormRow>) =>
    setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const addRow = () => setRows([...rows, { ...EMPTY_ROW }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  const runningTotalCubes = rows.reduce((s, r) => s + computeRowCubes(r), 0);
  const runningTotalPieces = rows.reduce((s, r) => s + (Math.max(1, parseInt(r.pieces) || 1)), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropOffDate) { setFormError('Drop off date is required'); return; }
    if (!destination.trim()) { setFormError('Destination is required'); return; }
    if (!consignee.trim()) { setFormError('Consignee is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        drNumber: drNumber.trim(),
        dropOffDate,
        destination: destination.trim(),
        dropOffBy: dropOffBy.trim(),
        consignee: consignee.trim(),
        description,
        items: rows
          .filter(r => r.description.trim() || r.height || r.width || r.length)
          .map(r => ({
            description: r.description.trim(),
            pieces: Math.max(1, parseInt(r.pieces) || 1),
            height: parseFloat(r.height) || 0,
            width: parseFloat(r.width) || 0,
            length: parseFloat(r.length) || 0,
          })),
      };
      if (editingId) await api.put(`/loading-guides/${editingId}`, payload);
      else await api.post('/loading-guides', payload);

      showToast(editingId ? 'Loading guide updated' : 'Loading guide created');
      setPanelOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save loading guide');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: LoadingGuide) => {
    if (!(await confirmDelete(`Permanently delete loading guide ${g.drNumber}? This cannot be undone.`))) return;
    try {
      await api.delete(`/loading-guides/${g.id}`);
      showToast('Loading guide deleted');
      load();
    } catch {
      showToast('Failed to delete loading guide');
    }
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPdf = async (g: LoadingGuide) => {
    setDownloadingId(g.id);
    try {
      await downloadLoadingGuidePdf({
        drNumber: g.drNumber,
        dropOffDate: g.dropOffDate,
        destination: g.destination,
        dropOffBy: g.dropOffBy,
        consignee: g.consignee,
        description: g.description,
        items: parseItems(g.items),
        totalCubes: sumCubes(g.items),
        totalPieces: sumPieces(g.items),
      });
    } catch {
      showToast('Failed to generate PDF — run "npm install" in frontend/ if this is a fresh setup');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadDrLabel = async (g: LoadingGuide) => {
    setDownloadingId(g.id);
    try {
      await downloadDrLabelPdf({ drNumber: g.drNumber, totalPieces: sumPieces(g.items) });
    } catch {
      showToast('Failed to generate DR label — run "npm install" in frontend/ if this is a fresh setup');
    } finally {
      setDownloadingId(null);
    }
  };

  const openEmail = (g: LoadingGuide) => {
    setEmailingGuide(g);
    setEmailAddress('');
    setEmailError('');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailingGuide) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailSending(true);
    setEmailError('');
    try {
      const { data } = await api.post(`/loading-guides/${emailingGuide.id}/email`, { to: emailAddress.trim() });
      showToast(data.simulated ? `Loading guide logged for ${emailAddress.trim()} (SMTP not configured)` : `Loading guide emailed to ${emailAddress.trim()}`);
      setEmailingGuide(null);
    } catch (err: any) {
      setEmailError(err?.response?.data?.error || 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loading Guide <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Loading Guide</span></div>
      </div>

      <div className="p-6 space-y-5">
        <p className="text-sm text-gray-500 dark:text-white/50 -mt-1">
          Record a warehouse drop-off with its measurement breakdown, then print a clean PDF loading guide for the driver.
        </p>

        <div className="panel-glass rounded-2xl">
          <button onClick={() => (panelOpen ? setPanelOpen(false) : openAdd())} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Loading Guide <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-5">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Drop Off Date *</label>
                  <input type="date" value={dropOffDate} onChange={e => setDropOffDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">DR#</label>
                  <input value={drNumber} onChange={e => setDrNumber(e.target.value)} placeholder="e.g. RXL13208" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Destination *</label>
                  <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. MBY" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Drop Off By</label>
                  <input value={dropOffBy} onChange={e => setDropOffBy(e.target.value)} placeholder="e.g. RXL Logistics" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Consignee *</label>
                <input value={consignee} onChange={e => setConsignee(e.target.value)} placeholder="e.g. RXL Logistics - Shop 6B Portsville Center, Freeport, Montego Bay." className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="e.g. Household items, Groceries, Furniture, Car parts & Tools." className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">Measurements</label>
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-[1fr_60px_90px_90px_90px_70px_28px] gap-2 px-1 text-xs font-semibold text-gray-400 dark:text-white/40">
                    <span>Description</span><span>PC</span><span>Height</span><span>Width</span><span>Length</span><span>Cubes</span><span />
                  </div>
                  {rows.map((r, i) => {
                    const suggestions = MEASUREMENT_DESCRIPTIONS.filter(d =>
                      d.toLowerCase().startsWith(r.description.trim().toLowerCase())
                    ).filter(d => d.toLowerCase() !== r.description.trim().toLowerCase());
                    return (
                    <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_60px_90px_90px_90px_70px_28px] gap-2 items-center">
                      <div className="relative col-span-2 sm:col-span-1">
                        <input
                          value={r.description}
                          onChange={e => updateRow(i, { description: e.target.value })}
                          onFocus={() => setSuggestOpenIndex(i)}
                          onBlur={() => setTimeout(() => setSuggestOpenIndex(null), 150)}
                          placeholder="Pallet / Box"
                          className="w-full border rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 text-gray-900 dark:text-white"
                        />
                        {suggestOpenIndex === i && suggestions.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full min-w-[9rem] bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg overflow-hidden">
                            {suggestions.map(sug => (
                              <button
                                type="button"
                                key={sug}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { updateRow(i, { description: sug }); setSuggestOpenIndex(null); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input type="number" step="1" min="1" value={r.pieces} onChange={e => updateRow(i, { pieces: e.target.value })} placeholder="PC" className="no-spinner border rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      <input type="number" step="0.1" value={r.height} onChange={e => updateRow(i, { height: e.target.value })} placeholder="H" className="no-spinner border rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      <input type="number" step="0.1" value={r.width} onChange={e => updateRow(i, { width: e.target.value })} placeholder="W" className="no-spinner border rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      <input type="number" step="0.1" value={r.length} onChange={e => updateRow(i, { length: e.target.value })} placeholder="L" className="no-spinner border rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      <div className="text-sm font-semibold text-gray-700 dark:text-white/70 text-center">{computeRowCubes(r)}</div>
                      <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} className="w-6 h-6 rounded bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 flex items-center justify-center disabled:opacity-30 flex-shrink-0">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );})}
                </div>
                <button type="button" onClick={addRow} className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200">
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
                <div className="mt-3 flex justify-end gap-2">
                  <div className="bg-brand-50 dark:bg-brand-500/10 rounded-xl px-4 py-2 text-sm">
                    <span className="text-gray-500 dark:text-white/50 font-medium mr-2">Total PC</span>
                    <span className="font-bold text-gray-900 dark:text-white">{runningTotalPieces}</span>
                  </div>
                  <div className="bg-brand-50 dark:bg-brand-500/10 rounded-xl px-4 py-2 text-sm">
                    <span className="text-gray-500 dark:text-white/50 font-medium mr-2">Total Cubes</span>
                    <span className="font-bold text-gray-900 dark:text-white">{runningTotalCubes}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setPanelOpen(false); resetForm(); }} className="flex items-center gap-1.5 border text-gray-600 dark:text-white/60 text-sm font-medium px-4 py-2 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="panel-glass rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
              <Search className="w-4 h-4 text-gray-400 dark:text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search DR#, destination, consignee…" className="border rounded-lg px-3 py-2 text-sm w-64 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
            </div>
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Loading Guide
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">DR#</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Drop Off Date</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Destination</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Consignee</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Total PC</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Total Cubes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : guides.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">
                      <Ruler className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-white/20" />
                      No loading guides yet.
                    </td>
                  </tr>
                ) : guides.map(g => (
                  <tr key={g.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="Edit" onClick={() => openEdit(g)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button title="Download PDF" disabled={downloadingId === g.id} onClick={() => handleDownloadPdf(g)} className="w-8 h-8 rounded-lg text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/25 flex items-center justify-center transition-colors disabled:opacity-40"><FileDown className="w-3.5 h-3.5" /></button>
                        <button title="DR Label" disabled={downloadingId === g.id} onClick={() => handleDownloadDrLabel(g)} className="w-8 h-8 rounded-lg text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/25 flex items-center justify-center transition-colors disabled:opacity-40"><CreditCard className="w-3.5 h-3.5" /></button>
                        <button title="Email" onClick={() => openEmail(g)} className="w-8 h-8 rounded-lg text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/25 flex items-center justify-center transition-colors"><MailIcon className="w-3.5 h-3.5" /></button>
                        <button title="Delete" onClick={() => handleDelete(g)} className="w-8 h-8 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{g.drNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-white/60">{formatDateOnly(g.dropOffDate, { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-white/60">{g.destination}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-white/60 max-w-xs truncate">{g.consignee}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{sumPieces(g.items)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{sumCubes(g.items)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {emailingGuide && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl p-6 w-full max-w-sm shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 dark:text-white">Email Loading Guide</h3>
              <button onClick={() => setEmailingGuide(null)} className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/50 mb-4">Send {emailingGuide.drNumber} to an email address.</p>
            <form onSubmit={handleSendEmail}>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Email address</label>
              <input
                type="email"
                autoFocus
                value={emailAddress}
                onChange={e => { setEmailAddress(e.target.value); setEmailError(''); }}
                placeholder="name@example.com"
                className="w-full border rounded-lg px-3 py-2 text-sm mb-1 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
              {emailError && <p className="text-xs text-red-600 mb-2">{emailError}</p>}
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setEmailingGuide(null)} className="flex-1 border rounded-xl py-2 text-sm font-semibold text-gray-600 dark:text-white/60 dark:border-white/10 transition-colors">Cancel</button>
                <button type="submit" disabled={emailSending} className="flex-1 bg-brand-800 hover:bg-brand-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50 transition-colors">
                  {emailSending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
