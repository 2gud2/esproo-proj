import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, X, Trash2, Calendar,
  AlertTriangle, ChevronDown, ChevronRight,
  PackagePlus, Layers, CheckCircle, Package, Utensils
} from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import type { Ingredient, IngredientBatch } from '../lib/mockData';
import {
  loadIngredients,
  saveIngredient,
  deleteIngredient,
  adjustIngredientStock,
  loadBatches,
  restockIngredient,
  updateBatch,
  expireBatches
} from '../lib/db';
import { isOutOfStock, isLowStock, getExpirationInfo, type ExpirationInfo } from '../lib/stockStatus';
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

type ItemTypeFilter = 'all' | 'ingredient' | 'supply';

const defaultForm = {
  name: '',
  unit: 'g',
  item_type: 'ingredient' as 'ingredient' | 'supply',
  stock_quantity: '' as number | string,
  low_stock_threshold: '10' as number | string,
  cost_per_unit: '' as number | string,
  auto_deduct_expired: false,
};

const defaultRestockForm = {
  quantity: '',
  cost_per_unit: '',
  received_at: new Date().toISOString().split('T')[0],
  expiration_date: '',
  supplier: '',
  note: '',
};

const defaultEditBatchForm = {
  expiration_date: '',
  cost_per_unit: '',
  supplier: '',
  note: '',
};

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [batches, setBatches] = useState<IngredientBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [page, setPage] = useState(1);

  // Expanded rows for batch breakdown
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Add / Edit Ingredient modal state
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [unitSelect, setUnitSelect] = useState('g');
  const [customUnit, setCustomUnit] = useState('');

  // Restock Modal state
  const [restockModal, setRestockModal] = useState<Ingredient | null>(null);
  const [restockForm, setRestockForm] = useState(defaultRestockForm);

  // Edit Batch Modal state
  const [editBatchModal, setEditBatchModal] = useState<IngredientBatch | null>(null);
  const [editBatchForm, setEditBatchForm] = useState(defaultEditBatchForm);

  // Adjust Stock Modal state (Deduct and Set Exact)
  const [adjustModal, setAdjustModal] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'reduce' | 'set'>('reduce');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Stock Adjustment');

  // Delete Modal state
  const [deleteModal, setDeleteModal] = useState<Ingredient | null>(null);

  async function fetchData() {
    try {
      setLoading(true);
      const [ings, batchData] = await Promise.all([
        loadIngredients(),
        loadBatches()
      ]);

      setIngredients(ings);
      setBatches(batchData);

      // Call expireBatches() on page load to auto-write-off expired batches
      try {
        const expiredCount = await expireBatches();
        if (expiredCount > 0) {
          toast(
            <span>
              <strong>Auto-deducted Expired Stock:</strong> {expiredCount} batch(es) written off due to expiration.
            </span>,
            { icon: '⚠️', duration: 5000 }
          );
          const [refreshedIngs, refreshedBatches] = await Promise.all([loadIngredients(), loadBatches()]);
          setIngredients(refreshedIngs);
          setBatches(refreshedBatches);
        }
      } catch (err) {
        console.error('Error during auto-deduct expireBatches', err);
      }
    } catch {
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function toggleRowExpanded(ingredientId: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }

  // Group batches by ingredient
  const batchesByIngredient = useMemo(() => {
    const map: Record<string, IngredientBatch[]> = {};
    for (const b of batches) {
      if (!map[b.ingredient_id]) map[b.ingredient_id] = [];
      map[b.ingredient_id].push(b);
    }
    return map;
  }, [batches]);

  // Find active (earliest-expiring) batch for each ingredient
  const activeBatchMap = useMemo(() => {
    const map: Record<string, IngredientBatch | null> = {};
    for (const ing of ingredients) {
      const ingBatches = batchesByIngredient[ing.id] || [];
      const activeList = ingBatches.filter(b => b.status === 'active');
      if (activeList.length === 0) {
        map[ing.id] = ingBatches[0] || null;
      } else {
        // Earliest expiring active batch, or first active
        map[ing.id] = activeList[0];
      }
    }
    return map;
  }, [ingredients, batchesByIngredient]);

  // Row status helper
  function getItemStatus(ingredient: Ingredient, expInfo: ExpirationInfo) {
    if (isOutOfStock(ingredient)) {
      return { label: 'Out of Stock', badgeClass: 'badge-danger' };
    }
    if (expInfo.status === 'expired' || expInfo.status === 'expired_today') {
      return { label: 'Expired', badgeClass: 'badge-danger' };
    }
    if (isLowStock(ingredient)) {
      return { label: 'Low Stock', badgeClass: 'badge-warning' };
    }
    if (expInfo.status === 'near_expiry') {
      return { label: 'Near Expiry', badgeClass: 'badge-warning' };
    }
    return { label: 'OK', badgeClass: 'badge-success' };
  }

  // Filtered inventory items
  const filtered = useMemo(() => ingredients.filter(i => {
    const itemType = i.item_type || 'ingredient';
    if (itemTypeFilter !== 'all' && itemType !== itemTypeFilter) return false;
    return i.name.toLowerCase().includes(search.toLowerCase()) ||
           i.unit.toLowerCase().includes(search.toLowerCase());
  }), [ingredients, itemTypeFilter, search]);

  useEffect(() => { setPage(1); }, [search, itemTypeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedIngredients = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  // Counts by item type
  const ingredientCount = useMemo(() => ingredients.filter(i => (i.item_type || 'ingredient') === 'ingredient').length, [ingredients]);
  const supplyCount = useMemo(() => ingredients.filter(i => i.item_type === 'supply').length, [ingredients]);

  // Summary counts using unified stockStatus helpers
  const lowCount = ingredients.filter(isLowStock).length;
  const outCount = ingredients.filter(isOutOfStock).length;
  const totalStockAlerts = lowCount + outCount;

  const expiredCount = ingredients.filter(i => {
    const exp = getExpirationInfo(i.expiration_date);
    return (exp.status === 'expired' || exp.status === 'expired_today') && i.stock_quantity > 0;
  }).length;

  const nearExpiryCount = ingredients.filter(i => {
    const exp = getExpirationInfo(i.expiration_date);
    return exp.status === 'near_expiry' && i.stock_quantity > 0;
  }).length;

  const totalExpiryAlerts = expiredCount + nearExpiryCount;

  function openAdd() {
    setForm({
      name: '',
      unit: 'g',
      item_type: itemTypeFilter === 'supply' ? 'supply' : 'ingredient',
      stock_quantity: '',
      low_stock_threshold: '10',
      cost_per_unit: '',
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
      item_type: i.item_type || 'ingredient',
      stock_quantity: i.stock_quantity != null ? String(i.stock_quantity) : '',
      low_stock_threshold: i.low_stock_threshold != null ? String(i.low_stock_threshold) : '10',
      cost_per_unit: i.cost_per_unit != null ? String(i.cost_per_unit) : '',
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

  function openRestock(i: Ingredient) {
    setRestockModal(i);
    setRestockForm({
      quantity: '',
      cost_per_unit: i.cost_per_unit != null ? String(i.cost_per_unit) : '',
      received_at: new Date().toISOString().split('T')[0],
      expiration_date: '',
      supplier: '',
      note: '',
    });
  }

  function openEditBatch(batch: IngredientBatch) {
    setEditBatchModal(batch);
    setEditBatchForm({
      expiration_date: batch.expiration_date || '',
      cost_per_unit: batch.cost_per_unit != null ? String(batch.cost_per_unit) : '',
      supplier: batch.supplier || '',
      note: batch.note || '',
    });
  }

  async function handleSaveIngredient() {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    
    const finalUnit = unitSelect === 'Other' ? customUnit.trim() : unitSelect;
    if (!finalUnit) { toast.error('Please specify a unit of measurement'); return; }
    
    const threshold = form.low_stock_threshold === '' ? 0 : Number(form.low_stock_threshold);
    const costPerUnit = form.cost_per_unit === '' ? 0 : Number(form.cost_per_unit);

    if (isNaN(threshold) || threshold < 0) { toast.error('Threshold cannot be negative'); return; }
    if (isNaN(costPerUnit) || costPerUnit < 0) { toast.error('Cost cannot be negative'); return; }

    try {
      const saved = await saveIngredient({
        id: editing?.id,
        name: form.name.trim(),
        unit: finalUnit,
        item_type: form.item_type,
        low_stock_threshold: threshold,
        cost_per_unit: costPerUnit,
        auto_deduct_expired: form.auto_deduct_expired,
      });

      // If adding new item with initial stock, create initial batch
      if (!editing && form.stock_quantity && Number(form.stock_quantity) > 0) {
        await restockIngredient({
          ingredient_id: saved.id,
          quantity: Number(form.stock_quantity),
          cost_per_unit: costPerUnit,
          received_at: new Date().toISOString().split('T')[0],
          note: 'Initial Opening Balance',
        });
      }

      toast.success(editing ? 'Item updated!' : 'Item added to inventory!');
      setModal(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save inventory item');
    }
  }

  async function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restockModal) return;

    const qty = parseFloat(restockForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity greater than zero');
      return;
    }

    const cost = restockForm.cost_per_unit ? parseFloat(restockForm.cost_per_unit) : (restockModal.cost_per_unit ?? 0);
    if (isNaN(cost) || cost < 0) {
      toast.error('Cost per unit cannot be negative');
      return;
    }

    try {
      await restockIngredient({
        ingredient_id: restockModal.id,
        quantity: qty,
        cost_per_unit: cost,
        received_at: restockForm.received_at || undefined,
        expiration_date: restockForm.expiration_date || null,
        supplier: restockForm.supplier.trim() || null,
        note: restockForm.note.trim() || null,
      });

      toast.success(`Successfully restocked ${qty} ${restockModal.unit} of ${restockModal.name}!`);
      setRestockModal(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restock item');
    }
  }

  async function handleEditBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBatchModal) return;

    const cost = editBatchForm.cost_per_unit ? parseFloat(editBatchForm.cost_per_unit) : 0;
    if (isNaN(cost) || cost < 0) {
      toast.error('Cost cannot be negative');
      return;
    }

    try {
      await updateBatch(editBatchModal.id, {
        expiration_date: editBatchForm.expiration_date || null,
        cost_per_unit: cost,
        supplier: editBatchForm.supplier.trim() || null,
        note: editBatchForm.note.trim() || null,
      });

      toast.success('Batch details updated successfully');
      setEditBatchModal(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update batch');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust stock');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteModal) return;
    try {
      await deleteIngredient(deleteModal.id);
      toast.success(`"${deleteModal.name}" removed from inventory`);
      setDeleteModal(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete item');
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
          title="Inventory"
          searchPlaceholder="Search inventory by name or unit..."
          onSearch={setSearch}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={15} /> Add Item
              </button>
            </div>
          }
        />
        <main className="page-body">
          {/* Stats Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
            <div className="card card-pad">
              <div className="stat-sub">Total Inventory Items</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{ingredients.length}</div>
              <div className="stat-label">{ingredientCount} ingredients · {supplyCount} supplies</div>
            </div>
            <div className="card card-pad">
              <div className="stat-sub">Stock Alerts</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: totalStockAlerts > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {totalStockAlerts}
              </div>
              <div className="stat-label">{lowCount} low · {outCount} out</div>
            </div>
            <div className="card card-pad">
              <div className="stat-sub">Expired / Near Expiry</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: totalExpiryAlerts > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {totalExpiryAlerts}
              </div>
              <div className="stat-label">{expiredCount} expired · {nearExpiryCount} near expiry</div>
            </div>
          </div>

          {/* Master List Card */}
          <div className="card">
            {/* Header with Title and Filter Tabs */}
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>INVENTORY MASTER LIST</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>

                </p>
              </div>

              {/* Item Type Filter Tabs */}
              <div className="inventory-type-tabs">
                <button
                  className={`type-tab-btn ${itemTypeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setItemTypeFilter('all')}
                >
                  <Layers size={13} />
                  <span>All</span>
                  <span className="type-tab-count">{ingredients.length}</span>
                </button>
                <button
                  className={`type-tab-btn ${itemTypeFilter === 'ingredient' ? 'active' : ''}`}
                  onClick={() => setItemTypeFilter('ingredient')}
                >
                  <Utensils size={13} />
                  <span>Ingredients</span>
                  <span className="type-tab-count">{ingredientCount}</span>
                </button>
                <button
                  className={`type-tab-btn ${itemTypeFilter === 'supply' ? 'active' : ''}`}
                  onClick={() => setItemTypeFilter('supply')}
                >
                  <Package size={13} />
                  <span>Supplies</span>
                  <span className="type-tab-count">{supplyCount}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading inventory and batches...
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 44, textAlign: 'center' }}></th>
                      <th>Item</th>
                      <th>Stock Period</th>
                      <th>Current Stock</th>
                      <th>Used</th>
                      <th>Remaining Stock</th>
                      <th>Threshold</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedIngredients.map(i => {
                      const ingBatches = batchesByIngredient[i.id] || [];
                      const activeBatch = activeBatchMap[i.id];
                      const isExpanded = expandedRows.has(i.id);
                      const isSupply = i.item_type === 'supply';

                      // Calculate Current Stock and Used from active batch (or item total)
                      let currentStockVal: number;
                      let usedQty: number;

                      if (activeBatch) {
                        currentStockVal = activeBatch.quantity_received;
                        usedQty = Math.max(0, activeBatch.quantity_received - activeBatch.quantity_remaining);
                      } else {
                        currentStockVal = i.stock_quantity;
                        usedQty = 0;
                      }

                      // Expiration info for active batch or ingredient
                      const expDate = activeBatch?.expiration_date || i.expiration_date;
                      const expInfo = getExpirationInfo(expDate);
                      const statusObj = getItemStatus(i, expInfo);

                      // Format display unit
                      const unitDef = COFFEE_SHOP_UNITS.find(u => u.value === i.unit);
                      const displayUnitName = unitDef ? unitDef.display : i.unit;

                      return (
                        <Fragment key={i.id}>
                          <tr className={isExpanded ? 'parent-row-expanded' : ''}>
                            {/* Expand Chevron */}
                            <td style={{ textAlign: 'center', width: 44, padding: '10px 8px' }}>
                              <button
                                type="button"
                                className={`batch-expand-btn ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => toggleRowExpanded(i.id)}
                                title={isExpanded ? 'Hide batch breakdown' : 'Show batch breakdown'}
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            </td>

                            {/* Item Name, Type Badge & Unit */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                  {i.name}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span className={`badge ${isSupply ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                    {isSupply ? '📦 Supply' : '🌾 Ingredient'}
                                  </span>
                                  <span className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                    {displayUnitName}
                                  </span>
                                  {ingBatches.length > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                      {ingBatches.length} {ingBatches.length === 1 ? 'batch' : 'batches'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Stock Period (<received> → <expiry>) */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 150 }}>
                                {activeBatch ? (
                                  <>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                      {activeBatch.received_at} → {activeBatch.expiration_date || 'No expiry'}
                                    </span>
                                    {activeBatch.expiration_date ? (
                                      <span className={`days-left-chip ${expInfo.status}`}>
                                        <Calendar size={11} /> {expInfo.label}
                                      </span>
                                    ) : (
                                      <span className="days-left-chip none">
                                        No expiry date
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    No batches recorded
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Current Stock */}
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                              {Number.isInteger(currentStockVal) ? currentStockVal : parseFloat(currentStockVal.toFixed(3))} {i.unit}
                            </td>

                            {/* Used */}
                            <td style={{ color: usedQty > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: usedQty > 0 ? 700 : 400, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                              {Number.isInteger(usedQty) ? usedQty : parseFloat(usedQty.toFixed(3))} {i.unit}
                            </td>

                            {/* Remaining Stock */}
                            <td style={{ fontWeight: 800, color: isOutOfStock(i) || isLowStock(i) ? 'var(--danger)' : 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                              {Number.isInteger(i.stock_quantity) ? i.stock_quantity : parseFloat(i.stock_quantity.toFixed(3))} {i.unit}
                            </td>

                            {/* Low-Stock Threshold */}
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                              {i.low_stock_threshold} {i.unit}
                            </td>

                            {/* Status */}
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span className={`badge ${statusObj.badgeClass}`}>
                                ● {statusObj.label}
                              </span>
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button
                                  className="btn btn-sm btn-primary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', gap: 4 }}
                                  onClick={() => openRestock(i)}
                                  title="Restock this item (Add new batch)"
                                >
                                  <PackagePlus size={13} /> Restock
                                </button>
                                <button
                                  className="btn btn-icon btn-ghost"
                                  onClick={() => {
                                    setAdjustModal(i);
                                    setAdjustType('reduce');
                                    setAdjustQty(0);
                                    setAdjustReason('Manual Stock Adjustment');
                                  }}
                                  title="Adjust / Deduct stock"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="btn btn-icon btn-ghost"
                                  onClick={() => openEdit(i)}
                                  title="Edit Item Settings"
                                >
                                  <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                                </button>
                                <button
                                  className="btn btn-icon btn-ghost"
                                  onClick={() => setDeleteModal(i)}
                                  title="Delete Item"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Batch Breakdown Table */}
                          {isExpanded && (
                            <tr className="batch-breakdown-row">
                              <td colSpan={9} style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
                                <motion.div
                                  className="batch-breakdown-panel"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <div className="batch-breakdown-inner">
                                    <div className="batch-breakdown-header">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Layers size={14} color="var(--primary)" />
                                        <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Batch Inventory Breakdown</span>
                                      </div>
                                      <button
                                        className="btn btn-sm btn-ghost"
                                        style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                                        onClick={() => openRestock(i)}
                                      >
                                        <Plus size={12} /> Add Batch
                                      </button>
                                    </div>

                                    {ingBatches.length === 0 ? (
                                      <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                                        No batches found for this item. Click "Restock" to create the first batch.
                                      </div>
                                    ) : (
                                      <table className="batch-subtable">
                                        <thead>
                                          <tr>
                                            <th>Stock Period</th>
                                            <th>Received</th>
                                            <th>Used</th>
                                            <th>Remaining</th>
                                            <th>Cost / Unit</th>
                                            <th>Supplier</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {ingBatches.map(batch => {
                                            const batchExp = getExpirationInfo(batch.expiration_date);
                                            const batchUsed = Math.max(0, batch.quantity_received - batch.quantity_remaining);

                                            return (
                                              <tr key={batch.id} className={`batch-row ${batch.status}`}>
                                                <td>
                                                  <div>
                                                    <span style={{ fontWeight: 600 }}>
                                                      {batch.received_at} → {batch.expiration_date || 'No expiry'}
                                                    </span>
                                                    {batch.note && (
                                                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {batch.note}
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td>{batch.quantity_received} {i.unit}</td>
                                                <td style={{ color: batchUsed > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: batchUsed > 0 ? 600 : 400 }}>
                                                  {batchUsed} {i.unit}
                                                </td>
                                                <td style={{ fontWeight: 700, color: batch.quantity_remaining > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                  {batch.quantity_remaining} {i.unit}
                                                </td>
                                                <td>₱{Number(batch.cost_per_unit).toFixed(2)}</td>
                                                <td>{batch.supplier || '—'}</td>
                                                <td>
                                                  {batch.status === 'active' ? (
                                                    <span className={`badge ${batchExp.status === 'expired' || batchExp.status === 'expired_today' ? 'badge-danger' : batchExp.status === 'near_expiry' ? 'badge-warning' : 'badge-success'}`}>
                                                      Active {batchExp.status !== 'none' && `(${batchExp.label})`}
                                                    </span>
                                                  ) : batch.status === 'expired' ? (
                                                    <span className="badge badge-danger">Expired</span>
                                                  ) : (
                                                    <span className="badge badge-neutral">Depleted</span>
                                                  )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  <button
                                                    className="btn btn-sm btn-ghost"
                                                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                                    onClick={() => openEditBatch(batch)}
                                                    title="Edit Batch Details"
                                                  >
                                                    <Edit2 size={12} /> Edit
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
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

      {/* Restock Item Modal */}
      <AnimatePresence>
        {restockModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRestockModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Restock {restockModal.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Add a new inventory batch with arrival &amp; expiration dates</span>
                </div>
                <button className="btn btn-icon btn-ghost" onClick={() => setRestockModal(null)}><X size={18} /></button>
              </div>

              <form onSubmit={handleRestockSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Quantity Received ({restockModal.unit}) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      className="input"
                      placeholder="e.g. 5"
                      value={restockForm.quantity}
                      onChange={e => setRestockForm(p => ({ ...p, quantity: e.target.value }))}
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cost per Unit (₱ / {restockModal.unit})</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input"
                      placeholder={String(restockModal.cost_per_unit || 0)}
                      value={restockForm.cost_per_unit}
                      onChange={e => setRestockForm(p => ({ ...p, cost_per_unit: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Received Date *</label>
                      <input
                        type="date"
                        className="input"
                        value={restockForm.received_at}
                        onChange={e => setRestockForm(p => ({ ...p, received_at: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expiration Date (Optional)</label>
                      <input
                        type="date"
                        className="input"
                        value={restockForm.expiration_date}
                        onChange={e => setRestockForm(p => ({ ...p, expiration_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Supplier / Source</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Beans Origin Co., Local Dairy, Packaging Depot"
                      value={restockForm.supplier}
                      onChange={e => setRestockForm(p => ({ ...p, supplier: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Note / Invoice Ref</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Weekly stock restock PO-4091"
                      value={restockForm.note}
                      onChange={e => setRestockForm(p => ({ ...p, note: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setRestockModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    <PackagePlus size={15} /> Confirm Restock
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Batch Modal */}
      <AnimatePresence>
        {editBatchModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditBatchModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Edit Batch Details</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Received: {editBatchModal.received_at}</span>
                </div>
                <button className="btn btn-icon btn-ghost" onClick={() => setEditBatchModal(null)}><X size={18} /></button>
              </div>

              <form onSubmit={handleEditBatchSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Expiration Date</label>
                    <input
                      type="date"
                      className="input"
                      value={editBatchForm.expiration_date}
                      onChange={e => setEditBatchForm(p => ({ ...p, expiration_date: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cost per Unit (₱)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input"
                      value={editBatchForm.cost_per_unit}
                      onChange={e => setEditBatchForm(p => ({ ...p, cost_per_unit: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Supplier</label>
                    <input
                      type="text"
                      className="input"
                      value={editBatchForm.supplier}
                      onChange={e => setEditBatchForm(p => ({ ...p, supplier: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Note</label>
                    <input
                      type="text"
                      className="input"
                      value={editBatchForm.note}
                      onChange={e => setEditBatchForm(p => ({ ...p, note: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditBatchModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle size={15} /> Save Batch Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Inventory Item Master Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <h3>{modal === 'add' ? 'Add Inventory Item' : 'Edit Inventory Item'}</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setModal(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                {/* Item Type Selector */}
                <div className="form-group">
                  <label className="form-label">Item Type *</label>
                  <div className="item-type-selector">
                    <button
                      type="button"
                      className={`item-type-btn ${form.item_type === 'ingredient' ? 'active' : ''}`}
                      onClick={() => f('item_type', 'ingredient')}
                    >
                      <Utensils size={14} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700 }}>Ingredient</div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>Food, milk, beans, syrups, powders</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`item-type-btn ${form.item_type === 'supply' ? 'active' : ''}`}
                      onClick={() => f('item_type', 'supply')}
                    >
                      <Package size={14} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700 }}>Supply / Packaging</div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>Cups, lids, straws, bags, napkins</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{form.item_type === 'supply' ? 'Supply Name *' : 'Ingredient Name *'}</label>
                  <input
                    type="text"
                    className="input"
                    placeholder={form.item_type === 'supply' ? 'e.g. 16oz Cold Cup, Straw, Kraft Paper Bag' : 'e.g. Whole Milk, Espresso Beans, Vanilla Syrup'}
                    value={form.name}
                    onChange={e => f('name', e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Unit of Measurement */}
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
                </div>

                {unitSelect === 'Other' && (
                  <div className="form-group">
                    <label className="form-label">Custom Unit Name *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. canister, bucket, tub"
                      value={customUnit}
                      onChange={e => setCustomUnit(e.target.value)}
                    />
                  </div>
                )}

                {/* Initial Stock (Only for new item creation) */}
                {modal === 'add' && (
                  <div className="form-group">
                    <label className="form-label">Initial Opening Stock ({unitSelect === 'Other' ? customUnit || 'unit' : unitSelect})</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input"
                      placeholder="0"
                      value={form.stock_quantity}
                      onChange={e => f('stock_quantity', e.target.value)}
                    />
                  </div>
                )}

                {/* Low Stock Threshold */}
                <div className="form-group">
                  <label className="form-label">Low-Stock Alert Threshold ({unitSelect === 'Other' ? customUnit || 'unit' : unitSelect})</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    placeholder="10"
                    value={form.low_stock_threshold}
                    onChange={e => f('low_stock_threshold', e.target.value)}
                  />
                </div>

                {/* Cost Per Unit */}
                <div className="form-group">
                  <label className="form-label">Default Cost per Unit (₱ / {unitSelect === 'Other' ? customUnit || 'unit' : unitSelect})</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    placeholder="e.g. 150.00"
                    value={form.cost_per_unit}
                    onChange={e => f('cost_per_unit', e.target.value)}
                  />
                </div>

                {/* Auto Deduct Expired Checkbox */}
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <input
                    type="checkbox"
                    id="auto_deduct_expired"
                    checked={form.auto_deduct_expired}
                    onChange={e => f('auto_deduct_expired', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="auto_deduct_expired" style={{ fontSize: '0.875rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    Automatically write off batches when expired
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveIngredient}>
                  {editing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjust Stock Modal (Deduct & Set Exact) */}
      <AnimatePresence>
        {adjustModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAdjustModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Adjust Stock: {adjustModal.name}</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Current Total: {adjustModal.stock_quantity} {adjustModal.unit}</span>
                </div>
                <button className="btn btn-icon btn-ghost" onClick={() => setAdjustModal(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    className={`adjust-modal-type-btn ${adjustType === 'reduce' ? 'active reduce' : ''}`}
                    onClick={() => setAdjustType('reduce')}
                  >
                    Deduct / Spoilage
                  </button>
                  <button
                    className={`adjust-modal-type-btn ${adjustType === 'set' ? 'active set' : ''}`}
                    onClick={() => setAdjustType('set')}
                  >
                    Set Exact Quantity
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {adjustType === 'reduce' ? 'Quantity to Deduct' : 'New Exact Stock Level'} ({adjustModal.unit}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    placeholder="0"
                    value={adjustQty || ''}
                    onChange={e => setAdjustQty(Number(e.target.value))}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Adjustment *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Spoilage, spill, inventory count discrepancy"
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setAdjustModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAdjustStock}>Confirm Adjustment</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <h3>Delete Inventory Item</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setDeleteModal(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Are you sure you want to delete <strong>{deleteModal.name}</strong> and all its associated batch records?
                </p>
                <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <AlertTriangle size={16} flex-shrink="0" />
                  <span>This action cannot be undone if recipes or orders are linked.</span>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDeleteConfirm}>Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
