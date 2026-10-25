// ─── Espro POS - System User Manual ───
// Official Store Operations & Counter Reference Guide

export const manualMeta = {
  title: 'Espro POS',
  subtitle: 'System User Manual',
  tagline: 'Retail & Cafe Operations Hub',
  version: '1.0',
  date: 'October 2026',
  preparedFor: 'Espro Coffee & Tea',
  audience: 'Store Owners, General Managers, Shift Supervisors & Baristas',
  author: 'Store Operations & Training'
};

export const documentControl = {
  version: '1.0',
  date: 'October 2026',
  audience: 'Store Owners, Shift Leads, Baristas & Cashiers',
  preparedBy: 'Store Operations & Training Department',
  reviewStatus: 'Approved for Store Operations',
  purpose: 'Standard operating manual providing procedures for counter sales, recipe management, inventory control, shift timekeeping, and store reporting.'
};

export const chapters = [
  // ─── CHAPTER 1 ───
  {
    id: 'ch1',
    number: 1,
    title: 'Introduction & System Overview',
    roleBadge: 'ALL USERS',
    purpose: 'Understand the core features of Espro POS, user roles, access permissions, and standard operational terms.',
    whereToFind: 'System Root & General Navigation',
    overview: `Espro POS is the central operations hub for Espro Coffee & Tea. Engineered specifically for high-volume cafe environments, the system unifies front-of-house counter transactions with automatic ingredient deductions, drink recipe costing, staff timekeeping, and daily financial reporting.

This manual serves as the comprehensive operating guide for all cafe personnel. It outlines standard workflows for daily register sales, inventory receiving, recipe setup, and shift management.`,
    screenshot: {
      label: 'Main Counter Register & Navigation Overview',
      caption: 'Figure 1.1 – Espro POS counter interface displaying the product catalog and active order slip.'
    },
    sections: [
      {
        heading: '1.1 Core Capabilities',
        content: `Espro POS streamlines daily coffee shop operations through integrated functional areas:

- Counter Order Processing: Quickly ring up beverages, select cup sizes, apply customer customizations, and accept cash or digital payments.
- Automatic Stock Tracking: Every beverage sale automatically deducts raw beans, milk, syrups, and single-use packaging from current stock.
- Expiration Protection: Uses a First-to-Expire, First-Out (FEFO) inventory sequence to ensure older shipments are consumed first, minimizing ingredient spoilage.
- Integrated Shift Timekeeping: Staff enter a 4-digit security PIN at the counter kiosk to log shift start times, rest breaks, and departures.
- Financial & Cost Visibility: Instant calculation of daily revenue, Cost of Goods Sold (COGS), operating expenses, and net cafe profit.`
      },
      {
        heading: '1.2 User Roles & Access Levels',
        content: `The system defines two operational roles to maintain store accountability and financial security:

1. Store Administrator (Owners & General Managers):
   - Full access to all system modules, configurations, and reports.
   - Authority to create menu items, configure recipes, set prices, and view financial statements.
   - Immediate register selling access without requiring a time clock punch.

2. Employee (Baristas, Cashiers & Service Crew):
   - Streamlined counter access to the POS register, inventory view, receipt printing, and daily expense recording.
   - Attendance Guard: Staff must be actively clocked in at the counter kiosk to complete sales on the register.`
      },
      {
        heading: '1.3 Role Access Matrix',
        content: `The following matrix outlines access permissions across all store modules:`,
        table: {
          headers: ['Module / Feature', 'Store Administrator', 'Barista / Cashier', 'Operational Rules'],
          rows: [
            ['Counter Register (POS)', 'Full Access', 'Active Shift Required', 'Ring up orders, apply sizes and add-ons, accept payments, print receipts.'],
            ['Dashboard', 'Full Access', 'Full Access', 'View daily sales totals, top-selling items, and low-stock indicators.'],
            ['Inventory Management', 'Full Access', 'Full Access', 'View current stock levels, log deliveries, and record physical adjustments.'],
            ['Expense Recording', 'Full Access', 'Full Access', 'Log daily operating payouts such as ice, water refills, and cleaning supplies.'],
            ['Time Clock Kiosk', 'Full Access', 'Full Access', 'Punch in for shifts, record break intervals, and clock out using 4-digit PIN.'],
            ['Menu & Recipe Editor', 'Full Access', 'Restricted', 'Create menu items, configure cup sizes, and assign ingredient recipes.'],
            ['Financial Reports', 'Full Access', 'Restricted', 'Access detailed sales ledgers, profit summaries, and audit exports.'],
            ['Employee Management', 'Full Access', 'Restricted', 'Manage staff directory, wage rates, PIN codes, and weekly rosters.'],
            ['Void Completed Sale', 'Full Access', 'Supervisor Required', 'Cancels completed orders in the sales ledger and restores ingredient stock.']
          ]
        }
      },
      {
        heading: '1.4 Operational Glossary',
        content: `Standard definitions used across the system and throughout this manual:

- COGS (Cost of Goods Sold): The total direct cost of raw ingredients (coffee beans, dairy, syrups) and single-use packaging consumed to produce sold items.
- Dine-in vs Takeout Scope: A rule governing packaging deductions. Dine-in excludes disposable cups, lids, and bags; Takeout automatically deducts them.
- Size Multiplier: A numeric scaling factor applied to raw recipe ingredients for different cup sizes (e.g., Regular = 1.0x, Large = 1.5x).
- Add-on: An optional customer customization (e.g., Extra Espresso Shot, Oat Milk Upgrade) with independent pricing and recipe stock deductions.
- 4-Digit Security PIN: A private four-digit code assigned to each staff member for counter kiosk authentication.
- FEFO (First-Expired, First-Out): An inventory rule where shipments with the earliest expiration date are consumed first during sales deductions.
- Void vs Refund: A Void cancels an erroneous transaction and restores deducted stock. A Refund returns customer payment but preserves stock deduction as operational spoilage.`
      }
    ]
  },

  // ─── CHAPTER 2 ───
  {
    id: 'ch2',
    number: 2,
    title: 'Getting Started & System Navigation',
    roleBadge: 'ALL USERS',
    purpose: 'Sign in to the system, navigate the interface on desktop and tablet terminals, and access top-bar utilities.',
    whereToFind: 'Login Screen (/login) & Global Application Header',
    overview: `Espro POS is accessible through modern web browsers on desktop PCs, laptops, and counter tablets. The interface provides a persistent navigation sidebar and a top utility bar designed for fast access during counter service.`,
    screenshot: {
      label: 'Login Screen & Global Navigation Sidebar',
      caption: 'Figure 2.1 – System authentication screen with automatic domain resolution.'
    },
    sections: [
      {
        heading: '2.1 Signing In',
        content: `Standard sign-in procedure for all store personnel:`,
        tasks: [
          {
            title: 'Account Authentication',
            steps: [
              'Navigate to the Espro POS login page on your terminal.',
              'Enter your assigned username or email address. (Entering "username" automatically completes to "username@espro.ph").',
              'Enter your account password.',
              'Click "Sign In".'
            ],
            expectedResult: 'The login screen authenticates and redirects directly to the store Dashboard.'
          }
        ],
        callouts: [
          {
            type: 'TIP',
            title: 'Username Format',
            content: 'Entering the username prefix alone is sufficient. The system automatically appends the store domain "@espro.ph".'
          }
        ]
      },
      {
        heading: '2.2 Password Recovery',
        content: `If you cannot access your account:
1. Click the "Forgot password?" link on the sign-in screen.
2. Enter your registered email address and submit the request.
3. Follow the instructions received via email to set a new password.
4. Alternatively, a Store Administrator can reset employee passwords directly from the Staff Directory.`
      },
      {
        heading: '2.3 Navigation Structure',
        content: `The interface is organized into two primary navigation areas:

1. Navigation Sidebar:
   - Dashboard: Store sales metrics, inventory alerts, and top sellers.
   - Point of Sale (POS): The primary counter register for processing customer orders.
   - Inventory Management: Stock balance monitoring, restock logging, and physical adjustments.
   - Expense Management: Logging store expenditures and operating disbursements.
   - Menu & Recipes: Menu engineering, sizing, and recipe formulation (Admin only).
   - Financial Reports: Daily sales ledgers, profit & loss, and audit exports (Admin only).
   - Employee Management: Staff directory, shift scheduling, and attendance records (Admin only).
   - Settings: Personal account details and password configuration.

2. Top Utility Bar:
   - Search: Instant lookup for pages and menu items.
   - Time Clock Kiosk (Clock Icon): Opens the attendance punch modal.
   - Stock Alert Bell: Displays visual alerts for items at or below reorder thresholds.
   - User Profile: Displays current logged-in user and provides direct sign-out access.`
      },
      {
        heading: '2.4 Tablet and Touchscreen Usage',
        content: `When operating on touch terminals:
- The sidebar collapses automatically to maximize counter selling area.
- Tap the menu button (three lines) in the upper-left corner to expand the sidebar.
- Swipe inward from the left screen edge to open navigation on touch displays.`
      }
    ]
  },

  // ─── CHAPTER 3 ───
  {
    id: 'ch3',
    number: 3,
    title: 'Shift Timekeeping (Time Clock Kiosk)',
    roleBadge: 'ALL USERS',
    purpose: 'Record shift attendance, manage rest break intervals, and ensure register selling permission using 4-digit PIN authentication.',
    whereToFind: 'Top Bar: Click the "Time Clock" (Clock Icon) button',
    overview: `To maintain counter accountability, employees must be clocked into an active shift to complete sales on the POS screen. The counter Time Clock Kiosk provides an on-screen PIN pad for quick shift logging.`,
    screenshot: {
      label: 'Time Clock Kiosk PIN Keypad Modal',
      caption: 'Figure 3.1 – Staff attendance modal for logging shift start, breaks, and departure.'
    },
    sections: [
      {
        heading: '3.1 Clocking In at Shift Start',
        content: `Standard procedure upon arriving for counter duty:`,
        tasks: [
          {
            title: 'Starting a Work Shift',
            steps: [
              'Click the Time Clock button (clock icon) in the top utility bar.',
              'Select your name from the employee dropdown list.',
              'Enter your 4-digit PIN on the numeric keypad.',
              'Click the green "Clock In" button.'
            ],
            expectedResult: 'A green confirmation banner displays shift commencement. The kiosk closes automatically after 3 seconds, and the register is unlocked for selling.'
          }
        ]
      },
      {
        heading: '3.2 Break Management & Clocking Out',
        content: `Managing shift intervals:

1. Initiating a Break:
   - Open Time Clock Kiosk > Select your name > Enter PIN.
   - Click the orange "Start Break" button.
   - The register selling permission is temporarily locked during the break period.

2. Ending a Break:
   - Open Time Clock Kiosk > Select your name > Enter PIN.
   - Click the blue "End Break" button. Shift tracking resumes and selling is immediately re-enabled.

3. Clocking Out at Shift Completion:
   - Open Time Clock Kiosk > Select your name > Enter PIN.
   - Click the red "Clock Out" button. Shift duration is committed to timesheets for payroll calculation.`
      },
      {
        heading: '3.3 Operational Constraints',
        content: `Key timekeeping rules:
- Selling Permission: If an unclocked employee attempts checkout, a "Clock-In Required" banner prevents completion until clocked in.
- Forgotten PIN: Contact a Store Administrator to reset your 4-digit PIN in the Staff Directory.
- Administrator Bypass: Store Administrators have permanent selling permission and bypass the time clock requirement.`
      }
    ]
  },

  // ─── CHAPTER 4 ───
  {
    id: 'ch4',
    number: 4,
    title: 'Counter Order Processing (POS)',
    roleBadge: 'ALL USERS',
    purpose: 'Process customer transactions, configure beverage sizes and add-ons, handle packaging scopes, settle cash and digital payments, and print thermal receipts.',
    whereToFind: 'Sidebar: Point of Sale (/pos) or Top Bar "New Sale"',
    overview: `The POS register provides a touch-optimized interface for counter service. The menu catalog occupies the left viewport with category filters, while the active order slip and checkout controls reside on the right.`,
    screenshot: {
      label: 'POS Register Interface & Active Order Cart',
      caption: 'Figure 4.1 – Product catalog on the left, order slip and checkout controls on the right.'
    },
    sections: [
      {
        heading: '4.1 Selecting Order Mode (Dine-in vs Takeout)',
        content: `Before adding items, select the order mode using the toggle at the top of the cart:
- Dine-in: For in-store consumption using reusable tableware. Packaging supplies (disposable cups, lids, carry bags) are NOT deducted from inventory.
- Takeout: For to-go orders. Single-use plastic/paper cups, dome lids, straws, and carry bags are automatically deducted from stock.

Accurate selection ensures inventory counts remain aligned with physical storage.`
      },
      {
        heading: '4.2 Adding Items & Size Selection',
        content: `Adding menu items to the active order:
1. Tap the item card in the catalog grid or search by name.
2. If multiple sizes exist (e.g., 16oz Regular vs 22oz Large), a size picker modal opens. Tap the requested size.
3. The selected item appears on the order slip with its line price and size variant.`
      },
      {
        heading: '4.3 Custom Add-ons & Preparation Notes',
        content: `Applying item customizations:
- Click the item row or "Add-ons" button to configure customizations:
  - Extra Espresso Shot (+₱30)
  - Oat Milk Upgrade (+₱40)
  - Flavored Syrups (+₱20)
- In the "Special Instructions" field, enter preparation requests (e.g., "Less ice", "Extra hot"). Notes appear on the printed receipt and kitchen display.`
      },
      {
        heading: '4.4 Applying Order Discounts',
        content: `Applying promotional or statutory discounts:
- Click the "Discount" button on the order slip.
- Choose Fixed Peso (₱) or Percentage (%) discount mode.
- Enter the discount amount. The system computes the deduction and updates the Grand Total.
- Constraint: Discounts are clamped so they cannot exceed the order subtotal.`
      },
      {
        heading: '4.5 Checkout & Payment Processing',
        content: `When the order is finalized, click "Complete Sale" to open the payment settlement modal:`,
        tasks: [
          {
            title: 'Settling a Cash Transaction',
            steps: [
              'Select the "Cash" payment tab.',
              'Enter the cash received or click a quick-tender chip (₱100, ₱200, ₱500, ₱1,000).',
              'Verify the calculated "Change Due" display.',
              'Click "Confirm Payment" (or press [Enter]).'
            ],
            expectedResult: 'The sale is committed to the ledger, inventory batches are deducted via FEFO, and the official receipt displays.'
          },
          {
            title: 'Settling a Digital QR / GCash Transaction',
            steps: [
              'Select the "Digital / GCash" payment tab.',
              'Instruct the customer to scan the counter QR Ph standee and remit the exact Grand Total.',
              'Verify the payment confirmation on the merchant terminal or customer screen.',
              'Check the confirmation box: "I confirm that payment has been received via GCash / QR".',
              'Click "Confirm Payment".'
            ],
            expectedResult: 'Transaction records under Digital payment with ₱0 change, stock is deducted, and the receipt displays.'
          }
        ]
      },
      {
        heading: '4.6 Official Receipt & Thermal Printing',
        content: `Upon payment confirmation, the receipt interface appears:
- Displayed Data: Store details, receipt reference, date, cashier name, Dine-in/Takeout tag, itemized lines, subtotal, discount, amount received, and change.
- Print Button: Formats and outputs the receipt to connected 80mm thermal printers.
- New Sale Button: Resets the register interface for the next customer in queue.`
      },
      {
        heading: '4.7 Order Cancellation (Pre-Payment Void)',
        content: `To cancel an active order prior to payment:
1. Click the "Clear / Void" button on the order slip.
2. Select or enter a cancellation reason.
3. Confirm the void. The cart clears with no inventory or revenue impact.`
      }
    ]
  },

  // ─── CHAPTER 5 ───
  {
    id: 'ch5',
    number: 5,
    title: 'Menu Engineering & Recipe Management',
    roleBadge: 'ADMIN ONLY',
    purpose: 'Configure catalog items, define multi-size drink variants, engineer raw ingredient recipes, set packaging scopes, and monitor profit margins.',
    whereToFind: 'Sidebar: Menu & Recipes (/menu)',
    overview: `The Menu & Recipes module provides administrative controls for defining cafe offerings. Every item links to an exact bill of materials (raw ingredients and packaging supplies) enabling real-time COGS computation and automated inventory depletion.`,
    screenshot: {
      label: 'Menu Editor & Atomic Recipe Costing Interface',
      caption: 'Figure 5.1 – Menu configuration modal showing size variants, ingredient recipes, and live margin analysis.'
    },
    sections: [
      {
        heading: '5.1 Creating a Menu Item',
        content: `Standard procedure for adding catalog offerings:`,
        tasks: [
          {
            title: 'Adding a New Menu Offering',
            steps: [
              'Navigate to Menu & Recipes > Menu Items tab and click "+ Add Item".',
              'Enter the Item Name (e.g., "Iced Spanish Latte").',
              'Assign or create a Category (e.g., "Espresso Beverages").',
              'Enter the Base Selling Price in Philippine Peso (₱).',
              'Upload a product image (optional, max 5MB in JPG, PNG, or WebP format).',
              'Configure size variants and ingredient recipes as outlined below.'
            ],
            expectedResult: 'The item is registered in the catalog and displays on the POS register when enabled.'
          }
        ]
      },
      {
        heading: '5.2 Size Variants & Ingredient Multipliers',
        content: `Configuring drink sizes in the Sizes Editor:
- Define up to 6 sizes per menu item (e.g., 16oz Regular, 22oz Large).
- Ingredient Multiplier: Specifies the scaling factor for raw ingredients.
  - Standard (1.0x): Uses baseline recipe quantities.
  - Large (1.5x): Consumes 50% more raw ingredients (beans, milk, syrups). Packaging is deducted at 1 unit per drink.
- Retail Price: Set specific selling prices per size variant.
- Default Size: Designate one size as the primary default on the POS grid.`
      },
      {
        heading: '5.3 Recipe Formulation (Raw Ingredients)',
        content: `In the Recipe Editor section, assign the raw ingredients consumed per unit:
- Example: Latte Formulation
  - Espresso Beans: 18 g
  - Fresh Whole Milk: 160 ml
  - Simple Syrup: 15 ml
- Unit Conversion: Quantities can be entered in mass (g, kg) or volume (ml, l). The system handles internal conversions automatically.`
      },
      {
        heading: '5.4 Packaging Supplies & "When" Scope',
        content: `Assign single-use service items under Packaging Supplies:
- 16oz PET Cup: 1 pc -> Scope: "Takeout only"
- 98mm Flat Lid: 1 pc -> Scope: "Takeout only"
- Paper Straw: 1 pc -> Scope: "Always"

Scope Behavior:
- Takeout Only: Deducted exclusively when the register toggle is set to Takeout.
- Always: Deducted on every order regardless of service mode.`
      },
      {
        heading: '5.5 Profit Margin Analysis & Indicators',
        content: `The Live Margin Analysis bar updates dynamically during recipe editing:
- COGS (Cost of Goods Sold): Sum of raw ingredient costs and packaging supplies based on active purchase prices.
- Margin Health Indicators:
  - 🟢 Green (> 70% Gross Margin): Optimal cafe profitability threshold.
  - 🟠 Orange (50%–70% Gross Margin): Standard threshold for specialty dairy beverages.
  - 🔴 Red (< 50% Gross Margin): Low margin indicator requiring price or formulation review.`
      },
      {
        heading: '5.6 Managing Custom Add-ons',
        content: `The Add-ons & Customizations tab enables creation of reusable extras:
- Define add-on items (e.g., Extra Espresso Shot, Oat Milk Upgrade, Caramel Drizzle).
- Assign selling price and raw ingredient recipe deduction.
- Link add-ons to specific categories or all menu items.`
      }
    ]
  },

  // ─── CHAPTER 6 ───
  {
    id: 'ch6',
    number: 6,
    title: 'Inventory & Stock Management',
    roleBadge: 'ALL USERS',
    purpose: 'Monitor stock levels, log delivery shipments, record spoilage or audit adjustments, and export inventory valuation reports.',
    whereToFind: 'Sidebar: Inventory Management (/inventory)',
    overview: `The Inventory module maintains real-time tracking of Raw Ingredients (coffee beans, milk, syrups) and Packaging Supplies (cups, lids, bags). Built around First-Expired, First-Out (FEFO) batch tracking, older perishables are consumed first to prevent waste.`,
    screenshot: {
      label: 'Inventory Master List & Restock Batch Modal',
      caption: 'Figure 6.1 – Inventory balance monitoring, stock health cards, and delivery logging.'
    },
    sections: [
      {
        heading: '6.1 Stock Health Indicators',
        content: `Summary cards categorize inventory health at a glance:
- In Stock (Green): Active balance above minimum reorder threshold.
- Low Stock (Orange): Balance has reached or fallen below minimum threshold. Reorder required.
- Out of Stock (Red): Depleted balance (0 remaining). POS displays availability warnings.
- Near Expiry (Yellow): Batches expiring within 7 calendar days. Priority for counter use.
- Expired (Dark Red): Batches past expiration. Automatically removed from sales depletion.`
      },
      {
        heading: '6.2 Receiving Delivery Shipments (Restock)',
        content: `Standard procedure for logging supplier deliveries:`,
        tasks: [
          {
            title: 'Logging an Inventory Restock Batch',
            steps: [
              'Navigate to Inventory Management and locate the item in the master list.',
              'Click the "Restock" button on the item row.',
              'Enter the Quantity Received in the base measurement unit (e.g., 5000 g).',
              'Enter the Purchase Unit Price paid (e.g., ₱0.85/g).',
              'Enter the Expiration Date printed on the product packaging.',
              'Optional: Enter the supplier PO or delivery receipt reference.',
              'Click "Confirm Restock".'
            ],
            expectedResult: 'The item balance increases immediately. A new batch record is created with active FEFO tracking.'
          }
        ]
      },
      {
        heading: '6.3 Physical Stock Adjustments & Spoilage',
        content: `Modifying inventory balances during audits or wastage incidents:
1. Locate the item in the list and click "Adjust".
2. Select the adjustment method:
   - Deduct / Spoilage: Enter quantity wasted (e.g., 1000 ml milk spilled) and select reason.
   - Set Exact: Enter the physical recount quantity (e.g., 4500 ml counted).
3. Confirm the adjustment. The balance updates and the event logs to the store audit trail.`
      },
      {
        heading: '6.4 Stock Valuation Reports',
        content: `Access the "Valuation Report" tab to view total inventory asset worth:
- Displays batch-weighted monetary valuation across all active stock in Philippine Peso (₱).
- Export to PDF or CSV for accounting records and monthly balance sheets.`
      }
    ]
  },

  // ─── CHAPTER 7 ───
  {
    id: 'ch7',
    number: 7,
    title: 'Expense Management & Cost Tracking',
    roleBadge: 'ALL USERS',
    purpose: 'Record daily store cash disbursements, categorize operational expenditures, and track overhead costs.',
    whereToFind: 'Sidebar: Expense Management (/expenses)',
    overview: `The Expense module records operational cash outflows to provide an accurate Net Profit picture. It separates customer-driven COGS from daily operational expenses (OPEX).`,
    screenshot: {
      label: 'Record Expense Modal & Category Distribution Chart',
      caption: 'Figure 7.1 – Operating expense recording modal and monthly expense breakdown.'
    },
    sections: [
      {
        heading: '7.1 Expense Structure: COGS vs OPEX',
        content: `Expenses are segmented into two financial categories:

1. Cost of Goods Sold (COGS):
   - Direct ingredient and packaging costs calculated automatically from POS transactions.

2. Operating Expenses (OPEX):
   - Regular operational disbursements required to maintain store facilities:
     - Utilities (electricity, water, communications)
     - Daily Operational Supplies (tube ice, purified water refills, cleaning agents)
     - Facility Rent & Lease
     - Equipment Maintenance (espresso machine maintenance, grinder calibration)
     - Marketing & Printing`
      },
      {
        heading: '7.2 Recording a Store Disbursement',
        content: `Standard procedure for recording counter cash payouts:`,
        tasks: [
          {
            title: 'Logging an Operational Expense',
            steps: [
              'Navigate to Expense Management and click "Record Expense".',
              'Confirm the Expense Date (defaults to current date).',
              'Select the appropriate Expense Category.',
              'Enter the Payee / Vendor name.',
              'Provide a clear Description of the expenditure.',
              'Enter the Amount in Philippine Peso (₱).',
              'Select the Payment Method (Petty Cash, GCash, Bank Transfer).',
              'Click "Save Expense".'
            ],
            expectedResult: 'The record is saved, reflected in monthly expense charts, and deducted from Net Profit in financial reports.'
          }
        ]
      }
    ]
  },

  // ─── CHAPTER 8 ───
  {
    id: 'ch8',
    number: 8,
    title: 'Financial Reports & Profitability Analytics',
    roleBadge: 'ADMIN ONLY',
    purpose: 'Analyze store revenue, inspect transaction audit ledgers, process voids and refunds, and review net profitability.',
    whereToFind: 'Sidebar: Financial Reports (/reports)',
    overview: `The Financial Reports module delivers comprehensive store analytics for owners and general managers. It details transaction-level histories, sales trends, COGS breakdowns, and full Profit & Loss statements.`,
    screenshot: {
      label: 'Sales Ledger & P&L Profit Summary',
      caption: 'Figure 8.1 – Audited sales ledger with item popover details and store profitability breakdown.'
    },
    sections: [
      {
        heading: '8.1 Reporting Timeframes',
        content: `Filter financial data using preset ranges at the top of the interface:
- Today: Real-time transactions since midnight (Asia/Manila).
- Yesterday: Prior day audited performance.
- Last 7 Days: Weekly trend analysis.
- This Month / Last Month: Comprehensive monthly reconciliation.
- Custom Range: User-specified date intervals.`
      },
      {
        heading: '8.2 Sales Ledger & Transaction Inspection',
        content: `The Sales Report tab maintains an immutable record of all processed orders:
- Details: Receipt number, timestamp, cashier name, order mode, payment method, and total.
- Line Item Popover: Hover over or tap any transaction row to inspect ordered items, sizes, add-ons, and change issued.`
      },
      {
        heading: '8.3 Transaction Reversals: Void vs Refund',
        content: `Only Store Administrators can reverse completed transactions in the ledger:

1. Void Transaction:
   - Use Case: Order entered in error or charged duplicate.
   - Financial Impact: Net revenue set to ₱0.
   - Stock Impact: Restores all deducted ingredient and packaging quantities back into active batches.

2. Refund Transaction:
   - Use Case: Customer return after beverage preparation or complaint.
   - Financial Impact: Payment returned to customer.
   - Stock Impact: Ingredients are NOT restored to inventory (recorded as operational spoilage).`
      },
      {
        heading: '8.4 Profit Summary (P&L Breakdown)',
        content: `The Profit Summary tab compiles the store income statement:
- Gross Revenue: Total sales settled.
- Less COGS: Cost of ingredients and supplies consumed.
- Gross Profit: Revenue minus COGS.
- Less OPEX: Operating expenses recorded in Expense Management.
- Net Profit: Bottom-line store earnings.
- Export Options: Download summary reports in PDF or CSV format.`
      }
    ]
  },

  // ─── CHAPTER 9 ───
  {
    id: 'ch9',
    number: 9,
    title: 'Staff Management & Shift Scheduling',
    roleBadge: 'ADMIN ONLY',
    purpose: 'Maintain employee profiles, configure counter PINs, manage shift schedules, and export timesheets for payroll calculation.',
    whereToFind: 'Sidebar: Employee Management (/employees)',
    overview: `The Employee Management module centralizes human resource operations. It manages staff profiles, counter security PINs, system logins, weekly shift rosters, and audited attendance logs.`,
    screenshot: {
      label: 'Staff Directory & Weekly Shift Roster Grid',
      caption: 'Figure 9.1 – Employee directory, PIN management, and weekly scheduling calendar.'
    },
    sections: [
      {
        heading: '9.1 Registering an Employee',
        content: `Standard onboarding procedure:`,
        tasks: [
          {
            title: 'Adding a Staff Member',
            steps: [
              'Navigate to Employee Management > Staff Directory tab and click "Add Employee".',
              'Enter legal Full Name.',
              'Assign Role (Barista, Cashier, Shift Supervisor).',
              'Set Employment Type and enter base Hourly Rate (₱).',
              'Set a 4-Digit Security PIN for the counter kiosk.',
              'Optional: Enter emergency contact person and telephone number.',
              'Click "Save Employee".'
            ],
            expectedResult: 'The employee is registered in the directory and can immediately punch at the Time Clock Kiosk.'
          }
        ]
      },
      {
        heading: '9.2 System Login Credentials',
        content: `Provisioning web application access:
- In the employee profile, enable "Grant ESPRO System Login Access".
- Assign an email username. (System auto-appends "@espro.ph").
- Set an initial password (minimum 6 characters).
- Staff can now log in to the POS terminal or assigned back-office modules.`
      },
      {
        heading: '9.3 Attendance & Payroll Timesheets',
        content: `Under the Attendance tab:
- Live Monitoring: The "Who's In" panel displays currently clocked-in personnel and active break statuses.
- Punch Correction: If a punch was missed, click "Edit" on the timesheet row, enter corrected times, provide a mandatory audit note, and save.
- Payroll Export: Click "Export Timesheets CSV" to download an audited payroll file including:
  - Regular hours worked.
  - Overtime hours (automatically calculates 1.25x for shifts exceeding 8.0 hours).
  - Late arrival flags (triggered for punches > 5 minutes after scheduled start).`
      },
      {
        heading: '9.4 Shift Scheduling & Swaps',
        content: `Under the Shift Roster tab:
- Weekly calendar grid (Monday through Sunday).
- Click any date cell to assign shift templates (e.g., Morning Shift 6:00 AM – 2:00 PM).
- Use "Swap Shift" to exchange scheduled shifts between employees with automatic roster updates.`
      }
    ]
  },

  // ─── CHAPTER 10 ───
  {
    id: 'ch10',
    number: 10,
    title: 'Standard Operating Procedures & Checklists',
    roleBadge: 'ALL USERS',
    purpose: 'Standard checklists for cafe opening, delivery receiving, transaction reversals, and closing procedures.',
    whereToFind: 'Counter Daily Operations',
    overview: `Consistent operational routines ensure efficient cafe service and inventory precision. Follow these step-by-step checklists during daily counter shifts.`,
    screenshot: {
      label: 'Store Opening Dashboard & Low-Stock Alerts',
      caption: 'Figure 10.1 – Morning store overview displaying daily targets and inventory reorder alerts.'
    },
    sections: [
      {
        heading: '10.1 Morning Opening Checklist',
        content: `Execute 30 minutes prior to opening store doors:`,
        tasks: [
          {
            title: 'Store Opening Sequence',
            steps: [
              'Power on the counter terminal and open the Espro POS application.',
              'Open the Time Clock Kiosk, select your name, enter your 4-digit PIN, and clock in.',
              'Review the Dashboard Stock Alerts card to identify low dairy, beans, or packaging supplies.',
              'Verify the opening cash drawer float (e.g., ₱2,000 in small denominations).',
              'Open the POS register screen and verify receipt printer connectivity.',
              'Unlock cafe doors and commence service.'
            ],
            expectedResult: 'Terminal is unlocked, attendance is logged, and register is prepared for counter orders.'
          }
        ]
      },
      {
        heading: '10.2 Delivery Receiving Checklist',
        content: `When receiving supplier shipments:
1. Verify physical items against the delivery invoice for quantity and packaging integrity.
2. In Espro POS, open Inventory Management.
3. Click "Restock" on each delivered item row.
4. Input quantity, unit cost, and expiration date from packaging.
5. Confirm restock. Inventory counts update immediately.`
      },
      {
        heading: '10.3 Evening Closing Checklist',
        content: `Execute immediately following store closing:`,
        tasks: [
          {
            title: 'Store Closing Sequence',
            steps: [
              'Count the cash drawer. Deduct opening float to determine cash drawer sales.',
              'Open Expense Management: Log any cash paid out from register petty cash.',
              'Review Dashboard Today Sales to reconcile cash and digital totals against the drawer count.',
              'Open Time Clock Kiosk, enter your 4-digit PIN, and clock out.',
              'Close the terminal application and power down hardware.'
            ],
            expectedResult: 'Cash balances are verified, labor hours are committed, and store records are securely finalized.'
          }
        ]
      }
    ]
  },

  // ─── CHAPTER 11 ───
  {
    id: 'ch11',
    number: 11,
    title: 'Troubleshooting & Support Procedures',
    roleBadge: 'ALL USERS',
    purpose: 'Standard resolutions for common counter operational questions and terminal messages.',
    whereToFind: 'Counter Reference',
    overview: `Standard operational procedures for addressing counter situations and terminal notifications:`,
    screenshot: {
      label: 'Terminal Notification & Selling Guard Display',
      caption: 'Figure 11.1 – Terminal selling permission banner and resolution notification.'
    },
    sections: [
      {
        heading: '11.1 Operational Situations & Resolutions',
        content: `Standard troubleshooting reference:`,
        table: {
          headers: ['Observed Condition', 'Cause', 'Standard Resolution Procedure'],
          rows: [
            ['"Clock-In Required" banner prevents checkout.', 'Cashier is not clocked in or is on break.', 'Open Time Clock Kiosk (Clock icon) > Select name > Enter PIN > Clock In (or End Break). Selling unlocks immediately.'],
            ['Authentication Failure / Invalid Credentials.', 'Incorrect password or username entered.', 'Verify Caps Lock. Username prefix alone is accepted. Contact Administrator to reset credentials if unresolved.'],
            ['Item displays "Out of Stock" on register.', 'One or more recipe ingredients has 0 stock balance.', 'Verify physical stock. If stock was delivered but unlogged, navigate to Inventory > Restock. Item unlocks once balance > 0.'],
            ['Thermal printer does not output receipt.', 'Paper roll depleted, printer power off, or cable disconnected.', 'Inspect printer power and paper compartment. Once resolved, click "Print" again on receipt screen.'],
            ['Customer requests digital payment cancellation.', 'Order settled via GCash but customer canceled.', 'Contact Administrator. Open Reports > Sales Ledger > Locate transaction > Click "Refund". Payment is returned.'],
            ['Counter internet connectivity interrupted.', 'Temporary ISP network disruption.', 'Maintain active browser session. POS retains transactions locally. Data synchronizes automatically once connectivity restores.'],
            ['Cashier forgotten 4-digit PIN.', 'Security code unavailable.', 'Contact Administrator. Open Employee Management > Staff Directory > Click "Change PIN" to assign a new 4-digit code.'],
            ['Discount entry rejected.', 'Discount exceeds order total.', 'Discounts cannot exceed active cart value. Enter an amount equal to or less than cart subtotal.']
          ]
        }
      }
    ]
  }
];

