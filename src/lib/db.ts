import { supabase } from './supabase';
import { isSupabaseConfigured } from './env';
import type {
  Product,
  Sale,
  Ingredient,
  IngredientBatch,
  MenuItem,
  MenuItemSize,
  MenuItemIngredient,
  AddonItem,
  AddonIngredient,
  OrderSupplyRule,
  Expense
} from './mockData';

export const DEFAULT_MENU_CATEGORIES = ['Beverages', 'Coffee', 'Food', 'Snacks', 'Dairy'];

// Helper to determine network/fetch errors vs backend business logic errors
function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const name = (err.name || '').toLowerCase();
  return (
    name === 'typeerror' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('networkerror') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('connection refused')
  );
}

// ════════════════════════════════════════════════════════════
// LOCAL CACHE GETTERS (Sync Helpers)
// ════════════════════════════════════════════════════════════

function getLocalCategories(): string[] {
  const saved = localStorage.getItem('espro_menu_categories');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c: string) => c && c.trim() && c !== 'Condiments');
      }
    } catch {}
  }
  return DEFAULT_MENU_CATEGORIES;
}

function getLocalProducts(): Product[] {
  const saved = localStorage.getItem('espro_products');
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return [];
}

function getLocalIngredients(): Ingredient[] {
  const saved = localStorage.getItem('espro_ingredients');
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return [];
}

function getLocalBatches(ingredientId?: string): IngredientBatch[] {
  const saved = localStorage.getItem('espro_batches');
  let batches: IngredientBatch[] = [];
  if (saved) {
    try {
      batches = JSON.parse(saved);
    } catch {}
  }

  // If no batches exist yet, backfill opening balance from local ingredients
  if (batches.length === 0) {
    const ings = getLocalIngredients();
    const today = new Date().toISOString().split('T')[0];
    const initialBatches: IngredientBatch[] = ings
      .filter(i => (i.stock_quantity ?? 0) > 0)
      .map(i => ({
        id: crypto.randomUUID(),
        ingredient_id: i.id,
        quantity_received: Number(i.stock_quantity),
        quantity_remaining: Number(i.stock_quantity),
        cost_per_unit: Number(i.cost_per_unit ?? 0),
        received_at: i.created_at ? i.created_at.split('T')[0] : today,
        expiration_date: i.expiration_date || null,
        supplier: 'Initial Inventory',
        note: 'Opening balance',
        status: 'active' as const,
        created_at: i.created_at || new Date().toISOString(),
      }));
    if (initialBatches.length > 0) {
      batches = initialBatches;
      localStorage.setItem('espro_batches', JSON.stringify(batches));
    }
  }

  if (ingredientId) {
    batches = batches.filter(b => b.ingredient_id === ingredientId);
  }

  // FEFO Sort: earliest expiration date first (nulls last), then earliest received_at
  return batches.sort((a, b) => {
    if (a.expiration_date && b.expiration_date) {
      const cmp = a.expiration_date.localeCompare(b.expiration_date);
      if (cmp !== 0) return cmp;
    } else if (a.expiration_date && !b.expiration_date) {
      return -1;
    } else if (!a.expiration_date && b.expiration_date) {
      return 1;
    }
    return a.received_at.localeCompare(b.received_at);
  });
}

function saveLocalBatches(batches: IngredientBatch[]) {
  localStorage.setItem('espro_batches', JSON.stringify(batches));
}

function syncLocalIngredientFromBatches(ingredientId: string) {
  const batches = getLocalBatches(ingredientId).filter(b => b.status === 'active');
  const totalStock = batches.reduce((sum, b) => sum + Number(b.quantity_remaining), 0);
  const activeExpirations = batches.map(b => b.expiration_date).filter(Boolean) as string[];
  const earliestExp = activeExpirations.length > 0 ? activeExpirations.sort()[0] : null;

  const current = getLocalIngredients();
  const updated = current.map(i => {
    if (i.id === ingredientId) {
      return {
        ...i,
        stock_quantity: totalStock,
        expiration_date: earliestExp,
        updated_at: new Date().toISOString(),
      };
    }
    return i;
  });
  localStorage.setItem('espro_ingredients', JSON.stringify(updated));
}

function getLocalMenuItems(activeOnly = true): MenuItem[] {
  const key = activeOnly ? 'espro_menu_items_active' : 'espro_menu_items_all';
  const saved = localStorage.getItem(key);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return [];
}

function getLocalSizes(menuItemId?: string): MenuItemSize[] {
  const saved = localStorage.getItem('espro_menu_item_sizes');
  let sizes: MenuItemSize[] = [];
  if (saved) {
    try { sizes = JSON.parse(saved); } catch {}
  }
  if (menuItemId) {
    sizes = sizes.filter(s => s.menu_item_id === menuItemId);
  }
  return sizes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function getLocalMenuItemRecipe(menuItemId: string): MenuItemIngredient[] {
  const localSaved = localStorage.getItem(`espro_recipe_${menuItemId}`);
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      const ingredients = getLocalIngredients();
      return parsed.map((r: any) => ({
        ...r,
        size_id: r.size_id || null,
        usage_scope: r.usage_scope || 'always',
        ingredient: r.ingredient || ingredients.find(i => i.id === r.ingredient_id),
      }));
    } catch {}
  }
  return [];
}

function getLocalAllRecipes(): Record<string, MenuItemIngredient[]> {
  const items = getLocalMenuItems(false);
  const result: Record<string, MenuItemIngredient[]> = {};
  for (const item of items) {
    result[item.id] = getLocalMenuItemRecipe(item.id);
  }
  return result;
}

function getLocalAddons(activeOnly = true): AddonItem[] {
  const saved = localStorage.getItem('espro_addons_all');
  let list: AddonItem[] = [];
  if (saved) {
    try { list = JSON.parse(saved); } catch {}
  }
  if (activeOnly) {
    list = list.filter(a => a.is_active !== false);
  }
  return list;
}

function getLocalAllAddonRecipes(): Record<string, AddonIngredient[]> {
  const saved = localStorage.getItem('espro_addon_recipes_grouped');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const ings = getLocalIngredients();
      const result: Record<string, AddonIngredient[]> = {};
      for (const [addonId, rows] of Object.entries(parsed)) {
        if (Array.isArray(rows)) {
          result[addonId] = rows.map((r: any) => ({
            ...r,
            ingredient: r.ingredient || ings.find(i => i.id === r.ingredient_id),
          }));
        }
      }
      return result;
    } catch {}
  }
  return {};
}

function getLocalOrderSupplyRules(): OrderSupplyRule[] {
  const saved = localStorage.getItem('espro_order_supply_rules');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const ings = getLocalIngredients();
      return parsed.map((r: any) => ({
        ...r,
        ingredient: r.ingredient || ings.find(i => i.id === r.ingredient_id),
      }));
    } catch {}
  }
  return [];
}

function getLocalSales(): Sale[] {
  const saved = localStorage.getItem('espro_sales');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        orderType: s.orderType || 'dine_in',
        orderDeductions: s.orderDeductions || [],
        orderSuppliesCogs: Number(s.orderSuppliesCogs || 0),
        amountTendered: s.amountTendered != null ? Number(s.amountTendered) : null,
        changeDue: s.changeDue != null ? Number(s.changeDue) : null,
      }));
    } catch {}
  }
  return [];
}

