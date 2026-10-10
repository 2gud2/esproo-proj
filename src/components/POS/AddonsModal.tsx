import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, FileText, Check } from 'lucide-react';
import type { AddonItem, CartLine } from '../../lib/mockData';

interface AddonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartLine: CartLine | null;
  availableAddons: AddonItem[];
  onSaveAddons: (
    lineId: string,
    selectedAddons: Array<{ addon: AddonItem; qty: number }>,
    note?: string | null
  ) => void;
}

export default function AddonsModal({
  isOpen,
  onClose,
  cartLine,
  availableAddons,
  onSaveAddons,
}: AddonsModalProps) {
  // Map of addonId -> quantity
  const [addonCounts, setAddonCounts] = useState<Record<string, number>>({});
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (isOpen && cartLine) {
      const counts: Record<string, number> = {};
      if (Array.isArray(cartLine.addons)) {
        for (const a of cartLine.addons) {
          counts[a.addon_id] = Number(a.qty) || 1;
        }
      }
      setAddonCounts(counts);
      setNote(cartLine.note || '');
    }
  }, [isOpen, cartLine]);

  // Calculate live line price unconditionally so hooks rules are respected
  const basePrice = cartLine ? Number(cartLine.base_price ?? cartLine.price) : 0;
  const addonsTotalPerServing = useMemo(() => {
    let sum = 0;
    for (const addon of availableAddons) {
      const qty = addonCounts[addon.id] || 0;
      sum += Number(addon.price) * qty;
    }
    return sum;
  }, [availableAddons, addonCounts]);

  const unitPrice = basePrice + addonsTotalPerServing;
  const lineTotal = unitPrice * Number(cartLine?.qty || 1);

  function updateCount(addonId: string, delta: number) {
    setAddonCounts((prev) => {
      const current = prev[addonId] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev };
      if (next === 0) {
        delete updated[addonId];
      } else {
        updated[addonId] = next;
      }
      return updated;
    });
  }

  function handleSave() {
    if (!cartLine) return;
    const selectedAddons: Array<{ addon: AddonItem; qty: number }> = [];
    for (const addon of availableAddons) {
      const qty = addonCounts[addon.id] || 0;
      if (qty > 0) {
        selectedAddons.push({ addon, qty });
      }
    }
    onSaveAddons(cartLine.line_id, selectedAddons, note.trim() ? note.trim() : null);
    onClose();
  }

  if (!isOpen || !cartLine) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal addons-modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{ maxWidth: 480, width: '100%' }}
        >
          <div className="modal-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Customize Item</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {cartLine.name}
                {cartLine.size_name ? ` (${cartLine.size_name})` : ''} · Qty: {cartLine.qty}
              </span>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Addons List */}
            <div>
              <label className="form-label" style={{ marginBottom: 8, fontWeight: 700 }}>
                Available Add-ons &amp; Modifiers
              </label>
              {availableAddons.length === 0 ? (
                <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                  No add-ons applicable for this item.
                </div>
              ) : (
                <div className="addons-stepper-list">
                  {availableAddons.map((addon) => {
                    const count = addonCounts[addon.id] || 0;
                    return (
                      <div key={addon.id} className={`addon-stepper-row ${count > 0 ? 'selected' : ''}`}>
                        <div className="addon-stepper-info">
                          <span className="addon-stepper-name">{addon.name}</span>
                          <span className="addon-stepper-price">+₱{addon.price.toFixed(2)}</span>
                        </div>
                        <div className="addon-stepper-controls">
                          <button
                            type="button"
                            className="qty-btn"
                            disabled={count <= 0}
                            onClick={() => updateCount(addon.id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="addon-stepper-count">{count}</span>
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => updateCount(addon.id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note / Special Instructions */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} />
                <span>Special Instructions / Notes</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Less ice, half sugar, extra hot"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Live Price Summary Box */}
            <div className="addons-modal-summary">
              <div className="addons-summary-item">
                <span>Base Price:</span>
                <strong>₱{basePrice.toFixed(2)}</strong>
              </div>
              <div className="addons-summary-item">
                <span>Add-ons:</span>
                <strong style={{ color: addonsTotalPerServing > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  +₱{addonsTotalPerServing.toFixed(2)}
                </strong>
              </div>
              <div className="addons-summary-item" style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                <span>Line Total ({cartLine.qty}x):</span>
                <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                  ₱{lineTotal.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} style={{ minWidth: 120 }}>
              <Check size={14} /> Apply Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
