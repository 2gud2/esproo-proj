// ─── Content Enrichment for Espro POS Manual ───
import fs from 'fs';
import { manualMeta, documentControl, chapters, appendices } from './manual-content.mjs';

// Enhance Chapter 3 (Dashboard)
const ch3 = chapters.find(c => c.number === 3);
if (ch3) {
  // Add Field Reference Table for Dashboard
  ch3.sections.push({
    heading: '3.5 Dashboard Interface & Metric Reference Table',
    content: `The following reference table explains each KPI card, data visualization, and filter control available on the executive dashboard:`,
    table: {
      headers: ['Dashboard Control / Card', 'Data Source / Computation', 'Operational Significance', 'Recommended Action Threshold'],
      rows: [
        ['Today Sales (₱)', 'Sum of all completed orders settled between 00:00:00 and 23:59:59 (Asia/Manila). Excludes voided orders.', 'Primary daily cash flow and counter sales volume.', 'Monitor against daily cafe revenue target (e.g., ₱15,000/day).'],
        ['Orders Today', 'Total count of completed transactions processed by cashiers today.', 'Customer transaction frequency and counter speed of service.', 'Analyze peak volume relative to scheduled barista staffing.'],
        ['Total Ingredients in Stock', 'Count of raw ingredient catalog items with active stock quantity > 0.', 'General ingredient availability for counter brewing.', 'If count decreases unexpectedly, check for missing delivery receipts.'],
        ['Stock Alerts Card', 'Count of inventory items where Remaining Stock <= Minimum Reorder Threshold.', 'Immediate early warning indicator for critical stockouts.', 'Immediate restock order required if count > 0.'],
        ['Top Seller Today', 'Menu item variant with the highest cumulative units sold today.', 'Identifies customer preference trends and prep station load.', 'Ensure sufficient prep (e.g., cold brew batching, milk restock).'],
        ['Sales Trend Range Switcher', 'Toggles between "Today" (hourly 6am-10pm), "Weekly" (7 days), and "Monthly" (30 days).', 'Provides multi-horizon revenue visualization.', 'Use Weekly during weekend scheduling; Monthly for accounting.'],
        ['Best-Sellers Timeframe Filter', 'Filters Top 10 leaderboard by Today, This Week, or This Month.', 'Ranks menu items by volume and gross revenue.', 'Identify underperforming items for potential menu rotation.']
      ]
    }
  });

  ch3.sections.push({
    heading: '3.6 Operational Business Rules for Dashboard Data',
    content: `The Dashboard adheres to strict computational business rules to ensure data accuracy:
- Timezone Alignment: All daily metrics calculate based on Asia/Manila (PHT, UTC+8) calendar boundaries starting at 12:00:00 AM.
- Exclusion of Voided Orders: When an order is voided by an Administrator in Financial Reports, its gross revenue and unit count are immediately subtracted from Today Sales and Orders Today.
- Stock Status Calculation: Stock alerts dynamically query remaining active batch balances. Items with 0 remaining stock are categorized as "Out of Stock", while items with stock > 0 but <= minimum threshold are flagged as "Low Stock".
- Leaderboard Ranking: The Best-Sellers widget ranks items based on total quantity sold. In the event of a tie, the item with the higher gross monetary revenue is ranked higher.`
  });

  ch3.sections.push({
    heading: '3.7 Step-by-Step Task: Shift Handover & Stock Audit',
    content: `Shift Supervisors should execute this sequence during mid-day and evening shift handovers:`,
    tasks: [
      {
        title: 'Conducting Shift Handover Review',
        steps: [
          'Log in to Espro POS using Supervisor or Admin credentials.',
          'Review Today Sales (₱) and Orders Today on the top metric cards.',
          'Inspect the Sales Trend chart to verify hourly transaction cadence.',
          'Click the "Stock Alerts" card to review depleted or critically low ingredients.',
          'Record required inventory prep (e.g., brewing simple syrup, thawing pastries) in the handover log book.'
        ],
        expectedResult: 'Shift supervisor has verified daily sales figures and identified all inventory items requiring restock before the next shift rush.'
      }
    ]
  });
}

