import { useState, useEffect } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface MobileInfoEntry {
  id: string; title: string; message: string; status: string; updatedAt: string;
}

export default function AdminMobileInfo() {
  const { confirmDelete } = useDeleteGuard();
  const [entries, setEntries] = useState<MobileInfoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/mobile-info', { params: { search: search || undefined } })
      .then(r => setEntries(r.data.entries))
      .catch(() => showToast('Failed to load entries'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setTitle(''); setMessage(''); setActive(true); };

  const openPanel = () => {
    if (editingId === null && entries.length > 0) {
      // Default the update panel to the existing entry, matching the single "Update" workflow
      openEdit(entries[0]);
    } else {
      setPanelOpen(o => !o);
    }
  };

  const openEdit = (e: MobileInfoEntry) => {
    setEditingId(e.id);
    setTitle(e.title);
    setMessage(e.message);
    setActive(e.status === 'ACTIVE');
    setFormError('');
    setPanelOpen(true);
  };

  const openAddNew = () => {
    setEditingId(null);
    resetForm();
    setFormError('');
    setPanelOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { title, message, status: active ? 'ACTIVE' : 'INACTIVE' };
      if (editingId) await api.put(`/mobile-info/${editingId}`, payload);
      else await api.post('/mobile-info', payload);
      showToast('Saved');
      setPanelOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: MobileInfoEntry) => {
    if (!(await confirmDelete(`Delete "${e.title}"?`))) return;
    try {
      await api.delete(`/mobile-info/${e.id}`);
      showToast('Removed');
      load();
    } catch {
      showToast('Failed to remove');
    }
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mobile Information <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Mobile Information Management</span></div>
      </div>

      <div className="p-6 space-y-5">
        <div className="panel-glass rounded-2xl">
          <button onClick={openPanel} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Mobile Information <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">- Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-4">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Title</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Message (markdown)</label>
                <textarea required rows={18} value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-y font-mono" />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80">
                <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
                Active
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setPanelOpen(false)} className="text-sm text-gray-500 dark:text-white/50 px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {editingId && (
                  <button type="button" onClick={openAddNew} className="ml-auto text-sm text-brand-700 px-4 py-2">+ New entry instead</button>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="panel-glass rounded-2xl">
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
                ) : entries.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">No entries match this search.</td></tr>
                ) : entries.map(e => (
                  <tr key={e.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        <button title="Edit" onClick={() => openEdit(e)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button title="Delete" onClick={() => handleDelete(e)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{e.title}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-white/80 whitespace-pre-wrap max-w-[900px]">{e.message}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(e.updatedAt).toLocaleString('sv-SE').slice(0, 19)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${e.status === 'ACTIVE' ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {e.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 text-sm text-gray-400 dark:text-white/40 border-t">Showing 1 to {entries.length} of {entries.length} entries</div>
        </div>
      </div>
    </div>
  );
}
