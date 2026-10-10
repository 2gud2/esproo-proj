import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, UtensilsCrossed, Package, Receipt,
  BarChart3, Users, Settings, LogOut, PlusCircle, Coffee, X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', adminOnly: true },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/expenses', icon: Receipt, label: 'Expenses Management' },
  { to: '/reports', icon: BarChart3, label: 'Financial Reports', adminOnly: true },
  { to: '/users', icon: Users, label: 'Users', adminOnly: true },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Listen to custom toggle/close events from TopBar
  useEffect(() => {
    const handleToggle = () => setMobileOpen(prev => !prev);
    const handleClose = () => setMobileOpen(false);

    window.addEventListener('toggle-sidebar', handleToggle);
    window.addEventListener('close-sidebar', handleClose);
    return () => {
      window.removeEventListener('toggle-sidebar', handleToggle);
      window.removeEventListener('close-sidebar', handleClose);
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/login');
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Coffee size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="sidebar-logo-name">Espro</div>
            <div className="sidebar-logo-sub">Operational Hub</div>
          </div>
          {mobileOpen && (
            <button
              className="sidebar-icon-btn mobile-close-btn"
              onClick={() => setMobileOpen(false)}
              title="Close menu"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems
            .filter(item => !item.adminOnly || user?.role === 'admin')
            .map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-pill"
                        className="sidebar-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}
                    <Icon size={18} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        {/* New Sale CTA */}
        <div className="sidebar-cta">
          <motion.button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/pos')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <PlusCircle size={16} />
            New Sale
          </motion.button>
        </div>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name ?? 'User'}</div>
              <div className="sidebar-user-role">
                {user?.role === 'admin' ? 'Administrator' : 'Employee'}
              </div>
            </div>
          </div>
          <div className="sidebar-actions">
            <NavLink to="/settings" className="sidebar-icon-btn" title="Settings">
              <Settings size={16} />
            </NavLink>
            <button className="sidebar-icon-btn danger" onClick={handleSignOut} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