// Enhance Chapter 4 (POS)
const ch4 = chapters.find(c => c.number === 4);
if (ch4) {
  ch4.sections.push({
    heading: '4.13 Point of Sale Field Reference Table',
    content: `The following reference table details every interactive control, input field, and action button within the POS register and checkout interface:`,
    table: {
      headers: ['POS Interface Element', 'Type / Input Format', 'Functional Description', 'Business Rule & Validation'],
      rows: [
        ['Dine-in / Takeout Toggle', 'Segmented Switch Button', 'Switches active order packaging mode between Dine-in and Takeout.', 'Dine-in excludes disposable cups and bags; Takeout automatically deducts packaging supplies.'],
        ['Product Search Bar', 'Text Input Box', 'Filters product grid in real-time by item name or category.', 'Instant search with keyboard focus shortcut.'],
        ['Category Filter Pills', 'Clickable Buttons', 'Filters catalog items by category (e.g., Espresso, Non-Coffee, Pastries).', '"All Items" displays complete active menu.'],
        ['Size Selector Chips', 'Radio Button Group', 'Selects drink serving size (e.g., 8oz, 12oz, 16oz, Regular, Large).', 'Multiplies raw ingredient deductions by size multiplier (e.g., 1.5x). Packaging deducted as 1 unit.'],
        ['Custom Add-on Checkboxes', 'Multi-select Chips', 'Applies extra customizations (e.g., Extra Espresso Shot, Oat Milk Upgrade).', 'Increases item price and adds custom recipe ingredient deductions to transaction.'],
        ['Special Instructions', 'Textarea (Optional)', 'Notes customer preparation preferences (e.g., "Less ice", "Extra hot").', 'Appears on kitchen preparation display and printed thermal receipt.'],
        ['Quantity Increment / Decrement', 'Steppers (+ / -)', 'Adjusts ordered quantity of selected line item.', 'Minimum quantity is 1. Decrementing below 1 removes line item from cart.'],
        ['Discount Mode Selector', 'Dropdown / Toggle', 'Selects between Fixed Peso (₱) discount or Percentage (%) discount.', 'Fixed discount deducts exact peso amount; % discount calculates proportion of cart subtotal.'],
        ['Discount Value Input', 'Numeric Input (₱ or %)', 'Specifies magnitude of discount applied to active cart.', 'Value is automatically clamped so discount can never exceed the cart subtotal.'],
        ['Amount Received Tender Input', 'Numeric Input (₱)', 'Cash tender entered by cashier during checkout.', 'Must be greater than or equal to Grand Total. Change due is calculated automatically.'],
        ['Quick-Tender Cash Chips', 'Preset Buttons (₱100, ₱200, ₱500, ₱1,000, Exact)', 'One-tap cash amount entry.', 'Populates Amount Received field with selected currency note.'],
        ['GCash / Digital QR Confirmed', 'Verification Checkbox', 'Confirms digital payment received via store QR code.', 'Must be checked before "Confirm Payment" button activates in Digital Payment mode.'],
        ['Void / Clear Order Button', 'Action Button (Danger)', 'Empties active cart and cancels transaction before payment.', 'Requires mandatory cancellation reason note. Does not affect inventory as no sale occurred.']
      ]
    }
  });

  ch4.sections.push({
    heading: '4.14 Detailed Checkout Tasks',
    content: `Step-by-step procedures for common cashier register workflows:`,
    tasks: [
      {
        title: 'Processing a Split Cash Payment with Quick Tender',
        steps: [
          'Add items to cart with customer-requested sizes and add-ons.',
          'Verify order mode (Dine-in or Takeout) on the top toggle switch.',
          'Click "Complete Sale" (or press [Enter]).',
          'In the Confirm Order Modal, select "Cash" payment tab.',
          'Click the appropriate Quick-Tender chip (e.g., [₱500]) or type exact amount received in the input field.',
          'Verify the green "Change Due" display.',
          'Click "Confirm Payment" (or press [Enter]).'
        ],
        expectedResult: 'System registers completed sale, deducts FEFO inventory, records cash transaction in sales ledger, and displays official receipt with exact change due.'
      },
      {
        title: 'Processing a Digital GCash / QR Payment',
        steps: [
          'Add customer items to cart and click "Complete Sale".',
          'In the Confirm Order Modal, click the "Digital / GCash" tab.',
          'Instruct customer to scan the counter QR Ph / GCash standee and transfer the exact Grand Total displayed.',
          'Verify customer SMS confirmation or merchant soundbox notification.',
          'Click the checkbox "I confirm that payment has been received via GCash / QR".',
          'Click "Confirm Payment".'
        ],
        expectedResult: 'Transaction is committed under Digital payment method with ₱0 change due, inventory deducted, and receipt generated.'
      }
    ]
  });
}

