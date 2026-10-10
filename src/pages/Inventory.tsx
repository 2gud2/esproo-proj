import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Package, X, Save, Trash2, Calendar,
  Clock, AlertTriangle, AlertCircle, CheckCircle,
  ArrowDown, ArrowUp, RefreshCw, Layers
} from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import type { Ingredient, Sale, MenuItemIngredient } from '../lib/mockData';
import {
  loadIngredients,
  saveIngredient,
  deleteIngredient,
  adjustIngredientStock,
  loadSales,
  loadMenuItems,
  loadMenuItemRecipe
} from '../lib/db';
import { convertUnitQuantity } from '../lib/unitConversion';
import toast from 'react-hot-toast';
import './Inventory.css';

const PAGE_SIZE = 20;

// Curated Coffee Shop Units of Measurement
export const COFFEE_SHOP_UNITS = [
  { label: 'Grams (g)', value: 'g', display: 'Grams' },
  { label: 'Kilograms (kg)', value: 'kg', display: 'Kilograms' },
  { label: 'Milliliters (ml)', value: 'ml', display: 'Milliliters' },
  { label: 'Liters (L)', value: 'L', display: 'Liters' },
  { label: 'Ounces (oz)', value: 'oz', display: 'Ounces' },
  { label: 'Fluid Ounces (fl oz)', value: 'fl oz', display: 'Fluid Ounces' },
  { label: 'Pounds (lb)', value: 'lb', display: 'Pounds' },
  { label: 'Pieces (pcs)', value: 'pcs', display: 'Pieces' },
  { label: 'Espresso Shots (shots)', value: 'shots', display: 'Shots' },
  { label: 'Syrup Pumps (pumps)', value: 'pumps', display: 'Pumps' },
  { label: 'Scoops (scoops)', value: 'scoops', display: 'Scoops' },
  { label: 'Dashes (dashes)', value: 'dashes', display: 'Dashes' },
  { label: 'Bottles (bottles)', value: 'bottles', display: 'Bottles' },
  { label: 'Cans (cans)', value: 'cans', display: 'Cans' },
  { label: 'Boxes (boxes)', value: 'boxes', display: 'Boxes' },
  { label: 'Packs (packs)', value: 'packs', display: 'Packs' },
  { label: 'Bags (bags)', value: 'bags', display: 'Bags' },
  { label: 'Other (Custom Unit)', value: 'Other', display: 'Custom' },
];

type Timeframe = 'today' | 'this_week' | 'this_month' | 'all_time' | 'custom';

