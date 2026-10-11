import type { Ingredient } from './mockData';
import type { RecipeEditorRow } from '../components/Menu/RecipeEditor';

/**
 * Normalizes a text string by removing spaces, dashes, underscores, and punctuation.
 */
export function normalizeToken(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Looks through supply-type inventory items for names containing matching tokens
 * from the size name (e.g. "16oz", "12 oz", "Large").
 */
export function findSupplySuggestions(
  sizeName: string,
  supplyItems: Ingredient[]
): Ingredient[] {
  if (!sizeName || !sizeName.trim()) return [];
  const raw = sizeName.trim().toLowerCase();
  const normalizedSize = normalizeToken(raw);

  if (normalizedSize.length < 2) return [];

  // Check for ounce pattern e.g. "16oz", "16 oz", "16"
  const ozMatch = raw.match(/(\d+)\s*(oz|ml|l|g)?/);
  const ozNum = ozMatch ? ozMatch[1] : null;

  return supplyItems.filter((item) => {
    const itemNameNorm = normalizeToken(item.name);

    // 1. Exact substring match on normalized string
    if (itemNameNorm.includes(normalizedSize)) {
      return true;
    }

    // 2. If size specifies ounces (e.g. "16" or "16oz"), match "{num}oz" or "{num}"
    if (ozNum) {
      if (itemNameNorm.includes(`${ozNum}oz`)) {
        return true;
      }
    }

    // 3. Word token matching for sizes with multiple words or descriptive names
    const sizeWords = raw.split(/[\s\-_/]+/).filter((w) => w.length >= 3);
    for (const word of sizeWords) {
      const normWord = normalizeToken(word);
      if (normWord.length >= 3 && itemNameNorm.includes(normWord)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Evaluates suggestions for a size:
 * - If exactly one match: confident match (auto-selectable)
 * - If multiple: array of suggestion chips
 * - If none: empty
 */
export function evaluateSupplyMatch(
  sizeName: string,
  supplyItems: Ingredient[]
): {
  confidentMatch: Ingredient | null;
  suggestions: Ingredient[];
} {
  const matches = findSupplySuggestions(sizeName, supplyItems);
  if (matches.length === 1) {
    return { confidentMatch: matches[0], suggestions: matches };
  }
  return { confidentMatch: null, suggestions: matches };
}

/**
 * Helper to construct a supply recipe row for a size or shared (sizeId = null).
 */
export function createSupplyRow(
  sizeId: string | null,
  ingredient: Ingredient | null,
  scope: 'always' | 'takeout' | 'dine_in' = 'always'
): RecipeEditorRow {
  return {
    ingredient_id: ingredient ? ingredient.id : '',
    quantity_used: '1',
    unit: ingredient?.unit || 'pcs',
    size_id: sizeId,
    usage_scope: scope,
  };
}
