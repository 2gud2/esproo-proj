import type { Ingredient } from './mockData';

export type ExpirationStatus = 'none' | 'good' | 'near_expiry' | 'expired_today' | 'expired';

export interface ExpirationInfo {
  status: ExpirationStatus;
  label: string;
  daysLeft: number | null;
}

/**
 * Checks if an ingredient is completely out of stock (stock <= 0).
 */
export function isOutOfStock(ing: Pick<Ingredient, 'stock_quantity'> | null | undefined): boolean {
  if (!ing) return false;
  return Number(ing.stock_quantity ?? 0) <= 0;
}

/**
 * Checks if an ingredient is low in stock (stock > 0 && stock <= threshold).
 */
export function isLowStock(ing: Pick<Ingredient, 'stock_quantity' | 'low_stock_threshold'> | null | undefined): boolean {
  if (!ing) return false;
  const stock = Number(ing.stock_quantity ?? 0);
  const threshold = Number(ing.low_stock_threshold ?? 10);
  return stock > 0 && stock <= threshold;
}

/**
 * Computes expiration metadata and normalized status for a given expiration date string.
 * Statuses: 'none' | 'good' | 'near_expiry' | 'expired_today' | 'expired'
 */
export function getExpirationInfo(expirationDate?: string | null): ExpirationInfo {
  if (!expirationDate) return { status: 'none', label: '', daysLeft: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate + 'T00:00:00');
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'expired', label: `Expired ${Math.abs(diffDays)}d ago`, daysLeft: diffDays };
  } else if (diffDays === 0) {
    return { status: 'expired_today', label: 'Expires Today', daysLeft: 0 };
  } else if (diffDays <= 7) {
    return { status: 'near_expiry', label: `Expires in ${diffDays}d`, daysLeft: diffDays };
  } else {
    return { status: 'good', label: `Exp: ${expirationDate}`, daysLeft: diffDays };
  }
}
