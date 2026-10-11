import jsPDF from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';
import { format } from 'date-fns';
import type {
  Sale,
  Expense,
} from './mockData';

// Ensure autoTable plugin is registered on jsPDF prototype
try {
  applyPlugin(jsPDF);
} catch {}

/**
 * Universal safe autoTable runner that works in all ESM / bundler environments.
 * Automatically aligns table headers and cells to match columnStyles alignments.
 */
function runAutoTable(doc: jsPDF, options: any) {
  const customDidParseCell = options.didParseCell;
  const mergedOptions = {
    ...options,
    didParseCell: (data: any) => {
      if (typeof customDidParseCell === 'function') {
        customDidParseCell(data);
      }
      // If cell spans multiple columns, default to left alignment
      if (data.cell.colSpan > 1) {
        data.cell.styles.halign = 'left';
        return;
      }
      // If cell has explicit raw styles halign, respect it
      if (data.cell.raw && typeof data.cell.raw === 'object' && data.cell.raw.styles?.halign) {
        data.cell.styles.halign = data.cell.raw.styles.halign;
        return;
      }
      // Inherit halign from columnStyles for all sections (head, body, foot)
      const colStyles = data.table?.styles?.columnStyles || data.table?.settings?.columnStyles;
      const colStyle =
        colStyles?.[data.column.index] ||
        colStyles?.[String(data.column.index)] ||
        (data.column.dataKey != null ? colStyles?.[data.column.dataKey] : undefined);
      if (colStyle?.halign) {
        data.cell.styles.halign = colStyle.halign;
      }
    },
  };

  try {
    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(mergedOptions);
      return;
    }
  } catch {}

  try {
    if (typeof autoTable === 'function') {
      autoTable(doc, mergedOptions);
      return;
    }
  } catch {}

  try {
    if (typeof (autoTable as any)?.default === 'function') {
      (autoTable as any).default(doc, mergedOptions);
      return;
    }
  } catch {}

  try {
    applyPlugin(doc.constructor as any);
    (doc as any).autoTable(mergedOptions);
  } catch (err) {
    console.error('runAutoTable execution error:', err);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// BRAND DESIGN TOKENS (from variables.css)
// ════════════════════════════════════════════════════════════
export const BRAND_COLORS = {
  primary: [148, 58, 31] as [number, number, number],       // #943A1F (Espro Brand)
  primaryLight: [247, 239, 236] as [number, number, number],// #F7EFEC
  dark: [24, 25, 26] as [number, number, number],           // #18191A
  muted: [107, 107, 107] as [number, number, number],       // #6B6B6B
  surface: [249, 249, 248] as [number, number, number],     // #F9F9F8
  border: [232, 232, 230] as [number, number, number],      // #E8E8E6
  success: [46, 125, 50] as [number, number, number],       // #2E7D32
  danger: [198, 40, 40] as [number, number, number],        // #C62828
  white: [255, 255, 255] as [number, number, number],
};

// ════════════════════════════════════════════════════════════
// EXPORT TYPES & INTERFACES
// ════════════════════════════════════════════════════════════
export interface ReportFilterMeta {
  dateFrom?: string;
  dateTo?: string;
  datePreset?: string;
  periodLabel?: string;
  statusFilter?: string;
  orderTypeFilter?: string;
  generatedBy?: string;
  generatedAt?: Date;
  businessName?: string;
}

export interface SummaryCardsData {
  grossSales: number;
  totalDiscounts: number;
  netSales: number;
  totalCogs: number;
  grossProfit: number;
  totalOperatingExpenses: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  cogsPct: number;
  opexPct: number;
  breakEvenSales: number | null;
}

export interface SalesBreakdownData {
  // Key metrics
  completedCount: number;
  refundedCount: number;
  refundedTotal: number;
  voidedCount: number;
  voidedTotal: number;
  atv: number;
  totalItemsSold: number;
  avgItemsPerOrder: number;
  // Payment methods
  cashCount: number;
  cashAmount: number;
  cashSharePct: number;
  digitalCount: number;
  digitalAmount: number;
  digitalSharePct: number;
  // Cash handling
  totalCashTendered: number;
  totalCashChange: number;
  // Order types
  dineInCount: number;
  dineInNet: number;
  dineInCogs: number;
  dineInProfit: number;
  takeoutCount: number;
  takeoutNet: number;
  takeoutCogs: number;
  takeoutProfit: number;
  // Cashier list
  cashierSummary: Array<{
    name: string;
    transactions: number;
    netSales: number;
    sharePct: number;
  }>;
  // Daily summary
  dailySales: Array<{
    date: string;
    transactions: number;
    gross: number;
    discounts: number;
    refunds: number;
    net: number;
    cogs: number;
    grossProfit: number;
  }>;
  // Menu mix / Top products
  productSales: Array<{
    name: string;
    qtySold: number;
    grossRevenue: number;
    avgPrice: number;
    cogs: number;
    grossProfit: number;
    marginPct: number;
    revenueSharePct: number;
  }>;
}

export interface CogsItemDetail {
  id: string;
  name: string;
  qtySold: number;
  ingredientsCogs: number;
  suppliesCogs: number;
  totalCogs: number;
  unitCogs: number;
  cogsPctOfRev: number;
  isEstimated?: boolean;
}

export interface ExpenseCategoryDetail {
  category: string;
  amount: number;
  sharePct: number;
}

export interface InventoryItemValuation {
  id: string;
  name: string;
  itemType: 'ingredient' | 'supply';
  unit: string;
  stockQuantity: number;
  unitCost: number;
  stockValue: number;
  lowStockThreshold: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  earliestExpiry: string | null;
  daysToExpiry: number | null;
  isExpired: boolean;
  isNearExpiry: boolean;
}

export interface FullReportData {
  meta: ReportFilterMeta;
  summary: SummaryCardsData;
  sales: {
    ledger: Sale[];
    breakdowns: SalesBreakdownData;
  };
  cogs: {
    items: CogsItemDetail[];
    orderPackagingCogs: number;
    refundedCogsWastage: number;
    totalCogs: number;
    estimatedLinesCount: number;
  };
  expenses: {
    ledger: Expense[];
    byCategory: ExpenseCategoryDetail[];
    totalOpex: number;
    periodComparison?: {
      prevPeriodLabel: string;
      prevNetSales: number;
      prevNetProfit: number;
      salesGrowthPct: number | null;
      profitGrowthPct: number | null;
    } | null;
  };
  inventory: {
    items: InventoryItemValuation[];
    totalValue: number;
    ingredientsValue: number;
    suppliesValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    nearExpiryCount: number;
    expiredCount: number;
    expiredRiskValue: number;
  };
}

// ════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Format string cell for CSV, escaping quotes and preventing formula injection.
 */
export function formatCsvCell(val: any): string {
  if (val == null) return '""';
  let str = String(val);
  // Neutralize formula trigger characters
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Raw numeric formatting for CSV (2 decimal places, no currency, no thousand separators).
 */
export function formatCsvNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return '0.00';
  return Number(num).toFixed(2);
}

/**
 * Formats accounting numbers:
 * - Negative numbers enclosed in parentheses e.g. (1,250.00)
 * - Optional PHP currency prefix
 */
export function formatAccountingNumber(val: number, isDeduction = false, withCurrency = false): string {
  if (isNaN(val)) return withCurrency ? 'PHP 0.00' : '0.00';
  const isNegative = val < 0 || isDeduction;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = withCurrency ? 'PHP ' : '';
  if (isNegative) {
    return `(${prefix}${formatted})`;
  }
  return `${prefix}${formatted}`;
}

export function formatPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '0.00%';
  return `${val.toFixed(2)}%`;
}

