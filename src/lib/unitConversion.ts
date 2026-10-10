// ─── Universal Unit Conversion & COGS Helper for Coffee Shops ───
import type { Ingredient } from './mockData';

export interface UnitDefinition {
  label: string;
  value: string;
  category: 'mass' | 'volume' | 'count';
  baseRatio: number; // Ratio relative to base unit (mass base: g, volume base: ml, count base: 1)
}

// Comprehensive coffee shop & cafe units
export const ALL_UNITS: UnitDefinition[] = [
  // Mass Units (Base: g)
  { label: 'Milligrams (mg)', value: 'mg', category: 'mass', baseRatio: 0.001 },
  { label: 'Grams (g)', value: 'g', category: 'mass', baseRatio: 1 },
  { label: 'Kilograms (kg)', value: 'kg', category: 'mass', baseRatio: 1000 },
  { label: 'Ounces (oz)', value: 'oz', category: 'mass', baseRatio: 28.3495 },
  { label: 'Pounds (lb)', value: 'lb', category: 'mass', baseRatio: 453.592 },

  // Volume Units (Base: ml)
  { label: 'Milliliters (ml)', value: 'ml', category: 'volume', baseRatio: 1 },
  { label: 'Liters (L)', value: 'L', category: 'volume', baseRatio: 1000 },
  { label: 'Fluid Ounces (fl oz)', value: 'fl oz', category: 'volume', baseRatio: 29.5735 },
  { label: 'Teaspoon (tsp)', value: 'tsp', category: 'volume', baseRatio: 5 },
  { label: 'Tablespoon (tbsp)', value: 'tbsp', category: 'volume', baseRatio: 15 },
  { label: 'Cup (cup)', value: 'cup', category: 'volume', baseRatio: 240 },
  { label: 'Espresso Shots (shots)', value: 'shots', category: 'volume', baseRatio: 30 },
  { label: 'Syrup Pumps (pumps)', value: 'pumps', category: 'volume', baseRatio: 10 },
  { label: 'Dashes (dashes)', value: 'dashes', category: 'volume', baseRatio: 1 },

  // Count & Discrete Units (Base: 1)
  { label: 'Pieces (pcs)', value: 'pcs', category: 'count', baseRatio: 1 },
  { label: 'Scoops (scoops)', value: 'scoops', category: 'count', baseRatio: 1 },
  { label: 'Bottles (bottles)', value: 'bottles', category: 'count', baseRatio: 1 },
  { label: 'Cans (cans)', value: 'cans', category: 'count', baseRatio: 1 },
  { label: 'Packs (packs)', value: 'packs', category: 'count', baseRatio: 1 },
  { label: 'Boxes (boxes)', value: 'boxes', category: 'count', baseRatio: 1 },
  { label: 'Bags (bags)', value: 'bags', category: 'count', baseRatio: 1 },
  { label: 'Slices (slices)', value: 'slices', category: 'count', baseRatio: 1 },
  { label: 'Servings (servings)', value: 'servings', category: 'count', baseRatio: 1 },
];

/**
 * Normalize unit string for comparison (lowercase, trimmed, standard abbreviations)
 */
export function normalizeUnit(unit: string | undefined | null): string {
  if (!unit) return 'pcs';
  const u = unit.trim().toLowerCase();
  if (u === 'l' || u === 'liter' || u === 'liters') return 'L';
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters') return 'ml';
  if (u === 'g' || u === 'gram' || u === 'grams') return 'g';
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'mg' || u === 'milligram' || u === 'milligrams') return 'mg';
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'fl oz' || u === 'floz' || u === 'fluid ounce' || u === 'fluid ounces') return 'fl oz';
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
  if (u === 'shot' || u === 'shots') return 'shots';
  if (u === 'pump' || u === 'pumps') return 'pumps';
  if (u === 'scoop' || u === 'scoops') return 'scoops';
  if (u === 'pc' || u === 'pcs' || u === 'piece' || u === 'pieces' || u === 'item' || u === 'items') return 'pcs';
  if (u === 'pack' || u === 'packs') return 'packs';
  if (u === 'box' || u === 'boxes') return 'boxes';
  if (u === 'bag' || u === 'bags') return 'bags';
  if (u === 'can' || u === 'cans') return 'cans';
  if (u === 'bottle' || u === 'bottles') return 'bottles';
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'cup' || u === 'cups') return 'cup';
  return unit.trim();
}