function getLocalExpenses(): Expense[] {
  const saved = localStorage.getItem('espro_expenses');
  if (saved) {
    try {
      return JSON.parse(saved).map((e: any) => ({ ...e, date: new Date(e.date) }));
    } catch {}
  }
  return [];
}


// ════════════════════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════════════════════

export async function loadCategories(): Promise<string[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('name, sort_order')
        .order('sort_order', { ascending: true });
      if (error) {
        if (isNetworkError(error)) {
          return getLocalCategories();
        }
        throw new Error(error.message);
      }
      if (data && data.length > 0) {
        const cleaned = data
          .map(d => d.name)
          .filter(c => c && c.trim() && c !== 'Condiments');
        localStorage.setItem('espro_menu_categories', JSON.stringify(cleaned));
        return cleaned;
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        return getLocalCategories();
      }
      throw err;
    }
  }
  return getLocalCategories();
}

export async function saveCategories(categories: string[]): Promise<void> {
  const cleaned = Array.from(new Set(categories.filter(c => c && c.trim() && c !== 'Condiments')));

  if (isSupabaseConfigured) {
    const { data: existing, error: fetchErr } = await supabase.from('menu_categories').select('name');
    if (fetchErr) throw new Error(fetchErr.message);

    const existingNames = (existing || []).map((e: any) => e.name);
    const toDelete = existingNames.filter(n => !cleaned.includes(n));

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('menu_categories').delete().in('name', toDelete);
      if (delErr) throw new Error(delErr.message);
    }

    if (cleaned.length > 0) {
      const rows = cleaned.map((name, idx) => ({ name, sort_order: idx }));
      const { error: upsertErr } = await supabase.from('menu_categories').upsert(rows);
      if (upsertErr) throw new Error(upsertErr.message);
    }
  }

  localStorage.setItem('espro_menu_categories', JSON.stringify(cleaned));
}

export async function reassignMenuItemsCategory(from: string, to: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('menu_items')
      .update({ category: to, updated_at: new Date().toISOString() })
      .eq('category', from);
    if (error) throw new Error(error.message);
  }

  const all = getLocalMenuItems(false);
  const updated = all.map(m => m.category === from ? { ...m, category: to } : m);
  localStorage.setItem('espro_menu_items_all', JSON.stringify(updated));
  localStorage.setItem('espro_menu_items_active', JSON.stringify(updated.filter(m => m.is_active)));
}


// ════════════════════════════════════════════════════════════
// LEGACY: Products (kept for backward compat with old sales)
// ════════════════════════════════════════════════════════════

export async function loadProducts(): Promise<Product[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) {
        if (isNetworkError(error)) return getLocalProducts();
        throw new Error(error.message);
      }
      if (data) {
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
    } catch (err: any) {
      if (isNetworkError(err)) return getLocalProducts();
      throw err;
    }
  }
  return getLocalProducts();
}

export async function saveProduct(product: Product): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('products').upsert({
      id: product.id, name: product.name, category: product.category,
      unit: product.unit, stock: product.stock, threshold: product.threshold,
      price: product.price, sku: product.sku, image: product.image || null
    });
    if (error) throw new Error(error.message);
  }

  const current = getLocalProducts();
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
  const current = getLocalProducts();
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
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name');
      if (error) {
        if (isNetworkError(error)) {
          return getLocalIngredients();
        }
        throw new Error(error.message);
      }
      if (data) {
        const formatted: Ingredient[] = data.map(i => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          stock_quantity: Number(i.stock_quantity),
          low_stock_threshold: Number(i.low_stock_threshold),
          item_type: (i.item_type as 'ingredient' | 'supply') || 'ingredient',
          cost_per_unit: i.cost_per_unit != null ? Number(i.cost_per_unit) : undefined,
          expiration_date: i.expiration_date || null,
          auto_deduct_expired: i.auto_deduct_expired ?? false,
          created_at: i.created_at,
          updated_at: i.updated_at,
        }));
        localStorage.setItem('espro_ingredients', JSON.stringify(formatted));
        return formatted;
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        return getLocalIngredients();
      }
      throw err;
    }
  }
  return getLocalIngredients();
}