/**
 * Downloads a string content as a CSV file with UTF-8 BOM.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Constructs a descriptive human-readable period string for report covers and footers.
 */
export function buildPeriodCoveredString(meta: ReportFilterMeta): string {
  if (meta.periodLabel) {
    return meta.periodLabel;
  }
  const preset = meta.datePreset?.toLowerCase();
  const presetLabel =
    preset === 'today'
      ? 'Today'
      : preset === 'yesterday'
      ? 'Yesterday'
      : preset === 'weekly'
      ? 'Weekly'
      : preset === 'monthly'
      ? 'Monthly'
      : preset === 'yearly'
      ? 'Yearly'
      : preset === 'custom'
      ? 'Custom Range'
      : '';

  if (meta.dateFrom && meta.dateTo) {
    if (meta.dateFrom === meta.dateTo) {
      return presetLabel ? `${presetLabel} (${meta.dateFrom})` : meta.dateFrom;
    }
    return presetLabel
      ? `${presetLabel} (${meta.dateFrom} to ${meta.dateTo})`
      : `${meta.dateFrom} to ${meta.dateTo}`;
  } else if (meta.dateFrom) {
    return `From ${meta.dateFrom}`;
  } else if (meta.dateTo) {
    return `Until ${meta.dateTo}`;
  }
  return 'All Historical Dates';
}

/**
 * Helper to build period slug for filenames that incorporates the selected date filter.
 */
export function getPeriodFilenameSlug(meta: ReportFilterMeta): string {
  const preset = meta.datePreset?.toLowerCase();
  if (preset === 'today') {
    return meta.dateFrom ? `today_${meta.dateFrom}` : 'today';
  }
  if (preset === 'yesterday') {
    return meta.dateFrom ? `yesterday_${meta.dateFrom}` : 'yesterday';
  }
  if (preset === 'weekly') {
    return meta.dateFrom && meta.dateTo
      ? `weekly_${meta.dateFrom}_to_${meta.dateTo}`
      : 'weekly';
  }
  if (preset === 'monthly') {
    return meta.dateFrom && meta.dateTo
      ? `monthly_${meta.dateFrom}_to_${meta.dateTo}`
      : 'monthly';
  }
  if (preset === 'yearly') {
    return meta.dateFrom && meta.dateTo
      ? `yearly_${meta.dateFrom}_to_${meta.dateTo}`
      : 'yearly';
  }
  if (meta.dateFrom && meta.dateTo) {
    const prefix = preset === 'custom' ? 'custom_' : '';
    if (meta.dateFrom === meta.dateTo) {
      return `${prefix}${meta.dateFrom}`;
    }
    return `${prefix}${meta.dateFrom}_to_${meta.dateTo}`;
  } else if (meta.dateFrom) {
    return `from_${meta.dateFrom}`;
  } else if (meta.dateTo) {
    return `until_${meta.dateTo}`;
  }
  return 'all_time';
}

function buildCsvMetadataBlock(title: string, meta: ReportFilterMeta): string[] {
  const periodStr = buildPeriodCoveredString(meta);
  const dateRangeStr =
    meta.dateFrom && meta.dateTo
      ? `${meta.dateFrom} to ${meta.dateTo}`
      : meta.dateFrom
      ? `From ${meta.dateFrom}`
      : meta.dateTo
      ? `Until ${meta.dateTo}`
      : 'All Historical Dates';

  return [
    `# ${title}`,
    `# Business: ${meta.businessName || 'Espro Coffee & Tea'}`,
    `# Period: ${periodStr}`,
    `# Date Range: ${dateRangeStr}`,
    `# Applied Filters: Status=${meta.statusFilter || 'All'}, Order Type=${meta.orderTypeFilter || 'All'}`,
    `# Generated At: ${format(meta.generatedAt || new Date(), 'yyyy-MM-dd HH:mm')}`,
    `# Generated By: ${meta.generatedBy || 'Authorized Staff'}`,
    `# Currency: Philippine Peso (PHP)`,
    '',
  ];
}

// ════════════════════════════════════════════════════════════
// CSV BUILDERS
// ════════════════════════════════════════════════════════════

/**
 * 1. Sales Transaction Ledger CSV
 */
