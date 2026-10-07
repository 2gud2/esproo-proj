import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Minus, Plus, Trash2, Tag, CreditCard, Banknote,
  CheckCircle, X, RotateCcw, AlertTriangle, ShoppingCart, Coffee
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import { MENU_CATEGORIES } from '../lib/mockData';
import type { MenuItem, MenuCartItem } from '../lib/mockData';
import { useAuth } from '../contexts/AuthContext';
import { loadMenuItems, createSaleWithDeduction } from '../lib/db';
import toast from 'react-hot-toast';
import './POS.css';

type PaymentMethod = 'cash' | 'gcash';
type DiscountType = 'fixed' | 'percent';

export default function POSPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<MenuCartItem[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [gcashConfirmed, setGcashConfirmed] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [voidModal, setVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function initMenu() {
      try {
        const data = await loadMenuItems(true); // active only
        setMenuItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initMenu();
  }, []);

  const filteredItems = useMemo(() => menuItems.filter(item => {
    const matchCat = category === 'All' || item.category === category;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [menuItems, search, category]);

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.menu_item_id === item.id);
      if (existing) {
        return prev.map(c => c.menu_item_id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, {
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        image_url: item.image_url,
        qty: 1,
      }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.menu_item_id === id) {
        const nextQty = c.qty + delta;
        return { ...c, qty: Math.max(1, nextQty) };
      }
      return c;
    }));
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(c => c.menu_item_id !== id));
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmount = discountType === 'fixed' ? Math.min(discountValue, subtotal) : subtotal * (discountValue / 100);
  const total = Math.max(0, subtotal - discountAmount);

  async function completeSale() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (payment === 'gcash' && !gcashConfirmed) { toast.error('Please confirm GCash payment received'); return; }
    setCompleting(true);
    
    const saleId = `S-${Date.now()}`;
    const cashierName = user?.name || 'Staff User';

    try {
      await createSaleWithDeduction(
        saleId,
        cart,
        subtotal,
        discountAmount,
        total,
        payment,
        cashierName
      );

      toast.success('Sale completed! Stock updated.');

      // Format cart for receipt page before clearing state
      const formattedReceiptCart = cart.map(c => ({
        product: { name: c.name, price: c.price, unit: 'item' },
        name: c.name,
        price: c.price,
        qty: c.qty
      }));

      // Navigate to receipt
      navigate(`/pos/receipt/${saleId}`, {
        state: { cart: formattedReceiptCart, subtotal, discountAmount, total, payment, cashier: cashierName }
      });

      // Clear cart after navigation
      setCart([]);
      setDiscountValue(0);
      setGcashConfirmed(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale');
    } finally {
      setCompleting(false);
    }
  }

  function voidOrder() {
    if (!voidReason.trim()) { toast.error('Please provide a void reason'); return; }
    setCart([]);
    setDiscountValue(0);
    setVoidModal(false);
    setVoidReason('');
    toast.success('Order voided');
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="POS" searchPlaceholder="Search menu items..." onSearch={setSearch} />
        <main className="pos-body">
          {/* Menu Items Panel */}
          <div className="pos-products">
            {/* Category chips */}
            <div className="pos-cats">
              {['All', ...MENU_CATEGORIES].map(cat => (
                <button key={cat} className={`cat-chip${category === cat ? ' active' : ''}`} onClick={() => setCategory(cat)}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="pos-grid">
              <AnimatePresence>
                {filteredItems.map(item => (
                  <motion.button
                    key={item.id}
                    className="product-card"
                    onClick={() => addToCart(item)}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <div className="product-card-img" style={{ position: 'relative', overflow: 'hidden' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Coffee size={28} color="var(--primary)" />
                      )}
                    </div>
                    <div className="product-card-body">
                      <div className="product-name">{item.name}</div>
                      <div className="product-cat">{item.category}</div>
                      <div className="product-bottom">
                        <span className="product-price">₱{item.price.toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
              {filteredItems.length === 0 && !loading && (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                  <Search size={32} /><p>No menu items found</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div className="pos-cart">
            <div className="cart-header">
              <h3>Current Cart</h3>
              {cart.length > 0 && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setVoidModal(true)}>
                  <X size={14} /> Void
                </button>
              )}
            </div>

            <div className="cart-items">
              <AnimatePresence>
                {cart.length === 0 ? (
                  <motion.div className="cart-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <ShoppingCart size={36} opacity={0.3} />
                    <p>Add items to start a sale</p>
                  </motion.div>
                ) : cart.map(item => (
                  <motion.div key={item.menu_item_id} className="cart-item"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">₱{item.price.toLocaleString()}</span>
                    </div>
                    <div className="cart-item-controls">
                      <button className="qty-btn" onClick={() => updateQty(item.menu_item_id, -1)}><Minus size={12} /></button>
                      <span className="qty-val">{item.qty}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.menu_item_id, 1)}><Plus size={12} /></button>
                      <button className="qty-btn danger" onClick={() => removeItem(item.menu_item_id)}><Trash2 size={12} /></button>
                    </div>
                    <span className="cart-item-sub">₱{(item.price * item.qty).toLocaleString()}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Discount */}
            <div className="cart-section">
              <div className="cart-section-label"><Tag size={13} /> Discount</div>
              <div className="discount-row">
                <div className="discount-type">
                  <button className={`dtype-btn${discountType === 'fixed' ? ' active' : ''}`} onClick={() => setDiscountType('fixed')}>₱</button>
                  <button className={`dtype-btn${discountType === 'percent' ? ' active' : ''}`} onClick={() => setDiscountType('percent')}>%</button>
                </div>
                <input type="number" className="input" style={{ flex: 1, height: 36, padding: '0 10px' }} min={0}
                  placeholder="0" value={discountValue || ''} onChange={e => setDiscountValue(Number(e.target.value))} />
              </div>
            </div>

            {/* Payment */}
            <div className="cart-section">
              <div className="cart-section-label"><CreditCard size={13} /> Payment Method</div>
              <div className="payment-row">
                <button className={`payment-btn${payment === 'cash' ? ' active' : ''}`} onClick={() => setPayment('cash')}>
                  <Banknote size={16} /> Cash
                </button>
                <button className={`payment-btn${payment === 'gcash' ? ' active' : ''}`} onClick={() => setPayment('gcash')}>
                  <CreditCard size={16} /> GCash/Maya
                </button>
              </div>
              {payment === 'gcash' && (
                <motion.div className="gcash-note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <AlertTriangle size={14} color="var(--warning)" />
                  <span>Customer pays via QR code at the counter.</span>
                  <label className="gcash-check">
                    <input type="checkbox" checked={gcashConfirmed} onChange={e => setGcashConfirmed(e.target.checked)} />
                    Payment Received
                  </label>
                </motion.div>
              )}
            </div>

            {/* Summary */}
            <div className="cart-summary">
              <div className="summary-row"><span>Subtotal</span><span>₱{subtotal.toLocaleString()}</span></div>
              {discountAmount > 0 && <div className="summary-row discount"><span>Discount</span><span>-₱{discountAmount.toLocaleString()}</span></div>}
              <div className="summary-row total"><span>Total</span><span>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
            </div>

            <motion.button
              className="btn btn-primary btn-lg complete-btn"
              onClick={completeSale}
              disabled={completing || cart.length === 0}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {completing ? <span className="spinner-sm" /> : <><CheckCircle size={18} /> Complete Sale</>}
            </motion.button>
          </div>
        </main>
      </div>

      {/* Void Modal */}
      <AnimatePresence>
        {voidModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVoidModal(false)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="modal-header">
                <h3>Void Order</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setVoidModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Reason for Void *</label>
                  <textarea className="input" rows={3} placeholder="e.g. Customer changed order" value={voidReason} onChange={e => setVoidReason(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setVoidModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={voidOrder}><RotateCcw size={15} /> Void Order</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
