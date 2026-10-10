import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle, Banknote, CreditCard, AlertTriangle,
  Utensils, ShoppingBag
} from 'lucide-react';
import type { CartLine } from '../../lib/mockData';

interface ConfirmOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartLines: CartLine[];
  orderType: 'dine_in' | 'takeout';
  subtotal: number;
  discountAmount: number;
  total: number;
  initialPaymentMethod?: 'cash' | 'gcash';
  onConfirm: (paymentDetails: {
    paymentMethod: 'cash' | 'gcash';
    amountTendered?: number | null;
    changeDue?: number | null;
  }) => Promise<void>;
  completing: boolean;
}

export default function ConfirmOrderModal({
  isOpen,
  onClose,
  cartLines,
  orderType,
  subtotal,
  discountAmount,
  total,
  initialPaymentMethod = 'cash',
  onConfirm,
  completing,
}: ConfirmOrderModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>(initialPaymentMethod);
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [gcashConfirmed, setGcashConfirmed] = useState<boolean>(false);

  // Initialize values when opening
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod(initialPaymentMethod);
      setAmountTendered(initialPaymentMethod === 'cash' ? String(total) : '');
      setGcashConfirmed(false);
    }
  }, [isOpen, initialPaymentMethod, total]);

  const tenderedNum = parseFloat(amountTendered) || 0;
  const changeDue = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(0, Math.round((tenderedNum - total) * 100) / 100);
  }, [tenderedNum, total, paymentMethod]);

  const isCashValid = paymentMethod === 'cash' && (total === 0 || tenderedNum >= total);
  const isGcashValid = paymentMethod === 'gcash' && gcashConfirmed;
  const canConfirm = !completing && (isCashValid || isGcashValid);

  const handleConfirmAction = useCallback(async () => {
    if (!canConfirm) return;
    await onConfirm({
      paymentMethod,
      amountTendered: paymentMethod === 'cash' ? tenderedNum : null,
      changeDue: paymentMethod === 'cash' ? changeDue : null,
    });
  }, [canConfirm, onConfirm, paymentMethod, tenderedNum, changeDue]);

  // Keyboard shortcut listener (Enter to confirm, Esc to cancel)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !completing) {
        onClose();
      } else if (e.key === 'Enter' && canConfirm) {
        // Prevent enter in textarea from triggering if applicable
        const target = e.target as HTMLElement;
        if (target && target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        handleConfirmAction();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canConfirm, completing, onClose, handleConfirmAction]);

  // Quick cash chips
  const quickTenderOptions = useMemo(() => {
    const opts = [total];
    [100, 200, 500, 1000].forEach((den) => {
      if (den >= total && !opts.includes(den)) opts.push(den);
    });
    if (total > 1000) {
      const next500 = Math.ceil(total / 500) * 500;
      const next1000 = Math.ceil(total / 1000) * 1000;
      if (!opts.includes(next500)) opts.push(next500);
      if (!opts.includes(next1000)) opts.push(next1000);
    }
    return opts.sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !completing && onClose()}
      >
        <motion.div
          className="modal confirm-order-modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{ maxWidth: 520, width: '100%' }}
        >
          {/* Header */}
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Confirm &amp; Checkout</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Review order lines and complete transaction
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge ${orderType === 'takeout' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                {orderType === 'takeout' ? <ShoppingBag size={12} style={{ marginRight: 4 }} /> : <Utensils size={12} style={{ marginRight: 4 }} />}
                {orderType === 'takeout' ? 'Takeout Order' : 'Dine-in Order'}
              </span>
              <button
                type="button"
                className="btn btn-icon btn-ghost"
                onClick={onClose}
                disabled={completing}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="modal-body confirm-order-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Order Lines Breakdown */}
            <div className="confirm-order-lines-box">
              <span className="confirm-section-label">Order Items ({cartLines.length})</span>
              <div className="confirm-lines-list">
                {cartLines.map((line, idx) => {
                  const lineTotal = Number(line.price) * Number(line.qty);
                  return (
                    <div key={line.line_id || idx} className="confirm-line-row">
                      <div className="confirm-line-main">
                        <div className="confirm-line-title">
                          <span className="confirm-line-qty">{line.qty}x</span>
                          <span className="confirm-line-name">{line.name}</span>
                          {line.size_name && (
                            <span className="confirm-line-size-chip">{line.size_name}</span>
                          )}
                        </div>
                        {Array.isArray(line.addons) && line.addons.length > 0 && (
                          <div className="confirm-line-addons">
                            {line.addons.map((a, aIdx) => (
                              <span key={aIdx} className="confirm-line-addon-item">
                                + {a.name} {a.qty > 1 ? `(${a.qty}x)` : ''} (+₱{(Number(a.price) * a.qty).toFixed(2)})
                              </span>
                            ))}
                          </div>
                        )}
                        {line.note && (
                          <span className="confirm-line-note">"{line.note}"</span>
                        )}
                      </div>
                      <div className="confirm-line-price">
                        ₱{lineTotal.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals Summary */}
            <div className="confirm-totals-box">
              <div className="confirm-totals-row">
                <span>Subtotal</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="confirm-totals-row discount">
                  <span>Discount</span>
                  <span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="confirm-totals-row grand">
                <span>Total Amount Due</span>
                <span className="confirm-grand-total">₱{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Switcher */}
            <div>
              <span className="confirm-section-label">Payment Method</span>
              <div className="payment-row" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('cash');
                    if (!amountTendered) setAmountTendered(String(total));
                  }}
                  disabled={completing}
                >
                  <Banknote size={16} /> Cash Payment
                </button>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'gcash' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('gcash')}
                  disabled={completing}
                >
                  <CreditCard size={16} /> Digital Payment
                </button>
              </div>
            </div>

            {/* Cash Tender & Change */}
            {paymentMethod === 'cash' && (
              <div className="confirm-cash-section">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Amount Received (₱) *</span>
                    {tenderedNum < total && total > 0 && (
                      <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>
                        Short by ₱{(total - tenderedNum).toFixed(2)}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    className={`input ${tenderedNum < total && total > 0 ? 'input-invalid' : ''}`}
                    style={{ fontSize: '1.1rem', fontWeight: 700 }}
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    autoFocus
                    disabled={completing}
                  />
                </div>

                {/* Quick Tender Chips */}
                <div className="quick-tender-chips">
                  {quickTenderOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`quick-tender-chip ${tenderedNum === opt ? 'active' : ''}`}
                      onClick={() => setAmountTendered(String(opt))}
                      disabled={completing}
                    >
                      {opt === total ? 'Exact (₱' + opt.toFixed(2) + ')' : '₱' + opt.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Change Due Display */}
                <div className="change-due-banner">
                  <span className="change-label">Change Due:</span>
                  <span className="change-val">₱{changeDue.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Digital Payment Confirmation Checkbox */}
            {paymentMethod === 'gcash' && (
              <div className="confirm-digital-section">
                <div className="digital-prompt-box">
                  <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Customer pays via Digital Payment</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Ensure GCash/Maya QR payment of <strong>₱{total.toFixed(2)}</strong> is received before completing.
                    </div>
                  </div>
                </div>

                <label className="digital-confirm-checkbox">
                  <input
                    type="checkbox"
                    checked={gcashConfirmed}
                    onChange={(e) => setGcashConfirmed(e.target.checked)}
                    disabled={completing}
                  />
                  <span>I confirm Digital Payment has been received in full</span>
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Press <strong>Enter</strong> to complete · <strong>Esc</strong> to cancel
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={completing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmAction}
                disabled={!canConfirm}
                style={{ minWidth: 150 }}
              >
                {completing ? (
                  <>
                    <span className="spinner-sm" style={{ marginRight: 6 }} /> Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} /> Complete Order
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