export function buildSalesCsv(data: FullReportData): string {
  const lines: string[] = [];
  lines.push(...buildCsvMetadataBlock('Espro Sales Transaction Ledger', data.meta));

  const headers = [
    'Sale ID',
    'Date',
    'Time',
    'Order Type',
    'Cashier',
    'Payment Method',
    'No. of Items',
    'Gross Sales (PHP)',
    'Discount (PHP)',
    'Net Sales (PHP)',
    'Refund (PHP)',
    'COGS Ingredients (PHP)',
    'COGS Supplies (PHP)',
    'COGS Packaging (PHP)',
    'Total COGS (PHP)',
    'Gross Profit (PHP)',
    'Status',
    'Reason / Notes',
  ];
  lines.push(headers.map(formatCsvCell).join(','));

  let totalItemsCount = 0;
  let sumGross = 0;
  let sumDiscount = 0;
  let sumNet = 0;
  let sumRefund = 0;
  let sumIngCogs = 0;
  let sumSuppCogs = 0;
  let sumPackCogs = 0;
  let sumTotalCogs = 0;
  let sumProfit = 0;

  for (const s of data.sales.ledger) {
    const d = new Date(s.createdAt);
    const dateFormatted = format(d, 'yyyy-MM-dd');
    const timeFormatted = format(d, 'HH:mm');
    const itemsCount = Array.isArray(s.items)
      ? s.items.reduce((acc, it: any) => acc + Number(it.qty || 1), 0)
      : 0;

    const subtotal = s.subtotal != null ? Number(s.subtotal) : Number(s.total) + Number(s.discount || 0);
    const discount = Number(s.discount || 0);
    const net = subtotal - discount;
    const isCompleted = s.status === 'completed';
    const isRefunded = s.status === 'refunded';

    // Item-level COGS breakdown for this sale
    let ingCogs = 0;
    let suppCogs = 0;
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        const qty = Number(it.qty || 1);
        ingCogs += qty * Number(it.cogs_per_serving || 0);
        suppCogs += qty * Number(it.cogs_supplies_per_serving || 0);
      }
    }
    const packCogs = Number(s.orderSuppliesCogs || 0);
    const saleTotalCogs = ingCogs + suppCogs + packCogs;
    const grossProfit = isCompleted ? net - saleTotalCogs : 0;
    const refundAmt = isRefunded ? Number(s.total) : 0;

    // Accumulate totals only for completed/valid sales per accounting standards
    if (isCompleted) {
      totalItemsCount += itemsCount;
      sumGross += subtotal;
      sumDiscount += discount;
      sumNet += net;
      sumIngCogs += ingCogs;
      sumSuppCogs += suppCogs;
      sumPackCogs += packCogs;
      sumTotalCogs += saleTotalCogs;
      sumProfit += grossProfit;
    } else if (isRefunded) {
      sumRefund += refundAmt;
    }

    const row = [
      s.id,
      dateFormatted,
      timeFormatted,
      s.orderType === 'takeout' ? 'Takeout' : 'Dine-In',
      s.cashierName || 'N/A',
      s.paymentMethod === 'cash' ? 'Cash' : 'Digital/GCash',
      itemsCount,
      formatCsvNumber(subtotal),
      formatCsvNumber(discount),
      formatCsvNumber(isCompleted ? net : 0),
      formatCsvNumber(refundAmt),
      formatCsvNumber(ingCogs),
      formatCsvNumber(suppCogs),
      formatCsvNumber(packCogs),
      formatCsvNumber(saleTotalCogs),
      formatCsvNumber(grossProfit),
      s.status.toUpperCase(),
      s.voidReason || '',
    ];
    lines.push(row.map(formatCsvCell).join(','));
  }

  // Accounting TOTALS row
  const totalsRow = [
    'TOTALS',
    '',
    '',
    '',
    '',
    '',
    totalItemsCount,
    formatCsvNumber(sumGross),
    formatCsvNumber(sumDiscount),
    formatCsvNumber(sumNet),
    formatCsvNumber(sumRefund),
    formatCsvNumber(sumIngCogs),
    formatCsvNumber(sumSuppCogs),
    formatCsvNumber(sumPackCogs),
    formatCsvNumber(sumTotalCogs),
    formatCsvNumber(sumProfit),
    '',
    '',
  ];
  lines.push(totalsRow.map(formatCsvCell).join(','));

  return lines.join('\r\n');
}

/**
 * 2. Sales Detailed Line Items CSV (Most useful for accounting/pivot analysis)
 */
export function buildSalesLineItemsCsv(data: FullReportData): string {
  const lines: string[] = [];
  lines.push(...buildCsvMetadataBlock('Espro Sales Line Items Breakdown', data.meta));

  const headers = [
    'Sale ID',
    'Date',
    'Time',
    'Product Name',
    'Size',
    'Add-ons',
    'Note',
    'Qty Sold',
    'Unit Price (PHP)',
    'Line Total (PHP)',
    'COGS Per Serving (PHP)',
    'Line COGS (PHP)',
    'Line Profit (PHP)',
    'Order Type',
    'Payment Method',
    'Status',
  ];
  lines.push(headers.map(formatCsvCell).join(','));

  let totalQty = 0;
  let totalRevenue = 0;
  let totalLineCogs = 0;
  let totalLineProfit = 0;

  for (const s of data.sales.ledger) {
    const d = new Date(s.createdAt);
    const dateFormatted = format(d, 'yyyy-MM-dd');
    const timeFormatted = format(d, 'HH:mm');
    const isCompleted = s.status === 'completed';

    if (!Array.isArray(s.items)) continue;

    for (const it of s.items) {
      const name = it.name || it.product?.name || 'Unknown Item';
      const sizeName = it.size_name || 'Standard';
      const addons = Array.isArray(it.addons)
        ? it.addons.map((a: any) => `${a.name} (x${a.qty || 1})`).join('; ')
        : '';
      const note = it.note || '';
      const qty = Number(it.qty || 1);
      const unitPrice = Number(it.price || it.unit_price || it.product?.price || 0);
      const lineTotal = unitPrice * qty;

      const cogsPerServing = Number(it.cogs_per_serving || 0) + Number(it.cogs_supplies_per_serving || 0);
      const lineCogs = cogsPerServing * qty;
      const lineProfit = isCompleted ? lineTotal - lineCogs : 0;

      if (isCompleted) {
        totalQty += qty;
        totalRevenue += lineTotal;
        totalLineCogs += lineCogs;
        totalLineProfit += lineProfit;
      }

      const row = [
        s.id,
        dateFormatted,
        timeFormatted,
        name,
        sizeName,
        addons,
        note,
        qty,
        formatCsvNumber(unitPrice),
        formatCsvNumber(lineTotal),
        formatCsvNumber(cogsPerServing),
        formatCsvNumber(lineCogs),
        formatCsvNumber(lineProfit),
        s.orderType === 'takeout' ? 'Takeout' : 'Dine-In',
        s.paymentMethod === 'cash' ? 'Cash' : 'Digital/GCash',
        s.status.toUpperCase(),
      ];
      lines.push(row.map(formatCsvCell).join(','));
    }
  }

  // TOTALS Row
  const totalsRow = [
    'TOTALS',
    '',
    '',
    '',
    '',
    '',
    '',
    totalQty,
    '',
    formatCsvNumber(totalRevenue),
    '',
    formatCsvNumber(totalLineCogs),
    formatCsvNumber(totalLineProfit),
    '',
    '',
    '',
  ];
  lines.push(totalsRow.map(formatCsvCell).join(','));

  return lines.join('\r\n');
}

/**
 * 3. Expenses & COGS CSV (Sectioned format)
 */
