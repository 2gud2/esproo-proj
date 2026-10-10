import { supabase } from './supabase';
import type { Product, Sale, Ingredient, MenuItem, MenuItemIngredient, MenuCartItem, Expense } from './mockData';
import { convertUnitQuantity } from './unitConversion';

export const DEFAULT_MENU_CATEGORIES = ['Beverages', 'Coffee', 'Food', 'Snacks', 'Dairy'];

export async function loadCategories(): Promise<string[]> {
  const saved = localStorage.getItem('espro_menu_categories');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c: string) => c !== 'Condiments');
      }
    } catch (_) {}
  }
  return DEFAULT_MENU_CATEGORIES;
}

export async function saveCategories(categories: string[]): Promise<void> {
  const cleaned = Array.from(new Set(categories.filter(c => c && c.trim() && c !== 'Condiments')));
  localStorage.setItem('espro_menu_categories', JSON.stringify(cleaned));
}

// ════════════════════════════════════════════════════════════
// LEGACY: Products (kept for backward compat with old sales)
// ════════════════════════════════════════════════════════════

export async function loadProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error && data) {
      const formatted: Product[] = data.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stock: Number(p.stock),
        threshold: Number(p.threshold),
        price: Number(p.price),
        sku: p.sku,
        image: p.image || undefined
      }));
      localStorage.setItem('espro_products', JSON.stringify(formatted));
      return formatted;
    }
  } catch (_) {}

  const saved = localStorage.getItem('espro_products');
  if (saved) {
    try { return JSON.parse(saved); } catch (_) {}
  }
  return [];
}

export async function saveProduct(product: Product): Promise<void> {
  try {
    await supabase.from('products').upsert({
      id: product.id, name: product.name, category: product.category,
      unit: product.unit, stock: product.stock, threshold: product.threshold,
      price: product.price, sku: product.sku, image: product.image || null
    });
  } catch (_) {}

  const current = await loadProducts();
  const index = current.findIndex(p => p.id === product.id);
  let updated: Product[];
  if (index >= 0) {
    updated = current.map(p => p.id === product.id ? product : p);
  } else {
    updated = [product, ...current];
  }
  localStorage.setItem('espro_products', JSON.stringify(updated));
}

export async function adjustStock(
  productId: string, quantity: number, type: 'add' | 'reduce' | 'set', _reason: string
): Promise<void> {
  const current = await loadProducts();
  const product = current.find(p => p.id === productId);
  if (!product) throw new Error('Product not found');

  let newStock = product.stock;
  if (type === 'add') newStock += quantity;
  else if (type === 'reduce') newStock = Math.max(0, newStock - quantity);
  else if (type === 'set') newStock = Math.max(0, quantity);

  await saveProduct({ ...product, stock: newStock });
}


// ════════════════════════════════════════════════════════════
// INGREDIENTS (raw stock items)
// ════════════════════════════════════════════════════════════

export async function loadIngredients(): Promise<Ingredient[]> {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name');
    if (!error && data) {
      const formatted: Ingredient[] = data.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        stock_quantity: Number(i.stock_quantity),
        low_stock_threshold: Number(i.low_stock_threshold),
        cost_per_unit: i.cost_per_unit != null ? Number(i.cost_per_unit) : undefined,
        expiration_date: i.expiration_date || null,
        auto_deduct_expired: i.auto_deduct_expired ?? false,
        created_at: i.created_at,
        updated_at: i.updated_at,
      }));
      localStorage.setItem('espro_ingredients', JSON.stringify(formatted));
      return formatted;
    }
  } catch (_) {}

  const saved = localStorage.getItem('espro_ingredients');
  if (saved) {
    try { return JSON.parse(saved); } catch (_) {}
  }
  return [];
}

