# Espro POS: End-to-End Data Warehousing & ETL Pipeline Blueprint
*Technical Architecture Outline for Capstone Documentation, Lucidchart, and Draw.io*

---

## 1. HIERARCHICAL SYSTEM OUTLINE

### LAYER 1: OPERATIONAL DATA SOURCES (OLTP)
1. **POS Counter Transactions (`sales` table)**
   - Fields: `id`, `items` (JSONB), `subtotal` (Gross), `discount`, `total`, `payment_method`, `cashier_name`, `order_type`, `amount_tendered`, `change_due`, `status`, `void_reason`, `created_at`.
2. **Inventory & Batches (`ingredients`, `ingredient_batches`, `stock_movements`, `sale_batch_allocations`)**
   - Fields: `stock_quantity`, `low_stock_threshold`, `item_type` (ingredient/supply), `actual_purchase_price`, `cost_per_unit`, `expiration_date`, `received_at`, `supplier`, `status` (active/depleted/expired).
3. **Menu Master & Recipe Catalog (`menu_items`, `menu_item_sizes`, `menu_item_ingredients`, `addons`, `addon_ingredients`, `order_supply_rules`)**
   - Fields: `base_price`, `ingredient_multiplier`, `quantity_used`, `unit`, `usage_scope` (always/dine_in/takeout).
4. **Store Operating Expenses (`expenses` table)**
   - Fields: `id`, `description`, `amount`, `category`, `date`, `created_at`.
5. **Human Resources & Attendance Kiosk (`employees`, `shift_templates`, `shift_schedules`, `attendance_records`)**
   - Fields: `employee_code`, `hourly_rate`, `pin_code`, `clock_in`, `clock_out`, `total_hours`, `regular_hours`, `overtime_hours`, `late_minutes`, `status`.
6. **Authentication & Access Profiles (`profiles`, Supabase Auth `auth.users`)**
   - Fields: `id`, `name`, `email`, `role` (admin/employee), `status`.
7. **Offline Client Cache (`localStorage` Fallback)**
   - Keys: `espro_sales`, `espro_ingredients`, `espro_batches`, `espro_expenses`, `espro_attendance`.

---

### LAYER 2: ETL PROCESSING PIPELINE (Extract, Transform, Load)
1. **Extract Phase (`src/lib/db.ts`, `src/lib/employeeDb.ts`)**
   - Network loaders: `loadSales()`, `loadIngredients()`, `loadBatches()`, `loadExpenses()`, `fetchAttendanceRecords()`.
   - Fault-Tolerance: Catch network/fetch errors (`isNetworkError`) and transparently fall back to `localStorage`.
2. **Staging Area**
   - Client-side in-memory React state buffers + synchronized browser `localStorage` cache.
3. **Transform Engine (9 Core Code Transformations)**:
   - **Step 1: Unit Conversion & Normalization (`unitConversion.ts`)**
     - Normalize across mass (mg, g, kg, oz, lb), volume (ml, L, fl oz, shots, pumps, cups), count (pcs, packs, cans).
   - **Step 2: Recipe Explosion (`orderCalc.ts` `computeLine`)**
     - Multiply raw ingredient quantities by `size.ingredient_multiplier`, resolve add-on recipes, filter by `usage_scope`.
   - **Step 3: COGS Snapshot Calculation**
     - Separate ingredient COGS (`cogs_per_serving`) from supplies COGS (`cogs_supplies_per_serving`).
   - **Step 4: Order-Level Packaging Supplies (`computeOrder`)**
     - Inject packaging supply rules (takeout cups, lids, kraft bags) based on `order_type`.
   - **Step 5: Net Metric Calculation**
     - Strict Formula: `Net Sales = Subtotal (Gross) - Discount`.
   - **Step 6: Missing-Value Handling & Imputation**
     - Legacy sales missing cogs snapshot fall back to current recipe cost; missing `order_type` defaults to `dine_in`; missing tendering handled as null.
   - **Step 7: FEFO Batch Allocation & Expiration**
     - Sort batches by earliest expiration date first; deplete active batches; write off expired batches via `expire_batches`.
   - **Step 8: Cart Line Deduplication**
     - Merge duplicate line configurations via deterministic `lineKey` (`menuItem__size__addons__note`).
   - **Step 9: Local Timezone Date Normalization (`dateUtils.ts`)**
     - Align calendar boundaries to Asia/Manila (UTC+8) using `startOfDayLocal` and `toLocalNoon`.
