import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Receipt as ReceiptIcon, PieChart as PieIcon, Edit2, Trash2, Check, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import { EXPENSE_CATEGORIES } from '../lib/mockData';
import type { Expense } from '../lib/mockData';
import { loadExpenses, saveExpense, updateExpense, deleteExpense } from '../lib/db';
import { startOfDayLocal, endOfDayLocal, toLocalNoon } from '../lib/dateUtils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './Expenses.css';

const PAGE_SIZE = 20;
const defaultForm = { description: '', amount: '', category: EXPENSE_CATEGORIES[0], date: format(new Date(), 'yyyy-MM-dd') };

const COLORS = [
  '#B87333', // Warm Copper
  '#4A7C59', // Sage Green
  '#8B5E3C', // Deep Brown
  '#D4A373', // Light Caramel
  '#2C5E8A', // Classic Blue
  '#E76F51', // Terracotta
  '#6B705C', // Olive
  '#9B5DE5', // Lavender Purple
  '#F4A261', // Soft Amber
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteModal, setDeleteModal] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filterCat, setFilterCat] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchExpenses() {
      const data = await loadExpenses();
      setExpenses(data);
    }
    fetchExpenses();
  }, []);

  const filtered = useMemo(() => {
    return expenses
      .filter(e => {
        const d = new Date(e.date);
        const matchCat = filterCat === 'All' || e.category === filterCat;
        const matchFrom = !dateFrom || d >= startOfDayLocal(dateFrom);
        const matchTo = !dateTo || d <= endOfDayLocal(dateTo);
        return matchCat && matchFrom && matchTo;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filterCat, dateFrom, dateTo]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterCat, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedExpenses = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const totalShown = filtered.reduce((s, e) => s + e.amount, 0);

  // Group filtered expenses by category for the Pie Chart
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  function handleStartEdit(expense: Expense) {
    setEditingExpense(expense);
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      date: format(new Date(expense.date), 'yyyy-MM-dd'),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingExpense(null);
    setForm(defaultForm);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.description.trim()) { toast.error('Please enter a description'); return; }
    const numAmount = Number(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error('Please enter a valid positive amount'); return; }

    setSaving(true);
    try {
      if (editingExpense) {
        // Update existing expense (storing local noon so date never shifts)
        const updated: Expense = {
          id: editingExpense.id,
          description: form.description.trim(),
          amount: numAmount,
          category: form.category,
          date: toLocalNoon(form.date),
        };
        await updateExpense(updated);
        setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
        setEditingExpense(null);
        setForm(defaultForm);
        toast.success('Expense updated successfully!');
      } else {
        // Create new expense (storing local noon)
        const newExpense: Expense = {
          id: `exp-${Date.now()}`,
          description: form.description.trim(),
          amount: numAmount,
          category: form.category,
          date: toLocalNoon(form.date),
        };
        await saveExpense(newExpense);
        setExpenses(prev => [newExpense, ...prev]);
        setForm(defaultForm);
        toast.success('Expense recorded successfully!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteModal.id);
      setExpenses(prev => prev.filter(e => e.id !== deleteModal.id));
      if (editingExpense?.id === deleteModal.id) {
        handleCancelEdit();
      }
      toast.success('Expense deleted successfully!');
      setDeleteModal(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  }

  function f(field: keyof typeof form, val: string) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="Expenses Management" />
        <main className="page-body">
          <div className="expenses-layout">
            {/* Left Column: Form & Pie Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Record / Edit Form */}
              <motion.div className="card card-pad expense-form-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h3 style={{ margin: 0 }}>
                    {editingExpense ? 'Edit Expense' : 'Record Expense'}
                  </h3>
                  {editingExpense && (
                    <button className="btn btn-ghost btn-sm" onClick={handleCancelEdit} style={{ fontSize: '0.75rem' }}>
                      <X size={13} /> Cancel
                    </button>
                  )}
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Description *</label>
                    <input className="input" placeholder="e.g. Electric bill July, Coffee beans shipment" value={form.description} onChange={e => f('description', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₱) *</label>
                    <input type="number" className="input" min={0} step="0.01" placeholder="0.00" value={form.amount} onChange={e => f('amount', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="input select" value={form.category} onChange={e => f('category', e.target.value)}>
                      {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} />
                  </div>
                  <motion.button type="submit" className={`btn ${editingExpense ? 'btn-success' : 'btn-primary'}`} style={{ marginTop: 4 }} disabled={saving} whileTap={{ scale: 0.97 }}>
                    {saving ? (
                      <span className="spinner-sm" />
                    ) : editingExpense ? (
                      <><Check size={15} /> Update Expense</>
                    ) : (
                      <><Plus size={15} /> Record Expense</>
                    )}
                  </motion.button>
                </form>
              </motion.div>

              {/* Expenses by Category Pie Chart */}
              <motion.div className="card card-pad" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PieIcon size={16} color="var(--primary)" /> Expenses by Category
                  </h3>
                </div>
                {expenseByCategory.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 10px' }}>
                    <p style={{ fontSize: '0.82rem' }}>No expenses to display in chart.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={expenseByCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="48%"
                        outerRadius={75}
                        innerRadius={36}
                        paddingAngle={3}
                      >
                        {expenseByCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </motion.div>
            </div>

            {/* Right Column: History */}
            <motion.div className="card expense-history-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <h3>Expense History ({filtered.length})</h3>
                  <span className="badge badge-neutral" style={{ fontSize: '0.85rem' }}>
                    Total: <strong style={{ color: 'var(--danger)', marginLeft: 4 }}>₱{totalShown.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </span>
                </div>
                <div className="expense-filters">
                  <select className="input select" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ maxWidth: 160 }}>
                    <option value="All">All Categories</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input type="date" className="input" placeholder="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ maxWidth: 160 }} />
                  <input type="date" className="input" placeholder="To" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ maxWidth: 160 }} />
                  {(filterCat !== 'All' || dateFrom || dateTo) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setFilterCat('All'); setDateFrom(''); setDateTo(''); }}>
                      <X size={13} /> Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExpenses.map(e => (
                      <motion.tr key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{format(new Date(e.date), 'MMM dd, yyyy')}</td>
                        <td style={{ fontWeight: 500 }}>{e.description}</td>
                        <td><span className="badge badge-info">{e.category}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--danger)' }}>₱{e.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-icon btn-ghost btn-sm"
                            title="Edit Expense"
                            onClick={() => handleStartEdit(e)}
                            style={{ marginRight: 4 }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-icon btn-ghost btn-sm"
                            title="Delete Expense"
                            onClick={() => setDeleteModal(e)}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="empty-state"><ReceiptIcon size={32} /><p>No expenses found</p></div>
                )}
              </div>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
              />
            </motion.div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                  <AlertTriangle size={18} /> Delete Expense
                </h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setDeleteModal(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  Are you sure you want to delete the expense <strong>"{deleteModal.description}"</strong> (₱{deleteModal.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})?
                </p>
                <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteModal(null)} disabled={deleting}>Cancel</button>
                <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleting}>
                  {deleting ? <span className="spinner-sm" /> : <><Trash2 size={15} /> Delete</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