export const appendices = [
  {
    id: 'app-a',
    letter: 'A',
    title: 'Terminal Interface & Icon Reference',
    content: 'Standard interface icons and functional controls across counter terminals:',
    table: {
      headers: ['Interface Element', 'Control Name', 'Functional Operation'],
      rows: [
        ['🕒 (Clock Icon)', 'Time Clock Kiosk', 'Opens staff attendance punch modal for shift commencement, breaks, and departure.'],
        ['🔔 (Bell Icon)', 'Stock Alert Indicator', 'Displays notifications for inventory items at or below minimum reorder thresholds.'],
        ['👤 (User Avatar)', 'Account Menu', 'Displays authenticated user and provides direct access to profile settings and sign out.'],
        ['☰ (Menu Drawer)', 'Mobile Navigation', 'Toggles the navigation sidebar on touchscreen and tablet displays.'],
        ['[Dine-in / Takeout]', 'Packaging Toggle', 'Sets order mode between Dine-in (reusable ware) and Takeout (automatic packaging deductions).'],
        ['🗑️ (Clear Button)', 'Void Cart', 'Empties active order slip prior to payment settlement.'],
        ['🏷️ (Discount Button)', 'Apply Discount', 'Opens discount configuration modal for percentage or fixed monetary deductions.'],
        ['💵 (Complete Sale)', 'Payment Checkout', 'Launches payment settlement modal for cash tender or digital QR confirmation.']
      ]
    }
  },
  {
    id: 'app-b',
    letter: 'B',
    title: 'Supported Measurement Units & Conversion',
    content: 'Standard measurement units utilized in inventory management and recipe costing:',
    table: {
      headers: ['Symbol', 'Unit Name', 'Classification', 'Conversion Standard'],
      rows: [
        ['g', 'Gram', 'Mass (Raw Ingredients)', '1,000 g = 1 kg'],
        ['kg', 'Kilogram', 'Mass (Bulk Packaging)', '1 kg = 1,000 g'],
        ['ml', 'Milliliter', 'Volume (Liquids & Syrups)', '1,000 ml = 1 Liter'],
        ['l', 'Liter', 'Volume (Bulk Dairy & Bases)', '1 Liter = 1,000 ml'],
        ['pcs', 'Pieces', 'Discrete (Packaging Supplies)', 'Individual unit count']
      ]
    }
  }
];