4. **Data Quality Check (Decision Diamond)**
   - *Rules Checked*:
     - Sufficient stock available for all recipe items (`shortages.length === 0`).
     - Compatible units between recipe and inventory item.
     - Valid numbers: `qty > 0`, `gross >= 0`, `discount <= subtotal`.
     - 4-digit PIN verification for time clock attendance.
     - Sale status check: void/refund only permitted if sale is currently `completed`.
   - *IF FAIL*: **Trigger "STOP & ALERT" Routine**
     - Atomic database rollback (`RAISE EXCEPTION` in PL/pgSQL RPC).
     - UI toast alert displayed to cashier (`react-hot-toast`).
     - Visual badge alert rendered on `TopBar.tsx`.
   - *IF PASS*: Advance to Load Phase.
5. **Load Phase (Atomic PL/pgSQL RPCs in Supabase PostgreSQL)**
   - `complete_sale_with_deduction`: Single atomic transaction writes sale record, updates ingredient stock, logs batch allocations, and writes `stock_movements` audit trail.
   - `void_sale_with_restoration`: Flags sale as `voided`, restores ingredient stock, and records `void_restore` movement.
   - `restock_ingredient` and `adjust_ingredient_stock`: Atomic stock balance updates.

---

### LAYER 3: DATA WAREHOUSE & STAR SCHEMA (Logical Supabase PostgreSQL)
1. **Dimension Tables (Context)**
   - `Dim_Date`: `date_key` (YYYYMMDD), `full_date`, `day_of_week`, `month`, `quarter`, `year`.
   - `Dim_Product`: `menu_items.id`, `name`, `category`, `price`, `is_active`.
   - `Dim_Size`: `menu_item_sizes.id`, `name`, `ingredient_multiplier`.
   - `Dim_Addon`: `addons.id`, `name`, `price`.
   - `Dim_Ingredient_Supply`: `ingredients.id`, `name`, `unit`, `item_type`, `actual_purchase_price`.
   - `Dim_Employee_Cashier`: `employees.id`, `employee_code`, `name`, `role`.
   - `Dim_OrderType`: `dine_in`, `takeout`.
   - `Dim_PaymentMethod`: `cash`, `gcash`.
   - `Dim_ExpenseCategory`: `Utilities`, `Supplies`, `Salaries`, `Rent`, `Maintenance`, `Marketing`, `Others`.
   - `Dim_Batch_Supplier`: `ingredient_batches.id`, `supplier`, `received_at`, `expiration_date`.
2. **Fact Tables (Measurements)**
   - `Fact_Sales`: Transaction & line item measurements (`quantity`, `subtotal`, `discount`, `net_amount`, `cogs_amount`, `profit_amount`).
   - `Fact_Inventory_Movement`: Stock ledger transactions (`change_qty`, `type`, `reference_id`).
   - `Fact_Expenses`: Operational expenses (`amount`, `category`, `date`).
   - `Fact_Attendance`: Labor hours (`total_hours`, `regular_hours`, `overtime_hours`, `late_minutes`).
3. **Localized Data Marts**
   - **Sales Mart**: Aggregated daily/weekly/monthly revenue, order counts, average ticket, discount rate, dine-in vs takeout split.
   - **Inventory Mart**: Current stock levels, low-stock threshold alerts, spoilage rates, FEFO batch remaining, inventory valuation.
   - **Finance / Profit Mart (P&L)**: Gross sales, COGS (ingredients + supplies), Gross Profit, OPEX (expenses), Net Profit, Profit Margin %.
   - **Workforce Mart**: Staff scheduled vs actual hours, overtime expenditure, tardiness/late minutes, labor cost.

---

### LAYER 4: OLAP ENGINE & ROLE-BASED VIEWS
1. **OLAP Processing Logic (`Reports.tsx` & `Dashboard.tsx` React useMemo Engine)**
   - **Slice**: Filter data by Status (`completed`, `voided`, `refunded`) or Order Type (`dine_in`, `takeout`).
   - **Dice**: Multi-attribute combination (e.g., Date = Current Week + Category = Coffee + Payment = GCash).
   - **Roll-up**: Granular hourly orders roll up into daily sales, weekly summaries, and monthly P&L totals.
   - **Drill-down**: Click high-level revenue KPI -> inspect category -> inspect individual sale -> view line deductions.
   - **Period Comparison**: Today vs Yesterday, Current Month vs Previous Month.
