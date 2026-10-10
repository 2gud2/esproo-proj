import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, PackageCheck, ShoppingBag, Utensils, Layers } from 'lucide-react';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            style={{ maxWidth: 780, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-muted)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PackageCheck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Takeout & Order Supplies Rules
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Supplies automatically deducted per order based on whether the customer dines in or takes out.
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="btn btn-icon btn-ghost">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ gap: 16 }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading supply rules...
                </div>
              ) : (
                <>
                  {/* Section Title & Add Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      <Layers size={15} color="var(--primary)" />
                      <span>Active Supply Deduction Rules ({rules.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={addRow}
                      className="btn btn-sm btn-primary"
                      style={{ gap: 5, fontSize: '0.78rem' }}
                      disabled={suppliesPool.length === 0}
                    >
                      <Plus size={14} /> Add Supply Rule
                    </button>
                  </div>

                  {rules.length === 0 ? (
                    <div
                      style={{
                        padding: '32px 20px',
                        textAlign: 'center',
                        background: 'var(--surface-2)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1.5px dashed var(--border)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <PackageCheck size={32} style={{ opacity: 0.35 }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        No order supply rules configured
                      </div>
                      <div style={{ fontSize: '0.78rem', maxWidth: 420 }}>
                        Add rules to automatically deduct packaging when an order is placed. Example: 1 Paper Bag on Takeout, or 2 Table Napkins on Dine-in.
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        background: 'var(--surface)',
                      }}
                    >
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-2)' }}>
                            <th style={{ padding: '10px 14px' }}>Supply / Packaging Item</th>
                            <th style={{ width: 100, padding: '10px 12px' }}>Quantity</th>
                            <th style={{ width: 130, padding: '10px 12px' }}>Unit</th>
                            <th style={{ width: 160, padding: '10px 12px' }}>When to Deduct</th>
                            <th style={{ width: 100, padding: '10px 12px' }}>Cost / Order</th>
                            <th style={{ width: 44, padding: '10px 8px', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map((r, idx) => {
                            const ing = ingredients.find((i) => i.id === r.ingredient_id);
                            const compatible = getCompatibleUnits(ing?.unit);
                            const rowCost = calculateIngredientCost(Number(r.quantity_used) || 0, r.unit, ing);

                            return (
                              <tr key={r.id || idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '8px 14px' }}>
                                  <select
                                    value={r.ingredient_id}
                                    onChange={(e) => updateRow(idx, 'ingredient_id', e.target.value)}
                                    className="input select"
                                    style={{ padding: '6px 30px 6px 10px', fontSize: '0.84rem' }}
                                    required
                                  >
                                    {suppliesPool.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name} ({s.unit} — ₱{(s.cost_per_unit ?? 0).toFixed(2)}/{s.unit})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={r.quantity_used}
                                    onChange={(e) => updateRow(idx, 'quantity_used', e.target.value)}
                                    className="input"
                                    style={{ padding: '6px 10px', fontSize: '0.84rem' }}
                                    placeholder="Qty"
                                    required
                                  />
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <select
                                    value={r.unit}
                                    onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                                    className="input select"
                                    style={{ padding: '6px 30px 6px 10px', fontSize: '0.84rem' }}
                                    required
                                  >
                                    {compatible.map((u) => (
                                      <option key={u.value} value={u.value}>
                                        {u.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <select
                                    value={r.order_type}
                                    onChange={(e) => updateRow(idx, 'order_type', e.target.value as any)}
                                    className="input select"
                                    style={{ padding: '6px 30px 6px 10px', fontSize: '0.84rem' }}
                                  >
                                    <option value="takeout">🥡 Takeout only</option>
                                    <option value="dine_in">🍽️ Dine-in only</option>
                                    <option value="all">📦 All Orders</option>
                                  </select>
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                  ₱{rowCost.toFixed(2)}
                                </td>
                                <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => removeRow(idx)}
                                    className="btn btn-icon btn-ghost"
                                    style={{ color: 'var(--danger)', padding: 6 }}
                                    title="Remove Rule"
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
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 14,
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(184, 115, 51, 0.12)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ShoppingBag size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Takeout Supplies Total
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
                          ₱{costBreakdown.takeoutCost.toFixed(2)}{' '}
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ order</span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(34, 197, 94, 0.12)',
                          color: 'var(--success)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Utensils size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Dine-In Supplies Total
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
                          ₱{costBreakdown.dineInCost.toFixed(2)}{' '}
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ order</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-ghost" disabled={saving}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Rules'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

