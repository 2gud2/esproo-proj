// ─── Pure Calculation Functions for Orders, Lines, and Recipes ───
import type {
  MenuItem,
  MenuItemSize,
  MenuItemIngredient,
  AddonItem,
  AddonIngredient,
  OrderSupplyRule,
  Ingredient,
  CartLine,
  CartLineAddon
} from './mockData';
import { convertUnitQuantity, calculateIngredientCost } from './unitConversion';

export interface ComputeLineInput {
  menuItem: MenuItem;
  size?: MenuItemSize | null;
  addons?: Array<{ addon: AddonItem; qty: number }>;
  qty: number;
  note?: string | null;
  orderType: 'dine_in' | 'takeout';
  recipe: MenuItemIngredient[];
  addonRecipes?: Record<string, AddonIngredient[]> | Map<string, AddonIngredient[]>;
  ingredientsById: Record<string, Ingredient> | Map<string, Ingredient>;
}

export interface ComputeOrderContext {
  orderSupplyRules: OrderSupplyRule[];
  ingredientsById: Record<string, Ingredient> | Map<string, Ingredient>;
}

export interface OrderShortage {
  ingredientId: string;
  ingredientName: string;
  needed: number;
  available: number;
  unit: string;
}

export interface ComputeOrderResult {
  lines: CartLine[];
  orderDeductions: Array<{ ingredient_id: string; quantity: number }>;
  orderSuppliesCogs: number;
  needs: Record<string, number>;
  shortages: OrderShortage[];
}

function getIngredient(
  id: string,
  ingredientsById: Record<string, Ingredient> | Map<string, Ingredient>
): Ingredient | undefined {
  if (ingredientsById instanceof Map) {
    return ingredientsById.get(id);
  }
  return ingredientsById[id];
}

function getAddonRecipe(
  addonId: string,
  addonRecipes?: Record<string, AddonIngredient[]> | Map<string, AddonIngredient[]>
): AddonIngredient[] {
  if (!addonRecipes) return [];
  if (addonRecipes instanceof Map) {
    return addonRecipes.get(addonId) || [];
  }
  return addonRecipes[addonId] || [];
}

/**
 * Compute line price, per-serving COGS (ingredients and supplies), and total line deductions.
 */
export function computeLine(input: ComputeLineInput): CartLine {
  const {
    menuItem,
    size,
    addons = [],
    qty,
    note,
    orderType,
    recipe = [],
    addonRecipes,
    ingredientsById
  } = input;

  const basePrice = size ? Number(size.price) : Number(menuItem.price);
  let addonsTotalPerServing = 0;
  const cartAddons: CartLineAddon[] = [];

  for (const item of addons) {
    const addonPrice = Number(item.addon.price || 0);
    const addonQty = Number(item.qty || 1);
    addonsTotalPerServing += addonPrice * addonQty;
    cartAddons.push({
      addon_id: item.addon.id,
      name: item.addon.name,
      price: addonPrice,
      qty: addonQty,
    });
  }

  const unitPrice = basePrice + addonsTotalPerServing;
  let cogsPerServing = 0;
  let cogsSuppliesPerServing = 0;
  const deductionsMap: Record<string, number> = {};

  // 1. Process Menu Item Recipe Rows
  for (const row of recipe) {
    // Check size filter: applies if row.size_id is null/empty or equals selected size
    if (row.size_id && size && row.size_id !== size.id) {
      continue;
    }
    if (row.size_id && !size) {
      continue;
    }

    // Check usage scope filter: applies if 'always', or equals orderType, or undefined
    if (row.usage_scope && row.usage_scope !== 'always' && row.usage_scope !== orderType) {
      continue;
    }

    const ing = getIngredient(row.ingredient_id, ingredientsById);
    const isSupply = ing?.item_type === 'supply';
    const multiplier = isSupply ? 1 : (size?.ingredient_multiplier != null ? Number(size.ingredient_multiplier) : 1);
    const effectiveQtyPerServing = Number(row.quantity_used) * multiplier;

    // Per-serving cost
    const rowCost = calculateIngredientCost(effectiveQtyPerServing, row.unit, ing);
    if (isSupply) {
      cogsSuppliesPerServing += rowCost;
    } else {
      cogsPerServing += rowCost;
    }

    // Line deductions in inventory unit
    const invUnit = ing?.unit || row.unit || 'pcs';
    const totalLineQtyInRecipeUnit = effectiveQtyPerServing * qty;
    const totalLineQtyInInvUnit = convertUnitQuantity(totalLineQtyInRecipeUnit, row.unit, invUnit);

    deductionsMap[row.ingredient_id] = (deductionsMap[row.ingredient_id] || 0) + totalLineQtyInInvUnit;
  }

  // 2. Process Addon Recipe Rows
  for (const addonEntry of addons) {
    const addonRows = getAddonRecipe(addonEntry.addon.id, addonRecipes);
    const addonQty = Number(addonEntry.qty || 1);

    for (const addonRow of addonRows) {
      const ing = getIngredient(addonRow.ingredient_id, ingredientsById);
      const isSupply = ing?.item_type === 'supply';
      const effectiveQtyPerServing = Number(addonRow.quantity_used) * addonQty;

      const rowCost = calculateIngredientCost(effectiveQtyPerServing, addonRow.unit, ing);
      if (isSupply) {
        cogsSuppliesPerServing += rowCost;
      } else {
        cogsPerServing += rowCost;
      }

      const invUnit = ing?.unit || addonRow.unit || 'pcs';
      const totalLineQtyInRecipeUnit = effectiveQtyPerServing * qty;
      const totalLineQtyInInvUnit = convertUnitQuantity(totalLineQtyInRecipeUnit, addonRow.unit, invUnit);

      deductionsMap[addonRow.ingredient_id] = (deductionsMap[addonRow.ingredient_id] || 0) + totalLineQtyInInvUnit;
    }
  }

  const deductions = Object.entries(deductionsMap).map(([ingredient_id, quantity]) => ({
    ingredient_id,
    quantity: Number(quantity.toFixed(4)),
  }));

  const lineId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    line_id: lineId,
    menu_item_id: menuItem.id,
    name: menuItem.name,
    category: menuItem.category,
    image_url: menuItem.image_url || null,
    qty,
    size_id: size ? size.id : null,
    size_name: size ? size.name : null,
    base_price: Number(basePrice),
    unit_price: Number(unitPrice),
    price: Number(unitPrice),
    addons: cartAddons,
    note: note ? note.trim() : null,
    cogs_per_serving: Number(cogsPerServing.toFixed(2)),
    cogs_supplies_per_serving: Number(cogsSuppliesPerServing.toFixed(2)),
    deductions,
  };
}

