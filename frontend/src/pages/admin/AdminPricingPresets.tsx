import { useState, useEffect } from 'react';
import { Plus, Minus, X, DollarSign, Ship, Plane, Check } from 'lucide-react';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface PricingPreset {
  id: string; title: string; percentage: number; type: string; active: boolean; updatedAt: string;
}

const PAGE_SIZE = 10;
const EMPTY_FORM = { title: '', percentage: '', type: 'discount', active: true };

export default function AdminPricingPresets() {
  const { confirmDelete } = useDeleteGuard();
  const [presets, setPresets] = useState<PricingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // The two rates are independently customizable — jmdPerUsd (USD->JMD) and usdPerJmd
  // (JMD->USD) are stored and edited separately, not derived from one another. This lets
  // a real buy/sell spread be set instead of a pure mathematical reciprocal.
  const [jmdPerUsd, setJmdPerUsd] = useState('');
  const [usdPerJmd, setUsdPerJmd] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  useEffect(() => {
    api.get('/currency').then(r => {
      setJmdPerUsd(String(r.data.jmdPerUsd));
      setUsdPerJmd(String(r.data.usdPerJmd));
    }).catch(() => {});
  }, []);
  const saveRate = async () => {
    const jVal = parseFloat(jmdPerUsd);
    const uVal = parseFloat(usdPerJmd);
    if ((!jVal || jVal <= 0) && (!uVal || uVal <= 0)) return showToast('Enter a valid exchange rate');
    setSavingRate(true);
    try {
      const payload: Record<string, number> = {};
      if (jVal > 0) payload.jmdPerUsd = jVal;
      if (uVal > 0) payload.usdPerJmd = uVal;
      const { data } = await api.put('/currency', payload);
      setJmdPerUsd(String(data.jmdPerUsd));
      setUsdPerJmd(String(data.usdPerJmd));
      showToast('Exchange rates updated');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to update exchange rate');
    } finally {
      setSavingRate(false);
    }
  };

  // Sea Freight (per cubic ft) and Air Freight (tiered per lb) rates — drive the shipment
  // freight-charge calculator (Shipment Information pane) and the public quote calculator.
  const EMPTY_FREIGHT_RATES = { seaRatePerCubicFt: '', airRate1to10: '', airRate11to30: '', airRate31to50: '', airRate51to100: '', airRate100plus: '' };
  const [freightRates, setFreightRates] = useState(EMPTY_FREIGHT_RATES);
  const [savingFreightRates, setSavingFreightRates] = useState(false);
  useEffect(() => {
    api.get('/freight-rates').then(r => setFreightRates({
      seaRatePerCubicFt: String(r.data.seaRatePerCubicFt),
      airRate1to10: String(r.data.airRate1to10),
      airRate11to30: String(r.data.airRate11to30),
      airRate31to50: String(r.data.airRate31to50),
      airRate51to100: String(r.data.airRate51to100),
      airRate100plus: String(r.data.airRate100plus),
    })).catch((err: any) => showToast(err?.response?.data?.error || 'Failed to load freight rates'));
  }, []);
  const setFreightRate = (key: keyof typeof EMPTY_FREIGHT_RATES, value: string) => setFreightRates(f => ({ ...f, [key]: value }));
  const saveFreightRates = async () => {
    const parsed: Record<string, number> = {};
    for (const [key, value] of Object.entries(freightRates)) {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) return showToast('Enter valid, non-negative rates');
      parsed[key] = num;
    }
    setSavingFreightRates(true);
    try {
      const { data } = await api.put('/freight-rates', parsed);
      setFreightRates({
        seaRatePerCubicFt: String(data.seaRatePerCubicFt),
        airRate1to10: String(data.airRate1to10),
        airRate11to30: String(data.airRate11to30),
        airRate31to50: String(data.airRate31to50),
        airRate51to100: String(data.airRate51to100),
        airRate100plus: String(data.airRate100plus),
      });
      showToast('Freight rates updated');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to update freight rates');
    } finally {
      setSavingFreightRates(false);
    }
  };

  const load = () => {
    setLoading(true);
    api.get('/presets/pricing', { params: { search: search || undefined } })
      .then(r => setPresets(r.data.presets))
      .catch(() => showToast('Failed to load pricing presets'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(''); setPanelOpen(true); };
  const openEdit = (p: PricingPreset) => {
    setEditingId(p.id);
    setForm({ title: p.title, percentage: String(p.percentage), type: p.type, active: p.active });
    setFormError('');
    setPanelOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { title: form.title, percentage: form.percentage, type: form.type, active: form.active };
      if (editingId) await api.put(`/presets/pricing/${editingId}`, payload);
      else await api.post('/presets/pricing', payload);
      showToast(editingId ? 'Preset updated' : 'Preset added');
      setPanelOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: PricingPreset) => {
    if (!(await confirmDelete(`Delete price preset "${p.title}"?`))) return;
    try {
      await api.delete(`/presets/pricing/${p.id}`);
      showToast('Preset removed');
      load();
    } catch {
      showToast('Failed to remove preset');
    }
  };

  const handleToggleStatus = async (p: PricingPreset) => {
    try {
      await api.put(`/presets/pricing/${p.id}`, { active: !p.active });
      showToast(p.active ? 'Preset deactivated' : 'Preset activated');
      load();
    } catch {
      showToast('Failed to update status');
    }
  };

  const totalPages = Math.max(1, Math.ceil(presets.length / PAGE_SIZE));
  const pagePresets = presets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pricing <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
      </div>

      <div className="p-6 space-y-5">
        <div className="panel-glass rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-gray-400 dark:text-white/40" /> Exchange Rate</h2>
          <p className="text-xs text-gray-500 dark:text-white/50 mb-3">Used across Freight (POS currency toggle), the Shipment charge calculator, and the Profit &amp; Loss report. Each direction is set independently — they are not calculated from one another.</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-white/60 w-28 flex-shrink-0">USD &rarr; JMD</span>
            <span className="text-sm text-gray-600 dark:text-white/60">1 USD =</span>
            <input type="number" step="0.01" value={jmdPerUsd} onChange={e => setJmdPerUsd(e.target.value)} className="no-spinner w-32 border rounded-lg px-3 py-2 text-sm text-right" />
            <span className="text-sm text-gray-600 dark:text-white/60">JMD</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-600 dark:text-white/60 w-28 flex-shrink-0">JMD &rarr; USD</span>
            <span className="text-sm text-gray-600 dark:text-white/60">1 JMD =</span>
            <input type="number" step="0.000001" value={usdPerJmd} onChange={e => setUsdPerJmd(e.target.value)} className="no-spinner w-32 border rounded-lg px-3 py-2 text-sm text-right" />
            <span className="text-sm text-gray-600 dark:text-white/60">USD</span>
          </div>
          <button onClick={saveRate} disabled={savingRate} className="mt-3 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50">
            {savingRate ? 'Saving…' : 'Save Rates'}
          </button>
        </div>

        <div className="panel-glass rounded-2xl p-5 space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-gray-400 dark:text-white/40" /> Freight Rates</h2>
            <p className="text-xs text-gray-500 dark:text-white/50">Drives the Shipment Information charge calculator and the public quote calculator.</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-white/80 flex items-center gap-1.5 mb-2"><Ship className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" /> Sea Freight Calculation</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-white/60">$</span>
              <input type="number" step="0.01" min="0" value={freightRates.seaRatePerCubicFt} onChange={e => setFreightRate('seaRatePerCubicFt', e.target.value)} className="w-28 border rounded-lg px-3 py-2 text-sm text-right" />
              <span className="text-sm text-gray-600 dark:text-white/60">per cube (cubic ft)</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-white/80 flex items-center gap-1.5 mb-2"><Plane className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" /> Air Freight Calculation — Weight</h3>
            <div className="space-y-2 max-w-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600 dark:text-white/60">1–10 LBS</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-600 dark:text-white/60">$</span>
                  <input type="number" step="0.01" min="0" value={freightRates.airRate1to10} onChange={e => setFreightRate('airRate1to10', e.target.value)} className="w-24 border rounded-lg px-3 py-2 text-sm text-right" />
                  <span className="text-sm text-gray-600 dark:text-white/60">/ LB</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600 dark:text-white/60">11–30 LBS</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-600 dark:text-white/60">$</span>
                  <input type="number" step="0.01" min="0" value={freightRates.airRate11to30} onChange={e => setFreightRate('airRate11to30', e.target.value)} className="w-24 border rounded-lg px-3 py-2 text-sm text-right" />
                  <span className="text-sm text-gray-600 dark:text-white/60">/ LB</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600 dark:text-white/60">31–50 LBS</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-600 dark:text-white/60">$</span>
                  <input type="number" step="0.01" min="0" value={freightRates.airRate31to50} onChange={e => setFreightRate('airRate31to50', e.target.value)} className="w-24 border rounded-lg px-3 py-2 text-sm text-right" />
                  <span className="text-sm text-gray-600 dark:text-white/60">/ LB</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600 dark:text-white/60">51–100 LBS</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-600 dark:text-white/60">$</span>
                  <input type="number" step="0.01" min="0" value={freightRates.airRate51to100} onChange={e => setFreightRate('airRate51to100', e.target.value)} className="w-24 border rounded-lg px-3 py-2 text-sm text-right" />
                  <span className="text-sm text-gray-600 dark:text-white/60">/ LB</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600 dark:text-white/60">100+ LBS</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-600 dark:text-white/60">$</span>
                  <input type="number" step="0.01" min="0" value={freightRates.airRate100plus} onChange={e => setFreightRate('airRate100plus', e.target.value)} className="w-24 border rounded-lg px-3 py-2 text-sm text-right" />
                  <span className="text-sm text-gray-600 dark:text-white/60">/ LB</span>
                </div>
              </div>
            </div>
          </div>

          <button onClick={saveFreightRates} disabled={savingFreightRates} className="bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {savingFreightRates ? 'Saving…' : 'Save Freight Rates'}
          </button>
        </div>

        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Pricing Presets <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-5 max-w-xl">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Title</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Percentage (%)</label>
                <input required type="number" step="0.01" value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">Type</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-white/80">
                    <input type="radio" name="presetType" checked={form.type === 'charge'} onChange={() => setForm(f => ({ ...f, type: 'charge' }))} />
                    Charge
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-white/80">
                    <input type="radio" name="presetType" checked={form.type === 'discount'} onChange={() => setForm(f => ({ ...f, type: 'discount' }))} />
                    Discount
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setPanelOpen(false)} className="flex items-center gap-1.5 border text-gray-600 dark:text-white/60 text-sm font-medium px-4 py-2 rounded-lg">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="panel-glass rounded-2xl">
          <div className="flex items-center justify-end px-5 py-4 border-b">
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Price Preset
            </button>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3">
            <div className="text-sm text-gray-600 dark:text-white/60">Show entries</div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
              Search:
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }} className="border rounded-lg px-3 py-2 text-sm w-56" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Pricing Name</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Percentage</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Preset Type</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : pagePresets.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">No pricing presets match this search.</td></tr>
                ) : pagePresets.map(p => (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="Edit" onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        {p.active ? (
                          <button title="Deactivate" onClick={() => handleToggleStatus(p)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button title="Activate" onClick={() => handleToggleStatus(p)} className="w-8 h-8 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        <button title="Delete" onClick={() => handleDelete(p)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{p.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.percentage}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.type}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${p.active ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t flex-wrap gap-3">
            <div className="text-sm text-gray-400 dark:text-white/40">Showing {presets.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, presets.length)} of {presets.length} entries</div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="text-sm px-3 py-2 rounded border dark:border-white/10 text-gray-600 dark:text-white/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5">Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`text-sm px-3 py-2 rounded border dark:border-white/10 ${p === page ? 'bg-brand-800 text-white border-brand-800' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/10'}`}>{p}</button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="text-sm px-3 py-2 rounded border dark:border-white/10 text-gray-600 dark:text-white/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
