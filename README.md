# Espro POS — Retail & Cafe Operations Hub

Espro POS is a modern Point-of-Sale, Recipe Management, and Inventory/Expense tracking application engineered for cafes, coffee shops, and retail operations. Built with **React 19**, **TypeScript**, **Vite**, **Framer Motion**, and **Supabase**.

---

## 🚀 Features

- **Point of Sale (POS):** Fast ordering grid, dynamic recipe-based stock availability checking, discount calculations (fixed & percentage), and instant receipt generation.
- **Recipe Management & COGS Calculation:** Recipe builder with universal unit conversions (mass, volume, discrete count) and real-time cost-of-goods-sold (COGS) tracking.
- **Inventory & Auto Deductions:** Automated ingredient stock deductions per sale, low stock threshold monitoring, and expiration tracking with near-expiry alerts.
- **Expense Tracking:** Granular operational expense logging with category filtering, payment records, and receipt verification.
- **Financial Analytics & Reports:** Real-time dashboards, net profit & margin calculations, sales timelines, top-seller analytics, and printable financial statements.
- **Role-Based Access Control:** Secure Admin vs. Employee roles with protected routes and user management.
- **Responsive Mobile Navigation:** Full mobile support with hamburger drawer and quick-access topbar notifications.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Framer Motion, Lucide Icons, React Hot Toast
- **Backend / Database:** Supabase (PostgreSQL, Row-Level Security, Edge Functions)
- **Styling:** Custom CSS Design System with theme variables and responsive breakpoints

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory with the following configuration:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Optional: Supabase Service Role (For local admin/user management & Edge functions)
VITE_SUPABASE_SERVICE_ROLE=your-service-role-key
```

---

## 🗄️ Database Setup & Migrations

To set up the database schema and security policies, run the SQL migrations in the **Supabase SQL Editor** in the following exact order:

1. `supabase_schema.sql` — Core tables (profiles, products, categories, sales, expenses) and initial indexes.
2. `supabase_recipe_schema.sql` — Recipe tables (`ingredients`, `menu_items`, `menu_item_ingredients`, `recipe_deductions`).
3. `supabase_migration_v3.sql` — Sales JSON deduction structures, updated transaction logs, and void restoration functions.
4. `supabase_security.sql` — Row Level Security (RLS) policies, secure role checks, and database hardening.

---

## ⚡ Edge Function Deployment (`admin-users`)

The `admin-users` function manages staff accounts with administrative privileges.

### Prerequisites:
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed.
- Logged in via `supabase login`.
- Linked project via `supabase link --project-ref your-project-id`.

### Deployment:
```bash
supabase functions deploy admin-users
```

---

## 💻 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Lint Code
```bash
npm run lint
```

### 4. Build for Production
```bash
npm run build
```

---

## 👥 Default Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin@espro.ph` | `admin123` |
| **Staff / Cashier** | `staff@espro.ph` | `staff123` |