export function buildExpensesCsv(data: FullReportData): string {
  const lines: string[] = [];
  lines.push(...buildCsvMetadataBlock('Espro Expense & Cost of Goods Sold Report', data.meta));

  // ── SECTION 1: COGS BY PRODUCT ──
  lines.push('--- SECTION 1: COST OF GOODS SOLD (COGS) PER PRODUCT ---');
  const cogsHeaders = [
    'Product Name',
    'Qty Sold',
    'Ingredients COGS (PHP)',
    'Supplies COGS (PHP)',
    'Total Product COGS (PHP)',
    'COGS Per Unit (PHP)',
    'COGS % of Revenue',
    'Costing Method',
  ];
  lines.push(cogsHeaders.map(formatCsvCell).join(','));

  let totalQty = 0;
  let totalIngCogs = 0;
  let totalSuppCogs = 0;
  let totalProdCogs = 0;

  for (const item of data.cogs.items) {
    totalQty += item.qtySold;
    totalIngCogs += item.ingredientsCogs;
    totalSuppCogs += item.suppliesCogs;
    totalProdCogs += item.totalCogs;

    const row = [
      item.name,
      item.qtySold,
      formatCsvNumber(item.ingredientsCogs),
      formatCsvNumber(item.suppliesCogs),
      formatCsvNumber(item.totalCogs),
      formatCsvNumber(item.unitCogs),
      formatPct(item.cogsPctOfRev),
      item.isEstimated ? 'Fallback Standard Recipe' : 'Transaction Snapshot',
    ];
    lines.push(row.map(formatCsvCell).join(','));
  }

  lines.push(
    [
      'SUBTOTAL (MENU ITEMS)',
      totalQty,
      formatCsvNumber(totalIngCogs),
      formatCsvNumber(totalSuppCogs),
      formatCsvNumber(totalProdCogs),
      '',
      '',
      '',
    ]
      .map(formatCsvCell)
      .join(',')
  );

  lines.push(
    ['ORDER-LEVEL PACKAGING COGS', '', '', '', formatCsvNumber(data.cogs.orderPackagingCogs), '', '', '']
      .map(formatCsvCell)
      .join(',')
  );
  lines.push(
    ['REFUNDED WASTAGE COGS', '', '', '', formatCsvNumber(data.cogs.refundedCogsWastage), '', '', '']
      .map(formatCsvCell)
      .join(',')
  );
  lines.push(
    ['GRAND TOTAL COGS', '', '', '', formatCsvNumber(data.cogs.totalCogs), '', '', '']
      .map(formatCsvCell)
      .join(',')
  );

  lines.push(''); // Blank spacer

  // ── SECTION 2: OPERATING EXPENSES LEDGER ──
  lines.push('--- SECTION 2: OPERATING EXPENSES LEDGER ---');
  const opexHeaders = ['Date', 'Description', 'Category', 'Amount (PHP)'];
  lines.push(opexHeaders.map(formatCsvCell).join(','));

  let totalOpex = 0;
  for (const exp of data.expenses.ledger) {
    const amt = Number(exp.amount || 0);
    totalOpex += amt;
    const dStr = exp.date ? format(new Date(exp.date), 'yyyy-MM-dd') : '';
    const row = [dStr, exp.description || 'N/A', exp.category || 'General', formatCsvNumber(amt)];
    lines.push(row.map(formatCsvCell).join(','));
  }
  lines.push(['TOTAL OPERATING EXPENSES', '', '', formatCsvNumber(totalOpex)].map(formatCsvCell).join(','));

  lines.push(''); // Blank spacer

  // ── SECTION 3: OPERATING EXPENSES BY CATEGORY ──
  lines.push('--- SECTION 3: OPERATING EXPENSES BY CATEGORY ---');
  const catHeaders = ['Expense Category', 'Amount (PHP)', '% of Total OpEx'];
  lines.push(catHeaders.map(formatCsvCell).join(','));
  for (const cat of data.expenses.byCategory) {
    lines.push(
      [cat.category, formatCsvNumber(cat.amount), formatPct(cat.sharePct)].map(formatCsvCell).join(',')
    );
  }

  return lines.join('\r\n');
}

/**
 * 4. Profit & Loss Summary CSV
 */
export function buildProfitCsv(data: FullReportData): string {
  const lines: string[] = [];
  lines.push(...buildCsvMetadataBlock('Espro Statement of Profit & Loss (P&L)', data.meta));

  const headers = ['Financial Line Item', 'Amount (PHP)', '% of Net Sales'];
  lines.push(headers.map(formatCsvCell).join(','));

  const s = data.summary;
  const net = s.netSales || 1;

  const rows: Array<[string, number, number]> = [
    ['Gross Sales', s.grossSales, (s.grossSales / net) * 100],
    ['Less: Discounts & Promos', -s.totalDiscounts, (-s.totalDiscounts / net) * 100],
    ['NET SALES', s.netSales, 100.0],
    ['Cost of Goods Sold (COGS):', 0, 0],
    ['  Menu Items Product Ingredients', -data.cogs.items.reduce((a, b) => a + b.ingredientsCogs, 0), 0],
    ['  Menu Items Product Supplies', -data.cogs.items.reduce((a, b) => a + b.suppliesCogs, 0), 0],
    ['  Order Takeout Packaging', -data.cogs.orderPackagingCogs, (-data.cogs.orderPackagingCogs / net) * 100],
    ['  Refunded Inventory Wastage', -data.cogs.refundedCogsWastage, (-data.cogs.refundedCogsWastage / net) * 100],
    ['TOTAL COGS', -s.totalCogs, (-s.totalCogs / net) * 100],
    ['GROSS PROFIT', s.grossProfit, s.grossMarginPct],
    ['Operating Expenses (OpEx):', 0, 0],
  ];

  for (const cat of data.expenses.byCategory) {
    rows.push([`  ${cat.category}`, -cat.amount, (-cat.amount / net) * 100]);
  }

  rows.push(['TOTAL OPERATING EXPENSES', -s.totalOperatingExpenses, (-s.totalOperatingExpenses / net) * 100]);
  rows.push(['NET PROFIT / (LOSS)', s.netProfit, s.netMarginPct]);

  for (const [label, amt, pct] of rows) {
    if (label.endsWith(':')) {
      lines.push([label, '', ''].map(formatCsvCell).join(','));
    } else {
      lines.push([label, formatCsvNumber(amt), formatPct(pct)].map(formatCsvCell).join(','));
    }
  }

  lines.push('');
  lines.push(['--- KEY PERFORMANCE INDICATORS & RATIOS ---', '', ''].map(formatCsvCell).join(','));
  lines.push(['Gross Profit Margin', formatPct(s.grossMarginPct), ''].map(formatCsvCell).join(','));
  lines.push(['Operating Margin', formatPct(s.opexPct), ''].map(formatCsvCell).join(','));
  lines.push(['Net Profit Margin', formatPct(s.netMarginPct), ''].map(formatCsvCell).join(','));
  if (s.breakEvenSales != null) {
    lines.push(['Break-Even Sales (Period)', formatCsvNumber(s.breakEvenSales), ''].map(formatCsvCell).join(','));
  }

  return lines.join('\r\n');
}

/**
 * 5. Inventory Valuation & Stock Status CSV
 */
export function buildInventoryCsv(data: FullReportData): string {
  const lines: string[] = [];
  lines.push(...buildCsvMetadataBlock('Espro Raw Ingredients & Supplies Valuation', data.meta));

  const headers = [
    'Item Name',
    'Item Type',
    'Unit',
    'Current Stock',
    'Cost Per Unit (PHP)',
    'Stock Valuation (PHP)',
    'Low-Stock Threshold',
    'Stock Status',
    'Earliest Expiration',
    'Days to Expiry',
  ];
  lines.push(headers.map(formatCsvCell).join(','));

  for (const it of data.inventory.items) {
    const row = [
      it.name,
      it.itemType === 'supply' ? 'Packaging/Supply' : 'Raw Ingredient',
      it.unit,
      it.stockQuantity,
      formatCsvNumber(it.unitCost),
      formatCsvNumber(it.stockValue),
      it.lowStockThreshold,
      it.status,
      it.earliestExpiry || 'None Recorded',
      it.daysToExpiry != null ? it.daysToExpiry : 'N/A',
    ];
    lines.push(row.map(formatCsvCell).join(','));
  }

  // TOTALS
  lines.push(
    [
      'TOTAL INVENTORY VALUATION',
      '',
      '',
      '',
      '',
      formatCsvNumber(data.inventory.totalValue),
      '',
      `Low: ${data.inventory.lowStockCount} | Out: ${data.inventory.outOfStockCount}`,
      `Expired: ${data.inventory.expiredCount}`,
      '',
    ]
      .map(formatCsvCell)
      .join(',')
  );

  return lines.join('\r\n');
}