// Enhance Chapter 5 (Menu)
const ch5 = chapters.find(c => c.number === 5);
if (ch5) {
  ch5.sections.push({
    heading: '5.9 Menu & Recipe Field Reference Table',
    content: `The following reference table explains all configuration parameters when building menu items and engineering recipes:`,
    table: {
      headers: ['Field Name', 'Required', 'Description', 'Validation & Constraints'],
      rows: [
        ['Item Name', 'Yes', 'Display name of menu item shown in POS and receipts.', 'Must be unique within category. Example: "Iced Spanish Latte".'],
        ['Category', 'Yes', 'Menu classification group for filtering and reporting.', 'Selected from existing categories or newly created via Category Manager.'],
        ['Base Selling Price (₱)', 'Yes', 'Default retail selling price for the standard item size.', 'Must be numeric >= 0. Example: ₱145.00.'],
        ['Product Image', 'No', 'Visual photo displayed on POS catalog cards.', 'Max file size 5MB. Supported formats: JPG, PNG, WebP. Auto-compressed.'],
        ['Active Status Toggle', 'Yes', 'Enables or disables item availability on POS register.', 'Deactivated items remain in database for historical reports but disappear from POS.'],
        ['Size Name', 'Yes (per size)', 'Descriptor for volume variant (e.g., Regular, Large, 16oz, 22oz).', 'Up to 6 sizes permitted per menu item. Exactly one must be set as Default.'],
        ['Size Multiplier', 'Yes (per size)', 'Scaling factor applied to raw recipe ingredient quantities.', 'Numeric decimal > 0. Example: Regular = 1.0, Large = 1.5. Does NOT scale packaging.'],
        ['Size Price (₱)', 'Yes (per size)', 'Retail price charged for specific size variant.', 'Must be numeric >= 0. Example: Regular = ₱130.00, Large = ₱155.00.'],
        ['Recipe Ingredient', 'Yes (per item)', 'Raw ingredient consumed from stock when item is sold.', 'Selected from Inventory Master List. Must have matching or convertible units.'],
        ['Recipe Quantity', 'Yes (per item)', 'Exact quantity consumed for base size (1.0x).', 'Numeric decimal > 0. Example: 18g Espresso Beans, 150ml Fresh Milk.'],
        ['Packaging Supply', 'No', 'Single-use cup, lid, straw, or carrier supply consumed.', 'Selected from Supplies catalog. Assigned fixed deduction quantity per unit sold.'],
        ['Supply "When" Scope', 'Yes (per supply)', 'Condition under which packaging supply is deducted.', 'Options: "Always" (every order), "Takeout only" (takeout orders), "Dine-in only".']
      ]
    }
  });

  ch5.sections.push({
    heading: '5.10 Recipe Engineering Step-by-Step Task',
    content: `Follow this standard operating procedure when introducing a new handcrafted beverage:`,
    tasks: [
      {
        title: 'Engineering a Multi-Size Iced Beverage with Takeout Rules',
        steps: [
          'Navigate to Menu & Recipes > Menu Items tab and click "Add Item".',
          'Enter item name (e.g., "Caramel Macchiato"), assign Category ("Coffee"), and enter base price.',
          'In Sizes Editor, define two sizes: "16oz Regular" (multiplier 1.0, ₱140) and "22oz Large" (multiplier 1.5, ₱165). Set 16oz as Default.',
          'In Recipe Ingredients, add Espresso Beans (18g), Fresh Milk (160ml), Vanilla Syrup (20ml), and Caramel Drizzle (15ml).',
          'In Packaging Supplies, add "16oz Clear PET Cup" (1 pc, Takeout only) and "98mm Flat Lid" (1 pc, Takeout only).',
          'Review the Live Cost & Margin Analysis bar: verify COGS is under ₱45.00 and Gross Margin displays Green (> 70%).',
          'Click "Save Menu Item".'
        ],
        expectedResult: 'Menu item is saved to database with atomic recipe costing, ready for counter baristas on the POS register.'
      }
    ]
  });
}

