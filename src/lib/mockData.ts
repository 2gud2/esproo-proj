// ─── Shared Types for Espro POS ───

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  threshold: number;
  price: number;
  sku: string;
  image?: string;
}

export interface SaleItem {
  product: Product;
  qty: number;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock_quantity: number;
  low_stock_threshold: number;
  item_type?: 'ingredient' | 'supply';
  cost_per_unit?: number;
  expiration_date?: string | null;
  auto_deduct_expired?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface IngredientBatch {
  id: string;
  ingredient_id: string;
  quantity_received: number;
  quantity_remaining: number;
  cost_per_unit: number;
  received_at: string; // 'YYYY-MM-DD'
  expiration_date?: string | null;
  supplier?: string | null;
  note?: string | null;
  status: 'active' | 'depleted' | 'expired';
  created_at?: string;
}

export interface MenuItemSize {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  ingredient_multiplier: number;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MenuItemIngredient {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity_used: number;
  unit: string;
  size_id?: string | null;
  usage_scope?: 'always' | 'takeout' | 'dine_in';
  ingredient?: Ingredient;
}

export interface AddonItem {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  applies_to_categories: string[];
  applies_to_items: string[];
  created_at?: string;
}

export interface AddonIngredient {
  id: string;
  addon_id: string;
  ingredient_id: string;
  quantity_used: number;
  unit: string;
  ingredient?: Ingredient;
  created_at?: string;
}

export interface OrderSupplyRule {
  id: string;
  ingredient_id: string;
  quantity_used: number;
  unit: string;
  order_type: 'takeout' | 'dine_in' | 'all';
  is_active: boolean;
  ingredient?: Ingredient;
  created_at?: string;
}

export interface MenuCartItem {
  menu_item_id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string | null;
  qty: number;
}

export interface CartLineAddon {
  addon_id: string;
  name: string;
  price: number;
  qty: number;
}

export interface CartLine {
  line_id: string;
  menu_item_id: string;
  name: string;
  category: string;
  image_url?: string | null;
  qty: number;
  size_id?: string | null;
  size_name?: string | null;
  base_price: number;
  unit_price: number;
  price: number; // unit_price incl addons for backward compatibility
  addons: CartLineAddon[];
  note?: string | null;
  cogs_per_serving: number;
  cogs_supplies_per_serving: number;
  deductions: Array<{ ingredient_id: string; quantity: number }>;
}

export interface Sale {
  id: string;
  items: SaleItem[] | MenuCartItem[] | CartLine[] | any[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'gcash';
  cashierName: string;
  createdAt: Date;
  status: 'completed' | 'voided' | 'refunded';
  voidReason?: string;
  orderType?: 'dine_in' | 'takeout';
  orderDeductions?: Array<{ ingredient_id: string; quantity: number }>;
  orderSuppliesCogs?: number;
  amountTendered?: number | null;
  changeDue?: number | null;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  status: 'active' | 'disabled';
  createdAt: Date;
}

// Default Categories (No mock data)
export const PRODUCT_CATEGORIES = ['Beverages', 'Coffee', 'Food', 'Snacks', 'Dairy'];
export const MENU_CATEGORIES = ['Beverages', 'Coffee', 'Food', 'Snacks', 'Dairy'];
export const EXPENSE_CATEGORIES = ['Utilities', 'Supplies', 'Salaries', 'Rent', 'Maintenance', 'Marketing', 'Others'];

// Empty initial datasets (Mock data cleared per user request)
export const MOCK_PRODUCTS: Product[] = [];
export const MOCK_SALES: Sale[] = [];
export const MOCK_EXPENSES: Expense[] = [];
export const BEST_SELLERS: any[] = [];