// ════════════════════════════════════════════════════════════
// PDF EXPORT (jsPDF + autoTable)
// ════════════════════════════════════════════════════════════

/**
 * Renders the standardized branded Cover / Header block on Page 1.
 */
function drawReportHeader(
  doc: jsPDF,
  title: string,
  meta: ReportFilterMeta,
  orientation: 'landscape' | 'portrait'
): number {
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const marginX = 14;

  // Header background banner
  doc.setFillColor(...BRAND_COLORS.primary);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Brand Name & Tagline
  doc.setTextColor(...BRAND_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ESPRO POS', marginX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('PHILIPPINE SPECIALTY COFFEE & BEVERAGE SYSTEM', marginX, 18);

  // Business Name on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(meta.businessName || 'Espro Coffee & Tea', pageWidth - marginX, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('FINANCIAL REPORT & AUDIT PACK', pageWidth - marginX, 18, { align: 'right' });

  // Subheader / Metadata bar
  let y = 32;
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title.toUpperCase(), marginX, y);

  y += 6;
  doc.setDrawColor(...BRAND_COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_COLORS.muted);

  const periodStr = buildPeriodCoveredString(meta);
  const generatedStr = format(meta.generatedAt || new Date(), 'yyyy-MM-dd HH:mm');
  const userStr = meta.generatedBy || 'Authorized Manager';

  // Left col: Period & Filters
  doc.text(`Period Covered: ${periodStr}`, marginX, y);
  doc.text(`Filters: Status = ${meta.statusFilter || 'All'} | Order Type = ${meta.orderTypeFilter || 'All'}`, marginX, y + 4);

  // Right col: Timestamp, Generated by, Currency Note
  doc.text(`Generated: ${generatedStr} | User: ${userStr}`, pageWidth - marginX, y, { align: 'right' });
  doc.text('Currency: Philippine Peso (PHP) | Timezone: Asia/Manila', pageWidth - marginX, y + 4, {
    align: 'right',
  });

  return y + 10;
}

/**
 * Draws the Executive Summary KPI cards row.
 */
function drawExecutiveSummaryCards(
  doc: jsPDF,
  summary: SummaryCardsData,
  startY: number,
  orientation: 'landscape' | 'portrait'
): number {
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // 6 Metric Cards
  const cards = [
    { label: 'GROSS SALES', value: formatAccountingNumber(summary.grossSales, false, true), color: BRAND_COLORS.dark },
    { label: 'NET SALES', value: formatAccountingNumber(summary.netSales, false, true), color: BRAND_COLORS.primary },
    {
      label: 'TOTAL COGS',
      value: formatAccountingNumber(summary.totalCogs, false, true),
      sub: `${formatPct(summary.cogsPct)} of Net`,
      color: BRAND_COLORS.dark,
    },
    {
      label: 'GROSS PROFIT',
      value: formatAccountingNumber(summary.grossProfit, false, true),
      sub: `${formatPct(summary.grossMarginPct)} Margin`,
      color: summary.grossProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger,
    },
    {
      label: 'OPERATING EXPENSES',
      value: formatAccountingNumber(summary.totalOperatingExpenses, false, true),
      sub: `${formatPct(summary.opexPct)} of Net`,
      color: BRAND_COLORS.dark,
    },
    {
      label: 'NET PROFIT / (LOSS)',
      value: formatAccountingNumber(summary.netProfit, false, true),
      sub: `${formatPct(summary.netMarginPct)} Margin`,
      color: summary.netProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger,
      isHighlighted: true,
    },
  ];

  const gap = 3;
  const cardWidth = (contentWidth - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 17;

  cards.forEach((card, idx) => {
    const x = marginX + idx * (cardWidth + gap);

    // Card background & border
    if (card.isHighlighted) {
      doc.setFillColor(
        summary.netProfit >= 0 ? 240 : 255,
        summary.netProfit >= 0 ? 248 : 235,
        summary.netProfit >= 0 ? 240 : 235
      );
    } else {
      doc.setFillColor(...BRAND_COLORS.surface);
    }
    doc.setDrawColor(...BRAND_COLORS.border);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Label
    doc.setTextColor(...BRAND_COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(card.label, x + 3, startY + 4.5);

    // Value
    doc.setTextColor(...card.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(card.value, x + 3, startY + 9.5);

    // Subtext (if any)
    if (card.sub) {
      doc.setTextColor(...BRAND_COLORS.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.text(card.sub, x + 3, startY + 14);
    }
  });

  return startY + cardHeight + 6;
}

/**
 * Standard autoTable defaults for Espro accounting reports.
 */
function getStandardTableOptions() {
  return {
    theme: 'plain' as const,
    showHead: 'everyPage' as const,
    headStyles: {
      fillColor: BRAND_COLORS.primary,
      textColor: BRAND_COLORS.white,
      fontStyle: 'bold' as const,
      fontSize: 7.5,
      cellPadding: 2,
      valign: 'middle' as const,
    },
    bodyStyles: {
      textColor: BRAND_COLORS.dark,
      fontSize: 7,
      cellPadding: 1.8,
      valign: 'middle' as const,
    },
    alternateRowStyles: {
      fillColor: BRAND_COLORS.surface,
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Reserved for subheadings if needed
    },
  };
}

/**
 * Attaches page numbering, period indicator & confidential footer to every page.
 */
function applyFooters(doc: jsPDF, meta?: ReportFilterMeta) {
  const pageCount = doc.getNumberOfPages();
  const periodStr = meta ? ` | Period: ${buildPeriodCoveredString(meta)}` : '';
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Top border of footer
    doc.setDrawColor(...BRAND_COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

    // Footer Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND_COLORS.muted);
    doc.text('Espro POS – Confidential Financial Management Document', 14, pageHeight - 6);
    doc.text(
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} Asia/Manila${periodStr}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }
}

// ════════════════════════════════════════════════════════════
// SECTION RENDERERS
// ════════════════════════════════════════════════════════════

/**
 * Section: Statement of Profit & Loss (P&L) Table
 */
function renderProfitLossSection(doc: jsPDF, data: FullReportData, startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('1. STATEMENT OF PROFIT & LOSS (INCOME STATEMENT)', 14, startY);

  const s = data.summary;
  const net = s.netSales || 1;

  const bodyData: any[] = [
    ['Gross Sales', formatAccountingNumber(s.grossSales), formatPct((s.grossSales / net) * 100)],
    ['Less: Customer Discounts & Promos', formatAccountingNumber(s.totalDiscounts, true), formatPct((-s.totalDiscounts / net) * 100)],
    [{ content: 'NET SALES', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } },
     { content: formatAccountingNumber(s.netSales), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } },
     { content: '100.00%', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } }],
    [{ content: 'Cost of Goods Sold (COGS)', colSpan: 3, styles: { fontStyle: 'bold', textColor: BRAND_COLORS.primary } }],
    ['  Menu Items Raw Ingredients', formatAccountingNumber(data.cogs.items.reduce((a, b) => a + b.ingredientsCogs, 0), true), formatPct((-data.cogs.items.reduce((a, b) => a + b.ingredientsCogs, 0) / net) * 100)],
    ['  Menu Items Packaging & Supplies', formatAccountingNumber(data.cogs.items.reduce((a, b) => a + b.suppliesCogs, 0), true), formatPct((-data.cogs.items.reduce((a, b) => a + b.suppliesCogs, 0) / net) * 100)],
    ['  Order-Level Takeout Packaging', formatAccountingNumber(data.cogs.orderPackagingCogs, true), formatPct((-data.cogs.orderPackagingCogs / net) * 100)],
    ['  Refunded Orders Inventory Wastage', formatAccountingNumber(data.cogs.refundedCogsWastage, true), formatPct((-data.cogs.refundedCogsWastage / net) * 100)],
    [{ content: 'TOTAL COST OF GOODS SOLD', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } },
     { content: formatAccountingNumber(s.totalCogs, true), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } },
     { content: formatPct((-s.totalCogs / net) * 100), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } }],
    [{ content: 'GROSS PROFIT', styles: { fontStyle: 'bold', textColor: s.grossProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger } },
     { content: formatAccountingNumber(s.grossProfit), styles: { fontStyle: 'bold', textColor: s.grossProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger } },
     { content: formatPct(s.grossMarginPct), styles: { fontStyle: 'bold', textColor: s.grossProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger } }],
    [{ content: 'Operating Expenses (OpEx)', colSpan: 3, styles: { fontStyle: 'bold', textColor: BRAND_COLORS.primary } }],
  ];

  for (const cat of data.expenses.byCategory) {
    bodyData.push([
      `  ${cat.category}`,
      formatAccountingNumber(cat.amount, true),
      formatPct((-cat.amount / net) * 100),
    ]);
  }

  bodyData.push(
    [{ content: 'TOTAL OPERATING EXPENSES', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } },
     { content: formatAccountingNumber(s.totalOperatingExpenses, true), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } },
     { content: formatPct((-s.totalOperatingExpenses / net) * 100), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } }],
    [{ content: 'NET PROFIT / (LOSS)', styles: { fontStyle: 'bold', textColor: s.netProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger, fontSize: 8.5 } },
     { content: formatAccountingNumber(s.netProfit), styles: { fontStyle: 'bold', textColor: s.netProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger, fontSize: 8.5 } },
     { content: formatPct(s.netMarginPct), styles: { fontStyle: 'bold', textColor: s.netProfit >= 0 ? BRAND_COLORS.success : BRAND_COLORS.danger, fontSize: 8.5 } }]
  );

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;
  const isPortrait = pageWidth < 250;
  const col1Width = isPortrait ? 50 : 65;
  const col2Width = isPortrait ? 40 : 55;
  const col0Width = contentWidth - col1Width - col2Width;

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: startY + 3,
    head: [['Financial Account / Line Item', 'Amount (PHP)', '% of Net Sales']],
    body: bodyData,
    columnStyles: {
      0: { cellWidth: col0Width, halign: 'left' },
      1: { cellWidth: col1Width, halign: 'right' },
      2: { cellWidth: col2Width, halign: 'right' },
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || startY + 40;

  // Break-even helper note
  if (s.breakEvenSales != null) {
    finalY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_COLORS.dark);
    doc.text(
      `* Break-even Sales Analysis: Target sales required to cover fixed operating expenses is PHP ${formatAccountingNumber(
        s.breakEvenSales
      )} based on the current ${formatPct(s.grossMarginPct)} gross margin.`,
      14,
      finalY
    );
    finalY += 4;
  }

  return finalY + 6;
}

