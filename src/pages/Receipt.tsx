import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Printer, Coffee, CheckCircle, ArrowLeft, Plus, Utensils, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { loadSales } from '../lib/db';
import type { Sale } from '../lib/mockData';
import './Receipt.css';

interface ReceiptAddon {
  addon_id?: string;
  name: string;
  price: number;
  qty: number;
}

interface ReceiptItem {
  line_id?: string;
  menu_item_id?: string;
  product?: { name: string; price: number; unit?: string };
  name?: string;
  price?: number;
  unit_price?: number;
  base_price?: number;
  qty: number;
  size_id?: string | null;
  size_name?: string | null;
  addons?: ReceiptAddon[];
  note?: string | null;
}

interface ReceiptState {
  cart: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  payment: 'cash' | 'gcash';
  cashier: string;
  orderType?: 'dine_in' | 'takeout';
  amountTendered?: number | null;
  changeDue?: number | null;
}

export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ReceiptState | null;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState<boolean>(!state?.cart && Boolean(saleId));
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    // If state is not provided in router location, fetch from database
    if (!state?.cart && saleId) {
      async function fetchSale() {
        setLoading(true);
        try {
          const sales = await loadSales();
          const found = sales.find((s) => s.id === saleId);
          if (found) {
            setSale(found);
          } else {
            setNotFound(true);
          }
        } catch {
          setNotFound(true);
        } finally {
          setLoading(false);
        }
      }
      fetchSale();
    } else if (!state?.cart && !saleId) {
      setNotFound(true);
      setLoading(false);
    }
  }, [saleId, state]);

  if (loading) {
    return (
      <div className="receipt-root">
        <div className="receipt-card" style={{ padding: '50px 20px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (notFound || (!state?.cart && !sale)) {
    return (
      <div className="receipt-root">
        <div className="receipt-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <div className="receipt-logo"><Coffee size={18} /></div>
          <h3 style={{ margin: '8px 0 4px', fontSize: '1.1rem', fontWeight: 800 }}>Receipt Not Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 20 }}>
            No transaction records found for Receipt #{saleId || 'Unknown'}.
          </p>
          <div className="receipt-actions" style={{ width: '100%' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/pos')} style={{ width: '100%' }}>
              <ArrowLeft size={15} /> Back to POS
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine receipt details from either router state or loaded sale
  let items: ReceiptItem[] = [];
  let subtotal = 0;
  let discountAmount = 0;
  let total = 0;
  let payment: 'cash' | 'gcash' = 'cash';
  let cashier = 'Staff User';
  let orderType: 'dine_in' | 'takeout' | undefined = undefined;
  let amountTendered: number | null | undefined = null;
  let changeDue: number | null | undefined = null;
  let dateObj = new Date();

  if (state?.cart) {
    items = state.cart.map((item) => ({
      name: item.product?.name || item.name || 'Item',
      price: Number(item.price ?? item.product?.price ?? 0),
      qty: Number(item.qty || 1),
      size_name: item.size_name || null,
      addons: Array.isArray(item.addons) ? item.addons : [],
      note: item.note || null,
    }));
    subtotal = Number(state.subtotal || 0);
    discountAmount = Number(state.discountAmount || 0);
    total = Number(state.total || 0);
    payment = state.payment === 'gcash' ? 'gcash' : 'cash';
    cashier = state.cashier || 'Staff User';
    orderType = state.orderType;
    amountTendered = state.amountTendered;
    changeDue = state.changeDue;
    dateObj = new Date();
  } else if (sale) {
    items = ((sale.items || []) as any[]).map((item) => ({
      name: item.name || item.product?.name || 'Item',
      price: Number(item.price ?? item.product?.price ?? 0),
      qty: Number(item.qty || 1),
      size_name: item.size_name || null,
      addons: Array.isArray(item.addons) ? item.addons : [],
      note: item.note || null,
    }));
    discountAmount = Number(sale.discount || 0);
    subtotal = sale.subtotal != null ? Number(sale.subtotal) : Number(sale.total) + discountAmount;
    total = Number(sale.total || 0);
    payment = sale.paymentMethod === 'gcash' ? 'gcash' : 'cash';
    cashier = sale.cashierName || 'Staff User';
    orderType = sale.orderType;
    amountTendered = sale.amountTendered;
    changeDue = sale.changeDue;
    dateObj = new Date(sale.createdAt);
  }

  return (
    <div className="receipt-root">
      <motion.div className="receipt-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Success badge */}
        <div className="receipt-success">
          <CheckCircle size={20} color="var(--success)" />
          <span>Sale Completed!</span>
        </div>

        {/* Store header */}
        <div className="receipt-header">
          <div className="receipt-logo"><Coffee size={18} /></div>
          <h2>Espro</h2>
          <p>Official Receipt</p>
          {orderType && (
            <div className={`receipt-order-tag ${orderType === 'takeout' ? 'takeout' : 'dine-in'}`}>
              {orderType === 'takeout' ? (
                <>
                  <ShoppingBag size={11} /> Takeout
                </>
              ) : (
                <>
                  <Utensils size={11} /> Dine-in
                </>
              )}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="receipt-meta">
          <div><span>Receipt #</span><strong>{saleId ?? (sale?.id || 'N/A')}</strong></div>
          <div><span>Date</span><strong>{format(dateObj, 'MMM dd, yyyy')}</strong></div>
          <div><span>Time</span><strong>{format(dateObj, 'hh:mm a')}</strong></div>
          <div><span>Cashier</span><strong>{cashier}</strong></div>
          <div><span>Payment</span><strong>{payment === 'cash' ? 'Cash' : 'Digital Payment'}</strong></div>
          {orderType && (
            <div><span>Order Type</span><strong>{orderType === 'takeout' ? 'Takeout' : 'Dine-in'}</strong></div>
          )}
        </div>

        <div className="receipt-divider">─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─</div>

        {/* Items */}
        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const itemPrice = Number(item.price || 0);
              const itemQty = Number(item.qty || 1);
              const lineSubtotal = itemPrice * itemQty;
              return (
                <tr key={i}>
                  <td>
                    <div className="receipt-item-name-col">
                      <span className="receipt-item-title">
                        {item.name}
                        {item.size_name && (
                          <span className="receipt-item-size"> ({item.size_name})</span>
                        )}
                      </span>
                      {Array.isArray(item.addons) && item.addons.length > 0 && (
                        <div className="receipt-item-addons">
                          {item.addons.map((a, aIdx) => (
                            <span key={aIdx} className="receipt-item-addon">
                              + {a.name} {a.qty > 1 ? `(${a.qty}x)` : ''} (+₱{(Number(a.price) * a.qty).toFixed(2)})
                            </span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <span className="receipt-item-note">"{item.note}"</span>
                      )}
                    </div>
                  </td>
                  <td>{itemQty}</td>
                  <td>₱{itemPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>₱{lineSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="receipt-divider">─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─</div>

        {/* Totals */}
        <div className="receipt-totals">
          <div className="receipt-total-row">
            <span>Subtotal</span>
            <span>₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {discountAmount > 0 && (
            <div className="receipt-total-row discount">
              <span>Discount</span>
              <span>-₱{discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="receipt-total-row grand">
            <span>TOTAL</span>
            <span>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          {/* Cash Tendered & Change breakdown if available */}
          {payment === 'cash' && amountTendered != null && amountTendered > 0 && (
            <>
              <div className="receipt-total-row tender-row">
                <span>Amount Received</span>
                <span>₱{Number(amountTendered).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="receipt-total-row tender-row">
                <span>Change Due</span>
                <span>₱{Number(changeDue ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
        </div>

        <div className="receipt-divider">─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─</div>
        <p className="receipt-thanks">Thank you for your purchase!</p>

        {/* Actions (With Back Button, Print, and New Sale) */}
        <div className="receipt-actions no-print">
          <motion.button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} whileTap={{ scale: 0.96 }} title="Go Back">
            <ArrowLeft size={15} /> Back
          </motion.button>
          <motion.button className="btn btn-primary btn-sm" onClick={() => window.print()} whileTap={{ scale: 0.96 }}>
            <Printer size={15} /> Print
          </motion.button>
          <motion.button className="btn btn-secondary btn-sm" onClick={() => navigate('/pos')} whileTap={{ scale: 0.96 }}>
            <Plus size={15} /> New Sale
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
