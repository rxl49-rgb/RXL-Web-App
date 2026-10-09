import { useState, useEffect } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

type Tab = 'users' | 'roles';

interface StaffUser {
  id: string; name: string; email: string; phone: string | null; city: string | null;
  officeLocation: string | null; country: string | null; userType: string | null;
  status: string; lastActiveAt: string | null; createdAt: string;
}
interface RoleRow { id: string; name: string; description: string | null; userCount: number; updatedAt: string }

const EMPTY_USER_FORM = { name: '', email: '', phone: '', city: '', officeLocation: '', country: 'Jamaica', userType: '' };
const EMPTY_ROLE_FORM = { name: '', description: '' };

export default function AdminSettings() {
  const { confirmDelete } = useDeleteGuard();
  const [tab, setTab] = useState<Tab>('users');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Roles (shared for the UserType dropdown + Roles tab)
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const loadRoles = () => {
    api.get('/roles').then(r => setRoles(r.data.roles)).catch(() => showToast('Failed to load roles'));
  };
  useEffect(() => { loadRoles(); }, []);

  // Users tab state
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState('');

  const loadUsers = () => {
    setUsersLoading(true);
    api.get('/staff-users', { params: { search: userSearch || undefined } })
      .then(r => setUsers(r.data.users))
      .catch(() => showToast('Failed to load users'))
      .finally(() => setUsersLoading(false));
  };
  useEffect(() => { loadUsers(); }, []);

  const openAddUser = () => { setEditingUserId(null); setUserForm(EMPTY_USER_FORM); setUserFormError(''); setUserPanelOpen(true); };
  const openEditUser = (u: StaffUser) => {
    setEditingUserId(u.id);
    setUserForm({ name: u.name, email: u.email, phone: u.phone || '', city: u.city || '', officeLocation: u.officeLocation || '', country: u.country || 'Jamaica', userType: u.userType || '' });
    setUserFormError('');
    setUserPanelOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    setUserFormError('');
    try {
      if (editingUserId) {
        const { email, ...rest } = userForm;
        await api.put(`/staff-users/${editingUserId}`, rest);
        showToast('User updated');
      } else {
        await api.post('/staff-users', userForm);
        showToast('User added');
      }
      setUserPanelOpen(false);
      loadUsers();
      loadRoles();
    } catch (err: any) {
      setUserFormError(err?.response?.data?.error || 'Failed to save user');
    } finally {
      setSavingUser(false);
    }
  };

  const handleToggleSuspend = async (u: StaffUser) => {
    const nextStatus = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await api.patch(`/staff-users/${u.id}/status`, { status: nextStatus });
      showToast(nextStatus === 'SUSPENDED' ? `${u.name} suspended` : `${u.name} reactivated`);
      loadUsers();
    } catch {
      showToast('Failed to update status');
    }
  };

  // Roles tab state
  const [roleSearch, setRoleSearch] = useState('');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [savingRole, setSavingRole] = useState(false);
  const [roleFormError, setRoleFormError] = useState('');

  const filteredRoles = roles.filter(r => !roleSearch || r.name.toLowerCase().includes(roleSearch.toLowerCase()) || r.description?.toLowerCase().includes(roleSearch.toLowerCase()));

  const openAddRole = () => { setEditingRoleId(null); setRoleForm(EMPTY_ROLE_FORM); setRoleFormError(''); setRoleModalOpen(true); };
  const openEditRole = (r: RoleRow) => { setEditingRoleId(r.id); setRoleForm({ name: r.name, description: r.description || '' }); setRoleFormError(''); setRoleModalOpen(true); };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRole(true);
    setRoleFormError('');
    try {
      if (editingRoleId) await api.put(`/roles/${editingRoleId}`, roleForm);
      else await api.post('/roles', roleForm);
      showToast(editingRoleId ? 'Role updated' : 'Role added');
      setRoleModalOpen(false);
      loadRoles();
    } catch (err: any) {
      setRoleFormError(err?.response?.data?.error || 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (r: RoleRow) => {
    if (!(await confirmDelete(`Delete role "${r.name}"?`))) return;
    try {
      await api.delete(`/roles/${r.id}`);
      showToast('Role removed');
      loadRoles();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to remove role');
    }
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tab === 'users' ? 'User Management' : 'User Roles'}
          <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">{tab === 'users' ? 'All Users' : 'Management'}</span>
        </h1>
        <div className="text-sm text-gray-400 dark:text-white/40">
          Dashboard <span className="mx-1">/</span>
          <span className="text-gray-600 dark:text-white/60"> {tab === 'users' ? 'User Management' : 'User Roles Management'}</span>
        </div>
      </div>

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 flex gap-1">
        <button onClick={() => setTab('users')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'users' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>User Management</button>
        <button onClick={() => setTab('roles')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'roles' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>User Roles</button>
      </div>

      <div className="p-6 space-y-5">
        {tab === 'users' ? (
          <>
            <div className="panel-glass rounded-2xl">
              <button onClick={() => setUserPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
                <h2 className="font-semibold text-gray-900 dark:text-white">User Information <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></h2>
                {userPanelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
              </button>
              {userPanelOpen && (
                <form onSubmit={handleSaveUser} className="border-t p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userFormError && <div className="col-span-full bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{userFormError}</div>}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Name *</label>
                    <input required value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Email *</label>
                    <input required type="email" disabled={!!editingUserId} value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${editingUserId ? 'bg-gray-50 dark:bg-white/10 text-gray-500 dark:text-white/50' : ''}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Phone</label>
                    <input value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">City</label>
                    <input value={userForm.city} onChange={e => setUserForm(f => ({ ...f, city: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Location</label>
                    <input value={userForm.officeLocation} onChange={e => setUserForm(f => ({ ...f, officeLocation: e.target.value }))} placeholder="e.g. Ironshore" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Country</label>
                    <input value={userForm.country} onChange={e => setUserForm(f => ({ ...f, country: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">UserType *</label>
                    <select required value={userForm.userType} onChange={e => setUserForm(f => ({ ...f, userType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">Select One</option>
                      {roles.filter(r => r.name !== 'Customer').map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-full flex gap-2 pt-1">
                    <button type="submit" disabled={savingUser} className="bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                      {savingUser ? 'Saving…' : editingUserId ? 'Update user' : 'Add user'}
                    </button>
                    <button type="button" onClick={() => setUserPanelOpen(false)} className="text-sm text-gray-500 dark:text-white/50 px-4 py-2">Cancel</button>
                  </div>
                </form>
              )}
            </div>

            <div className="panel-glass rounded-2xl">
              <div className="flex items-center justify-end px-5 py-4 border-b">
                <button onClick={openAddUser} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" /> Add User
                </button>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3">
                <div className="text-sm text-gray-600 dark:text-white/60">Show entries</div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
                  Search:
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') loadUsers(); }} className="border rounded-lg px-3 py-2 text-sm w-56" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                      <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Name</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">City</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Location</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Country</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">UserType</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Last Active</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr><td colSpan={10} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-16 text-gray-400 dark:text-white/40">No users match this search.</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button title="Edit" onClick={() => openEditUser(u)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{u.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{u.email}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{u.phone || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{u.city || 'n/a'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{u.officeLocation || 'n/a'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{u.country || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{u.userType || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('sv-SE').slice(0, 19) : '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => handleToggleSuspend(u)} className={`text-xs font-semibold px-2.5 py-1 rounded ${u.status === 'SUSPENDED' ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                            {u.status === 'SUSPENDED' ? 'Suspended' : 'Active'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 text-sm text-gray-400 dark:text-white/40 border-t">Showing 1 to {users.length} of {users.length} entries</div>
            </div>
          </>
        ) : (
          <div className="panel-glass rounded-2xl">
            <div className="flex items-center justify-end px-5 py-4 border-b">
              <button onClick={openAddRole} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                <Plus className="w-4 h-4" /> Add User Role
              </button>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3">
              <div className="text-sm text-gray-600 dark:text-white/60">Show 10 entries</div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
                Search:
                <input value={roleSearch} onChange={e => setRoleSearch(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-56" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                    <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Description</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">User Count</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">No roles match this search.</td></tr>
                  ) : filteredRoles.map(r => (
                    <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button title="Edit" onClick={() => openEditRole(r)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                          <button title="Delete" onClick={() => handleDeleteRole(r)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{r.name}</td>
                      <td className="px-4 py-3">{r.description || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.userCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(r.updatedAt).toLocaleString('sv-SE').slice(0, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 text-sm text-gray-400 dark:text-white/40 border-t">Showing 1 to {filteredRoles.length} of {filteredRoles.length} entries</div>
          </div>
        )}
      </div>

      {roleModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{editingRoleId ? 'Edit role' : 'Add User Role'}</h3>
              <button onClick={() => setRoleModalOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <form onSubmit={handleSaveRole} className="space-y-3">
              {roleFormError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{roleFormError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Name *</label>
                <input required value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Description</label>
                <textarea value={roleForm.description} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-y bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
              <button type="submit" disabled={savingRole} className="w-full bg-brand-800 hover:bg-brand-700 transition-colors text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
                {savingRole ? 'Saving…' : editingRoleId ? 'Update role' : 'Add role'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
