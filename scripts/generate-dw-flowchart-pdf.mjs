// ─── Espro POS: Data Warehousing & ETL Pipeline Architecture PDF Generator ───
// Generates:
// 1. /docs/Espro_Data_Pipeline_Architecture.pdf (Landscape A4, 6 pages)
// 2. /docs/espro_data_pipeline_flowchart.png (High-res PNG diagram)
// 3. /docs/espro_data_pipeline_flowchart.mmd (Mermaid diagram source)
// 4. /docs/espro_data_pipeline_blueprint.md (Hierarchical text blueprint)

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

// Helper to find Chrome or Edge executable on Windows
function getBrowserExecutablePath() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const docsDir = path.resolve('docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. MERMAID FLOWCHART SOURCE EXPORT (.mmd)
// ══════════════════════════════════════════════════════════════════════════════
const mermaidFlowchart = `%% Espro POS: End-to-End Data Warehousing & ETL Pipeline Architecture
%% Generated for Capstone Project - Based 100% on actual Espro POS codebase

graph TD
  %% STYLING AND CLASSES
  classDef sourceLayer fill:#F3E9D7,stroke:#7A4A2B,stroke-width:2px,color:#2B1D16;
  classDef etlLayer fill:#FFF8EE,stroke:#C08F5E,stroke-width:2px,color:#2B1D16;
  classDef dwLayer fill:#EDE3D2,stroke:#7A4A2B,stroke-width:2px,color:#2B1D16;
  classDef olapLayer fill:#EBF3ED,stroke:#2E7D32,stroke-width:2px,color:#1B5E20;
  classDef alertBox fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#B71C1C;
  classDef decisionDiamond fill:#FFF3E0,stroke:#E65100,stroke-width:2px,color:#BF360C;

  subgraph LAYER_1 ["LAYER 1: OPERATIONAL DATA SOURCES (OLTP)"]
    direction TB
    S1["POS Transactions (sales table)<br/>• items JSONB, subtotal, discount, total<br/>• payment_method, cashier_name, order_type"]:::sourceLayer
    S2["Inventory & Batches<br/>• ingredients (stock_quantity, unit, cost)<br/>• ingredient_batches (FEFO expiry, supplier)<br/>• stock_movements & sale_batch_allocations"]:::sourceLayer
    S3["Menu & Recipe Master Data<br/>• menu_items & menu_item_sizes (multiplier)<br/>• menu_item_ingredients (usage_scope)<br/>• addons, addon_ingredients, order_supply_rules"]:::sourceLayer
    S4["Expenses (expenses table)<br/>• amount, category, date, description"]:::sourceLayer
    S5["HR & Attendance Kiosk<br/>• employees (code, hourly_rate, pin_code)<br/>• shift_templates & shift_schedules<br/>• attendance_records (clock_in/out, hours)"]:::sourceLayer
    S6["Auth & Profiles<br/>• profiles (name, role: admin/employee)<br/>• Supabase Auth users"]:::sourceLayer
    S7["Offline Browser Cache<br/>• localStorage fallback (espro_* keys)"]:::sourceLayer
  end

  subgraph LAYER_2 ["LAYER 2: ETL PROCESSING PIPELINE (db.ts, orderCalc.ts, unitConversion.ts)"]
    direction TB
    E1["EXTRACT PHASE (db.ts)<br/>• loadSales, loadIngredients, loadBatches<br/>• loadExpenses, fetchAttendanceRecords<br/>• Fallback to localStorage on network error"]:::etlLayer
    STG["STAGING BUFFER<br/>• In-memory React State hooks<br/>• Synchronized localStorage client staging"]:::etlLayer
    
    subgraph TRANSFORM_STEPS ["TRANSFORMATION ENGINE (Pure Logic Modules)"]
      direction TB
      T1["1. Unit Conversion (unitConversion.ts)<br/>Normalize g/kg/ml/L/shots/pumps/pcs"]:::etlLayer
      T2["2. Recipe Explosion (orderCalc.ts computeLine)<br/>Apply size multiplier, addon recipes, usage_scope"]:::etlLayer
      T3["3. COGS Snapshot Calculation<br/>Ingredients COGS vs Packaging Supplies COGS"]:::etlLayer
      T4["4. Order Packaging Rules (computeOrder)<br/>Evaluate takeout cup/lid/bag rules"]:::etlLayer
      T5["5. Net Metric Calculation<br/>Net Sales = Subtotal (Gross) - Discount"]:::etlLayer
      T6["6. Missing-Value Imputation<br/>Legacy sales recipe cost fallback, default dine_in"]:::etlLayer
      T7["7. FEFO Batch Sorting & Expiry<br/>Sort earliest expiration first, expire_batches"]:::etlLayer
      T8["8. Cart Line Deduplication<br/>Deterministic lineKey merging"]:::etlLayer
      T9["9. Local Timezone Normalization (dateUtils.ts)<br/>Asia/Manila UTC+8 day boundaries"]:::etlLayer
    end

    QC{"QUALITY CHECK & INTEGRITY VALIDATION<br/>• Sufficient Stock? (shortages.length == 0)<br/>• Unit Compatibility Valid?<br/>• Qty > 0 and Discount <= Subtotal?<br/>• Time Clock PIN Valid?<br/>• Sale Status == 'completed' for Voids?"}:::decisionDiamond

    ALERT["STOP & ALERT ROUTINE<br/>• Transaction Rolled Back (Atomic RPC Exception)<br/>• Toast Error Notification (react-hot-toast)<br/>• TopBar Low-Stock & Near-Expiry Badge Alert"]:::alertBox

    LOAD["LOAD PHASE (Atomic PL/pgSQL RPCs)<br/>• complete_sale_with_deduction<br/>• void_sale_with_restoration<br/>• restock_ingredient & adjust_ingredient_stock"]:::etlLayer
  end

  subgraph LAYER_3 ["LAYER 3: DATA WAREHOUSE & STAR SCHEMA (Supabase PostgreSQL)"]
    direction TB
    subgraph DIMS ["DIMENSION TABLES"]
      D1["Dim_Date (date_key, full_date, day, week, month, year)"]:::dwLayer
      D2["Dim_Product (menu_items.id, name, category, price)"]:::dwLayer
      D3["Dim_Size (menu_item_sizes.id, multiplier)"]:::dwLayer
      D4["Dim_Addon (addons.id, name, price)"]:::dwLayer
      D5["Dim_Ingredient_Supply (ingredients.id, unit, actual_cost)"]:::dwLayer
      D6["Dim_Employee_Cashier (employees.id, code, name, role)"]:::dwLayer
      D7["Dim_OrderType (dine_in / takeout)"]:::dwLayer
      D8["Dim_PaymentMethod (cash / gcash)"]:::dwLayer
      D9["Dim_ExpenseCategory (Utilities, Rent, Supplies...)"]:::dwLayer
      D10["Dim_Batch_Supplier (ingredient_batches.id, supplier)"]:::dwLayer
    end

    subgraph FACTS ["FACT TABLES"]
      F1["Fact_Sales (Grain: Line Item / Sale)<br/>Metrics: Qty, Gross, Discount, Net Sales, COGS, Profit"]:::dwLayer
      F2["Fact_Inventory_Movement (stock_movements)<br/>Metrics: change_qty, type, reference_id"]:::dwLayer
      F3["Fact_Expenses (expenses table)<br/>Metrics: expense amount, date"]:::dwLayer
      F4["Fact_Attendance (attendance_records)<br/>Metrics: total_hours, regular_hours, overtime, late_mins"]:::dwLayer
    end

    subgraph MARTS ["LOCALIZED DATA MARTS"]
      M1["Sales Mart (Daily/Weekly/Monthly Revenue, Ticket Size)"]:::dwLayer
      M2["Inventory Mart (Stock Valuation, Spoilage, Turnover, FEFO)"]:::dwLayer
      M3["Finance / Profit Mart (Gross Margin, COGS, OPEX, P&L Net Profit)"]:::dwLayer
      M4["Workforce Mart (Labor Hours, Overtime Cost, Tardiness)"]:::dwLayer
    end
  end

  subgraph LAYER_4 ["LAYER 4: OLAP ENGINE & STAKEHOLDER VIEWS"]
    direction TB
    OLAP["OLAP PROCESSING LOGIC (Reports.tsx useMemo & PostgREST)<br/>• Slice: Filter by Status, Order Type<br/>• Dice: Date Range + Category + Cashier<br/>• Roll-up: Hourly -> Daily -> Weekly -> Monthly<br/>• Drill-down: Total Sales -> Category -> Sale Receipt -> Line Deductions<br/>• Period Comparison: Today vs Yesterday, MTD vs Last Month"]:::olapLayer

    V1["OWNER / ADMIN VIEW (App.tsx ProtectedRoute adminOnly)<br/>• Financial Reports, Real Net Profit & P&L<br/>• COGS margin breakdown & break-even analysis<br/>• Multi-format Export: PDF & CSV (reportExport.ts)"]:::olapLayer
    V2["STORE MANAGER / INVENTORY VIEW<br/>• Stock Valuation, Low-Stock & Expiry Banners<br/>• FEFO Batches, Expenses & OPEX oversight<br/>• Staff Shift Scheduling & Attendance Oversight"]:::olapLayer
    V3["CASHIER / STAFF VIEW<br/>• Rapid POS Counter Checkout & Receipt Printing<br/>• Real-time stock shortage prevention<br/>• Daily Sales KPI Cards & Time Clock Punch"]:::olapLayer
  end

  %% DATA FLOW CONNECTIONS
  S1 -->|Raw Sale JSONB| E1
  S2 -->|Raw Stock & Batches| E1
  S3 -->|Recipes & Multipliers| E1
  S4 -->|Operational Expenses| E1
  S5 -->|Clock In/Out Punches| E1
  S6 -->|User Credentials & Roles| E1
  S7 -.->|Offline Sync Fallback| E1

  E1 -->|Extracted Records| STG
  STG -->|Raw Cart & State| T1
  T1 --> T2 --> T3 --> T4 --> T5 --> T6 --> T7 --> T8 --> T9
  T9 -->|Transformed Payload| QC

  QC -->|Integrity Failure / Shortage| ALERT
  ALERT -.->|Cancel & Notify| S1
  ALERT -.->|Cancel & Notify| S7

  QC -->|Integrity Valid (PASS)| LOAD
  LOAD -->|Atomic Commit| F1
  LOAD -->|Atomic Commit| F2
  LOAD -->|Insert Expenses| F3
  LOAD -->|Insert Attendance| F4

  D1 -.-> F1
  D2 -.-> F1
  D3 -.-> F1
  D4 -.-> F1
  D5 -.-> F2
  D6 -.-> F1
  D6 -.-> F4
  D7 -.-> F1
  D8 -.-> F1
  D9 -.-> F3
  D10 -.-> F2

  F1 --> M1
  F2 --> M2
  F1 & F2 & F3 --> M3
  F4 --> M4

  M1 & M2 & M3 & M4 --> OLAP
  OLAP --> V1
  OLAP --> V2
  OLAP --> V3
`;

fs.writeFileSync(path.join(docsDir, 'espro_data_pipeline_flowchart.mmd'), mermaidFlowchart, 'utf-8');

// ══════════════════════════════════════════════════════════════════════════════
// 2. TEXT FORMAT BLUEPRINT EXPORT (.md)
// ══════════════════════════════════════════════════════════════════════════════
const textBlueprint = `# Espro POS: End-to-End Data Warehousing & ETL Pipeline Blueprint
*Technical Architecture Outline for Capstone Documentation, Lucidchart, and Draw.io*

---

## 1. HIERARCHICAL SYSTEM OUTLINE

### LAYER 1: OPERATIONAL DATA SOURCES (OLTP)
1. **POS Counter Transactions (\`sales\` table)**
   - Fields: \`id\`, \`items\` (JSONB), \`subtotal\` (Gross), \`discount\`, \`total\`, \`payment_method\`, \`cashier_name\`, \`order_type\`, \`amount_tendered\`, \`change_due\`, \`status\`, \`void_reason\`, \`created_at\`.
2. **Inventory & Batches (\`ingredients\`, \`ingredient_batches\`, \`stock_movements\`, \`sale_batch_allocations\`)**
   - Fields: \`stock_quantity\`, \`low_stock_threshold\`, \`item_type\` (ingredient/supply), \`actual_purchase_price\`, \`cost_per_unit\`, \`expiration_date\`, \`received_at\`, \`supplier\`, \`status\` (active/depleted/expired).
3. **Menu Master & Recipe Catalog (\`menu_items\`, \`menu_item_sizes\`, \`menu_item_ingredients\`, \`addons\`, \`addon_ingredients\`, \`order_supply_rules\`)**
   - Fields: \`base_price\`, \`ingredient_multiplier\`, \`quantity_used\`, \`unit\`, \`usage_scope\` (always/dine_in/takeout).
4. **Store Operating Expenses (\`expenses\` table)**
   - Fields: \`id\`, \`description\`, \`amount\`, \`category\`, \`date\`, \`created_at\`.
5. **Human Resources & Attendance Kiosk (\`employees\`, \`shift_templates\`, \`shift_schedules\`, \`attendance_records\`)**
   - Fields: \`employee_code\`, \`hourly_rate\`, \`pin_code\`, \`clock_in\`, \`clock_out\`, \`total_hours\`, \`regular_hours\`, \`overtime_hours\`, \`late_minutes\`, \`status\`.
6. **Authentication & Access Profiles (\`profiles\`, Supabase Auth \`auth.users\`)**
   - Fields: \`id\`, \`name\`, \`email\`, \`role\` (admin/employee), \`status\`.
7. **Offline Client Cache (\`localStorage\` Fallback)**
   - Keys: \`espro_sales\`, \`espro_ingredients\`, \`espro_batches\`, \`espro_expenses\`, \`espro_attendance\`.

---

### LAYER 2: ETL PROCESSING PIPELINE (Extract, Transform, Load)
1. **Extract Phase (\`src/lib/db.ts\`, \`src/lib/employeeDb.ts\`)**
   - Network loaders: \`loadSales()\`, \`loadIngredients()\`, \`loadBatches()\`, \`loadExpenses()\`, \`fetchAttendanceRecords()\`.
   - Fault-Tolerance: Catch network/fetch errors (\`isNetworkError\`) and transparently fall back to \`localStorage\`.
2. **Staging Area**
   - Client-side in-memory React state buffers + synchronized browser \`localStorage\` cache.
3. **Transform Engine (9 Core Code Transformations)**:
   - **Step 1: Unit Conversion & Normalization (\`unitConversion.ts\`)**
     - Normalize across mass (mg, g, kg, oz, lb), volume (ml, L, fl oz, shots, pumps, cups), count (pcs, packs, cans).
   - **Step 2: Recipe Explosion (\`orderCalc.ts\` \`computeLine\`)**
     - Multiply raw ingredient quantities by \`size.ingredient_multiplier\`, resolve add-on recipes, filter by \`usage_scope\`.
   - **Step 3: COGS Snapshot Calculation**
     - Separate ingredient COGS (\`cogs_per_serving\`) from supplies COGS (\`cogs_supplies_per_serving\`).
   - **Step 4: Order-Level Packaging Supplies (\`computeOrder\`)**
     - Inject packaging supply rules (takeout cups, lids, kraft bags) based on \`order_type\`.
   - **Step 5: Net Metric Calculation**
     - Strict Formula: \`Net Sales = Subtotal (Gross) - Discount\`.
   - **Step 6: Missing-Value Handling & Imputation**
     - Legacy sales missing cogs snapshot fall back to current recipe cost; missing \`order_type\` defaults to \`dine_in\`; missing tendering handled as null.
   - **Step 7: FEFO Batch Allocation & Expiration**
     - Sort batches by earliest expiration date first; deplete active batches; write off expired batches via \`expire_batches\`.
   - **Step 8: Cart Line Deduplication**
     - Merge duplicate line configurations via deterministic \`lineKey\` (\`menuItem__size__addons__note\`).
   - **Step 9: Local Timezone Date Normalization (\`dateUtils.ts\`)**
     - Align calendar boundaries to Asia/Manila (UTC+8) using \`startOfDayLocal\` and \`toLocalNoon\`.
4. **Data Quality Check (Decision Diamond)**
   - *Rules Checked*:
     - Sufficient stock available for all recipe items (\`shortages.length === 0\`).
     - Compatible units between recipe and inventory item.
     - Valid numbers: \`qty > 0\`, \`gross >= 0\`, \`discount <= subtotal\`.
     - 4-digit PIN verification for time clock attendance.
     - Sale status check: void/refund only permitted if sale is currently \`completed\`.
   - *IF FAIL*: **Trigger "STOP & ALERT" Routine**
     - Atomic database rollback (\`RAISE EXCEPTION\` in PL/pgSQL RPC).
     - UI toast alert displayed to cashier (\`react-hot-toast\`).
     - Visual badge alert rendered on \`TopBar.tsx\`.
   - *IF PASS*: Advance to Load Phase.
5. **Load Phase (Atomic PL/pgSQL RPCs in Supabase PostgreSQL)**
   - \`complete_sale_with_deduction\`: Single atomic transaction writes sale record, updates ingredient stock, logs batch allocations, and writes \`stock_movements\` audit trail.
   - \`void_sale_with_restoration\`: Flags sale as \`voided\`, restores ingredient stock, and records \`void_restore\` movement.
   - \`restock_ingredient\` and \`adjust_ingredient_stock\`: Atomic stock balance updates.

---

### LAYER 3: DATA WAREHOUSE & STAR SCHEMA (Logical Supabase PostgreSQL)
1. **Dimension Tables (Context)**
   - \`Dim_Date\`: \`date_key\` (YYYYMMDD), \`full_date\`, \`day_of_week\`, \`month\`, \`quarter\`, \`year\`.
   - \`Dim_Product\`: \`menu_items.id\`, \`name\`, \`category\`, \`price\`, \`is_active\`.
   - \`Dim_Size\`: \`menu_item_sizes.id\`, \`name\`, \`ingredient_multiplier\`.
   - \`Dim_Addon\`: \`addons.id\`, \`name\`, \`price\`.
   - \`Dim_Ingredient_Supply\`: \`ingredients.id\`, \`name\`, \`unit\`, \`item_type\`, \`actual_purchase_price\`.
   - \`Dim_Employee_Cashier\`: \`employees.id\`, \`employee_code\`, \`name\`, \`role\`.
   - \`Dim_OrderType\`: \`dine_in\`, \`takeout\`.
   - \`Dim_PaymentMethod\`: \`cash\`, \`gcash\`.
   - \`Dim_ExpenseCategory\`: \`Utilities\`, \`Supplies\`, \`Salaries\`, \`Rent\`, \`Maintenance\`, \`Marketing\`, \`Others\`.
   - \`Dim_Batch_Supplier\`: \`ingredient_batches.id\`, \`supplier\`, \`received_at\`, \`expiration_date\`.
2. **Fact Tables (Measurements)**
   - \`Fact_Sales\`: Transaction & line item measurements (\`quantity\`, \`subtotal\`, \`discount\`, \`net_amount\`, \`cogs_amount\`, \`profit_amount\`).
   - \`Fact_Inventory_Movement\`: Stock ledger transactions (\`change_qty\`, \`type\`, \`reference_id\`).
   - \`Fact_Expenses\`: Operational expenses (\`amount\`, \`category\`, \`date\`).
   - \`Fact_Attendance\`: Labor hours (\`total_hours\`, \`regular_hours\`, \`overtime_hours\`, \`late_minutes\`).
3. **Localized Data Marts**
   - **Sales Mart**: Aggregated daily/weekly/monthly revenue, order counts, average ticket, discount rate, dine-in vs takeout split.
   - **Inventory Mart**: Current stock levels, low-stock threshold alerts, spoilage rates, FEFO batch remaining, inventory valuation.
   - **Finance / Profit Mart (P&L)**: Gross sales, COGS (ingredients + supplies), Gross Profit, OPEX (expenses), Net Profit, Profit Margin %.
   - **Workforce Mart**: Staff scheduled vs actual hours, overtime expenditure, tardiness/late minutes, labor cost.

---

### LAYER 4: OLAP ENGINE & ROLE-BASED VIEWS
1. **OLAP Processing Logic (\`Reports.tsx\` & \`Dashboard.tsx\` React useMemo Engine)**
   - **Slice**: Filter data by Status (\`completed\`, \`voided\`, \`refunded\`) or Order Type (\`dine_in\`, \`takeout\`).
   - **Dice**: Multi-attribute combination (e.g., Date = Current Week + Category = Coffee + Payment = GCash).
   - **Roll-up**: Granular hourly orders roll up into daily sales, weekly summaries, and monthly P&L totals.
   - **Drill-down**: Click high-level revenue KPI -> inspect category -> inspect individual sale -> view line deductions.
   - **Period Comparison**: Today vs Yesterday, Current Month vs Previous Month.
2. **Role-Based Analytical Views (Enforced via \`App.tsx\` & \`ProtectedRoute.tsx\`)**
   - **Owner / Admin View (\`adminOnly={true}\`)**:
     - Complete Financial Reports (\`/reports\`), Real Net Profit, COGS breakdown, Break-even analysis, Menu recipe engineering (\`/menu\`), Staff wage & permissions management (\`/users\`, \`/employees\`).
     - Multi-format Export: PDF & CSV export engine (\`reportExport.ts\`).
   - **Store Manager / Inventory View**:
     - Inventory valuation, low-stock warnings, FEFO expiry badges (\`/inventory\`), Expense tracking (\`/expenses\`), Shift scheduling & attendance monitoring (\`/employees\`).
   - **Cashier / Staff View**:
     - Fast POS checkout (\`/pos\`), Size and Addon selection, Real-time stock shortage prevention, Receipt printing (\`/pos/receipt/:id\`), Dashboard daily sales KPIs (\`/dashboard\`), Time Clock Kiosk.

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
`;

fs.writeFileSync(path.join(docsDir, 'espro_data_pipeline_blueprint.md'), textBlueprint, 'utf-8');

// ══════════════════════════════════════════════════════════════════════════════
// 3. MERMAID STAR SCHEMA SOURCE EXPORT (.mmd)
// ══════════════════════════════════════════════════════════════════════════════
const mermaidStarSchema = `%% Espro POS: Multi-Dimensional Star Schema Architecture
%% Centered on Fact_Sales with surrounding Dimensions and Satellite Facts

erDiagram
  FACT_SALES {
    text sale_id PK "UUID or String"
    date date_key FK "Date of transaction (local)"
    uuid menu_item_id FK "References menu_items.id"
    uuid size_id FK "References menu_item_sizes.id"
    uuid employee_id FK "Cashier / Staff identifier"
    text order_type "dine_in | takeout"
    text payment_method "cash | gcash"
    text status "completed | voided | refunded"
    numeric quantity "Units sold"
    numeric unit_price "Base price + addon charges"
    numeric gross_amount "Subtotal before discount"
    numeric discount_amount "Discount subtracted"
    numeric net_amount "Gross Amount - Discounts"
    numeric cogs_ingredients "Raw ingredient cost"
    numeric cogs_supplies "Cup, lid, packaging cost"
    numeric total_cogs "Ingredients + Supplies COGS"
    numeric gross_profit "Net Amount - Total COGS"
  }

  DIM_DATE {
    date date_key PK "YYYY-MM-DD"
    int year "Calendar Year"
    int month "1 to 12"
    text month_name "January, February..."
    int day "1 to 31"
    text day_name "Monday, Tuesday..."
    int week_number "1 to 52"
    boolean is_weekend "True if Sat/Sun"
  }

  DIM_PRODUCT {
    uuid menu_item_id PK "menu_items.id"
    text name "Item Name (e.g. Caffe Latte)"
    text category "Coffee, Beverages, Food..."
    numeric base_price "Standard retail price"
    boolean is_active "True if currently sold"
  }

  DIM_SIZE {
    uuid size_id PK "menu_item_sizes.id"
    uuid menu_item_id FK "Parent product"
    text size_name "Small, Medium, Large"
    numeric price_override "Size specific price"
    numeric ingredient_multiplier "Recipe scaling (e.g. 1.25x)"
  }

  DIM_EMPLOYEE_CASHIER {
    uuid employee_id PK "employees.id"
    varchar employee_code "BAR-001, CSH-002"
    varchar name "Staff Member Name"
    varchar role "Store Manager, Barista, Cashier"
    numeric hourly_rate "Base wage rate"
    boolean has_system_access "Login permission"
  }

  DIM_ORDER_TYPE {
    text order_type PK "dine_in | takeout"
    text packaging_rule "Apply packaging supply rules if takeout"
  }

  DIM_PAYMENT_METHOD {
    text payment_method PK "cash | gcash"
    text reconciliation_type "Drawer Cash vs E-Wallet Reference"
  }

  FACT_INVENTORY_MOVEMENT {
    uuid movement_id PK "stock_movements.id"
    uuid ingredient_id FK "ingredients.id"
    numeric change_qty "Quantity changed (+/-)"
    text type "sale | void_restore | restock | spoilage"
    text reason "Audit explanation"
    text reference_id "Linked sale_id or batch_id"
    timestamptz created_at "Timestamp"
  }

  DIM_INGREDIENT_SUPPLY {
    uuid ingredient_id PK "ingredients.id"
    text name "Ingredient / Item Name"
    text unit "g, ml, pcs, shots, pumps"
    text item_type "ingredient | supply"
    numeric stock_quantity "Current on-hand stock"
    numeric low_stock_threshold "Reorder warning level"
    numeric cost_per_unit "Standard unit cost"
    numeric actual_purchase_price "Invoice purchase price"
  }

  DIM_BATCH {
    uuid batch_id PK "ingredient_batches.id"
    uuid ingredient_id FK "ingredients.id"
    numeric quantity_received "Initial stock"
    numeric quantity_remaining "Current stock remaining"
    date expiration_date "FEFO Expiry Date"
    date received_at "Receiving Date"
    text supplier "Vendor / Roastery"
    text status "active | depleted | expired"
  }

  FACT_EXPENSES {
    text expense_id PK "expenses.id"
    date date_key FK "Expense date"
    text category "Utilities, Rent, Supplies, Salaries"
    numeric amount "Expense Amount in PHP"
    text description "Description / Notes"
  }

  FACT_ATTENDANCE {
    uuid attendance_id PK "attendance_records.id"
    uuid employee_id FK "employees.id"
    date date_key FK "Shift Date"
    timestamptz clock_in "Punch In"
    timestamptz clock_out "Punch Out"
    numeric total_hours "Total worked hours"
    numeric regular_hours "Regular shift hours"
    numeric overtime_hours "Overtime hours"
    int late_minutes "Tardiness minutes"
    varchar status "present, late, half_day, absent"
  }

  %% RELATIONSHIPS
  FACT_SALES }|--|| DIM_DATE : "transacted on"
  FACT_SALES }|--|| DIM_PRODUCT : "ordered item"
  FACT_SALES }|--o| DIM_SIZE : "selected size"
  FACT_SALES }|--|| DIM_EMPLOYEE_CASHIER : "processed by"
  FACT_SALES }|--|| DIM_ORDER_TYPE : "service mode"
  FACT_SALES }|--|| DIM_PAYMENT_METHOD : "tendered via"

  FACT_INVENTORY_MOVEMENT }|--|| DIM_INGREDIENT_SUPPLY : "alters stock of"
  FACT_INVENTORY_MOVEMENT }|--o| DIM_BATCH : "drawn from batch"
  DIM_BATCH }|--|| DIM_INGREDIENT_SUPPLY : "batch of"

  FACT_EXPENSES }|--|| DIM_DATE : "incurred on"
  FACT_ATTENDANCE }|--|| DIM_EMPLOYEE_CASHIER : "logged by"
  FACT_ATTENDANCE }|--|| DIM_DATE : "shift date"
`;

fs.writeFileSync(path.join(docsDir, 'espro_data_pipeline_star_schema.mmd'), mermaidStarSchema, 'utf-8');

console.log('Successfully written Mermaid files and text blueprint to /docs!');

// Export complete PDF builder function
export async function buildDataPipelinePdf() {
  console.log('Building 6-page Landscape A4 PDF Document...');

  const exePath = getBrowserExecutablePath();
  if (!exePath) {
    throw new Error('Could not find Google Chrome or Microsoft Edge browser executable.');
  }

  console.log('Using browser executable:', exePath);

  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });

  // Read favicon / logo for brand branding
  let logoDataUri = '';
  try {
    const svgPath = path.resolve('public/favicon.svg');
    if (fs.existsSync(svgPath)) {
      const svgBuffer = fs.readFileSync(svgPath);
      logoDataUri = `data:image/svg+xml;base64,${svgBuffer.toString('base64')}`;
    }
  } catch (err) {}

  // Full 6-Page Landscape HTML document
  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Espro POS - Data Warehousing & ETL Pipeline Architecture</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

    @page {
      size: A4 landscape;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #2B1D16;
      background: #FFFFFF;
      font-size: 8.5pt;
      line-height: 1.35;
    }

    /* Page container: A4 Landscape 297mm x 210mm */
    .sheet {
      width: 297mm;
      height: 210mm;
      padding: 10mm 12mm;
      page-break-after: always;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #FFFFFF;
    }

    .sheet:last-child {
      page-break-after: avoid;
    }

    /* Top & Bottom Accent Bars */
    .accent-bar-top {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4.5mm;
      background: linear-gradient(90deg, #2B1D16 0%, #7A4A2B 35%, #C08F5E 70%, #2E7D32 100%);
    }

    .accent-bar-bottom {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3mm;
      background: linear-gradient(90deg, #2E7D32 0%, #C08F5E 30%, #7A4A2B 65%, #2B1D16 100%);
    }

    /* Standard Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #E8DCB8;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-logo-icon {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: #2B1D16;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #F3E9D7;
      font-weight: 800;
      font-size: 13px;
    }

    .header-title-group h1 {
      margin: 0;
      font-size: 13pt;
      font-weight: 800;
      color: #2B1D16;
      letter-spacing: -0.3px;
    }

    .header-title-group p {
      margin: 0;
      font-size: 7.5pt;
      color: #7A4A2B;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header-badge {
      background: #F3E9D7;
      border: 1px solid #C08F5E;
      color: #7A4A2B;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Standard Page Footer */
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #EADCC8;
      padding-top: 4px;
      font-size: 7pt;
      color: #7A4A2B;
      font-weight: 600;
    }

    /* Code font */
    code, pre, .mono {
      font-family: 'JetBrains Mono', Consolas, monospace;
    }

    /* ══════════════════════════════════════════════════════════════════════════
       PAGE 1: COVER PAGE STYLES
       ══════════════════════════════════════════════════════════════════════════ */
    .cover-sheet {
      background: radial-gradient(circle at 80% 20%, #3D291F 0%, #2B1D16 60%, #1D130E 100%);
      color: #F3E9D7;
      padding: 16mm 18mm;
    }

    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .cover-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .cover-logo-box {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: #7A4A2B;
      border: 2px solid #C08F5E;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    }

    .cover-brand-text h2 {
      margin: 0;
      font-size: 22pt;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: -0.5px;
    }

    .cover-brand-text span {
      font-size: 9pt;
      font-weight: 600;
      color: #C08F5E;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .cover-tag {
      background: rgba(192, 143, 94, 0.15);
      border: 1px solid #C08F5E;
      color: #F3E9D7;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .cover-center {
      margin: 10mm 0;
    }

    .cover-center h1 {
      font-size: 26pt;
      font-weight: 900;
      line-height: 1.15;
      color: #FFFFFF;
      margin: 0 0 6px 0;
      letter-spacing: -0.5px;
    }

    .cover-center .subtitle {
      font-size: 13pt;
      font-weight: 600;
      color: #C08F5E;
      margin: 0 0 16px 0;
    }

    .cover-center .description {
      font-size: 9pt;
      line-height: 1.5;
      color: #D6C7B2;
      max-width: 90%;
      margin: 0;
    }

    .cover-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 10px;
    }

    .cover-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(192, 143, 94, 0.3);
      border-radius: 8px;
      padding: 10px 12px;
      backdrop-filter: blur(4px);
    }

    .cover-card-num {
      font-size: 8pt;
      font-weight: 800;
      color: #C08F5E;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .cover-card-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 4px;
    }

    .cover-card-desc {
      font-size: 7.5pt;
      line-height: 1.35;
      color: #CBBCA7;
    }

    .cover-bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid rgba(192, 143, 94, 0.25);
      padding-top: 10px;
    }

    .meta-group {
      display: flex;
      gap: 24px;
    }

    .meta-item {
      font-size: 7.5pt;
    }

    .meta-item .label {
      color: #C08F5E;
      text-transform: uppercase;
      font-weight: 700;
      display: block;
      margin-bottom: 2px;
    }

    .meta-item .val {
      color: #FFFFFF;
      font-weight: 600;
    }

    .palette-swatches {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .swatch {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.2);
    }

    /* ══════════════════════════════════════════════════════════════════════════
       PAGE 2: FLOWCHART DIAGRAM STYLES
       ══════════════════════════════════════════════════════════════════════════ */
    .flow-container {
      display: grid;
      grid-template-columns: 24% 28% 24% 24%;
      gap: 8px;
      height: calc(100% - 46px);
      align-items: stretch;
    }

    .flow-column {
      border: 1.5px solid #D6C0A0;
      border-radius: 7px;
      padding: 6px 7px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      background: #FDFBF7;
      overflow: hidden;
    }

    .flow-col-header {
      padding: 4px 6px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 7.8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #FFFFFF;
    }

    .col-hdr-1 { background: #7A4A2B; }
    .col-hdr-2 { background: #8D5B36; }
    .col-hdr-3 { background: #4E3424; }
    .col-hdr-4 { background: #2E7D32; }

    .node-box {
      background: #FFFFFF;
      border: 1px solid #D8C3A5;
      border-radius: 5px;
      padding: 4px 6px;
      box-shadow: 0 1px 3px rgba(43,29,22,0.04);
      position: relative;
    }

    .node-title {
      font-weight: 700;
      font-size: 7.5pt;
      color: #2B1D16;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
    }

    .node-tag {
      font-size: 6pt;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .tag-src { background: #F3E9D7; color: #7A4A2B; }
    .tag-etl { background: #EFEBE9; color: #4E3424; }
    .tag-dw { background: #EDE0D4; color: #6F4E37; }
    .tag-olap { background: #E8F5E9; color: #2E7D32; }

    .node-desc {
      font-size: 6.8pt;
      line-height: 1.25;
      color: #554338;
      margin: 0;
    }

    .node-desc ul {
      margin: 2px 0 0 12px;
      padding: 0;
    }

    .node-desc li {
      margin-bottom: 1px;
    }

    /* Transform Step Strip inside Layer 2 */
    .transform-steps-wrap {
      background: #F8F3EB;
      border: 1px dashed #C08F5E;
      border-radius: 5px;
      padding: 4px 5px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .step-chip {
      background: #FFFFFF;
      border: 1px solid #E0CEB7;
      border-radius: 3px;
      padding: 2px 4px;
      font-size: 6.5pt;
      line-height: 1.2;
    }

    .step-chip strong {
      color: #7A4A2B;
    }

    /* Decision Diamond & Alert Box */
    .decision-node {
      background: #FFF9E6;
      border: 1.5px solid #F57C00;
      border-radius: 6px;
      padding: 4px 6px;
      text-align: center;
    }

    .decision-title {
      font-weight: 800;
      font-size: 7pt;
      color: #E65100;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .decision-rules {
      font-size: 6.2pt;
      line-height: 1.15;
      color: #4E3424;
      text-align: left;
    }

    .alert-node {
      background: #FFEBEE;
      border: 1.5px solid #C62828;
      border-radius: 5px;
      padding: 3px 5px;
      color: #B71C1C;
    }

    .alert-title {
      font-weight: 800;
      font-size: 6.8pt;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .alert-body {
      font-size: 6.2pt;
      line-height: 1.15;
      margin-top: 1px;
    }

    .load-node {
      background: #E8F5E9;
      border: 1.5px solid #2E7D32;
      border-radius: 5px;
      padding: 4px 6px;
    }

    .load-title {
      font-weight: 800;
      font-size: 7.2pt;
      color: #1B5E20;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    /* Legend Bar at Bottom */
    .flow-legend {
      background: #FAF6EE;
      border: 1px solid #D8C3A5;
      border-radius: 5px;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 6.8pt;
      font-weight: 600;
      color: #554338;
      margin-top: 4px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .legend-box {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      border: 1px solid rgba(0,0,0,0.2);
    }

    /* ══════════════════════════════════════════════════════════════════════════
       PAGE 3: BLUEPRINT STYLES
       ══════════════════════════════════════════════════════════════════════════ */
    .blueprint-grid {
      display: grid;
      grid-template-columns: 55% 45%;
      gap: 12px;
      height: calc(100% - 46px);
      overflow: hidden;
    }

    .blueprint-tree {
      background: #FDFBF7;
      border: 1px solid #D6C0A0;
      border-radius: 6px;
      padding: 8px 10px;
      overflow: hidden;
      font-size: 6.9pt;
      line-height: 1.35;
    }

    .blueprint-tree h3 {
      font-size: 7.8pt;
      font-weight: 800;
      color: #7A4A2B;
      border-bottom: 1px solid #EADCC8;
      padding-bottom: 2px;
      margin: 4px 0 3px 0;
    }

    .blueprint-tree h3:first-child {
      margin-top: 0;
    }

    .blueprint-tree ul {
      margin: 0 0 4px 12px;
      padding: 0;
    }

    .blueprint-tree li {
      margin-bottom: 1.5px;
    }

    .blueprint-connections {
      background: #FDFBF7;
      border: 1px solid #D6C0A0;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .conn-list {
      background: #FFFFFF;
      border: 1px solid #E0CEB7;
      border-radius: 4px;
      padding: 6px;
      overflow: hidden;
      font-size: 6.3pt;
      line-height: 1.3;
      font-family: 'JetBrains Mono', Consolas, monospace;
      color: #3D291F;
      height: 100%;
    }

    .conn-row {
      margin-bottom: 3.5px;
      border-bottom: 1px dotted #EADCC8;
      padding-bottom: 2px;
    }

    .conn-src { font-weight: 700; color: #7A4A2B; }
    .conn-arrow { color: #C08F5E; font-weight: 800; }
    .conn-dst { font-weight: 700; color: #2E7D32; }
    .conn-lbl { color: #666; font-style: italic; }

    /* ══════════════════════════════════════════════════════════════════════════
       PAGE 4: STAR SCHEMA DIAGRAM STYLES
       ══════════════════════════════════════════════════════════════════════════ */
    .schema-layout {
      height: calc(100% - 46px);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .schema-diagram-area {
      flex: 1;
      display: grid;
      grid-template-columns: 27% 46% 27%;
      gap: 8px;
      align-items: center;
    }

    .schema-col-left, .schema-col-right {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .schema-center {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .dim-table {
      background: #FFFFFF;
      border: 1.5px solid #C08F5E;
      border-radius: 5px;
      padding: 4px 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .dim-hdr {
      background: #7A4A2B;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 7.2pt;
      padding: 2px 5px;
      border-radius: 3px;
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }

    .dim-fields {
      font-size: 6.4pt;
      line-height: 1.25;
      color: #4E3424;
      font-family: 'JetBrains Mono', Consolas, monospace;
    }

    .fact-table {
      background: #FFFFFF;
      border: 2px solid #7A4A2B;
      border-radius: 6px;
      padding: 6px 8px;
      box-shadow: 0 2px 6px rgba(43,29,22,0.08);
    }

    .fact-hdr {
      background: linear-gradient(90deg, #2B1D16 0%, #7A4A2B 100%);
      color: #FFFFFF;
      font-weight: 900;
      font-size: 8.5pt;
      padding: 3px 6px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .fact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .fact-section-title {
      font-size: 6.5pt;
      font-weight: 800;
      color: #7A4A2B;
      border-bottom: 1px solid #D6C0A0;
      margin-bottom: 2px;
      text-transform: uppercase;
    }

    .sat-fact-wrap {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin-top: 4px;
    }

    /* ══════════════════════════════════════════════════════════════════════════
       TABLE STYLES FOR PAGE 5 & PAGE 6
       ══════════════════════════════════════════════════════════════════════════ */
    .table-container {
      height: calc(100% - 46px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    table.capstone-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6.8pt;
      line-height: 1.25;
      background: #FFFFFF;
      border: 1px solid #D6C0A0;
      border-radius: 5px;
      overflow: hidden;
    }

    table.capstone-table thead tr {
      background: #7A4A2B;
      color: #FFFFFF;
    }

    table.capstone-table th {
      padding: 5px 6px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      font-size: 6.8pt;
      border-right: 1px solid rgba(255,255,255,0.15);
      text-align: left;
    }

    table.capstone-table th:last-child {
      border-right: none;
    }

    table.capstone-table tbody tr {
      border-bottom: 1px solid #EADCC8;
    }

    table.capstone-table tbody tr:nth-child(even) {
      background: #FDFBF7;
    }

    table.capstone-table tbody tr:hover {
      background: #F6EDE1;
    }

    table.capstone-table td {
      padding: 4px 6px;
      vertical-align: top;
      border-right: 1px solid #EADCC8;
      color: #3D291F;
    }

    table.capstone-table td:last-child {
      border-right: none;
    }

    .tbl-tag {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 6pt;
      font-weight: 700;
      text-transform: uppercase;
    }

    .tbl-tag-extract { background: #EFEBE9; color: #4E3424; }
    .tbl-tag-transform { background: #FFF8E1; color: #F57F17; }
    .tbl-tag-qc { background: #FFEBEE; color: #C62828; }
    .tbl-tag-load { background: #E8F5E9; color: #2E7D32; }

    .callout-honest {
      background: #FAF6EE;
      border-left: 3.5px solid #C08F5E;
      border-radius: 4px;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: 6.8pt;
      color: #4E3424;
      line-height: 1.35;
    }

    .callout-honest strong {
      color: #7A4A2B;
    }
  </style>
</head>
<body>

  <!-- ══════════════════════════════════════════════════════════════════════════
       PAGE 1: TITLE & COVER PAGE
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="sheet cover-sheet">
    <div class="accent-bar-top"></div>

    <div class="cover-top">
      <div class="cover-brand">
        <div class="cover-logo-box">☕</div>
        <div class="cover-brand-text">
          <h2>ESPRO POS SYSTEM</h2>
          <span>Unified Retail, Recipe & Inventory Architecture</span>
        </div>
      </div>
      <div class="cover-tag">Capstone Technical Specification</div>
    </div>

    <div class="cover-center">
      <h1>Data Warehousing & ETL Pipeline Architecture</h1>
      <div class="subtitle">End-to-End Operational to Analytical Data Processing Pipeline</div>
      <p class="description">
        Comprehensive architectural design and engineering specification detailing the flow of coffee shop operations—from high-velocity Point-of-Sale checkouts, recipe explosions, batch FEFO allocations, and employee time-clock attendance to staging, atomic transformation rules, data quality validation ("Stop & Alert"), multi-dimensional Star Schema storage, and executive OLAP reporting views.
      </p>

      <div class="cover-grid">
        <div class="cover-card">
          <div class="cover-card-num">Layer 01</div>
          <div class="cover-card-title">Operational Sources</div>
          <div class="cover-card-desc">POS sales transactions, recipe ingredients, FEFO batches, expenses, employee attendance, and offline localStorage cache.</div>
        </div>
        <div class="cover-card">
          <div class="cover-card-num">Layer 02</div>
          <div class="cover-card-title">ETL Processing Engine</div>
          <div class="cover-card-desc">Unit conversion, recipe explosion, COGS snapshots, packaging rules, FEFO sorting, and Stop & Alert quality checks.</div>
        </div>
        <div class="cover-card">
          <div class="cover-card-num">Layer 03</div>
          <div class="cover-card-title">Star Schema Warehouse</div>
          <div class="cover-card-desc">Fact_Sales, Fact_Inventory_Movement, Fact_Expenses, Fact_Attendance, 10 Dimensions, and 4 Localized Data Marts.</div>
        </div>
        <div class="cover-card">
          <div class="cover-card-num">Layer 04</div>
          <div class="cover-card-title">OLAP Analytical Views</div>
          <div class="cover-card-desc">Multi-dimensional slice, dice, roll-up, drill-down engine serving Owner P&L, Store Manager Inventory, and Cashier Views.</div>
        </div>
      </div>
    </div>

    <div class="cover-bottom">
      <div class="meta-group">
        <div class="meta-item">
          <span class="label">Course / Degree</span>
          <span class="val">BS Information Technology / CS Capstone Project</span>
        </div>
        <div class="meta-item">
          <span class="label">Project Title</span>
          <span class="val">Espro POS: Coffee Shop Management & BI System</span>
        </div>
        <div class="meta-item">
          <span class="label">Architecture Version</span>
          <span class="val">v6.0 Enterprise Pipeline Specification</span>
        </div>
        <div class="meta-item">
          <span class="label">Date</span>
          <span class="val">October 2026</span>
        </div>
      </div>

      <div class="palette-swatches">
        <span style="font-size: 7pt; color: #C08F5E; font-weight: 700; margin-right: 4px;">BRAND PALETTE:</span>
        <div class="swatch" style="background: #2B1D16;" title="Espresso #2B1D16"></div>
        <div class="swatch" style="background: #7A4A2B;" title="Mocha #7A4A2B"></div>
        <div class="swatch" style="background: #C08F5E;" title="Caramel #C08F5E"></div>
        <div class="swatch" style="background: #F3E9D7;" title="Cream #F3E9D7"></div>
        <div class="swatch" style="background: #2E7D32;" title="Emerald Success #2E7D32"></div>
        <div class="swatch" style="background: #C62828;" title="Stop & Alert Red #C62828"></div>
      </div>
    </div>

    <div class="accent-bar-bottom"></div>
  </div>


  <!-- ══════════════════════════════════════════════════════════════════════════
       PAGE 2: FLOWCHART DIAGRAM (FULL END-TO-END)
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="sheet">
    <div class="accent-bar-top"></div>

    <div class="page-header">
      <div class="header-left">
        <div class="header-logo-icon">☕</div>
        <div class="header-title-group">
          <h1>End-to-End Data Warehousing & ETL Pipeline Flowchart</h1>
          <p>Full System Architecture: Operational Ingestion → ETL Processing → Star Schema → OLAP Analytics</p>
        </div>
      </div>
      <div class="header-badge">Figure 1.0 • Comprehensive Architecture</div>
    </div>

    <div class="flow-container">
      
      <!-- ─── COLUMN 1: LAYER 1 DATA SOURCES ─── -->
      <div class="flow-column">
        <div class="flow-col-header col-hdr-1">
          <span>Layer 1: Data Sources</span>
          <span>OLTP</span>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>POS Sales Transactions</span>
            <span class="node-tag tag-src">sales</span>
          </div>
          <div class="node-desc">
            Checkout sales data: items JSONB, subtotal, discount, total, payment_method (cash/gcash), order_type, cashier_name, status.
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Inventory & Batches</span>
            <span class="node-tag tag-src">Stock</span>
          </div>
          <div class="node-desc">
            Raw ingredients, stock_quantity, low_stock_threshold, cost_per_unit, actual_purchase_price. ingredient_batches (FEFO expiry) & stock_movements ledger.
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Menu & Recipe Master</span>
            <span class="node-tag tag-src">Master</span>
          </div>
          <div class="node-desc">
            menu_items, sizes (ingredient_multiplier), recipes (menu_item_ingredients), addons, addon_ingredients, order_supply_rules (packaging).
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Operating Expenses</span>
            <span class="node-tag tag-src">expenses</span>
          </div>
          <div class="node-desc">
            Daily store expenses: Utilities, Supplies, Salaries, Rent, Maintenance, Marketing, Others with amount, date, and description.
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>HR & Attendance Kiosk</span>
            <span class="node-tag tag-src">HR</span>
          </div>
          <div class="node-desc">
            employees (code, PIN, rate), shift_templates, shift_schedules, attendance_records (clock_in/out, hours, overtime, tardiness).
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Offline Browser Cache</span>
            <span class="node-tag tag-src">Storage</span>
          </div>
          <div class="node-desc">
            localStorage resilience fallback when network fails; profiles & Supabase Auth user accounts.
          </div>
        </div>
      </div>

      <!-- ─── COLUMN 2: LAYER 2 ETL PIPELINE ─── -->
      <div class="flow-column">
        <div class="flow-col-header col-hdr-2">
          <span>Layer 2: ETL Pipeline</span>
          <span>Transform</span>
        </div>

        <div class="node-box" style="background: #FDF8F0;">
          <div class="node-title">
            <span>Extract & Staging Area</span>
            <span class="node-tag tag-etl">db.ts</span>
          </div>
          <div class="node-desc">
            loadSales, loadIngredients, loadBatches, loadExpenses. PostgREST fetch + localStorage fallback; in-memory React state staging.
          </div>
        </div>

        <div class="transform-steps-wrap">
          <div style="font-size: 6.8pt; font-weight: 800; color: #7A4A2B; text-transform: uppercase; margin-bottom: 2px;">
            Transformation Rules (orderCalc & unitConversion)
          </div>
          <div class="step-chip"><strong>1. Unit Conversion:</strong> Normalize g/kg/ml/L/shots/pumps/pcs</div>
          <div class="step-chip"><strong>2. Recipe Explosion:</strong> computeLine size multiplier & addon chains</div>
          <div class="step-chip"><strong>3. COGS Snapshot:</strong> Split ingredients COGS vs supplies COGS</div>
          <div class="step-chip"><strong>4. Packaging Rules:</strong> computeOrder takeout packaging supplies</div>
          <div class="step-chip"><strong>5. Net Metric:</strong> Net Sales = Subtotal (Gross) - Discount</div>
          <div class="step-chip"><strong>6. Missing Fill:</strong> Legacy cost fallback; default dine_in</div>
          <div class="step-chip"><strong>7. FEFO Allocation:</strong> Earliest-expiry-first; expire_batches</div>
          <div class="step-chip"><strong>8. Deduplication:</strong> Deterministic cart merging via lineKey</div>
          <div class="step-chip"><strong>9. Date Normalization:</strong> Asia/Manila (UTC+8) day boundaries</div>
        </div>

        <!-- Decision Diamond -->
        <div class="decision-node">
          <div class="decision-title">◆ Quality Check & Validation</div>
          <div class="decision-rules">
            • Stock Shortage Check (shortages.length == 0)<br/>
            • Compatible Units & Positive Qty/Amounts<br/>
            • Discount Clamping (discount &le; subtotal)<br/>
            • PIN & Void Status Integrity Verification
          </div>
        </div>

        <!-- Failure Stop & Alert Box -->
        <div class="alert-node">
          <div class="alert-title">⚠ Stop & Alert Routine (FAIL)</div>
          <div class="alert-body">
            • Rollback Atomic RPC (PL/pgSQL Exception)<br/>
            • Toast Error Alert (react-hot-toast)<br/>
            • TopBar Low-Stock & Near-Expiry Alert Badge
          </div>
        </div>

        <!-- Load Phase -->
        <div class="load-node">
          <div class="load-title">✓ Load Phase: Atomic RPCs (PASS)</div>
          <div class="node-desc">
            complete_sale_with_deduction, void_sale_with_restoration, restock_ingredient, adjust_ingredient_stock.
          </div>
        </div>
      </div>

      <!-- ─── COLUMN 3: LAYER 3 DATA WAREHOUSE & STAR SCHEMA ─── -->
      <div class="flow-column">
        <div class="flow-col-header col-hdr-3">
          <span>Layer 3: Data Warehouse</span>
          <span>Star Schema</span>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Dimensions (Context)</span>
            <span class="node-tag tag-dw">10 Dims</span>
          </div>
          <div class="node-desc">
            • Dim_Date (date_key, month, week, year)<br/>
            • Dim_Product (menu_items.id, category)<br/>
            • Dim_Size & Dim_Addon<br/>
            • Dim_Ingredient_Supply (unit, cost)<br/>
            • Dim_Employee_Cashier (code, role)<br/>
            • Dim_OrderType & Dim_PaymentMethod<br/>
            • Dim_ExpenseCategory & Dim_Batch
          </div>
        </div>

        <div class="node-box" style="border: 1.5px solid #7A4A2B;">
          <div class="node-title">
            <span>Fact_Sales (Measurements)</span>
            <span class="node-tag tag-dw">Core Fact</span>
          </div>
          <div class="node-desc">
            <strong>Grain:</strong> Sale Line Item<br/>
            <strong>Metrics:</strong> Quantity, Unit Price, Gross Amount, Discount Amount, <em>Net Amount = Gross - Discount</em>, COGS Ingredients, COGS Supplies, Net Profit.
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Satellite Fact Tables</span>
            <span class="node-tag tag-dw">Facts</span>
          </div>
          <div class="node-desc">
            • Fact_Inventory_Movement (stock_movements)<br/>
            • Fact_Expenses (daily operational expenses)<br/>
            • Fact_Attendance (hours, overtime, late_mins)
          </div>
        </div>

        <div class="node-box" style="background: #F5EFEB;">
          <div class="node-title">
            <span>Localized Data Marts</span>
            <span class="node-tag tag-dw">Marts</span>
          </div>
          <div class="node-desc">
            • <strong>Sales Mart:</strong> Daily/weekly/monthly revenue & tickets<br/>
            • <strong>Inventory Mart:</strong> Stock valuation, spoilage, turnover<br/>
            • <strong>Finance Mart:</strong> P&L, Gross Margin, OPEX, Net Profit<br/>
            • <strong>Workforce Mart:</strong> Labor hours, overtime expenditure
          </div>
        </div>
      </div>

      <!-- ─── COLUMN 4: LAYER 4 OLAP ENGINE & VIEWS ─── -->
      <div class="flow-column">
        <div class="flow-col-header col-hdr-4">
          <span>Layer 4: OLAP & Views</span>
          <span>Analytics</span>
        </div>

        <div class="node-box" style="background: #E8F5E9; border-color: #2E7D32;">
          <div class="node-title">
            <span style="color: #1B5E20;">OLAP Analytical Engine</span>
            <span class="node-tag tag-olap">useMemo</span>
          </div>
          <div class="node-desc">
            Multi-dimensional in-memory engine (Reports.tsx & Dashboard.tsx):<br/>
            • <strong>Slice:</strong> Status (completed/voided), Order Type<br/>
            • <strong>Dice:</strong> Date Range + Category + Cashier<br/>
            • <strong>Roll-up:</strong> Hourly &rarr; Daily &rarr; Weekly &rarr; Monthly<br/>
            • <strong>Drill-down:</strong> Sales KPI &rarr; Receipt &rarr; Deductions<br/>
            • <strong>Period-over-Period:</strong> Today vs Yesterday
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Owner / Admin View</span>
            <span class="node-tag tag-olap">adminOnly</span>
          </div>
          <div class="node-desc">
            • Financial Reports, Real Net Profit & P&L<br/>
            • COGS margin breakdown & break-even<br/>
            • Multi-format Export: PDF & CSV (reportExport)<br/>
            • Menu recipe builder & Staff user accounts
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Store Manager View</span>
            <span class="node-tag tag-olap">Manager</span>
          </div>
          <div class="node-desc">
            • Live Stock Valuation, Low-Stock Warnings<br/>
            • FEFO Batch Expiry Banners & Spoilage<br/>
            • Expense management & Cost oversight<br/>
            • Shift scheduling & Attendance monitoring
          </div>
        </div>

        <div class="node-box">
          <div class="node-title">
            <span>Cashier / Staff View</span>
            <span class="node-tag tag-olap">Counter</span>
          </div>
          <div class="node-desc">
            • Fast POS Ordering, Size & Addon picker<br/>
            • Real-time stock shortage prevention<br/>
            • Printable & Digital receipt generation<br/>
            • Daily Sales KPI Cards & Time Clock punch
          </div>
        </div>
      </div>

    </div>

    <!-- Bottom Flowchart Legend -->
    <div class="flow-legend">
      <div class="legend-item">
        <div class="legend-box" style="background: #7A4A2B;"></div>
        <span>Data Sources (OLTP Database & Storage)</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #C08F5E;"></div>
        <span>ETL Transformation & Calculations</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #FFF9E6; border-color: #F57C00;"></div>
        <span>Quality Check Decision Diamond</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #FFEBEE; border-color: #C62828;"></div>
        <span>Stop & Alert Routine</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #4E3424;"></div>
        <span>Star Schema Warehouse (Facts & Dims)</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #2E7D32;"></div>
        <span>OLAP Engine & Stakeholder Views</span>
      </div>
      <div class="legend-item">
        <span style="font-weight: 800; color: #7A4A2B;">&rarr;</span>
        <span>Directional Data Flow</span>
      </div>
    </div>

    <div class="page-footer">
      <span>Espro POS Capstone Project • Data Warehousing & ETL Pipeline Architecture</span>
      <span>Page 2 of 6 • Flowchart Diagram</span>
    </div>
    <div class="accent-bar-bottom"></div>
  </div>


  <!-- ══════════════════════════════════════════════════════════════════════════
       PAGE 3: TEXT FORMAT BLUEPRINT & CONNECTION LIST
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="sheet">
    <div class="accent-bar-top"></div>

    <div class="page-header">
      <div class="header-left">
        <div class="header-logo-icon">☕</div>
        <div class="header-title-group">
          <h1>Text Format Blueprint & Data Flow Connections</h1>
          <p>Indented Hierarchical Component Tree and Explicit Node Connection Matrix for Tool Import</p>
        </div>
      </div>
      <div class="header-badge">Figure 2.0 • Architecture Blueprint</div>
    </div>

    <div class="blueprint-grid">
      
      <!-- Left: Indented Hierarchical Tree -->
      <div class="blueprint-tree">
        <h3>1. LAYER 1: OPERATIONAL DATA SOURCES (OLTP)</h3>
        <ul>
          <li><strong>POS Sales Transactions:</strong> <code>sales</code> (id, items JSONB, subtotal, discount, total, payment_method, order_type, cashier_name, status).</li>
          <li><strong>Inventory & Batches:</strong> <code>ingredients</code>, <code>ingredient_batches</code> (FEFO expiry, supplier), <code>stock_movements</code>, <code>sale_batch_allocations</code>.</li>
          <li><strong>Menu Master Data:</strong> <code>menu_items</code>, <code>menu_item_sizes</code>, <code>menu_item_ingredients</code>, <code>addons</code>, <code>addon_ingredients</code>, <code>order_supply_rules</code>.</li>
          <li><strong>Expenses:</strong> <code>expenses</code> table (id, description, amount, category, date).</li>
          <li><strong>HR & Attendance:</strong> <code>employees</code>, <code>shift_templates</code>, <code>shift_schedules</code>, <code>attendance_records</code>.</li>
          <li><strong>Offline Cache:</strong> browser <code>localStorage</code> fallback (<code>espro_*</code>) and Supabase Auth.</li>
        </ul>

        <h3>2. LAYER 2: ETL PROCESSING PIPELINE (db.ts & orderCalc.ts)</h3>
        <ul>
          <li><strong>Extract:</strong> PostgREST loaders (<code>loadSales</code>, <code>loadIngredients</code>, etc.) with network error catching & localStorage fallback.</li>
          <li><strong>Staging Area:</strong> Client in-memory React state + synchronized localStorage cache.</li>
          <li><strong>Transform Engine (9 Core Steps):</strong>
            <ul>
              <li>1. Unit Conversion (<code>unitConversion.ts</code>): g, kg, ml, L, oz, shots, pumps, pcs.</li>
              <li>2. Recipe Explosion (<code>computeLine</code>): size multiplier, addon recipes, <code>usage_scope</code>.</li>
              <li>3. COGS Snapshot: separate raw ingredient costs from packaging supply costs.</li>
              <li>4. Packaging Rules (<code>computeOrder</code>): takeout cup, lid, and kraft bag deduction.</li>
              <li>5. Net Metric Calculation: <code>Net Sales = Subtotal (Gross) - Discount</code>.</li>
              <li>6. Missing-Value Imputation: legacy recipe cost fallback; default <code>dine_in</code>.</li>
              <li>7. FEFO Allocation: earliest expiration date sort; <code>expire_batches</code> write-off.</li>
              <li>8. Deduplication: deterministic lineKey merging (<code>item__size__addons__note</code>).</li>
              <li>9. Timezone Normalization: Asia/Manila (UTC+8) day boundaries via <code>dateUtils.ts</code>.</li>
            </ul>
          </li>
          <li><strong>Quality Check Diamond:</strong> validates stock shortages, unit compatibility, positive amounts, discount &le; subtotal, PIN code, and completed status.</li>
          <li><strong>Stop & Alert Routine:</strong> triggers on validation failure &rarr; atomic RPC rollback (exception), UI cashier toast, and TopBar alert badge.</li>
          <li><strong>Load Phase:</strong> atomic PL/pgSQL RPCs (<code>complete_sale_with_deduction</code>, <code>void_sale_with_restoration</code>, <code>restock_ingredient</code>).</li>
        </ul>

        <h3>3. LAYER 3: DATA WAREHOUSE & STAR SCHEMA (PostgreSQL)</h3>
        <ul>
          <li><strong>Dimensions:</strong> Dim_Date, Dim_Product, Dim_Size, Dim_Addon, Dim_Ingredient_Supply, Dim_Employee_Cashier, Dim_OrderType, Dim_PaymentMethod, Dim_ExpenseCategory, Dim_Batch.</li>
          <li><strong>Facts:</strong> Fact_Sales (sale line items: qty, gross, discount, net, COGS, profit), Fact_Inventory_Movement, Fact_Expenses, Fact_Attendance.</li>
          <li><strong>Data Marts:</strong> Sales Mart, Inventory Mart, Finance/Profit Mart (P&L), Workforce Mart.</li>
        </ul>

        <h3>4. LAYER 4: OLAP ENGINE & ROLE-BASED VIEWS</h3>
        <ul>
          <li><strong>OLAP Logic:</strong> <code>useMemo</code> analytical engine (Slice, Dice, Roll-up, Drill-down, Period comparison).</li>
          <li><strong>Views:</strong> Owner/Admin (P&L, break-even, exports), Store Manager (inventory valuation, batches, staff), Cashier (POS, receipts).</li>
        </ul>
      </div>

      <!-- Right: Explicit Connection Matrix -->
      <div class="blueprint-connections">
        <div style="font-size: 7.5pt; font-weight: 800; color: #7A4A2B; margin-bottom: 4px; text-transform: uppercase;">
          Explicit Connection List [Source] &rarr; [Destination] (Data Label)
        </div>
        <div class="conn-list">
          <div class="conn-row"><span class="conn-src">[POS Transactions]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Extract Phase (db.ts)]</span> <span class="conn-lbl">(Raw Sales JSONB Payload)</span></div>
          <div class="conn-row"><span class="conn-src">[Inventory & Batches]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Extract Phase (db.ts)]</span> <span class="conn-lbl">(Stock Levels & FEFO Batches)</span></div>
          <div class="conn-row"><span class="conn-src">[Menu Master & Recipes]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Extract Phase (db.ts)]</span> <span class="conn-lbl">(Menu Catalog & Multipliers)</span></div>
          <div class="conn-row"><span class="conn-src">[Expenses Table]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Extract Phase (db.ts)]</span> <span class="conn-lbl">(Operating Expense Records)</span></div>
          <div class="conn-row"><span class="conn-src">[HR Time Clock Kiosk]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Extract Phase (employeeDb.ts)]</span> <span class="conn-lbl">(Attendance Punch Timestamps)</span></div>
          <div class="conn-row"><span class="conn-src">[Offline localStorage]</span> <span class="conn-arrow">-.&rarr;</span> <span class="conn-dst">[Extract Phase (db.ts)]</span> <span class="conn-lbl">(Fallback on Network Failure)</span></div>
          <div class="conn-row"><span class="conn-src">[Extract Phase]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Staging Area Buffer]</span> <span class="conn-lbl">(In-memory Extracted Datasets)</span></div>
          <div class="conn-row"><span class="conn-src">[Staging Area]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: Unit Conversion]</span> <span class="conn-lbl">(Raw Ingredients & Units)</span></div>
          <div class="conn-row"><span class="conn-src">[Unit Conversion]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: Recipe Explosion]</span> <span class="conn-lbl">(Normalized Base Units g/ml)</span></div>
          <div class="conn-row"><span class="conn-src">[Recipe Explosion]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: COGS Snapshot]</span> <span class="conn-lbl">(Scaled Ingredients & Addons)</span></div>
          <div class="conn-row"><span class="conn-src">[COGS Snapshot]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: Packaging Rules]</span> <span class="conn-lbl">(Ingredients vs Supplies COGS)</span></div>
          <div class="conn-row"><span class="conn-src">[Packaging Rules]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: Net Metric Calc]</span> <span class="conn-lbl">(Takeout Supplies Appended)</span></div>
          <div class="conn-row"><span class="conn-src">[Net Metric Calc]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: Missing Fill]</span> <span class="conn-lbl">(Net = Subtotal - Discount)</span></div>
          <div class="conn-row"><span class="conn-src">[Missing Fill]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: FEFO Allocation]</span> <span class="conn-lbl">(Imputed Legacy Cost/OrderType)</span></div>
          <div class="conn-row"><span class="conn-src">[FEFO Allocation]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: Line Deduplication]</span> <span class="conn-lbl">(Earliest Expiry Batch List)</span></div>
          <div class="conn-row"><span class="conn-src">[Line Deduplication]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Transform: Timezone Normal]</span> <span class="conn-lbl">(Merged lineKey Cart Items)</span></div>
          <div class="conn-row"><span class="conn-src">[Timezone Normal]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Quality Check Decision Diamond]</span> <span class="conn-lbl">(Transformed Order Payload)</span></div>
          <div class="conn-row"><span class="conn-src">[Quality Check]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[STOP & ALERT Routine]</span> <span class="conn-lbl">(On Shortage / Invalid Data FAIL)</span></div>
          <div class="conn-row"><span class="conn-src">[STOP & ALERT Routine]</span> <span class="conn-arrow">-.&rarr;</span> <span class="conn-dst">[TopBar Stock Alert & Cashier Toast]</span> <span class="conn-lbl">(Visual Warning & Rollback)</span></div>
          <div class="conn-row"><span class="conn-src">[Quality Check]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Load: Atomic RPCs]</span> <span class="conn-lbl">(On All Validations PASS)</span></div>
          <div class="conn-row"><span class="conn-src">[Load: Atomic RPCs]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Fact_Sales & Fact_Inventory]</span> <span class="conn-lbl">(complete_sale_with_deduction)</span></div>
          <div class="conn-row"><span class="conn-src">[Fact_Sales]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Sales Mart & Finance Mart]</span> <span class="conn-lbl">(Aggregated Financial Metrics)</span></div>
          <div class="conn-row"><span class="conn-src">[Fact_Inventory_Movement]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Inventory Mart]</span> <span class="conn-lbl">(Stock Valuation & Spoilage)</span></div>
          <div class="conn-row"><span class="conn-src">[Fact_Attendance]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Workforce Mart]</span> <span class="conn-lbl">(Labor Hours & Overtime Cost)</span></div>
          <div class="conn-row"><span class="conn-src">[Data Marts]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[OLAP Engine (Reports useMemo)]</span> <span class="conn-lbl">(Multi-Dimensional Aggregates)</span></div>
          <div class="conn-row"><span class="conn-src">[OLAP Engine]</span> <span class="conn-arrow">&rarr;</span> <span class="conn-dst">[Owner, Manager, Cashier Views]</span> <span class="conn-lbl">(Role-Based Dashboards & Exports)</span></div>
        </div>
      </div>

    </div>

    <div class="page-footer">
      <span>Espro POS Capstone Project • Data Warehousing & ETL Pipeline Architecture</span>
      <span>Page 3 of 6 • Text Format Blueprint</span>
    </div>
    <div class="accent-bar-bottom"></div>
  </div>


  <!-- ══════════════════════════════════════════════════════════════════════════
       PAGE 4: STAR SCHEMA ARCHITECTURE
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="sheet">
    <div class="accent-bar-top"></div>

    <div class="page-header">
      <div class="header-left">
        <div class="header-logo-icon">☕</div>
        <div class="header-title-group">
          <h1>Data Warehouse Multi-Dimensional Star Schema</h1>
          <p>Fact_Sales Centric Star Schema with Conformed Dimensions and Satellite Operational Facts</p>
        </div>
      </div>
      <div class="header-badge">Figure 3.0 • Star Schema Data Model</div>
    </div>

    <div class="schema-layout">
      
      <div class="schema-diagram-area">
        
        <!-- Left Dimensions -->
        <div class="schema-col-left">
          
          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_Product</span><span>menu_items</span></div>
            <div class="dim-fields">
              <strong>PK menu_item_id : uuid</strong><br/>
              name : text<br/>
              category : text<br/>
              base_price : numeric<br/>
              is_active : boolean
            </div>
          </div>

          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_Size</span><span>menu_item_sizes</span></div>
            <div class="dim-fields">
              <strong>PK size_id : uuid</strong><br/>
              FK menu_item_id : uuid<br/>
              name : text (Small/Medium/Large)<br/>
              price : numeric<br/>
              ingredient_multiplier : numeric
            </div>
          </div>

          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_Addon</span><span>addons</span></div>
            <div class="dim-fields">
              <strong>PK addon_id : uuid</strong><br/>
              name : text<br/>
              price : numeric<br/>
              applies_to_categories : text[]
            </div>
          </div>

          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_Ingredient_Supply</span><span>ingredients</span></div>
            <div class="dim-fields">
              <strong>PK ingredient_id : uuid</strong><br/>
              name : text<br/>
              unit : text (g, ml, pcs, shots)<br/>
              item_type : text (ingredient/supply)<br/>
              actual_purchase_price : numeric
            </div>
          </div>

        </div>

        <!-- Center: Core Fact Table -->
        <div class="schema-center">
          
          <div class="fact-table">
            <div class="fact-hdr">
              <span>★ Fact_Sales (Core Sales Measurements)</span>
              <span>Grain: Sale Line Item</span>
            </div>

            <div class="fact-grid">
              <div>
                <div class="fact-section-title">Foreign Keys & Dimensions</div>
                <div class="dim-fields">
                  <strong>PK sale_id : text</strong><br/>
                  <strong>PK line_id : text / line_index</strong><br/>
                  FK date_key : date<br/>
                  FK menu_item_id : uuid<br/>
                  FK size_id : uuid (nullable)<br/>
                  FK cashier_id / name : text<br/>
                  Degenerate order_type : text (dine_in/takeout)<br/>
                  Degenerate payment_method : text (cash/gcash)<br/>
                  Degenerate status : text (completed/voided)<br/>
                  created_at : timestamptz (Asia/Manila)
                </div>
              </div>

              <div>
                <div class="fact-section-title">Additive Quantitative Metrics</div>
                <div class="dim-fields">
                  quantity : numeric<br/>
                  unit_price : numeric (base + addons)<br/>
                  gross_amount : numeric (subtotal)<br/>
                  discount_amount : numeric<br/>
                  <strong>net_amount : numeric (gross - discount)</strong><br/>
                  cogs_ingredients : numeric<br/>
                  cogs_supplies : numeric<br/>
                  total_cogs : numeric (ing + sup)<br/>
                  <strong>gross_profit : numeric (net - cogs)</strong><br/>
                  profit_margin_pct : numeric
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Satellite Fact Tables -->
          <div class="sat-fact-wrap">
            <div class="dim-table" style="border-color: #7A4A2B;">
              <div class="dim-hdr" style="background: #4E3424;"><span>Fact_Inventory</span><span>movements</span></div>
              <div class="dim-fields">
                <strong>PK movement_id : uuid</strong><br/>
                FK ingredient_id : uuid<br/>
                change_qty : numeric<br/>
                type : text (sale/void/restock)<br/>
                reference_id : text (sale_id)<br/>
                created_at : timestamptz
              </div>
            </div>

            <div class="dim-table" style="border-color: #7A4A2B;">
              <div class="dim-hdr" style="background: #4E3424;"><span>Fact_Expenses</span><span>expenses</span></div>
              <div class="dim-fields">
                <strong>PK expense_id : text</strong><br/>
                FK date_key : date<br/>
                FK category : text<br/>
                amount : numeric<br/>
                description : text<br/>
                created_at : timestamptz
              </div>
            </div>

            <div class="dim-table" style="border-color: #7A4A2B;">
              <div class="dim-hdr" style="background: #4E3424;"><span>Fact_Attendance</span><span>records</span></div>
              <div class="dim-fields">
                <strong>PK attendance_id : uuid</strong><br/>
                FK employee_id : uuid<br/>
                FK date_key : date<br/>
                total_hours : numeric<br/>
                regular_hours : numeric<br/>
                overtime_hours : numeric<br/>
                late_minutes : int
              </div>
            </div>
          </div>

        </div>

        <!-- Right Dimensions -->
        <div class="schema-col-right">
          
          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_Date</span><span>dateUtils.ts</span></div>
            <div class="dim-fields">
              <strong>PK date_key : date (YYYY-MM-DD)</strong><br/>
              year : int<br/>
              month : int (1-12)<br/>
              month_name : text<br/>
              day_of_month : int<br/>
              day_name : text<br/>
              is_weekend : boolean
            </div>
          </div>

          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_Employee_Cashier</span><span>employees</span></div>
            <div class="dim-fields">
              <strong>PK employee_id : uuid</strong><br/>
              employee_code : varchar<br/>
              name : varchar<br/>
              role : varchar (Barista, Manager)<br/>
              hourly_rate : numeric<br/>
              has_system_access : boolean
            </div>
          </div>

          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_Batch_Supplier</span><span>batches</span></div>
            <div class="dim-fields">
              <strong>PK batch_id : uuid</strong><br/>
              FK ingredient_id : uuid<br/>
              quantity_remaining : numeric<br/>
              expiration_date : date (FEFO)<br/>
              received_at : date<br/>
              supplier : text
            </div>
          </div>

          <div class="dim-table">
            <div class="dim-hdr"><span>Dim_ExpenseCategory</span><span>categories</span></div>
            <div class="dim-fields">
              <strong>PK category_name : text</strong><br/>
              classification : text<br/>
              (Utilities, Supplies, Rent, Salaries, Maintenance, Marketing, Others)
            </div>
          </div>

        </div>

      </div>

    </div>

    <div class="page-footer">
      <span>Espro POS Capstone Project • Data Warehousing & ETL Pipeline Architecture</span>
      <span>Page 4 of 6 • Star Schema Architecture</span>
    </div>
    <div class="accent-bar-bottom"></div>
  </div>


  <!-- ══════════════════════════════════════════════════════════════════════════
       PAGE 5: ETL & QUALITY-RULES TABLE
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="sheet">
    <div class="accent-bar-top"></div>

    <div class="page-header">
      <div class="header-left">
        <div class="header-logo-icon">☕</div>
        <div class="header-title-group">
          <h1>ETL Transformation Rules & Data Quality Assurance Matrix</h1>
          <p>Comprehensive Mapping of Source Data, Business Rules, Target Warehouse Entities, and Stop & Alert Handlers</p>
        </div>
      </div>
      <div class="header-badge">Table 1.0 • Transformation Engine Rules</div>
    </div>

    <div class="table-container">
      <table class="capstone-table">
        <thead>
          <tr>
            <th style="width: 5%;">Step</th>
            <th style="width: 10%;">Stage</th>
            <th style="width: 17%;">Source Table / Code</th>
            <th style="width: 32%;">Transformation & Calculation Business Rule</th>
            <th style="width: 18%;">Target Warehouse Entity</th>
            <th style="width: 18%;">Error Handling & Stop-and-Alert</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>01</strong></td>
            <td><span class="tbl-tag tbl-tag-extract">Extract</span></td>
            <td><code>db.ts</code> (loadSales, loadIngredients, loadBatches, loadExpenses)</td>
            <td>Pulls raw tables from Supabase PostgreSQL via PostgREST. If network failure is detected via <code>isNetworkError</code>, gracefully falls back to local cached snapshots.</td>
            <td>Client In-Memory Staging State + <code>localStorage</code></td>
            <td>Catch network exceptions; notify UI via non-blocking toast; switch data source mode to offline cache.</td>
          </tr>
          <tr>
            <td><strong>02</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>unitConversion.ts</code> (convertUnitQuantity)</td>
            <td>Converts recipe quantities into ingredient inventory units across mass (mg, g, kg, oz, lb), volume (ml, L, fl oz, shots, pumps, cups), and discrete counts (pcs, cans, bags).</td>
            <td><code>deductionsMap</code> in inventory units</td>
            <td>Throws error on incompatible unit categories (e.g. converting grams to milliliters without specified density).</td>
          </tr>
          <tr>
            <td><strong>03</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>orderCalc.ts</code> (computeLine)</td>
            <td><strong>Recipe Explosion:</strong> Multiplies raw quantities by <code>size.ingredient_multiplier</code>, appends addon recipe ingredients, and applies <code>usage_scope</code> ('always' | 'dine_in' | 'takeout').</td>
            <td><code>CartLine.deductions</code> & line prices</td>
            <td>Missing size or addon recipe row is skipped with zero cost increment; logged to console.</td>
          </tr>
          <tr>
            <td><strong>04</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>orderCalc.ts</code> (computeLine)</td>
            <td><strong>COGS Snapshot:</strong> Computes cost per serving from <code>actual_purchase_price</code> or <code>cost_per_unit</code>, split into <code>cogs_per_serving</code> vs <code>cogs_supplies_per_serving</code>.</td>
            <td><code>Fact_Sales.cogs_ingredients</code> & <code>cogs_supplies</code></td>
            <td>Fallback to 0 if ingredient cost is unconfigured; flags line item for margin review.</td>
          </tr>
          <tr>
            <td><strong>05</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>orderCalc.ts</code> (computeOrder)</td>
            <td><strong>Packaging Rules:</strong> Evaluates active <code>order_supply_rules</code>. Injects takeout cups, lids, and kraft bags into order deductions if <code>order_type == 'takeout'</code>.</td>
            <td><code>orderDeductions</code> & <code>orderSuppliesCogs</code></td>
            <td>Supplies shortage treated under overall order shortage check before sale confirmation.</td>
          </tr>
          <tr>
            <td><strong>06</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>POS.tsx</code> & <code>orderCalc.ts</code></td>
            <td><strong>Net Amount Calculation:</strong> Computes financial metric strictly as: <code>Net Sales = Subtotal (Gross) - Discount Amount</code>. Computes <code>Gross Profit = Net Sales - Total COGS</code>.</td>
            <td><code>Fact_Sales.net_amount</code> & <code>profit_amount</code></td>
            <td>Discount clamped to subtotal (discount cannot exceed gross); total cannot be negative.</td>
          </tr>
          <tr>
            <td><strong>07</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>db.ts</code> (loadBatches)</td>
            <td><strong>FEFO Allocation:</strong> Sorts batches by earliest expiration date first (nulls last), then earliest <code>received_at</code>. Depleted batches marked inactive; expired batches written off.</td>
            <td><code>ingredient_batches</code> & <code>sale_batch_allocations</code></td>
            <td>Expired batches blocked from sale deduction; triggers automated spoilage write-off prompt.</td>
          </tr>
          <tr>
            <td><strong>08</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>orderCalc.ts</code> (lineKey)</td>
            <td><strong>Cart Deduplication:</strong> Generates deterministic hash: <code>item_id__size_id__sortedAddons__note</code>. Merges identical line configurations to avoid duplicate line records.</td>
            <td>Consolidated Cart Line Item</td>
            <td>Case-insensitive note trimming prevents accidental split items on counter entry.</td>
          </tr>
          <tr>
            <td><strong>09</strong></td>
            <td><span class="tbl-tag tbl-tag-transform">Transform</span></td>
            <td><code>dateUtils.ts</code> (startOfDayLocal)</td>
            <td><strong>Timezone Normalization:</strong> Anchors timestamps to local Asia/Manila (UTC+8) time without day-shifting bugs, ensuring accurate daily financial reconciliation.</td>
            <td><code>Dim_Date.date_key</code> & Fact foreign keys</td>
            <td>Date strings lacking timezone parsed as local noon (12:00:00) to avoid calendar shift.</td>
          </tr>
          <tr>
            <td><strong>10</strong></td>
            <td><span class="tbl-tag tbl-tag-qc">Quality Check</span></td>
            <td><code>orderCalc.ts</code> (shortages)</td>
            <td><strong>Stock Shortage Verification:</strong> Evaluates combined ingredient needs against available <code>stock_quantity</code> across all active lines.</td>
            <td>Quality Gate Decision Diamond</td>
            <td><strong>STOP & ALERT:</strong> Sale blocked; displays shortage item modal with required vs available quantities.</td>
          </tr>
          <tr>
            <td><strong>11</strong></td>
            <td><span class="tbl-tag tbl-tag-load">Load (Atomic)</span></td>
            <td>Supabase RPC (complete_sale_with_deduction)</td>
            <td><strong>Atomic Database Load:</strong> Single PostgreSQL PL/pgSQL transaction inserts sale record, deducts batch & ingredient inventory, and writes stock_movements ledger.</td>
            <td><code>Fact_Sales</code> & <code>Fact_Inventory_Movement</code></td>
            <td><strong>STOP & ALERT:</strong> Any integrity or shortage error raises exception &rarr; transaction rolls back 100% atomically.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="page-footer">
      <span>Espro POS Capstone Project • Data Warehousing & ETL Pipeline Architecture</span>
      <span>Page 5 of 6 • ETL & Quality-Rules Table</span>
    </div>
    <div class="accent-bar-bottom"></div>
  </div>


  <!-- ══════════════════════════════════════════════════════════════════════════
       PAGE 6: SYSTEM-TO-DATA-WAREHOUSE MAPPING TABLE
       ══════════════════════════════════════════════════════════════════════════ -->
  <div class="sheet">
    <div class="accent-bar-top"></div>

    <div class="page-header">
      <div class="header-left">
        <div class="header-logo-icon">☕</div>
        <div class="header-title-group">
          <h1>System-to-Data-Warehouse Implementation Mapping Matrix</h1>
          <p>Academic Grounding: Enterprise Business Intelligence Concepts Mapped to Real Espro POS Source Code</p>
        </div>
      </div>
      <div class="header-badge">Table 2.0 • Architecture Mapping & Proof</div>
    </div>

    <div class="table-container">
      <table class="capstone-table">
        <thead>
          <tr>
            <th style="width: 18%;">Data Warehouse Concept</th>
            <th style="width: 32%;">Espro POS System Implementation</th>
            <th style="width: 25%;">Code Evidence & Artifacts</th>
            <th style="width: 25%;">Architectural Classification</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Operational Data Store (ODS)</strong></td>
            <td>Transactional Supabase PostgreSQL tables storing active counter transactions, raw stock items, employee profiles, and operational store expenses.</td>
            <td><code>supabase_schema.sql</code>, <code>supabase_recipe_schema.sql</code>, <code>supabase_migration_employees.sql</code></td>
            <td>Normalized relational schema (3NF) optimized for high-speed counter POS read/write throughput.</td>
          </tr>
          <tr>
            <td><strong>Staging Area</strong></td>
            <td>Client-side in-memory React state buffers and synchronized browser <code>localStorage</code> cache storing raw, uncommitted batches, cart drafts, and operational pulls.</td>
            <td><code>src/lib/db.ts</code> (getLocalBatches, getLocalIngredients), <code>src/pages/POS.tsx</code></td>
            <td>Temporary decoupled staging preventing lock contention on operational tables.</td>
          </tr>
          <tr>
            <td><strong>ETL Processing Engine</strong></td>
            <td>TypeScript algorithmic pipeline performing unit conversions, multi-tier recipe explosions, COGS snapshots, and net sales calculations.</td>
            <td><code>src/lib/orderCalc.ts</code> (computeLine, computeOrder), <code>src/lib/unitConversion.ts</code></td>
            <td>Distributed Client-Side Execution Layer with backend PL/pgSQL atomic RPC execution.</td>
          </tr>
          <tr>
            <td><strong>Data Quality & Anomaly Handling</strong></td>
            <td>Pre-flight shortage validation, unit category validation, and atomic PL/pgSQL rollback triggers stopping processing on anomalies with cashier notifications.</td>
            <td><code>orderCalc.ts</code> (shortages check), <code>complete_sale_with_deduction</code> (RAISE EXCEPTION)</td>
            <td><strong>"Stop and Alert Team"</strong> Routine implemented via atomic rollback and toast UI banners.</td>
          </tr>
          <tr>
            <td><strong>Conformed Dimensions</strong></td>
            <td>Standardized context entities shared across facts: Dim_Date, Dim_Product, Dim_Size, Dim_Addon, Dim_Ingredient, Dim_Employee_Cashier, Dim_OrderType.</td>
            <td><code>menu_items</code>, <code>menu_item_sizes</code>, <code>ingredients</code>, <code>employees</code>, <code>dateUtils.ts</code></td>
            <td>Conformed analytical dimensions enabling cross-functional slice & dice across sales and inventory.</td>
          </tr>
          <tr>
            <td><strong>Core Fact Tables</strong></td>
            <td>Fact_Sales storing granular line item measurements (Quantity, Gross, Discount, Net Sales, Ingredient COGS, Supplies COGS, Profit Amount).</td>
            <td><code>sales</code> (items JSONB + financial totals), <code>stock_movements</code>, <code>expenses</code></td>
            <td>Transaction Grain & Periodic Snapshot Fact Tables storing additive quantitative metrics.</td>
          </tr>
          <tr>
            <td><strong>Localized Data Marts</strong></td>
            <td>Specialized analytical aggregations: Sales Mart (revenue trends), Inventory Mart (valuation & turnover), Finance Mart (P&L statement), Workforce Mart (labor hours).</td>
            <td><code>src/pages/Reports.tsx</code> (metrics useMemo), <code>src/pages/Dashboard.tsx</code>, <code>src/pages/Inventory.tsx</code></td>
            <td>Domain-specific analytical marts providing fast query response for targeted operational roles.</td>
          </tr>
          <tr>
            <td><strong>OLAP Processing Logic</strong></td>
            <td>In-memory multi-dimensional analytical engine supporting slice, dice, roll-up (hourly to monthly), drill-down (KPI to line deductions), and period comparison.</td>
            <td><code>Reports.tsx</code> (salesFiltered useMemo, datePresets), <code>dateUtils.ts</code> (getPresetDateRange)</td>
            <td>Real-Time Desktop & Web OLAP Engine with reactive sub-second re-aggregation upon filter changes.</td>
          </tr>
          <tr>
            <td><strong>Role-Based Analytics & BI</strong></td>
            <td>Role-gated dashboards serving Executive Owner (P&L, break-even, PDF/CSV export), Store Manager (inventory, batches, staff), and Cashier (counter KPIs).</td>
            <td><code>src/App.tsx</code> (ProtectedRoute adminOnly), <code>src/lib/reportExport.ts</code> (exportFullReportPdf)</td>
            <td>Stakeholder Role-Based Access Control (RBAC) delivering tailored business intelligence.</td>
          </tr>
        </tbody>
      </table>

      <!-- Honest Architecture Disclosure Note -->
      <div class="callout-honest">
        <strong>Academic Architecture Note & Honest Design Disclosure:</strong><br/>
        In Espro POS, the Data Warehouse layer is an <em>in-database logical schema and client-side OLAP engine</em> implemented within Supabase PostgreSQL, atomic PL/pgSQL stored procedures, and React 19 memoized pipelines—rather than an over-engineered detached MPP cloud warehouse (such as Snowflake or Google BigQuery). This architectural design is deliberate and optimal for small-to-medium specialty coffee retail: it eliminates external ETL pipeline latency, guarantees atomic transactional consistency during peak counter ordering, provides instant offline operational resilience via <code>localStorage</code>, and avoids the significant cloud compute costs of enterprise data warehouses while achieving full dimensional reporting fidelity.
      </div>
    </div>

    <div class="page-footer">
      <span>Espro POS Capstone Project • Data Warehousing & ETL Pipeline Architecture</span>
      <span>Page 6 of 6 • System-to-Data-Warehouse Mapping</span>
    </div>
    <div class="accent-bar-bottom"></div>
  </div>

</body>
</html>
  `;

  // Write temporary HTML file for inspection and browser rendering
  const tempHtmlPath = path.join(docsDir, 'temp_pipeline_render.html');
  fs.writeFileSync(tempHtmlPath, fullHtml, 'utf-8');

  console.log('Rendering HTML in headless browser...');
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  // 1. Export High-Resolution PNG of Page 2 (The Flowchart Diagram)
  console.log('Capturing high-resolution PNG of Page 2 (Flowchart Diagram)...');
  const flowchartElement = (await page.$$('.sheet'))[1]; // Page 2 index is 1
  if (flowchartElement) {
    const pngPath = path.join(docsDir, 'espro_data_pipeline_flowchart.png');
    await flowchartElement.screenshot({
      path: pngPath,
      type: 'png',
      omitBackground: false,
    });
    console.log(`Saved flowchart PNG to: ${pngPath}`);
  }

  // 2. Export 6-Page Landscape A4 PDF
  const pdfOutputPath = path.join(docsDir, 'Espro_Data_Pipeline_Architecture.pdf');
  console.log(`Generating multi-page Landscape A4 PDF to: ${pdfOutputPath}...`);

  await page.pdf({
    path: pdfOutputPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    displayHeaderFooter: false,
    preferCSSPageSize: true,
  });

  await browser.close();

  // Clean up temporary HTML file
  try {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  } catch (err) {}

  console.log(`\n🎉 SUCCESS! Generated Data Pipeline Architecture PDF:\n-> ${pdfOutputPath}`);
  return pdfOutputPath;
}

// Direct execution wrapper
buildDataPipelinePdf().catch((err) => {
  console.error('Error generating Data Pipeline Architecture PDF:', err);
  process.exit(1);
});
