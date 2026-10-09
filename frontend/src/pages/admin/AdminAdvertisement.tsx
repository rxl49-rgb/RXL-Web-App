import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, X, Check } from 'lucide-react';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';

interface Advertisement {
  id: string; title: string | null; message: string | null; imageUrl: string | null; status: string; updatedAt: string;
}

const PAGE_SIZE = 10;

export default function AdminAdvertisement() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/advertisements', { params: { search: search || undefined } })
      .then(r => setAds(r.data.advertisements))
      .catch(() => showToast('Failed to load advertisements'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setTitle(''); setMessage(''); setImageFile(null); setImagePreview(null); setExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAdd = () => { setEditingId(null); resetForm(); setFormError(''); setPanelOpen(true); };
  const openEdit = (a: Advertisement) => {
    setEditingId(a.id);
    setTitle(a.title || '');
    setMessage(a.message || '');
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(a.imageUrl || null);
    setFormError('');
    setPanelOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('message', message);
      if (imageFile) formData.append('image', imageFile);

      if (editingId) await api.put(`/advertisements/${editingId}`, formData);
      else await api.post('/advertisements', formData);

      showToast(editingId ? 'Advertisement updated' : 'Advertisement added');
      setPanelOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save advertisement');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (a: Advertisement) => {
    try {
      await api.patch(`/advertisements/${a.id}/status`);
      showToast(a.status === 'ACTIVE' ? 'Advertisement deactivated' : 'Advertisement activated');
      load();
    } catch {
      showToast('Failed to update status');
    }
  };

  const totalPages = Math.max(1, Math.ceil(ads.length / PAGE_SIZE));
  const pageAds = ads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advertisement <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Advertisement Management</span></div>
      </div>

      <div className="p-6 space-y-5">
        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Advertisement <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-5 max-w-2xl">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Attach Image</label>
                <input ref={fileInputRef} type="file" accept="image/gif,image/jpeg,image/png" onChange={handleFileChange} className="text-sm" />
                <p className="text-xs text-gray-400 dark:text-white/40 mt-1">
                  Photo must be .gif, .jpg, .jpeg or .png and must not be larger than 3MB
                  {(imagePreview || existingImageUrl) && (
                    <button type="button" onClick={handleRemoveImage} className="ml-2 text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 text-xs font-semibold px-2 py-0.5 rounded transition-colors">remove</button>
                  )}
                </p>
                {(imagePreview || existingImageUrl) && (
                  <img
                    src={imagePreview || existingImageUrl || ''}
                    alt="Advertisement preview"
                    className="mt-3 w-32 h-32 object-cover rounded-lg border"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Message</label>
                <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
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
          <div className="flex items-center justify-end px-5 py-4 border-b">
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Advertisement
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
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Title</th>
                  <th className="px-4 py-3 font-semibold">Message</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Last Updated</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : pageAds.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">No advertisements match this search.</td></tr>
                ) : pageAds.map(a => (
                  <tr key={a.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 w-8">
                        <button title="Edit" onClick={() => openEdit(a)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        {a.status === 'ACTIVE' ? (
                          <button title="Deactivate" onClick={() => handleToggleStatus(a)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button title="Activate" onClick={() => handleToggleStatus(a)} className="w-8 h-8 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><Check className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[220px]">{a.title || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-white/60 max-w-[560px]">{a.message || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(a.updatedAt).toLocaleString('sv-SE').slice(0, 19)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${a.status === 'ACTIVE' ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {a.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t flex-wrap gap-3">
            <div className="text-sm text-gray-400 dark:text-white/40">Showing {ads.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, ads.length)} of {ads.length} entries</div>
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