export async function saveIngredient(ingredient: Partial<Ingredient> & { name: string; unit: string }): Promise<Ingredient> {
  const now = new Date().toISOString();
  const payload: any = {
    id: ingredient.id || undefined,
    name: ingredient.name,
    unit: ingredient.unit,
    stock_quantity: ingredient.stock_quantity ?? 0,
    low_stock_threshold: ingredient.low_stock_threshold ?? 10,
    item_type: ingredient.item_type || 'ingredient',
    expiration_date: ingredient.expiration_date ?? null,
    auto_deduct_expired: ingredient.auto_deduct_expired ?? false,
    updated_at: now,
  };
  if (ingredient.cost_per_unit !== undefined) {
    payload.cost_per_unit = ingredient.cost_per_unit;
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('ingredients')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      const saved: Ingredient = {
        id: data.id,
        name: data.name,
        unit: data.unit,
        stock_quantity: Number(data.stock_quantity),
        low_stock_threshold: Number(data.low_stock_threshold),
        item_type: (data.item_type as 'ingredient' | 'supply') || 'ingredient',
        cost_per_unit: data.cost_per_unit != null ? Number(data.cost_per_unit) : undefined,
        expiration_date: data.expiration_date || null,
        auto_deduct_expired: data.auto_deduct_expired ?? false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      const current = getLocalIngredients();
      const idx = current.findIndex(i => i.id === saved.id);
      const updated = idx >= 0
        ? current.map(i => i.id === saved.id ? saved : i)
        : [saved, ...current];
      localStorage.setItem('espro_ingredients', JSON.stringify(updated));
      return saved;
    }
  }

  // Local-only mode
  const id = ingredient.id || crypto.randomUUID();
  const localIngredient: Ingredient = {
    id,
    name: ingredient.name,
    unit: ingredient.unit,
    stock_quantity: ingredient.stock_quantity ?? 0,
    low_stock_threshold: ingredient.low_stock_threshold ?? 10,
    item_type: ingredient.item_type || 'ingredient',
    cost_per_unit: ingredient.cost_per_unit,
    expiration_date: ingredient.expiration_date || null,
    auto_deduct_expired: ingredient.auto_deduct_expired ?? false,
    created_at: ingredient.created_at || now,
    updated_at: now,
  };
  const current = getLocalIngredients();
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
  reason: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('adjust_ingredient_stock', {
      p_ingredient_id: ingredientId,
      p_quantity: quantity,
      p_type: type,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
    // Refresh ingredients cache from Supabase
    await loadIngredients();
  } else {
    const current = getLocalIngredients();
    const ingredient = current.find(i => i.id === ingredientId);
    if (!ingredient) throw new Error('Ingredient not found');

    const batches = getLocalBatches();
    const today = new Date().toISOString().split('T')[0];

    if (type === 'add') {
      const newBatch: IngredientBatch = {
        id: crypto.randomUUID(),
        ingredient_id: ingredientId,
        quantity_received: quantity,
        quantity_remaining: quantity,
        cost_per_unit: Number(ingredient.cost_per_unit ?? 0),
        received_at: today,
        expiration_date: null,
        note: reason,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      saveLocalBatches([newBatch, ...batches]);
    } else if (type === 'reduce') {
      let needed = quantity;
      const nextBatches = batches.map(b => {
        if (b.ingredient_id === ingredientId && b.status === 'active' && needed > 0) {
          const take = Math.min(needed, b.quantity_remaining);
          needed -= take;
          const rem = b.quantity_remaining - take;
          return {
            ...b,
            quantity_remaining: rem,
            status: (rem === 0 ? 'depleted' : 'active') as 'active' | 'depleted',
          };
        }
        return b;
      });
      saveLocalBatches(nextBatches);
    } else if (type === 'set') {
      const diff = quantity - ingredient.stock_quantity;
      if (diff > 0) {
        const newBatch: IngredientBatch = {
          id: crypto.randomUUID(),
          ingredient_id: ingredientId,
          quantity_received: diff,
          quantity_remaining: diff,
          cost_per_unit: Number(ingredient.cost_per_unit ?? 0),
          received_at: today,
          expiration_date: null,
          note: reason,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        saveLocalBatches([newBatch, ...batches]);
      } else if (diff < 0) {
        let needed = Math.abs(diff);
        const nextBatches = batches.map(b => {
          if (b.ingredient_id === ingredientId && b.status === 'active' && needed > 0) {
            const take = Math.min(needed, b.quantity_remaining);
            needed -= take;
            const rem = b.quantity_remaining - take;
            return {
              ...b,
              quantity_remaining: rem,
              status: (rem === 0 ? 'depleted' : 'active') as 'active' | 'depleted',
            };
          }
          return b;
        });
        saveLocalBatches(nextBatches);
      }
    }

    syncLocalIngredientFromBatches(ingredientId);
  }

  // Record in local movements list (capped at 500)
  try {
    const savedMoves = localStorage.getItem('espro_stock_movements');
    const moves = savedMoves ? JSON.parse(savedMoves) : [];
    const newMove = {
      id: crypto.randomUUID(),
      ingredient_id: ingredientId,
      change_qty: type === 'add' ? quantity : type === 'reduce' ? -quantity : quantity,
      type,
      reason,
      created_at: new Date().toISOString(),
    };
    const updatedMoves = [newMove, ...moves].slice(0, 500);
    localStorage.setItem('espro_stock_movements', JSON.stringify(updatedMoves));
  } catch {}
}

export async function deleteIngredient(ingredientId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('ingredients').delete().eq('id', ingredientId);
    if (error) {
      if (error.code === '23503') {
        const { data: usage } = await supabase
          .from('menu_item_ingredients')
          .select('menu_item:menu_items(name)')
          .eq('ingredient_id', ingredientId);
        const itemNames = (usage || [])
          .map((u: any) => u.menu_item?.name)
          .filter(Boolean);
        const uniqueNames = Array.from(new Set(itemNames));
        const namesStr = uniqueNames.length > 0 ? uniqueNames.join(', ') : 'existing menu items';
        throw new Error(`Cannot delete ingredient: used in recipes for [${namesStr}]`);
      }
      throw new Error(error.message);
    }
  } else {
    // Local-only foreign key check
    const menuItems = getLocalMenuItems(false);
    const usingItems: string[] = [];
    for (const m of menuItems) {
      const recipe = getLocalMenuItemRecipe(m.id);
      if (recipe.some(r => r.ingredient_id === ingredientId)) {
        usingItems.push(m.name);
      }
    }
    if (usingItems.length > 0) {
      const uniqueNames = Array.from(new Set(usingItems));
      throw new Error(`Cannot delete ingredient: used in recipes for [${uniqueNames.join(', ')}]`);
    }
  }

  const current = getLocalIngredients();
  const updated = current.filter(i => i.id !== ingredientId);
  localStorage.setItem('espro_ingredients', JSON.stringify(updated));
}


// ════════════════════════════════════════════════════════════
// INGREDIENT BATCHES (FEFO Inventory)
// ════════════════════════════════════════════════════════════

export async function loadBatches(ingredientId?: string): Promise<IngredientBatch[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('ingredient_batches')
        .select('*')
        .order('expiration_date', { ascending: true, nullsFirst: false })
        .order('received_at', { ascending: true })
        .order('created_at', { ascending: true });

      if (ingredientId) {
        query = query.eq('ingredient_id', ingredientId);
      }

      const { data, error } = await query;
      if (error) {
        if (isNetworkError(error)) {
          return getLocalBatches(ingredientId);
        }
        throw new Error(error.message);
      }

      if (data) {
        const formatted: IngredientBatch[] = data.map((b: any) => ({
          id: b.id,
          ingredient_id: b.ingredient_id,
          quantity_received: Number(b.quantity_received),
          quantity_remaining: Number(b.quantity_remaining),
          cost_per_unit: Number(b.cost_per_unit ?? 0),
          received_at: b.received_at,
          expiration_date: b.expiration_date || null,
          supplier: b.supplier || null,
          note: b.note || null,
          status: b.status,
          created_at: b.created_at,
        }));
        try {
          if (!ingredientId) {
            localStorage.setItem('espro_batches', JSON.stringify(formatted));
          }
        } catch {}
        return formatted;
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        return getLocalBatches(ingredientId);
      }
      throw err;
    }
  }

  return getLocalBatches(ingredientId);
}

