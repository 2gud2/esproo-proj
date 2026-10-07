import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Printer, X, Coffee, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import './Receipt.css';

interface ReceiptItem {
  product?: { name: string; price: number; unit: string };
  name?: string;
  price?: number;
  qty: number;
}

interface ReceiptState {
  cart: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  payment: 'cash' | 'gcash';
  cashier: string;
}

export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ReceiptState | null;
  const now = new Date();

  // Defensive fallback receipt object
  const receipt = {
    cart: Array.isArray(state?.cart) ? state!.cart : [
      { product: { name: 'Matcha Latte', price: 180, unit: 'pcs' }, qty: 1 },
      { product: { name: 'Espresso', price: 120, unit: 'pcs' }, qty: 2 },
    ],
    subtotal: Number(state?.subtotal ?? 420),
    discountAmount: Number(state?.discountAmount ?? 0),
    total: Number(state?.total ?? 420),
    payment: state?.payment === 'gcash' ? 'gcash' : 'cash',
    cashier: state?.cashier || 'Staff User',
  };

  const safeCart = Array.isArray(receipt.cart) ? receipt.cart : [];

  return (
    <div className="receipt-root">
      <motion.div className="receipt-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Success badge */}
        <div className="receipt-success">
          <CheckCircle size={36} color="var(--success)" />
          <span>Sale Completed!</span>
        </div>

        {/* Store header */}
        <div className="receipt-header">
          <div className="receipt-logo"><Coffee size={20} /></div>
          <h2>Espro</h2>
          <p>Official Receipt</p>
        </div>

        {/* Meta */}
        <div className="receipt-meta">
          <div><span>Receipt #</span><strong>{saleId ?? 'S-DEMO'}</strong></div>
          <div><span>Date</span><strong>{format(now, 'MMM dd, yyyy')}</strong></div>
          <div><span>Time</span><strong>{format(now, 'hh:mm a')}</strong></div>
          <div><span>Cashier</span><strong>{receipt.cashier}</strong></div>
          <div><span>Payment</span><strong>{receipt.payment === 'cash' ? 'Cash' : 'GCash/Maya'}</strong></div>
        </div>

        <div className="receipt-divider">─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─</div>

        {/* Items */}
        <table className="receipt-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            {safeCart.map((item, i) => {
              const name = item.product?.name || item.name || 'Item';
              const price = Number(item.product?.price ?? item.price ?? 0);
              const qty = Number(item.qty || 1);
              return (
                <tr key={i}>
                  <td>{name}</td>
                  <td>{qty}</td>
                  <td>₱{price.toLocaleString()}</td>
                  <td>₱{(price * qty).toLocaleString()}</td>
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
            <span>₱{(receipt.subtotal || 0).toLocaleString()}</span>
          </div>
          {(receipt.discountAmount || 0) > 0 && (
            <div className="receipt-total-row discount">
              <span>Discount</span>
              <span>-₱{(receipt.discountAmount || 0).toLocaleString()}</span>
            </div>
          )}
          <div className="receipt-total-row grand">
            <span>TOTAL</span>
            <span>₱{(receipt.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="receipt-divider">─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─</div>
        <p className="receipt-thanks">Thank you for your purchase!</p>

        {/* Actions */}
        <div className="receipt-actions no-print">
          <motion.button className="btn btn-primary" onClick={() => window.print()} whileTap={{ scale: 0.96 }}>
            <Printer size={16} /> Print Receipt
          </motion.button>
          <motion.button className="btn btn-ghost" onClick={() => navigate('/pos')} whileTap={{ scale: 0.96 }}>
            <X size={16} /> New Sale
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