2. **Role-Based Analytical Views (Enforced via `App.tsx` & `ProtectedRoute.tsx`)**
   - **Owner / Admin View (`adminOnly={true}`)**:
     - Complete Financial Reports (`/reports`), Real Net Profit, COGS breakdown, Break-even analysis, Menu recipe engineering (`/menu`), Staff wage & permissions management (`/users`, `/employees`).
     - Multi-format Export: PDF & CSV export engine (`reportExport.ts`).
   - **Store Manager / Inventory View**:
     - Inventory valuation, low-stock warnings, FEFO expiry badges (`/inventory`), Expense tracking (`/expenses`), Shift scheduling & attendance monitoring (`/employees`).
   - **Cashier / Staff View**:
     - Fast POS checkout (`/pos`), Size and Addon selection, Real-time stock shortage prevention, Receipt printing (`/pos/receipt/:id`), Dashboard daily sales KPIs (`/dashboard`), Time Clock Kiosk.

---

## 2. DIRECT CONNECTION LIST (For Draw.io / Lucidchart)

- [POS Transactions (sales)] --> [Extract Phase (db.ts loadSales)] (Raw Sales JSONB)
- [Inventory & Batches] --> [Extract Phase (db.ts loadIngredients, loadBatches)] (Stock Quantities & Batches)
- [Menu Master Data] --> [Extract Phase (db.ts loadMenuItems, loadRecipes)] (Recipe Definitions)
- [Expenses] --> [Extract Phase (db.ts loadExpenses)] (Operational Costs)
- [HR & Attendance Kiosk] --> [Extract Phase (employeeDb.ts)] (Time Clock Punches)
- [Offline Browser Cache] -.-> [Extract Phase (db.ts)] (Fallback on Network Failure)
- [Extract Phase (db.ts)] --> [Staging Area] (Extracted Datasets)
- [Staging Area] --> [Transform 1: Unit Conversion] (Raw Quantities)
- [Transform 1: Unit Conversion] --> [Transform 2: Recipe Explosion] (Normalized Units)
- [Transform 2: Recipe Explosion] --> [Transform 3: COGS Snapshot] (Effective Grams/ML)
- [Transform 3: COGS Snapshot] --> [Transform 4: Order Packaging] (Ingredient vs Supply Cost)
- [Transform 4: Order Packaging] --> [Transform 5: Net Metric Calculation] (Gross, Discount, Net)
- [Transform 5: Net Metric Calculation] --> [Transform 6: Missing-Value Handling] (Clean Financial Figures)
- [Transform 6: Missing-Value Handling] --> [Transform 7: FEFO Batch Allocation] (Allocated Batches)
- [Transform 7: FEFO Batch Allocation] --> [Transform 8: Cart Line Deduplication] (Deduplicated Lines)
- [Transform 8: Cart Line Deduplication] --> [Transform 9: Timezone Normalization] (Asia/Manila Timestamps)
- [Transform 9: Timezone Normalization] --> [Quality Check Decision Diamond] (Validated Payload)
- [Quality Check Decision Diamond] --> [STOP & ALERT Routine] (Integrity Violation / Shortage)
- [STOP & ALERT Routine] -.-> [Cashier Toast Error Alert] (User Feedback)
- [STOP & ALERT Routine] -.-> [TopBar Low-Stock Notification] (Admin Awareness)
- [Quality Check Decision Diamond] --> [Load Phase (Atomic RPCs)] (Integrity Valid PASS)
- [Load Phase (Atomic RPCs)] --> [Fact_Sales] (Atomic Sale Insert)
- [Load Phase (Atomic RPCs)] --> [Fact_Inventory_Movement] (Stock Deduction / Restock)
- [Load Phase (Atomic RPCs)] --> [Fact_Expenses] (Expense Insert)
- [Load Phase (Atomic RPCs)] --> [Fact_Attendance] (Attendance Record)
- [Dim_Product] -.-> [Fact_Sales] (Foreign Key Reference)
- [Dim_Date] -.-> [Fact_Sales] (Foreign Key Reference)
- [Dim_Employee_Cashier] -.-> [Fact_Sales] (Foreign Key Reference)
- [Fact_Sales] --> [Sales Mart] (Sales Rollup)
- [Fact_Inventory_Movement] --> [Inventory Mart] (Stock Valuation & Turnover)
- [Fact_Sales] & [Fact_Expenses] --> [Finance / Profit Mart] (P&L Computation)
- [Fact_Attendance] --> [Workforce Mart] (Labor Hours & Overtime)
- [Sales Mart] & [Inventory Mart] & [Finance / Profit Mart] --> [OLAP Analytical Engine] (Aggregated Metrics)
- [OLAP Analytical Engine] --> [Owner / Admin View] (Executive P&L & Reports)
- [OLAP Analytical Engine] --> [Store Manager / Inventory View] (Stock & Cost Management)
- [OLAP Analytical Engine] --> [Cashier / Staff View] (POS & Operational KPIs)
