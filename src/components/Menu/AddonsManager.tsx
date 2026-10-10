import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, CheckCircle2, Power, Layers, X, Trash2,
  Tag, Search, AlertCircle
} from 'lucide-react';
import type { AddonItem, AddonIngredient, Ingredient, MenuItem } from '../../lib/mockData';
import {
  loadAddons,
  loadAllAddonRecipes,
  saveAddon,
  deactivateAddon
} from '../../lib/db';
import {
  calculateIngredientCost,
  getCompatibleUnits,
  areUnitsCompatible
} from '../../lib/unitConversion';
import toast from 'react-hot-toast';

interface AddonsManagerProps {
  ingredients: Ingredient[];
  categories: string[];
  menuItems: MenuItem[];
  onRefresh?: () => void;
}

interface AddonRecipeRow {
  id?: string;
  ingredient_id: string;
  quantity_used: string | number;
  unit: string;
}

export default function AddonsManager({
  ingredients,
  categories,
  menuItems,
}: AddonsManagerProps) {
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [addonRecipes, setAddonRecipes] = useState<Record<string, AddonIngredient[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editingAddon, setEditingAddon] = useState<AddonItem | null>(null);
  const [form, setForm] = useState({
    name: '',
    price: '',
    applies_to_categories: [] as string[],
    applies_to_items: [] as string[],
  });
  const [recipeRows, setRecipeRows] = useState<AddonRecipeRow[]>([]);
  const [saving, setSaving] = useState(false);

  async function fetchAddonsData() {
    try {
      setLoading(true);
      const [addonList, recipes] = await Promise.all([
        loadAddons(false),
        loadAllAddonRecipes(),
      ]);
      setAddons(addonList);
      setAddonRecipes(recipes);
    } catch {
      toast.error('Failed to load add-ons');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAddonsData();
  }, []);

  function openAddModal() {
    setEditingAddon(null);
    setForm({
      name: '',
      price: '',
      applies_to_categories: [],
      applies_to_items: [],
    });
    setRecipeRows([]);
    setModal('add');
  }

  function openEditModal(addon: AddonItem) {
    setEditingAddon(addon);
    setForm({
      name: addon.name,
      price: String(addon.price),
      applies_to_categories: addon.applies_to_categories || [],
      applies_to_items: addon.applies_to_items || [],
    });

    const existingRows = addonRecipes[addon.id] || [];
    setRecipeRows(
      existingRows.map((r) => ({
        id: r.id,
        ingredient_id: r.ingredient_id,
        quantity_used: String(r.quantity_used),
        unit: r.unit,
      }))
    );
    setModal('edit');
  }

  async function handleToggleActive(addon: AddonItem) {
    try {
      if (addon.is_active) {
        await deactivateAddon(addon.id);
        toast.success(`Add-on "${addon.name}" deactivated`);
      } else {
        await saveAddon({
          id: addon.id,
          name: addon.name,
          price: addon.price,
          is_active: true,
          applies_to_categories: addon.applies_to_categories,
          applies_to_items: addon.applies_to_items,
        });
        toast.success(`Add-on "${addon.name}" reactivated`);
      }
      await fetchAddonsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update add-on status');
    }
  }

  function addRecipeRow() {
    if (ingredients.length === 0) {
      toast.error('No ingredients available in Inventory');
      return;
    }
    const first = ingredients[0];
    setRecipeRows((prev) => [
      ...prev,
      {
        ingredient_id: first.id,
        quantity_used: '1',
        unit: first.unit,
      },
    ]);
  }

  function updateRecipeRow(index: number, field: keyof AddonRecipeRow, value: any) {
    setRecipeRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const updated = { ...r, [field]: value };
        if (field === 'ingredient_id') {
          const ing = ingredients.find((ig) => ig.id === value);
          if (ing && !areUnitsCompatible(r.unit, ing.unit)) {
            updated.unit = ing.unit;
          }
        }
        return updated;
      })
    );
  }

  function removeRecipeRow(index: number) {
    setRecipeRows((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleCategory(cat: string) {
    setForm((prev) => {
      const exists = prev.applies_to_categories.includes(cat);
      return {
        ...prev,
        applies_to_categories: exists
          ? prev.applies_to_categories.filter((c) => c !== cat)
          : [...prev.applies_to_categories, cat],
      };
    });
  }

  function toggleItem(itemId: string) {
    setForm((prev) => {
      const exists = prev.applies_to_items.includes(itemId);
      return {
        ...prev,
        applies_to_items: exists
          ? prev.applies_to_items.filter((id) => id !== itemId)
          : [...prev.applies_to_items, itemId],
      };
    });
  }

  // Modal live COGS calculation
  const modalCogs = useMemo(() => {
    let total = 0;
    for (const r of recipeRows) {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      const qtyNum = Number(r.quantity_used) || 0;
      total += calculateIngredientCost(qtyNum, r.unit, ing);
    }
    return total;
  }, [recipeRows, ingredients]);

  const modalPrice = Number(form.price) || 0;
  const modalMargin = modalPrice > 0 ? ((modalPrice - modalCogs) / modalPrice) * 100 : 0;

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Add-on name is required');
      return;
    }
    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Please enter a valid price (≥ 0)');
      return;
    }

    // Validate recipe rows
    for (const r of recipeRows) {
      const q = Number(r.quantity_used) || 0;
      if (q <= 0) {
        toast.error('All recipe quantities must be greater than 0');
        return;
      }
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      if (ing && !areUnitsCompatible(r.unit, ing.unit)) {
        toast.error(`Incompatible unit "${r.unit}" for ingredient "${ing.name}"`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveAddon(
        {
          id: editingAddon?.id,
          name: form.name.trim(),
          price: priceNum,
          is_active: editingAddon?.is_active ?? true,
          applies_to_categories: form.applies_to_categories,
          applies_to_items: form.applies_to_items,
        },
        recipeRows.map((r) => ({
          ingredient_id: r.ingredient_id,
          quantity_used: Number(r.quantity_used),
          unit: r.unit,
        }))
      );

      toast.success(editingAddon ? 'Add-on updated!' : 'Add-on created!');
      setModal(null);
      await fetchAddonsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save add-on');
    } finally {
      setSaving(false);
    }
  }

  // Calculate COGS per addon for display
  function getAddonCogs(addonId: string): number {
    const rows = addonRecipes[addonId] || [];
    return rows.reduce((sum, r) => {
      const ing = ingredients.find((i) => i.id === r.ingredient_id) || r.ingredient;
      return sum + calculateIngredientCost(Number(r.quantity_used), r.unit, ing);
    }, 0);
  }

  const filteredAddons = useMemo(() => {
    return addons.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [addons, search]);

  return (
    <div className="addons-manager-container">
      {/* Top Header & Search */}
      <div className="addons-header-bar">
        <div className="addons-search-wrapper">
          <Search size={16} className="addons-search-icon" />
          <input
            type="text"
            placeholder="Search add-ons (e.g. Extra Espresso, Oat Milk)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="addons-search-input"
          />
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="btn btn-primary"
        >
          <Plus size={16} /> New Add-on
        </button>
      </div>

      {loading ? (
        <div className="addons-loading-state">
          <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading add-ons...
        </div>
      ) : filteredAddons.length === 0 ? (
        <div className="addons-empty-state">
          <div className="empty-icon-wrap">
            <Layers size={36} color="var(--primary)" />
          </div>
          <h3>No Add-ons Configured</h3>
          <p>Create add-ons like syrups, extra shots, or dairy alternatives with linked inventory recipes.</p>
          <button type="button" onClick={openAddModal} className="btn btn-primary">
            <Plus size={16} /> Add Your First Add-on
          </button>
        </div>
      ) : (
        <div className="addons-grid">
          {filteredAddons.map((addon) => {
            const cogs = getAddonCogs(addon.id);
            const profit = addon.price - cogs;
            const margin = addon.price > 0 ? (profit / addon.price) * 100 : 0;
            const rows = addonRecipes[addon.id] || [];

            return (
              <div
                key={addon.id}
                className={`addon-card ${!addon.is_active ? 'addon-card-inactive' : ''}`}
              >
                <div className="addon-card-header">
                  <div className="addon-card-title-group">
                    <h4 className="addon-title">{addon.name}</h4>
                    <span className="addon-price-badge">₱{addon.price.toFixed(2)}</span>
                  </div>
                  <div className="addon-card-actions">
                    <button
                      type="button"
                      onClick={() => openEditModal(addon)}
                      className="btn btn-icon btn-ghost btn-sm"
                      title="Edit add-on"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(addon)}
                      className={`btn btn-icon btn-sm ${addon.is_active ? 'btn-ghost active-toggle-on' : 'btn-ghost active-toggle-off'}`}
                      title={addon.is_active ? 'Deactivate add-on' : 'Reactivate add-on'}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </div>

                {/* Scope chips */}
                <div className="addon-scope-chips">
                  {addon.applies_to_categories && addon.applies_to_categories.length > 0 ? (
                    addon.applies_to_categories.map((c) => (
                      <span key={c} className="addon-chip category-chip">
                        <Tag size={10} /> {c}
                      </span>
                    ))
                  ) : addon.applies_to_items && addon.applies_to_items.length > 0 ? (
                    <span className="addon-chip items-chip">
                      {addon.applies_to_items.length} specific items
                    </span>
                  ) : (
                    <span className="addon-chip all-items-chip">All Menu Items</span>
                  )}
                </div>

                {/* Ingredients snippet */}
                <div className="addon-recipe-summary">
                  <span className="recipe-summary-label">Recipe:</span>
                  {rows.length === 0 ? (
                    <span className="recipe-summary-empty">No ingredients linked (₱0.00 COGS)</span>
                  ) : (
                    <span className="recipe-summary-items">
                      {rows.map((r, i) => {
                        const ing = ingredients.find((ig) => ig.id === r.ingredient_id) || r.ingredient;
                        return (
                          <span key={r.id || i} className="recipe-item-pill">
                            {ing?.name || 'Item'} ({r.quantity_used} {r.unit})
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>

                {/* Metrics */}
                <div className="addon-metrics-bar">
                  <div className="addon-metric">
                    <span className="metric-lbl">Est. COGS</span>
                    <span className="metric-val" style={{ color: 'var(--danger)' }}>₱{cogs.toFixed(2)}</span>
                  </div>
                  <div className="addon-metric">
                    <span className="metric-lbl">Profit</span>
                    <span className="metric-val" style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ₱{profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="addon-metric">
                    <span className="metric-lbl">Margin</span>
                    <span className="metric-val" style={{ color: margin >= 40 ? 'var(--success)' : margin >= 20 ? 'var(--warning)' : 'var(--danger)' }}>
                      {margin.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Addon Modal */}
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
              className="modal addon-modal-container"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>{modal === 'add' ? 'Create New Add-on' : 'Edit Add-on'}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Configure pricing, applicable categories, and ingredient recipe
                  </span>
                </div>
                <button type="button" onClick={() => setModal(null)} className="btn btn-icon btn-ghost">
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body addon-modal-body">
                <div className="form-group">
                  <label className="form-label">Add-on Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Vanilla Syrup Pump, Oat Milk Upgrade, Extra Espresso Shot"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input"
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Price Added to Item (₱) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                {/* Applies to Categories */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Applies To Categories</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      (Leave empty to apply to all categories)
                    </span>
                  </label>
                  <div className="category-chips-select">
                    {categories.map((cat) => {
                      const isSelected = form.applies_to_categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`cat-chip-btn ${isSelected ? 'cat-chip-selected' : ''}`}
                        >
                          {isSelected && <CheckCircle2 size={12} />}
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Items Picker */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Specific Menu Items (Optional)</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      (Restrict to specific items)
                    </span>
                  </label>
                  <div className="items-picker-box">
                    {menuItems.length === 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No menu items found.</span>
                    ) : (
                      menuItems.map((item) => {
                        const isSelected = form.applies_to_items.includes(item.id);
                        return (
                          <label key={item.id} className="item-picker-checkbox-label">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleItem(item.id)}
                            />
                            <span>{item.name} <small style={{ color: 'var(--text-muted)' }}>({item.category})</small></span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Add-on Recipe Ingredients */}
                <div className="addon-recipe-section">
                  <div className="recipe-section-header">
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                      Add-on Recipe (Ingredients &amp; Supplies)
                    </label>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '3px 8px', gap: 4 }}
                    >
                      <Plus size={13} /> Add Ingredient
                    </button>
                  </div>

                  {recipeRows.length === 0 ? (
                    <div className="addon-recipe-empty">
                      <AlertCircle size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                      <span>No ingredients configured. If this add-on consumes stock (e.g. 20ml syrup, shot, or oat milk), click <strong>"+ Add Ingredient"</strong>.</span>
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ marginTop: 8 }}>
                      <table className="addon-recipe-table">
                        <thead>
                          <tr>
                            <th>Inventory Item</th>
                            <th style={{ width: '100px' }}>Quantity</th>
                            <th style={{ width: '130px' }}>Unit</th>
                            <th style={{ width: '90px' }}>Cost</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipeRows.map((r, idx) => {
                            const ing = ingredients.find((i) => i.id === r.ingredient_id);
                            const compatible = getCompatibleUnits(ing?.unit);
                            const cost = calculateIngredientCost(Number(r.quantity_used) || 0, r.unit, ing);

                            return (
                              <tr key={r.id || idx}>
                                <td>
                                  <select
                                    value={r.ingredient_id}
                                    onChange={(e) => updateRecipeRow(idx, 'ingredient_id', e.target.value)}
                                    className="input select"
                                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                                    required
                                  >
                                    {ingredients.map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.name} ({i.unit} — ₱{(i.cost_per_unit ?? 0).toFixed(2)}/{i.unit})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={r.quantity_used}
                                    onChange={(e) => updateRecipeRow(idx, 'quantity_used', e.target.value)}
                                    className="input"
                                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                                    placeholder="Qty"
                                    required
                                  />
                                </td>
                                <td>
                                  <select
                                    value={r.unit}
                                    onChange={(e) => updateRecipeRow(idx, 'unit', e.target.value)}
                                    className="input select"
                                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                                    required
                                  >
                                    {compatible.map((u) => (
                                      <option key={u.value} value={u.value}>
                                        {u.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="recipe-cost-cell">₱{cost.toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => removeRecipeRow(idx)}
                                    className="btn btn-icon btn-ghost btn-sm"
                                    style={{ color: 'var(--danger)' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Live Profit Preview */}
                  <div className="addon-profit-preview-card">
                    <div className="preview-stat">
                      <span className="preview-stat-label">Add-on Price</span>
                      <span className="preview-stat-val">₱{modalPrice.toFixed(2)}</span>
                    </div>
                    <div className="preview-stat">
                      <span className="preview-stat-label">Est. COGS</span>
                      <span className="preview-stat-val" style={{ color: 'var(--danger)' }}>₱{modalCogs.toFixed(2)}</span>
                    </div>
                    <div className="preview-stat">
                      <span className="preview-stat-label">Gross Profit</span>
                      <span className="preview-stat-val" style={{ color: modalPrice - modalCogs >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        ₱{(modalPrice - modalCogs).toFixed(2)}
                      </span>
                    </div>
                    <div className="preview-stat">
                      <span className="preview-stat-label">Margin</span>
                      <span className="preview-stat-val" style={{ color: modalMargin >= 40 ? 'var(--success)' : modalMargin >= 20 ? 'var(--warning)' : 'var(--danger)' }}>
                        {modalMargin.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="btn btn-ghost"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : modal === 'add' ? 'Create Add-on' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

