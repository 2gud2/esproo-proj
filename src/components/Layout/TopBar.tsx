import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, HelpCircle, User, Search, Menu, AlertTriangle, AlertCircle, Clock,
  ChevronRight, CheckCircle2, ShieldCheck, Mail
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { loadIngredients } from '../../lib/db';
import { isLowStock, isOutOfStock, getExpirationInfo } from '../../lib/stockStatus';
import type { Ingredient } from '../../lib/mockData';
import './TopBar.css';

interface TopBarProps {
  title: string;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  action?: React.ReactNode;
}

interface AlertItem {
  id: string;
  ingredientId: string;
  name: string;
  type: 'out' | 'low' | 'expired' | 'near_expiry';
  badgeLabel: string;
  badgeClass: string;
  detail: string;
}

export default function TopBar({ title, searchPlaceholder, onSearch, action }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  // Fetch ingredients on mount for notification dot and alerts
  useEffect(() => {
    let mounted = true;
    async function fetchIngredients() {
      try {
        const ings = await loadIngredients();
        if (mounted) setIngredients(ings);
      } catch (err) {
        console.error('Failed to load ingredients for notifications', err);
      }
    }
    fetchIngredients();
    return () => { mounted = false; };
  }, []);

  // Compute alerts
  const alerts = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];

    for (const ing of ingredients) {
      // Stock alerts
      if (isOutOfStock(ing)) {
        list.push({
          id: `${ing.id}-out`,
          ingredientId: ing.id,
          name: ing.name,
          type: 'out',
          badgeLabel: 'Out of Stock',
          badgeClass: 'badge-danger',
          detail: `0 ${ing.unit} available`,
        });
      } else if (isLowStock(ing)) {
        list.push({
          id: `${ing.id}-low`,
          ingredientId: ing.id,
          name: ing.name,
          type: 'low',
          badgeLabel: 'Low Stock',
          badgeClass: 'badge-warning',
          detail: `${ing.stock_quantity} ${ing.unit} (Threshold: ${ing.low_stock_threshold})`,
        });
      }

      // Expiration alerts
      const exp = getExpirationInfo(ing.expiration_date);
      if (exp.status === 'expired') {
        list.push({
          id: `${ing.id}-expired`,
          ingredientId: ing.id,
          name: ing.name,
          type: 'expired',
          badgeLabel: 'Expired',
          badgeClass: 'badge-danger',
          detail: `Expired on ${ing.expiration_date}`,
        });
      } else if (exp.status === 'expired_today') {
        list.push({
          id: `${ing.id}-expired-today`,
          ingredientId: ing.id,
          name: ing.name,
          type: 'expired',
          badgeLabel: 'Expires Today',
          badgeClass: 'badge-danger',
          detail: `Expires today`,
        });
      } else if (exp.status === 'near_expiry') {
        list.push({
          id: `${ing.id}-near-expiry`,
          ingredientId: ing.id,
          name: ing.name,
          type: 'near_expiry',
          badgeLabel: 'Near Expiry',
          badgeClass: 'badge-warning',
          detail: `Expires in ${exp.daysLeft} day${exp.daysLeft === 1 ? '' : 's'} (${ing.expiration_date})`,
        });
      }
    }

    return list;
  }, [ingredients]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleAlertClick() {
    setShowNotifs(false);
    navigate('/inventory');
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Mobile Hamburger Menu */}
        <button
          className="topbar-icon-btn topbar-menu-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu size={18} />
        </button>

        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-center">
        {onSearch && (
          <div className="topbar-search">
            <Search size={15} className="topbar-search-icon" />
            <input
              className="topbar-search-input"
              placeholder={searchPlaceholder ?? 'Search...'}
              onChange={e => onSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="topbar-right">
        {action}

        {/* Notifications Bell Dropdown */}
        <div className="topbar-dropdown-anchor" ref={notifRef}>
          <button
            className={`topbar-icon-btn${showNotifs ? ' active' : ''}`}
            title="Notifications"
            onClick={() => {
              setShowNotifs(prev => !prev);
              setShowHelp(false);
            }}
          >
            <Bell size={18} />
            {alerts.length > 0 && <span className="topbar-notif-dot" />}
          </button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                className="topbar-popover notifs-popover"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <div className="popover-header">
                  <div className="popover-title-row">
                    <span className="popover-title">Inventory Alerts</span>
                    <span className={`badge ${alerts.length > 0 ? 'badge-danger' : 'badge-neutral'}`}>
                      {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
                    </span>
                  </div>
                  <span className="popover-subtitle">Out of stock, low stock, and near expiry items</span>
                </div>

                <div className="notifs-list">
                  {alerts.length === 0 ? (
                    <div className="notifs-empty">
                      <CheckCircle2 size={32} color="var(--success)" />
                      <p>All ingredient stocks and dates look great!</p>
                    </div>
                  ) : (
                    alerts.map(alert => (
                      <div
                        key={alert.id}
                        className="notif-item"
                        onClick={handleAlertClick}
                      >
                        <div className="notif-icon-box">
                          {alert.type === 'out' || alert.type === 'expired' ? (
                            <AlertCircle size={16} color="var(--danger)" />
                          ) : alert.type === 'near_expiry' ? (
                            <Clock size={16} color="var(--warning)" />
                          ) : (
                            <AlertTriangle size={16} color="var(--warning)" />
                          )}
                        </div>
                        <div className="notif-content">
                          <div className="notif-row">
                            <span className="notif-name">{alert.name}</span>
                            <span className={`badge ${alert.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                              {alert.badgeLabel}
                            </span>
                          </div>
                          <span className="notif-detail">{alert.detail}</span>
                        </div>
                        <ChevronRight size={14} className="notif-arrow" />
                      </div>
                    ))
                  )}
                </div>

                {alerts.length > 0 && (
                  <div className="popover-footer" onClick={handleAlertClick}>
                    <span>Manage in Inventory</span>
                    <ChevronRight size={14} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Help Popover */}
        <div className="topbar-dropdown-anchor" ref={helpRef}>
          <button
            className={`topbar-icon-btn${showHelp ? ' active' : ''}`}
            title="Help & Support"
            onClick={() => {
              setShowHelp(prev => !prev);
              setShowNotifs(false);
            }}
          >
            <HelpCircle size={18} />
          </button>

          <AnimatePresence>
            {showHelp && (
              <motion.div
                className="topbar-popover help-popover"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <div className="popover-header">
                  <div className="popover-title-row">
                    <ShieldCheck size={18} color="var(--primary)" />
                    <span className="popover-title">Espro POS Support</span>
                  </div>
                </div>
                <div className="help-body">
                  <p className="help-text">
                    Need help with your account or have system questions?
                  </p>
                  <div className="help-contact-card">
                    <Mail size={15} color="var(--primary)" />
                    <div>
                      <div className="help-contact-title">System Administration</div>
                      <div className="help-contact-email">admin@espro.ph</div>
                    </div>
                  </div>
                  <p className="help-note">
                    Contact your administrator for access requests, PIN resets, and technical assistance.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Avatar */}
        <div
          className="topbar-avatar"
          title={user?.name}
          onClick={() => navigate('/settings')}
        >
          {user?.name?.charAt(0).toUpperCase() ?? <User size={16} />}
        </div>
      </div>
    </header>
  );
}
