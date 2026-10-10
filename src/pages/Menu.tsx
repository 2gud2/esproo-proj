import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, X, Save, Trash2, UtensilsCrossed, Upload,
  ChefHat, Coffee, Search, LayoutGrid, List as ListIcon,
  Eye, CheckCircle, AlertCircle
} from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import type { MenuItem, Ingredient, MenuItemIngredient } from '../lib/mockData';
import {
  loadMenuItems, saveMenuItem, softDeleteMenuItem,
  loadIngredients, loadMenuItemRecipe, uploadMenuImage,
  loadCategories, saveCategories
} from '../lib/db';
import {
  calculateIngredientCost,
  getCompatibleUnits,
  convertUnitQuantity
} from '../lib/unitConversion';
import toast from 'react-hot-toast';
import './Menu.css';

interface RecipeRow {
  ingredient_id: string;
  quantity_used: number | string;
  unit: string;
}

const defaultForm = {
  name: '',
  category: 'Beverages',
  price: '' as number | string,
  image_url: '' as string | null,
};

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Modals
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Recipe View Modal (Triggered on click/select of product)
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<MenuItem | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<MenuItemIngredient[]>([]);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  // Category management state & modals
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [deleteCatModal, setDeleteCatModal] = useState(false);
  const [catToDelete, setCatToDelete] = useState<string | null>(null);

  // Dynamic list of categories for filter bar
  const allCategories = useMemo(() => {
    const list = Array.from(new Set([...categories, ...menuItems.map(m => m.category).filter(Boolean)])).filter(c => c !== 'Condiments');
    return ['All', ...list];
  }, [categories, menuItems]);

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);

  async function fetchData() {
    try {
      const [items, ings, cats] = await Promise.all([
        loadMenuItems(false),
        loadIngredients(),
        loadCategories(),
      ]);
      setMenuItems(items);
      setIngredients(ings);
      setCategories(cats.filter(c => c !== 'Condiments'));
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

  // ─── View Recipe Modal Handler ───
  async function openRecipeView(item: MenuItem) {
    setSelectedRecipeItem(item);
    setLoadingRecipe(true);
    try {
      const rec = await loadMenuItemRecipe(item.id);
      setSelectedRecipe(rec);
    } catch (err) {
      toast.error('Failed to load recipe');
    } finally {
      setLoadingRecipe(false);
    }
  }

  // ─── Category Management Handlers ───
  async function handleAddCategory() {
    const name = newCatName.trim();
    if (!name) { toast.error('Please enter a category name'); return; }
    if (name.toLowerCase() === 'condiments') { toast.error('Condiments category is not allowed'); return; }
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
      toast.error(`Category "${name}" already exists`);
      return;
    }

    const updated = [...categories, name];
    setCategories(updated);
    await saveCategories(updated);
    setNewCatName('');
    toast.success(`Category "${name}" added!`);
  }

  function promptDeleteCategory(cat: string) {
    setCatToDelete(cat);
    setDeleteCatModal(true);
  }

  async function confirmDeleteCategory() {
    if (!catToDelete) return;
    const cat = catToDelete;
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    await saveCategories(updated);

    // Reassign items with deleted category to default category
    const fallbackCat = updated[0] || 'Beverages';
    const affectedItems = menuItems.filter(m => m.category === cat);
    if (affectedItems.length > 0) {
      for (const item of affectedItems) {
        await saveMenuItem({ ...item, category: fallbackCat }, []);
      }
    }

    if (filterCat === cat) {
      setFilterCat('All');
    }

    setDeleteCatModal(false);
    setCatToDelete(null);
    toast.success(`Category "${cat}" deleted!`);
    await fetchData();
  }

  // ─── Form Handlers ───
  function f(field: keyof typeof form, val: any) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  function openAdd() {
    setForm({
      name: '',
      category: categories[0] || 'Beverages',
      price: '',
      image_url: null,
    });
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
      price: item.price != null ? String(item.price) : '',
      image_url: item.image_url || null,
    });
    setImagePreview(item.image_url || null);
    setImageFile(null);
    setEditing(item);

    // Load recipe
    const recipe = await loadMenuItemRecipe(item.id);
    setRecipeRows(recipe.map(r => ({
      ingredient_id: r.ingredient_id,
      quantity_used: r.quantity_used != null ? String(r.quantity_used) : '1',
      unit: r.unit,
    })));
    setModal('edit');
  }

  function addRecipeRow() {
    if (ingredients.length === 0) {
      toast.error('No ingredients available. Add ingredients in Inventory first.');
      return;
    }
    const usedIds = new Set(recipeRows.map(r => r.ingredient_id));
    const available = ingredients.find(i => !usedIds.has(i.id));
    if (!available) {
      toast.error('All ingredients are already in the recipe');
      return;
    }
    setRecipeRows(prev => [...prev, {
      ingredient_id: available.id,
      quantity_used: '1',
      unit: available.unit,
    }]);
  }

  function updateRecipeRow(index: number, field: keyof RecipeRow, value: any) {
    setRecipeRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
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
    
    const numPrice = form.price === '' ? 0 : Number(form.price);
    if (isNaN(numPrice) || numPrice < 0) { toast.error('Price cannot be negative'); return; }

    const finalCategory = form.category;

    // Validate recipe rows
    for (const row of recipeRows) {
      const q = Number(row.quantity_used) || 0;
      if (q <= 0) {
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
      let imageUrl = form.image_url;
      if (imageFile) {
        const uploaded = await uploadMenuImage(imageFile);
        if (uploaded) imageUrl = uploaded;
      }

      await saveMenuItem(
        {
          id: editing?.id,
          name: form.name.trim(),
          category: finalCategory,
          price: numPrice,
          image_url: imageUrl,
          is_active: editing?.is_active ?? true,
        },
        recipeRows.map(r => ({
          ingredient_id: r.ingredient_id,
          quantity_used: Number(r.quantity_used) || 0,
          unit: r.unit,
        }))
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

  // Calculate COGS and recipe items for selectedRecipeItem in view modal with unit conversion
  const recipeCalculation = useMemo(() => {
    if (!selectedRecipeItem) return { items: [], totalCogs: 0 };
    const items = selectedRecipe.map(r => {
      const ing = ingredients.find(i => i.id === r.ingredient_id) || r.ingredient;
      const recipeUnit = r.unit || ing?.unit || 'pcs';
      const invUnit = ing?.unit || 'pcs';
      const qty = Number(r.quantity_used) || 0;
      const itemCost = calculateIngredientCost(qty, recipeUnit, ing);
      const isConverted = recipeUnit.toLowerCase().trim() !== invUnit.toLowerCase().trim();
      const qtyInInv = convertUnitQuantity(qty, recipeUnit, invUnit);
      return {
        id: r.id,
        name: ing?.name || 'Unknown Ingredient',
        quantityUsed: qty,
        unit: recipeUnit,
        inventoryUnit: invUnit,
        unitCost: ing?.cost_per_unit ?? 0,
        isConverted,
        qtyInInv: Number.isInteger(qtyInInv) ? qtyInInv : parseFloat(qtyInInv.toFixed(4)),
        itemCost,
      };
    });
    const totalCogs = items.reduce((sum, item) => sum + item.itemCost, 0);
    return { items, totalCogs };
  }, [selectedRecipe, selectedRecipeItem, ingredients]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          title="Menu Management"
          action={
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={15} /> Add Menu Item
            </button>
          }
        />
        <main className="page-body">
          {/* Stats: Categories summary card removed per user request */}
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
          </div>

          {/* Filter Bar with Search, Edit Categories, and View Switcher */}
          <div className="card card-pad category-bar-card" style={{ marginBottom: 20 }}>
            {/* Top Toolbar: Search Bar + View Switcher */}
            <div className="menu-toolbar">
              <div className="menu-search-wrap">
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="view-toggle-group">
                <button
                  className={`view-toggle-btn${viewMode === 'card' ? ' active' : ''}`}
                  onClick={() => setViewMode('card')}
                  title="Card View"
                >
                  <LayoutGrid size={15} /> Cards
                </button>
                <button
                  className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <ListIcon size={15} /> List
                </button>
              </div>
            </div>

            {/* Category Chips and Category Management */}
            <div className="category-bar-header" style={{ marginTop: 4 }}>
              <div className="category-title-area">
                <h3 style={{ fontSize: '0.95rem' }}>Categories</h3>
                <button
                  className={`btn btn-sm ${isEditingCategories ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => {
                    setIsEditingCategories(!isEditingCategories);
                    setShowAddCategoryInput(false);
                  }}
                  style={{ fontSize: '0.78rem', padding: '4px 10px', gap: 4, borderRadius: 'var(--radius-md)' }}
                  title="Toggle Edit Mode for Categories"
                >
                  {isEditingCategories ? (
                    <>Done Editing</>
                  ) : (
                    <>
                      <Edit2 size={13} /> Edit Categories
                    </>
                  )}
                </button>
              </div>

              <div className="category-chips-wrap">
                {allCategories.map(c => {
                  const isAll = c === 'All';
                  const isActive = filterCat === c;
                  const isEditable = isEditingCategories && !isAll;
                  return (
                    <motion.button
                      key={c}
                      layout
                      className={`cat-chip${isActive ? ' active' : ''}`}
                      onClick={() => setFilterCat(c)}
                      animate={{ paddingRight: isEditable ? 6 : 14 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      <span>{c}</span>
                      <AnimatePresence initial={false}>
                        {isEditable && (
                          <motion.span
                            key="delete-btn-wrap"
                            initial={{ width: 0, opacity: 0, scale: 0, marginLeft: 0 }}
                            animate={{ width: 'auto', opacity: 1, scale: 1, marginLeft: 6 }}
                            exit={{ width: 0, opacity: 0, scale: 0, marginLeft: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                          >
                            <span
                              role="button"
                              tabIndex={0}
                              className="cat-chip-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                promptDeleteCategory(c);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  promptDeleteCategory(c);
                                }
                              }}
                              title={`Delete category "${c}"`}
                            >
                              <X size={10} />
                            </span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}

                {/* + Add Category Button when in Edit Mode */}
                <AnimatePresence>
                  {isEditingCategories && !showAddCategoryInput && (
                    <motion.button
                      key="add-cat-btn"
                      className="btn btn-ghost btn-sm add-cat-btn"
                      initial={{ opacity: 0, scale: 0.8, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: -10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      onClick={() => setShowAddCategoryInput(true)}
                      style={{ fontSize: '0.75rem', padding: '4px 12px', gap: 4, borderRadius: 'var(--radius-full)', border: '1.5px dashed var(--primary)', color: 'var(--primary)' }}
                    >
                      <Plus size={14} /> Add Category
                    </motion.button>
                  )}

                  {/* Inline Category Creator Input */}
                  {isEditingCategories && showAddCategoryInput && (
                    <motion.div
                      key="add-cat-form"
                      className="inline-add-cat-form"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <input
                        autoFocus
                        type="text"
                        className="input"
                        placeholder="Category name..."
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCategory();
                            setShowAddCategoryInput(false);
                          } else if (e.key === 'Escape') {
                            setShowAddCategoryInput(false);
                            setNewCatName('');
                          }
                        }}
                        style={{ width: 130, height: 28, padding: '2px 8px', fontSize: '0.78rem' }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => { handleAddCategory(); setShowAddCategoryInput(false); }} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                        Add
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddCategoryInput(false); setNewCatName(''); }} style={{ padding: '2px 6px' }}>
                        <X size={12} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Product Items: Card View or List View */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading menu...
            </div>
          ) : viewMode === 'card' ? (
            /* Card View */
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
                    onClick={() => openRecipeView(item)}
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
                          <button
                            className="btn btn-icon btn-ghost"
                            onClick={() => openRecipeView(item)}
                            title="View Recipe & COGS"
                            style={{ padding: 4, color: 'var(--primary)' }}
                          >
                            <ChefHat size={14} />
                          </button>
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
          ) : (
            /* List View */
            <div className="menu-list-card">
              <table className="menu-list-table">
                <thead>
                  <tr>
                    <th>Product / Item</th>
                    <th>Category</th>
                    <th>Selling Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr
                      key={item.id}
                      className="menu-list-row"
                      onClick={() => openRecipeView(item)}
                    >
                      <td>
                        <div className="menu-list-item-cell">
                          <div className="menu-list-thumb">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} />
                            ) : (
                              <Coffee size={20} color="var(--primary)" />
                            )}
                          </div>
                          <div>
                            <div className="menu-list-name">{item.name}</div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click to view recipe</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                        ₱{item.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`badge ${item.is_active ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.72rem' }}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => openRecipeView(item)}
                            title="View Recipe"
                            style={{ padding: '4px 8px', gap: 4, fontSize: '0.78rem' }}
                          >
                            <Eye size={13} /> Recipe
                          </button>
                          <button
                            className="btn btn-icon btn-ghost"
                            onClick={() => openEdit(item)}
                            title="Edit"
                            style={{ padding: 6 }}
                          >
                            <Edit2 size={14} />
                          </button>
                          {item.is_active && (
                            <button
                              className="btn btn-icon btn-ghost"
                              onClick={() => openDelete(item)}
                              title="Remove from menu"
                              style={{ padding: 6, color: 'var(--danger)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && !loading && (
                <div className="empty-state" style={{ padding: 40 }}>
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

      {/* ─── Recipe View & COGS Modal (Opened on click/select of product) ─── */}
      <AnimatePresence>
        {selectedRecipeItem && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedRecipeItem(null)}
          >
            <motion.div
              className="modal modal-wide"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              style={{ maxWidth: 640 }}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <ChefHat size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedRecipeItem.name}</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>{selectedRecipeItem.category}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Selling Price: <strong style={{ color: 'var(--primary)' }}>₱{selectedRecipeItem.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                  </div>
                </div>
                <button className="btn btn-icon btn-ghost" onClick={() => setSelectedRecipeItem(null)}><X size={18} /></button>
              </div>

              <div className="modal-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    RECIPE (INGREDIENTS PER 1 UNIT SOLD)
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Auto-calculated from Raw Ingredients
                  </span>
                </div>

                {loadingRecipe ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading recipe details...
                  </div>
                ) : recipeCalculation.items.length === 0 ? (
                  <div className="recipe-empty" style={{ padding: 30 }}>
                    <UtensilsCrossed size={28} opacity={0.4} style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0 }}>No recipe specified for this item yet.</p>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 12 }}
                      onClick={() => {
                        const itm = selectedRecipeItem;
                        setSelectedRecipeItem(null);
                        openEdit(itm);
                      }}
                    >
                      <Edit2 size={13} /> Edit Item to Add Recipe
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Detailed COGS Breakdown Table */}
                    <div className="recipe-breakdown-card">
                      <table className="recipe-breakdown-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Quantity per 1 Unit Sold</th>
                            <th style={{ textAlign: 'right' }}>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipeCalculation.items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {item.name}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600 }}>{item.quantityUsed} {item.unit}</span>
                                  {item.isConverted && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      ≈ {item.qtyInInv} {item.inventoryUnit} ({item.unitCost > 0 ? `₱${item.unitCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}/${item.inventoryUnit}` : '₱0.00'})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                ₱{item.itemCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                          {/* Total COGS Row */}
                          <tr className="cogs-total-row">
                            <td colSpan={2}>
                              Total COGS per Serving
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)' }}>
                              ₱{recipeCalculation.totalCogs.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Explanatory notes & Margin summary */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.4 }}>
                        <strong>Cost of Goods Sold (COGS)</strong> – Total cost ng lahat ng ingredients at packaging na ginamit sa isang serving.
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                          Gross Profit / Margin
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: selectedRecipeItem.price - recipeCalculation.totalCogs >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          ₱{(selectedRecipeItem.price - recipeCalculation.totalCogs).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: 4 }}>
                            ({selectedRecipeItem.price > 0 ? (( (selectedRecipeItem.price - recipeCalculation.totalCogs) / selectedRecipeItem.price ) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    const itm = selectedRecipeItem;
                    setSelectedRecipeItem(null);
                    openEdit(itm);
                  }}
                >
                  <Edit2 size={14} /> Edit Item / Recipe
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedRecipeItem(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <select
                      className="input select"
                      value={form.category}
                      onChange={e => f('category', e.target.value)}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price (₱) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      placeholder="0.00"
                      value={form.price}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const v = e.target.value.replace(',', '.');
                        if (v === '' || /^\d*\.?\d*$/.test(v)) f('price', v);
                      }}
                    />
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
                        const currentUnit = row.unit || selectedIng?.unit || 'pcs';
                        const compatibleUnits = getCompatibleUnits(selectedIng?.unit);
                        const rowCost = calculateIngredientCost(Number(row.quantity_used) || 0, currentUnit, selectedIng);

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
                                type="text"
                                inputMode="decimal"
                                className="input"
                                placeholder="0"
                                value={row.quantity_used}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const v = e.target.value.replace(',', '.');
                                  if (v === '' || /^\d*\.?\d*$/.test(v)) updateRecipeRow(idx, 'quantity_used', v);
                                }}
                              />
                            </div>
                            <div className="form-group">
                              {idx === 0 && <label className="form-label">Unit</label>}
                              <select
                                className="input select"
                                value={currentUnit}
                                onChange={e => updateRecipeRow(idx, 'unit', e.target.value)}
                                title="Select measurement unit"
                              >
                                {compatibleUnits.map(u => (
                                  <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              {idx === 0 && <label className="form-label">Cost</label>}
                              <input
                                className="input"
                                value={rowCost > 0 ? `₱${rowCost.toFixed(2)}` : '₱0.00'}
                                readOnly
                                style={{ background: 'var(--surface-2)', fontWeight: 600, color: 'var(--primary)' }}
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

      {/* ─── Delete Category Confirmation Modal ─── */}
      <AnimatePresence>
        {deleteCatModal && catToDelete && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteCatModal(false)} style={{ zIndex: 250 }}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <h3 style={{ color: 'var(--danger)' }}>Confirm Category Deletion</h3>
                <button className="btn btn-icon btn-ghost" onClick={() => setDeleteCatModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  Are you sure you want to delete the category <strong>"{catToDelete}"</strong>?
                </p>
                {menuItems.filter(m => m.category === catToDelete).length > 0 && (
                  <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', marginTop: 10 }}>
                    <strong>Warning:</strong> {menuItems.filter(m => m.category === catToDelete).length} menu item(s) belong to this category and will be reassigned.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteCatModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDeleteCategory}>
                  <Trash2 size={15} /> Delete Category
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
