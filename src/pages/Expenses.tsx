import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Receipt as ReceiptIcon, PieChart as PieIcon,
  Edit2, Trash2, Check, AlertTriangle, UtensilsCrossed, Calendar
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import { EXPENSE_CATEGORIES } from '../lib/mockData';
import type { Expense, Sale, Ingredient, MenuItem, MenuItemIngredient } from '../lib/mockData';
import {
  loadExpenses,
  saveExpense,
  updateExpense,
  deleteExpense,
  loadSales,
  loadIngredients,
  loadMenuItems,
  loadMenuItemRecipe
} from '../lib/db';
import { startOfDayLocal, endOfDayLocal, toLocalNoon } from '../lib/dateUtils';
import { calculateIngredientCost } from '../lib/unitConversion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './Expenses.css';

const PAGE_SIZE = 20;
const defaultForm = {
  description: '',
  amount: '',
  category: EXPENSE_CATEGORIES[0],
  date: format(new Date(), 'yyyy-MM-dd')
};

const COLORS = [
  '#7A553A', // Mocha Bean
  '#B08968', // Caramel Roast
  '#4A7C59', // Sage Green
  '#8B5E3C', // Deep Brown
  '#D6BFA6', // Cappuccino Tan
  '#2C5E8A', // Classic Blue
  '#E76F51', // Terracotta
  '#6B705C', // Olive
  '#9B5DE5', // Lavender Purple
  '#F4A261', // Soft Amber
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipesByMenuId, setRecipesByMenuId] = useState<Record<string, MenuItemIngredient[]>>({});
  const [loading, setLoading] = useState(true);

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
    async function fetchData() {
      setLoading(true);
      try {
        const [expData, salesData, ingData, menuData] = await Promise.all([
          loadExpenses(),
          loadSales(),
          loadIngredients(),
          loadMenuItems(false)
        ]);
        setExpenses(expData);
        setSales(salesData);
        setIngredients(ingData);
        setMenuItems(menuData);

        // Fetch recipes for all menu items
        const recipePairs = await Promise.all(
          menuData.map(async (m) => {
            const recipe = await loadMenuItemRecipe(m.id);
            return [m.id, recipe] as const;
          })
        );
        const map: Record<string, MenuItemIngredient[]> = {};
        recipePairs.forEach(([id, recipe]) => {
          map[id] = recipe;
        });
        setRecipesByMenuId(map);
      } catch (err: any) {
        console.error('Failed to load expense page data:', err);
        toast.error('Failed to load expense and COGS data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ════════════════════════════════════════════════════════════
  // 1. FILTERED SALES & COGS CALCULATION (SECTION 1)
  // ════════════════════════════════════════════════════════════
  const salesInPeriod = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.createdAt);
      const matchFrom = !dateFrom || d >= startOfDayLocal(dateFrom);
      const matchTo = !dateTo || d <= endOfDayLocal(dateTo);
      return matchFrom && matchTo;
    });
  }, [sales, dateFrom, dateTo]);

  const completedSalesInPeriod = useMemo(() => {
    return salesInPeriod.filter((s) => s.status === 'completed');
  }, [salesInPeriod]);

  const refundedSalesInPeriod = useMemo(() => {
    return salesInPeriod.filter((s) => s.status === 'refunded');
  }, [salesInPeriod]);

  // Fallback recipe unit cost map
  const fallbackRecipeCogsMap = useMemo(() => {
    const map: Record<string, number> = {};
    menuItems.forEach((item) => {
      const recipe = recipesByMenuId[item.id] || [];
      const servingCost = recipe.reduce((acc, r) => {
        const ing = ingredients.find((i) => i.id === r.ingredient_id) || r.ingredient;
        const lineCost = calculateIngredientCost(
          Number(r.quantity_used) || 0,
          r.unit || ing?.unit || 'pcs',
          ing
        );
        return acc + lineCost;
      }, 0);
      map[item.id] = servingCost;
    });
    return map;
  }, [menuItems, recipesByMenuId, ingredients]);

  // Breakdown of product COGS into Ingredients vs Packaging & Supplies
  const cogsBreakdown = useMemo(() => {
    const qtySoldMap: Record<
      string,
      {
        id: string;
        name: string;
        qtySold: number;
        ingredientsCogs: number;
        suppliesCogs: number;
        totalCogs: number;
      }
    > = {};

    completedSalesInPeriod.forEach((sale) => {
      (sale.items || []).forEach((item: any) => {
        const id = item.menu_item_id || item.product?.id || item.id || item.name;
        const name = item.name || item.product?.name || 'Unknown Item';
        const qty = Number(item.qty || 1);

        const cogsIngPerServing =
          item.cogs_per_serving != null
            ? Number(item.cogs_per_serving)
            : fallbackRecipeCogsMap[id] || 0;

        const cogsSuppliesPerServing =
          item.cogs_supplies_per_serving != null ? Number(item.cogs_supplies_per_serving) : 0;

        if (!qtySoldMap[id]) {
          qtySoldMap[id] = {
            id,
            name,
            qtySold: 0,
            ingredientsCogs: 0,
            suppliesCogs: 0,
            totalCogs: 0,
          };
        }

        qtySoldMap[id].qtySold += qty;
        qtySoldMap[id].ingredientsCogs += qty * cogsIngPerServing;
        qtySoldMap[id].suppliesCogs += qty * cogsSuppliesPerServing;
        qtySoldMap[id].totalCogs += qty * (cogsIngPerServing + cogsSuppliesPerServing);
      });
    });

    return Object.values(qtySoldMap).filter((p) => p.qtySold > 0);
  }, [completedSalesInPeriod, fallbackRecipeCogsMap]);

  const orderPackagingCogs = useMemo(() => {
    return completedSalesInPeriod.reduce((sum, sale) => {
      return sum + Number(sale.orderSuppliesCogs || 0);
    }, 0);
  }, [completedSalesInPeriod]);

  const totalLineIngredientsCogs = useMemo(() => {
    return cogsBreakdown.reduce((sum, item) => sum + item.ingredientsCogs, 0);
  }, [cogsBreakdown]);

  const totalLineSuppliesCogs = useMemo(() => {
    return cogsBreakdown.reduce((sum, item) => sum + item.suppliesCogs, 0);
  }, [cogsBreakdown]);

  const totalLineCogs = useMemo(() => {
    return totalLineIngredientsCogs + totalLineSuppliesCogs;
  }, [totalLineIngredientsCogs, totalLineSuppliesCogs]);

  const refundedCogsWastage = useMemo(() => {
    let sum = 0;
    refundedSalesInPeriod.forEach((sale) => {
      (sale.items || []).forEach((item: any) => {
        const id = item.menu_item_id || item.product?.id || item.id;
        const qty = Number(item.qty || 1);
        const ingCost =
          item.cogs_per_serving != null
            ? Number(item.cogs_per_serving)
            : fallbackRecipeCogsMap[id] || 0;
        const supCost =
          item.cogs_supplies_per_serving != null ? Number(item.cogs_supplies_per_serving) : 0;
        sum += qty * (ingCost + supCost);
      });
      sum += Number(sale.orderSuppliesCogs || 0);
    });
    return sum;
  }, [refundedSalesInPeriod, fallbackRecipeCogsMap]);

  const totalCogs = useMemo(() => {
    return totalLineCogs + orderPackagingCogs + refundedCogsWastage;
  }, [totalLineCogs, orderPackagingCogs, refundedCogsWastage]);

  // ════════════════════════════════════════════════════════════
  // 2. FILTERED OPERATING EXPENSES (SECTION 2)
  // ════════════════════════════════════════════════════════════
  const filtered = useMemo(() => {
    return expenses
      .filter((e) => {
        const d = new Date(e.date);
        const matchCat = filterCat === 'All' || e.category === filterCat;
        const matchFrom = !dateFrom || d >= startOfDayLocal(dateFrom);
        const matchTo = !dateTo || d <= endOfDayLocal(dateTo);
        return matchCat && matchFrom && matchTo;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filterCat, dateFrom, dateTo]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filterCat, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedExpenses = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const totalShown = filtered.reduce((s, e) => s + e.amount, 0);

  // Group filtered expenses by category for the Pie Chart
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
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
    window.scrollTo({ top: 350, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingExpense(null);
    setForm(defaultForm);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    const numAmount = Number(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    setSaving(true);
    try {
      if (editingExpense) {
        const updated: Expense = {
          id: editingExpense.id,
          description: form.description.trim(),
          amount: numAmount,
          category: form.category,
          date: toLocalNoon(form.date),
        };
        await updateExpense(updated);
        setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setEditingExpense(null);
        setForm(defaultForm);
        toast.success('Expense updated successfully!');
      } else {
        const newExpense: Expense = {
          id: `exp-${Date.now()}`,
          description: form.description.trim(),
          amount: numAmount,
          category: form.category,
          date: toLocalNoon(form.date),
        };
        await saveExpense(newExpense);
        setExpenses((prev) => [newExpense, ...prev]);
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
      setExpenses((prev) => prev.filter((e) => e.id !== deleteModal.id));
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
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="Expenses & Cost of Goods Sold (COGS)" />
        <main className="page-body">
          {/* Universal Period Filter Toolbar */}
          <div className="card card-pad expenses-filter-toolbar" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Reporting Period:</span>
              </div>
              <div className="expense-filters">
                <input
                  type="date"
                  className="input"
                  aria-label="Filter from date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ maxWidth: 150 }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>to</span>
                <input
                  type="date"
                  className="input"
                  aria-label="Filter to date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ maxWidth: 150 }}
                />
                {(dateFrom || dateTo) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                  >
                    <X size={13} /> Clear Period
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              SECTION 1: COST OF GOODS SOLD (COGS) (PRODUCT BREAKDOWN)
             ════════════════════════════════════════════════════════════ */}
          <div className="card expense-section-card" style={{ marginBottom: 24 }}>
            <div className="report-section-header">
              <h3 className="report-section-title">
                <UtensilsCrossed size={16} color="var(--primary)" />
                SECTION 1: COST OF GOODS SOLD (COGS) (PRODUCT BREAKDOWN)
              </h3>
              <span className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>
                Total COGS:{' '}
                <strong style={{ color: 'var(--success)', marginLeft: 4 }}>
                  ₱{totalCogs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading product COGS breakdown...
              </div>
            ) : cogsBreakdown.length === 0 && orderPackagingCogs === 0 && refundedCogsWastage === 0 ? (
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
                      <th style={{ textAlign: 'right' }}>Ingredients</th>
                      <th style={{ textAlign: 'right' }}>Packaging &amp; Supplies</th>
                      <th style={{ textAlign: 'right' }}>Total COGS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cogsBreakdown.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td style={{ textAlign: 'center' }}>{item.qtySold}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                          ₱
                          {item.ingredientsCogs.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                          ₱
                          {item.suppliesCogs.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: 'var(--danger)',
                          }}
                        >
                          -₱
                          {item.totalCogs.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}

                    {/* Line items subtotal */}
                    <tr
                      style={{
                        background: 'var(--surface-2)',
                        fontWeight: 600,
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      <td style={{ fontWeight: 700 }}>Line items subtotal</td>
                      <td style={{ textAlign: 'center' }}>
                        {cogsBreakdown.reduce((sum, i) => sum + i.qtySold, 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        ₱
                        {totalLineIngredientsCogs.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        ₱
                        {totalLineSuppliesCogs.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                        -₱
                        {totalLineCogs.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>

                    {/* Order packaging (takeout) */}
                    <tr>
                      <td style={{ fontWeight: 600 }}>Order packaging (takeout)</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                        ₱
                        {orderPackagingCogs.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: 'var(--danger)',
                        }}
                      >
                        -₱
                        {orderPackagingCogs.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>

                    {/* Refunded orders (wastage) */}
                    {refundedCogsWastage > 0 && (
                      <tr>
                        <td style={{ fontWeight: 600, color: 'var(--warning, #e67e22)' }}>
                          Refunded orders (wastage)
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: 'var(--danger)',
                          }}
                        >
                          -₱
                          {refundedCogsWastage.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    )}

                    {/* Total COGS (Final Grand Total -> Styled in Green) */}
                    <tr className="table-total-row" style={{ background: 'var(--surface-2)' }}>
                      <td colSpan={4} style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        Total Cost of Goods Sold (COGS)
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: 'var(--success)',
                        }}
                      >
                        ₱
                        {totalCogs.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════
              SECTION 2: OPERATING EXPENSES (OPEX)
             ════════════════════════════════════════════════════════════ */}
          <div className="expense-section-card">
            <div className="report-section-header" style={{ marginBottom: 16 }}>
              <h3 className="report-section-title">
                <ReceiptIcon size={16} color="var(--primary)" />
                SECTION 2: OPERATING EXPENSES (OPEX)
              </h3>
              <span className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>
                Total OPEX:{' '}
                <strong style={{ color: 'var(--danger)', marginLeft: 4 }}>
                  ₱{totalShown.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
            </div>

            <div className="expenses-layout">
              {/* Left Column: Form & Pie Chart */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Record / Edit Form */}
                <motion.div
                  className="card card-pad expense-form-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 18,
                    }}
                  >
                    <h3 style={{ margin: 0 }}>
                      {editingExpense ? 'Edit Expense' : 'Record Expense'}
                    </h3>
                    {editingExpense && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleCancelEdit}
                        style={{ fontSize: '0.75rem' }}
                      >
                        <X size={13} /> Cancel
                      </button>
                    )}
                  </div>
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Description *</label>
                      <input
                        className="input"
                        placeholder="e.g. Electric bill July, Coffee beans shipment"
                        value={form.description}
                        onChange={(e) => f('description', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount (₱) *</label>
                      <input
                        type="number"
                        className="input"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={(e) => f('amount', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select
                        className="input select"
                        value={form.category}
                        onChange={(e) => f('category', e.target.value)}
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date</label>
                      <input
                        type="date"
                        className="input"
                        value={form.date}
                        onChange={(e) => f('date', e.target.value)}
                      />
                    </div>
                    <motion.button
                      type="submit"
                      className={`btn ${editingExpense ? 'btn-success' : 'btn-primary'}`}
                      style={{ marginTop: 4 }}
                      disabled={saving}
                      whileTap={{ scale: 0.97 }}
                    >
                      {saving ? (
                        <span className="spinner-sm" />
                      ) : editingExpense ? (
                        <>
                          <Check size={15} /> Update Expense
                        </>
                      ) : (
                        <>
                          <Plus size={15} /> Record Expense
                        </>
                      )}
                    </motion.button>
                  </form>
                </motion.div>

                {/* Expenses by Category Pie Chart */}
                <motion.div
                  className="card card-pad"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1rem',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
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
                        <Tooltip
                          formatter={(v: any) =>
                            `₱${Number(v || 0).toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </motion.div>
              </div>

              {/* Right Column: History */}
              <motion.div
                className="card expense-history-card"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Expense History ({filtered.length})</h3>
                    <span className="badge badge-neutral" style={{ fontSize: '0.85rem' }}>
                      Total:{' '}
                      <strong style={{ color: 'var(--danger)', marginLeft: 4 }}>
                        ₱{totalShown.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </span>
                  </div>
                  <div className="expense-filters">
                    <select
                      className="input select"
                      value={filterCat}
                      onChange={(e) => setFilterCat(e.target.value)}
                      style={{ maxWidth: 160 }}
                    >
                      <option value="All">All Categories</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    {filterCat !== 'All' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setFilterCat('All')}
                      >
                        <X size={13} /> Clear Category
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
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedExpenses.map((e) => (
                        <motion.tr key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {format(new Date(e.date), 'MMM dd, yyyy')}
                          </td>
                          <td style={{ fontWeight: 500 }}>{e.description}</td>
                          <td>
                            <span className="badge badge-info">{e.category}</span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--danger)', textAlign: 'right' }}>
                            -₱{e.amount.toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
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
                    <div className="empty-state">
                      <ReceiptIcon size={32} />
                      <p>No operating expenses found for selected period</p>
                    </div>
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
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteModal(null)}
          >
            <motion.div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                  <AlertTriangle size={18} /> Delete Expense
                </h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setDeleteModal(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  Are you sure you want to delete the expense <strong>"{deleteModal.description}"</strong> (₱
                  {deleteModal.amount.toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  )?
                </p>
                <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteModal(null)} disabled={deleting}>
                  Cancel
                </button>
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