export async function restockIngredient(params: {
  ingredient_id: string;
  quantity: number;
  cost_per_unit?: number;
  received_at?: string;
  expiration_date?: string | null;
  supplier?: string | null;
  note?: string | null;
  created_by?: string;
}): Promise<IngredientBatch> {
  const qty = Number(params.quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Restock quantity must be greater than zero');
  }

  const today = new Date().toISOString().split('T')[0];
  const receivedAt = params.received_at || today;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('restock_ingredient', {
      p_ingredient_id: params.ingredient_id,
      p_quantity: qty,
      p_cost: params.cost_per_unit ?? 0,
      p_received: receivedAt,
      p_expiration: params.expiration_date || null,
      p_supplier: params.supplier || null,
      p_note: params.note || null,
      p_created_by: params.created_by || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Refresh ingredients and batches cache
    await loadIngredients();
    const batchRow = data as any;
    return {
      id: batchRow.id,
      ingredient_id: batchRow.ingredient_id,
      quantity_received: Number(batchRow.quantity_received),
      quantity_remaining: Number(batchRow.quantity_remaining),
      cost_per_unit: Number(batchRow.cost_per_unit ?? 0),
      received_at: batchRow.received_at,
      expiration_date: batchRow.expiration_date || null,
      supplier: batchRow.supplier || null,
      note: batchRow.note || null,
      status: batchRow.status,
      created_at: batchRow.created_at,
    };
  }

  // Local-only mode
  const newBatch: IngredientBatch = {
    id: crypto.randomUUID(),
    ingredient_id: params.ingredient_id,
    quantity_received: qty,
    quantity_remaining: qty,
    cost_per_unit: Number(params.cost_per_unit ?? 0),
    received_at: receivedAt,
    expiration_date: params.expiration_date || null,
    supplier: params.supplier || null,
    note: params.note || null,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const currentBatches = getLocalBatches();
  saveLocalBatches([newBatch, ...currentBatches]);
  syncLocalIngredientFromBatches(params.ingredient_id);

  return newBatch;
}

export async function updateBatch(
  id: string,
  updates: {
    expiration_date?: string | null;
    cost_per_unit?: number;
    note?: string | null;
    supplier?: string | null;
  }
): Promise<IngredientBatch> {
  if (isSupabaseConfigured) {
    const payload: any = {};
    if (updates.expiration_date !== undefined) payload.expiration_date = updates.expiration_date || null;
    if (updates.cost_per_unit !== undefined) payload.cost_per_unit = updates.cost_per_unit;
    if (updates.note !== undefined) payload.note = updates.note || null;
    if (updates.supplier !== undefined) payload.supplier = updates.supplier || null;

    const { data, error } = await supabase
      .from('ingredient_batches')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    await loadIngredients();
    return {
      id: data.id,
      ingredient_id: data.ingredient_id,
      quantity_received: Number(data.quantity_received),
      quantity_remaining: Number(data.quantity_remaining),
      cost_per_unit: Number(data.cost_per_unit ?? 0),
      received_at: data.received_at,
      expiration_date: data.expiration_date || null,
      supplier: data.supplier || null,
      note: data.note || null,
      status: data.status,
      created_at: data.created_at,
    };
  }

  // Local-only mode
  const currentBatches = getLocalBatches();
  const index = currentBatches.findIndex(b => b.id === id);
  if (index === -1) throw new Error('Batch not found');
  const existing = currentBatches[index];
  const updatedBatch: IngredientBatch = {
    ...existing,
    ...updates,
    expiration_date: updates.expiration_date !== undefined ? (updates.expiration_date || null) : existing.expiration_date,
    cost_per_unit: updates.cost_per_unit !== undefined ? Number(updates.cost_per_unit) : existing.cost_per_unit,
    note: updates.note !== undefined ? (updates.note || null) : existing.note,
    supplier: updates.supplier !== undefined ? (updates.supplier || null) : existing.supplier,
  };
  currentBatches[index] = updatedBatch;
  saveLocalBatches(currentBatches);
  syncLocalIngredientFromBatches(updatedBatch.ingredient_id);
  return updatedBatch;
}

export async function expireBatches(): Promise<number> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('expire_batches');
      if (error) {
        if (isNetworkError(error)) return 0;
        throw new Error(error.message);
      }
      if (Number(data) > 0) {
        await loadIngredients();
      }
      return Number(data || 0);
    } catch (err: any) {
      if (isNetworkError(err)) return 0;
      throw err;
    }
  }

  // Local-only mode
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ingredients = getLocalIngredients();
  const autoDeductMap = new Map<string, boolean>();
  for (const ing of ingredients) {
    autoDeductMap.set(ing.id, Boolean(ing.auto_deduct_expired));
  }

  const currentBatches = getLocalBatches();
  let count = 0;
  const affectedIngredientIds = new Set<string>();

  const nextBatches = currentBatches.map(b => {
    if (
      b.status === 'active' &&
      b.quantity_remaining > 0 &&
      b.expiration_date &&
      autoDeductMap.get(b.ingredient_id)
    ) {
      const exp = new Date(b.expiration_date + 'T00:00:00');
      if (exp < today) {
        count++;
        affectedIngredientIds.add(b.ingredient_id);
        return {
          ...b,
          quantity_remaining: 0,
          status: 'expired' as const,
        };
      }
    }
    return b;
  });

  if (count > 0) {
    saveLocalBatches(nextBatches);
    for (const ingId of affectedIngredientIds) {
      syncLocalIngredientFromBatches(ingId);
    }
  }

  return count;
}


// ════════════════════════════════════════════════════════════
// MENU ITEMS (sellable products with recipes)
// ════════════════════════════════════════════════════════════

export async function loadMenuItems(activeOnly = true): Promise<MenuItem[]> {
  const key = activeOnly ? 'espro_menu_items_active' : 'espro_menu_items_all';
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('menu_items').select('*').order('name');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) {
        if (isNetworkError(error)) {
          return getLocalMenuItems(activeOnly);
        }
        throw new Error(error.message);
      }
      if (data) {
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
        localStorage.setItem(key, JSON.stringify(formatted));
        return formatted;
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        return getLocalMenuItems(activeOnly);
      }
      throw err;
    }
  }
  return getLocalMenuItems(activeOnly);
}

export async function loadMenuItemRecipe(menuItemId: string): Promise<MenuItemIngredient[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .select('*, ingredient:ingredients(*)')
        .eq('menu_item_id', menuItemId);
      if (error) {
        if (isNetworkError(error)) {
          return getLocalMenuItemRecipe(menuItemId);
        }
        throw new Error(error.message);
      }
      if (data) {
        const result: MenuItemIngredient[] = data.map((row: any) => ({
          id: row.id,
          menu_item_id: row.menu_item_id,
          ingredient_id: row.ingredient_id,
          quantity_used: Number(row.quantity_used),
          unit: row.unit,
          size_id: row.size_id || null,
          usage_scope: (row.usage_scope as 'always' | 'takeout' | 'dine_in') || 'always',
          ingredient: row.ingredient ? {
            id: row.ingredient.id,
            name: row.ingredient.name,
            unit: row.ingredient.unit,
            stock_quantity: Number(row.ingredient.stock_quantity),
            low_stock_threshold: Number(row.ingredient.low_stock_threshold),
            item_type: (row.ingredient.item_type as 'ingredient' | 'supply') || 'ingredient',
            cost_per_unit: row.ingredient.cost_per_unit != null ? Number(row.ingredient.cost_per_unit) : undefined,
            expiration_date: row.ingredient.expiration_date || null,
            auto_deduct_expired: row.ingredient.auto_deduct_expired ?? false,
            created_at: row.ingredient.created_at,
            updated_at: row.ingredient.updated_at,
          } : undefined,
        }));
        try {
          localStorage.setItem(`espro_recipe_${menuItemId}`, JSON.stringify(result));
        } catch {}
        return result;
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        return getLocalMenuItemRecipe(menuItemId);
      }
      throw err;
    }
  }
  return getLocalMenuItemRecipe(menuItemId);
}

export async function loadAllRecipes(): Promise<Record<string, MenuItemIngredient[]>> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .select('*, ingredient:ingredients(*)');
      if (error) {
        if (isNetworkError(error)) return getLocalAllRecipes();
        throw new Error(error.message);
      }
      if (data) {
        const grouped: Record<string, MenuItemIngredient[]> = {};
        for (const row of data) {
          const formatted: MenuItemIngredient = {
            id: row.id,
            menu_item_id: row.menu_item_id,
            ingredient_id: row.ingredient_id,
            quantity_used: Number(row.quantity_used),
            unit: row.unit,
            size_id: row.size_id || null,
            usage_scope: (row.usage_scope as 'always' | 'takeout' | 'dine_in') || 'always',
            ingredient: row.ingredient ? {
              id: row.ingredient.id,
              name: row.ingredient.name,
              unit: row.ingredient.unit,
              stock_quantity: Number(row.ingredient.stock_quantity),
              low_stock_threshold: Number(row.ingredient.low_stock_threshold),
              item_type: (row.ingredient.item_type as 'ingredient' | 'supply') || 'ingredient',
              cost_per_unit: row.ingredient.cost_per_unit != null ? Number(row.ingredient.cost_per_unit) : undefined,
              expiration_date: row.ingredient.expiration_date || null,
              auto_deduct_expired: row.ingredient.auto_deduct_expired ?? false,
              created_at: row.ingredient.created_at,
              updated_at: row.ingredient.updated_at,
            } : undefined,
          };
          if (!grouped[row.menu_item_id]) grouped[row.menu_item_id] = [];
          grouped[row.menu_item_id].push(formatted);
        }
        for (const [menuItemId, rows] of Object.entries(grouped)) {
          try { localStorage.setItem(`espro_recipe_${menuItemId}`, JSON.stringify(rows)); } catch {}
        }
        return grouped;
      }
    } catch (err: any) {
      if (isNetworkError(err)) return getLocalAllRecipes();
      throw err;
    }
  }
  return getLocalAllRecipes();
}