/**
 * Section: Sales Summary & Breakdowns (Payment, Order Type, Cashier, Top Products)
 */
function renderSalesSummarySection(doc: jsPDF, data: FullReportData, startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('2. SALES REVENUE BREAKDOWNS & MENU-MIX', 14, startY);

  const sb = data.sales.breakdowns;

  // Mini summary row: Payment method & Order type
  const splitRows = [
    [
      'Payment: Cash',
      `${sb.cashCount} orders`,
      formatAccountingNumber(sb.cashAmount, false, true),
      formatPct(sb.cashSharePct),
      'Order Type: Dine-In',
      `${sb.dineInCount} orders`,
      formatAccountingNumber(sb.dineInNet, false, true),
      `Gross Profit: ${formatAccountingNumber(sb.dineInProfit, false, true)}`,
    ],
    [
      'Payment: Digital/GCash',
      `${sb.digitalCount} orders`,
      formatAccountingNumber(sb.digitalAmount, false, true),
      formatPct(sb.digitalSharePct),
      'Order Type: Takeout',
      `${sb.takeoutCount} orders`,
      formatAccountingNumber(sb.takeoutNet, false, true),
      `Gross Profit: ${formatAccountingNumber(sb.takeoutProfit, false, true)}`,
    ],
  ];

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: startY + 3,
    head: [['Channel / Category', 'Volume', 'Amount (PHP)', 'Share', 'Channel / Category', 'Volume', 'Net Sales (PHP)', 'Profitability']],
    body: splitRows,
    bodyStyles: { fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 44, halign: 'left' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 34, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 44, halign: 'left' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 35, halign: 'right' },
      7: { cellWidth: 46, halign: 'right' },
    },
  });

  let currentY = (doc as any).lastAutoTable?.finalY + 6;

  // Cash handling summary if applicable
  if (sb.totalCashTendered > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND_COLORS.muted);
    doc.text(
      `Cash Handling: Total Cash Tendered = PHP ${formatAccountingNumber(sb.totalCashTendered)} | Total Change Dispensed = PHP ${formatAccountingNumber(sb.totalCashChange)} | Completed Cash Sales = PHP ${formatAccountingNumber(sb.cashAmount)}`,
      14,
      currentY
    );
    currentY += 5;
  }

  // Top Products / Menu-Mix Table (Top 12)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('Product Sales & Menu-Mix Performance (Ranked by Revenue)', 14, currentY);

  const topProducts = sb.productSales.slice(0, 15);
  const prodRows = topProducts.map((p) => [
    p.name,
    p.qtySold,
    formatAccountingNumber(p.avgPrice),
    formatAccountingNumber(p.grossRevenue),
    formatAccountingNumber(p.cogs),
    formatAccountingNumber(p.grossProfit),
    formatPct(p.marginPct),
    formatPct(p.revenueSharePct),
  ]);

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: currentY + 3,
    head: [['Product Item', 'Qty Sold', 'Avg Price (PHP)', 'Gross Revenue (PHP)', 'COGS (PHP)', 'Gross Profit (PHP)', 'Margin %', 'Rev Share %']],
    body: prodRows,
    columnStyles: {
      0: { cellWidth: 69, halign: 'left' },
      1: { cellWidth: 24, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 38, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 36, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
    },
  });

  return (doc as any).lastAutoTable?.finalY + 8;
}

