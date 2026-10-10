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
  cost_per_unit?: number;
  expiration_date?: string | null;
  auto_deduct_expired?: boolean;
  created_at?: string;
  updated_at?: string;
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
  ingredient?: Ingredient;
}

export interface MenuCartItem {
  menu_item_id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string | null;
  qty: number;
}

export interface Sale {
  id: string;
  items: SaleItem[] | MenuCartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'gcash';
  cashierName: string;
  createdAt: Date;
  status: 'completed' | 'voided' | 'refunded';
  voidReason?: string;
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
