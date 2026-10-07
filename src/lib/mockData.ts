// ─── Shared Mock Data for Espro POS ───

// ─── Legacy Product type (kept for backward compat with old sales) ───
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

// ─── New Recipe-Based Types ───

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock_quantity: number;
  low_stock_threshold: number;
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
  ingredient?: Ingredient; // joined data when fetching recipe
}

/** Cart item for new recipe-based sales */
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

// Categories
export const PRODUCT_CATEGORIES = ['Beverages', 'Coffee', 'Food', 'Snacks', 'Dairy', 'Condiments', 'Others'];
export const MENU_CATEGORIES = ['Beverages', 'Coffee', 'Food', 'Snacks', 'Dairy', 'Condiments', 'Others'];
export const EXPENSE_CATEGORIES = ['Utilities', 'Supplies', 'Salaries', 'Rent', 'Maintenance', 'Marketing', 'Others'];

// Products
export const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Espresso Blend', category: 'Coffee', unit: 'kg', stock: 12, threshold: 5, price: 280, sku: 'COF-ESP-001' },
  { id: 'p2', name: 'Whole Milk', category: 'Dairy', unit: 'L', stock: 45, threshold: 20, price: 95, sku: 'DAI-MLK-001' },
  { id: 'p3', name: 'Brown Sugar', category: 'Condiments', unit: 'kg', stock: 8, threshold: 10, price: 72, sku: 'CON-SGR-001' },
  { id: 'p4', name: 'Sparkling Water', category: 'Beverages', unit: 'pcs', stock: 120, threshold: 30, price: 55, sku: 'BEV-SWR-001' },
  { id: 'p5', name: 'Croissant', category: 'Food', unit: 'pcs', stock: 3, threshold: 10, price: 120, sku: 'FOD-CRS-001' },
  { id: 'p6', name: 'Almond Milk', category: 'Dairy', unit: 'L', stock: 18, threshold: 10, price: 180, sku: 'DAI-ALM-001' },
  { id: 'p7', name: 'Dark Chocolate Bar', category: 'Snacks', unit: 'pcs', stock: 32, threshold: 15, price: 95, sku: 'SNK-CHO-001' },
  { id: 'p8', name: 'Green Tea', category: 'Beverages', unit: 'pcs', stock: 5, threshold: 12, price: 65, sku: 'BEV-GTE-001' },
  { id: 'p9', name: 'Oat Bar', category: 'Snacks', unit: 'pcs', stock: 40, threshold: 20, price: 55, sku: 'SNK-OAT-001' },
  { id: 'p10', name: 'Caramel Syrup', category: 'Condiments', unit: 'bottle', stock: 7, threshold: 5, price: 220, sku: 'CON-SYR-001' },
  { id: 'p11', name: 'Vanilla Bean', category: 'Condiments', unit: 'pcs', stock: 2, threshold: 8, price: 45, sku: 'CON-VAN-001' },
  { id: 'p12', name: 'Cold Brew Concentrate', category: 'Coffee', unit: 'bottle', stock: 14, threshold: 8, price: 350, sku: 'COF-CBR-001' },
];

// Sales (last 30 days)
const now = new Date();
export const MOCK_SALES: Sale[] = [
  {
    id: 'S-0001', cashierName: 'Admin User', paymentMethod: 'cash',
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), status: 'completed',
    items: [{ product: MOCK_PRODUCTS[0], qty: 1 }, { product: MOCK_PRODUCTS[1], qty: 2 }],
    subtotal: 470, discount: 0, total: 470,
  },
  {
    id: 'S-0002', cashierName: 'Staff User', paymentMethod: 'gcash',
    createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), status: 'completed',
    items: [{ product: MOCK_PRODUCTS[3], qty: 3 }, { product: MOCK_PRODUCTS[6], qty: 1 }],
    subtotal: 260, discount: 20, total: 240,
  },
  {
    id: 'S-0003', cashierName: 'Admin User', paymentMethod: 'cash',
    createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000), status: 'completed',
    items: [{ product: MOCK_PRODUCTS[4], qty: 2 }, { product: MOCK_PRODUCTS[9], qty: 1 }],
    subtotal: 460, discount: 50, total: 410,
  },
  {
    id: 'S-0004', cashierName: 'Staff User', paymentMethod: 'cash',
    createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), status: 'completed',
    items: [{ product: MOCK_PRODUCTS[11], qty: 1 }],
    subtotal: 350, discount: 0, total: 350,
  },
  {
    id: 'S-0005', cashierName: 'Admin User', paymentMethod: 'gcash',
    createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000), status: 'voided',
    items: [{ product: MOCK_PRODUCTS[2], qty: 2 }],
    subtotal: 144, discount: 0, total: 144, voidReason: 'Customer changed order',
  },
];

// Expenses
export const MOCK_EXPENSES: Expense[] = [
  { id: 'e1', description: 'Electric bill July', amount: 8400, category: 'Utilities', date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
  { id: 'e2', description: 'Staff salaries', amount: 42000, category: 'Salaries', date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
  { id: 'e3', description: 'Coffee bean restock', amount: 15200, category: 'Supplies', date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
  { id: 'e4', description: 'Water bill', amount: 2100, category: 'Utilities', date: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
  { id: 'e5', description: 'Packaging materials', amount: 3800, category: 'Supplies', date: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
];


// Best sellers (computed)
export const BEST_SELLERS = [
  { rank: 1, product: MOCK_PRODUCTS[0], qtySold: 512, revenue: 143360, trend: 18 },
  { rank: 2, product: MOCK_PRODUCTS[11], qtySold: 428, revenue: 149800, trend: 12 },
  { rank: 3, product: MOCK_PRODUCTS[3], qtySold: 315, revenue: 17325, trend: -2 },
  { rank: 4, product: MOCK_PRODUCTS[6], qtySold: 268, revenue: 25460, trend: 5 },
];
