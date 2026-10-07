import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Receipt as ReceiptIcon } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import { EXPENSE_CATEGORIES } from '../lib/mockData';
import type { Expense } from '../lib/mockData';
import { loadExpenses, saveExpense } from '../lib/db';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './Expenses.css';

const PAGE_SIZE = 20;
const defaultForm = { description: '', amount: '', category: EXPENSE_CATEGORIES[0], date: format(new Date(), 'yyyy-MM-dd') };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(defaultForm);
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
        const matchFrom = !dateFrom || d >= new Date(dateFrom);
        const matchTo = !dateTo || d <= new Date(dateTo + 'T23:59:59');
        return matchCat && matchFrom && matchTo;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filterCat, dateFrom, dateTo]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterCat, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedExpenses = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const totalShown = filtered.reduce((s, e) => s + e.amount, 0);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.description.trim()) { toast.error('Please enter a description'); return; }
    const numAmount = Number(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error('Please enter a valid positive amount'); return; }
    
    setSaving(true);
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      description: form.description.trim(),
      amount: numAmount,
      category: form.category,
      date: new Date(form.date),
    };
    await saveExpense(newExpense);
    setExpenses(prev => [newExpense, ...prev]);
    setForm(defaultForm);
    setSaving(false);
    toast.success('Expense recorded successfully!');
  }

  function f(field: keyof typeof form, val: string) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="Expenses" />
        <main className="page-body">
          <div className="expenses-layout">
            {/* Record Form */}
            <motion.div className="card card-pad expense-form-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h3 style={{ marginBottom: 18 }}>Record Expense</h3>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input className="input" placeholder="e.g. Electric bill July" value={form.description} onChange={e => f('description', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₱) *</label>
                  <input type="number" className="input" min={0} placeholder="0.00" value={form.amount} onChange={e => f('amount', e.target.value)} />
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
                <motion.button type="submit" className="btn btn-primary" style={{ marginTop: 4 }} disabled={saving} whileTap={{ scale: 0.97 }}>
                  {saving ? <span className="spinner-sm" /> : <><Plus size={15} /> Record Expense</>}
                </motion.button>
              </form>
            </motion.div>

            {/* History */}
            <motion.div className="card expense-history-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h3>Expense History</h3>
                  <span className="badge badge-neutral">Total: ₱{totalShown.toLocaleString()}</span>
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
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExpenses.map(e => (
                      <motion.tr key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{format(new Date(e.date), 'MMM dd, yyyy')}</td>
                        <td style={{ fontWeight: 500 }}>{e.description}</td>
                        <td><span className="badge badge-info">{e.category}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--danger)' }}>₱{e.amount.toLocaleString()}</td>
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
    </div>
  );
}
