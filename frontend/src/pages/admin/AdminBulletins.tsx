import { useState, useEffect } from 'react';
import { Plus, Minus, CheckCircle2, XCircle } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface Bulletin {
  id: string; title: string; message: string; status: string; updatedAt: string;
}

const EMPTY_FORM = { title: '', message: '' };

export default function AdminBulletins() {
  const { confirmDelete } = useDeleteGuard();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/bulletins', { params: { search: search || undefined } })
      .then(r => setBulletins(r.data.bulletins))
      .catch(() => showToast('Failed to load bulletins'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(''); setPanelOpen(true); };
  const openEdit = (b: Bulletin) => { setEditingId(b.id); setForm({ title: b.title, message: b.message }); setFormError(''); setPanelOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) await api.put(`/bulletins/${editingId}`, form);
      else await api.post('/bulletins', form);
      showToast(editingId ? 'Bulletin updated' : 'Bulletin added');
      setPanelOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save bulletin');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (b: Bulletin) => {
    try {
      await api.patch(`/bulletins/${b.id}/status`);
      showToast(b.status === 'ACTIVE' ? 'Bulletin deactivated' : 'Bulletin activated');
      load();
    } catch {
      showToast('Failed to update status');
    }
  };

  const handleDelete = async (b: Bulletin) => {
    if (!(await confirmDelete(`Delete bulletin "${b.title}"?`))) return;
    try {
      await api.delete(`/bulletins/${b.id}`);
      showToast('Bulletin removed');
      load();
    } catch {
      showToast('Failed to remove bulletin');
    }
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulletins <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Bulletins Management</span></div>
      </div>

      <div className="p-6 space-y-5">
        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Bulletins <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-4">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Title</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Message</label>
                <textarea required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setPanelOpen(false)} className="text-sm text-gray-500 dark:text-white/50 px-4 py-2 border rounded-lg">Cancel</button>
              </div>
            </form>
          )}
        </div>

        <div className="panel-glass rounded-2xl">
          <div className="flex items-center justify-end px-5 py-4 border-b">
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Bulletin
            </button>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3">
            <div className="text-sm text-gray-600 dark:text-white/60">Show entries</div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
              Search:
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load(); }} className="border rounded-lg px-3 py-2 text-sm w-56" />
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
                ) : bulletins.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">No bulletins match this search.</td></tr>
                ) : bulletins.map(b => (
                  <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="Edit" onClick={() => openEdit(b)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button title="Delete" onClick={() => handleDelete(b)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[220px]">{b.title}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-white/60 max-w-[520px]">{b.message}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(b.updatedAt).toLocaleString('sv-SE').slice(0, 19)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button title={b.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} onClick={() => handleToggleStatus(b)} className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded ${b.status === 'ACTIVE' ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {b.status === 'ACTIVE' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {b.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 text-sm text-gray-400 dark:text-white/40 border-t">Showing 1 to {bulletins.length} of {bulletins.length} entries</div>
        </div>
      </div>
    </div>
  );
}