// Enhance Chapter 6 (Inventory)
const ch6 = chapters.find(c => c.number === 6);
if (ch6) {
  ch6.sections.push({
    heading: '6.9 Inventory Field Reference Table',
    content: `The following reference table explains all fields required when managing inventory items and receiving shipments:`,
    table: {
      headers: ['Field Name', 'Required', 'Description', 'Valid Input & Constraints'],
      rows: [
        ['Item Name', 'Yes', 'Official descriptive title of ingredient or packaging material.', 'Example: "Arabica Blend Espresso Beans", "16oz Hot Paper Cup".'],
        ['Item Classification', 'Yes', 'Determines operational usage category.', 'Options: "Raw Ingredient" (edible consumables) or "Packaging Supply" (paper/plastic).'],
        ['Unit of Measurement', 'Yes', 'Standard base measurement unit for stock balances.', 'Options: g, kg (mass), ml, l (volume), pcs, packs, cans, bottles (discrete).'],
        ['Minimum Reorder Threshold', 'Yes', 'Alert trigger level below which system warns staff of low stock.', 'Numeric value >= 0. When stock <= threshold, item appears on Stock Alerts card.'],
        ['Batch Number / Reference', 'No', 'Supplier invoice or lot tracking number for traceability.', 'Text string. Example: "PO-2026-104", "LOT-9924A". Defaults to current date if blank.'],
        ['Quantity Received', 'Yes', 'Physical quantity delivered in current shipment.', 'Numeric value > 0 in configured unit of measurement. Example: 5000g, 24 cans.'],
        ['Purchase Unit Price (₱)', 'Yes', 'Actual cost paid per base measurement unit.', 'Numeric value >= 0. Example: ₱0.85 per gram, ₱42.00 per can. Used in FEFO COGS.'],
        ['Expiration Date', 'Yes (for perishables)', 'Shelf life limit date for perishable consumables.', 'Date picker format (YYYY-MM-DD). Drives FEFO consumption and auto-expiry logic.'],
        ['Stock Adjustment Mode', 'Yes (adjust modal)', 'Method of modifying inventory counts during audits.', 'Options: "Deduct / Spoilage" (records wastage) or "Set Exact" (overwrites count).'],
        ['Adjustment Reason', 'Yes (adjust modal)', 'Mandatory operational explanation for inventory adjustments.', 'Options: "Spilled/Wasted", "Expired Write-Off", "Physical Count Correction", "Other".']
      ]
    }
  });
}