/**
 * Compute order-level supplies, combined ingredient requirements, and shortage checks.
 */
export function computeOrder(
  cartLines: CartLine[],
  orderType: 'dine_in' | 'takeout',
  ctx: ComputeOrderContext
): ComputeOrderResult {
  const { orderSupplyRules = [], ingredientsById } = ctx;
  const orderDeductionsMap: Record<string, number> = {};
  let orderSuppliesCogs = 0;

  // 1. Order-level supply rules
  for (const rule of orderSupplyRules) {
    if (rule.is_active === false) continue;
    if (rule.order_type !== 'all' && rule.order_type !== orderType) continue;

    const ing = getIngredient(rule.ingredient_id, ingredientsById);
    const invUnit = ing?.unit || rule.unit || 'pcs';
    const qtyInInvUnit = convertUnitQuantity(Number(rule.quantity_used), rule.unit, invUnit);
    const cost = calculateIngredientCost(Number(rule.quantity_used), rule.unit, ing);

    orderDeductionsMap[rule.ingredient_id] = (orderDeductionsMap[rule.ingredient_id] || 0) + qtyInInvUnit;
    orderSuppliesCogs += cost;
  }

  const orderDeductions = Object.entries(orderDeductionsMap).map(([ingredient_id, quantity]) => ({
    ingredient_id,
    quantity: Number(quantity.toFixed(4)),
  }));

  // 2. Aggregate all needs
  const needs: Record<string, number> = {};

  for (const line of cartLines) {
    if (Array.isArray(line.deductions)) {
      for (const d of line.deductions) {
        needs[d.ingredient_id] = (needs[d.ingredient_id] || 0) + Number(d.quantity);
      }
    }
  }

  for (const od of orderDeductions) {
    needs[od.ingredient_id] = (needs[od.ingredient_id] || 0) + Number(od.quantity);
  }

  // 3. Check for shortages
  const shortages: OrderShortage[] = [];
  for (const [ingredientId, needed] of Object.entries(needs)) {
    const ing = getIngredient(ingredientId, ingredientsById);
    const available = Number(ing?.stock_quantity ?? 0);
    if (available < needed) {
      shortages.push({
        ingredientId,
        ingredientName: ing?.name || 'Unknown Ingredient',
        needed: Number(needed.toFixed(4)),
        available: Number(available.toFixed(4)),
        unit: ing?.unit || 'pcs',
      });
    }
  }

  return {
    lines: cartLines,
    orderDeductions,
    orderSuppliesCogs: Number(orderSuppliesCogs.toFixed(2)),
    needs,
    shortages,
  };
}

/**
 * Generate a deterministic key for cart line merging based on configuration.
 */
export function lineKey(line: {
  menu_item_id: string;
  size_id?: string | null;
  addons?: Array<{ addon_id: string; qty: number }>;
  note?: string | null;
}): string {
  const sortedAddons = (line.addons || [])
    .slice()
    .sort((a, b) => a.addon_id.localeCompare(b.addon_id))
    .map(a => `${a.addon_id}:${a.qty}`)
    .join('|');

  const normalizedNote = (line.note || '').trim().toLowerCase();
  return `${line.menu_item_id}__${line.size_id || 'nosize'}__${sortedAddons}__${normalizedNote}`;
}