// ════════════════════════════════════════════════════════════
// MENU ITEM SIZES
// ════════════════════════════════════════════════════════════

export async function loadSizes(menuItemId?: string): Promise<MenuItemSize[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('menu_item_sizes')
        .select('*')
        .order('sort_order', { ascending: true });
      if (menuItemId) query = query.eq('menu_item_id', menuItemId);
      const { data, error } = await query;
      if (error) {
        if (isNetworkError(error)) return getLocalSizes(menuItemId);
        throw new Error(error.message);
      }
      if (data) {
        const formatted: MenuItemSize[] = data.map(s => ({
          id: s.id,
          menu_item_id: s.menu_item_id,
          name: s.name,
          price: Number(s.price),
          ingredient_multiplier: Number(s.ingredient_multiplier ?? 1),
          sort_order: Number(s.sort_order ?? 0),
          is_default: Boolean(s.is_default),
          is_active: Boolean(s.is_active),
          created_at: s.created_at,
        }));
        if (!menuItemId) {
          localStorage.setItem('espro_menu_item_sizes', JSON.stringify(formatted));
        }
        return formatted;
      }
    } catch (err: any) {
      if (isNetworkError(err)) return getLocalSizes(menuItemId);
      throw err;
    }
  }
  return getLocalSizes(menuItemId);
}

export async function loadAllSizes(): Promise<Record<string, MenuItemSize[]>> {
  const sizes = await loadSizes();
  const grouped: Record<string, MenuItemSize[]> = {};
  for (const s of sizes) {
    if (!grouped[s.menu_item_id]) grouped[s.menu_item_id] = [];
    grouped[s.menu_item_id].push(s);
  }
  return grouped;
}

export async function saveMenuItemConfig(
  menuItem: Partial<MenuItem> & { name: string; category: string; price: number },
  sizes?: Array<Partial<MenuItemSize> & { name: string; price: number; ingredient_multiplier?: number; sort_order?: number; is_default?: boolean; is_active?: boolean }>,
  recipeRows?: Array<{ ingredient_id: string; quantity_used: number; unit: string; size_id?: string | null; usage_scope?: 'always' | 'takeout' | 'dine_in' }>
): Promise<MenuItem> {
  const now = new Date().toISOString();
  let basePrice = Number(menuItem.price);

  // If sizes are provided, price of menu item matches default size price (or first size price)
  if (sizes && sizes.length > 0) {
    const defaultSize = sizes.find(s => s.is_default) || sizes[0];
    if (defaultSize) {
      basePrice = Number(defaultSize.price);
    }
  }

  const payload: any = {
    id: menuItem.id || undefined,
    name: menuItem.name,
    category: menuItem.category,
    price: basePrice,
    image_url: menuItem.image_url || null,
    is_active: menuItem.is_active ?? true,
    updated_at: now,
  };

  let savedItem: MenuItem | null = null;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_items')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (data) {
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

      const sizesPayload = (sizes || []).map((s, idx) => ({
        id: s.id || undefined,
        name: s.name,
        price: Number(s.price),
        ingredient_multiplier: Number(s.ingredient_multiplier ?? 1),
        sort_order: s.sort_order ?? idx,
        is_default: Boolean(s.is_default),
        is_active: s.is_active ?? true,
      }));

      const rowsPayload = (recipeRows || []).map(r => ({
        ingredient_id: r.ingredient_id,
        quantity_used: Number(r.quantity_used),
        unit: r.unit,
        size_id: r.size_id || null,
        usage_scope: r.usage_scope || 'always',
      }));

      const { error: configError } = await supabase.rpc('save_menu_item_config', {
        p_menu_item_id: savedItem.id,
        p_sizes: sizesPayload,
        p_rows: rowsPayload,
      });

      if (configError) throw new Error(configError.message);
    }
  } else {
    // Local-only mode
    const id = menuItem.id || crypto.randomUUID();
    savedItem = {
      id,
      name: menuItem.name,
      category: menuItem.category,
      price: basePrice,
      image_url: menuItem.image_url || null,
      is_active: menuItem.is_active ?? true,
      created_at: menuItem.created_at || now,
      updated_at: now,
    };
  }

  if (savedItem) {
    // Update local cache
    const current = getLocalMenuItems(false);
    const idx = current.findIndex(m => m.id === savedItem!.id);
    const updated = idx >= 0
      ? current.map(m => m.id === savedItem!.id ? savedItem! : m)
      : [savedItem, ...current];
    localStorage.setItem('espro_menu_items_all', JSON.stringify(updated));
    localStorage.setItem('espro_menu_items_active', JSON.stringify(updated.filter(m => m.is_active)));

    if (sizes !== undefined) {
      const allSizes = getLocalSizes().filter(s => s.menu_item_id !== savedItem!.id);
      const newSizes: MenuItemSize[] = sizes.map((s, i) => ({
        id: s.id || crypto.randomUUID(),
        menu_item_id: savedItem!.id,
        name: s.name,
        price: Number(s.price),
        ingredient_multiplier: Number(s.ingredient_multiplier ?? 1),
        sort_order: s.sort_order ?? i,
        is_default: Boolean(s.is_default),
        is_active: s.is_active ?? true,
        created_at: s.created_at || now,
      }));
      localStorage.setItem('espro_menu_item_sizes', JSON.stringify([...allSizes, ...newSizes]));
    }

    if (recipeRows !== undefined) {
      const ingredients = await loadIngredients();
      const recipeWithIngredients: MenuItemIngredient[] = recipeRows.map(r => ({
        id: crypto.randomUUID(),
        menu_item_id: savedItem!.id,
        ingredient_id: r.ingredient_id,
        quantity_used: Number(r.quantity_used),
        unit: r.unit,
        size_id: r.size_id || null,
        usage_scope: r.usage_scope || 'always',
        ingredient: ingredients.find(i => i.id === r.ingredient_id),
      }));
      localStorage.setItem(`espro_recipe_${savedItem.id}`, JSON.stringify(recipeWithIngredients));
    }
  }

  return savedItem!;
}

