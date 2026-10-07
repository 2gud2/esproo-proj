import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, BarChart3, DollarSign, Package, Receipt, X, RotateCcw, Inbox } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';
import { Navigate } from 'react-router-dom';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import { useAuth } from '../contexts/AuthContext';
import type { Sale, Ingredient, Expense } from '../lib/mockData';
import { loadIngredients, loadSales, loadExpenses, voidSaleWithRestoration, refundSaleNoRestoration } from '../lib/db';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import './Reports.css';

type Tab = 'sales' | 'expenses' | 'profit' | 'inventory';

const COLORS = ['#943A1F', '#B84C2A', '#D4856A', '#E8B49A', '#7A2F18', '#4A1C0E', '#2B1008'];
const PAGE_SIZE = 20;

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided' | 'refunded'>('all');

  // Pagination states
  const [salesPage, setSalesPage] = useState(1);
  const [expensesPage, setExpensesPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  
  // State for reports data
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Void modal state
  const [voidModal, setVoidModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [voidType, setVoidType] = useState<'voided' | 'refunded'>('voided');
  const [voidReason, setVoidReason] = useState('');
  const [savingVoid, setSavingVoid] = useState(false);

  async function fetchReportsData() {
    setLoadingData(true);
    try {
      const [salesData, ingredientsData, expensesData] = await Promise.all([
        loadSales(),
        loadIngredients(),
        loadExpenses()
      ]);
      setSales(salesData);
      setIngredients(ingredientsData);
      setExpenses(expensesData);
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    fetchReportsData();
  }, []);

  // Reset to page 1 whenever filters or active tab changes
  useEffect(() => { setSalesPage(1); }, [dateFrom, dateTo, statusFilter, tab]);
  useEffect(() => { setExpensesPage(1); }, [dateFrom, dateTo, tab]);
  useEffect(() => { setInventoryPage(1); }, [tab]);

  // Block employee accounts from viewing admin reports page
  if (!authLoading && user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Filtered sales based on date range and status filter
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.createdAt);
      const matchFrom = !dateFrom || d >= new Date(dateFrom);
      const matchTo = !dateTo || d <= new Date(dateTo + 'T23:59:59');
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchFrom && matchTo && matchStatus;
    });
  }, [sales, dateFrom, dateTo, statusFilter]);

  // Filtered expenses based on date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date);
      const matchFrom = !dateFrom || d >= new Date(dateFrom);
      const matchTo = !dateTo || d <= new Date(dateTo + 'T23:59:59');
      return matchFrom && matchTo;
    });
  }, [expenses, dateFrom, dateTo]);

  // Paginated arrays
  const totalSalesPages = Math.ceil(filteredSales.length / PAGE_SIZE);
  const paginatedSales = useMemo(() => {
    return filteredSales.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  }, [filteredSales, salesPage]);

  const totalExpensesPages = Math.ceil(filteredExpenses.length / PAGE_SIZE);
  const paginatedExpenses = useMemo(() => {
    return filteredExpenses.slice((expensesPage - 1) * PAGE_SIZE, expensesPage * PAGE_SIZE);
  }, [filteredExpenses, expensesPage]);

  const totalInventoryPages = Math.ceil(ingredients.length / PAGE_SIZE);
  const paginatedIngredients = useMemo(() => {
    return ingredients.slice((inventoryPage - 1) * PAGE_SIZE, inventoryPage * PAGE_SIZE);
  }, [ingredients, inventoryPage]);

  // Dynamic calculation for expenses by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  // Aggregate completed sales by day dynamically for last 7 days
  const salesByDay = useMemo(() => {
    const chart = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { day: format(d, 'EEE'), dateStr: d.toDateString(), sales: 0 };
    });

    filteredSales.forEach(s => {
      if (s.status === 'completed') {
        const sDate = new Date(s.createdAt).toDateString();
        const dayMatch = chart.find(c => c.dateStr === sDate);
        if (dayMatch) {
          dayMatch.sales += s.total;
        }
      }
    });

    return chart.map(c => ({ day: c.day, sales: c.sales }));
  }, [filteredSales]);

  // Metrics within active date filter
  const totalSalesInPeriod = useMemo(() => {
    return filteredSales
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.total, 0);
  }, [filteredSales]);

  const totalExpensesInPeriod = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const netProfit = totalSalesInPeriod - totalExpensesInPeriod;

  // Helper to calculate total quantity of items in an order
  const getItemCount = (items: any[]) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum: number, item: any) => sum + Number(item.qty || 1), 0);
  };

  // CSV Export for Sales Report
  function handleExportCSV() {
    if (filteredSales.length === 0) {
      toast.error('No sales data to export for selected filter');
      return;
    }

    const headers = ['Sale ID', 'Date', 'Cashier', 'Item Qty Count', 'Total (PHP)', 'Payment Method', 'Status', 'Reason'];
    const rows = filteredSales.map(s => [
      s.id,
      format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm'),
      `"${s.cashierName}"`,
      getItemCount(s.items),
      s.total,
      s.paymentMethod,
      s.status,
      `"${s.voidReason || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `espro_sales_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sales report exported to CSV!');
  }

  function handleVoidClick(saleId: string) {
    setSelectedSaleId(saleId);
    setVoidReason('');
    setVoidType('voided');
    setVoidModal(true);
  }

  async function handleConfirmVoid() {
    if (!selectedSaleId) return;
    if (!voidReason.trim()) { toast.error('Please specify a reason'); return; }
    
    setSavingVoid(true);
    try {
      if (voidType === 'voided') {
        await voidSaleWithRestoration(selectedSaleId, voidType, voidReason.trim());
        toast.success('Sale voided successfully! Ingredient stock restored.');
      } else {
        await refundSaleNoRestoration(selectedSaleId, voidReason.trim());
        toast.success('Sale refunded successfully! Ingredient stock remains deducted.');
      }
      setVoidModal(false);
      await fetchReportsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update sale status');
    } finally {
      setSavingVoid(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'sales', label: 'Sales Report', icon: BarChart3 },
    { key: 'expenses', label: 'Expense Report', icon: Receipt },
    { key: 'profit', label: 'Profit Summary', icon: DollarSign },
    { key: 'inventory', label: 'Raw Ingredients Report', icon: Package },
  ];

  if (authLoading || loadingData) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <TopBar title="Reports" />
          <main className="page-body">
            <div className="empty-state" style={{ padding: '100px 20px' }}>
              <div className="spinner" />
              <p>Loading reports...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="Reports" action={
          <button className="btn btn-ghost" onClick={handleExportCSV}><Download size={15} /> Export CSV</button>
        } />
        <main className="page-body">
          {/* Date range & Filters */}
          <div className="reports-filters card card-pad" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>Date Range:</span>
              <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 145, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>to</span>
              <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 145, flexShrink: 0 }} />
              {(dateFrom || dateTo) && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ flexShrink: 0 }}>
                  <X size={13} /> Clear Date
                </button>
              )}
            </div>

            {tab === 'sales' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
                <div className="period-tabs">
                  {(['all', 'completed', 'refunded', 'voided'] as const).map(st => (
                    <button
                      key={st}
                      className={`period-tab${statusFilter === st ? ' active' : ''}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="reports-tabs">
            {tabs.map(t => (
              <button key={t.key} className={`reports-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>

          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {/* SALES */}
            {tab === 'sales' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card card-pad">
                  <h3 style={{ marginBottom: 18 }}>Daily Sales Trend</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={salesByDay} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--secondary)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13 }}
                        formatter={(v: any) => [`₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Sales']}
                      />
                      <Bar dataKey="sales" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3>Transactions ({filteredSales.length})</h3>
                    <span className="badge badge-neutral">Total: ₱{totalSalesInPeriod.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {filteredSales.length === 0 ? (
                    <div className="empty-state" style={{ padding: '50px 20px' }}>
                      <Inbox size={32} />
                      <p>No transactions found matching criteria.</p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Sale ID</th>
                            <th>Date</th>
                            <th>Cashier</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions / Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSales.map(s => {
                            const itemCount = getItemCount(s.items);
                            return (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 600 }}>{s.id}</td>
                                <td style={{ color: 'var(--text-muted)' }}>{format(new Date(s.createdAt), 'MMM dd, hh:mm a')}</td>
                                <td>{s.cashierName}</td>
                                <td>{itemCount} item{itemCount === 1 ? '' : 's'}</td>
                                <td style={{ fontWeight: 600 }}>₱{s.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                <td>
                                  <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'voided' ? 'badge-danger' : 'badge-warning'}`}>
                                    {s.status}
                                  </span>
                                </td>
                                <td>
                                  {s.status === 'completed' ? (
                                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => handleVoidClick(s.id)}>
                                      Void/Refund
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', maxWidth: 180 }} title={s.voidReason}>
                                      {s.voidReason || 'No reason'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Pagination
                    currentPage={salesPage}
                    totalPages={totalSalesPages}
                    onPageChange={setSalesPage}
                    totalItems={filteredSales.length}
                    pageSize={PAGE_SIZE}
                  />
                </div>
              </div>
            )}

            {/* EXPENSES */}
            {tab === 'expenses' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                <div className="card">
                  <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h3>Expense Breakdown ({filteredExpenses.length})</h3>
                  </div>
                  {filteredExpenses.length === 0 ? (
                    <div className="empty-state" style={{ padding: '50px 20px' }}>
                      <Receipt size={32} />
                      <p>No expenses recorded for selected date range.</p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
                        <tbody>
                          {paginatedExpenses.map(e => (
                            <tr key={e.id}>
                              <td style={{ color: 'var(--text-muted)' }}>{format(new Date(e.date), 'MMM dd, yyyy')}</td>
                              <td>{e.description}</td>
                              <td><span className="badge badge-info">{e.category}</span></td>
                              <td style={{ fontWeight: 700, color: 'var(--danger)' }}>₱{e.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Pagination
                    currentPage={expensesPage}
                    totalPages={totalExpensesPages}
                    onPageChange={setExpensesPage}
                    totalItems={filteredExpenses.length}
                    pageSize={PAGE_SIZE}
                  />
                </div>

                <div className="card card-pad">
                  <h3 style={{ marginBottom: 16 }}>Expenses by Category</h3>
                  {expenseByCategory.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 10px' }}>
                      <p>No category breakdown available.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={3}>
                          {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* PROFIT */}
            {tab === 'profit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="stats-grid">
                  <div className="card card-pad">
                    <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)', marginBottom: 12 }}><DollarSign size={20} /></div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>₱{totalSalesInPeriod.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                    <div className="stat-label">Total Sales (Completed)</div>
                    <div className="stat-sub">For selected period</div>
                  </div>
                  <div className="card card-pad">
                    <div className="stat-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', marginBottom: 12 }}><Receipt size={20} /></div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>₱{totalExpensesInPeriod.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                    <div className="stat-label">Total Expenses</div>
                    <div className="stat-sub">For selected period</div>
                  </div>
                  <div className="card card-pad">
                    <div className="stat-icon" style={{ background: netProfit >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)', marginBottom: 12 }}>
                      <BarChart3 size={20} />
                    </div>
                    <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ₱{Math.abs(netProfit).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="stat-label">Net Profit (Sales - Expenses)</div>
                    <div className="stat-sub">{netProfit >= 0 ? 'Net Profit ✓' : 'Net Loss'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {tab === 'inventory' && (
              <div className="card">
                <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}><h3>Raw Ingredients Stock Levels</h3></div>
                {ingredients.length === 0 ? (
                  <div className="empty-state" style={{ padding: '50px 20px' }}>
                    <Package size={32} />
                    <p>No ingredients found.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Ingredient</th><th>Unit</th><th>Current Stock</th><th>Low-Stock Threshold</th><th>Status</th></tr></thead>
                      <tbody>
                        {paginatedIngredients.map(ing => {
                          const low = ing.stock_quantity <= ing.low_stock_threshold;
                          return (
                            <tr key={ing.id}>
                              <td style={{ fontWeight: 600 }}>{ing.name}</td>
                              <td><span className="badge badge-neutral">{ing.unit}</span></td>
                              <td style={{ fontWeight: 600 }}>{ing.stock_quantity} {ing.unit}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{ing.low_stock_threshold} {ing.unit}</td>
                              <td>
                                <span className={`badge ${low ? 'badge-danger' : 'badge-success'}`}>
                                  {low ? 'Low Stock' : 'OK'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  currentPage={inventoryPage}
                  totalPages={totalInventoryPages}
                  onPageChange={setInventoryPage}
                  totalItems={ingredients.length}
                  pageSize={PAGE_SIZE}
                />
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Void Modal */}
      <AnimatePresence>
        {voidModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVoidModal(false)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <div className="modal-header">
                <h3>Void or Refund Transaction</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setVoidModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Action</label>
                  <select className="input select" value={voidType} onChange={e => setVoidType(e.target.value as any)}>
                    <option value="voided">Void Order (Restores raw ingredient stock)</option>
                    <option value="refunded">Refund Order (Keeps raw ingredient stock deducted)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <textarea className="input" rows={3} placeholder="e.g. Customer returned items / Spilled drink" value={voidReason} onChange={e => setVoidReason(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setVoidModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleConfirmVoid} disabled={savingVoid}>
                  {savingVoid ? <span className="spinner-sm" /> : <><RotateCcw size={15} /> Confirm</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
