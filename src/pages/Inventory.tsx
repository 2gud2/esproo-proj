import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Package, X, Save } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import type { Ingredient } from '../lib/mockData';
import { loadIngredients, saveIngredient } from '../lib/db';
import toast from 'react-hot-toast';
import './Inventory.css';

const PAGE_SIZE = 20;

// Curated Coffee Shop Units of Measurement (Full Name + Abbreviation)
export const COFFEE_SHOP_UNITS = [
  { label: 'Grams (g)', value: 'g' },
  { label: 'Kilograms (kg)', value: 'kg' },
  { label: 'Milliliters (ml)', value: 'ml' },
  { label: 'Liters (L)', value: 'L' },
  { label: 'Ounces (oz)', value: 'oz' },
  { label: 'Fluid Ounces (fl oz)', value: 'fl oz' },
  { label: 'Pounds (lb)', value: 'lb' },
  { label: 'Pieces (pcs)', value: 'pcs' },
  { label: 'Espresso Shots (shots)', value: 'shots' },
  { label: 'Syrup Pumps (pumps)', value: 'pumps' },
  { label: 'Scoops (scoops)', value: 'scoops' },
  { label: 'Dashes (dashes)', value: 'dashes' },
  { label: 'Bottles (bottles)', value: 'bottles' },
  { label: 'Cans (cans)', value: 'cans' },
  { label: 'Boxes (boxes)', value: 'boxes' },
  { label: 'Packs (packs)', value: 'packs' },
  { label: 'Bags (bags)', value: 'bags' },
  { label: 'Other (Custom Unit)', value: 'Other' },
];

const defaultForm: Omit<Ingredient, 'id'> = {
  name: '',
  unit: 'g',
  stock_quantity: 0,
  low_stock_threshold: 10,
};

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(defaultForm);

  // Unit dropdown state
  const [unitSelect, setUnitSelect] = useState('g');
  const [customUnit, setCustomUnit] = useState('');

  async function fetchIngredients() {
    try {
      const data = await loadIngredients();
      setIngredients(data);
    } catch (err) {
      toast.error('Failed to load ingredients inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchIngredients();
  }, []);

  const filtered = useMemo(() => ingredients.filter(i => {
    return i.name.toLowerCase().includes(search.toLowerCase()) ||
           i.unit.toLowerCase().includes(search.toLowerCase());
  }), [ingredients, search]);

  // Reset to page 1 on search change
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedIngredients = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const lowCount = ingredients.filter(i => i.stock_quantity <= i.low_stock_threshold).length;

  function openAdd() {
    setForm(defaultForm);
    setUnitSelect('g');
    setCustomUnit('');
    setEditing(null);
    setModal('add');
  }

  function openEdit(i: Ingredient) {
    setForm({
      name: i.name,
      unit: i.unit,
      stock_quantity: i.stock_quantity,
      low_stock_threshold: i.low_stock_threshold,
    });
    const found = COFFEE_SHOP_UNITS.find(u => u.value === i.unit);
    if (found) {
      setUnitSelect(found.value);
      setCustomUnit('');
    } else {
      setUnitSelect('Other');
      setCustomUnit(i.unit);
    }
    setEditing(i);
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Ingredient name is required'); return; }
    
    const finalUnit = unitSelect === 'Other' ? customUnit.trim() : unitSelect;
    if (!finalUnit) { toast.error('Please specify a unit of measurement'); return; }
    
    if (form.stock_quantity < 0) { toast.error('Stock quantity cannot be negative'); return; }
    if (form.low_stock_threshold < 0) { toast.error('Threshold cannot be negative'); return; }

    try {
      await saveIngredient({
        id: editing?.id,
        name: form.name.trim(),
        unit: finalUnit,
        stock_quantity: form.stock_quantity,
        low_stock_threshold: form.low_stock_threshold,
      });
      toast.success(editing ? 'Ingredient updated!' : 'Ingredient added!');
      setModal(null);
      await fetchIngredients();
    } catch (err) {
      toast.error('Failed to save ingredient');
    }
  }

  function f(field: keyof typeof form, val: any) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          title="Raw Ingredients Inventory"
          searchPlaceholder="Search ingredients..."
          onSearch={setSearch}
          action={
            <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add Ingredient</button>
          }
        />
        <main className="page-body">
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 20 }}>
            <div className="card card-pad">
              <div className="stat-sub">Total Raw Ingredients</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{ingredients.length}</div>
              <div className="stat-label">Tracked in inventory</div>
            </div>
            <div className="card card-pad">
              <div className="stat-sub">Low Stock Alerts</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>{lowCount}</div>
              <div className="stat-label">Needs restocking</div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <h3 style={{ flex: 1 }}>Ingredients Master List</h3>
            </div>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading ingredients...
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ingredient Name</th>
                      <th>Unit</th>
                      <th>Current Stock</th>
                      <th>Low-Stock Threshold</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedIngredients.map(i => {
                      const low = i.stock_quantity <= i.low_stock_threshold;
                      return (
                        <motion.tr key={i.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{i.name}</div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}><span className="badge badge-neutral">{i.unit}</span></td>
                          <td style={{ fontWeight: 600 }}>{i.stock_quantity} {i.unit}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{i.low_stock_threshold} {i.unit}</td>
                          <td>
                            <span className={`badge ${low ? 'badge-danger' : 'badge-success'}`}>
                              {low ? '● Low Stock' : '● OK'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-icon btn-ghost" onClick={() => openEdit(i)} title="Edit Ingredient">
                                <Edit2 size={15} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {!loading && filtered.length === 0 && (
                <div className="empty-state"><Package size={32} /><p>No raw ingredients found</p></div>
              )}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </div>
        </main>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <div className="modal-header">
                <h3>{modal === 'add' ? 'Add Raw Ingredient' : 'Edit Ingredient'}</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setModal(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ingredient Name *</label>
                  <input className="input" placeholder="e.g. Matcha Powder, Milk, Coffee Beans" value={form.name} onChange={e => f('name', e.target.value)} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Unit of Measurement *</label>
                    <select
                      className="input select"
                      value={unitSelect}
                      onChange={e => setUnitSelect(e.target.value)}
                    >
                      {COFFEE_SHOP_UNITS.map(u => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    {unitSelect === 'Other' && (
                      <input
                        className="input"
                        placeholder="Type custom unit (e.g. scoop, pinch)"
                        value={customUnit}
                        onChange={e => setCustomUnit(e.target.value)}
                        style={{ marginTop: 6 }}
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current Stock Quantity *</label>
                    <input type="number" className="input" min={0} step="0.01" value={form.stock_quantity} onChange={e => f('stock_quantity', Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Low-Stock Alert Threshold *</label>
                    <input type="number" className="input" min={0} step="0.01" value={form.low_stock_threshold} onChange={e => f('low_stock_threshold', Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave}><Save size={15} /> {modal === 'add' ? 'Add Ingredient' : 'Save Changes'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
