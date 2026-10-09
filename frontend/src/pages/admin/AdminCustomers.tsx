import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Copy, Download, FileDown, Smartphone, ChevronsUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, CheckCircle2, MonitorSmartphone, Upload, CreditCard, MoreHorizontal, Megaphone } from 'lucide-react';
import CheckIcon from '../../components/icons/CheckIcon';
import BlockIcon from '../../components/icons/BlockIcon';
import DeleteIcon from '../../components/icons/DeleteIcon';
import HistoryIcon from '../../components/icons/HistoryIcon';
import MegaphoneIcon from '../../components/icons/MegaphoneIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';
import ViewToggle, { useViewMode } from '../../components/admin/ViewToggle';

interface Customer {
  id: string;
  customerCode: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  aliasName: string | null;
  email: string;
  phone: string | null;
  phoneCarrier: string | null;
  trn: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  status: string;
  idType: string | null;
  idDocumentUrl: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

const COUNTRIES = ['Jamaica', 'United States', 'Canada', 'United Kingdom', 'Trinidad and Tobago', 'Other'];
const CARRIERS = ['Digicel', 'Flow', 'Other'];
const ID_TYPES = ["Driver's License", 'National ID (TRN card)', 'Passport', "Voter's ID"];

interface LoginEvent {
  id: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  createdAt: string;
}

interface LoginProfile {
  customer: Customer;
  logins: LoginEvent[];
  summary: { totalLogins: number; failedAttempts: number; lastLoginAt: string | null; lastActiveAt: string | null };
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  BLOCKED: 'bg-red-100 text-red-700',
  DELETED: 'bg-gray-100 text-gray-400',
  PENDING: 'bg-amber-100 text-amber-700',
};

const EMPTY_FORM = {
  firstName: '', lastName: '', aliasName: '', email: '', phone: '', phoneCarrier: 'Digicel',
  address: '', city: '', country: '', trn: '',
};
const LIMIT = 20;

export default function AdminCustomers() {
  const { confirmDelete } = useDeleteGuard();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [view, setView] = useViewMode('rxl_admin_customers_view');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [idZoomOpen, setIdZoomOpen] = useState(false);

  const [notifyOpen, setNotifyOpen] = useState<{ target: 'CUSTOMER_NUMBER' | 'NEW' | 'ACTIVE'; customer?: Customer } | null>(null);
  const [notifySubject, setNotifySubject] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyResult, setNotifyResult] = useState<string | null>(null);