/**
 * Section: Sales Transaction Ledger Table (Full or Active tab)
 */
function renderSalesLedgerSection(doc: jsPDF, data: FullReportData, startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('3. SALES TRANSACTION LEDGER', 14, startY);

  const rows = data.sales.ledger.map((s) => {
    const d = new Date(s.createdAt);
    const dateFormatted = format(d, 'yyyy-MM-dd');
    const timeFormatted = format(d, 'HH:mm');
    const itemsCount = Array.isArray(s.items)
      ? s.items.reduce((acc, it: any) => acc + Number(it.qty || 1), 0)
      : 0;

    const subtotal = s.subtotal != null ? Number(s.subtotal) : Number(s.total) + Number(s.discount || 0);
    const discount = Number(s.discount || 0);
    const net = subtotal - discount;
    const isCompleted = s.status === 'completed';

    let cogs = 0;
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        cogs += Number(it.qty || 1) * (Number(it.cogs_per_serving || 0) + Number(it.cogs_supplies_per_serving || 0));
      }
    }
    cogs += Number(s.orderSuppliesCogs || 0);
    const profit = isCompleted ? net - cogs : 0;

    return [
      s.id.substring(0, 14),
      `${dateFormatted} ${timeFormatted}`,
      s.orderType === 'takeout' ? 'Takeout' : 'Dine-In',
      s.cashierName || 'N/A',
      s.paymentMethod === 'cash' ? 'Cash' : 'Digital',
      itemsCount,
      formatAccountingNumber(subtotal),
      formatAccountingNumber(discount, true),
      formatAccountingNumber(isCompleted ? net : 0),
      formatAccountingNumber(cogs),
      formatAccountingNumber(profit),
      s.status.toUpperCase(),
    ];
  });

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: startY + 3,
    head: [
      [
        'Sale ID',
        'Date & Time',
        'Type',
        'Cashier',
        'Payment',
        'Items',
        'Gross (PHP)',
        'Discount (PHP)',
        'Net (PHP)',
        'COGS (PHP)',
        'Profit (PHP)',
        'Status',
      ],
    ],
    body: rows,
    bodyStyles: { fontSize: 6.5, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 28, halign: 'left' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 26, halign: 'left' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 23, halign: 'right' },
      8: { cellWidth: 24, halign: 'right' },
      9: { cellWidth: 22, halign: 'right' },
      10: { cellWidth: 24, halign: 'right' },
      11: { cellWidth: 20, halign: 'center' },
    },
  });

  return (doc as any).lastAutoTable?.finalY + 8;
}

/**
 * Section: Cost of Goods Sold (COGS) Breakdown
 */
function renderCogsSection(doc: jsPDF, data: FullReportData, startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('4. COST OF GOODS SOLD (COGS) BREAKDOWN', 14, startY);

  const rows = data.cogs.items.map((it) => [
    it.name,
    it.qtySold,
    formatAccountingNumber(it.ingredientsCogs),
    formatAccountingNumber(it.suppliesCogs),
    formatAccountingNumber(it.totalCogs),
    formatAccountingNumber(it.unitCogs),
    formatPct(it.cogsPctOfRev),
    it.isEstimated ? 'Fallback Recipe' : 'Snapshot',
  ]);

  rows.push([
    { content: 'SUBTOTAL (MENU ITEMS)', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: data.cogs.items.reduce((a, b) => a + b.qtySold, 0), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: formatAccountingNumber(data.cogs.items.reduce((a, b) => a + b.ingredientsCogs, 0)), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: formatAccountingNumber(data.cogs.items.reduce((a, b) => a + b.suppliesCogs, 0)), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: formatAccountingNumber(data.cogs.items.reduce((a, b) => a + b.totalCogs, 0)), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: '', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: '', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: '', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
  ]);

  rows.push([
    { content: 'Order-Level Takeout Packaging COGS', colSpan: 4 } as any,
    formatAccountingNumber(data.cogs.orderPackagingCogs),
    '', '', '',
  ]);

  rows.push([
    { content: 'Refunded Sales Consumed Inventory (Wastage)', colSpan: 4 } as any,
    formatAccountingNumber(data.cogs.refundedCogsWastage),
    '', '', '',
  ]);

  rows.push([
    { content: 'GRAND TOTAL COGS', colSpan: 4, styles: { fontStyle: 'bold', textColor: BRAND_COLORS.primary } } as any,
    { content: formatAccountingNumber(data.cogs.totalCogs), styles: { fontStyle: 'bold', textColor: BRAND_COLORS.primary } } as any,
    '', '', '',
  ]);

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: startY + 3,
    head: [['Product Name', 'Qty Sold', 'Ingredients (PHP)', 'Supplies (PHP)', 'Total COGS (PHP)', 'Unit COGS (PHP)', 'COGS %', 'Cost Basis']],
    body: rows,
    columnStyles: {
      0: { cellWidth: 73, halign: 'left' },
      1: { cellWidth: 22, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 34, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'center' },
    },
  });

  return (doc as any).lastAutoTable?.finalY + 8;
}

/**
 * Section: Operating Expenses Breakdown & Ledger
 */
function renderExpensesSection(doc: jsPDF, data: FullReportData, startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('5. OPERATING EXPENSES (OPEX) BREAKDOWN & LEDGER', 14, startY);

  // Category summary table
  const catRows = data.expenses.byCategory.map((cat) => [
    cat.category,
    formatAccountingNumber(cat.amount),
    formatPct(cat.sharePct),
  ]);

  catRows.push([
    { content: 'TOTAL OPERATING EXPENSES', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: formatAccountingNumber(data.expenses.totalOpex), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: '100.00%', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
  ]);

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: startY + 3,
    head: [['Expense Category', 'Total Amount (PHP)', '% of Operating Expenses']],
    body: catRows,
    columnStyles: {
      0: { cellWidth: 139, halign: 'left' },
      1: { cellWidth: 70, halign: 'right' },
      2: { cellWidth: 60, halign: 'right' },
    },
  });

  let currentY = (doc as any).lastAutoTable?.finalY + 6;

  // Period comparison if available
  if (data.expenses.periodComparison) {
    const pc = data.expenses.periodComparison;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_COLORS.dark);
    doc.text(
      `Period Comparison (${pc.prevPeriodLabel}): Prior Net Sales = PHP ${formatAccountingNumber(
        pc.prevNetSales
      )} (Growth: ${formatPct(pc.salesGrowthPct)}) | Prior Net Profit = PHP ${formatAccountingNumber(
        pc.prevNetProfit
      )} (Growth: ${formatPct(pc.profitGrowthPct)})`,
      14,
      currentY
    );
    currentY += 6;
  }

  // Expense itemized ledger table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Itemized Expense Ledger', 14, currentY);

  const ledgerRows = data.expenses.ledger.map((e) => [
    e.date ? format(new Date(e.date), 'yyyy-MM-dd') : 'N/A',
    e.description || 'N/A',
    e.category || 'General',
    formatAccountingNumber(Number(e.amount || 0)),
  ]);

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: currentY + 3,
    head: [['Date', 'Description / Vendor', 'Category', 'Amount (PHP)']],
    body: ledgerRows,
    columnStyles: {
      0: { cellWidth: 35, halign: 'center' },
      1: { cellWidth: 124, halign: 'left' },
      2: { cellWidth: 60, halign: 'left' },
      3: { cellWidth: 50, halign: 'right' },
    },
  });

  return (doc as any).lastAutoTable?.finalY + 8;
}