export async function saveMenuItem(
  menuItem: Partial<MenuItem> & { name: string; category: string; price: number },
  recipeRows?: Array<{ ingredient_id: string; quantity_used: number; unit: string; size_id?: string | null; usage_scope?: 'always' | 'takeout' | 'dine_in' }>
): Promise<MenuItem> {
  // If sizes already exist for this menu item, ensure price aligns with default size
  let price = Number(menuItem.price);
  if (menuItem.id) {
    const existingSizes = await loadSizes(menuItem.id);
    if (existingSizes.length > 0) {
      const defaultSize = existingSizes.find(s => s.is_default) || existingSizes[0];
      if (defaultSize) {
        price = defaultSize.price;
      }
    }
  }

  const now = new Date().toISOString();
  const payload = {
    id: menuItem.id || undefined,
    name: menuItem.name,
    category: menuItem.category,
    price,
    image_url: menuItem.image_url || null,
    is_active: menuItem.is_active ?? true,
    updated_at: now,
  };

  let savedItem: MenuItem | null = null;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_items')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
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

      if (recipeRows !== undefined) {
        const rowsPayload = recipeRows.map(r => ({
          ingredient_id: r.ingredient_id,
          quantity_used: Number(r.quantity_used),
          unit: r.unit,
          size_id: r.size_id || null,
          usage_scope: r.usage_scope || 'always',
        }));
        const { error: recipeError } = await supabase.rpc('save_menu_item_recipe', {
          p_menu_item_id: savedItem.id,
          p_rows: rowsPayload,
        });
        if (recipeError) {
          throw new Error(recipeError.message);
        }
      }
    }
  } else {
    // Local-only mode
    const id = menuItem.id || crypto.randomUUID();
    savedItem = {
      id,
      name: menuItem.name,
      category: menuItem.category,
      price,
      image_url: menuItem.image_url || null,
      is_active: menuItem.is_active ?? true,
      created_at: menuItem.created_at || now,
      updated_at: now,
    };
  }

  if (savedItem) {
    const current = getLocalMenuItems(false);
    const idx = current.findIndex(m => m.id === savedItem!.id);
    const updated = idx >= 0
      ? current.map(m => m.id === savedItem!.id ? savedItem! : m)
      : [savedItem, ...current];
    localStorage.setItem('espro_menu_items_all', JSON.stringify(updated));
    localStorage.setItem('espro_menu_items_active', JSON.stringify(updated.filter(m => m.is_active)));

    if (recipeRows !== undefined) {
      const ingredients = await loadIngredients();
      const recipeWithIngredients = recipeRows.map(r => ({
        id: crypto.randomUUID(),
        menu_item_id: savedItem!.id,
        ingredient_id: r.ingredient_id,
        quantity_used: Number(r.quantity_used),
        unit: r.unit,
        size_id: r.size_id || null,
        usage_scope: r.usage_scope || 'always',
        ingredient: ingredients.find(i => i.id === r.ingredient_id),
      }));
      localStorage.setItem(`espro_recipe_${savedItem.id}`, JSON.stringify(recipeWithIngredients));
    }
  }

  return savedItem!;
}

// ════════════════════════════════════════════════════════════
// ADDONS
// ════════════════════════════════════════════════════════════

export async function loadAddons(activeOnly = true): Promise<AddonItem[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('addons').select('*').order('name');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) {
        if (isNetworkError(error)) return getLocalAddons(activeOnly);
        throw new Error(error.message);
      }
      if (data) {
        const formatted: AddonItem[] = data.map(a => ({
          id: a.id,
          name: a.name,
          price: Number(a.price),
          is_active: Boolean(a.is_active),
          applies_to_categories: Array.isArray(a.applies_to_categories) ? a.applies_to_categories : [],
          applies_to_items: Array.isArray(a.applies_to_items) ? a.applies_to_items : [],
          created_at: a.created_at,
        }));
        if (!activeOnly) {
          localStorage.setItem('espro_addons_all', JSON.stringify(formatted));
        }
        return formatted;
      }
    } catch (err: any) {
      if (isNetworkError(err)) return getLocalAddons(activeOnly);
      throw err;
    }
  }
  return getLocalAddons(activeOnly);
}

export async function loadAllAddonRecipes(): Promise<Record<string, AddonIngredient[]>> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('addon_ingredients')
        .select('*, ingredient:ingredients(*)');
      if (error) {
        if (isNetworkError(error)) return getLocalAllAddonRecipes();
        throw new Error(error.message);
      }
      if (data) {
        const grouped: Record<string, AddonIngredient[]> = {};
        for (const row of data) {
          const formatted: AddonIngredient = {
            id: row.id,
            addon_id: row.addon_id,
            ingredient_id: row.ingredient_id,
            quantity_used: Number(row.quantity_used),
            unit: row.unit,
            ingredient: row.ingredient ? {
              id: row.ingredient.id,
              name: row.ingredient.name,
              unit: row.ingredient.unit,
              stock_quantity: Number(row.ingredient.stock_quantity),
              low_stock_threshold: Number(row.ingredient.low_stock_threshold),
              item_type: (row.ingredient.item_type as 'ingredient' | 'supply') || 'ingredient',
              cost_per_unit: row.ingredient.cost_per_unit != null ? Number(row.ingredient.cost_per_unit) : undefined,
              created_at: row.ingredient.created_at,
              updated_at: row.ingredient.updated_at,
            } : undefined,
          };
          if (!grouped[row.addon_id]) grouped[row.addon_id] = [];
          grouped[row.addon_id].push(formatted);
        }
        localStorage.setItem('espro_addon_recipes_grouped', JSON.stringify(grouped));
        return grouped;
      }
    } catch (err: any) {
      if (isNetworkError(err)) return getLocalAllAddonRecipes();
      throw err;
    }
  }
  return getLocalAllAddonRecipes();
}

export async function saveAddon(
  addon: Partial<AddonItem> & { name: string; price: number },
  rows?: Array<{ ingredient_id: string; quantity_used: number; unit: string }>
): Promise<AddonItem> {
  const id = addon.id || crypto.randomUUID();
  const payloadAddon = {
    id,
    name: addon.name,
    price: Number(addon.price),
    is_active: addon.is_active ?? true,
    applies_to_categories: addon.applies_to_categories || [],
    applies_to_items: addon.applies_to_items || [],
  };

  const rowsPayload = (rows || []).map(r => ({
    ingredient_id: r.ingredient_id,
    quantity_used: Number(r.quantity_used),
    unit: r.unit,
  }));

  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('save_addon', {
      p_addon: payloadAddon,
      p_rows: rowsPayload,
    });
    if (error) throw new Error(error.message);
  }

  const allAddons = getLocalAddons(false);
  const updated = allAddons.filter(a => a.id !== id);
  const savedItem: AddonItem = {
    ...payloadAddon,
    created_at: addon.created_at || new Date().toISOString(),
  };
  updated.unshift(savedItem);
  localStorage.setItem('espro_addons_all', JSON.stringify(updated));

  const allRecipes = getLocalAllAddonRecipes();
  if (rows !== undefined) {
    const ings = getLocalIngredients();
    allRecipes[id] = rows.map(r => ({
      id: crypto.randomUUID(),
      addon_id: id,
      ingredient_id: r.ingredient_id,
      quantity_used: Number(r.quantity_used),
      unit: r.unit,
      ingredient: ings.find(i => i.id === r.ingredient_id),
    }));
    localStorage.setItem('espro_addon_recipes_grouped', JSON.stringify(allRecipes));
  }

  return savedItem;
}