/**
 * Find definition for a unit
 */
export function getUnitDefinition(unit: string): UnitDefinition | undefined {
  const norm = normalizeUnit(unit).toLowerCase();
  return ALL_UNITS.find(u => u.value.toLowerCase() === norm);
}

/**
 * Get compatible units for a given inventory ingredient unit.
 * E.g., if inventory is 'kg', returns ['mg', 'g', 'kg', 'oz', 'lb'].
 * If inventory is 'L', returns ['ml', 'L', 'fl oz', 'tsp', 'tbsp', 'cup', 'shots', 'pumps', 'dashes'].
 */
export function getCompatibleUnits(inventoryUnit: string | undefined): UnitDefinition[] {
  if (!inventoryUnit) return ALL_UNITS;
  const def = getUnitDefinition(inventoryUnit);
  if (def) {
    // Return all units in the same category (e.g. all mass, all volume, or all count)
    const sameCategory = ALL_UNITS.filter(u => u.category === def.category);
    // Include other units as secondary options
    const otherUnits = ALL_UNITS.filter(u => u.category !== def.category);
    return [...sameCategory, ...otherUnits];
  }

  // Custom unit: put custom unit on top and then common units
  const customDef: UnitDefinition = {
    label: inventoryUnit,
    value: inventoryUnit,
    category: 'count',
    baseRatio: 1,
  };
  return [customDef, ...ALL_UNITS];
}

/**
 * Convert quantity from one unit to another.
 * Returns converted number, or null if incompatible categories.
 */
export function convertUnitQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number {
  if (!quantity || quantity === 0) return 0;
  const normFrom = normalizeUnit(fromUnit).toLowerCase();
  const normTo = normalizeUnit(toUnit).toLowerCase();

  if (normFrom === normTo) return quantity;

  const defFrom = getUnitDefinition(fromUnit);
  const defTo = getUnitDefinition(toUnit);

  // If both units belong to the same physical category (mass or volume), convert precisely
  if (defFrom && defTo && defFrom.category === defTo.category) {
    // Convert to base unit, then convert to target unit
    const inBase = quantity * defFrom.baseRatio;
    return inBase / defTo.baseRatio;
  }

  // Fallback: 1:1 if custom or unknown
  return quantity;
}

/**
 * Calculate the cost for a recipe ingredient row considering unit conversions.
 * E.g.
 * - Inventory: 1 kg costs ₱600
 * - Recipe: 18 g
 * - Converted: 18 g = 0.018 kg
 * - Cost = 0.018 * 600 = ₱10.80
 */
export function calculateIngredientCost(
  quantityUsed: number,
  recipeUnit: string,
  ingredient: Ingredient | undefined | null
): number {
  if (!ingredient || !quantityUsed || quantityUsed <= 0) return 0;
  const unitCost = ingredient.cost_per_unit ?? 0;
  if (unitCost <= 0) return 0;

  const invUnit = ingredient.unit || 'pcs';
  // Convert recipe quantity into inventory unit quantity
  const qtyInInventoryUnits = convertUnitQuantity(quantityUsed, recipeUnit, invUnit);
  return qtyInInventoryUnits * unitCost;
}

/**
 * Format quantity with unit nicely (e.g. "18 g", "200 ml", "1.5 kg")
 */
export function formatQuantityWithUnit(qty: number, unit: string): string {
  const formattedQty = Number.isInteger(qty) ? qty.toString() : parseFloat(qty.toFixed(3)).toString();
  return `${formattedQty} ${unit}`;
}
