// ─── Espro POS System User Manual - Canonical Content Specification ───
// Fully enriched with detailed field references, operational business rules, and step-by-step tasks.

export const manualMeta = {
  "title": "Espro POS",
  "subtitle": "System User Manual",
  "tagline": "Retail & Cafe Operations Hub",
  "guideSubtitle": "Administrator & Employee Operational Guide",
  "version": "1.0",
  "documentId": "ESPRO-MAN-2026-V1",
  "date": "October 2026",
  "preparedFor": "Espro Coffee & Tea",
  "preparedBy": "Espro Technical Documentation & Operations Architecture Team",
  "currency": "Philippine Peso (₱)",
  "timezone": "Asia/Manila (GMT+8)"
};

export const documentControl = {
  "version": "1.0",
  "releaseDate": "October 2026",
  "classification": "Confidential – Internal Operations Use Only",
  "preparedBy": "Espro Technical Documentation & Operations Architecture Team",
  "approvedBy": "Cafe Operations Management & Systems Administration",
  "targetAudience": "Cafe Owners, Store Managers, Shift Supervisors, Head Baristas, Cashiers, and Operational Staff",
  "revisions": [
    {
      "version": "1.0",
      "date": "October 2026",
      "author": "Technical Documentation Team",
      "notes": "Initial comprehensive system user manual release for Espro POS Hub (v1.0)."
    }
  ]
};

