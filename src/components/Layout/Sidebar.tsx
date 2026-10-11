import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, UtensilsCrossed, Package, Receipt,
  BarChart3, Users, UserCog, Settings, LogOut, PlusCircle, Coffee, X,
  ChevronLeft, ChevronRight, Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', adminOnly: true },
  { to: '/inventory', icon: Package, label: 'Inventory Management' },
  { to: '/expenses', icon: Receipt, label: 'Expenses Management' },
  { to: '/reports', icon: BarChart3, label: 'Financial Reports', adminOnly: true },
  { to: '/employees', icon: Users, label: 'Employee Management', adminOnly: true },
  { to: '/users', icon: UserCog, label: 'User Management', adminOnly: true },
];

const STORAGE_KEY = 'espro_sidebar_collapsed';

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth <= 768) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Synchronize documentElement class and attribute with collapsed state
  useEffect(() => {
    const isDesktop = window.innerWidth > 768;
    if (isDesktop && collapsed) {
      document.documentElement.classList.add('sidebar-collapsed');
      document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
    } else {
      document.documentElement.classList.remove('sidebar-collapsed');
      document.documentElement.removeAttribute('data-sidebar-collapsed');
    }
  }, [collapsed]);

  // Listen to custom toggle/close events from TopBar and cross-instance collapse events
  useEffect(() => {
    const handleToggle = () => setMobileOpen(prev => !prev);
    const handleClose = () => setMobileOpen(false);

    const handleCollapseChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (typeof customEvent.detail === 'boolean') {
        setCollapsed(customEvent.detail);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCollapsed(e.newValue === 'true' && window.innerWidth > 768);
      }
    };

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        document.documentElement.classList.remove('sidebar-collapsed');
        document.documentElement.removeAttribute('data-sidebar-collapsed');
      } else {
        const stored = localStorage.getItem(STORAGE_KEY) === 'true';
        if (stored) {
          document.documentElement.classList.add('sidebar-collapsed');
          document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
          setCollapsed(true);
        }
      }
    };

    window.addEventListener('toggle-sidebar', handleToggle);
    window.addEventListener('close-sidebar', handleClose);
    window.addEventListener('sidebar-collapse-change', handleCollapseChange);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('toggle-sidebar', handleToggle);
      window.removeEventListener('close-sidebar', handleClose);
      window.removeEventListener('sidebar-collapse-change', handleCollapseChange);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
    if (next && window.innerWidth > 768) {
      document.documentElement.classList.add('sidebar-collapsed');
      document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
    } else {
      document.documentElement.classList.remove('sidebar-collapsed');
      document.documentElement.removeAttribute('data-sidebar-collapsed');
    }
    window.dispatchEvent(new CustomEvent('sidebar-collapse-change', { detail: next }));
  }

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Horizontal swipe threshold: 40px, predominantly horizontal
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        // Swiped LEFT -> Collapse or close
        if (window.innerWidth <= 768) {
          setMobileOpen(false);
        } else if (!collapsed) {
          toggleCollapse();
        }
      } else if (deltaX > 0) {
        // Swiped RIGHT -> Expand if collapsed
        if (window.innerWidth > 768 && collapsed) {
          toggleCollapse();
        }
      }
    }
  };

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

      <aside
        className={`sidebar${mobileOpen ? ' open' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div
            className="sidebar-logo-icon"
            onClick={collapsed ? toggleCollapse : undefined}
            title={collapsed ? 'Expand sidebar' : 'Espro'}
            style={collapsed ? { cursor: 'pointer' } : undefined}
          >
            <Coffee size={20} />
          </div>
          <div className="sidebar-logo-text">
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
        <nav
          className="sidebar-nav"
          onClick={(e) => {
            if (collapsed && e.target === e.currentTarget) {
              toggleCollapse();
            }
          }}
        >
          {navItems
            .filter(item => !item.adminOnly || user?.role === 'admin')
            .map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-pill"
                        className="sidebar-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}
                    <Icon size={18} className="sidebar-nav-icon" />
                    <span className="sidebar-nav-label">{label}</span>
                  </>
                )}
              </NavLink>
            ))}

          {/* Middle Collapse / Expand Toggle in empty space (Desktop only) */}
          <div
            className="sidebar-middle-toggle desktop-only"
            onClick={toggleCollapse}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCollapse();
              }
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div className="sidebar-middle-toggle-btn">
              {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </div>
          </div>
        </nav>

        {/* New Sale & Time Clock CTA */}
        <div className="sidebar-cta" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <motion.button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/pos')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="New Sale"
          >
            <PlusCircle size={16} />
            <span>New Sale</span>
          </motion.button>
        </div>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div
              className="sidebar-avatar"
              title={user?.name ?? 'User'}
            >
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
