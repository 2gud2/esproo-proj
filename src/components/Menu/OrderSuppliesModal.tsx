import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, PackageCheck } from 'lucide-react';
import type { Ingredient } from '../../lib/mockData';
import {
  loadOrderSupplyRules,
  saveOrderSupplyRules
} from '../../lib/db';
import {
  calculateIngredientCost,
  getCompatibleUnits,
  areUnitsCompatible
} from '../../lib/unitConversion';
import toast from 'react-hot-toast';

interface OrderSuppliesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  onSaved?: () => void;
}

interface SupplyRuleRow {
  id?: string;
  ingredient_id: string;
  quantity_used: string | number;
  unit: string;
  order_type: 'takeout' | 'dine_in' | 'all';
  is_active?: boolean;
}

export default function OrderSuppliesModal({
  isOpen,
  onClose,
  ingredients,
  onSaved,
}: OrderSuppliesModalProps) {
  const [rules, setRules] = useState<SupplyRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const suppliesPool = useMemo(() => {
    const supplies = ingredients.filter((i) => i.item_type === 'supply');
    return supplies.length > 0 ? supplies : ingredients;
  }, [ingredients]);

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  async function loadRules() {
    try {
      setLoading(true);
      const existing = await loadOrderSupplyRules();
      setRules(
        existing.map((r) => ({
          id: r.id,
          ingredient_id: r.ingredient_id,
          quantity_used: String(r.quantity_used),
          unit: r.unit,
          order_type: r.order_type || 'takeout',
          is_active: r.is_active ?? true,
        }))
      );
    } catch {
      toast.error('Failed to load order supply rules');
    } finally {
      setLoading(false);
    }
  }

  function addRow() {
    if (suppliesPool.length === 0) {
      toast.error('No packaging or supplies in Inventory. Add supplies in Inventory first.');
      return;
    }
    const first = suppliesPool[0];
    setRules((prev) => [
      ...prev,
      {
        ingredient_id: first.id,
        quantity_used: '1',
        unit: first.unit,
        order_type: 'takeout',
        is_active: true,
      },
    ]);
  }

  function updateRow(index: number, field: keyof SupplyRuleRow, value: any) {
    setRules((prev) =>
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

  function removeRow(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  // Calculate costs per order type
  const costBreakdown = useMemo(() => {
    let takeoutCost = 0;
    let dineInCost = 0;

    for (const r of rules) {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      const qtyNum = Number(r.quantity_used) || 0;
      const rowCost = calculateIngredientCost(qtyNum, r.unit, ing);

      if (r.order_type === 'takeout' || r.order_type === 'all') {
        takeoutCost += rowCost;
      }
      if (r.order_type === 'dine_in' || r.order_type === 'all') {
        dineInCost += rowCost;
      }
    }

    return { takeoutCost, dineInCost };
  }, [rules, ingredients]);

  async function handleSave() {
    for (const r of rules) {
      const q = Number(r.quantity_used) || 0;
      if (q <= 0) {
        toast.error('All rule quantities must be greater than 0');
        return;
      }
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      if (ing && !areUnitsCompatible(r.unit, ing.unit)) {
        toast.error(`Incompatible unit "${r.unit}" for supply "${ing.name}"`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveOrderSupplyRules(
        rules.map((r) => ({
          id: r.id,
          ingredient_id: r.ingredient_id,
          quantity_used: Number(r.quantity_used),
          unit: r.unit,
          order_type: r.order_type,
          is_active: r.is_active ?? true,
        }))
      );
      toast.success('Order supply rules saved!');
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rules');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content order-supplies-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-with-icon">
            <PackageCheck size={20} className="header-icon" />
            <div>
              <h3>Takeout & Order Supplies Rules</h3>
              <p className="modal-subtitle">
                Supplies deducted automatically per order based on whether the customer dines in or takes out.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading-state">Loading rules...</div>
          ) : (
            <>
              <div className="rules-section-header">
                <span className="rules-section-title">Active Order Supply Rules ({rules.length})</span>
                <button
                  type="button"
                  onClick={addRow}
                  className="recipe-add-row-btn"
                  disabled={suppliesPool.length === 0}
                >
                  <Plus size={14} /> Add Supply Rule
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="rules-empty-state">
                  No order supply rules set. Example: Deduct 1 Paper Bag on Takeout, or 2 Table Napkins on Dine-in.
                </div>
              ) : (
                <div className="rules-table-wrapper">
                  <table className="order-supplies-table">
                    <thead>
                      <tr>
                        <th>Supply Item</th>
                        <th style={{ width: '90px' }}>Quantity</th>
                        <th style={{ width: '120px' }}>Unit</th>
                        <th style={{ width: '140px' }}>When to Deduct</th>
                        <th style={{ width: '90px' }}>Cost/Order</th>
                        <th style={{ width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r, idx) => {
                        const ing = ingredients.find((i) => i.id === r.ingredient_id);
                        const compatible = getCompatibleUnits(ing?.unit);
                        const rowCost = calculateIngredientCost(Number(r.quantity_used) || 0, r.unit, ing);

                        return (
                          <tr key={r.id || idx}>
                            <td>
                              <select
                                value={r.ingredient_id}
                                onChange={(e) => updateRow(idx, 'ingredient_id', e.target.value)}
                                className="recipe-select"
                                required
                              >
                                {suppliesPool.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.unit} — ₱{(s.cost_per_unit ?? 0).toFixed(2)}/{s.unit})
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
                                onChange={(e) => updateRow(idx, 'quantity_used', e.target.value)}
                                className="recipe-input"
                                placeholder="Qty"
                                required
                              />
                            </td>
                            <td>
                              <select
                                value={r.unit}
                                onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                                className="recipe-select"
                                required
                              >
                                {compatible.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {u.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                value={r.order_type}
                                onChange={(e) => updateRow(idx, 'order_type', e.target.value as any)}
                                className="recipe-select"
                              >
                                <option value="takeout">Takeout only</option>
                                <option value="dine_in">Dine-in only</option>
                                <option value="all">All Orders</option>
                              </select>
                            </td>
                            <td className="recipe-cost-cell">₱{rowCost.toFixed(2)}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                className="recipe-row-remove-btn"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary Cards */}
              <div className="order-supplies-cost-summary">
                <div className="summary-card">
                  <span className="summary-title">Takeout Supplies Total</span>
                  <span className="summary-amount">₱{costBreakdown.takeoutCost.toFixed(2)} / order</span>
                </div>
                <div className="summary-card">
                  <span className="summary-title">Dine-In Supplies Total</span>
                  <span className="summary-amount">₱{costBreakdown.dineInCost.toFixed(2)} / order</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Rules'}
          </button>
        </div>
      </div>
    </div>
  );
}
