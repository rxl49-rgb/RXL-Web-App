import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, X, Check, Truck } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface Courier {
  id: string;
  name: string;
  logoUrl: string | null;
  active: boolean;
  updatedAt: string;
}

export default function AdminCouriers() {
  const { confirmDelete } = useDeleteGuard();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/couriers/admin/all')
      .then(r => setCouriers(r.data))
      .catch(() => showToast('Failed to load couriers'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = couriers.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  const resetForm = () => {
    setName('');
    setLogoFile(null); setLogoPreview(null); setExistingLogoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAdd = () => { setEditingId(null); resetForm(); setFormError(''); setPanelOpen(true); };
  const openEdit = (c: Courier) => {
    setEditingId(c.id);
    setName(c.name);
    setLogoFile(null); setLogoPreview(null); setExistingLogoUrl(c.logoUrl || null);
    setFormError('');
    setPanelOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null); setLogoPreview(null); setExistingLogoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormError('Courier name is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      if (logoFile) fd.append('logo', logoFile);

      if (editingId) await api.put(`/couriers/${editingId}`, fd);
      else await api.post('/couriers', fd);

      showToast(editingId ? 'Courier updated' : 'Courier added');
      setPanelOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save courier');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (c: Courier) => {
    try {
      await api.patch(`/couriers/${c.id}/status`);
      showToast(c.active ? 'Courier deactivated' : 'Courier activated');
      load();
    } catch {
      showToast('Failed to update status');
    }
  };

  const handleDelete = async (c: Courier) => {
    if (!(await confirmDelete(`Permanently delete ${c.name}? This cannot be undone.`))) return;
    try {
      await api.delete(`/couriers/${c.id}`);
      showToast('Courier deleted');
      load();
    } catch {
      showToast('Failed to delete courier');
    }
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Couriers <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Couriers</span></div>
      </div>

      <div className="p-6 space-y-5">
        <p className="text-sm text-gray-500 dark:text-white/50 -mt-1">
          Couriers listed here appear with their name and logo icon anywhere a shipment's tracking info is shown, on both the admin and customer websites.
        </p>

        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Courier <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-5 max-w-md">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Courier Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FedEx" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Logo</label>
                <input ref={fileInputRef} type="file" accept="image/gif,image/jpeg,image/png,image/webp" onChange={handleFileChange} className="text-sm dark:text-white/60" />
                <p className="text-xs text-gray-400 dark:text-white/40 mt-1">
                  Must be .gif, .jpg, .jpeg, .png or .webp, up to 3MB. A transparent-background PNG/WebP looks best.
                  {(logoPreview || existingLogoUrl) && (
                    <button type="button" onClick={handleRemoveLogo} className="ml-2 text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 text-xs font-semibold px-2 py-0.5 rounded transition-colors">remove</button>
                  )}
                </p>
                {(logoPreview || existingLogoUrl) && (
                  <div className="mt-3 w-20 h-20 rounded-xl icon-glass flex items-center justify-center overflow-hidden p-2">
                    <img src={logoPreview || existingLogoUrl || ''} alt="Courier logo preview" className="w-full h-full object-contain" />
                  </div>
                )}
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
              Search:
              <input value={search} onChange={e => setSearch(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-56 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
            </div>
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Courier
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Logo</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-16 text-gray-400 dark:text-white/40">No couriers match this search.</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 w-8">
                        <button title="Edit" onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        {c.active ? (
                          <button title="Deactivate" onClick={() => handleToggleStatus(c)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button title="Activate" onClick={() => handleToggleStatus(c)} className="w-8 h-8 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        <button title="Delete" onClick={() => handleDelete(c)} className="w-8 h-8 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-lg icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5">
                        {c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="w-full h-full object-contain" /> : <Truck className="w-4 h-4 text-brand-700 dark:text-accent-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{c.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${c.active ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