const defaultForm = {
  name: '',
  unit: 'g',
  stock_quantity: '' as number | string,
  low_stock_threshold: '10' as number | string,
  cost_per_unit: '' as number | string,
  expiration_date: '',
  auto_deduct_expired: false,
};

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [recipesByMenuId, setRecipesByMenuId] = useState<Record<string, MenuItemIngredient[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Time frame selector state
  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Modals state
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [unitSelect, setUnitSelect] = useState('g');
  const [customUnit, setCustomUnit] = useState('');

  // Adjust Stock Modal state
  const [adjustModal, setAdjustModal] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'reduce' | 'set'>('add');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Restock / Delivery');

  // Delete Modal state
  const [deleteModal, setDeleteModal] = useState<Ingredient | null>(null);

  async function fetchData() {
    try {
      setLoading(true);
      const [ings, salesData, menuItems] = await Promise.all([
        loadIngredients(),
        loadSales(),
        loadMenuItems(false)
      ]);

      setIngredients(ings);
      setSales(salesData);

      // Load recipes for menu items to accurately calculate usage
      const recipeMap: Record<string, MenuItemIngredient[]> = {};
      await Promise.all(
        menuItems.map(async m => {
          const rec = await loadMenuItemRecipe(m.id);
          recipeMap[m.id] = rec;
        })
      );
      setRecipesByMenuId(recipeMap);

      // Auto-check for expired items with auto_deduct enabled
      checkAndAutoDeductExpired(ings);
    } catch (err) {
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Check and automatically deduct expired stock if configured
  async function checkAndAutoDeductExpired(currentIngredients: Ingredient[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredToDeduct = currentIngredients.filter(i => {
      if (!i.expiration_date || !i.auto_deduct_expired || i.stock_quantity <= 0) return false;
      const expDate = new Date(i.expiration_date + 'T00:00:00');
      return expDate < today;
    });

    if (expiredToDeduct.length > 0) {
      for (const item of expiredToDeduct) {
        await adjustIngredientStock(
          item.id,
          item.stock_quantity,
          'reduce',
          `Auto-deducted expired stock (${item.expiration_date})`
        );
      }
      toast((t) => (
        <span>
          <strong>Auto-deducted Expired Stock:</strong> {expiredToDeduct.length} item(s) written off due to expiration.
        </span>
      ), { icon: '⚠️', duration: 5000 });

      // Refresh ingredients
      const refreshed = await loadIngredients();
      setIngredients(refreshed);
    }
  }

  // Calculate usage per ingredient in selected timeframe
  const usageMap = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    let startTime: number | null = null;
    let endTime: number | null = null;

    if (timeframe === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      startTime = d.getTime();
    } else if (timeframe === 'this_week') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      startTime = monday.getTime();
    } else if (timeframe === 'this_month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      startTime = d.getTime();
    } else if (timeframe === 'custom' && customStart && customEnd) {
      startTime = new Date(customStart + 'T00:00:00').getTime();
      endTime = new Date(customEnd + 'T23:59:59').getTime();
    }

    const filteredSales = sales.filter(s => {
      if (s.status !== 'completed') return false;
      const saleTime = new Date(s.createdAt).getTime();
      if (startTime && saleTime < startTime) return false;
      if (endTime && saleTime > endTime) return false;
      return true;
    });

    for (const sale of filteredSales) {
      for (const item of (sale.items || [])) {
        const menuId = (item as any).menu_item_id || (item as any).product?.id;
        const qtySold = Number(item.qty) || 0;
        const recipe = recipesByMenuId[menuId] || [];

        for (const r of recipe) {
          const ing = ingredients.find(i => i.id === r.ingredient_id);
          if (!ing) continue;
          const totalUsedInRecipeUnit = Number(r.quantity_used) * qtySold;
          const converted = convertUnitQuantity(totalUsedInRecipeUnit, r.unit || ing.unit, ing.unit);
          map[ing.id] = (map[ing.id] || 0) + converted;
        }
      }
    }

    return map;
  }, [sales, recipesByMenuId, ingredients, timeframe, customStart, customEnd]);

  // Expiration info helper
  function getExpirationInfo(expirationDate?: string | null) {
    if (!expirationDate) return { status: 'none', label: '', daysLeft: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expirationDate + 'T00:00:00');
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'expired', label: `Expired ${Math.abs(diffDays)}d ago`, daysLeft: diffDays };
    } else if (diffDays === 0) {
      return { status: 'expired_today', label: 'Expires Today', daysLeft: 0 };
    } else if (diffDays <= 7) {
      return { status: 'near_expiry', label: `Expires in ${diffDays}d`, daysLeft: diffDays };
    } else {
      return { status: 'good', label: `Exp: ${expirationDate}`, daysLeft: diffDays };
    }
  }

  // Row status helper
  function getItemStatus(ingredient: Ingredient, expInfo: ReturnType<typeof getExpirationInfo>) {
    if (ingredient.stock_quantity <= 0) {
      return { label: 'Out of Stock', badgeClass: 'badge-danger' };
    }
    if (expInfo.status === 'expired' || expInfo.status === 'expired_today') {
      return { label: 'Expired', badgeClass: 'badge-danger' };
    }
    if (ingredient.stock_quantity <= ingredient.low_stock_threshold) {
      return { label: 'Low Stock', badgeClass: 'badge-warning' };
    }
    if (expInfo.status === 'near_expiry') {
      return { label: 'Near Expiry', badgeClass: 'badge-warning' };
    }
    return { label: 'OK', badgeClass: 'badge-success' };
  }

  // Filtered ingredients
  const filtered = useMemo(() => ingredients.filter(i => {
    return i.name.toLowerCase().includes(search.toLowerCase()) ||
           i.unit.toLowerCase().includes(search.toLowerCase());
  }), [ingredients, search]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedIngredients = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  // Summary counts
  const lowCount = ingredients.filter(i => i.stock_quantity <= i.low_stock_threshold && i.stock_quantity > 0).length;
  const expiredCount = ingredients.filter(i => {
    const exp = getExpirationInfo(i.expiration_date);
    return (exp.status === 'expired' || exp.status === 'expired_today') && i.stock_quantity > 0;
  }).length;

  function openAdd() {
    setForm({
      name: '',
      unit: 'g',
      stock_quantity: '',
      low_stock_threshold: '10',
      cost_per_unit: '',
      expiration_date: '',
      auto_deduct_expired: false,
    });
    setUnitSelect('g');
    setCustomUnit('');
    setEditing(null);
    setModal('add');
  }

  function openEdit(i: Ingredient) {
    setForm({
      name: i.name,
      unit: i.unit,
      stock_quantity: i.stock_quantity != null ? String(i.stock_quantity) : '',
      low_stock_threshold: i.low_stock_threshold != null ? String(i.low_stock_threshold) : '10',
      cost_per_unit: i.cost_per_unit != null ? String(i.cost_per_unit) : '',
      expiration_date: i.expiration_date || '',
      auto_deduct_expired: i.auto_deduct_expired ?? false,
    });
    const found = COFFEE_SHOP_UNITS.find(u => u.value === i.unit);
    if (found) {
      setUnitSelect(found.value);
      setCustomUnit('');
    } else {
      setUnitSelect('Other');
      setCustomUnit(i.unit);
    }
    setEditing(i);
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Ingredient name is required'); return; }
    
    const finalUnit = unitSelect === 'Other' ? customUnit.trim() : unitSelect;
    if (!finalUnit) { toast.error('Please specify a unit of measurement'); return; }
    
    const stockQty = form.stock_quantity === '' ? 0 : Number(form.stock_quantity);
    const threshold = form.low_stock_threshold === '' ? 0 : Number(form.low_stock_threshold);
    const costPerUnit = form.cost_per_unit === '' ? 0 : Number(form.cost_per_unit);

    if (isNaN(stockQty) || stockQty < 0) { toast.error('Stock quantity cannot be negative'); return; }
    if (isNaN(threshold) || threshold < 0) { toast.error('Threshold cannot be negative'); return; }
    if (isNaN(costPerUnit) || costPerUnit < 0) { toast.error('Cost cannot be negative'); return; }

    try {
      await saveIngredient({
        id: editing?.id,
        name: form.name.trim(),
        unit: finalUnit,
        stock_quantity: stockQty,
        low_stock_threshold: threshold,
        cost_per_unit: costPerUnit,
        expiration_date: form.expiration_date || null,
        auto_deduct_expired: form.auto_deduct_expired,
      });
      toast.success(editing ? 'Ingredient updated!' : 'Ingredient added!');
      setModal(null);
      await fetchData();
    } catch (err) {
      toast.error('Failed to save ingredient');
    }
  }

  async function handleDeductExpired(item: Ingredient) {
    if (item.stock_quantity <= 0) return;
    try {
      await adjustIngredientStock(
        item.id,
        item.stock_quantity,
        'reduce',
        `Spoiled / Expired Stock Deduction (${item.expiration_date})`
      );
      toast.success(`Deducted ${item.stock_quantity} ${item.unit} of expired ${item.name}`);
      await fetchData();
    } catch (err) {
      toast.error('Failed to deduct expired stock');
    }
  }

  async function handleAdjustStock() {
    if (!adjustModal) return;
    if (adjustQty <= 0 && adjustType !== 'set') {
      toast.error('Please enter a valid quantity');
      return;
    }
    try {
      await adjustIngredientStock(adjustModal.id, adjustQty, adjustType, adjustReason);
      toast.success(`Stock updated for ${adjustModal.name}`);
      setAdjustModal(null);
      setAdjustQty(0);
      await fetchData();
    } catch (err) {
      toast.error('Failed to adjust stock');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteModal) return;
    try {
      await deleteIngredient(deleteModal.id);
      toast.success(`"${deleteModal.name}" removed from inventory`);
      setDeleteModal(null);
      await fetchData();
    } catch (err) {
      toast.error('Failed to delete ingredient');
    }
  }

  function f(field: keyof typeof form, val: any) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          title="Raw Ingredients Inventory"
          searchPlaceholder="Search ingredients by name or unit..."
          onSearch={setSearch}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={15} /> Add Ingredient
              </button>
            </div>
          }
        />
        <main className="page-body">
          {/* Stats Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
            <div className="card card-pad">
              <div className="stat-sub">Total Raw Ingredients</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{ingredients.length}</div>
              <div className="stat-label">Master stock catalogue</div>
            </div>
            <div className="card card-pad">
              <div className="stat-sub">Low Stock Alerts</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: lowCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {lowCount}
              </div>
              <div className="stat-label">Below threshold</div>
            </div>
            <div className="card card-pad">
              <div className="stat-sub">Expired / Near Expiry</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: expiredCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {expiredCount}
              </div>
              <div className="stat-label">Requires action or write-off</div>
            </div>
          </div>

          {/* Master List Card */}
          <div className="card">
            {/* Header with Title and Timeframe Selector */}
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>INGREDIENTS MASTER LIST</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Real-time stock deduction, usage calculation, and expiration tracking
                </p>
              </div>

              {/* Time Frame Selector */}
              <div className="timeframe-bar">
                <span className="timeframe-label">
                  <Clock size={13} /> Timeframe:
                </span>
                <button
                  className={`timeframe-btn ${timeframe === 'today' ? 'active' : ''}`}
                  onClick={() => setTimeframe('today')}
                >
                  Today
                </button>
                <button
                  className={`timeframe-btn ${timeframe === 'this_week' ? 'active' : ''}`}
                  onClick={() => setTimeframe('this_week')}
                >
                  This Week
                </button>
                <button
                  className={`timeframe-btn ${timeframe === 'this_month' ? 'active' : ''}`}
                  onClick={() => setTimeframe('this_month')}
                >
                  This Month
                </button>
                <button
                  className={`timeframe-btn ${timeframe === 'all_time' ? 'active' : ''}`}
                  onClick={() => setTimeframe('all_time')}
                >
                  All Time
                </button>
                <button
                  className={`timeframe-btn ${timeframe === 'custom' ? 'active' : ''}`}
                  onClick={() => setTimeframe('custom')}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Custom Date Range Bar (if selected) */}
            {timeframe === 'custom' && (
              <div style={{ padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Custom Range:</span>
                <input
                  type="date"
                  className="input"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  className="input"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
            )}

            {/* Table */}
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading ingredients master list...
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ingredients</th>
                      <th>Unit</th>
                      <th>Current Stock</th>
                      <th>Used</th>
                      <th>Remaining Stock</th>
                      <th>Low-Stock Threshold</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedIngredients.map(i => {
                      const usedQty = usageMap[i.id] || 0;
                      const currentStock = i.stock_quantity + usedQty;
                      const expInfo = getExpirationInfo(i.expiration_date);
                      const statusObj = getItemStatus(i, expInfo);
                      const isExpired = (expInfo.status === 'expired' || expInfo.status === 'expired_today') && i.stock_quantity > 0;

                      // Format display unit
                      const unitDef = COFFEE_SHOP_UNITS.find(u => u.value === i.unit);
                      const displayUnitName = unitDef ? unitDef.display : i.unit;

                      return (
                        <motion.tr key={i.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          {/* Ingredients */}
                          <td>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{i.name}</div>
                              {i.expiration_date && (
                                <span className={`expiry-badge ${expInfo.status}`}>
                                  <Calendar size={10} /> {expInfo.label}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Unit */}
                          <td>
                            <span className="badge badge-neutral" title={i.unit}>
                              {displayUnitName}
                            </span>
                          </td>

                          {/* Current Stock (Initial/Period Stock) */}
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {Number.isInteger(currentStock) ? currentStock : parseFloat(currentStock.toFixed(3))} {i.unit}
                          </td>

                          {/* Used */}
                          <td style={{ color: usedQty > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: usedQty > 0 ? 600 : 400 }}>
                            {Number.isInteger(usedQty) ? usedQty : parseFloat(usedQty.toFixed(3))} {i.unit}
                          </td>

                          {/* Remaining Stock */}
                          <td style={{ fontWeight: 700, color: i.stock_quantity <= i.low_stock_threshold ? 'var(--danger)' : 'var(--text-primary)' }}>
                            {Number.isInteger(i.stock_quantity) ? i.stock_quantity : parseFloat(i.stock_quantity.toFixed(3))} {i.unit}
                          </td>

                          {/* Low-Stock Threshold */}
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {i.low_stock_threshold} {i.unit}
                          </td>

                          {/* Status */}
                          <td>
                            <span className={`badge ${statusObj.badgeClass}`}>
                              ● {statusObj.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {isExpired && (
                                <button
                                  className="btn btn-sm btn-ghost"
                                  style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '4px 8px' }}
                                  onClick={() => handleDeductExpired(i)}
                                  title="Deduct and zero-out expired stock"
                                >
                                  Deduct Expired
                                </button>
                              )}
                              <button
                                className="btn btn-icon btn-ghost"
                                onClick={() => {
                                  setAdjustModal(i);
                                  setAdjustType('add');
                                  setAdjustQty(0);
                                  setAdjustReason('Restock / Delivery');
                                }}
                                title="Adjust Stock / Restock"
                              >
                                <Layers size={14} />
                              </button>
                              <button
                                className="btn btn-icon btn-ghost"
                                onClick={() => openEdit(i)}
                                title="Edit Ingredient"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn btn-icon btn-ghost"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => setDeleteModal(i)}
                                title="Delete Ingredient"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {!loading && filtered.length === 0 && (
                <div className="empty-state">
                  <Package size={32} />
                  <p>No raw ingredients found</p>
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
          </div>
        </main>
      </div>

      {/* Add / Edit Ingredient Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <motion.div
              className="modal modal-wide"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>{modal === 'add' ? 'Add Raw Ingredient' : 'Edit Ingredient'}</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setModal(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ingredient Name *</label>
                  <input
                    className="input"
                    placeholder="e.g. Coffee Beans, Milk, Matcha Powder"
                    value={form.name}
                    onChange={e => f('name', e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Unit of Measurement *</label>
                    <select
                      className="input select"
                      value={unitSelect}
                      onChange={e => setUnitSelect(e.target.value)}
                    >
                      {COFFEE_SHOP_UNITS.map(u => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    {unitSelect === 'Other' && (
                      <input
                        className="input"
                        placeholder="Type custom unit (e.g. pinch, dash)"
                        value={customUnit}
                        onChange={e => setCustomUnit(e.target.value)}
                        style={{ marginTop: 6 }}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Current Stock Quantity *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      placeholder="0"
                      value={form.stock_quantity}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const v = e.target.value.replace(',', '.');
                        if (v === '' || /^\d*\.?\d*$/.test(v)) f('stock_quantity', v);
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cost per Unit (₱) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      placeholder="0.00"
                      value={form.cost_per_unit}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const v = e.target.value.replace(',', '.');
                        if (v === '' || /^\d*\.?\d*$/.test(v)) f('cost_per_unit', v);
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Low-Stock Alert Threshold *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      placeholder="0"
                      value={form.low_stock_threshold}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const v = e.target.value.replace(',', '.');
                        if (v === '' || /^\d*\.?\d*$/.test(v)) f('low_stock_threshold', v);
                      }}
                    />
                  </div>
                </div>

                {/* Expiration Settings */}
                <div style={{ marginTop: 14, padding: '14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Calendar size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Expiration Management</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Expiration Date (Optional)</label>
                      <input
                        type="date"
                        className="input"
                        value={form.expiration_date || ''}
                        onChange={e => f('expiration_date', e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 18 }}>
                      <input
                        type="checkbox"
                        id="autoDeductCheck"
                        checked={form.auto_deduct_expired || false}
                        onChange={e => f('auto_deduct_expired', e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <label htmlFor="autoDeductCheck" style={{ fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <strong>Auto-deduct stock</strong> when expired date is reached
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave}>
                  <Save size={15} /> {modal === 'add' ? 'Add Ingredient' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjust Stock Modal */}
      <AnimatePresence>
        {adjustModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAdjustModal(null)}
          >
            <motion.div
              className="modal"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>Adjust Stock: {adjustModal.name}</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setAdjustModal(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    className={`adjust-modal-type-btn ${adjustType === 'add' ? 'active add' : ''}`}
                    onClick={() => { setAdjustType('add'); setAdjustReason('Restock / Delivery'); }}
                  >
                    <ArrowUp size={14} /> Add Stock (+)
                  </button>
                  <button
                    className={`adjust-modal-type-btn ${adjustType === 'reduce' ? 'active reduce' : ''}`}
                    onClick={() => { setAdjustType('reduce'); setAdjustReason('Spoilage / Wastage'); }}
                  >
                    <ArrowDown size={14} /> Deduct Stock (-)
                  </button>
                  <button
                    className={`adjust-modal-type-btn ${adjustType === 'set' ? 'active set' : ''}`}
                    onClick={() => { setAdjustType('set'); setAdjustReason('Physical Inventory Count'); }}
                  >
                    Set Exact (=)
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {adjustType === 'add' && `Quantity to Add (${adjustModal.unit})`}
                    {adjustType === 'reduce' && `Quantity to Deduct (${adjustModal.unit})`}
                    {adjustType === 'set' && `New Exact Stock (${adjustModal.unit})`}
                  </label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    step="0.001"
                    value={adjustQty || ''}
                    onChange={e => setAdjustQty(Number(e.target.value))}
                    placeholder="0"
                    autoFocus
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Current Remaining Stock: <strong>{adjustModal.stock_quantity} {adjustModal.unit}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Notes</label>
                  <input
                    className="input"
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    placeholder="e.g. Restock from supplier, Spoilage, Physical Count"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setAdjustModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAdjustStock}>
                  Save Adjustment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>Delete Raw Ingredient</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setDeleteModal(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Are you sure you want to remove <strong>"{deleteModal.name}"</strong> from your inventory?
                  Any recipes referencing this ingredient will need to be updated.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                  <Trash2 size={15} /> Delete Ingredient
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
