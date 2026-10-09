import { useState, useEffect } from 'react';
import { Plus, Minus, X, Copy, Check, Bell, Clock, Play } from 'lucide-react';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface NotificationPreset {
  id: string; title: string; message: string; active: boolean; updatedAt: string;
}

interface AutomationSettings {
  id: string;
  outstandingEnabled: boolean;
  outstandingReminderDays: number;
  storageFeeEnabled: boolean;
  storageFeeDays: number;
}

const PAGE_SIZE = 10;

export default function AdminNotifications() {
  const { confirmDelete } = useDeleteGuard();
  const [notifications, setNotifications] = useState<NotificationPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  useEffect(() => {
    api.get('/automation').then(r => setAutomation(r.data)).catch(() => { /* not seeded yet locally */ });
  }, []);

  const saveAutomation = async (next: AutomationSettings) => {
    setAutomation(next);
    setSavingAutomation(true);
    try {
      const { data } = await api.put('/automation', next);
      setAutomation(data);
    } catch {
      showToast('Failed to save automation settings');
    } finally {
      setSavingAutomation(false);
    }
  };

  const runNow = async () => {
    setRunningNow(true);
    try {
      const { data } = await api.post('/automation/run-now');
      showToast(`Sent ${data.outstanding.sent} outstanding + ${data.storageFee.sent} storage-fee reminder(s)`);
    } catch {
      showToast('Failed to run reminders — check SMTP settings in .env');
    } finally {
      setRunningNow(false);
    }
  };

  const load = () => {
    setLoading(true);
    api.get('/presets/notifications', { params: { search: search || undefined } })
      .then(r => setNotifications(r.data.notifications))
      .catch(() => showToast('Failed to load notification presets'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setTitle(''); setMessage(''); setActive(true); setFormError(''); setPanelOpen(true); };
  const openEdit = (n: NotificationPreset) => { setEditingId(n.id); setTitle(n.title); setMessage(n.message); setActive(n.active); setFormError(''); setPanelOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) await api.put(`/presets/notifications/${editingId}`, { title, message, active });
      else await api.post('/presets/notifications', { title, message, active });
      showToast(editingId ? 'Preset updated' : 'Preset added');
      setPanelOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (n: NotificationPreset) => {
    if (!(await confirmDelete(`Delete notification preset "${n.title}"?`))) return;
    try {
      await api.delete(`/presets/notifications/${n.id}`);
      showToast('Preset removed');
      load();
    } catch {
      showToast('Failed to remove preset');
    }
  };

  const handleCopy = async (n: NotificationPreset) => {
    try {
      await navigator.clipboard.writeText(n.message);
      setCopiedId(n.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      showToast('Failed to copy to clipboard');
    }
  };

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const pageNotifications = notifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="p-6 space-y-5">
        {automation && (
          <div className="panel-glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400 dark:text-white/40" /> Automated Reminders</h2>
              <button onClick={runNow} disabled={runningNow} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50">
                <Play className="w-3.5 h-3.5" /> {runningNow ? 'Running…' : 'Run now'}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-white/40 -mt-2">Runs automatically once a day. Sending real emails requires SMTP credentials in the backend .env — without them, sends are logged to the server console instead.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80">
                  <input type="checkbox" checked={automation.outstandingEnabled} onChange={e => saveAutomation({ ...automation, outstandingEnabled: e.target.checked })} />
                  Outstanding shipment reminder
                </label>
                <p className="text-xs text-gray-500 dark:text-white/50">Email the customer when a shipment has sat at "Ready For Pick Up" for:</p>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={automation.outstandingReminderDays} onChange={e => saveAutomation({ ...automation, outstandingReminderDays: parseInt(e.target.value) || 1 })} className="w-20 border rounded-lg px-2 py-2 text-sm text-right" />
                  <span className="text-xs text-gray-500 dark:text-white/50">days</span>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80">
                  <input type="checkbox" checked={automation.storageFeeEnabled} onChange={e => saveAutomation({ ...automation, storageFeeEnabled: e.target.checked })} />
                  Storage fee notice
                </label>
                <p className="text-xs text-gray-500 dark:text-white/50">Email the Shipping Terms &amp; Storage Policy once a shipment has been ready for:</p>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={automation.storageFeeDays} onChange={e => saveAutomation({ ...automation, storageFeeDays: parseInt(e.target.value) || 1 })} className="w-20 border rounded-lg px-2 py-2 text-sm text-right" />
                  <span className="text-xs text-gray-500 dark:text-white/50">business days</span>
                </div>
              </div>
            </div>
            {savingAutomation && <p className="text-xs text-gray-400 dark:text-white/40">Saving…</p>}
          </div>
        )}

        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Bell className="w-4 h-4 text-gray-400 dark:text-white/40" /> Notification Presets <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">- Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-5 max-w-2xl">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Title</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Message</label>
                <textarea required rows={10} value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono resize-y" />
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
              <Plus className="w-4 h-4" /> Add Notification Preset
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
                  <th className="px-4 py-3 font-semibold">Preview</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : pageNotifications.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-16 text-gray-400 dark:text-white/40">No notification presets match this search.</td></tr>
                ) : pageNotifications.map(n => (
                  <tr key={n.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="Edit" onClick={() => openEdit(n)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button title="Copy message" onClick={() => handleCopy(n)} className="w-8 h-8 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/25 flex items-center justify-center transition-colors">
                          {copiedId === n.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button title="Delete" onClick={() => handleDelete(n)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium max-w-[220px]">{n.title}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/50 max-w-md">
                      <p className="line-clamp-2 whitespace-pre-line">{n.message}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${n.active ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {n.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t flex-wrap gap-3">
            <div className="text-sm text-gray-400 dark:text-white/40">Showing {notifications.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, notifications.length)} of {notifications.length} entries</div>
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
