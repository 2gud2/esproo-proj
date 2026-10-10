import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, BarChart3, DollarSign, Package, Receipt,
  X, RotateCcw, Inbox, UtensilsCrossed, TrendingUp, TrendingDown,
  Layers, CheckCircle2
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import { useAuth } from '../contexts/AuthContext';
import type { Sale, Ingredient, Expense, MenuItem, MenuItemIngredient } from '../lib/mockData';
import {
  loadIngredients,
  loadSales,
  loadExpenses,
  loadMenuItems,
  loadMenuItemRecipe,
  voidSaleWithRestoration,
  refundSaleNoRestoration
} from '../lib/db';
import { calculateIngredientCost } from '../lib/unitConversion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './Reports.css';

type Tab = 'sales' | 'expenses' | 'profit' | 'inventory';

const PAGE_SIZE = 20;

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided' | 'refunded'>('all');

  // Pagination states
  const [salesPage, setSalesPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  
  // State for reports data
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipesByMenuId, setRecipesByMenuId] = useState<Record<string, MenuItemIngredient[]>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Void/Refund modal state
  const [voidModal, setVoidModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [voidType, setVoidType] = useState<'voided' | 'refunded'>('voided');
  const [voidReason, setVoidReason] = useState('');
  const [savingVoid, setSavingVoid] = useState(false);

  async function fetchReportsData() {
    setLoadingData(true);
    try {
      const [salesData, ingredientsData, expensesData, menuItemsData] = await Promise.all([
        loadSales(),
        loadIngredients(),
        loadExpenses(),
        loadMenuItems(false)
      ]);
      setSales(salesData);
      setIngredients(ingredientsData);
      setExpenses(expensesData);
      setMenuItems(menuItemsData);

      // Fetch recipes for all menu items to calculate accurate COGS
      const recipeMap: Record<string, MenuItemIngredient[]> = {};
      await Promise.all(
        menuItemsData.map(async m => {
          const rec = await loadMenuItemRecipe(m.id);
          recipeMap[m.id] = rec;
        })
      );
      setRecipesByMenuId(recipeMap);
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    fetchReportsData();
  }, []);

  // Reset page when filters change
  useEffect(() => { setSalesPage(1); }, [dateFrom, dateTo, statusFilter, tab]);
  useEffect(() => { setInventoryPage(1); }, [tab]);

  // Block employee accounts from viewing admin financial reports
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
  const totalSalesPages = Math.ceil(filteredSales.length / PAGE_SIZE) || 1;
  const paginatedSales = useMemo(() => {
    return filteredSales.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  }, [filteredSales, salesPage]);

  const totalInventoryPages = Math.ceil(ingredients.length / PAGE_SIZE) || 1;
  const paginatedIngredients = useMemo(() => {
    return ingredients.slice((inventoryPage - 1) * PAGE_SIZE, inventoryPage * PAGE_SIZE);
  }, [ingredients, inventoryPage]);

  // Helper to count item quantity in sale
  const getItemCount = (items: any[]) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum: number, item: any) => sum + Number(item.qty || 1), 0);
  };

  // ════════════════════════════════════════════════════════════
  // 1. SALES METRICS CALCULATIONS
  // ════════════════════════════════════════════════════════════
  const completedSalesInPeriod = useMemo(() => {
    return filteredSales.filter(s => s.status === 'completed');
  }, [filteredSales]);

  // Gross Sales = Sum of (Subtotal or Total + Discount) for completed sales
  const grossSales = useMemo(() => {
    return completedSalesInPeriod.reduce((sum, s) => {
      const subtotal = s.subtotal != null ? Number(s.subtotal) : (Number(s.total) + Number(s.discount || 0));
      return sum + subtotal;
    }, 0);
  }, [completedSalesInPeriod]);

  // Total Discounts for completed sales
  const totalDiscounts = useMemo(() => {
    return completedSalesInPeriod.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  }, [completedSalesInPeriod]);

  // Net Sales = Gross Sales - Discounts
  const netSales = grossSales - totalDiscounts;

  // ════════════════════════════════════════════════════════════
  // 2. COGS (COST OF GOODS SOLD) PER PRODUCT
  // ════════════════════════════════════════════════════════════
  const cogsBreakdown = useMemo(() => {
    // Map of product/menu_item_id -> total qty sold in period
    const qtySoldMap: Record<string, { name: string; qtySold: number; cogsPerServing: number; totalCogs: number }> = {};

    // Calculate serving COGS for each menu item from its recipe
    const itemCogsMap: Record<string, number> = {};
    menuItems.forEach(item => {
      const recipe = recipesByMenuId[item.id] || [];
      const servingCost = recipe.reduce((acc, r) => {
        const ing = ingredients.find(i => i.id === r.ingredient_id) || r.ingredient;
        const lineCost = calculateIngredientCost(Number(r.quantity_used) || 0, r.unit || ing?.unit || 'pcs', ing);
        return acc + lineCost;
      }, 0);
      itemCogsMap[item.id] = servingCost;
    });

    // Aggregate quantities from completed sales
    completedSalesInPeriod.forEach(sale => {
      (sale.items || []).forEach((item: any) => {
        const id = item.menu_item_id || item.product?.id || item.id;
        const name = item.name || item.product?.name || 'Unknown Item';
        const qty = Number(item.qty || 1);
        const cogsPerServing = itemCogsMap[id] || 0;

        if (!qtySoldMap[id]) {
          qtySoldMap[id] = {
            name,
            qtySold: 0,
            cogsPerServing,
            totalCogs: 0,
          };
        }
        qtySoldMap[id].qtySold += qty;
        qtySoldMap[id].totalCogs = qtySoldMap[id].qtySold * cogsPerServing;
      });
    });

    return Object.values(qtySoldMap).filter(p => p.qtySold > 0);
  }, [completedSalesInPeriod, menuItems, recipesByMenuId, ingredients]);

  const totalCogs = useMemo(() => {
    return cogsBreakdown.reduce((sum, item) => sum + item.totalCogs, 0);
  }, [cogsBreakdown]);

  // ════════════════════════════════════════════════════════════
  // 3. OPERATING EXPENSES BY CATEGORY
  // ════════════════════════════════════════════════════════════
  const operatingExpensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([category, amount]) => ({
      category,
      amount,
    }));
  }, [filteredExpenses]);

  const totalOperatingExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  // ════════════════════════════════════════════════════════════
  // 4. PROFIT & LOSS FORMULAS
  // Net Sales = Gross Sales - Discounts
  // Gross Profit = Net Sales - COGS
  // Net Profit = Gross Profit - Operating Expenses
  // ════════════════════════════════════════════════════════════
  const grossProfit = netSales - totalCogs;
  const netProfit = grossProfit - totalOperatingExpenses;
  const isNetProfitPositive = netProfit >= 0;

  // Number formatting helper
  function formatAccountingNumber(val: number, isDeduction = false, withPeso = false): string {
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (isDeduction) {
      return withPeso ? `(₱${formatted})` : `(${formatted})`;
    }
    return withPeso ? `₱${formatted}` : formatted;
  }

  // CSV Export for Sales Report
  function handleExportCSV() {
    if (filteredSales.length === 0) {
      toast.error('No sales data to export for selected filter');
      return;
    }

    const headers = ['Sale ID', 'Date', 'Cashier', 'No. of Items', 'Subtotal (PHP)', 'Discount (PHP)', 'Refund (PHP)', 'Total (PHP)', 'Payment Method', 'Status', 'Reason'];
    const rows = filteredSales.map(s => [
      s.id,
      format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm'),
      `"${s.cashierName}"`,
      getItemCount(s.items),
      s.subtotal != null ? s.subtotal : s.total,
      s.discount || 0,
      s.status === 'refunded' ? s.total : 0,
      s.total,
      s.paymentMethod === 'cash' ? 'Cash' : 'Digital Payment',
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
        toast.success('Sale voided successfully! Raw ingredient stock restored.');
      } else {
        await refundSaleNoRestoration(selectedSaleId, voidReason.trim());
        toast.success('Sale refunded successfully! Stock remains deducted.');
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
          <TopBar title="Financial Reports" />
          <main className="page-body">
            <div className="empty-state" style={{ padding: '100px 20px' }}>
              <div className="spinner" />
              <p>Loading financial reports...</p>
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
        <TopBar
          title="Financial Reports"
          action={
            <button className="btn btn-ghost" onClick={handleExportCSV}>
              <Download size={15} /> Export CSV
            </button>
          }
        />
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

          {/* Navigation Tabs */}
          <div className="reports-tabs">
            {tabs.map(t => (
              <button key={t.key} className={`reports-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>

          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            
            {/* ════════════════════════════════════════════════════════════
                TAB 1: SALES REPORTS (Immediate Transactions Table, No Graph)
               ════════════════════════════════════════════════════════════ */}
            {tab === 'sales' && (
              <div className="card">
                <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Sales Transactions ({filteredSales.length})</h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Complete ledger of sales, discounts, refunds, and receipts</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge-neutral">Gross Sales: ₱{grossSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    <span className="badge badge-success">Discounts: -₱{totalDiscounts.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    <span className="badge badge-primary" style={{ fontWeight: 700 }}>Net Sales: ₱{netSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
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
                          <th>No. of Items</th>
                          <th>Subtotal</th>
                          <th>Discount</th>
                          <th>Refund</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSales.map(s => {
                          const itemCount = getItemCount(s.items);
                          const discountVal = Number(s.discount || 0);
                          const subtotalVal = s.subtotal != null ? Number(s.subtotal) : (Number(s.total) + discountVal);
                          const refundVal = s.status === 'refunded' ? Number(s.total) : 0;

                          return (
                            <tr key={s.id}>
                              {/* Sale ID */}
                              <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{s.id}</td>

                              {/* Date */}
                              <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {format(new Date(s.createdAt), 'MMM dd, h:mm a')}
                              </td>

                              {/* Cashier */}
                              <td>{s.cashierName}</td>

                              {/* No. of Items */}
                              <td>{itemCount} item{itemCount === 1 ? '' : 's'}</td>

                              {/* Subtotal */}
                              <td style={{ fontWeight: 500 }}>
                                ₱{subtotalVal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </td>

                              {/* Discount */}
                              <td>
                                {discountVal > 0 ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                    ₱{discountVal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>0</span>
                                )}
                              </td>

                              {/* Refund */}
                              <td>
                                {refundVal > 0 ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                    ₱{refundVal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>0</span>
                                )}
                              </td>

                              {/* Total */}
                              <td style={{ fontWeight: 700, color: s.status === 'voided' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                ₱{Number(s.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </td>

                              {/* Status */}
                              <td>
                                <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'voided' ? 'badge-danger' : 'badge-warning'}`}>
                                  ● {s.status === 'completed' ? 'Completed' : s.status === 'voided' ? 'Voided' : 'Refunded'}
                                </span>
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: 'right' }}>
                                {s.status === 'completed' ? (
                                  <button
                                    className="btn btn-sm btn-ghost"
                                    style={{ color: 'var(--danger)', padding: '3px 8px', fontSize: '0.72rem' }}
                                    onClick={() => handleVoidClick(s.id)}
                                  >
                                    Void / Refund
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-block', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.voidReason}>
                                    {s.voidReason || 'No reason specified'}
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
            )}

            {/* ════════════════════════════════════════════════════════════
                TAB 2: EXPENSE REPORT (2 Sections: COGS and Operating Expenses)
               ════════════════════════════════════════════════════════════ */}
            {tab === 'expenses' && (
              <div className="expense-sections-grid">
                
                {/* SECTION 1: COST OF GOODS SOLD (COGS) */}
                <div className="card">
                  <div className="report-section-header">
                    <h3 className="report-section-title">
                      <UtensilsCrossed size={16} color="var(--primary)" />
                      SECTION 1: COST OF GOODS SOLD (COGS)
                    </h3>
                  </div>
                  {cogsBreakdown.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                      <p style={{ fontSize: '0.85rem' }}>No recipe items sold in selected period.</p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th style={{ textAlign: 'center' }}>Quantity Sold</th>
                            <th style={{ textAlign: 'right' }}>COGS per Serving</th>
                            <th style={{ textAlign: 'right' }}>Total COGS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cogsBreakdown.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{item.name}</td>
                              <td style={{ textAlign: 'center' }}>{item.qtySold}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                ₱{item.cogsPerServing.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                                ₱{item.totalCogs.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                          <tr className="table-total-row">
                            <td colSpan={3} style={{ fontWeight: 700 }}>Total COGS</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                              ₱{totalCogs.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* SECTION 2: OPERATING EXPENSES */}
                <div className="card">
                  <div className="report-section-header">
                    <h3 className="report-section-title">
                      <Receipt size={16} color="var(--primary)" />
                      SECTION 2: OPERATING EXPENSES
                    </h3>
                  </div>
                  {operatingExpensesByCategory.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                      <p style={{ fontSize: '0.85rem' }}>No operating expenses recorded for selected period.</p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Expense Category</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {operatingExpensesByCategory.map((cat, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{cat.category}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                                ₱{cat.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                          <tr className="table-total-row">
                            <td style={{ fontWeight: 700 }}>Total Operating Expenses</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                              ₱{totalOperatingExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                TAB 3: PROFIT SUMMARY (Exact Statement of Profit & Loss Format)
               ════════════════════════════════════════════════════════════ */}
            {tab === 'profit' && (
              <div className="income-statement-card">
                <div className="income-statement-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>PROFIT SUMMARY</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Statement of Profit and Loss (Accounting Breakdown)
                    </p>
                  </div>
                  <span className={`badge ${isNetProfitPositive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                    {isNetProfitPositive ? '● Profitable Period' : '● Operating at Loss'}
                  </span>
                </div>

                <table className="income-statement-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: '65%' }}>DETAILS</th>
                      <th style={{ textAlign: 'right', width: '35%' }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* GROSS SALES (First line has ₱ sign, Green) */}
                    <tr>
                      <td className="income-statement-row-label">GROSS SALES</td>
                      <td className="income-statement-val val-positive">
                        {formatAccountingNumber(grossSales, false, true)}
                      </td>
                    </tr>

                    {/* LESS: DISCOUNT (Red, in parentheses, no ₱ sign) */}
                    <tr>
                      <td className="income-statement-row-label indent">LESS: DISCOUNT</td>
                      <td className="income-statement-val val-negative">
                        {formatAccountingNumber(totalDiscounts, true, false)}
                      </td>
                    </tr>

                    {/* NET SALES (Subtotal, Green, no ₱ sign) */}
                    <tr className="income-statement-subtotal-row">
                      <td className="income-statement-row-label">NET SALES</td>
                      <td className="income-statement-val val-positive">
                        {formatAccountingNumber(netSales, false, false)}
                      </td>
                    </tr>

                    {/* LESS: COST OF GOODS SOLD (Red, in parentheses, no ₱ sign) */}
                    <tr>
                      <td className="income-statement-row-label indent">LESS: COST OF GOODS SOLD</td>
                      <td className="income-statement-val val-negative">
                        {formatAccountingNumber(totalCogs, true, false)}
                      </td>
                    </tr>

                    {/* GROSS PROFIT (Subtotal, Green, no ₱ sign) */}
                    <tr className="income-statement-subtotal-row">
                      <td className="income-statement-row-label">GROSS PROFIT</td>
                      <td className="income-statement-val val-positive">
                        {formatAccountingNumber(grossProfit, false, false)}
                      </td>
                    </tr>

                    {/* LESS: OPERATING EXPENSES (Red, in parentheses, no ₱ sign) */}
                    <tr>
                      <td className="income-statement-row-label indent">LESS: OPERATING EXPENSES</td>
                      <td className="income-statement-val val-negative">
                        {formatAccountingNumber(totalOperatingExpenses, true, false)}
                      </td>
                    </tr>

                    {/* FINAL ROW: NET PROFIT or NET LOSS (Has ₱ sign, double underline!) */}
                    <tr className="income-statement-final-row">
                      <td className="income-statement-row-label" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                        {isNetProfitPositive ? 'NET PROFIT' : 'NET LOSS'}
                      </td>
                      <td className={`income-statement-val ${isNetProfitPositive ? 'val-positive' : 'val-negative'}`} style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                        <span className={`double-underline ${isNetProfitPositive ? '' : 'loss'}`}>
                          {isNetProfitPositive
                            ? formatAccountingNumber(netProfit, false, true)
                            : formatAccountingNumber(netProfit, true, true)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                TAB 4: RAW INGREDIENTS REPORT
               ════════════════════════════════════════════════════════════ */}
            {tab === 'inventory' && (
              <div className="card">
                <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Raw Ingredients Stock Levels</h3>
                </div>
                {ingredients.length === 0 ? (
                  <div className="empty-state" style={{ padding: '50px 20px' }}>
                    <Package size={32} />
                    <p>No ingredients found.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Unit</th>
                          <th>Current Stock</th>
                          <th>Low-Stock Threshold</th>
                          <th>Status</th>
                        </tr>
                      </thead>
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
                                  ● {low ? 'Low Stock' : 'OK'}
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
