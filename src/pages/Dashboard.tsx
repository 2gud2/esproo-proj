import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, ShoppingBag, Package, AlertTriangle,
  Inbox, ChevronRight, ArrowRight, Flame
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { loadIngredients, loadSales } from '../lib/db';
import { isLowStock, isOutOfStock } from '../lib/stockStatus';
import type { Ingredient, Sale } from '../lib/mockData';
import { format, subDays, isToday, isSameWeek, isSameMonth } from 'date-fns';
import './Dashboard.css';

const fade = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [salesTrendPeriod, setSalesTrendPeriod] = useState<'today' | 'weekly' | 'monthly'>('today');
  const [bsPeriod, setBsPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDashboardData() {
    try {
      const [salesData, ingredientsData] = await Promise.all([
        loadSales(),
        loadIngredients()
      ]);
      setSales(salesData);
      setIngredients(ingredientsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();

    // Re-fetch live metrics when user switches tabs or refocuses window
    const onFocus = () => fetchDashboardData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const todaySales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.createdAt);
      return isToday(d) && s.status === 'completed';
    });
  }, [sales]);

  const todayRevenue = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + s.total, 0);
  }, [todaySales]);

  // Unified stock status counts
  const lowStockCount = useMemo(() => ingredients.filter(isLowStock).length, [ingredients]);
  const outOfStockCount = useMemo(() => ingredients.filter(isOutOfStock).length, [ingredients]);
  const totalStockAlerts = lowStockCount + outOfStockCount;

  const lowStockIngredients = useMemo(() => {
    return ingredients.filter(i => isLowStock(i) || isOutOfStock(i));
  }, [ingredients]);

  // Top Seller Today
  const topSellerToday = useMemo(() => {
    const itemMap = new Map<string, { name: string; qtySold: number }>();
    todaySales.forEach(s => {
      (s.items || []).forEach((item: any) => {
        const baseName = item.product?.name || item.name || 'Item';
        const sizeName = item.size_name || item.size?.name || null;
        const name = sizeName ? `${baseName} (${sizeName})` : baseName;
        const qty = Number(item.qty || 1);
        const existing = itemMap.get(name);
        if (existing) {
          existing.qtySold += qty;
        } else {
          itemMap.set(name, { name, qtySold: qty });
        }
      });
    });
    const sorted = Array.from(itemMap.values()).sort((a, b) => b.qtySold - a.qtySold);
    return sorted[0] || null;
  }, [todaySales]);

  // Today's Sales Hourly Chart Data
  const todayChartData = useMemo(() => {
    const hours = Array.from({ length: 17 }, (_, i) => {
      const h = i + 6; // 6 AM to 10 PM
      const label = format(new Date().setHours(h, 0, 0, 0), 'ha');
      return { hour: h, day: label, sales: 0 };
    });

    sales.forEach(s => {
      if (s.status === 'completed') {
        const d = new Date(s.createdAt);
        if (isToday(d)) {
          const h = d.getHours();
          const match = hours.find(item => item.hour === h);
          if (match) {
            match.sales += s.total;
          } else if (h < 6 && hours[0]) {
            hours[0].sales += s.total;
          } else if (h > 22 && hours[hours.length - 1]) {
            hours[hours.length - 1].sales += s.total;
          }
        }
      }
    });

    return hours.map(h => ({ day: h.day, sales: h.sales }));
  }, [sales]);

  // Weekly Sales Daily Chart Data (Past 7 Days)
  const weeklyChartData = useMemo(() => {
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { day: format(d, 'EEE'), dateStr: d.toDateString(), sales: 0 };
    });

    sales.forEach(s => {
      if (s.status === 'completed') {
        const sDate = new Date(s.createdAt).toDateString();
        const match = result.find(r => r.dateStr === sDate);
        if (match) {
          match.sales += s.total;
        }
      }
    });

    return result.map(r => ({ day: r.day, sales: r.sales }));
  }, [sales]);

  // Monthly Sales Chart Data (Past 30 Days)
  const monthlyChartData = useMemo(() => {
    const result = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i);
      return { day: format(d, 'MMM d'), dateStr: d.toDateString(), sales: 0 };
    });

    sales.forEach(s => {
      if (s.status === 'completed') {
        const sDate = new Date(s.createdAt).toDateString();
        const match = result.find(r => r.dateStr === sDate);
        if (match) {
          match.sales += s.total;
        }
      }
    });

    return result.map(r => ({ day: r.day, sales: r.sales }));
  }, [sales]);

  const activeChartData = useMemo(() => {
    if (salesTrendPeriod === 'today') return todayChartData;
    if (salesTrendPeriod === 'weekly') return weeklyChartData;
    return monthlyChartData;
  }, [salesTrendPeriod, todayChartData, weeklyChartData, monthlyChartData]);

  const todayTotal = useMemo(() => {
    return todayChartData.reduce((sum, item) => sum + item.sales, 0);
  }, [todayChartData]);

  const weeklyTotal = useMemo(() => {
    return weeklyChartData.reduce((sum, item) => sum + item.sales, 0);
  }, [weeklyChartData]);

  const monthlyTotal = useMemo(() => {
    return monthlyChartData.reduce((sum, item) => sum + item.sales, 0);
  }, [monthlyChartData]);

  const bestSellers = useMemo(() => {
    const now = new Date();
    const itemMap = new Map<string, { name: string; category: string; qtySold: number; revenue: number }>();

    sales.forEach(s => {
      if (s.status === 'completed') {
        const d = new Date(s.createdAt);
        let inPeriod = false;

        if (bsPeriod === 'today') {
          inPeriod = isToday(d);
        } else if (bsPeriod === 'week') {
          inPeriod = isSameWeek(d, now, { weekStartsOn: 1 });
        } else if (bsPeriod === 'month') {
          inPeriod = isSameMonth(d, now);
        }

        if (inPeriod) {
          (s.items || []).forEach((item: any) => {
            const baseName = item.product?.name || item.name || 'Item';
            const sizeName = item.size_name || item.size?.name || null;
            const name = sizeName ? `${baseName} (${sizeName})` : baseName;
            const cat = item.product?.category || item.category || 'General';
            const price = item.product?.price || item.price || 0;
            const qty = Number(item.qty || 1);
            const rev = price * qty;

            const existing = itemMap.get(name);
            if (existing) {
              existing.qtySold += qty;
              existing.revenue += rev;
            } else {
              itemMap.set(name, { name, category: cat, qtySold: qty, revenue: rev });
            }
          });
        }
      }
    });

    return Array.from(itemMap.values())
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 10)
      .map((bs, index) => ({
        rank: index + 1,
        name: bs.name,
        category: bs.category,
        qtySold: bs.qtySold,
        revenue: bs.revenue
      }));
  }, [sales, bsPeriod]);

  const statCards = [
    {
      label: "Today's Total Sales",
      value: `₱${todayRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${todaySales.length} transaction${todaySales.length === 1 ? '' : 's'} today`,
      icon: TrendingUp,
      color: '#943A1F',
      bg: 'rgba(148,58,31,0.1)',
      route: user?.role === 'admin' ? '/reports' : '/pos',
    },
    {
      label: 'Transaction Count',
      value: todaySales.length.toString(),
      sub: todaySales.length > 0 ? 'Completed today' : 'No sales yet today',
      icon: ShoppingBag,
      color: '#1565C0',
      bg: 'rgba(21,101,192,0.1)',
      route: user?.role === 'admin' ? '/reports' : '/pos',
    },
    {
      label: 'Total Ingredients in Stock',
      value: ingredients.filter(i => i.stock_quantity > 0).length.toString(),
      sub: `${ingredients.length} raw ingredient item${ingredients.length === 1 ? '' : 's'} tracked`,
      icon: Package,
      color: '#2E7D32',
      bg: 'rgba(46,125,50,0.1)',
      route: '/inventory',
    },
    {
      label: 'Stock Alerts',
      value: totalStockAlerts.toString(),
      sub: `${lowStockCount} low · ${outOfStockCount} out`,
      icon: AlertTriangle,
      color: totalStockAlerts > 0 ? '#E65100' : '#2E7D32',
      bg: totalStockAlerts > 0 ? 'rgba(230,81,0,0.1)' : 'rgba(46,125,50,0.1)',
      route: '/inventory',
    },
    {
      label: 'Top Seller Today',
      value: topSellerToday ? topSellerToday.name : 'None yet',
      sub: topSellerToday ? `${topSellerToday.qtySold} sold today` : 'No orders completed today',
      icon: Flame,
      color: '#D97706',
      bg: 'rgba(217,119,6,0.1)',
      route: user?.role === 'admin' ? '/reports' : '/pos',
    },
  ];

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <TopBar title="Dashboard" />
          <main className="page-body">
            <div className="empty-state" style={{ padding: '100px 20px' }}>
              <div className="spinner" />
              <p>Loading real-time metrics...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="Dashboard" action={
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            + New Sale
          </button>
        } />
        <main className="page-body compact-dashboard">
          {/* Stat Cards Grid (5 Cards, Compact & Clickable) */}
          <motion.div
            className="stats-grid"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
          >
            {statCards.map((card) => (
              <motion.div
                key={card.label}
                className="card stat-card compact clickable"
                variants={fade}
                onClick={() => navigate(card.route)}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(card.route);
                  }
                }}
              >
                <div className="stat-card-top">
                  <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
                    <card.icon size={18} />
                  </div>
                  <div className="stat-arrow-hint">
                    <span>Open</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
                <div className="stat-value">{card.value}</div>
                <div className="stat-label">{card.label}</div>
                <div className="stat-sub">{card.sub}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Charts & Low Stock Row */}
          <div className="dashboard-grid">
            {/* Sales Trend Line Graph Card with Today / Weekly / Monthly Switcher */}
            <motion.div className="card card-pad" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="section-header flex-wrap gap-3">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Sales Trend Line Graph
                  </h3>
                  <p className="page-subtitle">
                    {salesTrendPeriod === 'today' && "Hourly sales performance for Today"}
                    {salesTrendPeriod === 'weekly' && "Daily revenue trend over the past 7 days"}
                    {salesTrendPeriod === 'monthly' && "Daily revenue trend over the past 30 days"}
                  </p>
                </div>
                {/* Period Selector Tabs: Today's Sales, Weekly Sales, Month Sales */}
                <div className="trend-period-tabs">
                  <button
                    className={`trend-tab ${salesTrendPeriod === 'today' ? 'active' : ''}`}
                    onClick={() => setSalesTrendPeriod('today')}
                  >
                    <span className="trend-tab-title">Today's Sales</span>
                    <span className="trend-tab-val">₱{todayTotal.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                  </button>
                  <button
                    className={`trend-tab ${salesTrendPeriod === 'weekly' ? 'active' : ''}`}
                    onClick={() => setSalesTrendPeriod('weekly')}
                  >
                    <span className="trend-tab-title">Weekly Sales</span>
                    <span className="trend-tab-val">₱{weeklyTotal.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                  </button>
                  <button
                    className={`trend-tab ${salesTrendPeriod === 'monthly' ? 'active' : ''}`}
                    onClick={() => setSalesTrendPeriod('monthly')}
                  >
                    <span className="trend-tab-title">Month Sales</span>
                    <span className="trend-tab-val">₱{monthlyTotal.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={activeChartData} margin={{ top: 8, right: 8, bottom: 0, left: -15 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#943A1F" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#943A1F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--secondary)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13 }}
                    formatter={(v: any) => [`₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue']}
                    cursor={{ stroke: 'var(--primary)', strokeWidth: 1.5 }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 3, fill: 'var(--primary)' }} activeDot={{ r: 6, fill: 'var(--primary)' }} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Low Stock Ingredients Card */}
            <motion.div className="card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="card-pad section-header">
                <div>
                  <h3 className="clickable-title" onClick={() => navigate('/inventory')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Low-Stock Items <ArrowRight size={14} className="title-arrow" />
                  </h3>
                  <p className="page-subtitle">Matching Inventory alert list</p>
                </div>
                <button className="badge-link" onClick={() => navigate('/inventory')}>
                  <span className={`badge ${totalStockAlerts > 0 ? 'badge-danger' : 'badge-success'}`}>
                    {totalStockAlerts} Alerts
                  </span>
                </button>
              </div>
              <div className="low-stock-list">
                {lowStockIngredients.length === 0 ? (
                  <div className="empty-state" style={{ padding: '25px 10px' }}>
                    <Package size={26} />
                    <p>All ingredients are well stocked!</p>
                  </div>
                ) : lowStockIngredients.slice(0, 5).map(ing => (
                  <div
                    key={ing.id}
                    className="low-stock-item clickable"
                    onClick={() => navigate('/inventory')}
                    title="Click to manage inventory"
                  >
                    <div className="low-stock-icon"><Package size={16} /></div>
                    <div className="low-stock-info">
                      <span className="low-stock-name">{ing.name}</span>
                      <span className="low-stock-cat">Unit: {ing.unit}</span>
                    </div>
                    <div className="low-stock-meta">
                      <span className={`badge ${isOutOfStock(ing) ? 'badge-danger' : 'badge-warning'}`}>
                        {ing.stock_quantity} {ing.unit}
                      </span>
                      <span className="low-stock-min">Min: {ing.low_stock_threshold}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Best Sellers Card */}
          <motion.div className="card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="card-pad section-header">
              <div>
                <h3 className="clickable-title" onClick={() => navigate(user?.role === 'admin' ? '/reports' : '/pos')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Best-Selling Items <ArrowRight size={14} className="title-arrow" />
                </h3>
                <p className="page-subtitle">Ranked by actual quantity sold</p>
              </div>
              <div className="period-tabs">
                {(['today', 'week', 'month'] as const).map(p => (
                  <button key={p} className={`period-tab${bsPeriod === p ? ' active' : ''}`} onClick={() => setBsPeriod(p)}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {bestSellers.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <Inbox size={28} />
                <p>No sales recorded yet for this period.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellers.map(bs => (
                      <tr
                        key={bs.name}
                        className="clickable-row"
                        onClick={() => navigate(user?.role === 'admin' ? '/menu' : '/pos')}
                        title="Click to open menu items"
                      >
                        <td>
                          <span className={`rank-badge rank-${bs.rank}`}>#{bs.rank}</span>
                        </td>
                        <td><span style={{ fontWeight: 600 }}>{bs.name}</span></td>
                        <td><span className="badge badge-neutral">{bs.category}</span></td>
                        <td>{bs.qtySold.toLocaleString()} unit{bs.qtySold === 1 ? '' : 's'}</td>
                        <td style={{ fontWeight: 600 }}>₱{bs.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
