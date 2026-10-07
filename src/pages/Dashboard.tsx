import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, ShoppingBag, Package, AlertTriangle,
  Inbox
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import { loadIngredients, loadSales, loadMenuItems } from '../lib/db';
import type { Ingredient, Sale, MenuItem } from '../lib/mockData';
import { format, subDays, isToday, isSameWeek, isSameMonth } from 'date-fns';
import './Dashboard.css';

const fade = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  const [bsPeriod, setBsPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [_menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDashboardData() {
    try {
      const [salesData, ingredientsData, menuData] = await Promise.all([
        loadSales(),
        loadIngredients(),
        loadMenuItems(true)
      ]);
      setSales(salesData);
      setIngredients(ingredientsData);
      setMenuItems(menuData);
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

  const totalStockQuantity = useMemo(() => {
    return ingredients.reduce((sum, i) => sum + i.stock_quantity, 0);
  }, [ingredients]);

  const lowStockIngredients = useMemo(() => {
    return ingredients.filter(i => i.stock_quantity <= i.low_stock_threshold);
  }, [ingredients]);

  const chartData = useMemo(() => {
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
          s.items.forEach((item: any) => {
            const name = item.product?.name || item.name || 'Item';
            const cat = item.product?.category || item.category || 'General';
            const price = item.product?.price || item.price || 0;
            const qty = item.qty || 1;
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
    },
    {
      label: 'Transaction Count',
      value: todaySales.length.toString(),
      sub: todaySales.length > 0 ? 'Completed today' : 'No sales yet today',
      icon: ShoppingBag,
      color: '#1565C0',
      bg: 'rgba(21,101,192,0.1)',
    },
    {
      label: 'Total Ingredients in Stock',
      value: ingredients.filter(i => i.stock_quantity > 0).length.toString(),
      sub: `${ingredients.length} raw ingredient item${ingredients.length === 1 ? '' : 's'} tracked`,
      icon: Package,
      color: '#2E7D32',
      bg: 'rgba(46,125,50,0.1)',
    },
    {
      label: 'Low-Stock Alerts',
      value: lowStockIngredients.length.toString(),
      sub: lowStockIngredients.length > 0 ? 'Ingredients need restocking' : 'All stock levels healthy',
      icon: AlertTriangle,
      color: lowStockIngredients.length > 0 ? '#E65100' : '#2E7D32',
      bg: lowStockIngredients.length > 0 ? 'rgba(230,81,0,0.1)' : 'rgba(46,125,50,0.1)',
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
          <button className="btn btn-primary" onClick={() => window.location.href = '/pos'}>
            + New Sale
          </button>
        } />
        <main className="page-body">
          {/* Stat Cards */}
          <motion.div
            className="stats-grid"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            initial="hidden"
            animate="show"
          >
            {statCards.map((card) => (
              <motion.div key={card.label} className="card card-pad stat-card" variants={fade}>
                <div className="stat-card-top">
                  <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
                    <card.icon size={20} />
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
            {/* Area chart */}
            <motion.div className="card card-pad" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="section-header">
                <div>
                  <h3>Weekly Sales</h3>
                  <p className="page-subtitle">Live revenue trend over the past 7 days</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#943A1F" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#943A1F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--secondary)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13 }}
                    formatter={(v: any) => [`₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Sales']}
                    cursor={{ stroke: 'var(--primary)', strokeWidth: 1.5 }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2.5} fill="url(#salesGrad)" dot={false} activeDot={{ r: 5, fill: 'var(--primary)' }} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Low Stock Ingredients */}
            <motion.div className="card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <div className="card-pad section-header">
                <div>
                  <h3>Low-Stock Items</h3>
                  <p className="page-subtitle">Matching Inventory alert list</p>
                </div>
                <span className={`badge ${lowStockIngredients.length > 0 ? 'badge-danger' : 'badge-success'}`}>
                  {lowStockIngredients.length} Low
                </span>
              </div>
              <div className="low-stock-list">
                {lowStockIngredients.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 10px' }}>
                    <Package size={28} />
                    <p>All ingredients are well stocked!</p>
                  </div>
                ) : lowStockIngredients.map(ing => (
                  <div key={ing.id} className="low-stock-item">
                    <div className="low-stock-icon"><Package size={16} /></div>
                    <div className="low-stock-info">
                      <span className="low-stock-name">{ing.name}</span>
                      <span className="low-stock-cat">Unit: {ing.unit}</span>
                    </div>
                    <div className="low-stock-meta">
                      <span className="badge badge-danger">{ing.stock_quantity} {ing.unit}</span>
                      <span className="low-stock-min">Min: {ing.low_stock_threshold}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Best Sellers */}
          <motion.div className="card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="card-pad section-header">
              <div>
                <h3>Best-Selling Items</h3>
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
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <Inbox size={32} />
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
                      <tr key={bs.name}>
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