export async function deactivateAddon(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('addons')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
  const allAddons = getLocalAddons(false);
  const updated = allAddons.map(a => a.id === id ? { ...a, is_active: false } : a);
  localStorage.setItem('espro_addons_all', JSON.stringify(updated));
}

// ════════════════════════════════════════════════════════════
// ORDER SUPPLY RULES
// ════════════════════════════════════════════════════════════

export async function loadOrderSupplyRules(): Promise<OrderSupplyRule[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('order_supply_rules')
        .select('*, ingredient:ingredients(*)')
        .order('created_at', { ascending: true });
      if (error) {
        if (isNetworkError(error)) return getLocalOrderSupplyRules();
        throw new Error(error.message);
      }
      if (data) {
        const formatted: OrderSupplyRule[] = data.map(r => ({
          id: r.id,
          ingredient_id: r.ingredient_id,
          quantity_used: Number(r.quantity_used),
          unit: r.unit,
          order_type: r.order_type as 'takeout' | 'dine_in' | 'all',
          is_active: Boolean(r.is_active),
          ingredient: r.ingredient ? {
            id: r.ingredient.id,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            stock_quantity: Number(r.ingredient.stock_quantity),
            low_stock_threshold: Number(r.ingredient.low_stock_threshold),
            item_type: (r.ingredient.item_type as 'ingredient' | 'supply') || 'ingredient',
            cost_per_unit: r.ingredient.cost_per_unit != null ? Number(r.ingredient.cost_per_unit) : undefined,
            created_at: r.ingredient.created_at,
            updated_at: r.ingredient.updated_at,
          } : undefined,
          created_at: r.created_at,
        }));
        localStorage.setItem('espro_order_supply_rules', JSON.stringify(formatted));
        return formatted;
      }
    } catch (err: any) {
      if (isNetworkError(err)) return getLocalOrderSupplyRules();
      throw err;
    }
  }
  return getLocalOrderSupplyRules();
}

export async function saveOrderSupplyRules(
  rows: Array<{ id?: string; ingredient_id: string; quantity_used: number; unit: string; order_type: 'takeout' | 'dine_in' | 'all'; is_active?: boolean }>
): Promise<void> {
  const rowsPayload = rows.map(r => ({
    id: r.id || undefined,
    ingredient_id: r.ingredient_id,
    quantity_used: Number(r.quantity_used),
    unit: r.unit,
    order_type: r.order_type,
    is_active: r.is_active ?? true,
  }));

  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('save_order_supply_rules', {
      p_rows: rowsPayload,
    });
    if (error) throw new Error(error.message);
  }

  const ings = getLocalIngredients();
  const formatted: OrderSupplyRule[] = rows.map(r => ({
    id: r.id || crypto.randomUUID(),
    ingredient_id: r.ingredient_id,
    quantity_used: Number(r.quantity_used),
    unit: r.unit,
    order_type: r.order_type,
    is_active: r.is_active ?? true,
    ingredient: ings.find(i => i.id === r.ingredient_id),
    created_at: new Date().toISOString(),
  }));
  localStorage.setItem('espro_order_supply_rules', JSON.stringify(formatted));
}

export async function softDeleteMenuItem(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  const all = getLocalMenuItems(false);
  const updated = all.map(m => m.id === id ? { ...m, is_active: false } : m);
  localStorage.setItem('espro_menu_items_all', JSON.stringify(updated));
  localStorage.setItem('espro_menu_items_active', JSON.stringify(updated.filter(m => m.is_active)));
}

export async function uploadMenuImage(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
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
// SALES (enhanced with snapshot COGS, supplies & FEFO batches)
// ════════════════════════════════════════════════════════════

export async function loadSales(): Promise<Sale[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      if (error) {
        if (isNetworkError(error)) {
          return getLocalSales();
        }
        throw new Error(error.message);
      }
      if (data) {
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
          voidReason: s.void_reason || undefined,
          orderType: (s.order_type as 'dine_in' | 'takeout') || 'dine_in',
          orderDeductions: typeof s.order_deductions === 'string' ? JSON.parse(s.order_deductions) : (s.order_deductions || []),
          orderSuppliesCogs: Number(s.order_supplies_cogs || 0),
          amountTendered: s.amount_tendered != null ? Number(s.amount_tendered) : null,
          changeDue: s.change_due != null ? Number(s.change_due) : null,
        }));
        localStorage.setItem('espro_sales', JSON.stringify(formatted));
        return formatted;
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        return getLocalSales();
      }
      throw err;
    }
  }
  return getLocalSales();
}

export interface CreateSaleOptions {
  orderType?: 'dine_in' | 'takeout';
  orderDeductions?: Array<{ ingredient_id: string; quantity: number }>;
  orderSuppliesCogs?: number;
  amountTendered?: number | null;
  changeDue?: number | null;
}

/**
 * Create a sale using atomic RPC complete_sale_with_deduction.
 * Lines arrive precomputed with deductions and cogs from orderCalc.
 */