export async function saveIngredient(ingredient: Partial<Ingredient> & { name: string; unit: string }): Promise<Ingredient> {
  const now = new Date().toISOString();
  const payload: any = {
    id: ingredient.id || undefined,
    name: ingredient.name,
    unit: ingredient.unit,
    stock_quantity: ingredient.stock_quantity ?? 0,
    low_stock_threshold: ingredient.low_stock_threshold ?? 10,
    expiration_date: ingredient.expiration_date ?? null,
    auto_deduct_expired: ingredient.auto_deduct_expired ?? false,
    updated_at: now,
  };
  if (ingredient.cost_per_unit !== undefined) {
    payload.cost_per_unit = ingredient.cost_per_unit;
  }

  try {
    const { data, error } = await supabase
      .from('ingredients')
      .upsert(payload)
      .select()
      .single();
    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        unit: data.unit,
        stock_quantity: Number(data.stock_quantity),
        low_stock_threshold: Number(data.low_stock_threshold),
        cost_per_unit: data.cost_per_unit != null ? Number(data.cost_per_unit) : undefined,
        expiration_date: data.expiration_date || null,
        auto_deduct_expired: data.auto_deduct_expired ?? false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    }
  } catch (_) {}

  // Fallback: save locally
  const id = ingredient.id || crypto.randomUUID();
  const localIngredient: Ingredient = {
    id,
    name: ingredient.name,
    unit: ingredient.unit,
    stock_quantity: ingredient.stock_quantity ?? 0,
    low_stock_threshold: ingredient.low_stock_threshold ?? 10,
    cost_per_unit: ingredient.cost_per_unit,
    expiration_date: ingredient.expiration_date || null,
    auto_deduct_expired: ingredient.auto_deduct_expired ?? false,
    created_at: ingredient.created_at || now,
    updated_at: now,
  };
  const current = await loadIngredients();
  const idx = current.findIndex(i => i.id === id);
  const updated = idx >= 0
    ? current.map(i => i.id === id ? localIngredient : i)
    : [localIngredient, ...current];
  localStorage.setItem('espro_ingredients', JSON.stringify(updated));
  return localIngredient;
}

export async function adjustIngredientStock(
  ingredientId: string,
  quantity: number,
  type: 'add' | 'reduce' | 'set',
  _reason: string
): Promise<void> {
  const current = await loadIngredients();
  const ingredient = current.find(i => i.id === ingredientId);
  if (!ingredient) throw new Error('Ingredient not found');

  let newStock = ingredient.stock_quantity;
  if (type === 'add') newStock += quantity;
  else if (type === 'reduce') newStock = Math.max(0, newStock - quantity);
  else if (type === 'set') newStock = Math.max(0, quantity);

  await saveIngredient({ ...ingredient, stock_quantity: newStock });
}

export async function deleteIngredient(ingredientId: string): Promise<void> {
  try {
    await supabase.from('ingredients').delete().eq('id', ingredientId);
  } catch (_) {}
  const current = await loadIngredients();
  const updated = current.filter(i => i.id !== ingredientId);
  localStorage.setItem('espro_ingredients', JSON.stringify(updated));
}


// ════════════════════════════════════════════════════════════
// MENU ITEMS (sellable products with recipes)
// ════════════════════════════════════════════════════════════

export async function loadMenuItems(activeOnly = true): Promise<MenuItem[]> {
  try {
    let query = supabase.from('menu_items').select('*').order('name');
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (!error && data) {
      const formatted: MenuItem[] = data.map(m => ({
        id: m.id,
        name: m.name,
        category: m.category,
        price: Number(m.price),
        image_url: m.image_url || null,
        is_active: m.is_active,
        created_at: m.created_at,
        updated_at: m.updated_at,
      }));
      localStorage.setItem(activeOnly ? 'espro_menu_items_active' : 'espro_menu_items_all', JSON.stringify(formatted));
      return formatted;
    }
  } catch (_) {}

  const key = activeOnly ? 'espro_menu_items_active' : 'espro_menu_items_all';
  const saved = localStorage.getItem(key);
  if (saved) {
    try { return JSON.parse(saved); } catch (_) {}
  }
  return [];
}