export const chapters = [
  {
    "id": "ch1",
    "number": 1,
    "title": "Introduction & System Overview",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter provides an executive overview of Espro POS, outlines its core functional modules, details user roles and access permissions, and defines standard cafe operations terminology.",
    "whereToFind": "System Root & General Architecture",
    "overview": "Espro POS is a dedicated, cloud-synchronized point-of-sale and retail operations management hub engineered specifically for Philippine specialty coffee shops, tea bars, and quick-service cafes. Built with a responsive React architecture and powered by Supabase PostgreSQL, the system seamlessly bridges front-of-house transaction processing with back-of-house inventory tracking, automated recipe costing, employee timekeeping, and comprehensive financial reporting. Operating natively in Philippine Peso (₱) under the Asia/Manila timezone, Espro POS eliminates common friction points in daily cafe management—such as manual stock counting, ingredient shrinkage, unrecorded cash variations, and inaccurate recipe margins.",
    "screenshot": {
      "label": "[Screenshot: Global System Architecture – Main Counter Navigation, Top Bar Utilities, and Responsive Layout]",
      "caption": "Figure 1.1 – Espro POS application framework and operational hub navigation."
    },
    "sections": [
      {
        "heading": "1.1 What Espro POS Is",
        "content": "Espro POS is designed from the ground up to solve the distinct operational challenges of modern coffee shops. Unlike generic retail POS software, Espro POS treats every menu item as an assembly of raw ingredients and packaging supplies. When a barista sells a single iced latte, the system automatically calculates the cost of goods sold (COGS), deducts espresso beans, fresh milk, and simple syrup from the earliest expiring inventory batches, and accounts for the single-use cup, dome lid, and straw if ordered for takeout.\n\nThe system features real-time synchronization between counter terminals, mobile tablets, and back-office management dashboards, while offering robust local storage failover to ensure transaction continuity even during intermittent internet disruptions."
      },
      {
        "heading": "1.2 Core System Capabilities",
        "content": "Espro POS encompasses five primary operational pillars:\n\n1. High-Velocity Point of Sale (POS):\n   - Touch-optimized product grid with instant category filtering and real-time inventory availability indicators.\n   - Dynamic Dine-in vs Takeout order toggling that automatically modulates packaging deductions.\n   - Multi-size drink configuration (up to 6 sizes) with automatic ingredient multipliers.\n   - Flexible beverage customizations and add-ons with recipe-level ingredient deductions.\n   - Dual payment processing (Cash with automated change calculation and Digital QR / GCash confirmation).\n   - Instant 80mm thermal receipt rendering and printing.\n\n2. Real-Time FEFO Inventory Control:\n   - First-Expired, First-Out (FEFO) batch tracking ensuring older perishable goods are consumed first.\n   - Dual item classification: Raw Ingredients (coffee beans, milk, syrups) vs Packaging Supplies (cups, lids, bags).\n   - Automated write-off mechanism for expired inventory batches.\n   - Interactive stock health indicators (Low Stock, Out of Stock, Near Expiry, Expired).\n   - Batch-weighted inventory valuation reports with one-click PDF and CSV export.\n\n3. Atomic Recipe Costing & Margin Intelligence:\n   - Ingredient-level recipe formulation with universal unit conversion (mass, volume, count units).\n   - Real-time COGS computation for both Dine-in and Takeout serving modes.\n   - Visual profit margin health indicators (High > 70%, Medium 50–70%, Low < 50%).\n   - Order-level packaging supply rules for takeout carry bags and cup sleeves.\n\n4. Counter Time Clock Kiosk & Attendance Guard:\n   - Shared counter attendance terminal with individual 4-digit PIN verification.\n   - Shift tracking (Clock In, Start Break, End Break, Clock Out) with late arrival tracking (> 5 min threshold).\n   - Integrated POS Selling Permission: Automatically blocks baristas from ringing up sales unless actively clocked in.\n   - Managerial attendance adjustments with mandatory audit log remarks.\n   - One-click payroll timesheet export with automatic overtime (1.25x) calculation.\n\n5. Unified Financial Reporting & Expense Management:\n   - Real-time Sales Ledger with item-level inspection popovers for desktop and mobile touchscreens.\n   - Transaction status lifecycle: Completed, Voided (stock restored), and Refunded (stock kept as spoilage).\n   - Dual-section Expense Tracker: Sales-driven COGS breakdown plus itemized Operating Expenses (OPEX).\n   - Full Profit & Loss (P&L) statement, gross margin analysis, and break-even sales calculation.\n   - Multi-format audit exports (Current View PDF, Line-Items CSV, and Complete Audit Pack PDF)."
      },
      {
        "heading": "1.3 Who Uses Espro POS & User Roles",
        "content": "Espro POS defines two distinct user roles to balance operational efficiency with financial security:\n\n1. Administrator (Store Owners, General Managers):\n   - Unrestricted access to every page, configuration setting, and financial ledger.\n   - Full authority to create, edit, and delete Menu items, Recipes, Sizes, and Add-ons.\n   - Exclusive access to Financial Reports, Sales Voiding, Employee Directory, and System User Accounts.\n   - Automatic POS Clock-In Bypass: Administrators can ring up sales immediately without clocking into the Time Clock Kiosk.\n\n2. Employee (Head Baristas, Baristas, Cashiers, Kitchen Staff):\n   - Streamlined counter access to Dashboard, Point of Sale (POS), Receipt Printing, Inventory Management, Expense Recording, and Personal Settings.\n   - Blocked from administrative modules: Menu Engineering, Financial Reports, Employee Directory & Payroll, and User Management.\n   - Selling Lock: Must be actively clocked in and not on break at the Time Clock Kiosk to complete sales at the POS."
      },
      {
        "heading": "1.4 Role-Access Control Matrix",
        "content": "The following matrix specifies permission boundaries across all operational areas of Espro POS:",
        "table": {
          "headers": [
            "Module / Functional Route",
            "Administrator",
            "Employee (Barista/Cashier)",
            "Enforcement & Operational Rules"
          ],
          "rows": [
            [
              "Dashboard (/dashboard)",
              "Full Access",
              "Full Access",
              "All users view real-time sales metrics, charts, and low stock warnings."
            ],
            [
              "Point of Sale (/pos)",
              "Full Access (Bypass)",
              "Access (Clock-in Required)",
              "Employees must be clocked in and not on break. Admins bypass clock-in."
            ],
            [
              "Receipt View (/pos/receipt/:id)",
              "Full Access",
              "Full Access",
              "80mm thermal receipt viewing, re-printing, and new sale navigation."
            ],
            [
              "Menu & Recipes (/menu)",
              "Full Access",
              "Access Blocked (Redirects)",
              "Protected route. Non-admin users are automatically redirected to Dashboard."
            ],
            [
              "Inventory Management (/inventory)",
              "Full Access",
              "Full Access",
              "All staff can view stock, restock deliveries, and adjust quantities."
            ],
            [
              "Expense Management (/expenses)",
              "Full Access",
              "Full Access",
              "Staff can log daily operational expenses; view COGS and OPEX breakdown."
            ],
            [
              "Financial Reports (/reports)",
              "Full Access",
              "Access Blocked (Redirects)",
              "Protected route. Contains revenue, P&L, voids, refunds, and payroll data."
            ],
            [
              "Employee Management (/employees)",
              "Full Access",
              "Access Blocked (Redirects)",
              "Protected route. Staff directory, PIN codes, hourly wages, and roster."
            ],
            [
              "Time Clock Kiosk (Modal)",
              "Full Access",
              "Full Access",
              "Accessible from Top Bar by all staff to clock in, break, and clock out."
            ],
            [
              "User Management (/users)",
              "Full Access",
              "Access Blocked (Redirects)",
              "Protected route. System login account creation, passwords, and disabling."
            ],
            [
              "Account Settings (/settings)",
              "Full Access",
              "Full Access",
              "Personal profile view and self-service password update."
            ],
            [
              "Void / Cancel Completed Sale",
              "Full Access",
              "Blocked",
              "Only Administrators can void or refund completed transactions in Reports."
            ],
            [
              "Adjust Raw Stock / Spoilage",
              "Full Access",
              "Full Access",
              "Staff can deduct wasted/spoiled stock or set exact physical count."
            ],
            [
              "Export Valuation / Audit PDFs",
              "Full Access",
              "Valuation PDF only",
              "Employees can export inventory valuation; audit packs restricted to Admins."
            ]
          ]
        }
      },
      {
        "heading": "1.5 Operational Glossary",
        "content": "To ensure consistent communication across all cafe staff, the following industry terms are utilized throughout this manual and within the software interface:\n\n- COGS (Cost of Goods Sold): The direct monetary cost of raw ingredients (beans, dairy, syrups) and single-use packaging supplies consumed to produce and serve sold items.\n- FEFO (First-Expired, First-Out): An inventory management principle where batches with the earliest expiration date are consumed first during sales deductions, minimizing spoilage.\n- Batch: A distinct delivery shipment of an inventory item defined by a received date, quantity received, remaining quantity, purchase cost per unit, and expiration date.\n- Raw Ingredient: An inventory item consumed directly in beverage or food preparation (e.g., Espresso Beans, Whole Milk, Vanilla Syrup, Matcha Powder).\n- Packaging Supply: A non-edible single-use operational item required for service (e.g., 16oz Hot Cups, 22oz Cold Cups, Dome Lids, Paper Straws, Takeout Bags).\n- Dine-in vs Takeout Scope: A rule applied to packaging supplies in recipes. Dine-in items exclude disposable cups and carry bags, whereas Takeout items automatically include them.\n- Size Multiplier: A numeric scaling factor applied to raw recipe ingredients when a customer orders different beverage sizes (e.g., Regular = 1.0x, Large = 1.5x).\n- Add-on: An optional extra customization applied to a menu item (e.g., Extra Espresso Shot, Oat Milk Upgrade, Caramel Drizzle) with independent pricing and recipe deductions.\n- 4-Digit PIN: A unique 4-digit security code assigned to each employee for fast attendance verification at the shared counter Time Clock Kiosk.\n- Time Clock Kiosk: A full-screen counter modal where employees punch in for their shifts, initiate break periods, end breaks, and clock out.\n- Void Sale: An administrative action that marks a transaction as null and restores all deducted ingredient and supply quantities back into active inventory batches.\n- Refund Sale: An administrative action that refunds customer payment but does NOT restore inventory stock, recording consumed goods as operational spoilage/wastage."
      }
    ]
  },
  {
    "id": "ch2",
    "number": 2,
    "title": "Getting Started & Interface Navigation",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter explains how to sign in to Espro POS, recover forgotten passwords, navigate the desktop and tablet layouts, and utilize top-bar utility controls.",
    "whereToFind": "Login Screen (/login) & Global Application Layout",
    "overview": "Espro POS is accessible via any modern desktop, laptop, or tablet web browser. The application features a persistent left-hand navigation sidebar, a responsive top utility bar, and fluid layout scaling optimized for high-volume coffee counter environments.",
    "screenshot": {
      "label": "[Screenshot: Login Screen – Centered Authentication Card with Demo Credentials Hint and Forgot Password Link]",
      "caption": "Figure 2.1 – Espro POS Authentication Gateway with automatic domain resolution."
    },
    "sections": [
      {
        "heading": "2.1 Logging In to Espro POS",
        "content": "To access the system, open the application URL in Google Chrome, Microsoft Edge, or Safari. The authentication screen displays a coffee-themed interface with input fields for your user credentials.\n\nConvenient Username Auto-Completion:\nYou do not need to type the full domain name if your account belongs to the cafe organization. Simply typing your username (for example, \"admin\" or \"barista.maria\") will automatically be resolved by the system to \"admin@espro.ph\" or \"barista.maria@espro.ph\".",
        "tasks": [
          {
            "title": "Standard Login Procedure",
            "steps": [
              "Navigate to the application web address.",
              "Click into the Email input field and enter your assigned email address or username.",
              "Click into the Password field and type your password. Click the Eye icon on the right to toggle password visibility if needed.",
              "Click the Log In button or press [Enter] on your keyboard.",
              "Expected Result: The system authenticates your credentials, displays a \"Welcome back!\" toast notification, and redirects you directly to the Dashboard."
            ]
          }
        ],
        "callouts": [
          {
            "type": "NOTE",
            "title": "Pre-Configured Demo Accounts",
            "content": "For staff training, offline testing, or initial onboarding, Espro POS includes two pre-configured accounts: Administrator (admin@espro.ph / admin123) with full system privileges, and Staff (staff@espro.ph / staff123) with standard employee privileges."
          },
          {
            "type": "IMPORTANT",
            "title": "Kiosk-Only Staff vs System Accounts",
            "content": "Employees who are registered only for Time Clock Kiosk attendance (counter staff who only punch PINs) cannot log into the web system. If an employee requires system access, an Administrator must enable \"Grant ESPRO System Login Access\" in Employee Management."
          }
        ],
        "table": {
          "headers": [
            "Field",
            "Required",
            "Description",
            "Validation / Example"
          ],
          "rows": [
            [
              "Email / Username",
              "Yes",
              "Registered email address or username prefix.",
              "e.g., admin or admin@espro.ph"
            ],
            [
              "Password",
              "Yes",
              "Account password set by Administrator.",
              "Minimum 6 characters."
            ],
            [
              "Show Password Toggle",
              "Optional",
              "Reveals masked password characters.",
              "Eye / Eye-off icon toggle."
            ]
          ]
        }
      },
      {
        "heading": "2.2 Password Recovery & Reset",
        "content": "If you forget your password, you can initiate a self-service reset provided your account has an email address configured on the Supabase authentication server.",
        "tasks": [
          {
            "title": "Resetting Your Password",
            "steps": [
              "On the login screen, click the \"Forgot password?\" link located above the password field.",
              "Enter your registered email address (e.g., barista@espro.ph) and click \"Send Reset Link\".",
              "Check your email inbox for a secure recovery link sent by Espro POS.",
              "Click the reset link in the email. The application opens the Set New Password view.",
              "Enter your new password (minimum 6 characters), re-enter it in the Confirm Password field, and click \"Update Password\".",
              "Expected Result: A confirmation toast appears and you are redirected to the Login screen to sign in with your new password."
            ]
          }
        ]
      },
      {
        "heading": "2.3 Navigating the User Interface",
        "content": "Espro POS is structured into two persistent navigation zones: the Left Sidebar and the Top Utility Bar.\n\n1. The Persistent Left Sidebar:\n   - Logo & Store Branding: Displays the Espro Coffee icon and brand name.\n   - Primary Navigation Links: Quick access to Dashboard, POS, Menu (Admin only), Inventory, Expenses, Reports (Admin only), Employees (Admin only), and Users (Admin only).\n   - Collapse / Expand Toggle: Desktop users can collapse the sidebar into an icon-only strip by clicking the Chevron button located in the sidebar margin, maximizing screen space for POS product grids.\n   - Active Pill Indicator: A smooth animated pill indicates your currently active module.\n   - New Sale CTA Button: A prominent button that immediately navigates to the POS screen from anywhere.\n   - User Profile Footer: Displays your user avatar, display name, assigned role, Settings gear icon, and Sign Out button.\n\n2. The Top Utility Bar:\n   - Module Title: Indicates the current page name.\n   - Global Search Field: Available on catalog and inventory pages for quick filtering.\n   - Time Clock Kiosk Button: A high-visibility button that immediately opens the counter attendance kiosk.\n   - Inventory Notifications Bell: Shows a real-time badge count of active stock alerts. Clicking opens an alert drawer listing Out of Stock, Low Stock, and Near Expiry items with one-click navigation to Inventory.\n   - Help & Support Popover: Displays administrative contact info (admin@espro.ph) for fast assistance.\n   - User Avatar: Clicking your avatar immediately navigates to your Account Settings page."
      },
      {
        "heading": "2.4 Mobile & Tablet Usage Guidelines",
        "content": "Espro POS is responsive across POS touchscreen terminals, Apple iPads, Android tablets, and smartphones:\n- On tablet and mobile viewports (screen width ≤ 768px), the sidebar collapses into a hidden drawer.\n- Tap the Hamburger Menu icon in the top left to reveal navigation.\n- Touchscreen Swipe Gestures: Swiping right from the left screen edge opens the navigation drawer; swiping left closes it.\n- In POS view on tablets, the product grid and order cart automatically stack vertically or adjust columns to ensure large, thumb-friendly tap targets."
      }
    ]
  },
  {
    "id": "ch3",
    "number": 3,
    "title": "Dashboard Overview & Real-Time Metrics",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter details how to monitor cafe performance, track today’s revenue, inspect sales trend charts, review urgent inventory alerts, and analyze top-selling items.",
    "whereToFind": "Sidebar: Dashboard (/dashboard)",
    "overview": "The Dashboard serves as the central operational cockpit for cafe staff and management. Loading immediately upon sign-in, it aggregates real-time transactions and raw inventory levels into high-impact metric cards, dynamic sales volume charts, and actionable restock lists. Metrics automatically re-calculate whenever the window gains focus or a transaction completes.",
    "screenshot": {
      "label": "[Screenshot: Dashboard – 5 Metric Cards at Top, Sales Trend Area Chart, Low-Stock Alert List, and Best-Sellers Leaderboard]",
      "caption": "Figure 3.1 – Espro POS Operational Dashboard displaying live daily metrics and sales momentum."
    },
    "sections": [
      {
        "heading": "3.1 The Five Live Metric Cards",
        "content": "Across the top of the dashboard are five real-time operational stat cards:\n\n1. Today's Total Sales (Hero Card):\n   - Displays gross revenue accumulated from all completed sales for the current calendar day in Philippine Peso (₱).\n   - Subtitle displays the exact transaction count for today.\n   - One-click navigation: Clicking the card directs Administrators to Financial Reports, and Employees directly to the POS.\n\n2. Transaction Count:\n   - Total number of successful sales processed today.\n   - Subtitle indicates operational status (\"Completed today\" or \"No sales yet today\").\n\n3. Total Ingredients in Stock:\n   - Total count of active raw ingredient lines with remaining stock > 0.\n   - Subtitle indicates total catalog items tracked. Clicking navigates directly to Inventory Management.\n\n4. Stock Alerts:\n   - High-priority indicator displaying the combined number of Low Stock items (at or below threshold) and Out of Stock items (0 remaining).\n   - Displays warning orange if low items exist, or danger red if items are completely depleted.\n   - Clicking navigates directly to Inventory filtered to depleted or low stock items.\n\n5. Top Seller Today:\n   - Displays the name of the most frequently ordered menu item today (including size variant if applicable).\n   - Subtitle displays total units sold today."
      },
      {
        "heading": "3.2 Sales Trend Analytics",
        "content": "Directly beneath the metric cards is an interactive sales area chart providing visual feedback on transaction momentum. Users can switch between three reporting timeframes:\n\n- Today: Displays hourly sales performance from 6:00 AM to 10:00 PM, allowing supervisors to identify peak morning rush and afternoon slump hours.\n- Weekly: Displays daily gross revenue across the past 7 days, highlighting weekend volume patterns.\n- Monthly: Displays daily sales performance across the past 30 days, providing owners with macro revenue trajectory.",
        "callouts": [
          {
            "type": "TIP",
            "title": "Monitoring Peak Brewing Hours",
            "content": "Use the \"Today\" hourly sales trend during shift handovers to staff the bar appropriately ahead of typical 8:00 AM to 10:00 AM and 2:00 PM to 4:00 PM peak periods."
          }
        ]
      },
      {
        "heading": "3.3 Stock Alerts List & Quick Resolution",
        "content": "The bottom left quadrant highlights ingredients requiring immediate restocking. Any item whose stock level is zero or has fallen below its configured reorder threshold appears with its current balance, unit of measurement, and threshold target. Clicking any alert row navigates immediately to the Restock modal for that specific ingredient."
      },
      {
        "heading": "3.4 Best-Sellers Leaderboard",
        "content": "The bottom right quadrant displays the Top 10 selling menu items ranked by volume. Staff can toggle the ranking timeframe between Today, This Week, and This Month. Each row details:\n- Rank number (#1 to #10 with flame badges for top items).\n- Item name and size (e.g., \"Spanish Latte (Large)\").\n- Menu category (Beverages, Pastries, etc.).\n- Units sold count.\n- Gross revenue generated in Philippine Peso (₱)."
      },
      {
        "heading": "3.5 Dashboard Interface & Metric Reference Table",
        "content": "The following reference table explains each KPI card, data visualization, and filter control available on the executive dashboard:",
        "table": {
          "headers": [
            "Dashboard Control / Card",
            "Data Source / Computation",
            "Operational Significance",
            "Recommended Action Threshold"
          ],
          "rows": [
            [
              "Today Sales (₱)",
              "Sum of all completed orders settled between 00:00:00 and 23:59:59 (Asia/Manila). Excludes voided orders.",
              "Primary daily cash flow and counter sales volume.",
              "Monitor against daily cafe revenue target (e.g., ₱15,000/day)."
            ],
            [
              "Orders Today",
              "Total count of completed transactions processed by cashiers today.",
              "Customer transaction frequency and counter speed of service.",
              "Analyze peak volume relative to scheduled barista staffing."
            ],
            [
              "Total Ingredients in Stock",
              "Count of raw ingredient catalog items with active stock quantity > 0.",
              "General ingredient availability for counter brewing.",
              "If count decreases unexpectedly, check for missing delivery receipts."
            ],
            [
              "Stock Alerts Card",
              "Count of inventory items where Remaining Stock <= Minimum Reorder Threshold.",
              "Immediate early warning indicator for critical stockouts.",
              "Immediate restock order required if count > 0."
            ],
            [
              "Top Seller Today",
              "Menu item variant with the highest cumulative units sold today.",
              "Identifies customer preference trends and prep station load.",
              "Ensure sufficient prep (e.g., cold brew batching, milk restock)."
            ],
            [
              "Sales Trend Range Switcher",
              "Toggles between \"Today\" (hourly 6am-10pm), \"Weekly\" (7 days), and \"Monthly\" (30 days).",
              "Provides multi-horizon revenue visualization.",
              "Use Weekly during weekend scheduling; Monthly for accounting."
            ],
            [
              "Best-Sellers Timeframe Filter",
              "Filters Top 10 leaderboard by Today, This Week, or This Month.",
              "Ranks menu items by volume and gross revenue.",
              "Identify underperforming items for potential menu rotation."
            ]
          ]
        }
      },
      {
        "heading": "3.6 Operational Business Rules for Dashboard Data",
        "content": "The Dashboard adheres to strict computational business rules to ensure data accuracy:\n- Timezone Alignment: All daily metrics calculate based on Asia/Manila (PHT, UTC+8) calendar boundaries starting at 12:00:00 AM.\n- Exclusion of Voided Orders: When an order is voided by an Administrator in Financial Reports, its gross revenue and unit count are immediately subtracted from Today Sales and Orders Today.\n- Stock Status Calculation: Stock alerts dynamically query remaining active batch balances. Items with 0 remaining stock are categorized as \"Out of Stock\", while items with stock > 0 but <= minimum threshold are flagged as \"Low Stock\".\n- Leaderboard Ranking: The Best-Sellers widget ranks items based on total quantity sold. In the event of a tie, the item with the higher gross monetary revenue is ranked higher."
      },
      {
        "heading": "3.7 Step-by-Step Task: Shift Handover & Stock Audit",
        "content": "Shift Supervisors should execute this sequence during mid-day and evening shift handovers:",
        "tasks": [
          {
            "title": "Conducting Shift Handover Review",
            "steps": [
              "Log in to Espro POS using Supervisor or Admin credentials.",
              "Review Today Sales (₱) and Orders Today on the top metric cards.",
              "Inspect the Sales Trend chart to verify hourly transaction cadence.",
              "Click the \"Stock Alerts\" card to review depleted or critically low ingredients.",
              "Record required inventory prep (e.g., brewing simple syrup, thawing pastries) in the handover log book."
            ],
            "expectedResult": "Shift supervisor has verified daily sales figures and identified all inventory items requiring restock before the next shift rush."
          }
        ]
      }
    ]
  },
  {
    "id": "ch4",
    "number": 4,
    "title": "Point of Sale (POS) & Order Processing",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter provides an exhaustive guide to ringing up orders, configuring sizes and add-ons, handling dine-in vs takeout packaging, applying discounts, enforcing attendance locks, completing cash and digital payments, and printing thermal receipts.",
    "whereToFind": "Sidebar: Sales Management (POS) (/pos) or Top Bar \"New Sale\"",
    "overview": "The POS module is the core transactional engine of Espro POS. Designed for maximum speed and ergonomic touch interaction, it pairs a visual menu catalog with an intelligent cart calculation engine that validates raw inventory in real time, preventing baristas from selling drinks with depleted ingredients.",
    "screenshot": {
      "label": "[Screenshot: POS Screen – Product Grid on Left with Availability Badges, Active Cart on Right with Dine-in Toggle, and Checkout Controls]",
      "caption": "Figure 4.1 – Espro POS Register with live inventory availability checks and order calculation."
    },
    "sections": [
      {
        "heading": "4.1 Screen Overview & Layout Regions",
        "content": "The POS screen is organized into two primary operational zones:\n\n1. Left Panel – Menu Catalog & Selection:\n   - Category Filter Chips: Horizontal scrolling chips (\"All\", \"Espresso\", \"Non-Coffee\", \"Pastries\", etc.) to filter the catalog.\n   - Catalog Search Bar: Instant text filter by item name.\n   - Product Grid: Large touch-friendly cards showing product photo, item name, starting price, and stock status badges.\n\n2. Right Panel – Active Order Cart:\n   - Order Type Toggle: Prominent pill switch to select \"Dine-in\" or \"Takeout\".\n   - Line Items List: Detailed breakdown of each ordered item, showing quantity controls, size badges, custom add-ons, and special preparation notes.\n   - Order Discount Controls: Toggle between fixed Peso (₱) or percentage (%) discount.\n   - Financial Summary: Subtotal, Discount Deductions, and Grand Total Amount Due.\n   - Action Buttons: Clear / Void Cart, and Complete Sale checkout button."
      },
      {
        "heading": "4.2 Product Cards & Availability Badges",
        "content": "Every product card in the POS grid undergoes automated background inventory evaluation against its underlying recipe:\n\n- Available Servings Counter: Displays how many servings can be prepared based on the lowest common denominator of remaining raw ingredient stock.\n- Out of Stock Badge: If any critical raw ingredient reaches 0, the card is visually dimmed with a red \"Out of Stock\" badge and disabled from selection.\n- No Recipe Badge: If an item has been created in the menu but has no ingredient recipe assigned, a neutral \"No Recipe\" badge appears.\n- Multiple Sizes Badge: Items configured with multiple sizes display a \"Sizes\" tag and show a \"From ₱XX.XX\" base price."
      },
      {
        "heading": "4.3 Dine-In vs Takeout Toggle (Packaging Impact)",
        "content": "At the top of the cart is the Order Type toggle. Choosing between Dine-in and Takeout has a direct, automated effect on inventory deductions:\n\n- Dine-in Mode: Packaging supplies marked as \"Takeout only\" (such as single-use paper cups, plastic cold cups, dome lids, cup carriers, and takeout paper bags) are NOT deducted from inventory. Reusable glassware and ceramic mugs are presumed.\n- Takeout Mode: The system automatically includes and deducts all disposable packaging supplies associated with the drink sizes, plus any order-level supply rules (e.g., one takeout bag per order).\n\nSwitching the toggle dynamically re-computes all cart lines and adjusts the packaging COGS accordingly."
      },
      {
        "heading": "4.4 Size Picker Modal",
        "content": "When a barista taps a menu item that offers multiple sizes (for example, Regular 12oz vs Large 16oz), the Size Picker Modal appears automatically:\n- Lists all active sizes in configured display order.\n- Highlights the default size.\n- Displays the price and ingredient multiplier for each size.\n- Tapping a size immediately adds the item to the cart with the selected size configuration.\n- Baristas can also change an existing cart line's size at any time by tapping the size badge on the line item."
      },
      {
        "heading": "4.5 Add-ons & Custom Customer Notes",
        "content": "Coffee customers frequently request recipe modifications. Tapping the \"Addons\" button on any cart line opens the Customization Modal:\n- Displays all add-ons eligible for the item’s category (e.g., Extra Espresso Shot, Oat Milk Swap, Vanilla Syrup, Whipped Cream).\n- Increment/decrement quantity selectors for each add-on.\n- Special Instructions Text Box: Allows entering custom barista notes (e.g., \"Less ice\", \"Extra hot\", \"Warm milk\").\n- Tapping \"Apply\" recalculates the unit price, appends the add-on costs, updates recipe ingredient deductions, and attaches the note to the cart line."
      },
      {
        "heading": "4.6 Cart Line Merging Rules",
        "content": "To prevent cluttered receipts, Espro POS incorporates an automated line-merging engine. Two items will merge into a single line with an incremented quantity if and only if all of the following match exactly:\n1. Identical Menu Item ID.\n2. Identical Size Selection (or both having no size).\n3. Identical Add-ons list (exact same add-on IDs and quantities).\n4. Identical Special Instructions Note (case-insensitive and trimmed).\n\nIf any customization differs (for instance, one latte has \"Oat Milk\" and the other has regular milk), they remain separate cart lines."
      },
      {
        "heading": "4.7 Discounts & Total Due Calculation",
        "content": "Cashiers can apply promotional or senior citizen/PWD discounts before finalizing an order:\n- Fixed Discount: Click [₱], enter the cash amount to deduct. The value is strictly clamped between ₱0.00 and the order subtotal.\n- Percentage Discount: Click [%], enter the percentage (e.g., 20 for 20% senior citizen discount). The value is strictly clamped between 0% and 100%.\n- Total Calculation Formula: Total Due = Maximum(0, Subtotal - Discount Amount). All values round to two decimal places."
      },
      {
        "heading": "4.8 Employee Attendance Lock & Admin Bypass",
        "content": "Espro POS enforces strict operational accountability at the register:\n- If a logged-in Employee attempts to checkout without clocking in at the Time Clock Kiosk, the checkout button displays a lock icon and an alert banner appears: \"Staff member is not clocked in. You must clock in at the Time Clock to process sales.\"\n- If the cashier is currently on break, the system blocks sales with: \"Staff member is currently on break. Please end your break at the Time Clock.\"\n- Administrator Bypass: If the active user has the Administrator role, clock-in enforcement is automatically bypassed, allowing owners and managers to process emergency sales immediately."
      },
      {
        "heading": "4.9 Checkout Flow & Confirm Order Modal",
        "content": "Tapping \"Complete Sale\" performs an instant inventory feasibility check and opens the Confirm Order Modal:",
        "tasks": [
          {
            "title": "Processing Cash Tender",
            "steps": [
              "Review the order summary breakdown, confirming item sizes, add-ons, and final total due.",
              "Click the \"Cash Payment\" tab (selected by default).",
              "The Amount Received field defaults to the exact order total. If the customer hands over bills, enter the tendered amount or click a Quick Tender Chip (Exact, ₱100, ₱200, ₱500, ₱1,000, next ₱500/₱1,000).",
              "Observe the live Change Due banner. If the amount tendered is less than the total, a red \"Short by ₱XX.XX\" warning appears and checkout is disabled.",
              "Click \"Complete Order\" or press [Enter] on your keyboard.",
              "Expected Result: The transaction is committed to the database, inventory batches are deducted via FEFO, and the system transitions directly to the Official Receipt page."
            ]
          },
          {
            "title": "Processing Digital / GCash Payment",
            "steps": [
              "Click the \"Digital Payment\" tab.",
              "Instruct the customer to scan the counter GCash or Maya QR code for the exact total displayed.",
              "Verify the confirmation SMS or payment screen on the store’s merchant device.",
              "Check the mandatory confirmation box: \"I confirm Digital Payment has been received in full\".",
              "Click \"Complete Order\" or press [Enter].",
              "Expected Result: Sale commits with payment method marked as \"gcash\" and navigates to Receipt."
            ]
          }
        ],
        "callouts": [
          {
            "type": "TIP",
            "title": "Keyboard Shortcuts at Checkout",
            "content": "Speed up counter lines: Press [Enter] while in the Confirm Order modal to instantly finalize the transaction. Press [Esc] at any time to dismiss the modal and return to the cart."
          }
        ]
      },
      {
        "heading": "4.10 Handling Insufficient Stock Errors",
        "content": "If a cashier attempts to add an item or complete a sale requiring more ingredients than currently available in active batches, the transaction is halted with an explicit toast error:\n\"Insufficient stock for [Ingredient Name] — need X [unit], only Y available.\"\nThe order cannot proceed until the cart quantity is adjusted or the stock is replenished via the Inventory module."
      },
      {
        "heading": "4.11 Voiding / Clearing an Active Order",
        "content": "To cancel an active cart before checkout:\n1. Click the \"Clear\" or \"Void Order\" button next to Complete Sale.\n2. The Void Modal prompts for a mandatory reason (e.g., \"Customer changed mind\", \"Wrong order entered\").\n3. Enter the reason and click \"Confirm Void\". The cart is emptied and reset to default."
      },
      {
        "heading": "4.12 Official Receipt Page & Printing",
        "content": "Upon order completion, the application displays the Official Receipt screen:\n- Receipt Header: Espro coffee logo, store brand name, and \"Official Receipt\".\n- Order Badge: Clear tag indicating \"Dine-in\" or \"Takeout\".\n- Transaction Metadata: Unique Receipt ID ('S-timestamp'), Date, Time, Cashier Name, and Payment Method.\n- Itemized Table: Item name, size, customizations, special notes, quantity, unit price, and line subtotal.\n- Financial Breakdown: Subtotal, Discount, Grand Total, Amount Received, and Change Due.\n- Actions:\n  - Back: Returns to previous screen.\n  - Print: Launches browser print dialog formatted specifically for 80mm thermal receipt roll printers ('@page { size: 80mm auto; margin: 0; }').\n  - New Sale: Clears receipt state and returns directly to a fresh POS register."
      },
      {
        "heading": "4.13 Point of Sale Field Reference Table",
        "content": "The following reference table details every interactive control, input field, and action button within the POS register and checkout interface:",
        "table": {
          "headers": [
            "POS Interface Element",
            "Type / Input Format",
            "Functional Description",
            "Business Rule & Validation"
          ],
          "rows": [
            [
              "Dine-in / Takeout Toggle",
              "Segmented Switch Button",
              "Switches active order packaging mode between Dine-in and Takeout.",
              "Dine-in excludes disposable cups and bags; Takeout automatically deducts packaging supplies."
            ],
            [
              "Product Search Bar",
              "Text Input Box",
              "Filters product grid in real-time by item name or category.",
              "Instant search with keyboard focus shortcut."
            ],
            [
              "Category Filter Pills",
              "Clickable Buttons",
              "Filters catalog items by category (e.g., Espresso, Non-Coffee, Pastries).",
              "\"All Items\" displays complete active menu."
            ],
            [
              "Size Selector Chips",
              "Radio Button Group",
              "Selects drink serving size (e.g., 8oz, 12oz, 16oz, Regular, Large).",
              "Multiplies raw ingredient deductions by size multiplier (e.g., 1.5x). Packaging deducted as 1 unit."
            ],
            [
              "Custom Add-on Checkboxes",
              "Multi-select Chips",
              "Applies extra customizations (e.g., Extra Espresso Shot, Oat Milk Upgrade).",
              "Increases item price and adds custom recipe ingredient deductions to transaction."
            ],
            [
              "Special Instructions",
              "Textarea (Optional)",
              "Notes customer preparation preferences (e.g., \"Less ice\", \"Extra hot\").",
              "Appears on kitchen preparation display and printed thermal receipt."
            ],
            [
              "Quantity Increment / Decrement",
              "Steppers (+ / -)",
              "Adjusts ordered quantity of selected line item.",
              "Minimum quantity is 1. Decrementing below 1 removes line item from cart."
            ],
            [
              "Discount Mode Selector",
              "Dropdown / Toggle",
              "Selects between Fixed Peso (₱) discount or Percentage (%) discount.",
              "Fixed discount deducts exact peso amount; % discount calculates proportion of cart subtotal."
            ],
            [
              "Discount Value Input",
              "Numeric Input (₱ or %)",
              "Specifies magnitude of discount applied to active cart.",
              "Value is automatically clamped so discount can never exceed the cart subtotal."
            ],
            [
              "Amount Received Tender Input",
              "Numeric Input (₱)",
              "Cash tender entered by cashier during checkout.",
              "Must be greater than or equal to Grand Total. Change due is calculated automatically."
            ],
            [
              "Quick-Tender Cash Chips",
              "Preset Buttons (₱100, ₱200, ₱500, ₱1,000, Exact)",
              "One-tap cash amount entry.",
              "Populates Amount Received field with selected currency note."
            ],
            [
              "GCash / Digital QR Confirmed",
              "Verification Checkbox",
              "Confirms digital payment received via store QR code.",
              "Must be checked before \"Confirm Payment\" button activates in Digital Payment mode."
            ],
            [
              "Void / Clear Order Button",
              "Action Button (Danger)",
              "Empties active cart and cancels transaction before payment.",
              "Requires mandatory cancellation reason note. Does not affect inventory as no sale occurred."
            ]
          ]
        }
      },
      {
        "heading": "4.14 Detailed Checkout Tasks",
        "content": "Step-by-step procedures for common cashier register workflows:",
        "tasks": [
          {
            "title": "Processing a Split Cash Payment with Quick Tender",
            "steps": [
              "Add items to cart with customer-requested sizes and add-ons.",
              "Verify order mode (Dine-in or Takeout) on the top toggle switch.",
              "Click \"Complete Sale\" (or press [Enter]).",
              "In the Confirm Order Modal, select \"Cash\" payment tab.",
              "Click the appropriate Quick-Tender chip (e.g., [₱500]) or type exact amount received in the input field.",
              "Verify the green \"Change Due\" display.",
              "Click \"Confirm Payment\" (or press [Enter])."
            ],
            "expectedResult": "System registers completed sale, deducts FEFO inventory, records cash transaction in sales ledger, and displays official receipt with exact change due."
          },
          {
            "title": "Processing a Digital GCash / QR Payment",
            "steps": [
              "Add customer items to cart and click \"Complete Sale\".",
              "In the Confirm Order Modal, click the \"Digital / GCash\" tab.",
              "Instruct customer to scan the counter QR Ph / GCash standee and transfer the exact Grand Total displayed.",
              "Verify customer SMS confirmation or merchant soundbox notification.",
              "Click the checkbox \"I confirm that payment has been received via GCash / QR\".",
              "Click \"Confirm Payment\"."
            ],
            "expectedResult": "Transaction is committed under Digital payment method with ₱0 change due, inventory deducted, and receipt generated."
          }
        ]
      }
    ]
  },
  {
    "id": "ch5",
    "number": 5,
    "title": "Menu Engineering & Recipe Management",
    "roleBadge": "ADMIN ONLY",
    "purpose": "This chapter details how Administrators configure menu items, manage categories, engineer raw ingredient recipes, configure up to six drink sizes with multipliers, assign dine-in vs takeout packaging supplies, analyze live profit margins, and manage custom add-ons.",
    "whereToFind": "Sidebar: Menu (/menu) – Administrator credentials required",
    "overview": "The Menu module is the culinary and financial blueprint of Espro POS. It links public-facing product offerings with backend raw inventory items, allowing owners to model exact recipe costs, forecast profit margins, and automate inventory depletion down to the gram or milliliter.",
    "screenshot": {
      "label": "[Screenshot: Menu Page – Menu Items Grid with Live Margin Badges, Category Management Bar, and Add New Item Button]",
      "caption": "Figure 5.1 – Menu Engineering console with atomic recipe costing and margin analysis."
    },
    "sections": [
      {
        "heading": "5.1 Menu Items Catalog & Category Management",
        "content": "The Menu interface features two top-level tabs: \"Menu Items\" and \"Add-ons & Customizations\".\n\nViewing Modes & Search:\n- Card View: Visual gallery displaying product photos, selling prices, category badges, and active/inactive status.\n- List View: Compact tabular layout ideal for rapid price and category auditing.\n- Search Field: Real-time filtering by menu item name.\n\nCategory Management Bar:\n- Displays all active categories (e.g., Espresso, Cold Brew, Non-Coffee, Pastries, Sandwiches).\n- Add Category: Click the \"+\" icon, enter the category name, and press save.\n- Delete Category with Forced Reassignment: If an Administrator deletes a category containing active menu items, the system enforces data integrity by prompting for a fallback category (e.g., \"Beverages\"), automatically reassigning all items before deleting the old category."
      },
      {
        "heading": "5.2 Adding & Editing Menu Items",
        "content": "Clicking \"Add Item\" or the Edit pencil icon opens the comprehensive Menu Item Editor modal:",
        "table": {
          "headers": [
            "Form Field",
            "Required",
            "Description",
            "Validation & Rules"
          ],
          "rows": [
            [
              "Item Name",
              "Yes",
              "The customer-facing name of the beverage or food item.",
              "e.g., Spanish Latte, Iced Americano, Croissant."
            ],
            [
              "Category",
              "Yes",
              "The category group under which the item is listed.",
              "Select from active menu categories."
            ],
            [
              "Base Price (₱)",
              "Conditional",
              "Selling price when multiple sizes are disabled.",
              "Must be ≥ 0. Overridden if sizes are enabled."
            ],
            [
              "Product Photo",
              "Optional",
              "Product image displayed on POS product cards.",
              "JPG or PNG format. Maximum file size: 5.0 MB."
            ],
            [
              "Multiple Sizes Toggle",
              "Optional",
              "Enables multi-size configuration.",
              "Supports up to 6 custom sizes per item."
            ],
            [
              "Active Status",
              "Optional",
              "Controls visibility in the POS catalog.",
              "Inactive items are hidden from cashiers."
            ]
          ]
        }
      },
      {
        "heading": "5.3 Recipe Editor (Raw Ingredients & Unit Conversion)",
        "content": "The Recipe Editor section links raw inventory items to the menu item:\n- Add Ingredient Row: Search and select any raw inventory ingredient (beans, milk, syrups, powders).\n- Quantity Used: Enter the physical quantity required for a single serving.\n- Recipe Unit: Select from compatible units. Espro POS features an automated unit conversion engine:\n  - Mass: Convert seamlessly between Milligrams (mg), Grams (g), Kilograms (kg), Ounces (oz), and Pounds (lb).\n  - Volume: Convert between Milliliters (ml), Liters (L), Fluid Ounces (fl oz), Teaspoons (tsp), Tablespoons (tbsp), Cups, Espresso Shots (30 ml), Syrup Pumps (10 ml), and Dashes (1 ml).\n  - Count: Pieces (pcs), Scoops, Bottles, Cans, Packs, Boxes, Slices, and Servings.\n- Unit Compatibility Validation: The system actively prevents selecting incompatible unit categories (for example, attempting to measure coffee beans in milliliters when inventory is tracked in kilograms)."
      },
      {
        "heading": "5.4 Multi-Size Drink Configuration (Up to 6 Sizes)",
        "content": "Enabling the \"Multiple Sizes\" switch expands the Sizes Editor:\n- Supports up to 6 distinct sizes per drink (e.g., 8oz, 12oz, 16oz, 20oz, 24oz, Pitcher).\n- Quick Size Chips: Click quick buttons (Small, Medium, Large, 12oz, 16oz, Regular) to populate size names instantly.\n- Size Price: Specify the independent selling price in Philippine Peso (₱) for each size.\n- Ingredient Multiplier: A numeric scaling factor applied to raw recipe ingredients. For example:\n  - Regular (12oz): Multiplier = 1.0 (consumes 18g espresso, 200ml milk).\n  - Large (16oz): Multiplier = 1.5 (automatically scales to consume 27g espresso, 300ml milk).\n- Default Size Radio: Designate which size is pre-selected when cashiers tap the drink card in POS."
      },
      {
        "heading": "5.5 Packaging & Supplies Configuration",
        "content": "Below raw ingredients is the Packaging & Supplies section:\n- Segregated Scaling: Unlike raw ingredients, single-use packaging supplies (cups, lids) are NOT multiplied by the drink size multiplier. A Large drink uses exactly 1 cup, not 1.5 cups.\n- Usage Scope (\"When\" Condition):\n  - Always: Deducted for every sale regardless of order type (e.g., coffee bean pouch).\n  - Takeout Only: Deducted only when the cashier selects \"Takeout\" (e.g., paper cold cup, dome lid, plastic straw).\n  - Dine-in Only: Deducted only when the cashier selects \"Dine-in\" (e.g., branded coaster, dine-in paper mat).\n- Per-Size Packaging: Assign specific cup and lid sizes to corresponding drink sizes (e.g., 12oz Hot Cup for Regular; 16oz Cold Cup for Large).\n- Shared Packaging: Supplies consumed across all sizes (e.g., paper straws, cup sleeves).\n- Copy Supplies Tool: One-click utility to copy packaging rows from one size to another to save data entry time.\n- Smart Packaging Suggestions: Automatically suggests matching cups and lids based on the size name (e.g., detecting \"16oz\" suggests \"16oz Paper Cup\" from inventory)."
      },
      {
        "heading": "5.6 Live Cost & Margin Analysis",
        "content": "As recipes and sizes are edited, the modal displays a real-time Profitability Matrix:\n- Calculates exact COGS per serving for Dine-in and Takeout.\n- Displays Gross Profit in Philippine Peso (₱).\n- Displays Gross Margin Percentage: Margin % = ((Selling Price - Total COGS) / Selling Price) * 100.\n- Color Threshold Indicators:\n  - Green (High Profit): Gross margin ≥ 70% (typical specialty coffee benchmark).\n  - Amber (Moderate): Gross margin between 50% and 69%.\n  - Red (Low Profit): Gross margin < 50% (requires price review or recipe adjustment)."
      },
      {
        "heading": "5.7 Add-ons & Customizations Tab",
        "content": "Switching to the \"Add-ons & Customizations\" tab manages catalog-wide beverage modifications:\n- Add-on Name & Selling Price: (e.g., \"Vanilla Syrup Pump\" – ₱25.00).\n- Applies-To Scope: Configure whether the add-on is available across All Products, specific Categories (e.g., \"Beverages only\"), or specific Menu Items.\n- Add-on Recipe: Define raw ingredients consumed (e.g., 10 ml Vanilla Syrup).\n- Live Margin Preview: Shows the exact ingredient cost and net profit generated per add-on sold."
      },
      {
        "heading": "5.8 Order Supplies Rules Modal",
        "content": "Clicking \"Takeout & Order Supplies\" in the top action bar manages macro order packaging:\n- Configures supplies deducted per entire order rather than per drink (e.g., Brown Kraft Takeout Bag, 2-Cup Cardboard Carrier, Paper Napkins).\n- Scope rules: Takeout only, Dine-in only, or All orders.\n- Provides real-time packaging cost analysis per order transaction."
      },
      {
        "heading": "5.9 Menu & Recipe Field Reference Table",
        "content": "The following reference table explains all configuration parameters when building menu items and engineering recipes:",
        "table": {
          "headers": [
            "Field Name",
            "Required",
            "Description",
            "Validation & Constraints"
          ],
          "rows": [
            [
              "Item Name",
              "Yes",
              "Display name of menu item shown in POS and receipts.",
              "Must be unique within category. Example: \"Iced Spanish Latte\"."
            ],
            [
              "Category",
              "Yes",
              "Menu classification group for filtering and reporting.",
              "Selected from existing categories or newly created via Category Manager."
            ],
            [
              "Base Selling Price (₱)",
              "Yes",
              "Default retail selling price for the standard item size.",
              "Must be numeric >= 0. Example: ₱145.00."
            ],
            [
              "Product Image",
              "No",
              "Visual photo displayed on POS catalog cards.",
              "Max file size 5MB. Supported formats: JPG, PNG, WebP. Auto-compressed."
            ],
            [
              "Active Status Toggle",
              "Yes",
              "Enables or disables item availability on POS register.",
              "Deactivated items remain in database for historical reports but disappear from POS."
            ],
            [
              "Size Name",
              "Yes (per size)",
              "Descriptor for volume variant (e.g., Regular, Large, 16oz, 22oz).",
              "Up to 6 sizes permitted per menu item. Exactly one must be set as Default."
            ],
            [
              "Size Multiplier",
              "Yes (per size)",
              "Scaling factor applied to raw recipe ingredient quantities.",
              "Numeric decimal > 0. Example: Regular = 1.0, Large = 1.5. Does NOT scale packaging."
            ],
            [
              "Size Price (₱)",
              "Yes (per size)",
              "Retail price charged for specific size variant.",
              "Must be numeric >= 0. Example: Regular = ₱130.00, Large = ₱155.00."
            ],
            [
              "Recipe Ingredient",
              "Yes (per item)",
              "Raw ingredient consumed from stock when item is sold.",
              "Selected from Inventory Master List. Must have matching or convertible units."
            ],
            [
              "Recipe Quantity",
              "Yes (per item)",
              "Exact quantity consumed for base size (1.0x).",
              "Numeric decimal > 0. Example: 18g Espresso Beans, 150ml Fresh Milk."
            ],
            [
              "Packaging Supply",
              "No",
              "Single-use cup, lid, straw, or carrier supply consumed.",
              "Selected from Supplies catalog. Assigned fixed deduction quantity per unit sold."
            ],
            [
              "Supply \"When\" Scope",
              "Yes (per supply)",
              "Condition under which packaging supply is deducted.",
              "Options: \"Always\" (every order), \"Takeout only\" (takeout orders), \"Dine-in only\"."
            ]
          ]
        }
      },
      {
        "heading": "5.10 Recipe Engineering Step-by-Step Task",
        "content": "Follow this standard operating procedure when introducing a new handcrafted beverage:",
        "tasks": [
          {
            "title": "Engineering a Multi-Size Iced Beverage with Takeout Rules",
            "steps": [
              "Navigate to Menu & Recipes > Menu Items tab and click \"Add Item\".",
              "Enter item name (e.g., \"Caramel Macchiato\"), assign Category (\"Coffee\"), and enter base price.",
              "In Sizes Editor, define two sizes: \"16oz Regular\" (multiplier 1.0, ₱140) and \"22oz Large\" (multiplier 1.5, ₱165). Set 16oz as Default.",
              "In Recipe Ingredients, add Espresso Beans (18g), Fresh Milk (160ml), Vanilla Syrup (20ml), and Caramel Drizzle (15ml).",
              "In Packaging Supplies, add \"16oz Clear PET Cup\" (1 pc, Takeout only) and \"98mm Flat Lid\" (1 pc, Takeout only).",
              "Review the Live Cost & Margin Analysis bar: verify COGS is under ₱45.00 and Gross Margin displays Green (> 70%).",
              "Click \"Save Menu Item\"."
            ],
            "expectedResult": "Menu item is saved to database with atomic recipe costing, ready for counter baristas on the POS register."
          }
        ]
      }
    ]
  },
  {
    "id": "ch6",
    "number": 6,
    "title": "Inventory & Stock Management",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter explains how to track stock balances, interpret the 10-column master list, receive new delivery batches, adjust inventory for spoilage, enforce FEFO batch rotation, and generate valuation reports.",
    "whereToFind": "Sidebar: Inventory Management (/inventory)",
    "overview": "The Inventory module provides complete traceability over raw ingredients and operational packaging supplies. Engineered around First-Expired, First-Out (FEFO) batch tracking, it ensures older perishable goods are consumed first during sales and automatically writes off expired items.",
    "screenshot": {
      "label": "[Screenshot: Inventory Page – 5 Filter Cards, Item Type Toggle, Master Table with Expandable Batches, and Restock Button]",
      "caption": "Figure 6.1 – Inventory Master List with expandable batch breakdown and stock period tracking."
    },
    "sections": [
      {
        "heading": "6.1 The 5 Filter Status Cards",
        "content": "At the top of the inventory page are five interactive filter cards:\n1. All Items: Total catalog items tracked, showing ingredients vs supplies breakdown.\n2. Low Stock: Items whose remaining stock is at or below their configured threshold.\n3. Out of Stock: Items with exactly 0 stock remaining.\n4. Near Expiry: Active batches expiring within the next 7 calendar days.\n5. Expired: Items possessing batches past their expiration date that have not been written off.\n\nClicking any card instantly filters the master inventory table below."
      },
      {
        "heading": "6.2 Item-Type Segmentation",
        "content": "Beside the search bar is a segmented toggle:\n- All: Displays every tracked inventory line.\n- Ingredients: Filters exclusively to consumable foodstuffs (beans, milk, syrups, teas).\n- Supplies: Filters exclusively to non-edible service goods (cups, lids, straws, bags)."
      },
      {
        "heading": "6.3 Master Inventory Table Columns Explained",
        "content": "The master inventory ledger contains 10 comprehensive columns:",
        "table": {
          "headers": [
            "Column Header",
            "Description & Operational Significance",
            "Example Data"
          ],
          "rows": [
            [
              "(Expand Chevron)",
              "Toggles expandable batch breakdown showing individual shipments.",
              "Chevron icon."
            ],
            [
              "Item",
              "Item name, item type badge (📦 Supply / 🌾 Ingredient), unit, and batch count.",
              "Espresso Beans | 🌾 Ingredient | kg | 3 batches"
            ],
            [
              "Stock Period",
              "Active batch lifespan from received date to expiry date with days-left chip.",
              "2026-10-01 → 2026-11-01 (Expires in 17d)"
            ],
            [
              "Current Stock",
              "Total quantity received in the currently active delivery batch.",
              "10 kg"
            ],
            [
              "Used",
              "Cumulative quantity consumed from the active delivery batch via sales/spoilage.",
              "3.5 kg"
            ],
            [
              "Remaining Stock",
              "Total available physical inventory across all active non-expired batches.",
              "6.5 kg"
            ],
            [
              "Actual Purchase Price",
              "Latest purchase cost per unit in Philippine Peso (₱).",
              "₱650.00 / kg"
            ],
            [
              "Threshold",
              "Reorder trigger level. When remaining stock ≤ threshold, low stock triggers.",
              "2.0 kg"
            ],
            [
              "Status",
              "Visual health badge: OK (Green), Low Stock (Amber), Out of Stock (Red), Near Expiry (Amber), Expired (Red).",
              "OK / Low Stock"
            ],
            [
              "Actions",
              "Quick-action buttons: Restock (delivery), Adjust (spoilage/count), Edit, Delete.",
              "Buttons row."
            ]
          ]
        }
      },
      {
        "heading": "6.4 Receiving New Stock Deliveries (Restocking)",
        "content": "Whenever suppliers deliver fresh stock, record the shipment to create a new FEFO batch:",
        "tasks": [
          {
            "title": "Logging a Stock Delivery Batch",
            "steps": [
              "Locate the item in the inventory list and click the \"Restock\" button (Package icon).",
              "Enter the Quantity Received in the item’s inventory unit (e.g., 10 kg).",
              "Verify or update the Cost Per Unit in Philippine Peso (₱). This updates the latest purchase price.",
              "Confirm the Received Date (defaults to today’s date).",
              "Enter the Expiration Date printed on the supplier packaging (critical for FEFO tracking).",
              "Optional: Enter Supplier Name and Invoice / Delivery Note number.",
              "Click \"Confirm Restock\".",
              "Expected Result: A new active batch is created, remaining stock increments immediately, and a \"restock\" entry is written to the audit log."
            ]
          }
        ]
      },
      {
        "heading": "6.5 Adjusting Stock (Spoilage vs Set Exact)",
        "content": "When physical stock discrepancies occur or ingredients spoil:\n- Deduct / Spoilage: Select \"Deduct\", enter quantity lost (e.g., 0.5 kg spilled milk), select reason (\"Spillage\", \"Quality rejection\"), and confirm. Stock is deducted and logged as an adjustment movement.\n- Set Exact: Select \"Set Exact\", enter physical count (e.g., 4.2 kg verified during audit). The system calculates the positive or negative difference and adjusts batches accordingly."
      },
      {
        "heading": "6.6 FEFO Batch Rotation & Automatic Expiration Write-Off",
        "content": "How FEFO Works During Sales:\nWhen a customer orders a drink, Espro POS does not deduct stock randomly. It queries all active batches for that ingredient ordered by earliest expiration date first, then oldest received date. It consumes stock from the oldest batch until depleted, then automatically cascades to the next batch.\n\nAutomated Expiration Write-Off:\nItems with \"Auto-Deduct Expired\" enabled are automatically scanned when the inventory page loads. Any batch whose expiration date is strictly before today’s date is zeroed out, marked as \"expired\", and logged as an expired write-off movement."
      },
      {
        "heading": "6.7 Valuation Report & Exports",
        "content": "Clicking the \"Valuation Report\" tab displays an asset audit:\n- Total Inventory Asset Value (₱): Batch-weighted value of all remaining physical stock.\n- Split by Raw Ingredients Value vs Packaging Supplies Value.\n- Expired / Near-Expiry Risk Value: Quantifies monetary capital at risk of spoilage.\n- Export Options: Export complete valuation audit to formatted PDF or raw CSV spreadsheet."
      },
      {
        "heading": "6.9 Inventory Field Reference Table",
        "content": "The following reference table explains all fields required when managing inventory items and receiving shipments:",
        "table": {
          "headers": [
            "Field Name",
            "Required",
            "Description",
            "Valid Input & Constraints"
          ],
          "rows": [
            [
              "Item Name",
              "Yes",
              "Official descriptive title of ingredient or packaging material.",
              "Example: \"Arabica Blend Espresso Beans\", \"16oz Hot Paper Cup\"."
            ],
            [
              "Item Classification",
              "Yes",
              "Determines operational usage category.",
              "Options: \"Raw Ingredient\" (edible consumables) or \"Packaging Supply\" (paper/plastic)."
            ],
            [
              "Unit of Measurement",
              "Yes",
              "Standard base measurement unit for stock balances.",
              "Options: g, kg (mass), ml, l (volume), pcs, packs, cans, bottles (discrete)."
            ],
            [
              "Minimum Reorder Threshold",
              "Yes",
              "Alert trigger level below which system warns staff of low stock.",
              "Numeric value >= 0. When stock <= threshold, item appears on Stock Alerts card."
            ],
            [
              "Batch Number / Reference",
              "No",
              "Supplier invoice or lot tracking number for traceability.",
              "Text string. Example: \"PO-2026-104\", \"LOT-9924A\". Defaults to current date if blank."
            ],
            [
              "Quantity Received",
              "Yes",
              "Physical quantity delivered in current shipment.",
              "Numeric value > 0 in configured unit of measurement. Example: 5000g, 24 cans."
            ],
            [
              "Purchase Unit Price (₱)",
              "Yes",
              "Actual cost paid per base measurement unit.",
              "Numeric value >= 0. Example: ₱0.85 per gram, ₱42.00 per can. Used in FEFO COGS."
            ],
            [
              "Expiration Date",
              "Yes (for perishables)",
              "Shelf life limit date for perishable consumables.",
              "Date picker format (YYYY-MM-DD). Drives FEFO consumption and auto-expiry logic."
            ],
            [
              "Stock Adjustment Mode",
              "Yes (adjust modal)",
              "Method of modifying inventory counts during audits.",
              "Options: \"Deduct / Spoilage\" (records wastage) or \"Set Exact\" (overwrites count)."
            ],
            [
              "Adjustment Reason",
              "Yes (adjust modal)",
              "Mandatory operational explanation for inventory adjustments.",
              "Options: \"Spilled/Wasted\", \"Expired Write-Off\", \"Physical Count Correction\", \"Other\"."
            ]
          ]
        }
      }
    ]
  },
  {
    "id": "ch7",
    "number": 7,
    "title": "Expense Management & Cost Tracking",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter explains how to analyze sales-driven Cost of Goods Sold (COGS), record daily store operating expenses (OPEX), inspect category distributions via pie charts, and maintain accurate cost ledgers.",
    "whereToFind": "Sidebar: Expense Management (/expenses)",
    "overview": "The Expense module consolidates all business outflows into two distinct sections: direct product cost (COGS) and operational overhead (OPEX), providing cafe operators with a complete picture of store expenditures.",
    "screenshot": {
      "label": "[Screenshot: Expense Page – Section 1 COGS Breakdown Table, Section 2 OPEX Entry Form, and Category Pie Chart]",
      "caption": "Figure 7.1 – Unified expense management displaying live sales COGS and operational expenses."
    },
    "sections": [
      {
        "heading": "7.1 Reporting Period Selection",
        "content": "At the top of the page, users can define a date range (Date From and Date To). Both COGS calculations and OPEX ledgers update dynamically to reflect only transactions and expenses recorded within the selected dates."
      },
      {
        "heading": "7.2 Section 1 – Cost of Goods Sold (COGS) Breakdown",
        "content": "Unlike manual spreadsheets, Espro POS automatically compiles COGS directly from sales data:\n1. Total Line Ingredients COGS: Sum of all raw ingredients consumed across completed sales.\n2. Total Line Packaging Supplies COGS: Sum of all drink-level packaging consumed across completed sales.\n3. Order-Level Takeout Packaging COGS: Sum of macro takeout supplies (carry bags, carriers) deducted at checkout.\n4. Refunded Sales COGS (Wastage): Direct material cost of drinks prepared and handed out that were subsequently refunded to customers.\n5. Product COGS Ledger: Itemized table detailing Product Name, Units Sold, Ingredients Cost, Supplies Cost, and Total COGS."
      },
      {
        "heading": "7.3 Section 2 – Operating Expenses (OPEX)",
        "content": "Operating expenses represent day-to-day cafe overhead. The system organizes OPEX into 8 standardized categories:\n- Rent & Utilities (Electricity, water, internet, commercial rent).\n- Payroll (Wages, bonuses, staff allowances).\n- Maintenance & Repairs (Espresso machine servicing, water filter changes, grinder burr replacement).\n- Marketing & Promo (Social media ads, flyers, cafe loyalty rewards).\n- Taxes & Permits (Barangay permits, mayor's permit, BIR filings).\n- General Supplies (Cleaning chemicals, mop heads, receipt paper rolls, dish soap).\n- Logistics & Delivery (Transportation, ice delivery, supplier freight).\n- Miscellaneous (Unforeseen minor expenses).",
        "tasks": [
          {
            "title": "Recording a Store Expense",
            "steps": [
              "Scroll to Section 2 (Operating Expenses) and locate the \"Record Expense\" form.",
              "Enter a clear Expense Description (e.g., \"5 Bags Tube Ice Delivery for Counter\").",
              "Enter the Amount in Philippine Peso (e.g., ₱350.00).",
              "Select the appropriate Category from the dropdown (e.g., Logistics & Delivery).",
              "Confirm or adjust the Expense Date.",
              "Click \"Record Expense\".",
              "Expected Result: The expense is saved, added to the ledger table, and the OPEX distribution pie chart updates immediately."
            ]
          }
        ]
      },
      {
        "heading": "7.4 OPEX Distribution Chart & Ledger Management",
        "content": "An interactive Recharts Pie Chart visualizes expense proportions by category, enabling owners to instantly spot excessive spending. The history table below allows editing or deleting any logged expense entry, complete with search and 20-per-page pagination."
      },
      {
        "heading": "7.5 Expense Management Field Reference Table",
        "content": "The following reference table details the form fields utilized when logging store operational expenses:",
        "table": {
          "headers": [
            "Field Name",
            "Required",
            "Description",
            "Example & Validation"
          ],
          "rows": [
            [
              "Expense Date",
              "Yes",
              "Date when expenditure was incurred.",
              "Date format (YYYY-MM-DD). Defaults to current date. Past dates allowed."
            ],
            [
              "Expense Category",
              "Yes",
              "Accounting classification for P&L reporting.",
              "Options: Rent, Utilities, Maintenance, Packaging, Marketing, Logistics, Other."
            ],
            [
              "Payee / Vendor",
              "Yes",
              "Business or individual receiving payment.",
              "Text. Example: \"Meralco\", \"Manila Water\", \"SM Prime Holdings\", \"Shopee Supplies\"."
            ],
            [
              "Description / Particulars",
              "Yes",
              "Detailed operational purpose of the expenditure.",
              "Text. Example: \"September 2026 Cafe Electricity Bill\", \"Espresso Machine Descaling\"."
            ],
            [
              "Amount (₱)",
              "Yes",
              "Total Philippine Peso value expended.",
              "Numeric currency value > 0. Example: ₱12,450.00."
            ],
            [
              "Payment Method",
              "Yes",
              "Funding source used to settle transaction.",
              "Options: Petty Cash, Store GCash, Bank Transfer, Owner Credit Card."
            ]
          ]
        }
      },
      {
        "heading": "7.6 Step-by-Step Task: Logging Daily Store Expenses",
        "content": "Staff should record daily counter expenditures using this workflow:",
        "tasks": [
          {
            "title": "Recording a Counter Operating Expense",
            "steps": [
              "Navigate to Sidebar > Expense Management (/expenses).",
              "Click the \"Record Expense\" button in the top right corner.",
              "Select the Expense Date and choose the appropriate Expense Category.",
              "Enter the Payee name and clear Description of goods/services received.",
              "Enter the exact Amount in Philippine Peso (₱) and select Payment Method.",
              "Click \"Save Expense\"."
            ],
            "expectedResult": "Expense record is immediately committed to database, reflected on OPEX cards, and integrated into Financial Reports."
          }
        ]
      }
    ]
  },
  {
    "id": "ch8",
    "number": 8,
    "title": "Financial Reports & Profitability Analytics",
    "roleBadge": "ADMIN ONLY",
    "purpose": "This chapter explains how Administrators inspect the sales ledger, handle voids vs refunds, review periodic inventory formulas, analyze the P&L summary, and export audit-ready reports.",
    "whereToFind": "Sidebar: Financial Reports (/reports) – Administrator credentials required",
    "overview": "The Financial Reports module is the executive intelligence center of Espro POS. It compiles all transaction logs, stock movements, and expenses into formal accounting statements, providing owners with complete visibility over store profitability.",
    "screenshot": {
      "label": "[Screenshot: Reports Page – Date Preset Toolbar, Sales Ledger with Item Hover Popover, and Export Suite Dropdown]",
      "caption": "Figure 8.1 – Financial reports console with interactive sales inspection and audit export."
    },
    "sections": [
      {
        "heading": "8.1 Global Date Range Toolbar & Presets",
        "content": "Administrators can filter all report tabs using quick date presets:\n- Today | Yesterday | This Week (Monday to Sunday) | Last Week | This Month | Last Month | All Time | Custom Date Range."
      },
      {
        "heading": "8.2 Sales Report & Ledger Inspection",
        "content": "The Sales Report tab provides a complete audit trail of every register transaction:\n- Executive Summary Cards: Gross Sales (₱), Discounts Given (₱), Net Sales (₱), Transaction Count, and Average Order Value (AOV = Net Sales / Transaction Count).\n- Filter controls: Filter by Order Type (All, Dine-in, Takeout) and Status (All, Completed, Voided, Refunded).\n- Inspected Sale Items Popover:\n  - On desktop: Hover your mouse over the \"X items\" badge to reveal a floating popover detailing exact items, sizes, add-ons, and barista notes.\n  - On mobile / touchscreens: Tap or press-and-hold (380ms) the items badge to anchor the inspection popover."
      },
      {
        "heading": "8.3 Transaction Void vs Refund (Stock Impact Decision Tree)",
        "content": "Administrators have exclusive authority to void or refund completed transactions:",
        "table": {
          "headers": [
            "Action Type",
            "When to Use",
            "Customer Money",
            "Inventory Stock Effect",
            "Accounting Impact"
          ],
          "rows": [
            [
              "Void Transaction",
              "Order rung up by mistake or cancelled before drinks are prepared.",
              "Cancelled / Returned to customer.",
              "RESTORED: Ingredients & supplies are returned to active batches via FEFO.",
              "Gross & Net revenue zeroed out. Transaction marked as \"voided\"."
            ],
            [
              "Refund Transaction",
              "Drink was prepared and served, but customer complained and requested refund.",
              "Refunded / Returned to customer.",
              "NOT RESTORED: Ingredients are consumed as wastage/spoilage.",
              "Net revenue reduced. Consumed ingredients recorded as Refunded COGS Wastage."
            ]
          ]
        },
        "callouts": [
          {
            "type": "WARNING",
            "title": "Audit Requirement for Voids & Refunds",
            "content": "Both Void and Refund actions require entering a mandatory manager reason (minimum 5 characters). This reason is permanently recorded in the audit ledger and printed on audit pack exports."
          }
        ]
      },
      {
        "heading": "8.4 Expense Report & Periodic Inventory Formula",
        "content": "The Expense Report compares two standard accounting methodologies:\n1. Recipe-Deducted COGS: The theoretical cost calculated by multiplying sold recipes by unit ingredient costs.\n2. Periodic Inventory COGS Formula:\n   COGS = Beginning Inventory Value + Restock Purchases - Ending Inventory Value\nComparing these two values reveals store shrinkage, barista over-portioning, unrecorded spillage, and inventory theft."
      },
      {
        "heading": "8.5 Profit Summary (P&L Income Statement)",
        "content": "The Profit Summary tab structures cafe financials into a standard Income Statement:\n- Gross Sales Revenue\n  Less: Customer Discounts\n- Net Sales Revenue (100.0%)\n  Less: Total Cost of Goods Sold (Ingredients + Packaging + Spoilage)\n- Gross Profit (Gross Margin %)\n  Less: Total Operating Expenses (Rent, Payroll, Utilities, etc.)\n- Net Operating Profit (Net Margin %)\n- Break-Even Analysis: Calculates the exact minimum monthly sales revenue required to cover all fixed operating overhead."
      },
      {
        "heading": "8.6 Exporting Reports (Audit Pack, PDF, CSV)",
        "content": "Clicking the \"Export Report\" button provides four professional download formats:\n1. Export Current Tab PDF: Clean printable document of the active report tab.\n2. Export Current Tab CSV: Raw spreadsheet data for external accounting.\n3. Export Sales Line-Items CSV: Exhaustive item-level audit file containing every single beverage sold, size, add-on, cashier, and timestamp.\n4. Export Full Audit Pack PDF: Multi-page executive audit document containing Sales Ledger, Expense Breakdown, and Profit Summary in a single print-ready PDF."
      }
    ]
  },
  {
    "id": "ch9",
    "number": 9,
    "title": "Employee Management & Attendance Roster",
    "roleBadge": "ADMIN ONLY",
    "purpose": "This chapter details how Administrators manage the staff directory, set hourly rates, assign 4-digit PINs, configure ESPRO system login accounts, audit live attendance, adjust timesheets, export payroll CSVs, and manage weekly shift rosters.",
    "whereToFind": "Sidebar: Employee Management (/employees) – Administrator credentials required",
    "overview": "The Employee Management module unites human resources, counter security, shift scheduling, and payroll timekeeping into a single administrative control center.",
    "screenshot": {
      "label": "[Screenshot: Employee Management – Live Metrics, Staff Directory Table with System Access Badges, and Timesheet CSV Export Button]",
      "caption": "Figure 9.1 – Staff directory and attendance control console."
    },
    "sections": [
      {
        "heading": "9.1 Live Operational Metric Cards",
        "content": "Five dynamic metric cards summarize counter staffing today:\n- Active Staff Count: Total active employees registered.\n- Currently on Duty: Baristas currently clocked in and actively working.\n- Currently on Break: Staff members currently on meal/rest breaks.\n- Scheduled Today: Shifts assigned for today on the weekly roster.\n- Late Today (> 5 min): Staff who clocked in more than 5 minutes past their scheduled shift start."
      },
      {
        "heading": "9.2 Staff Directory & Account Provisioning",
        "content": "The Staff Directory manages all barista, cashier, and manager records:",
        "table": {
          "headers": [
            "Field",
            "Required",
            "Description",
            "Validation & Notes"
          ],
          "rows": [
            [
              "Employee Code",
              "Auto / Manual",
              "Unique identifier code.",
              "Auto-generated as EMP-001, EMP-002, etc."
            ],
            [
              "Full Name",
              "Yes",
              "Legal employee name.",
              "e.g., Maria Santos."
            ],
            [
              "Role",
              "Yes",
              "Assigned cafe position.",
              "Store Manager, Head Barista, Barista, Cashier, Kitchen."
            ],
            [
              "Employment Type",
              "Yes",
              "Work status classification.",
              "Full-time or Part-time."
            ],
            [
              "Hourly Rate (₱)",
              "Yes",
              "Base wage per hour in Philippine Peso.",
              "e.g., ₱85.00 / hour."
            ],
            [
              "4-Digit PIN Code",
              "Yes",
              "Security PIN for Time Clock Kiosk punches.",
              "Strictly 4 numeric digits (e.g., 1234)."
            ],
            [
              "Emergency Contact",
              "Optional",
              "Contact person and phone number.",
              "Name and phone string."
            ],
            [
              "System Access Toggle",
              "Optional",
              "Enables web login credentials.",
              "When enabled, provisions username@espro.ph."
            ]
          ]
        }
      },
      {
        "heading": "9.3 Granting ESPRO System Login Access",
        "content": "Differentiating Kiosk Staff from System Users:\n- Kiosk-Only Staff: Baristas who only need to clock in/out at the counter. They use their 4-digit PIN and have no web login credentials.\n- System Users: Shift supervisors, head baristas, or cashiers who need to operate the web interface.\nTo grant system access, toggle \"Grant ESPRO System Login Access\" in the employee form, enter an authorized username (e.g. \"maria\" generates \"maria@espro.ph\"), assign a password (min 6 characters), and designate permissions (Administrator vs Employee)."
      },
      {
        "heading": "9.4 Attendance Auditing & Manual Timesheet Adjustments",
        "content": "The Attendance & Timesheets tab logs every clock punch. If an employee forgets to clock in or out, Administrators can perform an authorized adjustment:\n1. Locate the attendance record and click \"Adjust\".\n2. Modify Clock In, Clock Out, Break Start, or Break End timestamps.\n3. Enter a Mandatory Manager Audit Reason (e.g., \"Barista forgot to punch in due to morning rush; verified via CCTV\").\n4. Save adjustment. The system recalculates total hours and appends the remark to the audit log."
      },
      {
        "heading": "9.5 Payroll Timesheet CSV Export (1.25x Overtime)",
        "content": "Clicking \"Export CSV\" generates a payroll-ready spreadsheet. The system automatically classifies work hours:\n- Regular Hours: Accumulated work hours up to 8.0 hours per shift.\n- Overtime Hours: Work hours exceeding 8.0 hours in a single shift.\n- Estimated Wage Calculation:\n  Estimated Wage = (Regular Hours * Hourly Rate) + (Overtime Hours * Hourly Rate * 1.25)."
      },
      {
        "heading": "9.6 Shift Roster & Weekly Scheduling",
        "content": "The Shift Roster tab manages weekly counter coverage:\n- Shift Templates: Create reusable shift presets (e.g., \"Opening: 06:00–14:00 (30m break)\", \"Mid: 10:00–18:00\", \"Closing: 14:00–22:00\").\n- Assigning Shifts: Click any calendar cell (Employee × Day), choose a template, and save.\n- Quick Shift Swap: Select two scheduled staff members to immediately swap shifts with zero data re-entry."
      },
      {
        "heading": "9.8 Employee Management Field Reference Table",
        "content": "The following reference table explains all configuration parameters for staff profiles and access credentials:",
        "table": {
          "headers": [
            "Field Name",
            "Required",
            "Description",
            "Validation & Constraints"
          ],
          "rows": [
            [
              "Full Name",
              "Yes",
              "Official legal name of employee.",
              "Text string. Example: \"Maria Santos\". Shown on receipts and roster."
            ],
            [
              "Role / Position",
              "Yes",
              "Job classification within store operations.",
              "Options: Barista, Cashier, Shift Supervisor, Kitchen Staff, Store Manager."
            ],
            [
              "Employment Type",
              "Yes",
              "Working arrangement classification.",
              "Options: Full-time (40h/week), Part-time, Casual, Trainee."
            ],
            [
              "Hourly Rate (₱)",
              "Yes",
              "Base wage rate per hour in Philippine Peso.",
              "Numeric value >= 0. Example: ₱75.00/hr. Used for payroll cost calculations."
            ],
            [
              "4-Digit Security PIN",
              "Yes",
              "Personal identification number for counter kiosk timekeeping.",
              "Exactly 4 numeric digits (0000–9999). Hashed and secured in database."
            ],
            [
              "Emergency Contact Name",
              "No",
              "Person to notify in case of workplace emergency.",
              "Text string. Example: \"Juan Santos (Father)\"."
            ],
            [
              "Emergency Contact Phone",
              "No",
              "Telephone or mobile number of emergency contact.",
              "Philippine mobile format (e.g., 0917-123-4567)."
            ],
            [
              "Grant ESPRO Login Access",
              "Optional",
              "Enables web login credentials for counter terminal or back office.",
              "Checkbox. If enabled, prompts for Email Username and Password."
            ],
            [
              "Email / Username",
              "Yes (if login)",
              "System login address.",
              "Auto-appends \"@espro.ph\" if omitted. Example: \"maria.santos@espro.ph\"."
            ],
            [
              "Initial Password",
              "Yes (if login)",
              "Authentication password for web login.",
              "Minimum 6 characters. Auto-generate button available for strong random string."
            ]
          ]
        }
      }
    ]
  },
  {
    "id": "ch10",
    "number": 10,
    "title": "Time Clock Kiosk & Counter Attendance",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter explains how counter staff use the shared Time Clock Kiosk to record shift clock-ins, break periods, and clock-outs, and how attendance status directly governs POS selling permissions.",
    "whereToFind": "Top Bar: \"Time Clock Kiosk\" button (accessible from any page)",
    "overview": "The Time Clock Kiosk is a dedicated counter modal designed for rapid touchscreen interaction by all cafe staff without requiring full account sign-out and sign-in.",
    "screenshot": {
      "label": "[Screenshot: Time Clock Kiosk – Live Clock Display, Staff Selection Grid, and 4-Digit Virtual PIN Keypad]",
      "caption": "Figure 10.1 – Shared counter Time Clock Kiosk interface."
    },
    "sections": [
      {
        "heading": "10.1 Kiosk Workflow Step-by-Step",
        "content": "The kiosk interface follows an intuitive 3-step sequence:",
        "tasks": [
          {
            "title": "Clocking In or Out at the Kiosk",
            "steps": [
              "Click the prominent \"Time Clock Kiosk\" button in the Top Utility Bar.",
              "Tap or click your name from the staff directory list. Use the search field if necessary.",
              "The Virtual Numpad appears. Enter your 4-digit PIN code using the touch keypad or your physical keyboard.",
              "The system evaluates your current shift state and presents dynamic action buttons:",
              "  - If Not Clocked In: Click \"Clock In\" (shows scheduled shift time and flags if late).",
              "  - If On Duty: Click \"Start Break\" or \"Clock Out\".",
              "  - If On Break: Click \"End Break\".",
              "A friendly success screen appears displaying your timestamp, greeting, and hours worked summary.",
              "Expected Result: The modal automatically closes after 5 seconds (or tap Close), and your live status updates across the system."
            ]
          }
        ]
      },
      {
        "heading": "10.2 How Kiosk Attendance Governs POS Selling Permission",
        "content": "Espro POS links the Time Clock directly to register permissions:\n- When an Employee user opens the POS, the system checks whether their linked employee profile has an active \"On Duty\" punch for today.\n- If the employee has not clocked in, checkout is disabled.\n- If the employee is currently on break, checkout is disabled.\n- This ensures cash drawer accountability and prevents off-the-clock sales."
      },
      {
        "heading": "10.3 Kiosk Controls Field Reference Table",
        "content": "The following reference table explains the controls and interface states within the counter Time Clock Kiosk:",
        "table": {
          "headers": [
            "Control / Display Element",
            "Type",
            "Functional Description",
            "Operational Constraint"
          ],
          "rows": [
            [
              "Employee Selector",
              "Dropdown Menu",
              "Lists all active store employees registered in directory.",
              "Inactive or deleted staff do not appear."
            ],
            [
              "4-Digit PIN Keypad",
              "Numeric Keypad (0-9)",
              "On-screen touch buttons for entering 4-digit security PIN.",
              "Masked display (••••). Clears automatically after 3 invalid attempts."
            ],
            [
              "Clock In Button",
              "Action Button (Green)",
              "Initiates work shift punch and starts attendance timer.",
              "Disabled if employee is already clocked in."
            ],
            [
              "Start Break Button",
              "Action Button (Orange)",
              "Pauses shift timer and records unpaid rest/meal break.",
              "Only available when employee is actively clocked in."
            ],
            [
              "End Break Button",
              "Action Button (Blue)",
              "Concludes rest break and resumes active working shift.",
              "Only available when employee is currently on break."
            ],
            [
              "Clock Out Button",
              "Action Button (Red)",
              "Terminates work shift and commits total duration to timesheets.",
              "Disabled if employee is not currently clocked in."
            ]
          ]
        }
      }
    ]
  },
  {
    "id": "ch11",
    "number": 11,
    "title": "User Management & Access Control",
    "roleBadge": "ADMIN ONLY",
    "purpose": "This chapter explains how Administrators create, edit, disable, and manage web system login accounts.",
    "whereToFind": "Sidebar: User Management (/users) – Administrator credentials required",
    "overview": "User Management controls which individuals possess credentials to sign into the Espro POS web application, distinguishing system users from counter-only kiosk staff.",
    "screenshot": {
      "label": "[Screenshot: User Management Page – Staff User Accounts Table with Roles, Active Status Toggles, and Add User Button]",
      "caption": "Figure 11.1 – User management and credential control panel."
    },
    "sections": [
      {
        "heading": "11.1 Creating a New System User Account",
        "content": "To grant web system login privileges to a manager or lead cashier:",
        "tasks": [
          {
            "title": "Provisioning a Web User Account",
            "steps": [
              "Navigate to User Management from the sidebar.",
              "Click \"Add User\" in the upper right corner.",
              "Enter the user's Full Name (e.g., \"John Doe\").",
              "Enter an authorized Username (e.g., \"johndoe\"). The system appends \"@espro.ph\" automatically.",
              "Enter a strong temporary Password (minimum 6 characters).",
              "Assign a System Role: Select \"Administrator\" for store managers, or \"Employee\" for counter staff.",
              "Click \"Create Account\".",
              "Expected Result: Account is registered on Supabase Auth and added to the active users ledger."
            ]
          }
        ]
      },
      {
        "heading": "11.2 Disabling and Re-enabling User Accounts",
        "content": "If an employee resigns or takes extended leave, Administrators can immediately revoke access without deleting historical records:\n- Click the \"Disable Account\" toggle on the user row.\n- The account status changes to \"disabled\". Any attempt to log in with these credentials will immediately return: \"Account has been disabled by System Administrator.\"\n- Toggling the switch back to active immediately restores access."
      },
      {
        "heading": "11.3 User Management Field Reference Table",
        "content": "The following reference table outlines the administrative account configuration controls:",
        "table": {
          "headers": [
            "Field Name",
            "Required",
            "Description",
            "Validation & Rules"
          ],
          "rows": [
            [
              "Full Name",
              "Yes",
              "Administrative display name.",
              "Text string. Minimum 2 characters."
            ],
            [
              "Username / Email",
              "Yes",
              "Login email identifier.",
              "Auto-appends \"@espro.ph\". Example: \"manager@espro.ph\". Must be unique."
            ],
            [
              "System Role",
              "Yes",
              "System permission boundary.",
              "Options: \"Administrator\" (full access) or \"Employee\" (counter restricted)."
            ],
            [
              "Account Password",
              "Yes",
              "Initial login password.",
              "Minimum 6 characters. Must contain letters and numbers for best practice."
            ],
            [
              "Account Status Toggle",
              "Yes",
              "Active / Inactive switch.",
              "Disabling immediately terminates active sessions and blocks authentication."
            ]
          ]
        }
      }
    ]
  },
  {
    "id": "ch12",
    "number": 12,
    "title": "Account Settings & Security",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter details how all users inspect their assigned profile details and independently update their login passwords.",
    "whereToFind": "Sidebar Settings Icon or Top Bar User Avatar (/settings)",
    "overview": "The Settings page provides self-service profile and password management for all authenticated users.",
    "screenshot": {
      "label": "[Screenshot: Settings Page – Read-Only Profile Card on Left and Change Password Form on Right]",
      "caption": "Figure 12.1 – Self-service profile information and password security interface."
    },
    "sections": [
      {
        "heading": "12.1 Viewing Profile Information",
        "content": "The left-hand card displays your authenticated profile details:\n- Full Name: Display name configured by Administrators.\n- Email Address: Login email address ('username@espro.ph').\n- Assigned Role: Indicates Administrator (Full Access) or Employee (Cashier/Staff). These fields are read-only to preserve organizational security."
      },
      {
        "heading": "12.2 Changing Your Account Password",
        "content": "All users can change their password at any time:",
        "tasks": [
          {
            "title": "Self-Service Password Update",
            "steps": [
              "Navigate to Settings by clicking the gear icon in the sidebar or tapping your avatar in the Top Bar.",
              "In the Security & Password panel, enter your new password (minimum 6 characters).",
              "Re-enter the exact same password in the Confirm Password field.",
              "Click the Eye icon to inspect entered characters and ensure accuracy.",
              "Click \"Update Password\".",
              "Expected Result: A success toast confirms \"Password updated successfully!\", and Supabase Auth updates your credentials immediately."
            ]
          }
        ]
      },
      {
        "heading": "12.3 Account Security Field Reference Table",
        "content": "The following reference table details the self-service profile and password modification parameters:",
        "table": {
          "headers": [
            "Field Name",
            "State",
            "Functional Description",
            "Security Constraint"
          ],
          "rows": [
            [
              "Full Name",
              "Read-Only",
              "Displays authenticated user name.",
              "Managed exclusively by Administrators in User Management."
            ],
            [
              "Email Address",
              "Read-Only",
              "Displays current login email.",
              "Read-only to prevent unauthorized credential redirection."
            ],
            [
              "Assigned Role",
              "Read-Only",
              "Displays current access tier (Administrator or Employee).",
              "Read-only security attribute."
            ],
            [
              "Current Password",
              "Editable",
              "Existing account password for verification.",
              "Must match authenticated hash in database."
            ],
            [
              "New Password",
              "Editable",
              "Proposed replacement password.",
              "Minimum 6 characters. Cannot match current password."
            ],
            [
              "Confirm New Password",
              "Editable",
              "Re-entry of proposed password to prevent typos.",
              "Must match New Password identically."
            ]
          ]
        }
      }
    ]
  },
  {
    "id": "ch13",
    "number": 13,
    "title": "Step-by-Step Common Workflows",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter provides complete, end-to-end procedural walkthroughs for the six most critical daily operations in the cafe.",
    "whereToFind": "Operational Procedures Manual",
    "overview": "To ensure seamless standard operating procedures (SOP), this chapter maps out step-by-step instructions for opening the store, launching new drinks, receiving deliveries, resolving refunds, closing the register, and onboarding new baristas.",
    "sections": [
      {
        "heading": "13.1 Workflow 1: Opening the Coffee Shop (Morning Routine)",
        "content": "Role: Opening Barista / Shift Supervisor\nObjective: Prepare registers, verify raw stock, and unlock POS selling permissions.",
        "tasks": [
          {
            "title": "Morning Opening Checklist",
            "steps": [
              "Power on the counter terminal or tablet and open the Espro POS application.",
              "Sign in using your barista or supervisor credentials.",
              "Immediately open the Time Clock Kiosk from the Top Bar, select your name, enter your 4-digit PIN, and click \"Clock In\".",
              "Review the Dashboard: Check the \"Stock Alerts\" card to identify any ingredients that ran out during the previous closing shift.",
              "Verify the Notification Bell in the Top Bar: Confirm no dairy or syrup batches are flagged as \"Expired\".",
              "Navigate to POS: Confirm the product grid displays available servings and that the register is unlocked for sales.",
              "Prepare cash float: Ensure the physical cash drawer contains standard opening change (₱1,000 in small bills and coins)."
            ]
          }
        ]
      },
      {
        "heading": "13.2 Workflow 2: Launching a New Beverage on the Menu",
        "content": "Role: Administrator / Store Owner\nObjective: End-to-end creation of a specialty beverage from raw inventory to POS test.",
        "tasks": [
          {
            "title": "Beverage Launch Sequence",
            "steps": [
              "Step 1 (Inventory): Go to Inventory. If the new drink requires unique ingredients (e.g., \"Pistachio Paste\"), click \"Add Item\", set unit to \"g\", cost per unit, and threshold.",
              "Step 2 (Menu): Go to Menu, click \"Add Item\", enter name \"Iced Pistachio Latte\", select category \"Specialty Coffee\", and upload product photo.",
              "Step 3 (Sizes): Enable \"Multiple Sizes\". Add \"Regular 12oz\" (₱165.00, multiplier 1.0x) and \"Large 16oz\" (₱195.00, multiplier 1.5x). Set Regular as default.",
              "Step 4 (Recipe): In Recipe Editor, add Espresso Beans (18g), Whole Milk (180ml), and Pistachio Paste (25g).",
              "Step 5 (Packaging): In Packaging section, assign 12oz Cold Cup and 12oz Flat Lid to Regular (Takeout Only), and 16oz Cold Cup and Lid to Large (Takeout Only). Add Paper Straw as Shared Packaging.",
              "Step 6 (Margin Review): Check the live margin card. Confirm both sizes yield > 70% gross margin. Click \"Save Menu Item\".",
              "Step 7 (POS Verification): Go to POS, locate \"Iced Pistachio Latte\", verify available servings, test size selection and takeout packaging deduction, and ring up a test sale."
            ]
          }
        ]
      },
      {
        "heading": "13.3 Workflow 3: Receiving a Stock Delivery & Logging Batches",
        "content": "Role: Shift Supervisor / Store Manager\nObjective: Check physical delivery invoice against delivered goods and record FEFO batches.",
        "tasks": [
          {
            "title": "Receiving Delivery Procedure",
            "steps": [
              "Inspect delivered supplier boxes (check expiration dates and packaging seal integrity).",
              "Open Espro POS and navigate to Inventory Management.",
              "Locate the delivered item (e.g., \"Full Cream Milk\") and click \"Restock\".",
              "Enter Quantity Received (e.g., 24 L), unit purchase cost (e.g., ₱95.00/L), and expiration date printed on the cartons.",
              "Enter supplier name and delivery invoice number in the note field.",
              "Click \"Confirm Restock\".",
              "Expected Result: The new batch is logged in the expandable breakdown, total inventory increases, and the stock is immediately available for POS recipes."
            ]
          }
        ]
      },
      {
        "heading": "13.4 Workflow 4: Handling Customer Complaints (Refund vs Void)",
        "content": "Role: Administrator / Store Manager\nObjective: Correct register mistakes while maintaining strictly accurate inventory counts.",
        "tasks": [
          {
            "title": "Executing a Void or Refund",
            "steps": [
              "Assess the customer situation to determine action type:",
              "  - IF customer ordered wrong drink and barista has NOT prepared it: Use VOID.",
              "  - IF customer drank half or beverage was spoiled and customer wants money back: Use REFUND.",
              "Open Financial Reports and locate the transaction in the Sales Ledger.",
              "Click the \"Void / Refund\" button on the transaction row.",
              "Select \"Void Transaction\" (restores stock to batches) or \"Refund Transaction\" (records stock as wastage without restoring).",
              "Enter mandatory manager reason (e.g., \"Drink remade due to wrong milk requested\").",
              "Click Confirm. Transaction status updates immediately in reports."
            ]
          }
        ]
      },
      {
        "heading": "13.5 Workflow 5: Closing the Day (Nightly Routine)",
        "content": "Role: Closing Supervisor / Store Manager\nObjective: Audit daily cash drawers, record daily expenses, clock out staff, and export reports.",
        "tasks": [
          {
            "title": "Nightly Closing Checklist",
            "steps": [
              "Review Dashboard: Confirm all sales are completed and none remain pending.",
              "Record Daily Expenses: Navigate to Expenses and log any daily cash payouts (e.g., ice delivery, emergency milk run, cleaning supplies).",
              "Cash Drawer Reconciliation: Go to Financial Reports, filter to \"Today\" and payment method \"Cash\". Verify physical cash in drawer matches the Total Cash Sales plus opening float minus logged cash expenses.",
              "Staff Attendance Check: Go to Employee Management > Attendance. Check the \"Who's In\" panel and ensure all baristas have clocked out at the Time Clock Kiosk.",
              "Generate Closing Reports: Click \"Export Report\" in Financial Reports and export the Daily Sales PDF and Valuation Report for the store owner."
            ]
          }
        ]
      },
      {
        "heading": "13.6 Workflow 6: Onboarding a New Barista End-to-End",
        "content": "Role: Administrator\nObjective: Register a new employee, set security PIN, provide system access, and assign shifts.",
        "tasks": [
          {
            "title": "Employee Onboarding Sequence",
            "steps": [
              "Navigate to Employee Management > Staff Directory and click \"Add Employee\".",
              "Enter personal details: Full Name, Role (\"Barista\"), Employment Type, and Hourly Rate (₱).",
              "Set a temporary 4-digit PIN (e.g., 5566) and instruct the barista on counter kiosk timekeeping.",
              "If the barista requires register access: Enable \"Grant ESPRO System Login Access\", assign username (\"barista.name@espro.ph\"), and create temporary password.",
              "Navigate to Shift Roster: Assign the new barista to upcoming training shifts on the weekly grid.",
              "Walk the barista to the counter terminal: Demonstrate clocking in at the Time Clock Kiosk and completing their first test transaction on POS."
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "ch14",
    "number": 14,
    "title": "Troubleshooting & Frequently Asked Questions",
    "roleBadge": "ALL USERS",
    "purpose": "This chapter provides practical solutions and troubleshooting procedures for common operational, hardware, and account issues encountered in the cafe.",
    "whereToFind": "Help & Support Popover or System Manual",
    "overview": "Quick diagnostic reference resolving register errors, attendance locks, stock shortages, credential resets, and printing issues.",
    "sections": [
      {
        "heading": "14.1 Frequently Asked Questions & Solutions",
        "content": "Common issues and their resolutions:",
        "table": {
          "headers": [
            "Symptom / Error Message",
            "Probable Cause",
            "Corrective Action & Resolution"
          ],
          "rows": [
            [
              "\"Invalid email or password\"",
              "Typo in credentials or user entered incorrect password.",
              "Verify email domain (@espro.ph auto-appends). Ensure Caps Lock is off. Request Admin password reset if forgotten."
            ],
            [
              "\"Account has been disabled by System Administrator\"",
              "Account access toggle was disabled in User Management.",
              "Contact store owner or manager to re-activate the account in the User Management module."
            ],
            [
              "\"Staff member is not clocked in\" error on POS",
              "Barista attempted to complete sale without clocking in at kiosk.",
              "Open Time Clock Kiosk from Top Bar, select name, enter 4-digit PIN, and clock in. Admin can bypass."
            ],
            [
              "\"Staff member is currently on break\" error on POS",
              "Barista clocked break start but has not punched break end.",
              "Open Time Clock Kiosk, enter PIN, and click \"End Break\" to unlock POS selling privileges."
            ],
            [
              "Product Card shows \"Out of Stock\" badge in POS",
              "One or more raw ingredients in the drink recipe has 0 stock.",
              "Check inventory master list. Restock depleted ingredient or adjust stock count if physical stock exists."
            ],
            [
              "\"Insufficient stock for [Item] — need X, only Y available\"",
              "Order quantity exceeds total available active batch inventory.",
              "Reduce cart quantity, remove out-of-stock item, or log an incoming delivery batch in Inventory."
            ],
            [
              "Kiosk staff member cannot sign in to web login screen",
              "Employee is registered for counter PIN attendance only.",
              "Admin must open Employee Management, edit staff member, and enable \"Grant ESPRO System Login Access\"."
            ],
            [
              "Receipt did not print after sale completion",
              "Thermal printer offline, disconnected, or paper roll depleted.",
              "Check printer power and USB/Bluetooth cable. In Espro POS, click \"Print\" again from the Receipt page."
            ],
            [
              "Export PDF or CSV downloads an empty file",
              "Date range filter selected contains no matching sales/expenses.",
              "Adjust date filter toolbar to \"All Time\" or select an active date range that contains recorded transactions."
            ],
            [
              "Barista forgot their 4-digit Time Clock PIN",
              "Staff member cannot remember attendance PIN code.",
              "Administrator opens Employee Management > Staff Directory, clicks \"Change PIN\", and sets a new 4-digit code."
            ]
          ]
        }
      }
    ]
  }
];

export const appendices = [
  {
    "id": "appA",
    "title": "Appendix A – Granular Role-Access Matrix",
    "content": "Comprehensive permission matrix across all granular system operations:",
    "table": {
      "headers": [
        "System Operation / Action",
        "Administrator",
        "Employee (Barista/Cashier)",
        "Enforcement Layer"
      ],
      "rows": [
        [
          "View Dashboard & Metrics",
          "Allowed",
          "Allowed",
          "Route & UI Access"
        ],
        [
          "Process POS Sales (Clocked In)",
          "Allowed",
          "Allowed",
          "Client & RPC Validation"
        ],
        [
          "Process POS Sales (Bypass Clock-in)",
          "Allowed",
          "Blocked",
          "Role-based Bypass Check"
        ],
        [
          "Apply Cart Discounts (₱ and %)",
          "Allowed",
          "Allowed",
          "Clamped to Subtotal / 100%"
        ],
        [
          "Void Active Order in Cart",
          "Allowed",
          "Allowed",
          "Requires Void Reason"
        ],
        [
          "Print / Re-print 80mm Receipts",
          "Allowed",
          "Allowed",
          "Route Access"
        ],
        [
          "View Inventory Balances & Batches",
          "Allowed",
          "Allowed",
          "Route Access"
        ],
        [
          "Restock Delivery Batches",
          "Allowed",
          "Allowed",
          "Database RPC"
        ],
        [
          "Adjust Stock (Deduct / Set Exact)",
          "Allowed",
          "Allowed",
          "Database RPC"
        ],
        [
          "Export Inventory Valuation PDF/CSV",
          "Allowed",
          "Allowed",
          "Client Export Suite"
        ],
        [
          "Record Operational Expenses (OPEX)",
          "Allowed",
          "Allowed",
          "Database Insert"
        ],
        [
          "Create / Edit / Delete Menu Items",
          "Allowed",
          "Blocked",
          "Route Guard (/menu)"
        ],
        [
          "Formulate Recipes & Unit Conversions",
          "Allowed",
          "Blocked",
          "Route Guard (/menu)"
        ],
        [
          "Configure Sizes & Ingredient Multipliers",
          "Allowed",
          "Blocked",
          "Route Guard (/menu)"
        ],
        [
          "Create & Edit Add-on Modifiers",
          "Allowed",
          "Blocked",
          "Route Guard (/menu)"
        ],
        [
          "Configure Order Packaging Rules",
          "Allowed",
          "Blocked",
          "Route Guard (/menu)"
        ],
        [
          "Access Financial Reports & P&L",
          "Allowed",
          "Blocked",
          "Route Guard (/reports)"
        ],
        [
          "Void Completed Sales (Restore Stock)",
          "Allowed",
          "Blocked",
          "Route Guard (/reports)"
        ],
        [
          "Refund Completed Sales (Wastage)",
          "Allowed",
          "Blocked",
          "Route Guard (/reports)"
        ],
        [
          "Export Full Audit Pack PDF",
          "Allowed",
          "Blocked",
          "Route Guard (/reports)"
        ],
        [
          "Manage Staff Directory & Wages",
          "Allowed",
          "Blocked",
          "Route Guard (/employees)"
        ],
        [
          "Adjust Employee Attendance Timesheets",
          "Allowed",
          "Blocked",
          "Route Guard (/employees)"
        ],
        [
          "Export Payroll CSV (1.25x Overtime)",
          "Allowed",
          "Blocked",
          "Route Guard (/employees)"
        ],
        [
          "Manage Weekly Shift Roster & Templates",
          "Allowed",
          "Blocked",
          "Route Guard (/employees)"
        ],
        [
          "Manage Web Login Accounts (/users)",
          "Allowed",
          "Blocked",
          "Route Guard (/users)"
        ],
        [
          "Update Personal Account Password",
          "Allowed",
          "Allowed",
          "Self-service Settings"
        ]
      ]
    }
  },
  {
    "id": "appB",
    "title": "Appendix B – Status Colors & UI Badges Legend",
    "content": "Visual style guide explaining color tokens, semantic badges, and operational meanings:",
    "table": {
      "headers": [
        "Status Badge",
        "Background & Border Token",
        "Text Color",
        "Operational Significance"
      ],
      "rows": [
        [
          "badge-success (OK / Present)",
          "#2D6A4F (12% tint)",
          "#2D6A4F (Green)",
          "Stock healthy; employee on duty; transaction completed."
        ],
        [
          "badge-warning (Low / Near Expiry)",
          "#C2671A (12% tint)",
          "#C2671A (Amber)",
          "Stock at/below reorder threshold; batch expiring within 7 days; employee late."
        ],
        [
          "badge-danger (Out / Expired / Void)",
          "#B83A2E (12% tint)",
          "#B83A2E (Red)",
          "Stock 0; batch expired past date; transaction voided."
        ],
        [
          "badge-info (Supply / Digital)",
          "#2E6585 (12% tint)",
          "#2E6585 (Blue)",
          "Item categorized as Packaging Supply; payment processed via GCash/digital."
        ],
        [
          "badge-neutral (General / Standard)",
          "#F3E9D7 / #7A553A (10% tint)",
          "#7A553A (Mocha)",
          "Standard category label; neutral item unit indicator."
        ],
        [
          "badge-admin (ADMIN ONLY)",
          "#7A4A2B (Solid Mocha)",
          "#FFFFFF (White)",
          "High-security feature restricted strictly to Store Administrators."
        ],
        [
          "badge-all (ALL USERS)",
          "#2D6A4F (Solid Green)",
          "#FFFFFF (White)",
          "Standard operational module accessible to all authenticated cafe staff."
        ]
      ]
    }
  },
  {
    "id": "appC",
    "title": "Appendix C – Supported Units of Measurement & Conversion Ratios",
    "content": "Universal unit conversion engine reference for coffee shop inventory and recipes:",
    "table": {
      "headers": [
        "Unit Name",
        "Abbreviation",
        "Physical Category",
        "Base Conversion Ratio",
        "Typical Usage in Coffee Shop"
      ],
      "rows": [
        [
          "Milligram",
          "mg",
          "Mass",
          "0.001 g",
          "Micro-dosing specialty minerals, water chemistry salts."
        ],
        [
          "Gram",
          "g",
          "Mass",
          "1.0 g (Base)",
          "Espresso doses (18g), matcha powder (5g), cocoa powder."
        ],
        [
          "Kilogram",
          "kg",
          "Mass",
          "1,000.0 g",
          "Inventory bulk tracking for coffee bean bags, sugar sacks."
        ],
        [
          "Ounce (weight)",
          "oz",
          "Mass",
          "28.3495 g",
          "Imported specialty whole bean retail bags (12oz = 340g)."
        ],
        [
          "Pound",
          "lb",
          "Mass",
          "453.592 g",
          "Green bean sourcing, bulk wholesale roaster packaging."
        ],
        [
          "Milliliter",
          "ml",
          "Volume",
          "1.0 ml (Base)",
          "Drink recipes: steamed milk (200ml), syrup pours (20ml)."
        ],
        [
          "Liter",
          "L",
          "Volume",
          "1,000.0 ml",
          "Inventory bulk tracking for dairy cartons, oat milk jugs."
        ],
        [
          "Fluid Ounce",
          "fl oz",
          "Volume",
          "29.5735 ml",
          "American drink sizes (8oz, 12oz, 16oz cup capacity)."
        ],
        [
          "Teaspoon",
          "tsp",
          "Volume",
          "5.0 ml",
          "Syrup and flavor extract measuring."
        ],
        [
          "Tablespoon",
          "tbsp",
          "Volume",
          "15.0 ml",
          "Sauce measuring (caramel sauce, condensed milk)."
        ],
        [
          "Cup (volume)",
          "cup",
          "Volume",
          "240.0 ml",
          "Culinary kitchen prep and cold brew steeping batches."
        ],
        [
          "Espresso Shot",
          "shots",
          "Volume",
          "30.0 ml",
          "Standard double shot espresso liquid volume extraction."
        ],
        [
          "Syrup Pump",
          "pumps",
          "Volume",
          "10.0 ml",
          "Calibrated commercial syrup dispenser stroke volume."
        ],
        [
          "Dash",
          "dashes",
          "Volume",
          "1.0 ml",
          "Bitters, cocktail extracts, liquid spices."
        ],
        [
          "Pieces",
          "pcs",
          "Count",
          "1.0 (Base)",
          "Cups, lids, straws, pastry units, cold brew bottles."
        ],
        [
          "Scoop",
          "scoops",
          "Count",
          "1.0",
          "Ice scoops, boba pearl scoops, powder scoops."
        ],
        [
          "Bottle",
          "bottles",
          "Count",
          "1.0",
          "Retail RTD bottled beverages, kombucha, sparkling water."
        ],
        [
          "Can",
          "cans",
          "Count",
          "1.0",
          "Soda cans, tonic water, condensed milk cans."
        ],
        [
          "Pack / Box / Bag",
          "packs/boxes",
          "Count",
          "1.0",
          "Bulk packaging units, tea filter boxes, straw bundles."
        ]
      ]
    }
  },
  {
    "id": "appD",
    "title": "Appendix D – Keyboard Shortcuts & Cashier Quick-Tips",
    "content": "Hardware keyboard shortcuts and ergonomic tips for fast counter throughput:",
    "table": {
      "headers": [
        "Shortcut Key",
        "Screen / Context",
        "Operational Action Executed"
      ],
      "rows": [
        [
          "[Enter]",
          "Confirm Order Checkout Modal",
          "Immediately completes the sale and prints receipt (if cash/digital valid)."
        ],
        [
          "[Esc]",
          "Any Open Modal (Checkout, Sizes, Addons)",
          "Dismisses and closes the modal without applying changes."
        ],
        [
          "[0] – [9]",
          "Time Clock Kiosk PIN Entry",
          "Types numbers directly into the 4-digit attendance PIN field."
        ],
        [
          "[Backspace]",
          "Time Clock Kiosk PIN Entry",
          "Deletes the last entered PIN digit."
        ],
        [
          "[Enter]",
          "Login Screen Form",
          "Submits credentials and signs in."
        ],
        [
          "Swipe Right",
          "Mobile / Tablet View (Screen Edge)",
          "Opens the left navigation drawer."
        ],
        [
          "Swipe Left",
          "Mobile / Tablet Navigation Drawer",
          "Closes the left navigation drawer."
        ],
        [
          "Tap & Hold (380ms)",
          "Reports Sales Ledger (Items Badge)",
          "Anchors the item inspection popover on touchscreens."
        ],
        [
          "Click Quick Tender",
          "Cash Checkout Section",
          "Instantly fills the exact bill amount (₱100, ₱500, ₱1,000, etc.)."
        ]
      ]
    }
  },
  {
    "id": "appE",
    "title": "Appendix E – Data Architecture, Security & Offline Operation Notes",
    "content": "Technical notes on data storage, sync failover, and operational resilience:\n\n1. Hybrid Storage Engine:\n   Espro POS is engineered with a dual-persistence architecture. All operational entities (menu items, raw ingredients, delivery batches, sales logs, and employee attendance punches) are synchronized with the Supabase PostgreSQL cloud database. Simultaneously, the application caches state to browser local storage.\n\n2. Offline & Network Interruption Resilience:\n   If internet connectivity is temporarily interrupted during counter operation:\n   - Cashiers can continue navigating catalog items, modifying carts, and ringing up sales.\n   - Completed sales and attendance punches are cached locally in secure browser storage.\n   - When network connectivity is re-established, local movements reconcile with the cloud database.\n\n3. Database Foreign Key Integrity:\n   - Menu items with existing sales records cannot be forcefully deleted from the database schema; they are safely deactivated to preserve historical P&L reporting integrity.\n   - Deleting a category requires reassigning existing menu items to prevent orphaned products.\n   - Ingredient deletions are guarded by database constraints; ingredients utilized in active recipes cannot be removed until unlinked.\n\n4. Data Privacy & Audit Accountability:\n   - Passwords are encrypted using enterprise-grade cryptographic hashing via Supabase Auth.\n   - Sensitive financial operations (voids, refunds, manual timesheet adjustments) strictly require logged-in Administrator authentication and mandatory audit remarks.\n   - All monetary figures and timestamps are permanently pegged to Philippine Peso (₱) and the Asia/Manila (GMT+8) timezone."
  }
];
