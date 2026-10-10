import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, X, ChefHat, Coffee, LayoutGrid, List as ListIcon,
  Eye, UtensilsCrossed, RotateCcw, AlertTriangle, PackageCheck, Layers,
  Utensils, Package
} from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import SizesEditor, { type SizeRow } from '../components/Menu/SizesEditor';
import RecipeEditor, { type RecipeEditorRow } from '../components/Menu/RecipeEditor';
import AddonsManager from '../components/Menu/AddonsManager';
import OrderSuppliesModal from '../components/Menu/OrderSuppliesModal';
import type { MenuItem, Ingredient, MenuItemIngredient, MenuItemSize } from '../lib/mockData';
import {
  loadMenuItems,
  saveMenuItemConfig,
  softDeleteMenuItem,
  loadCategories,
  saveCategories,
  reassignMenuItemsCategory,
  loadIngredients,
  loadMenuItemRecipe,
  loadSizes,
  uploadMenuImage
} from '../lib/db';
import {
  calculateIngredientCost,
  convertUnitQuantity,
  areUnitsCompatible
} from '../lib/unitConversion';
import { computeLine } from '../lib/orderCalc';
import toast from 'react-hot-toast';
import './Menu.css';

export default function MenuPage() {
  // Main Top-level View Tab: Menu Items vs Add-ons
  const [mainTab, setMainTab] = useState<'items' | 'addons'>('items');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [itemSizesMap, setItemSizesMap] = useState<Record<string, MenuItemSize[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Order Supplies Modal
  const [showSuppliesModal, setShowSuppliesModal] = useState(false);

  // Add / Edit Modal State
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: '',
    price: '',
    image_url: null as string | null,
  });
  const [hasSizes, setHasSizes] = useState(false);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [recipeRows, setRecipeRows] = useState<RecipeEditorRow[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Category Management State
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [deleteCatModal, setDeleteCatModal] = useState(false);
  const [catToDelete, setCatToDelete] = useState<string | null>(null);

  // Delete Modal
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);

  // View Recipe Modal
  const [viewRecipeModal, setViewRecipeModal] = useState(false);
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<MenuItem | null>(null);
  const [selectedRecipeSizes, setSelectedRecipeSizes] = useState<MenuItemSize[]>([]);
  const [selectedRecipeRows, setSelectedRecipeRows] = useState<MenuItemIngredient[]>([]);
  const [viewerSelectedSizeId, setViewerSelectedSizeId] = useState<string>('');
  const [viewerOrderType, setViewerOrderType] = useState<'dine_in' | 'takeout'>('dine_in');
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      const [items, ings, cats] = await Promise.all([
        loadMenuItems(false),
        loadIngredients(),
        loadCategories(),
      ]);
      setMenuItems(items);
      setIngredients(ings);
      setCategories(cats.filter((c) => c !== 'Condiments'));

      // Fetch sizes for all menu items
      const sizesMap: Record<string, MenuItemSize[]> = {};
      await Promise.all(
        items.map(async (item) => {
          const s = await loadSizes(item.id);
          if (s.length > 0) {
            sizesMap[item.id] = s;
          }
        })
      );
      setItemSizesMap(sizesMap);
    } catch {
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function openRecipeView(item: MenuItem) {
    setSelectedRecipeItem(item);
    setViewRecipeModal(true);
    setLoadingRecipe(true);
    try {
      const [rec, itemSizes] = await Promise.all([
        loadMenuItemRecipe(item.id),
        loadSizes(item.id),
      ]);
      setSelectedRecipeRows(rec);
      setSelectedRecipeSizes(itemSizes);
      if (itemSizes.length > 0) {
        const defaultSize = itemSizes.find((s) => s.is_default) || itemSizes[0];
        setViewerSelectedSizeId(defaultSize.id);
      } else {
        setViewerSelectedSizeId('');
      }
      setViewerOrderType('dine_in');
    } catch {
      toast.error('Failed to load recipe');
    } finally {
      setLoadingRecipe(false);
    }
  }

  // ─── Category Handlers ───
  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const name = newCatName.trim();
    if (categories.includes(name)) {
      toast.error('Category already exists');
      return;
    }
    const updated = [...categories, name];
    setCategories(updated);
    await saveCategories(updated);
    setNewCatName('');
    toast.success(`Category "${name}" added!`);
  }

  function handleDeleteCategoryClick(cat: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (categories.length <= 1) {
      toast.error('You must keep at least one category');
      return;
    }
    setCatToDelete(cat);
    setDeleteCatModal(true);
  }

  async function confirmDeleteCategory() {
    if (!catToDelete) return;
    const cat = catToDelete;
    const updated = categories.filter((c) => c !== cat);
    const fallbackCat = updated[0] || 'Beverages';

    try {
      await reassignMenuItemsCategory(cat, fallbackCat);
      setCategories(updated);
      await saveCategories(updated);

      if (filterCat === cat) {
        setFilterCat('All');
      }

      setDeleteCatModal(false);
      setCatToDelete(null);
      toast.success(`Category "${cat}" deleted and items reassigned to "${fallbackCat}"!`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  }

  // ─── Add / Edit Item Form Handlers ───
  function f(field: keyof typeof form, val: any) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  function openAdd() {
    setForm({
      name: '',
      category: categories[0] || 'Beverages',
      price: '',
      image_url: null,
    });
    setHasSizes(false);
    setSizes([]);
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

    const [recipe, existingSizes] = await Promise.all([
      loadMenuItemRecipe(item.id),
      loadSizes(item.id),
    ]);

    if (existingSizes.length > 0) {
      setHasSizes(true);
      setSizes(
        existingSizes.map((s) => ({
          id: s.id,
          name: s.name,
          price: String(s.price),
          ingredient_multiplier: String(s.ingredient_multiplier ?? 1),
          sort_order: s.sort_order ?? 0,
          is_default: Boolean(s.is_default),
          is_active: Boolean(s.is_active),
        }))
      );
    } else {
      setHasSizes(false);
      setSizes([]);
    }

    setRecipeRows(
      recipe.map((r) => ({
        id: r.id,
        ingredient_id: r.ingredient_id,
        quantity_used: r.quantity_used != null ? String(r.quantity_used) : '1',
        unit: r.unit,
        size_id: r.size_id || null,
        usage_scope: r.usage_scope || 'always',
      }))
    );
    setModal('edit');
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

  // Live COGS preview calculations in Edit Modal
  const editModalCalculations = useMemo(() => {
    const ingredientsMap = new Map<string, Ingredient>();
    for (const ing of ingredients) {
      ingredientsMap.set(ing.id, ing);
    }

    const tempMenuItem: MenuItem = {
      id: editing?.id || 'temp',
      name: form.name || 'Sample Item',
      category: form.category || 'Beverages',
      price: Number(form.price) || 0,
      is_active: true,
    };

    const formattedRecipe: MenuItemIngredient[] = recipeRows.map((r, i) => ({
      id: r.id || `row-${i}`,
      menu_item_id: tempMenuItem.id,
      ingredient_id: r.ingredient_id,
      quantity_used: Number(r.quantity_used) || 0,
      unit: r.unit,
      size_id: r.size_id || null,
      usage_scope: r.usage_scope || 'always',
      ingredient: ingredientsMap.get(r.ingredient_id),
    }));

    if (hasSizes && sizes.length > 0) {
      return sizes.map((s) => {
        const sizeObj: MenuItemSize = {
          id: s.id || s.name,
          menu_item_id: tempMenuItem.id,
          name: s.name,
          price: Number(s.price) || 0,
          ingredient_multiplier: Number(s.ingredient_multiplier) || 1,
          sort_order: s.sort_order,
          is_default: Boolean(s.is_default),
          is_active: true,
        };

        const dineInLine = computeLine({
          menuItem: tempMenuItem,
          size: sizeObj,
          qty: 1,
          orderType: 'dine_in',
          recipe: formattedRecipe,
          ingredientsById: ingredientsMap,
        });

        const takeoutLine = computeLine({
          menuItem: tempMenuItem,
          size: sizeObj,
          qty: 1,
          orderType: 'takeout',
          recipe: formattedRecipe,
          ingredientsById: ingredientsMap,
        });

        const price = Number(s.price) || 0;
        const dineInCogs = dineInLine.cogs_per_serving + dineInLine.cogs_supplies_per_serving;
        const takeoutCogs = takeoutLine.cogs_per_serving + takeoutLine.cogs_supplies_per_serving;
        const dineInMargin = price > 0 ? ((price - dineInCogs) / price) * 100 : 0;
        const takeoutMargin = price > 0 ? ((price - takeoutCogs) / price) * 100 : 0;

        return {
          sizeName: s.name || 'Unnamed',
          price,
          isDefault: s.is_default,
          dineInCogs,
          takeoutCogs,
          dineInMargin,
          takeoutMargin,
        };
      });
    }

    // Single item without sizes
    const price = Number(form.price) || 0;
    const dineInLine = computeLine({
      menuItem: tempMenuItem,
      qty: 1,
      orderType: 'dine_in',
      recipe: formattedRecipe,
      ingredientsById: ingredientsMap,
    });

    const takeoutLine = computeLine({
      menuItem: tempMenuItem,
      qty: 1,
      orderType: 'takeout',
      recipe: formattedRecipe,
      ingredientsById: ingredientsMap,
    });

    const dineInCogs = dineInLine.cogs_per_serving + dineInLine.cogs_supplies_per_serving;
    const takeoutCogs = takeoutLine.cogs_per_serving + takeoutLine.cogs_supplies_per_serving;
    const dineInMargin = price > 0 ? ((price - dineInCogs) / price) * 100 : 0;
    const takeoutMargin = price > 0 ? ((price - takeoutCogs) / price) * 100 : 0;

    return [
      {
        sizeName: 'Standard',
        price,
        isDefault: true,
        dineInCogs,
        takeoutCogs,
        dineInMargin,
        takeoutMargin,
      },
    ];
  }, [form, hasSizes, sizes, recipeRows, ingredients, editing]);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Menu item name is required');
      return;
    }

    if (hasSizes) {
      if (sizes.length === 0) {
        toast.error('Please add at least one size or disable multiple sizes');
        return;
      }
      for (const s of sizes) {
        if (!s.name.trim()) {
          toast.error('All sizes must have a name');
          return;
        }
        const p = Number(s.price);
        if (isNaN(p) || p < 0) {
          toast.error(`Please enter a valid price for size "${s.name}"`);
          return;
        }
      }
    } else {
      const numPrice = form.price === '' ? 0 : Number(form.price);
      if (isNaN(numPrice) || numPrice < 0) {
        toast.error('Price cannot be negative');
        return;
      }
    }

    // Validate recipe rows
    for (const row of recipeRows) {
      const q = Number(row.quantity_used) || 0;
      if (q <= 0) {
        toast.error('All recipe quantities must be greater than 0');
        return;
      }
      const ing = ingredients.find((i) => i.id === row.ingredient_id);
      if (ing && !areUnitsCompatible(row.unit, ing.unit)) {
        toast.error(`Incompatible unit "${row.unit}" for ingredient "${ing.name}"`);
        return;
      }
    }

    // Duplicate detection check
    const seen = new Set<string>();
    for (const r of recipeRows) {
      const key = `${r.ingredient_id}__${r.size_id || 'all'}__${r.usage_scope || 'always'}`;
      if (seen.has(key)) {
        toast.error('Duplicate recipe entries found with the same item, size, and scope.');
        return;
      }
      seen.add(key);
    }

    setSaving(true);
    try {
      let imageUrl = form.image_url;
      if (imageFile) {
        const uploaded = await uploadMenuImage(imageFile);
        if (uploaded) {
          imageUrl = uploaded;
        }
      }

      let defaultPrice = Number(form.price) || 0;
      let formattedSizes: any[] | undefined = undefined;

      if (hasSizes) {
        const defaultSize = sizes.find((s) => s.is_default) || sizes[0];
        defaultPrice = Number(defaultSize.price);
        formattedSizes = sizes.map((s, idx) => ({
          id: s.id,
          name: s.name.trim(),
          price: Number(s.price),
          ingredient_multiplier: Number(s.ingredient_multiplier) || 1,
          sort_order: s.sort_order ?? idx,
          is_default: Boolean(s.is_default),
          is_active: s.is_active ?? true,
        }));
      }

      const formattedRows = recipeRows.map((r) => ({
        ingredient_id: r.ingredient_id,
        quantity_used: Number(r.quantity_used),
        unit: r.unit,
        size_id: hasSizes ? (r.size_id || null) : null,
        usage_scope: r.usage_scope || 'always',
      }));

      await saveMenuItemConfig(
        {
          id: editing?.id,
          name: form.name.trim(),
          category: form.category,
          price: defaultPrice,
          image_url: imageUrl,
          is_active: editing?.is_active ?? true,
        },
        formattedSizes,
        formattedRows
      );

      toast.success(editing ? 'Menu item updated!' : 'Menu item created!');
      setModal(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save menu item');
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
      toast.success(`"${deletingItem.name}" deactivated`);
      setDeleteModal(false);
      setDeletingItem(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete menu item');
    }
  }

  async function handleReactivate(item: MenuItem) {
    try {
      await saveMenuItemConfig({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        image_url: item.image_url,
        is_active: true,
      });
      toast.success(`"${item.name}" reactivated!`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate item');
    }
  }

  // Filtered menu items
  const filtered = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = filterCat === 'All' || item.category === filterCat;
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, filterCat, search]);

  const allCategoryTabs = useMemo(() => {
    const list = Array.from(
      new Set([...categories, ...menuItems.map((m) => m.category).filter(Boolean)])
    ).filter((c) => c !== 'Condiments');
    return ['All', ...list];
  }, [categories, menuItems]);

  // Viewer Modal Calculation
  const viewerCalculation = useMemo(() => {
    if (!selectedRecipeItem) return null;

    const currentSize = selectedRecipeSizes.find((s) => s.id === viewerSelectedSizeId) || null;
    const baseSellingPrice = currentSize ? currentSize.price : selectedRecipeItem.price;

    const rawList: any[] = [];
    const supplyList: any[] = [];
    let totalCogs = 0;

    for (const r of selectedRecipeRows) {
      if (r.size_id && currentSize && r.size_id !== currentSize.id) continue;
      if (r.size_id && !currentSize) continue;
      if (r.usage_scope && r.usage_scope !== 'always' && r.usage_scope !== viewerOrderType) continue;

      const ing = ingredients.find((i) => i.id === r.ingredient_id) || r.ingredient;
      const isSupply = ing?.item_type === 'supply';
      const multiplier = isSupply ? 1 : (currentSize?.ingredient_multiplier ?? 1);
      const effectiveQty = Number(r.quantity_used) * multiplier;
      const cost = calculateIngredientCost(effectiveQty, r.unit, ing);
      totalCogs += cost;

      const invUnit = ing?.unit || r.unit || 'pcs';
      const isConverted = r.unit.toLowerCase().trim() !== invUnit.toLowerCase().trim();
      const qtyInInv = convertUnitQuantity(effectiveQty, r.unit, invUnit);

      const entry = {
        name: ing?.name || 'Unknown Item',
        quantity_used: effectiveQty,
        unit: r.unit,
        unit_cost: ing?.cost_per_unit ?? 0,
        cost,
        inv_unit: invUnit,
        is_converted: isConverted,
        qty_in_inv: qtyInInv,
        scope: r.usage_scope || 'always',
      };

      if (isSupply) {
        supplyList.push(entry);
      } else {
        rawList.push(entry);
      }
    }

    const grossProfit = baseSellingPrice - totalCogs;
    const margin = baseSellingPrice > 0 ? (grossProfit / baseSellingPrice) * 100 : 0;

    return {
      sellingPrice: baseSellingPrice,
      rawList,
      supplyList,
      totalCogs,
      grossProfit,
      margin,
    };
  }, [selectedRecipeItem, selectedRecipeSizes, selectedRecipeRows, viewerSelectedSizeId, viewerOrderType, ingredients]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          title="Menu & Recipes"
          searchPlaceholder="Search items or add-ons..."
          onSearch={setSearch}
          action={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSuppliesModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <PackageCheck size={15} /> Takeout & Order Supplies
              </button>
              {mainTab === 'items' && (
                <button type="button" className="btn btn-primary" onClick={openAdd}>
                  <Plus size={15} /> Add Menu Item
                </button>
              )}
            </div>
          }
        />

        <main className="page-body">
          {/* Top Segmented Control: Menu Items | Add-ons */}
          <div className="menu-segmented-nav">
            <button
              type="button"
              className={`menu-segment-btn ${mainTab === 'items' ? 'active' : ''}`}
              onClick={() => setMainTab('items')}
            >
              <Coffee size={16} /> Menu Items ({menuItems.length})
            </button>
            <button
              type="button"
              className={`menu-segment-btn ${mainTab === 'addons' ? 'active' : ''}`}
              onClick={() => setMainTab('addons')}
            >
              <Layers size={16} /> Add-ons & Customizations
            </button>
          </div>

          {mainTab === 'addons' ? (
            /* Add-ons Management Tab */
            <AddonsManager
              ingredients={ingredients}
              categories={categories}
              menuItems={menuItems}
              onRefresh={fetchData}
            />
          ) : (
            /* Menu Items Tab */
            <>
              {/* Header Controls: Categories & View Switcher */}
              <div className="menu-controls card card-pad" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Categories:</span>
                      <button
                        className={`btn btn-ghost btn-sm ${isEditingCategories ? 'active' : ''}`}
                        onClick={() => setIsEditingCategories(!isEditingCategories)}
                        style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      >
                        {isEditingCategories ? 'Done Managing' : 'Manage Categories'}
                      </button>
                    </div>

                    <div className="category-chips-wrap">
                      {allCategoryTabs.map((cat) => {
                        const isActive = filterCat === cat;
                        const isDeletable = isEditingCategories && cat !== 'All' && categories.includes(cat);

                        return (
                          <motion.button
                            key={cat}
                            className={`cat-chip ${isActive ? 'active' : ''}`}
                            onClick={() => setFilterCat(cat)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <span>{cat}</span>
                            <AnimatePresence>
                              {isDeletable && (
                                <motion.span
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className="cat-chip-delete-btn"
                                  onClick={(e) => handleDeleteCategoryClick(cat, e)}
                                  title={`Delete category "${cat}"`}
                                  style={{ marginLeft: 6 }}
                                >
                                  <X size={10} />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        );
                      })}

                      {isEditingCategories && !showAddCategoryInput && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm add-cat-btn"
                          onClick={() => setShowAddCategoryInput(true)}
                          style={{ fontSize: '0.75rem', padding: '4px 12px', gap: 4, borderRadius: 'var(--radius-full)', border: '1.5px dashed var(--primary)', color: 'var(--primary)' }}
                        >
                          <Plus size={14} /> Add Category
                        </button>
                      )}

                      {isEditingCategories && showAddCategoryInput && (
                        <div className="inline-add-cat-form">
                          <input
                            autoFocus
                            type="text"
                            className="input"
                            placeholder="Category name..."
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => {
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
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              handleAddCategory();
                              setShowAddCategoryInput(false);
                            }}
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setShowAddCategoryInput(false);
                              setNewCatName('');
                            }}
                            style={{ padding: '2px 6px' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="view-toggle" style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
                      onClick={() => setViewMode('card')}
                      title="Card Grid View"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setViewMode('list')}
                      title="Table List View"
                    >
                      <ListIcon size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Display */}
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading menu...
                </div>
              ) : viewMode === 'card' ? (
                <div className="menu-grid">
                  <AnimatePresence>
                    {filtered.map((item) => {
                      const sizes = itemSizesMap[item.id] || [];
                      return (
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
                              {sizes.length > 0 && (
                                <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '1px 6px', marginLeft: 4 }}>
                                  {sizes.length} sizes
                                </span>
                              )}
                            </div>
                            <div className="menu-card-bottom">
                              <span className="menu-card-price">
                                ₱{item.price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {sizes.length > 1 && <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 3 }}>from</small>}
                              </span>
                              <div className="menu-card-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-ghost"
                                  onClick={() => openRecipeView(item)}
                                  title="View Recipe & COGS"
                                  style={{ padding: 4, color: 'var(--primary)' }}
                                >
                                  <ChefHat size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-ghost"
                                  onClick={() => openEdit(item)}
                                  title="Edit"
                                  style={{ padding: 4 }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                {item.is_active ? (
                                  <button
                                    type="button"
                                    className="btn btn-icon btn-ghost"
                                    onClick={() => openDelete(item)}
                                    title="Remove from menu"
                                    style={{ padding: 4, color: 'var(--danger)' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => handleReactivate(item)}
                                    title="Reactivate Item"
                                    style={{ padding: '3px 8px', fontSize: '0.72rem', color: 'var(--success)' }}
                                  >
                                    <RotateCcw size={12} style={{ marginRight: 3 }} /> Reactivate
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {filtered.length === 0 && !loading && (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                      <UtensilsCrossed size={32} />
                      <p>No menu items found</p>
                      <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
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
                        <th>Options / Sizes</th>
                        <th>Selling Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => {
                        const sizes = itemSizesMap[item.id] || [];
                        return (
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
                            <td>
                              {sizes.length > 0 ? (
                                <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                                  {sizes.map((s) => s.name).join(', ')}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Single Size</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                              ₱{item.price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td>
                              <span className={`badge ${item.is_active ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.72rem' }}>
                                {item.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => openRecipeView(item)}
                                  title="View Recipe"
                                  style={{ padding: '4px 8px', gap: 4, fontSize: '0.78rem' }}
                                >
                                  <Eye size={13} /> Recipe
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-ghost"
                                  onClick={() => openEdit(item)}
                                  title="Edit"
                                  style={{ padding: 6 }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                {item.is_active ? (
                                  <button
                                    type="button"
                                    className="btn btn-icon btn-ghost"
                                    onClick={() => openDelete(item)}
                                    title="Remove from menu"
                                    style={{ padding: 6, color: 'var(--danger)' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => handleReactivate(item)}
                                    title="Reactivate Item"
                                    style={{ padding: '4px 8px', gap: 4, fontSize: '0.78rem', color: 'var(--success)' }}
                                  >
                                    <RotateCcw size={13} /> Reactivate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length === 0 && !loading && (
                    <div className="empty-state" style={{ padding: 40 }}>
                      <UtensilsCrossed size={32} />
                      <p>No menu items found</p>
                      <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
                        <Plus size={14} /> Add your first menu item
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Add / Edit Menu Item Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <motion.div
              className="modal modal-wide menu-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>{modal === 'add' ? 'Add Menu Item & Recipe' : 'Edit Menu Item & Recipe'}</h3>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => setModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                {/* Basic Product Info */}
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    className="input"
                    placeholder="e.g. Spanish Latte, Croissant, Matcha Frappe"
                    value={form.name}
                    onChange={(e) => f('name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-row" style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Category *</label>
                    <select className="input select" value={form.category} onChange={(e) => f('category', e.target.value)}>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {!hasSizes && (
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Selling Price (₱) *</label>
                      <input
                        type="number"
                        className="input"
                        min={0}
                        step="0.5"
                        placeholder="0.00"
                        value={form.price}
                        onChange={(e) => f('price', e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Product Image Upload */}
                <div className="form-group">
                  <label className="form-label">Product Photo (Optional)</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {imagePreview ? (
                      <div className="img-preview-box">
                        <img src={imagePreview} alt="Preview" />
                        <button type="button" className="btn btn-icon btn-ghost img-clear-btn" onClick={clearImage}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="img-upload-placeholder" onClick={() => fileRef.current?.click()}>
                        <Coffee size={24} color="var(--text-muted)" />
                        <span>Upload photo</span>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                      {imagePreview ? 'Change Photo' : 'Select Photo'}
                    </button>
                  </div>
                </div>

                {/* Sizes Editor Component */}
                <SizesEditor
                  hasSizes={hasSizes}
                  onToggleHasSizes={setHasSizes}
                  sizes={sizes}
                  onChangeSizes={setSizes}
                />

                {/* Recipe Editor Component */}
                <RecipeEditor
                  hasSizes={hasSizes}
                  sizes={sizes}
                  ingredients={ingredients}
                  recipeRows={recipeRows}
                  onChangeRecipeRows={setRecipeRows}
                />

                {/* Live COGS & Profit Margin Preview */}
                <div className="cogs-preview-dashboard">
                  <div className="cogs-preview-header">
                    <span className="cogs-preview-title">Live Cost & Margin Analysis</span>
                    <span className="cogs-preview-sub">Computed per serving for Dine-in and Takeout</span>
                  </div>

                  <div className="cogs-analysis-grid">
                    {editModalCalculations.map((calc, i) => (
                      <div key={i} className="cogs-size-card">
                        <div className="cogs-size-title">
                          <strong>{calc.sizeName}</strong>
                          <span className="size-price-tag">₱{calc.price.toFixed(2)}</span>
                        </div>
                        <div className="cogs-dual-metrics">
                          <div className="metric-col">
                            <span className="col-header">Dine-in</span>
                            <div className="metric-row">
                              <span>COGS:</span>
                              <strong>₱{calc.dineInCogs.toFixed(2)}</strong>
                            </div>
                            <div className="metric-row">
                              <span>Margin:</span>
                              <strong style={{ color: calc.dineInMargin >= 40 ? '#10b981' : calc.dineInMargin >= 20 ? '#f59e0b' : '#ef4444' }}>
                                {calc.dineInMargin.toFixed(0)}%
                              </strong>
                            </div>
                          </div>

                          <div className="metric-col">
                            <span className="col-header">Takeout</span>
                            <div className="metric-row">
                              <span>COGS:</span>
                              <strong>₱{calc.takeoutCogs.toFixed(2)}</strong>
                            </div>
                            <div className="metric-row">
                              <span>Margin:</span>
                              <strong style={{ color: calc.takeoutMargin >= 40 ? '#10b981' : calc.takeoutMargin >= 20 ? '#f59e0b' : '#ef4444' }}>
                                {calc.takeoutMargin.toFixed(0)}%
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner-sm" /> : modal === 'add' ? 'Save Product' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Item Modal */}
      <AnimatePresence>
        {deleteModal && deletingItem && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModal(false)}>
            <motion.div className="modal" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={18} /> Deactivate Menu Item
                </h3>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => setDeleteModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to deactivate <strong>"{deletingItem.name}"</strong>?</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
                  This will hide the item from the POS register while preserving historic sales, size options, and recipe configurations.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setDeleteModal(false)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmDelete}>Deactivate Item</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Category Confirmation Modal */}
      <AnimatePresence>
        {deleteCatModal && catToDelete && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteCatModal(false)}>
            <motion.div className="modal" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={18} /> Delete Category
                </h3>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => setDeleteCatModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete the category <strong>"{catToDelete}"</strong>?</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
                  Any menu items currently under this category will automatically be reassigned to the default category without altering their recipes.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setDeleteCatModal(false)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmDeleteCategory}>Delete Category</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Recipe & COGS Modal */}
      <AnimatePresence>
        {viewRecipeModal && selectedRecipeItem && viewerCalculation && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewRecipeModal(false)}>
            <motion.div className="modal modal-wide recipe-view-modal" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="recipe-modal-thumb">
                    {selectedRecipeItem.image_url ? (
                      <img src={selectedRecipeItem.image_url} alt={selectedRecipeItem.name} />
                    ) : (
                      <Coffee size={24} color="var(--primary)" />
                    )}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedRecipeItem.name}</h3>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{selectedRecipeItem.category}</span>
                  </div>
                </div>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => setViewRecipeModal(false)}><X size={18} /></button>
              </div>

              <div className="modal-body">
                {loadingRecipe ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <span className="spinner-sm" style={{ marginRight: 8 }} /> Loading recipe details...
                  </div>
                ) : (
                  <>
                    {/* Size Tabs & Dine-in/Takeout Switcher */}
                    <div className="viewer-controls-bar">
                      {selectedRecipeSizes.length > 0 && (
                        <div className="viewer-size-tabs">
                          {selectedRecipeSizes.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className={`viewer-size-tab ${viewerSelectedSizeId === s.id ? 'active' : ''}`}
                              onClick={() => setViewerSelectedSizeId(s.id)}
                            >
                              {s.name} (₱{s.price.toFixed(2)})
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="viewer-order-type-switch">
                        <button
                          type="button"
                          className={`order-switch-btn ${viewerOrderType === 'dine_in' ? 'active' : ''}`}
                          onClick={() => setViewerOrderType('dine_in')}
                        >
                          Dine-in
                        </button>
                        <button
                          type="button"
                          className={`order-switch-btn ${viewerOrderType === 'takeout' ? 'active' : ''}`}
                          onClick={() => setViewerOrderType('takeout')}
                        >
                          Takeout
                        </button>
                      </div>
                    </div>

                {/* Metrics Summary Box */}
                <div className="cogs-summary-card">
                  <div className="cogs-stat">
                    <span className="cogs-stat-label">Selling Price</span>
                    <span className="cogs-stat-val">₱{viewerCalculation.sellingPrice.toFixed(2)}</span>
                  </div>
                  <div className="cogs-divider" />
                  <div className="cogs-stat">
                    <span className="cogs-stat-label">Total COGS / Serving</span>
                    <span className="cogs-stat-val" style={{ color: 'var(--danger)' }}>
                      ₱{viewerCalculation.totalCogs.toFixed(2)}
                    </span>
                  </div>
                  <div className="cogs-divider" />
                  <div className="cogs-stat">
                    <span className="cogs-stat-label">Gross Profit</span>
                    <span className="cogs-stat-val" style={{ color: viewerCalculation.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ₱{viewerCalculation.grossProfit.toFixed(2)}
                      <span style={{ fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>
                        ({viewerCalculation.margin.toFixed(1)}% margin)
                      </span>
                    </span>
                  </div>
                </div>

                {/* Tables: Ingredients and Supplies */}
                <div className="viewer-tables-container">
                  {/* Table 1: Raw Ingredients */}
                  <div className="viewer-table-block">
                    <h4 className="viewer-section-title">
                      <Utensils size={15} /> Ingredients ({viewerCalculation.rawList.length})
                    </h4>
                    {viewerCalculation.rawList.length === 0 ? (
                      <div className="viewer-empty-block">No raw ingredients configured.</div>
                    ) : (
                      <table className="table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Per Serving</th>
                            <th>Unit Cost</th>
                            <th style={{ textAlign: 'right' }}>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewerCalculation.rawList.map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{row.name}</td>
                              <td>
                                {row.quantity_used} {row.unit}
                                {row.is_converted && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                                    (= {parseFloat(row.qty_in_inv.toFixed(4))} {row.inv_unit})
                                  </span>
                                )}
                              </td>
                              <td>₱{row.unit_cost.toFixed(2)} / {row.inv_unit}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                                ₱{row.cost.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Table 2: Packaging & Supplies */}
                  <div className="viewer-table-block">
                    <h4 className="viewer-section-title">
                      <Package size={15} /> Packaging & Supplies ({viewerCalculation.supplyList.length})
                    </h4>
                    {viewerCalculation.supplyList.length === 0 ? (
                      <div className="viewer-empty-block">No packaging or supplies applicable for this selection.</div>
                    ) : (
                      <table className="table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Supply Item</th>
                            <th>Per Serving</th>
                            <th>Unit Cost</th>
                            <th style={{ textAlign: 'right' }}>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewerCalculation.supplyList.map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{row.name}</td>
                              <td>
                                {row.quantity_used} {row.unit}
                                {row.is_converted && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                                    (= {parseFloat(row.qty_in_inv.toFixed(4))} {row.inv_unit})
                                  </span>
                                )}
                              </td>
                              <td>₱{row.unit_cost.toFixed(2)} / {row.inv_unit}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                                ₱{row.cost.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setViewRecipeModal(false);
                    openEdit(selectedRecipeItem);
                  }}
                >
                  <Edit2 size={14} /> Edit Item & Recipe
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Supplies Modal */}
      <OrderSuppliesModal
        isOpen={showSuppliesModal}
        onClose={() => setShowSuppliesModal(false)}
        ingredients={ingredients}
      />
    </div>
  );
}