export async function loadMenuItemRecipe(menuItemId: string): Promise<MenuItemIngredient[]> {
  try {
    const { data, error } = await supabase
      .from('menu_item_ingredients')
      .select('*, ingredient:ingredients(*)')
      .eq('menu_item_id', menuItemId);
    if (!error && data) {
      const result = data.map((row: any) => ({
        id: row.id,
        menu_item_id: row.menu_item_id,
        ingredient_id: row.ingredient_id,
        quantity_used: Number(row.quantity_used),
        unit: row.unit,
        ingredient: row.ingredient ? {
          id: row.ingredient.id,
          name: row.ingredient.name,
          unit: row.ingredient.unit,
          stock_quantity: Number(row.ingredient.stock_quantity),
          low_stock_threshold: Number(row.ingredient.low_stock_threshold),
          cost_per_unit: row.ingredient.cost_per_unit != null ? Number(row.ingredient.cost_per_unit) : undefined,
          created_at: row.ingredient.created_at,
          updated_at: row.ingredient.updated_at,
        } : undefined,
      }));
      try {
        localStorage.setItem(`espro_recipe_${menuItemId}`, JSON.stringify(result));
      } catch (_) {}
      return result;
    }
  } catch (_) {}

  // Fallback to local storage
  const localSaved = localStorage.getItem(`espro_recipe_${menuItemId}`);
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      // Enrich with current ingredients if available
      const ingredients = await loadIngredients();
      return parsed.map((r: any) => ({
        ...r,
        ingredient: r.ingredient || ingredients.find(i => i.id === r.ingredient_id),
      }));
    } catch (_) {}
  }

  return [];
}

export async function saveMenuItem(
  menuItem: Partial<MenuItem> & { name: string; category: string; price: number },
  recipeRows: Array<{ ingredient_id: string; quantity_used: number; unit: string }>
): Promise<MenuItem> {
  const now = new Date().toISOString();
  const payload = {
    id: menuItem.id || undefined,
    name: menuItem.name,
    category: menuItem.category,
    price: menuItem.price,
    image_url: menuItem.image_url || null,
    is_active: menuItem.is_active ?? true,
    updated_at: now,
  };

  let savedItem: MenuItem | null = null;

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .upsert(payload)
      .select()
      .single();

    if (!error && data) {
      savedItem = {
        id: data.id,
        name: data.name,
        category: data.category,
        price: Number(data.price),
        image_url: data.image_url,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      // Delete existing recipe rows and re-insert
      await supabase
        .from('menu_item_ingredients')
        .delete()
        .eq('menu_item_id', savedItem.id);

      if (recipeRows.length > 0) {
        await supabase
          .from('menu_item_ingredients')
          .insert(recipeRows.map(r => ({
            menu_item_id: savedItem!.id,
            ingredient_id: r.ingredient_id,
            quantity_used: r.quantity_used,
            unit: r.unit,
          })));
      }
    }
  } catch (_) {}

  if (!savedItem) {
    // Fallback local
    const id = menuItem.id || crypto.randomUUID();
    savedItem = {
      id,
      name: menuItem.name,
      category: menuItem.category,
      price: menuItem.price,
      image_url: menuItem.image_url || null,
      is_active: menuItem.is_active ?? true,
      created_at: menuItem.created_at || now,
      updated_at: now,
    };
    const current = await loadMenuItems(false);
    const idx = current.findIndex(m => m.id === id);
    const updated = idx >= 0
      ? current.map(m => m.id === id ? savedItem! : m)
      : [savedItem, ...current];
    localStorage.setItem('espro_menu_items_all', JSON.stringify(updated));
    localStorage.setItem('espro_menu_items_active', JSON.stringify(updated.filter(m => m.is_active)));
  }

  // Save recipe rows locally so recipe viewer and calculations always work
  if (savedItem) {
    const ingredients = await loadIngredients();
    const recipeWithIngredients = recipeRows.map(r => ({
      id: crypto.randomUUID(),
      menu_item_id: savedItem!.id,
      ingredient_id: r.ingredient_id,
      quantity_used: r.quantity_used,
      unit: r.unit,
      ingredient: ingredients.find(i => i.id === r.ingredient_id),
    }));
    localStorage.setItem(`espro_recipe_${savedItem.id}`, JSON.stringify(recipeWithIngredients));
  }

  return savedItem;
}

