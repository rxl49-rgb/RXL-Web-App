import { useState, useEffect, useMemo } from 'react';
import { Plane, Ship, Truck, Search, Plus, ClipboardList, X, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';

interface Event { id: string; location: string; description: string; timestamp: string }
interface Shipment {
  id: string;
  trackingNumber: string;
  type: string;
  status: string;
  origin: string;
  destination: string;
  weight: number | null;
  estimatedDelivery: string | null;
  user: { name: string; email: string } | null;
  events: Event[];
}

const STATUSES = ['PROCESSING', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED'];

const STATUS_STYLE: Record<string, string> = {
  PROCESSING: 'bg-gray-100 text-gray-600',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  CUSTOMS_CLEARANCE: 'bg-orange-100 text-orange-700',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  EXCEPTION: 'bg-red-100 text-red-700',
  RETURNED: 'bg-yellow-100 text-yellow-700',
};

const TypeIcon = (type: string) => (type === 'AIR' ? Plane : type === 'SEA' ? Ship : Truck);

const EMPTY_FORM = { trackingNumber: '', customerEmail: '', type: 'AIR', origin: '', destination: '', weight: '', dimensions: '', description: '', estimatedDelivery: '' };

export default function AdminShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [eventModal, setEventModal] = useState<Shipment | null>(null);
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  const [timelineModal, setTimelineModal] = useState<Shipment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/shipments').then(r => setShipments(r.data)).catch(() => showToast('Failed to load shipments')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return shipments.filter(s => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return s.trackingNumber.toLowerCase().includes(q) || s.origin.toLowerCase().includes(q) || s.destination.toLowerCase().includes(q) || s.user?.email.toLowerCase().includes(q) || s.user?.name.toLowerCase().includes(q);
    });
  }, [shipments, search, statusFilter]);

  const handleStatusChange = async (s: Shipment, status: string) => {
    try {
      await api.patch(`/shipments/${s.id}/status`, { status });
      showToast(`${s.trackingNumber} marked ${status.replace(/_/g, ' ').toLowerCase()}`);
      load();
    } catch {
      showToast('Update failed');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, weight: form.weight ? parseFloat(form.weight) : undefined, customerEmail: form.customerEmail || undefined };
      await api.post('/shipments', payload);
      showToast(`Shipment ${form.trackingNumber} created`);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to create shipment');
    } finally {
      setSaving(false);
    }
  };

  const openEventModal = (s: Shipment) => { setEventLocation(''); setEventDescription(''); setEventModal(s); };
  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventModal) return;
    try {
      await api.post(`/shipments/${eventModal.id}/events`, { location: eventLocation, description: eventDescription });
      showToast('Tracking event added');
      setEventModal(null);
      load();
    } catch {
      showToast('Failed to add event');
    }
  };

  const openTimeline = async (s: Shipment) => {
    try {
      const { data } = await api.get(`/shipments/${s.id}`);
      setTimelineModal(data);
    } catch {
      showToast('Failed to load shipment');
    }
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
        <button onClick={() => { setForm(EMPTY_FORM); setFormError(''); setFormOpen(true); }} className="flex items-center gap-2 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> New shipment
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg text-sm px-3 py-2">
            <option value="ALL">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracking #, route, customer…" className="pl-9 pr-3 py-2 border rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>

        <div className="panel-glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Tracking #</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Route</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Latest update</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400">No shipments match this search.</td></tr>
                ) : filtered.map(s => {
                  const Icon = TypeIcon(s.type);
                  const latest = s.events?.[0];
                  return (
                    <tr key={s.id} className="border-b last:border-b-0 hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{s.trackingNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{s.user ? <><div>{s.user.name}</div><div className="text-xs text-gray-400">{s.user.email}</div></> : <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-brand-700" />{s.type}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">{s.origin} → {s.destination}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs max-w-[220px] truncate">{latest ? `${latest.description} · ${new Date(latest.timestamp).toLocaleDateString()}` : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select value={s.status} onChange={e => handleStatusChange(s, e.target.value)} className={`text-xs font-semibold px-2 py-2 rounded-full border-0 ${STATUS_STYLE[s.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUSES.map(st => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button title="Add tracking event" onClick={() => openEventModal(s)} className="w-7 h-7 rounded bg-sky-500 hover:bg-sky-600 hover:shadow-glow-sky transition-shadow text-white flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                          <button title="View timeline" onClick={() => openTimeline(s)} className="w-7 h-7 rounded bg-brand-700 hover:bg-brand-800 text-white flex items-center justify-center"><ClipboardList className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create shipment modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">New shipment</h3>
              <button onClick={() => setFormOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Tracking number *</label>
                  <input required value={form.trackingNumber} onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    <option value="AIR">Air</option>
                    <option value="SEA">Sea</option>
                    <option value="GROUND">Ground</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Customer email (optional)</label>
                <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="Leave blank for an unassigned shipment" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Origin *</label>
                  <input required value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Destination *</label>
                  <input required value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Weight (kg)</label>
                  <input type="number" step="0.01" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Est. delivery</label>
                  <input type="date" value={form.estimatedDelivery} onChange={e => setForm(f => ({ ...f, estimatedDelivery: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Creating…' : 'Create shipment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add event modal */}
      {eventModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Add event — {eventModal.trackingNumber}</h3>
              <button onClick={() => setEventModal(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <form onSubmit={submitEvent} className="space-y-3">
              <input required value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="Location" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              <textarea required value={eventDescription} onChange={e => setEventDescription(e.target.value)} placeholder="What happened" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              <button type="submit" className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-2 rounded-lg text-sm">Add event</button>
            </form>
          </div>
        </div>
      )}

      {/* Timeline modal */}
      {timelineModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{timelineModal.trackingNumber}</h3>
              <button onClick={() => setTimelineModal(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            {timelineModal.events.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-white/40 text-center py-6">No events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {timelineModal.events.map(e => (
                  <div key={e.id} className="flex gap-3 border-t dark:border-white/10 first:border-t-0 pt-3 first:pt-0">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{e.description}</div>
                      <div className="text-xs text-gray-400 dark:text-white/40">{e.location} · {new Date(e.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