/**
 * Section: Raw Ingredients & Stock Valuation Table
 */
function renderInventorySection(doc: jsPDF, data: FullReportData, startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('6. INVENTORY VALUATION & STOCK STATUS AUDIT', 14, startY);

  const rows = data.inventory.items.map((it) => [
    it.name,
    it.itemType === 'supply' ? 'Packaging/Supply' : 'Raw Ingredient',
    it.unit,
    `${it.stockQuantity} ${it.unit}`,
    formatAccountingNumber(it.unitCost),
    formatAccountingNumber(it.stockValue),
    `${it.lowStockThreshold} ${it.unit}`,
    it.status,
    it.earliestExpiry || 'None',
  ]);

  rows.push([
    { content: 'TOTAL INVENTORY VALUATION', styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: `Ingredients: PHP ${formatAccountingNumber(data.inventory.ingredientsValue)} | Supplies: PHP ${formatAccountingNumber(data.inventory.suppliesValue)}`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: formatAccountingNumber(data.inventory.totalValue), styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
    { content: `Low: ${data.inventory.lowStockCount} | Out: ${data.inventory.outOfStockCount}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: BRAND_COLORS.surface } } as any,
  ]);

  runAutoTable(doc, {
    ...getStandardTableOptions(),
    startY: startY + 3,
    head: [['Item Name', 'Category', 'Unit', 'Stock Qty', 'Unit Cost (PHP)', 'Stock Value (PHP)', 'Threshold', 'Status', 'Earliest Expiry']],
    body: rows,
    bodyStyles: { fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 59, halign: 'left' },
      1: { cellWidth: 36, halign: 'left' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 32, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 24, halign: 'center' },
    },
  });

  return (doc as any).lastAutoTable?.finalY + 8;
}

/**
 * Section: Notes & Accounting Assumptions
 */
function renderNotesAndAssumptions(doc: jsPDF, startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text('7. ACCOUNTING NOTES & METHODOLOGY', 14, startY);

  const notes = [
    '1. Cost of Goods Sold (COGS): Computed based on ingredient and packaging unit costs captured at time of checkout. When historical transaction snapshots are absent, fallback recipe standard costing is utilized.',
    '2. Revenue Recognition: Net Sales equals Gross Sales less discounts and promotions. Voided orders are excluded entirely from revenues and COGS, with raw inventory returned to stock.',
    '3. Refund Handling: Refunded transactions reverse gross revenue; consumed ingredients and packaging are recognized as inventory wastage COGS under cost of sales.',
    '4. Inventory Valuation: Evaluated using active inventory batches (FEFO remaining quantity multiplied by batch acquisition cost) or default weighted average cost.',
    '5. Currency & Precision: All monetary figures are stated in Philippine Peso (PHP), rounded to 2 decimal places. Operating expenses are categorized per chart of accounts.',
  ];

  let y = startY + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...BRAND_COLORS.muted);

  for (const note of notes) {
    doc.text(note, 14, y, { maxWidth: 265 });
    y += 4;
  }

  return y + 6;
}

// ════════════════════════════════════════════════════════════
// HIGH-LEVEL EXPORT PDF FUNCTIONS
// ════════════════════════════════════════════════════════════

/**
 * Exports a PDF report tailored to the active tab.
 */
export function exportTabPdf(
  tab: 'sales' | 'expenses' | 'profit' | 'inventory',
  data: FullReportData
): void {
  // Use Landscape for wide tabular data (Sales, Inventory, Expenses) and Portrait for Profit
  const orientation = tab === 'profit' ? 'portrait' : 'landscape';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const titleMap = {
    sales: 'Sales Performance & Transaction Ledger',
    expenses: 'Operating Expenses & COGS Breakdown',
    profit: 'Statement of Profit & Loss (Income Statement)',
    inventory: 'Raw Ingredients & Supplies Valuation Audit',
  };

  let y = drawReportHeader(doc, titleMap[tab], data.meta, orientation);
  y = drawExecutiveSummaryCards(doc, data.summary, y, orientation);

  if (tab === 'sales') {
    y = renderSalesSummarySection(doc, data, y);
    if (y > 175) {
      doc.addPage();
      y = 20;
    }
    renderSalesLedgerSection(doc, data, y);
  } else if (tab === 'expenses') {
    renderExpensesSection(doc, data, y);
  } else if (tab === 'profit') {
    renderProfitLossSection(doc, data, y);
  } else if (tab === 'inventory') {
    renderInventorySection(doc, data, y);
  }

  applyFooters(doc, data.meta);

  const filename = `espro_${tab}_report_${getPeriodFilenameSlug(data.meta)}.pdf`;
  doc.save(filename);
}

/**
 * Exports a comprehensive 7-section Full Financial Report Audit Pack PDF.
 */
export function exportFullReportPdf(data: FullReportData): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // PAGE 1: Header + Executive Summary + P&L
  let y = drawReportHeader(doc, 'Full Financial Report & Audit Pack', data.meta, 'landscape');
  y = drawExecutiveSummaryCards(doc, data.summary, y, 'landscape');
  y = renderProfitLossSection(doc, data, y);

  // PAGE 2: Sales Summary + Menu Mix
  doc.addPage();
  y = 20;
  y = renderSalesSummarySection(doc, data, y);

  // PAGE 3: Sales Transaction Ledger
  doc.addPage();
  y = 20;
  y = renderSalesLedgerSection(doc, data, y);

  // PAGE 4: COGS Breakdown
  doc.addPage();
  y = 20;
  y = renderCogsSection(doc, data, y);

  // PAGE 5: Operating Expenses & Ledger
  doc.addPage();
  y = 20;
  y = renderExpensesSection(doc, data, y);

  // PAGE 6: Inventory Valuation & Stock Audit
  doc.addPage();
  y = 20;
  y = renderInventorySection(doc, data, y);

  // PAGE 7: Notes & Accounting Assumptions
  if (y > 140) {
    doc.addPage();
    y = 20;
  }
  renderNotesAndAssumptions(doc, y);

  applyFooters(doc, data.meta);

  const filename = `espro_full_financial_report_${getPeriodFilenameSlug(data.meta)}.pdf`;
  doc.save(filename);
}