export async function softDeleteMenuItem(id: string): Promise<void> {
  try {
    await supabase
      .from('menu_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (_) {}

  // Update local cache
  const all = await loadMenuItems(false);
  const updated = all.map(m => m.id === id ? { ...m, is_active: false } : m);
  localStorage.setItem('espro_menu_items_all', JSON.stringify(updated));
  localStorage.setItem('espro_menu_items_active', JSON.stringify(updated.filter(m => m.is_active)));
}

export async function uploadMenuImage(file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('menu-images')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Supabase storage upload error:', error.message, error);
      return null;
    }

    if (data?.path) {
      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    }
  } catch (err) {
    console.error('Storage upload exception:', err);
  }
  return null;
}


// ════════════════════════════════════════════════════════════
// SALES (enhanced with recipe-based deduction)
// ════════════════════════════════════════════════════════════

export async function loadSales(): Promise<Sale[]> {
  try {
    const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      const formatted: Sale[] = data.map(s => ({
        id: s.id,
        items: typeof s.items === 'string' ? JSON.parse(s.items) : s.items,
        subtotal: Number(s.subtotal),
        discount: Number(s.discount),
        total: Number(s.total),
        paymentMethod: s.payment_method as 'cash' | 'gcash',
        cashierName: s.cashier_name,
        createdAt: new Date(s.created_at),
        status: s.status as 'completed' | 'voided' | 'refunded',
        voidReason: s.void_reason || undefined
      }));
      localStorage.setItem('espro_sales', JSON.stringify(formatted));
      return formatted;
    }
  } catch (_) {}

  const saved = localStorage.getItem('espro_sales');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((s: any) => ({ ...s, createdAt: new Date(s.createdAt) }));
    } catch (_) {}
  }

  return [];
}

/**
 * Create a sale using the atomic RPC function that validates stock
 * and deducts ingredients in a single transaction.
 */
export async function createSaleWithDeduction(
  saleId: string,
  cartItems: MenuCartItem[],
  subtotal: number,
  discount: number,
  total: number,
  paymentMethod: string,
  cashierName: string
): Promise<void> {
  // Build the JSONB items array for the RPC
  const itemsJson = cartItems.map(item => ({
    menu_item_id: item.menu_item_id,
    name: item.name,
    price: item.price,
    category: item.category,
    image_url: item.image_url || null,
    qty: item.qty,
  }));

  try {
    const { error } = await supabase.rpc('complete_sale_with_deduction', {
      p_sale_id: saleId,
      p_items: itemsJson,
      p_subtotal: subtotal,
      p_discount: discount,
      p_total: total,
      p_payment_method: paymentMethod,
      p_cashier_name: cashierName,
    });

    if (error) {
      // The RPC raises exceptions for insufficient stock
      throw new Error(error.message);
    }
  } catch (err: any) {
    // If Supabase is unavailable, fall back to local-only sale
    if (err.message?.includes('Insufficient stock') || err.message?.includes('FetchError') === false) {
      throw err; // Re-throw stock errors
    }
  }

  // Update localStorage cache
  const sale: Sale = {
    id: saleId,
    items: itemsJson,
    subtotal,
    discount,
    total,
    paymentMethod: paymentMethod as 'cash' | 'gcash',
    cashierName,
    createdAt: new Date(),
    status: 'completed',
  };
  const currentSales = await loadSales();
  localStorage.setItem('espro_sales', JSON.stringify([sale, ...currentSales]));

  // Deduct ingredient stock locally (with unit conversion support)
  try {
    const currentIngredients = await loadIngredients();
    for (const item of cartItems) {
      const recipe = await loadMenuItemRecipe(item.menu_item_id);
      for (const r of recipe) {
        const ing = currentIngredients.find(i => i.id === r.ingredient_id);
        if (ing) {
          const totalQtyUsed = Number(r.quantity_used) * Number(item.qty);
          const convertedQty = convertUnitQuantity(totalQtyUsed, r.unit || ing.unit, ing.unit);
          await adjustIngredientStock(ing.id, convertedQty, 'reduce', `POS Sale ${saleId}`);
        }
      }
    }
  } catch (_) {}
}

