import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Minus, Plus, Trash2, Tag, CheckCircle, X, RotateCcw,
  ShoppingCart, Coffee, Utensils, ShoppingBag, SlidersHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import SizePickerModal from '../components/POS/SizePickerModal';
import AddonsModal from '../components/POS/AddonsModal';
import ConfirmOrderModal from '../components/POS/ConfirmOrderModal';
import type {
  MenuItem,
  MenuItemSize,
  MenuItemIngredient,
  AddonItem,
  AddonIngredient,
  OrderSupplyRule,
  Ingredient,
  CartLine
} from '../lib/mockData';
import { useAuth } from '../contexts/AuthContext';
import {
  loadMenuItems,
  createSaleWithDeduction,
  loadCategories,
  loadIngredients,
  loadAllSizes,
  loadAllRecipes,
  loadAddons,
  loadAllAddonRecipes,
  loadOrderSupplyRules
} from '../lib/db';
import { computeLine, computeOrder, lineKey } from '../lib/orderCalc';
import { convertUnitQuantity } from '../lib/unitConversion';
import toast from 'react-hot-toast';
import './POS.css';

type DiscountType = 'fixed' | 'percent';

export default function POSPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [sizesMap, setSizesMap] = useState<Record<string, MenuItemSize[]>>({});
  const [recipesMap, setRecipesMap] = useState<Record<string, MenuItemIngredient[]>>({});
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [addonRecipesMap, setAddonRecipesMap] = useState<Record<string, AddonIngredient[]>>({});
  const [orderSupplyRules, setOrderSupplyRules] = useState<OrderSupplyRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  // Cart State (keyed by line_id)
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout'>('dine_in');
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [completing, setCompleting] = useState(false);

  // Modals
  const [sizePickerModal, setSizePickerModal] = useState<{
    isOpen: boolean;
    item: MenuItem | null;
    targetLineId?: string; // if changing size on existing cart line
    initialSizeId?: string | null;
  }>({ isOpen: false, item: null });

  const [addonsModal, setAddonsModal] = useState<{
    isOpen: boolean;
    line: CartLine | null;
  }>({ isOpen: false, line: null });

  const [confirmModal, setConfirmModal] = useState(false);
  const [voidModal, setVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  // Ingredients dictionary map for fast lookups
  const ingredientsMap = useMemo(() => {
    const map: Record<string, Ingredient> = {};
    for (const ing of ingredients) {
      map[ing.id] = ing;
    }
    return map;
  }, [ingredients]);

  const loadData = useCallback(async () => {
    try {
      const [
        items,
        cats,
        allSizes,
        allRecipes,
        addonList,
        allAddonRecipes,
        ings,
        supplyRules,
      ] = await Promise.all([
        loadMenuItems(true),
        loadCategories(),
        loadAllSizes(),
        loadAllRecipes(),
        loadAddons(true),
        loadAllAddonRecipes(),
        loadIngredients(),
        loadOrderSupplyRules(),
      ]);

      setMenuItems(items);
      setCategories(cats.filter((c) => c !== 'Condiments'));
      setSizesMap(allSizes);
      setRecipesMap(allRecipes);
      setAddons(addonList);
      setAddonRecipesMap(allAddonRecipes);
      setIngredients(ings);
      setOrderSupplyRules(supplyRules);
    } catch (err) {
      console.error('Error loading POS data:', err);
      toast.error('Failed to load menu and stock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recompute all cart lines when orderType changes
  function handleOrderTypeChange(newOrderType: 'dine_in' | 'takeout') {
    if (newOrderType === orderType) return;
    setOrderType(newOrderType);

    setCart((prevCart) => {
      return prevCart.map((line) => {
        const item = menuItems.find((m) => m.id === line.menu_item_id);
        if (!item) return line;

        const size = (sizesMap[item.id] || []).find((s) => s.id === line.size_id) || null;
        const lineAddons = (line.addons || []).map((a) => ({
          addon: addons.find((ad) => ad.id === a.addon_id) || {
            id: a.addon_id,
            name: a.name,
            price: a.price,
            is_active: true,
            applies_to_categories: [],
            applies_to_items: [],
          },
          qty: a.qty,
        }));

        const recomputed = computeLine({
          menuItem: item,
          size,
          addons: lineAddons,
          qty: line.qty,
          note: line.note,
          orderType: newOrderType,
          recipe: recipesMap[item.id] || [],
          addonRecipes: addonRecipesMap,
          ingredientsById: ingredientsMap,
        });

        return {
          ...recomputed,
          line_id: line.line_id, // Preserve line_id
        };
      });
    });
  }

  // Availability calculation per item
  const availabilityMap = useMemo(() => {
    const map: Record<string, number | null> = {};

    for (const item of menuItems) {
      const itemRecipe = recipesMap[item.id] || [];
      if (itemRecipe.length === 0) {
        map[item.id] = null;
        continue;
      }

      // Check default size multiplier if item has sizes
      const itemSizes = (sizesMap[item.id] || []).filter((s) => s.is_active);
      const defaultSize = itemSizes.find((s) => s.is_default) || itemSizes[0];
      const multiplier = defaultSize?.ingredient_multiplier != null ? Number(defaultSize.ingredient_multiplier) : 1;

      let minServings = Infinity;
      for (const row of itemRecipe) {
        // Skip size-specific rows that don't match default size
        if (row.size_id && defaultSize && row.size_id !== defaultSize.id) continue;

        const ing = ingredientsMap[row.ingredient_id] || row.ingredient;
        if (!ing) {
          minServings = 0;
          break;
        }

        const isSupply = ing.item_type === 'supply';
        const effectiveMultiplier = isSupply ? 1 : multiplier;
        const convertedQty = convertUnitQuantity(Number(row.quantity_used) * effectiveMultiplier, row.unit, ing.unit);

        if (convertedQty <= 0) continue;
        const stock = Math.max(0, ing.stock_quantity);
        const servings = Math.floor(stock / convertedQty);
        if (servings < minServings) {
          minServings = servings;
        }
      }

      map[item.id] = minServings === Infinity ? 0 : Math.max(0, minServings);
    }

    return map;
  }, [menuItems, recipesMap, sizesMap, ingredientsMap]);

  const allCategories = useMemo(() => {
    const list = Array.from(new Set([...categories, ...menuItems.map((m) => m.category).filter(Boolean)])).filter(
      (c) => c !== 'Condiments'
    );
    return ['All', ...list];
  }, [categories, menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = category === 'All' || item.category === category;
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, search, category]);

  // Helper: validate whole-cart stock with candidate lines
  function checkCartShortages(candidateCart: CartLine[], currentOrderType: 'dine_in' | 'takeout'): boolean {
    const res = computeOrder(candidateCart, currentOrderType, {
      orderSupplyRules,
      ingredientsById: ingredientsMap,
    });
    if (res.shortages.length > 0) {
      const details = res.shortages
        .map((s) => `${s.ingredientName} (need ${s.needed} ${s.unit}, have ${s.available} ${s.unit})`)
        .join(', ');
      toast.error(`Insufficient stock: ${details}`);
      return false;
    }
    return true;
  }

  // Tapping a menu item card
  function handleItemClick(item: MenuItem) {
    const maxServings = availabilityMap[item.id];
    if (maxServings !== null && maxServings <= 0) {
      toast.error(`${item.name} is out of stock`);
      return;
    }

    const itemSizes = (sizesMap[item.id] || []).filter((s) => s.is_active);
    if (itemSizes.length > 0) {
      // Open SizePickerModal
      setSizePickerModal({
        isOpen: true,
        item,
        initialSizeId: itemSizes.find((s) => s.is_default)?.id || itemSizes[0].id,
      });
    } else {
      // Direct add without sizes
      addLineToCart(item, null, [], null);
    }
  }

  // Add line to cart or merge identical lines
  function addLineToCart(
    item: MenuItem,
    size: MenuItemSize | null,
    addonEntries: Array<{ addon: AddonItem; qty: number }> = [],
    note: string | null = null
  ) {
    const newLine = computeLine({
      menuItem: item,
      size,
      addons: addonEntries,
      qty: 1,
      note,
      orderType,
      recipe: recipesMap[item.id] || [],
      addonRecipes: addonRecipesMap,
      ingredientsById: ingredientsMap,
    });

    const targetKey = lineKey({
      menu_item_id: item.id,
      size_id: size?.id || null,
      addons: newLine.addons,
      note: newLine.note,
    });

    // Check if an existing line matches lineKey
    const existingIndex = cart.findIndex((c) => {
      const k = lineKey({
        menu_item_id: c.menu_item_id,
        size_id: c.size_id || null,
        addons: c.addons,
        note: c.note,
      });
      return k === targetKey;
    });

    let nextCart: CartLine[];
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      const updatedLine = computeLine({
        menuItem: item,
        size,
        addons: addonEntries,
        qty: existing.qty + 1,
        note: existing.note,
        orderType,
        recipe: recipesMap[item.id] || [],
        addonRecipes: addonRecipesMap,
        ingredientsById: ingredientsMap,
      });
      nextCart = cart.map((c, idx) => (idx === existingIndex ? { ...updatedLine, line_id: existing.line_id } : c));
    } else {
      nextCart = [...cart, newLine];
    }

    if (!checkCartShortages(nextCart, orderType)) {
      return;
    }

    setCart(nextCart);
  }

  // Change size on existing cart line
  function handleSelectSize(size: MenuItemSize) {
    if (sizePickerModal.targetLineId) {
      // Update existing line's size
      const lineId = sizePickerModal.targetLineId;
      const existingLine = cart.find((c) => c.line_id === lineId);
      if (!existingLine) return;

      const item = menuItems.find((m) => m.id === existingLine.menu_item_id);
      if (!item) return;

      const lineAddons = (existingLine.addons || []).map((a) => ({
        addon: addons.find((ad) => ad.id === a.addon_id) || {
          id: a.addon_id,
          name: a.name,
          price: a.price,
          is_active: true,
          applies_to_categories: [],
          applies_to_items: [],
        },
        qty: a.qty,
      }));

      const updated = computeLine({
        menuItem: item,
        size,
        addons: lineAddons,
        qty: existingLine.qty,
        note: existingLine.note,
        orderType,
        recipe: recipesMap[item.id] || [],
        addonRecipes: addonRecipesMap,
        ingredientsById: ingredientsMap,
      });

      const nextCart = cart.map((c) => (c.line_id === lineId ? { ...updated, line_id: lineId } : c));
      if (!checkCartShortages(nextCart, orderType)) {
        return;
      }
      setCart(nextCart);
    } else if (sizePickerModal.item) {
      // Adding new line with selected size
      addLineToCart(sizePickerModal.item, size, [], null);
    }
  }

  // Open AddonsModal for a cart line
  function openAddonsModalForLine(line: CartLine) {
    setAddonsModal({
      isOpen: true,
      line,
    });
  }

  // Save add-ons from AddonsModal
  function handleSaveLineAddons(
    lineId: string,
    selectedAddons: Array<{ addon: AddonItem; qty: number }>,
    note?: string | null
  ) {
    const existingLine = cart.find((c) => c.line_id === lineId);
    if (!existingLine) return;

    const item = menuItems.find((m) => m.id === existingLine.menu_item_id);
    if (!item) return;

    const size = (sizesMap[item.id] || []).find((s) => s.id === existingLine.size_id) || null;

    const updated = computeLine({
      menuItem: item,
      size,
      addons: selectedAddons,
      qty: existingLine.qty,
      note,
      orderType,
      recipe: recipesMap[item.id] || [],
      addonRecipes: addonRecipesMap,
      ingredientsById: ingredientsMap,
    });

    const nextCart = cart.map((c) => (c.line_id === lineId ? { ...updated, line_id: lineId } : c));
    if (!checkCartShortages(nextCart, orderType)) {
      return;
    }
    setCart(nextCart);
  }

  // Quantity updates on cart lines
  function updateQty(lineId: string, delta: number) {
    const existing = cart.find((c) => c.line_id === lineId);
    if (!existing) return;

    const nextQty = existing.qty + delta;
    if (nextQty <= 0) {
      removeItem(lineId);
      return;
    }

    const item = menuItems.find((m) => m.id === existing.menu_item_id);
    if (!item) return;

    const size = (sizesMap[item.id] || []).find((s) => s.id === existing.size_id) || null;
    const lineAddons = (existing.addons || []).map((a) => ({
      addon: addons.find((ad) => ad.id === a.addon_id) || {
        id: a.addon_id,
        name: a.name,
        price: a.price,
        is_active: true,
        applies_to_categories: [],
        applies_to_items: [],
      },
      qty: a.qty,
    }));

    const updated = computeLine({
      menuItem: item,
      size,
      addons: lineAddons,
      qty: nextQty,
      note: existing.note,
      orderType,
      recipe: recipesMap[item.id] || [],
      addonRecipes: addonRecipesMap,
      ingredientsById: ingredientsMap,
    });

    const nextCart = cart.map((c) => (c.line_id === lineId ? { ...updated, line_id: lineId } : c));
    if (delta > 0 && !checkCartShortages(nextCart, orderType)) {
      return;
    }

    setCart(nextCart);
  }

  function removeItem(lineId: string) {
    setCart((prev) => prev.filter((c) => c.line_id !== lineId));
  }

  // Subtotal & discount calculations
  const subtotal = useMemo(() => cart.reduce((s, c) => s + Number(c.price) * Number(c.qty), 0), [cart]);

  const clampedDiscountValue = useMemo(() => {
    let val = Math.max(0, discountValue);
    if (discountType === 'percent') {
      val = Math.min(100, val);
    } else {
      val = Math.min(subtotal, val);
    }
    return Math.round(val * 100) / 100;
  }, [discountValue, discountType, subtotal]);

  useEffect(() => {
    if (discountValue !== clampedDiscountValue) {
      setDiscountValue(clampedDiscountValue);
    }
  }, [clampedDiscountValue, discountValue]);

  function handleDiscountChange(rawValue: string) {
    if (rawValue === '') {
      setDiscountValue(0);
      return;
    }
    const num = parseFloat(rawValue);
    if (isNaN(num)) {
      setDiscountValue(0);
      return;
    }
    let clamped = Math.max(0, num);
    if (discountType === 'percent') {
      clamped = Math.min(100, clamped);
    } else {
      clamped = Math.min(subtotal, clamped);
    }
    clamped = Math.round(clamped * 100) / 100;
    setDiscountValue(clamped);
  }

  function handleDiscountTypeChange(newType: DiscountType) {
    setDiscountType(newType);
    let clamped = Math.max(0, discountValue);
    if (newType === 'percent') {
      clamped = Math.min(100, clamped);
    } else {
      clamped = Math.min(subtotal, clamped);
    }
    setDiscountValue(Math.round(clamped * 100) / 100);
  }

  const discountAmount = useMemo(() => {
    if (discountType === 'fixed') {
      return Math.min(clampedDiscountValue, subtotal);
    }
    return Math.round(subtotal * (clampedDiscountValue / 100) * 100) / 100;
  }, [discountType, clampedDiscountValue, subtotal]);

  const total = useMemo(() => Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100), [subtotal, discountAmount]);

  // Filter applicable add-ons helper
  function getApplicableAddons(itemCategory: string, menuItemId: string): AddonItem[] {
    return addons.filter((a) => {
      if (a.is_active === false) return false;
      if (a.applies_to_categories && a.applies_to_categories.length > 0) {
        if (a.applies_to_categories.includes(itemCategory)) return true;
      }
      if (a.applies_to_items && a.applies_to_items.length > 0) {
        if (a.applies_to_items.includes(menuItemId)) return true;
      }
      if (
        (!a.applies_to_categories || a.applies_to_categories.length === 0) &&
        (!a.applies_to_items || a.applies_to_items.length === 0)
      ) {
        return true;
      }
      return false;
    });
  }

  // Click "Complete Sale" -> validate cart & open ConfirmOrderModal
  function handleOpenCheckout() {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!checkCartShortages(cart, orderType)) {
      return;
    }
    setConfirmModal(true);
  }

  // Execute sale completion via createSaleWithDeduction
  async function handleFinalCheckout(paymentDetails: {
    paymentMethod: 'cash' | 'gcash';
    amountTendered?: number | null;
    changeDue?: number | null;
  }) {
    setCompleting(true);

    const saleId = `S-${Date.now()}`;
    const cashierName = user?.name || 'Staff User';

    try {
      // Run computeOrder for complete order deduction requirements
      const orderResult = computeOrder(cart, orderType, {
        orderSupplyRules,
        ingredientsById: ingredientsMap,
      });

      if (orderResult.shortages.length > 0) {
        const names = orderResult.shortages
          .map((s) => `${s.ingredientName} (need ${s.needed} ${s.unit}, have ${s.available} ${s.unit})`)
          .join(', ');
        toast.error(`Cannot complete order — shortage in: ${names}`);
        setConfirmModal(false);
        return;
      }

      await createSaleWithDeduction(
        saleId,
        orderResult.lines,
        subtotal,
        discountAmount,
        total,
        paymentDetails.paymentMethod,
        cashierName,
        {
          orderType,
          orderDeductions: orderResult.orderDeductions,
          orderSuppliesCogs: orderResult.orderSuppliesCogs,
          amountTendered: paymentDetails.amountTendered,
          changeDue: paymentDetails.changeDue,
        }
      );

      toast.success('Sale completed! Stock updated.');

      // Format cart for receipt navigation
      const formattedReceiptCart = orderResult.lines.map((c) => ({
        line_id: c.line_id,
        menu_item_id: c.menu_item_id,
        name: c.name,
        price: c.price,
        unit_price: c.unit_price,
        base_price: c.base_price,
        qty: c.qty,
        size_id: c.size_id,
        size_name: c.size_name,
        addons: c.addons,
        note: c.note,
        product: { name: c.name, price: c.price, unit: 'item' },
      }));

      setConfirmModal(false);

      // Navigate to receipt
      navigate(`/pos/receipt/${saleId}`, {
        state: {
          cart: formattedReceiptCart,
          subtotal,
          discountAmount,
          total,
          payment: paymentDetails.paymentMethod,
          cashier: cashierName,
          orderType,
          amountTendered: paymentDetails.amountTendered,
          changeDue: paymentDetails.changeDue,
        },
      });

      // Reset cart and orderType after sale
      setCart([]);
      setDiscountValue(0);
      setOrderType('dine_in');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale');
    } finally {
      setCompleting(false);
    }
  }

  function voidOrder() {
    if (!voidReason.trim()) {
      toast.error('Please provide a void reason');
      return;
    }
    setCart([]);
    setDiscountValue(0);
    setOrderType('dine_in');
    setVoidModal(false);
    setVoidReason('');
    toast.success('Order voided');
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="POS" searchPlaceholder="Search menu items..." onSearch={setSearch} />
        <main className="pos-body">
          {/* Menu Items Panel */}
          <div className="pos-products">
            {/* Category chips */}
            <div className="pos-cats">
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  className={`cat-chip${category === cat ? ' active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="pos-grid">
              <AnimatePresence>
                {filteredItems.map((item) => {
                  const maxServings = availabilityMap[item.id];
                  const isOutOfStock = maxServings !== null && maxServings <= 0;
                  const hasNoRecipe = maxServings === null;
                  const itemSizes = (sizesMap[item.id] || []).filter((s) => s.is_active);

                  return (
                    <motion.button
                      key={item.id}
                      className={`product-card${isOutOfStock ? ' out-of-stock' : ''}`}
                      onClick={() => !isOutOfStock && handleItemClick(item)}
                      disabled={isOutOfStock}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={isOutOfStock ? {} : { y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
                      whileTap={isOutOfStock ? {} : { scale: 0.97 }}
                    >
                      <div className="product-card-img" style={{ position: 'relative', overflow: 'hidden' }}>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Coffee size={28} color="var(--primary)" />
                        )}
                        {isOutOfStock && <span className="out-badge">Out of stock</span>}
                        {hasNoRecipe && <span className="no-recipe-badge">No recipe</span>}
                        {itemSizes.length > 0 && !isOutOfStock && (
                          <span className="sizes-pill-badge">{itemSizes.length} sizes</span>
                        )}
                      </div>
                      <div className="product-card-body">
                        <div className="product-name">{item.name}</div>
                        <div className="product-cat">{item.category}</div>
                        <div className="product-bottom">
                          <span className="product-price">
                            {itemSizes.length > 0 ? `From ₱${Math.min(...itemSizes.map((s) => s.price)).toFixed(2)}` : `₱${item.price.toFixed(2)}`}
                          </span>
                          {maxServings !== null && !isOutOfStock && (
                            <span className={`product-stock${maxServings <= 5 ? ' low' : ''}`}>
                              {maxServings} left
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
              {filteredItems.length === 0 && !loading && (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                  <Search size={32} />
                  <p>No menu items found</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div className="pos-cart">
            {/* Header with Order Type Switcher */}
            <div className="cart-header">
              <h3>Current Cart</h3>
              {cart.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)', padding: '2px 6px' }}
                  onClick={() => setVoidModal(true)}
                >
                  <X size={14} /> Clear / Void
                </button>
              )}
            </div>

            {/* Order Type Toggle (Dine-in vs Takeout) */}
            <div className="pos-order-type-bar">
              <button
                type="button"
                className={`order-type-tab ${orderType === 'dine_in' ? 'active' : ''}`}
                onClick={() => handleOrderTypeChange('dine_in')}
              >
                <Utensils size={13} />
                <span>Dine-in</span>
              </button>
              <button
                type="button"
                className={`order-type-tab ${orderType === 'takeout' ? 'active' : ''}`}
                onClick={() => handleOrderTypeChange('takeout')}
              >
                <ShoppingBag size={13} />
                <span>Takeout</span>
              </button>
            </div>

            {/* Cart Items List */}
            <div className="cart-items">
              <AnimatePresence>
                {cart.length === 0 ? (
                  <motion.div className="cart-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <ShoppingCart size={36} opacity={0.3} />
                    <p>Add items to start a sale</p>
                  </motion.div>
                ) : (
                  cart.map((line) => {
                    const itemSizes = (sizesMap[line.menu_item_id] || []).filter((s) => s.is_active);
                    const applicableAddons = getApplicableAddons(line.category, line.menu_item_id);
                    const addonCount = (line.addons || []).reduce((sum, a) => sum + a.qty, 0);

                    return (
                      <motion.div
                        key={line.line_id}
                        className="cart-item"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <div className="cart-item-info">
                          <div className="cart-item-header-row">
                            <span className="cart-item-name">{line.name}</span>
                            <span className="cart-item-sub">
                              ₱{(Number(line.price) * Number(line.qty)).toFixed(2)}
                            </span>
                          </div>

                          {/* Line metadata & Customization options */}
                          <div className="cart-item-tags-row">
                            {/* Size button / chip */}
                            {itemSizes.length > 0 ? (
                              <button
                                type="button"
                                className="cart-size-chip"
                                onClick={() => {
                                  const item = menuItems.find((m) => m.id === line.menu_item_id);
                                  if (item) {
                                    setSizePickerModal({
                                      isOpen: true,
                                      item,
                                      targetLineId: line.line_id,
                                      initialSizeId: line.size_id || undefined,
                                    });
                                  }
                                }}
                                title="Click to change size"
                              >
                                {line.size_name || 'Select Size'}
                              </button>
                            ) : null}

                            {/* Add-ons modal button */}
                            {applicableAddons.length > 0 && (
                              <button
                                type="button"
                                className={`cart-addons-btn ${addonCount > 0 ? 'has-addons' : ''}`}
                                onClick={() => openAddonsModalForLine(line)}
                              >
                                <SlidersHorizontal size={11} />
                                <span>{addonCount > 0 ? `Add-ons (${addonCount})` : '+ Add-ons'}</span>
                              </button>
                            )}
                          </div>

                          {/* Add-ons mini summary */}
                          {Array.isArray(line.addons) && line.addons.length > 0 && (
                            <div className="cart-item-addons-list">
                              {line.addons.map((a, aIdx) => (
                                <span key={aIdx} className="cart-addon-pill">
                                  + {a.name} {a.qty > 1 ? `(${a.qty}x)` : ''} (+₱{(Number(a.price) * a.qty).toFixed(2)})
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Note */}
                          {line.note && <span className="cart-item-note">"{line.note}"</span>}
                        </div>

                        {/* Controls */}
                        <div className="cart-item-controls">
                          <button className="qty-btn" onClick={() => updateQty(line.line_id, -1)}>
                            <Minus size={12} />
                          </button>
                          <span className="qty-val">{line.qty}</span>
                          <button className="qty-btn" onClick={() => updateQty(line.line_id, 1)}>
                            <Plus size={12} />
                          </button>
                          <button className="qty-btn danger" onClick={() => removeItem(line.line_id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Discount */}
            <div className="cart-section">
              <div className="cart-section-label">
                <Tag size={13} /> Discount
              </div>
              <div className="discount-row">
                <div className="discount-type">
                  <button
                    type="button"
                    className={`dtype-btn${discountType === 'fixed' ? ' active' : ''}`}
                    onClick={() => handleDiscountTypeChange('fixed')}
                  >
                    ₱
                  </button>
                  <button
                    type="button"
                    className={`dtype-btn${discountType === 'percent' ? ' active' : ''}`}
                    onClick={() => handleDiscountTypeChange('percent')}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  className="input"
                  style={{ flex: 1, height: 36, padding: '0 10px' }}
                  min={0}
                  max={discountType === 'percent' ? 100 : subtotal}
                  step={discountType === 'percent' ? '1' : '0.01'}
                  placeholder="0"
                  value={discountValue === 0 ? '' : discountValue}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="cart-summary">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="summary-row discount">
                  <span>Discount</span>
                  <span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Total</span>
                <span>₱{total.toFixed(2)}</span>
              </div>
            </div>

            <motion.button
              className="btn btn-primary btn-lg complete-btn"
              onClick={handleOpenCheckout}
              disabled={completing || cart.length === 0}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {completing ? (
                <span className="spinner-sm" />
              ) : (
                <>
                  <CheckCircle size={18} /> Complete Sale
                </>
              )}
            </motion.button>
          </div>
        </main>
      </div>

      {/* Size Picker Modal */}
      <SizePickerModal
        isOpen={sizePickerModal.isOpen}
        onClose={() => setSizePickerModal({ isOpen: false, item: null })}
        menuItem={sizePickerModal.item}
        sizes={sizePickerModal.item ? (sizesMap[sizePickerModal.item.id] || []).filter((s) => s.is_active) : []}
        initialSizeId={sizePickerModal.initialSizeId}
        onSelectSize={handleSelectSize}
      />

      {/* Addons Modal */}
      <AddonsModal
        isOpen={addonsModal.isOpen}
        onClose={() => setAddonsModal({ isOpen: false, line: null })}
        cartLine={addonsModal.line}
        availableAddons={
          addonsModal.line
            ? getApplicableAddons(addonsModal.line.category, addonsModal.line.menu_item_id)
            : []
        }
        onSaveAddons={handleSaveLineAddons}
      />

      {/* Confirm & Checkout Modal */}
      <ConfirmOrderModal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        cartLines={cart}
        orderType={orderType}
        subtotal={subtotal}
        discountAmount={discountAmount}
        total={total}
        initialPaymentMethod="cash"
        onConfirm={handleFinalCheckout}
        completing={completing}
      />

      {/* Void Modal */}
      <AnimatePresence>
        {voidModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVoidModal(false)}
          >
            <motion.div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>Void / Clear Order</h3>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost"
                  onClick={() => setVoidModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Reason for Void *</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g. Customer changed mind, incorrect item added"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    style={{ resize: 'vertical' }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setVoidModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={voidOrder}
                >
                  <RotateCcw size={15} /> Void Order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

