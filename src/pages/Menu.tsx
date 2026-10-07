import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, X, Save, Trash2, UtensilsCrossed, Upload,
  ChefHat, Coffee
} from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import { MENU_CATEGORIES } from '../lib/mockData';
import type { MenuItem, Ingredient } from '../lib/mockData';
import {
  loadMenuItems, saveMenuItem, softDeleteMenuItem,
  loadIngredients, loadMenuItemRecipe, uploadMenuImage
} from '../lib/db';
import toast from 'react-hot-toast';
import './Menu.css';

interface RecipeRow {
  ingredient_id: string;
  quantity_used: number;
  unit: string;
}

const defaultForm = {
  name: '',
  category: MENU_CATEGORIES[0],
  price: 0,
  image_url: '' as string | null,
};

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);

  async function fetchData() {
    try {
      const [items, ings] = await Promise.all([
        loadMenuItems(false),
        loadIngredients(),
      ]);
      setMenuItems(items);
      setIngredients(ings);
    } catch (err) {
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => menuItems.filter(m => {
    const matchCat = filterCat === 'All' || m.category === filterCat;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [menuItems, search, filterCat]);

  const activeCount = menuItems.filter(m => m.is_active).length;
  const categoriesUsed = new Set(menuItems.map(m => m.category)).size;

  // ─── Form Handlers ───
  function f(field: keyof typeof form, val: any) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  function openAdd() {
    setForm(defaultForm);
    setRecipeRows([]);
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setModal('add');
  }

  async function openEdit(item: MenuItem) {
    setForm({
      name: item.name,
      category: item.category,
      price: item.price,
      image_url: item.image_url || null,
    });
    setImagePreview(item.image_url || null);
    setImageFile(null);
    setEditing(item);

    // Load recipe
    const recipe = await loadMenuItemRecipe(item.id);
    setRecipeRows(recipe.map(r => ({
      ingredient_id: r.ingredient_id,
      quantity_used: r.quantity_used,
      unit: r.unit,
    })));
    setModal('edit');
  }

  function addRecipeRow() {
    if (ingredients.length === 0) {
      toast.error('No ingredients available. Add ingredients in Inventory first.');
      return;
    }
    // Find first ingredient not already in recipe
    const usedIds = new Set(recipeRows.map(r => r.ingredient_id));
    const available = ingredients.find(i => !usedIds.has(i.id));
    if (!available) {
      toast.error('All ingredients are already in the recipe');
      return;
    }
    setRecipeRows(prev => [...prev, {
      ingredient_id: available.id,
      quantity_used: 1,
      unit: available.unit,
    }]);
  }

  function updateRecipeRow(index: number, field: keyof RecipeRow, value: any) {
    setRecipeRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      // Auto-fill unit when ingredient changes
      if (field === 'ingredient_id') {
        const ing = ingredients.find(ig => ig.id === value);
        if (ing) updated.unit = ing.unit;
      }
      return updated;
    }));
  }

  function removeRecipeRow(index: number) {
    setRecipeRows(prev => prev.filter((_, i) => i !== index));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    f('image_url', null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Menu item name is required'); return; }
    if (form.price < 0) { toast.error('Price cannot be negative'); return; }

    // Validate recipe rows
    for (const row of recipeRows) {
      if (row.quantity_used <= 0) {
        toast.error('All recipe quantities must be greater than 0');
        return;
      }
    }

    // Check for duplicate ingredients in recipe
    const ids = recipeRows.map(r => r.ingredient_id);
    if (new Set(ids).size !== ids.length) {
      toast.error('Duplicate ingredients in recipe. Each ingredient can only appear once.');
      return;
    }

    setSaving(true);
    try {
      // Upload image if new file selected
      let imageUrl = form.image_url;
      if (imageFile) {
        const uploaded = await uploadMenuImage(imageFile);
        if (uploaded) imageUrl = uploaded;
      }

      await saveMenuItem(
        {
          id: editing?.id,
          name: form.name.trim(),
          category: form.category,
          price: form.price,
          image_url: imageUrl,
          is_active: editing?.is_active ?? true,
        },
        recipeRows
      );

      toast.success(editing ? 'Menu item updated!' : 'Menu item added!');
      setModal(null);
      await fetchData();
    } catch (err) {
      toast.error('Failed to save menu item');
    } finally {
      setSaving(false);
    }
  }

  function openDelete(item: MenuItem) {
    setDeletingItem(item);
    setDeleteModal(true);
  }

  async function confirmDelete() {
    if (!deletingItem) return;
    try {
      await softDeleteMenuItem(deletingItem.id);
      toast.success(`"${deletingItem.name}" removed from menu`);
      setDeleteModal(false);
      setDeletingItem(null);
      await fetchData();
    } catch (err) {
      toast.error('Failed to delete menu item');
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          title="Menu"
          searchPlaceholder="Search menu items..."
          onSearch={setSearch}
          action={
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={15} /> Add Menu Item
            </button>
          }
        />
        <main className="page-body">
          {/* Stats */}
          <div className="menu-stats">
            <div className="card card-pad">
              <div className="stat-sub">Total Items</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{menuItems.length}</div>
              <div className="stat-label">In menu catalog</div>
            </div>
            <div className="card card-pad">
              <div className="stat-sub">Active Items</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>{activeCount}</div>
              <div className="stat-label">Visible in POS</div>
            </div>
            <div className="card card-pad">
              <div className="stat-sub">Categories</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{categoriesUsed}</div>
              <div className="stat-label">Product categories</div>
            </div>
          </div>

          {/* Filter */}
          <div className="card card-pad" style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ flex: 1 }}>Menu Items</h3>
            {['All', ...MENU_CATEGORIES].map(c => (
              <button key={c} className={`cat-chip${filterCat === c ? ' active' : ''}`} onClick={() => setFilterCat(c)} style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                {c}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading menu...
            </div>
          ) : (
            <div className="menu-grid">
              <AnimatePresence>
                {filtered.map(item => (
                  <motion.div
                    key={item.id}
                    className={`menu-card${!item.is_active ? ' inactive' : ''}`}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -3 }}
                    onClick={() => openEdit(item)}
                  >
                    <div className="menu-card-img">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} />
                      ) : (
                        <Coffee size={32} className="placeholder-icon" />
                      )}
                    </div>
                    {!item.is_active && <div className="inactive-badge">Inactive</div>}
                    <div className="menu-card-body">
                      <div className="menu-card-name">{item.name}</div>
                      <div className="menu-card-cat">
                        <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          {item.category}
                        </span>
                      </div>
                      <div className="menu-card-bottom">
                        <span className="menu-card-price">₱{item.price.toLocaleString()}</span>
                        <div className="menu-card-actions" onClick={e => e.stopPropagation()}>
                          <button className="btn btn-icon btn-ghost" onClick={() => openEdit(item)} title="Edit" style={{ padding: 4 }}>
                            <Edit2 size={14} />
                          </button>
                          {item.is_active && (
                            <button className="btn btn-icon btn-ghost" onClick={() => openDelete(item)} title="Remove from menu" style={{ padding: 4, color: 'var(--danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && !loading && (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                  <UtensilsCrossed size={32} />
                  <p>No menu items found</p>
                  <button className="btn btn-primary btn-sm" onClick={openAdd}>
                    <Plus size={14} /> Add your first menu item
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ─── Add/Edit Modal ─── */}
      <AnimatePresence>
        {modal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div className="modal modal-wide" onClick={e => e.stopPropagation()} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <div className="modal-header">
                <h3>{modal === 'add' ? 'Add Menu Item' : 'Edit Menu Item'}</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setModal(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                {/* Image Upload */}
                <div className="form-group">
                  <label className="form-label">Product Image (optional)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                  />
                  <div
                    className={`image-upload-area${imagePreview ? ' has-image' : ''}`}
                    onClick={() => fileRef.current?.click()}
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" />
                        <button
                          className="image-upload-remove"
                          onClick={e => { e.stopPropagation(); clearImage(); }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="image-upload-text">
                        <Upload size={24} />
                        <span>Click to upload an image</span>
                        <span style={{ fontSize: '0.72rem' }}>PNG, JPG up to 5MB</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="form-group">
                  <label className="form-label">Item Name *</label>
                  <input className="input" placeholder="e.g. Matcha Latte" value={form.name} onChange={e => f('name', e.target.value)} />
                </div>

                {/* Category + Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="input select" value={form.category} onChange={e => f('category', e.target.value)}>
                      {MENU_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price (₱) *</label>
                    <input type="number" className="input" min={0} step="0.01" value={form.price || ''} onChange={e => f('price', Number(e.target.value))} placeholder="0.00" />
                  </div>
                </div>

                {/* Recipe Section */}
                <div className="recipe-section">
                  <div className="recipe-header">
                    <div className="recipe-header-title">
                      <ChefHat size={16} />
                      Recipe (Ingredients per 1 unit sold)
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={addRecipeRow}>
                      <Plus size={13} /> Add Ingredient
                    </button>
                  </div>

                  {recipeRows.length === 0 ? (
                    <div className="recipe-empty">
                      No ingredients added yet. Click "Add Ingredient" to build the recipe.
                    </div>
                  ) : (
                    <div className="recipe-rows">
                      {recipeRows.map((row, idx) => {
                        const selectedIng = ingredients.find(i => i.id === row.ingredient_id);
                        return (
                          <div key={idx} className="recipe-row">
                            <div className="form-group">
                              {idx === 0 && <label className="form-label">Ingredient</label>}
                              <select
                                className="input select"
                                value={row.ingredient_id}
                                onChange={e => updateRecipeRow(idx, 'ingredient_id', e.target.value)}
                              >
                                {ingredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>{ing.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              {idx === 0 && <label className="form-label">Qty Used</label>}
                              <input
                                type="number"
                                className="input"
                                min={0}
                                step="0.01"
                                value={row.quantity_used || ''}
                                onChange={e => updateRecipeRow(idx, 'quantity_used', Number(e.target.value))}
                              />
                            </div>
                            <div className="form-group">
                              {idx === 0 && <label className="form-label">Unit</label>}
                              <input
                                className="input"
                                value={selectedIng?.unit || row.unit}
                                readOnly
                                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                              />
                            </div>
                            <button
                              className="recipe-remove-btn"
                              onClick={() => removeRecipeRow(idx)}
                              title="Remove ingredient"
                              style={idx === 0 ? { marginTop: 20 } : {}}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner-sm" /> : <><Save size={15} /> {modal === 'add' ? 'Add Item' : 'Save Changes'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirmation Modal ─── */}
      <AnimatePresence>
        {deleteModal && deletingItem && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModal(false)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <h3>Remove Menu Item</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setDeleteModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p className="confirm-text">
                  Are you sure you want to remove <strong>"{deletingItem.name}"</strong> from the menu?
                  It will be hidden from POS but historical sales data will be preserved.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDelete}>
                  <Trash2 size={15} /> Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