/** Legacy createSale for backward compat */
export async function createSale(sale: Sale): Promise<void> {
  try {
    await supabase.from('sales').insert({
      id: sale.id, items: sale.items, subtotal: sale.subtotal,
      discount: sale.discount, total: sale.total,
      payment_method: sale.paymentMethod, cashier_name: sale.cashierName,
      status: sale.status, created_at: sale.createdAt.toISOString()
    });
  } catch (_) {}

  const currentSales = await loadSales();
  localStorage.setItem('espro_sales', JSON.stringify([sale, ...currentSales]));

  for (const item of sale.items as any[]) {
    if (item.product) {
      try { await adjustStock(item.product.id, item.qty, 'reduce', 'POS Sale'); } catch (_) {}
    }
  }
}

/**
 * Void/refund a sale using the atomic RPC that restores ingredient stock.
 */
export async function voidSaleWithRestoration(
  saleId: string,
  status: 'voided' | 'refunded',
  reason: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('void_sale_with_restoration', {
      p_sale_id: saleId,
      p_status: status,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  } catch (err: any) {
    // If RPC unavailable, try direct update
    if (!err.message?.includes('not found') && !err.message?.includes('already')) {
      try {
        await supabase.from('sales').update({
          status, void_reason: reason
        }).eq('id', saleId);
      } catch (_) {}
    } else {
      throw err;
    }
  }

  // Update localStorage
  const currentSales = await loadSales();
  const updatedSales = currentSales.map(s =>
    s.id === saleId ? { ...s, status, voidReason: reason } : s
  );
  localStorage.setItem('espro_sales', JSON.stringify(updatedSales));
}

export async function refundSaleNoRestoration(
  saleId: string,
  reason: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('refund_sale_no_restoration', {
      p_sale_id: saleId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  } catch (err: any) {
    if (!err.message?.includes('not found') && !err.message?.includes('already')) {
      try {
        await supabase.from('sales').update({
          status: 'refunded',
          void_reason: reason
        }).eq('id', saleId);
      } catch (_) {}
    } else {
      throw err;
    }
  }

  const currentSales = await loadSales();
  const updatedSales = currentSales.map(s =>
    s.id === saleId ? { ...s, status: 'refunded', voidReason: reason } : s
  );
  localStorage.setItem('espro_sales', JSON.stringify(updatedSales));
}

/** Legacy voidRefundSale kept for backward compat */
export async function voidRefundSale(
  saleId: string,
  status: 'voided' | 'refunded',
  reason: string
): Promise<void> {
  return status === 'refunded'
    ? refundSaleNoRestoration(saleId, reason)
    : voidSaleWithRestoration(saleId, status, reason);
}

// ════════════════════════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════════════════════════

export async function loadExpenses(): Promise<Expense[]> {
  try {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (!error && data) {
      const formatted: Expense[] = data.map(e => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        category: e.category,
        date: new Date(e.date),
      }));
      localStorage.setItem('espro_expenses', JSON.stringify(formatted));
      return formatted;
    }
  } catch (_) {}

  const saved = localStorage.getItem('espro_expenses');
  if (saved) {
    try {
      return JSON.parse(saved).map((e: any) => ({ ...e, date: new Date(e.date) }));
    } catch (_) {}
  }
  return [];
}

export async function saveExpense(expense: Expense): Promise<void> {
  try {
    await supabase.from('expenses').upsert({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date.toISOString(),
    });
  } catch (_) {}

  const current = await loadExpenses();
  const updated = [expense, ...current.filter(e => e.id !== expense.id)];
  localStorage.setItem('espro_expenses', JSON.stringify(updated));
}

