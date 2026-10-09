import { useState, useEffect } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface ShipmentIssue {
  id: string; title: string; active: boolean; updatedAt: string;
}

const PAGE_SIZE = 10;

export default function AdminShippingPresets() {
  const { confirmDelete } = useDeleteGuard();
  const [issues, setIssues] = useState<ShipmentIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/presets/shipment-issues', { params: { search: search || undefined } })
      .then(r => setIssues(r.data.issues))
      .catch(() => showToast('Failed to load shipment issues'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setTitle(''); setActive(true); setFormError(''); setPanelOpen(true); };
  const openEdit = (i: ShipmentIssue) => { setEditingId(i.id); setTitle(i.title); setActive(i.active); setFormError(''); setPanelOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) await api.put(`/presets/shipment-issues/${editingId}`, { title, active });
      else await api.post('/presets/shipment-issues', { title, active });
      showToast(editingId ? 'Preset updated' : 'Preset added');
      setPanelOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (i: ShipmentIssue) => {
    if (!(await confirmDelete(`Delete shipment issue preset "${i.title}"?`))) return;
    try {
      await api.delete(`/presets/shipment-issues/${i.id}`);
      showToast('Preset removed');
      load();
    } catch {
      showToast('Failed to remove preset');
    }
  };

  const totalPages = Math.max(1, Math.ceil(issues.length / PAGE_SIZE));
  const pageIssues = issues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="p-6 space-y-5">
        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Shipping Presets <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">- Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-5 max-w-xl">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Title</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80">
                <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
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
              <Plus className="w-4 h-4" /> Add Shipment Issue
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
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : pageIssues.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-16 text-gray-400 dark:text-white/40">No shipment issue presets match this search.</td></tr>
                ) : pageIssues.map(i => (
                  <tr key={i.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="Edit" onClick={() => openEdit(i)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button title="Delete" onClick={() => handleDelete(i)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{i.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${i.active ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {i.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t flex-wrap gap-3">
            <div className="text-sm text-gray-400 dark:text-white/40">Showing {issues.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, issues.length)} of {issues.length} entries</div>
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