// Enhance Chapter 7 (Expenses)
const ch7 = chapters.find(c => c.number === 7);
if (ch7) {
  ch7.sections.push({
    heading: '7.5 Expense Management Field Reference Table',
    content: `The following reference table details the form fields utilized when logging store operational expenses:`,
    table: {
      headers: ['Field Name', 'Required', 'Description', 'Example & Validation'],
      rows: [
        ['Expense Date', 'Yes', 'Date when expenditure was incurred.', 'Date format (YYYY-MM-DD). Defaults to current date. Past dates allowed.'],
        ['Expense Category', 'Yes', 'Accounting classification for P&L reporting.', 'Options: Rent, Utilities, Maintenance, Packaging, Marketing, Logistics, Other.'],
        ['Payee / Vendor', 'Yes', 'Business or individual receiving payment.', 'Text. Example: "Meralco", "Manila Water", "SM Prime Holdings", "Shopee Supplies".'],
        ['Description / Particulars', 'Yes', 'Detailed operational purpose of the expenditure.', 'Text. Example: "September 2026 Cafe Electricity Bill", "Espresso Machine Descaling".'],
        ['Amount (₱)', 'Yes', 'Total Philippine Peso value expended.', 'Numeric currency value > 0. Example: ₱12,450.00.'],
        ['Payment Method', 'Yes', 'Funding source used to settle transaction.', 'Options: Petty Cash, Store GCash, Bank Transfer, Owner Credit Card.']
      ]
    }
  });

  ch7.sections.push({
    heading: '7.6 Step-by-Step Task: Logging Daily Store Expenses',
    content: `Staff should record daily counter expenditures using this workflow:`,
    tasks: [
      {
        title: 'Recording a Counter Operating Expense',
        steps: [
          'Navigate to Sidebar > Expense Management (/expenses).',
          'Click the "Record Expense" button in the top right corner.',
          'Select the Expense Date and choose the appropriate Expense Category.',
          'Enter the Payee name and clear Description of goods/services received.',
          'Enter the exact Amount in Philippine Peso (₱) and select Payment Method.',
          'Click "Save Expense".'
        ],
        expectedResult: 'Expense record is immediately committed to database, reflected on OPEX cards, and integrated into Financial Reports.'
      }
    ]
  });
}

// Enhance Chapter 9 (Employees)
const ch9 = chapters.find(c => c.number === 9);
if (ch9) {
  ch9.sections.push({
    heading: '9.8 Employee Management Field Reference Table',
    content: `The following reference table explains all configuration parameters for staff profiles and access credentials:`,
    table: {
      headers: ['Field Name', 'Required', 'Description', 'Validation & Constraints'],
      rows: [
        ['Full Name', 'Yes', 'Official legal name of employee.', 'Text string. Example: "Maria Santos". Shown on receipts and roster.'],
        ['Role / Position', 'Yes', 'Job classification within store operations.', 'Options: Barista, Cashier, Shift Supervisor, Kitchen Staff, Store Manager.'],
        ['Employment Type', 'Yes', 'Working arrangement classification.', 'Options: Full-time (40h/week), Part-time, Casual, Trainee.'],
        ['Hourly Rate (₱)', 'Yes', 'Base wage rate per hour in Philippine Peso.', 'Numeric value >= 0. Example: ₱75.00/hr. Used for payroll cost calculations.'],
        ['4-Digit Security PIN', 'Yes', 'Personal identification number for counter kiosk timekeeping.', 'Exactly 4 numeric digits (0000–9999). Hashed and secured in database.'],
        ['Emergency Contact Name', 'No', 'Person to notify in case of workplace emergency.', 'Text string. Example: "Juan Santos (Father)".'],
        ['Emergency Contact Phone', 'No', 'Telephone or mobile number of emergency contact.', 'Philippine mobile format (e.g., 0917-123-4567).'],
        ['Grant ESPRO Login Access', 'Optional', 'Enables web login credentials for counter terminal or back office.', 'Checkbox. If enabled, prompts for Email Username and Password.'],
        ['Email / Username', 'Yes (if login)', 'System login address.', 'Auto-appends "@espro.ph" if omitted. Example: "maria.santos@espro.ph".'],
        ['Initial Password', 'Yes (if login)', 'Authentication password for web login.', 'Minimum 6 characters. Auto-generate button available for strong random string.']
      ]
    }
  });
}

