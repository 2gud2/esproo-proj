import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, UserX, UserCheck, X, Save, Users as UsersIcon, Lock, Mail } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import type { StaffUser } from '../lib/mockData';
import { adminUpdateUserPassword, createStaffAccount, supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import './Users.css';

const DOMAIN = 'espro.ph';
const PAGE_SIZE = 20;

const defaultForm = {
  name: '',
  username: '',
  domain: DOMAIN,
  email: '',
  password: '',
  role: 'employee' as 'admin' | 'employee'
};

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>(() => {
    const saved = localStorage.getItem('espro_dynamic_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StaffUser[];
        return parsed.filter(u => !/^u\d+$/.test(u.id));
      } catch (_) {
        return [];
      }
    }
    return [];
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    localStorage.setItem('espro_dynamic_users', JSON.stringify(users));
  }, [users]);

  // Fetch profiles from Supabase if table exists
  useEffect(() => {
    async function loadSupabaseProfiles() {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (data && data.length > 0 && !error) {
          const loaded: StaffUser[] = data.map((p: any) => ({
            id: p.id,
            name: p.name || p.email,
            email: p.email,
            role: (p.role as 'admin' | 'employee') || 'employee',
            status: (p.status as 'active' | 'disabled') || 'active',
            createdAt: p.created_at ? new Date(p.created_at) : new Date(),
          }));
          // Merge with initial list
          setUsers(prev => {
            const map = new Map(prev.map(u => [u.email.toLowerCase(), u]));
            loaded.forEach(u => map.set(u.email.toLowerCase(), u));
            return Array.from(map.values());
          });
        }
      } catch (_) { }
    }
    loadSupabaseProfiles();
  }, []);

  const filtered = useMemo(() => {
    return users.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  // Reset to page 1 on search change
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedUsers = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  function openAdd() {
    setForm(defaultForm);
    setEditing(null);
    setModal('add');
  }

  function openEdit(u: StaffUser) {
    const parts = u.email.split('@');
    setForm({
      name: u.name,
      username: parts[0] || '',
      domain: parts[1] || DOMAIN,
      email: u.email,
      password: '',
      role: u.role
    });
    setEditing(u);
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Please enter full name');
      return;
    }

    const fullEmail = modal === 'add'
      ? `${form.username.trim()}@${form.domain.trim()}`.toLowerCase()
      : form.email.toLowerCase();

    if (modal === 'add') {
      if (!form.username.trim()) {
        toast.error('Please enter a username');
        return;
      }
      if (!form.password || form.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
    }

    setSaving(true);

    if (modal === 'add') {
      // Call Supabase Auth creation with non-session client
      const { error: supaErr } = await createStaffAccount(fullEmail, form.password, form.name.trim(), form.role);

      if (supaErr && !supaErr.includes('not configured')) {
        // If Supabase returns a real auth error (e.g. email already registered)
        toast.error(supaErr);
        setSaving(false);
        return;
      }

      const newUser: StaffUser = {
        id: `u-${Date.now()}`,
        name: form.name.trim(),
        email: fullEmail,
        role: form.role,
        status: 'active',
        createdAt: new Date()
      };

      setUsers(prev => [newUser, ...prev]);
      toast.success(`Account created for ${newUser.name} (${fullEmail})`);
    } else if (editing) {
      // Update Supabase profile role if available
      try {
        await supabase.from('profiles').update({ role: form.role, name: form.name.trim() }).eq('id', editing.id);
      } catch (_) { }

      if (form.password) {
        const { error: passwdErr } = await adminUpdateUserPassword(editing.id, form.password);
        if (passwdErr) {
          if (passwdErr.message.includes('not configured')) {
            toast.error('Supabase service role key is not set in .env. User updated locally.', { duration: 4000 });
          } else {
            toast.error(passwdErr.message || 'Failed to reset password');
            setSaving(false);
            return;
          }
        }
      }

      setUsers(prev => prev.map(u => u.id === editing.id
        ? { ...u, name: form.name.trim(), role: form.role }
        : u
      ));
      toast.success('User updated successfully!');
    }

    setSaving(false);
    setModal(null);
  }

  async function toggleStatus(id: string) {
    const userToToggle = users.find(u => u.id === id);
    if (!userToToggle) return;

    const newStatus: 'active' | 'disabled' = userToToggle.status === 'active' ? 'disabled' : 'active';

    try {
      await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
    } catch (_) { }

    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
    toast.success(`${userToToggle.name} account is now ${newStatus}`);
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          title="User Management"
          searchPlaceholder="Search users..."
          onSearch={setSearch}
          action={<button className="btn btn-primary" onClick={openAdd}><Plus size={15} />  Add User</button>}
        />
        <main className="page-body">
          {/* Summary */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
            <div className="card card-pad">
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{users.length}</div>
              <div className="stat-label">Total Staff</div>
            </div>
            <div className="card card-pad">
              <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>{users.filter(u => u.status === 'active').length}</div>
              <div className="stat-label">Active Users</div>
            </div>
            <div className="card card-pad">
              <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{users.filter(u => u.role === 'admin').length}</div>
              <div className="stat-label">Admins</div>
            </div>
          </div>

          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Staff Accounts</h3>
                <p className="page-subtitle">Admin-controlled barista & cashier access</p>
              </div>
              <span className="badge badge-primary">Domain: @espro.ph</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(u => (
                    <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="user-avatar">{u.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <span style={{ fontWeight: 600, display: 'block' }}>{u.name}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {u.id}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-neutral'}`}>
                          {u.role === 'admin' ? ' Admin' : 'Barista / Cashier'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                          {u.status === 'active' ? '● Active' : '● Disabled'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{format(new Date(u.createdAt), 'MMM dd, yyyy')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-icon btn-ghost" onClick={() => openEdit(u)} title="Edit Role & Details">
                            <Edit2 size={14} />
                          </button>
                          <button
                            className={`btn btn-icon ${u.status === 'active' ? 'btn-danger' : 'btn-ghost'}`}
                            onClick={() => toggleStatus(u.id)}
                            title={u.status === 'active' ? 'Disable Account' : 'Enable Account'}
                          >
                            {u.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="empty-state"><UsersIcon size={32} /><p>No staff accounts found</p></div>
              )}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </div>
        </main>
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <div className="modal-header">
                <div>
                  <h3>{modal === 'add' ? 'Create Staff Account' : 'Edit Staff Account'}</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {modal === 'add' ? 'Only Admins can issue accounts for baristas & cashiers' : 'Modify user role or display details'}
                  </p>
                </div>
                <button className="btn btn-icon btn-ghost" onClick={() => setModal(null)}><X size={18} /></button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    className="input"
                    placeholder="e.g. Maria Santos"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {modal === 'add' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Custom Domain Email *</label>
                      <div className="input-icon-wrap" style={{ display: 'flex', alignItems: 'center' }}>
                        <Mail size={15} className="input-icon" />
                        <input
                          type="text"
                          className="input"
                          style={{ borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', borderRight: 'none' }}
                          placeholder="username (e.g. barista.maria)"
                          value={form.username}
                          onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                        />
                        <span style={{
                          background: 'var(--surface-2)',
                          border: '1.5px solid var(--border)',
                          padding: '10px 14px',
                          borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--primary)'
                        }}>
                          @{form.domain}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Preview: <strong>{form.username ? `${form.username}@${form.domain}` : `@${form.domain}`}</strong>
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Initial Password *</label>
                      <div className="input-icon-wrap">
                        <Lock size={15} className="input-icon" />
                        <input
                          type="password"
                          className="input"
                          placeholder="At least 6 characters"
                          value={form.password}
                          onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input className="input" value={form.email} disabled />
                    </div>
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <div className="input-icon-wrap">
                        <Lock size={15} className="input-icon" />
                        <input
                          type="password"
                          className="input"
                          placeholder="Leave blank to keep current password"
                          value={form.password}
                          onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Leave blank if you don't want to change this user's password.
                      </span>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="input select"
                    value={form.role}
                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value as 'admin' | 'employee' }))}
                  >
                    <option value="employee">Employee (Barista / Cashier)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="spinner-sm" /> : <><Save size={15} /> {modal === 'add' ? 'Create Account' : 'Save Changes'}</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