  const [loginProfileOpen, setLoginProfileOpen] = useState(false);
  const [loginProfile, setLoginProfile] = useState<LoginProfile | null>(null);
  const [loginProfileLoading, setLoginProfileLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', {
        params: { search, status: statusFilter, page, limit: LIMIT, sortBy, sortDir },
      });
      setCustomers(data.customers);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      showToast('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); setSearch(searchInput); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-brand-600" /> : <ChevronDown className="w-3.5 h-3.5 text-brand-600" />;
  };

  const openAdd = () => { setEditingId(null); setEditingCustomer(null); setForm(EMPTY_FORM); setIdFile(null); setFormOpen(true); };
  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setEditingCustomer(c);
    setForm({
      firstName: c.firstName || '', lastName: c.lastName || '', aliasName: c.aliasName || '', email: c.email,
      phone: c.phone || '', phoneCarrier: c.phoneCarrier || 'Digicel',
      address: c.address || '', city: c.city || '', country: c.country || '', trn: c.trn || '',
    });
    setIdType(c.idType || ID_TYPES[0]);
    setIdFile(null);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const { email, ...editable } = form;
        await api.put(`/customers/${editingId}`, editable);
        showToast('Customer updated');
        load();
      } else {
        const { data } = await api.post('/customers', form);
        showToast(`Customer added — temp password: ${data.tempPassword}`);
        setFormOpen(false);
        load();
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadId = async () => {
    if (!editingId || !idFile) return;
    setUploadingId(true);
    try {
      const fd = new FormData();
      fd.append('document', idFile);
      fd.append('idType', idType);
      const { data } = await api.post(`/customers/${editingId}/identification`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditingCustomer(data);
      setIdFile(null);
      showToast('Identification document uploaded');
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingId(false);
    }
  };

  const handleStatus = async (c: Customer, status: string) => {
    try {
      await api.patch(`/customers/${c.id}/status`, { status });
      showToast(`${c.name} marked ${status.toLowerCase()}`);
      load();
    } catch {
      showToast('Update failed');
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!(await confirmDelete(`Remove ${c.name} from the customer list?`))) return;
    try {
      await api.delete(`/customers/${c.id}`);
      showToast('Customer removed');
      load();
    } catch {
      showToast('Delete failed');
    }
  };

  const openNotify = (target: 'CUSTOMER_NUMBER' | 'NEW' | 'ACTIVE', customer?: Customer) => {
    setNotifySubject('');
    setNotifyMessage('');
    setNotifyResult(null);
    setNotifyOpen({ target, customer });
  };

  const sendNotify = async () => {
    if (!notifyOpen) return;
    try {
      const { data } = await api.post('/customers/notify', {
        target: notifyOpen.target,
        customerCode: notifyOpen.customer?.customerCode || undefined,
        subject: notifySubject,
        message: notifyMessage,
      });
      setNotifyResult(`Simulated send to ${data.recipientCount} customer${data.recipientCount === 1 ? '' : 's'}. No email/SMS provider is connected yet, so nothing actually left the server.`);
    } catch (err: any) {
      setNotifyResult(err?.response?.data?.error || 'Notify failed');
    }
  };

  const handleExportCsv = async () => {
    const { data } = await api.get('/customers/export', { params: { search, status: statusFilter }, responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = customers.map(c => `<tr><td>${c.customerCode || ''}</td><td>${c.name}</td><td>${c.email}</td><td>${c.phone || ''}</td><td>${c.trn || ''}</td><td>${c.city || ''}</td><td>${c.country || ''}</td><td>${c.status}</td></tr>`).join('');
    win.document.write(`<html><head><title>Customers</title><style>body{font-family:sans-serif;font-size:12px} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ccc;padding:6px;text-align:left}</style></head><body><h2>RXL Logistics — Customers</h2><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>TRN</th><th>City</th><th>Country</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleCopy = () => {
    const text = customers.map(c => [c.customerCode, c.name, c.email, c.phone, c.trn, c.address, c.city, c.country, c.lastActiveAt || '', c.status].join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    showToast('Copied visible rows to clipboard');
  };

  const openLoginProfile = async (c: Customer) => {
    setLoginProfile(null);
    setLoginProfileOpen(true);
    setLoginProfileLoading(true);
    try {
      const { data } = await api.get(`/customers/${c.id}/logins`);
      setLoginProfile(data);
    } catch {
      showToast('Failed to load login profile');
      setLoginProfileOpen(false);
    } finally {
      setLoginProfileLoading(false);
    }
  };

  const deviceLabel = (ua: string | null) => {
    if (!ua) return 'Unknown device';
    if (/iphone|android|mobile/i.test(ua)) return 'Mobile';
    if (/macintosh|mac os/i.test(ua)) return 'Mac';
    if (/windows/i.test(ua)) return 'Windows';
    return 'Desktop';
  };

  const printOne = (c: Customer) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${c.name}</title><style>body{font-family:sans-serif;padding:24px} h2{margin-bottom:4px} p{margin:4px 0;font-size:13px}</style></head><body><h2>${c.name}</h2><p>Customer ID: ${c.customerCode}</p><p>Email: ${c.email}</p><p>Phone: ${c.phone || '—'}</p><p>TRN: ${c.trn || '—'}</p><p>Address: ${c.address || '—'}, ${c.city || ''} ${c.country || ''}</p><p>Status: ${c.status}</p><p>Last active: ${c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleString() : 'Never'}</p></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);

  const columns: { key: string; label: string }[] = [
    { key: 'customerCode', label: 'Customer ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
  ];

  return (
    <div className="pb-16">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>
      )}

      {/* Header */}
      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">All Customers</span></h1>
        </div>
        <div className="text-sm text-gray-400 dark:text-white/40">Home <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Customers</span></div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Add/Update collapsible */}
        <div className="panel-glass rounded-xl">
          <button onClick={() => (formOpen ? setFormOpen(false) : openAdd())} className="w-full flex items-center justify-between px-5 py-2 border-b-2 border-accent-500">
            <span className="font-semibold text-gray-800 dark:text-white">Customer Information <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></span>
            <Plus className={`w-4 h-4 text-gray-500 dark:text-white/50 transition-transform ${formOpen ? 'rotate-45' : ''}`} />
          </button>
          {formOpen && (
            <form onSubmit={handleSave} className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
              {/* Left column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Username</label>
                  <input disabled value={form.email} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">First Name</label>
                    <input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Last Name</label>
                    <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Alias Name</label>
                  <input value={form.aliasName} onChange={e => setForm(f => ({ ...f, aliasName: e.target.value }))} placeholder="Alias Name"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Email</label>
                  <input required={!editingId} disabled={!!editingId} type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${editingId ? 'bg-gray-50 dark:bg-white/10 text-gray-500 dark:text-white/50' : 'focus:outline-none focus:ring-2 focus:ring-brand-500'}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Phone (numbers only)</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, '') }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Address</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">City</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Country</label>
                  <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select One</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">TRN</label>
                  <input value={form.trn} onChange={e => setForm(f => ({ ...f, trn: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                {editingCustomer && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Status</label>
                    <input disabled value={editingCustomer.status} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/50 capitalize" />
                  </div>
                )}

                {editingId && (
                  <div className="border-2 border-accent-300 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/80"><CreditCard className="w-4 h-4" /> Identification Type:</div>
                    <select value={idType} onChange={e => setIdType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="text-xs font-medium text-gray-500 dark:text-white/50">Upload Identification Document:</div>
                    <input type="file" accept="image/gif,image/jpeg,image/png" onChange={e => setIdFile(e.target.files?.[0] || null)}
                      className="text-sm w-full" />
                    <p className="text-[11px] text-gray-400 dark:text-white/40">Photo must be .gif, .jpg, .jpeg or .png and must not be larger than 3MB</p>
                    <button type="button" onClick={handleUploadId} disabled={!idFile || uploadingId}
                      className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors disabled:opacity-40 text-white text-xs font-semibold px-3 py-2 rounded-xl">
                      <Upload className="w-3.5 h-3.5" /> {uploadingId ? 'Uploading…' : 'Upload document'}
                    </button>

                    {editingCustomer?.idDocumentUrl && (
                      <div className="pt-2">
                        <div className="bg-gray-100 dark:bg-white/10 text-xs font-semibold text-gray-600 dark:text-white/60 px-3 py-1.5 rounded-t-lg">{editingCustomer.idType || 'Identification'}</div>
                        <button type="button" onClick={() => setIdZoomOpen(true)} className="block mx-auto cursor-zoom-in">
                          <img src={editingCustomer.idDocumentUrl} alt="Identification document" className="max-w-[220px] object-contain rounded-b-lg border" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-full flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : editingId ? 'Update customer' : 'Add customer'}
                </button>
                <button type="button" onClick={() => setFormOpen(false)} className="text-sm text-gray-500 dark:text-white/50 px-4 py-2">Cancel</button>
              </div>
            </form>
          )}
        </div>

        {/* Status filter + notify actions */}
        <div className="panel-glass rounded-xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600 dark:text-white/60">CustomerStatus:</span>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg text-sm px-3 py-2">
            <option value="ALL">ALL</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
          <div className="flex-1" />
          <button onClick={() => openNotify('CUSTOMER_NUMBER')} className="flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Megaphone className="w-4 h-4" /> Notify customers with customer #
          </button>
          <button onClick={() => openNotify('NEW')} className="flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Megaphone className="w-4 h-4" /> Notify new customers
          </button>
          <button onClick={() => openNotify('ACTIVE')} className="flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Megaphone className="w-4 h-4" /> Notify active customers
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Add customer
          </button>
        </div>

        {/* Table */}
        <div className="panel-glass rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <div className="flex gap-2 items-center">
              <button onClick={handleCopy} className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-white/10"><Copy className="w-3.5 h-3.5" /> Copy</button>
              <button onClick={handleExportCsv} className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-white/10"><Download className="w-3.5 h-3.5" /> CSV</button>
              <button onClick={handleExportPdf} className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-white/10"><FileDown className="w-3.5 h-3.5" /> PDF</button>
              <ViewToggle view={view} onChange={setView} />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search…" className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          {view === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {loading ? (
                <div className="col-span-full text-center py-16 text-gray-400 dark:text-white/40">Loading…</div>
              ) : customers.length === 0 ? (
                <div className="col-span-full text-center py-16 text-gray-400 dark:text-white/40">No customers match this search.</div>
              ) : customers.map(c => (
                <div key={c.id} className="panel-glass rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 dark:text-white/40 truncate">{c.customerCode}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLE[c.status] || 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'}`}>{c.status}</span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-white/50 space-y-0.5">
                    <p className="truncate text-brand-700">{c.email}</p>
                    <p>{c.phone || '—'}</p>
                    <p>{[c.city, c.country].filter(Boolean).join(', ') || '—'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100 dark:border-white/10">
                    <button title="Edit" onClick={() => openEdit(c)} className="w-9 h-9 rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-[24px] h-[24px]" /></button>
                    {c.status !== 'ACTIVE' && (
                      <button title="Activate customer" onClick={() => handleStatus(c, 'ACTIVE')} className="w-9 h-9 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><CheckIcon className="w-[24px] h-[24px]" /></button>
                    )}
                    <button title="Remove" onClick={() => handleDelete(c)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                    <button title="Notify" onClick={() => openNotify('CUSTOMER_NUMBER', c)} className="w-9 h-9 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/25 flex items-center justify-center transition-colors"><MegaphoneIcon className="w-[24px] h-[24px]" /></button>
                    <button title="Login profile" onClick={() => openLoginProfile(c)} className="w-9 h-9 rounded-lg text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/25 flex items-center justify-center transition-colors"><HistoryIcon className="w-[24px] h-[24px]" /></button>
                    <button title={c.status === 'BLOCKED' ? 'Unblock' : 'Block'} onClick={() => handleStatus(c, c.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED')} className="w-9 h-9 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 flex items-center justify-center transition-colors"><BlockIcon className="w-[24px] h-[24px]" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Actions</th>
                  {columns.map(col => (
                    <th key={col.key} className="px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort(col.key)}>
                      <span className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Phone</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort('lastActiveAt')}>
                    <span className="flex items-center gap-1">Last Active <SortIcon col="lastActiveAt" /></span>
                  </th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">No customers match this search.</td></tr>
                ) : customers.map(c => (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3">
                      <div className="relative flex items-center gap-1">
                        <button title="Edit" onClick={() => openEdit(c)} className="w-9 h-9 rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-[24px] h-[24px]" /></button>
                        <button title="More actions" onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)} className="w-7 h-7 rounded-lg text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                        {openMenuId === c.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute left-8 top-full mt-1 z-50 w-48 panel-glass rounded-xl shadow-lg overflow-hidden py-1 bg-white dark:bg-[#1c1c1c]">
                              {c.status !== 'ACTIVE' && (
                                <button onClick={() => { handleStatus(c, 'ACTIVE'); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"><CheckIcon className="w-4 h-4" /> Activate customer</button>
                              )}
                              <button onClick={() => { openNotify('CUSTOMER_NUMBER', c); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"><MegaphoneIcon className="w-3.5 h-3.5" /> Notify</button>
                              <button onClick={() => { openNotify('CUSTOMER_NUMBER', c); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"><Smartphone className="w-3.5 h-3.5" /> Simulate SMS</button>
                              <button onClick={() => { printOne(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-green-600 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors">Print summary</button>
                              <button onClick={() => { openLoginProfile(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"><HistoryIcon className="w-3.5 h-3.5" /> Login profile</button>
                              <button onClick={() => { handleStatus(c, c.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><BlockIcon className="w-3.5 h-3.5" /> {c.status === 'BLOCKED' ? 'Unblock' : 'Block'}</button>
                              <button onClick={() => { handleDelete(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"><DeleteIcon className="w-3.5 h-3.5" /> Remove</button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{c.customerCode}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-brand-700">{c.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.phone}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-white/50">{c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[c.status] || 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t dark:border-white/10 text-sm text-gray-500 dark:text-white/50">
            <span>Showing {from} to {to} of {total} entries</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="flex items-center gap-1 px-3 py-2 border dark:border-white/10 rounded-lg text-gray-600 dark:text-white/60 disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /> Previous</button>
              {Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - page) <= 1).reduce<(number | string)[]>((acc, n, i, arr) => {
                if (i > 0 && typeof arr[i - 1] === 'number' && (n as number) - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(n);
                return acc;
              }, []).map((n, i) => typeof n === 'number' ? (
                <button key={i} onClick={() => setPage(n)} className={`px-3 py-2 rounded-lg border dark:border-white/10 ${n === page ? 'bg-brand-700 text-white border-brand-700' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/10'}`}>{n}</button>
              ) : <span key={i} className="px-2 text-gray-400 dark:text-white/40">{n}</span>)}
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="flex items-center gap-1 px-3 py-2 border dark:border-white/10 rounded-lg text-gray-600 dark:text-white/60 disabled:opacity-40">Next <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Notify modal */}
      {notifyOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">
                {notifyOpen.customer ? `Notify ${notifyOpen.customer.name}` : notifyOpen.target === 'NEW' ? 'Notify new customers' : notifyOpen.target === 'ACTIVE' ? 'Notify active customers' : 'Notify customers with customer #'}
              </h3>
              <button onClick={() => setNotifyOpen(null)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            {!notifyResult ? (
              <div className="space-y-3">
                {notifyOpen.target === 'CUSTOMER_NUMBER' && !notifyOpen.customer && (
                  <p className="text-xs text-gray-500 dark:text-white/50">Sends to whichever customer number you type in the subject/message below via the API — pass a specific code from the table by using its row action instead.</p>
                )}
                <input value={notifySubject} onChange={e => setNotifySubject(e.target.value)} placeholder="Subject" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} placeholder="Message" rows={4} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                <button onClick={sendNotify} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm">Send</button>
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-gray-400 dark:text-white/40 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-white/60">{notifyResult}</p>
                <button onClick={() => setNotifyOpen(null)} className="mt-4 text-sm text-brand-700 font-medium">Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Login profile modal */}
      {idZoomOpen && editingCustomer?.idDocumentUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center px-4 py-8"
          onClick={() => setIdZoomOpen(false)}
        >
          <button
            onClick={() => setIdZoomOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={editingCustomer.idDocumentUrl}
            alt="Identification document"
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-xl cursor-default"
          />
        </div>
      )}

      {loginProfileOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-gray-400 dark:text-white/40" />
                {loginProfile ? `${loginProfile.customer.name} — login profile` : 'Login profile'}
              </h3>
              <button onClick={() => setLoginProfileOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>

            {loginProfileLoading ? (
              <div className="text-center py-10 text-gray-400 dark:text-white/40 text-sm">Loading…</div>
            ) : !loginProfile ? (
              <div className="text-center py-10 text-gray-400 dark:text-white/40 text-sm">Couldn't load login history.</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{loginProfile.summary.totalLogins}</div>
                    <div className="text-xs text-gray-500 dark:text-white/50">Successful logins</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{loginProfile.summary.failedAttempts}</div>
                    <div className="text-xs text-gray-500 dark:text-white/50">Failed attempts</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{loginProfile.summary.lastLoginAt ? new Date(loginProfile.summary.lastLoginAt).toLocaleDateString() : 'Never'}</div>
                    <div className="text-xs text-gray-500 dark:text-white/50">Last login</div>
                  </div>
                </div>

                {loginProfile.logins.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-white/40 text-center py-6">No login activity recorded yet for this customer.</p>
                ) : (
                  <div className="space-y-2">
                    {loginProfile.logins.map(l => (
                      <div key={l.id} className="flex items-center gap-3 border dark:border-white/10 rounded-xl px-3 py-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${l.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          <MonitorSmartphone className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{new Date(l.createdAt).toLocaleString()}</div>
                          <div className="text-xs text-gray-400 dark:text-white/40">{deviceLabel(l.userAgent)} · {l.ip || 'unknown IP'}</div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${l.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.success ? 'Success' : 'Failed'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