// Enhance Chapter 10 (Time Clock Kiosk)
const ch10 = chapters.find(c => c.number === 10);
if (ch10) {
  ch10.sections.push({
    heading: '10.3 Kiosk Controls Field Reference Table',
    content: `The following reference table explains the controls and interface states within the counter Time Clock Kiosk:`,
    table: {
      headers: ['Control / Display Element', 'Type', 'Functional Description', 'Operational Constraint'],
      rows: [
        ['Employee Selector', 'Dropdown Menu', 'Lists all active store employees registered in directory.', 'Inactive or deleted staff do not appear.'],
        ['4-Digit PIN Keypad', 'Numeric Keypad (0-9)', 'On-screen touch buttons for entering 4-digit security PIN.', 'Masked display (••••). Clears automatically after 3 invalid attempts.'],
        ['Clock In Button', 'Action Button (Green)', 'Initiates work shift punch and starts attendance timer.', 'Disabled if employee is already clocked in.'],
        ['Start Break Button', 'Action Button (Orange)', 'Pauses shift timer and records unpaid rest/meal break.', 'Only available when employee is actively clocked in.'],
        ['End Break Button', 'Action Button (Blue)', 'Concludes rest break and resumes active working shift.', 'Only available when employee is currently on break.'],
        ['Clock Out Button', 'Action Button (Red)', 'Terminates work shift and commits total duration to timesheets.', 'Disabled if employee is not currently clocked in.']
      ]
    }
  });
}

// Enhance Chapter 11 (User Management)
const ch11 = chapters.find(c => c.number === 11);
if (ch11) {
  ch11.sections.push({
    heading: '11.3 User Management Field Reference Table',
    content: `The following reference table outlines the administrative account configuration controls:`,
    table: {
      headers: ['Field Name', 'Required', 'Description', 'Validation & Rules'],
      rows: [
        ['Full Name', 'Yes', 'Administrative display name.', 'Text string. Minimum 2 characters.'],
        ['Username / Email', 'Yes', 'Login email identifier.', 'Auto-appends "@espro.ph". Example: "manager@espro.ph". Must be unique.'],
        ['System Role', 'Yes', 'System permission boundary.', 'Options: "Administrator" (full access) or "Employee" (counter restricted).'],
        ['Account Password', 'Yes', 'Initial login password.', 'Minimum 6 characters. Must contain letters and numbers for best practice.'],
        ['Account Status Toggle', 'Yes', 'Active / Inactive switch.', 'Disabling immediately terminates active sessions and blocks authentication.']
      ]
    }
  });
}

// Enhance Chapter 12 (Settings)
const ch12 = chapters.find(c => c.number === 12);
if (ch12) {
  ch12.sections.push({
    heading: '12.3 Account Security Field Reference Table',
    content: `The following reference table details the self-service profile and password modification parameters:`,
    table: {
      headers: ['Field Name', 'State', 'Functional Description', 'Security Constraint'],
      rows: [
        ['Full Name', 'Read-Only', 'Displays authenticated user name.', 'Managed exclusively by Administrators in User Management.'],
        ['Email Address', 'Read-Only', 'Displays current login email.', 'Read-only to prevent unauthorized credential redirection.'],
        ['Assigned Role', 'Read-Only', 'Displays current access tier (Administrator or Employee).', 'Read-only security attribute.'],
        ['Current Password', 'Editable', 'Existing account password for verification.', 'Must match authenticated hash in database.'],
        ['New Password', 'Editable', 'Proposed replacement password.', 'Minimum 6 characters. Cannot match current password.'],
        ['Confirm New Password', 'Editable', 'Re-entry of proposed password to prevent typos.', 'Must match New Password identically.']
      ]
    }
  });
}

// Write updated content back to manual-content.mjs
const updatedModuleContent = `// ─── Espro POS System User Manual - Canonical Content Specification ───
// Fully enriched with detailed field references, operational business rules, and step-by-step tasks.

export const manualMeta = ${JSON.stringify(manualMeta, null, 2)};

export const documentControl = ${JSON.stringify(documentControl, null, 2)};

export const chapters = ${JSON.stringify(chapters, null, 2)};

export const appendices = ${JSON.stringify(appendices, null, 2)};
`;

fs.writeFileSync('scripts/manual-content.mjs', updatedModuleContent, 'utf8');
console.log('Successfully enriched scripts/manual-content.mjs with complete tables, tasks, and business rules!');