export async function createSaleWithDeduction(
  saleId: string,
  lines: any[],
  subtotal: number,
  discount: number,
  total: number,
  paymentMethod: string,
  cashierName: string,
  opts?: CreateSaleOptions
): Promise<void> {
  const orderType = opts?.orderType || 'dine_in';
  const orderDeductions = opts?.orderDeductions || [];
  const orderSuppliesCogs = Number(opts?.orderSuppliesCogs || 0);
  const amountTendered = opts?.amountTendered != null ? Number(opts.amountTendered) : null;
  const changeDue = opts?.changeDue != null ? Number(opts.changeDue) : null;

  // Format line items JSON
  const itemsJson = lines.map(item => {
    return {
      line_id: item.line_id || undefined,
      menu_item_id: item.menu_item_id,
      name: item.name,
      category: item.category,
      image_url: item.image_url || null,
      qty: Number(item.qty),
      size_id: item.size_id || null,
      size_name: item.size_name || null,
      base_price: item.base_price != null ? Number(item.base_price) : Number(item.price),
      unit_price: item.unit_price != null ? Number(item.unit_price) : Number(item.price),
      price: Number(item.price),
      addons: Array.isArray(item.addons) ? item.addons : [],
      note: item.note || null,
      cogs_per_serving: item.cogs_per_serving != null ? Number(item.cogs_per_serving) : 0,
      cogs_supplies_per_serving: item.cogs_supplies_per_serving != null ? Number(item.cogs_supplies_per_serving) : 0,
      deductions: Array.isArray(item.deductions) ? item.deductions : [],
    };
  });

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.rpc('complete_sale_with_deduction', {
        p_sale_id: saleId,
        p_items: itemsJson,
        p_subtotal: subtotal,
        p_discount: discount,
        p_total: total,
        p_payment_method: paymentMethod,
        p_cashier_name: cashierName,
        p_order_type: orderType,
        p_order_deductions: orderDeductions,
        p_order_supplies_cogs: orderSuppliesCogs,
        p_amount_tendered: amountTendered,
        p_change_due: changeDue,
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadSales();
      return;
    } catch (err: any) {
      if (isNetworkError(err)) {
        const currentSales = getLocalSales();
        const localSale: Sale = {
          id: saleId,
          items: itemsJson,
          subtotal,
          discount,
          total,
          paymentMethod: paymentMethod as 'cash' | 'gcash',
          cashierName,
          createdAt: new Date(),
          status: 'completed',
          orderType,
          orderDeductions,
          orderSuppliesCogs,
          amountTendered,
          changeDue,
        };
        localStorage.setItem('espro_sales', JSON.stringify([localSale, ...currentSales]));

        const combinedDeductions: Record<string, number> = {};
        for (const item of itemsJson) {
          for (const d of item.deductions) {
            if (d.ingredient_id && d.quantity > 0) {
              combinedDeductions[d.ingredient_id] = (combinedDeductions[d.ingredient_id] || 0) + Number(d.quantity);
            }
          }
        }
        for (const od of orderDeductions) {
          if (od.ingredient_id && od.quantity > 0) {
            combinedDeductions[od.ingredient_id] = (combinedDeductions[od.ingredient_id] || 0) + Number(od.quantity);
          }
        }

        for (const [ingId, qtyNeeded] of Object.entries(combinedDeductions)) {
          await adjustIngredientStock(ingId, qtyNeeded, 'reduce', `POS Sale (Offline) ${saleId}`);
        }
        return;
      }

      throw err;
    }
  }

  // Local-only mode
  const combinedDeductions: Record<string, number> = {};
  for (const item of itemsJson) {
    for (const d of item.deductions) {
      if (d.ingredient_id && d.quantity > 0) {
        combinedDeductions[d.ingredient_id] = (combinedDeductions[d.ingredient_id] || 0) + Number(d.quantity);
      }
    }
  }
  for (const od of orderDeductions) {
    if (od.ingredient_id && od.quantity > 0) {
      combinedDeductions[od.ingredient_id] = (combinedDeductions[od.ingredient_id] || 0) + Number(od.quantity);
    }
  }

  const ingredients = getLocalIngredients();
  for (const [ingId, needed] of Object.entries(combinedDeductions)) {
    const ing = ingredients.find(i => i.id === ingId);
    if (ing && ing.stock_quantity < needed) {
      throw new Error(`Insufficient stock for "${ing.name}" — need ${needed} ${ing.unit}, only ${ing.stock_quantity} available`);
    }
  }

  for (const [ingId, needed] of Object.entries(combinedDeductions)) {
    await adjustIngredientStock(ingId, needed, 'reduce', `POS Sale ${saleId}`);
  }

  const currentSales = getLocalSales();
  const localSale: Sale = {
    id: saleId,
    items: itemsJson,
    subtotal,
    discount,
    total,
    paymentMethod: paymentMethod as 'cash' | 'gcash',
    cashierName,
    createdAt: new Date(),
    status: 'completed',
    orderType,
    orderDeductions,
    orderSuppliesCogs,
    amountTendered,
    changeDue,
  };
  localStorage.setItem('espro_sales', JSON.stringify([localSale, ...currentSales]));
}

/** Legacy createSale for backward compat */
export async function createSale(sale: Sale): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('sales').insert({
      id: sale.id, items: sale.items, subtotal: sale.subtotal,
      discount: sale.discount, total: sale.total,
      payment_method: sale.paymentMethod, cashier_name: sale.cashierName,
      status: sale.status, created_at: sale.createdAt.toISOString()
    });
    if (error) throw new Error(error.message);
  }

  const currentSales = getLocalSales();
  localStorage.setItem('espro_sales', JSON.stringify([sale, ...currentSales]));

  for (const item of sale.items as any[]) {
    if (item.product) {
      try { await adjustStock(item.product.id, item.qty, 'reduce', 'POS Sale'); } catch {}
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
): Promise<{ restored: boolean }> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('void_sale_with_restoration', {
      p_sale_id: saleId,
      p_status: status,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
    const restored = typeof data === 'object' && data !== null && 'restored' in data
      ? Boolean((data as any).restored)
      : true;
    await loadSales();
    return { restored };
  }

  const currentSales = getLocalSales();
  const sale = currentSales.find(s => s.id === saleId);
  if (!sale) throw new Error(`Sale "${saleId}" not found`);
  if (sale.status !== 'completed') throw new Error(`Sale "${saleId}" is already ${sale.status}`);

  let hasDeductions = false;
  const items = (sale.items || []) as any[];
  for (const item of items) {
    if (Array.isArray(item.deductions) && item.deductions.length > 0) {
      hasDeductions = true;
      for (const d of item.deductions) {
        if (d.ingredient_id && d.quantity > 0) {
          await adjustIngredientStock(d.ingredient_id, d.quantity, 'add', `Void Restoration ${saleId}`);
        }
      }
    }
  }

  const updatedSales = currentSales.map(s =>
    s.id === saleId ? { ...s, status: status, voidReason: reason } : s
  );
  localStorage.setItem('espro_sales', JSON.stringify(updatedSales));

  return { restored: hasDeductions };
}

export async function refundSaleNoRestoration(
  saleId: string,
  reason: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('refund_sale_no_restoration', {
      p_sale_id: saleId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
    await loadSales();
    return;
  }

  const currentSales = getLocalSales();
  const sale = currentSales.find(s => s.id === saleId);
  if (!sale) throw new Error(`Sale "${saleId}" not found`);
  if (sale.status !== 'completed') throw new Error(`Sale "${saleId}" is already ${sale.status}`);

  const updatedSales = currentSales.map(s =>
    s.id === saleId ? { ...s, status: 'refunded' as const, voidReason: reason } : s
  );
  localStorage.setItem('espro_sales', JSON.stringify(updatedSales));
}

/** Legacy voidRefundSale kept for backward compat */
export async function voidRefundSale(
  saleId: string,
  status: 'voided' | 'refunded',
  reason: string
): Promise<void> {
  if (status === 'refunded') {
    await refundSaleNoRestoration(saleId, reason);
  } else {
    await voidSaleWithRestoration(saleId, status, reason);
  }
}


// ════════════════════════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════════════════════════

export async function loadExpenses(): Promise<Expense[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (error) {
        if (isNetworkError(error)) {
          return getLocalExpenses();
        }
        throw new Error(error.message);
      }
      if (data) {
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
    } catch (err: any) {
      if (isNetworkError(err)) {
        return getLocalExpenses();
      }
      throw err;
    }
  }
  return getLocalExpenses();
}

export async function saveExpense(expense: Expense): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('expenses').insert({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date instanceof Date ? expense.date.toISOString() : new Date(expense.date).toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  const current = getLocalExpenses();
  const updated = [expense, ...current.filter(e => e.id !== expense.id)];
  localStorage.setItem('espro_expenses', JSON.stringify(updated));
}

export async function updateExpense(expense: Expense): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('expenses').upsert({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date instanceof Date ? expense.date.toISOString() : new Date(expense.date).toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  const current = getLocalExpenses();
  const updated = current.map(e => e.id === expense.id ? expense : e);
  if (!updated.some(e => e.id === expense.id)) {
    updated.unshift(expense);
  }
  localStorage.setItem('espro_expenses', JSON.stringify(updated));
}

export async function deleteExpense(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  const current = getLocalExpenses();
  const updated = current.filter(e => e.id !== id);
  localStorage.setItem('espro_expenses', JSON.stringify(updated));
}
