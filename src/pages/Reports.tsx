import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, BarChart3, DollarSign, Package, Receipt,
  X, RotateCcw, Inbox, UtensilsCrossed, ShoppingBag,
  ChevronDown, FileText, FileSpreadsheet
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import Pagination from '../components/Common/Pagination';
import { useAuth } from '../contexts/AuthContext';
import type { Sale, Ingredient, IngredientBatch, Expense, MenuItem, MenuItemIngredient } from '../lib/mockData';
import {
  loadIngredients,
  loadSales,
  loadExpenses,
  loadMenuItems,
  loadMenuItemRecipe,
  loadBatches,
  voidSaleWithRestoration,
  refundSaleNoRestoration
} from '../lib/db';
import { calculateIngredientCost } from '../lib/unitConversion';
import {
  startOfDayLocal,
  endOfDayLocal,
  formatLocalDate,
  getPresetDateRange,
  DATE_PRESET_OPTIONS,
  type DatePresetKey,
} from '../lib/dateUtils';
import { isOutOfStock, isLowStock, getExpirationInfo } from '../lib/stockStatus';
import type { FullReportData } from '../lib/reportExport';
import {
  buildSalesCsv,
  buildSalesLineItemsCsv,
  buildExpensesCsv,
  buildProfitCsv,
  buildInventoryCsv,
  downloadCsv,
  exportTabPdf,
  exportFullReportPdf,
  getPeriodFilenameSlug,
  buildPeriodCoveredString,
  formatAccountingNumber,
} from '../lib/reportExport';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './Reports.css';

type Tab = 'sales' | 'expenses' | 'profit';

const PAGE_SIZE = 20;

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('sales');
  const [datePreset, setDatePreset] = useState<DatePresetKey>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided' | 'refunded'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'dine_in' | 'takeout'>('all');

  // Pagination states
  const [salesPage, setSalesPage] = useState(1);

  // State for reports data
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipesByMenuId, setRecipesByMenuId] = useState<Record<string, MenuItemIngredient[]>>({});
  const [batches, setBatches] = useState<IngredientBatch[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Export dropdown & process state
  const [isExporting, setIsExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Void/Refund modal state
  const [voidModal, setVoidModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [voidType, setVoidType] = useState<'voided' | 'refunded'>('voided');
  const [voidReason, setVoidReason] = useState('');
  const [savingVoid, setSavingVoid] = useState(false);

  // Inspected Sale Items Popover (Desktop Hover + Touchscreen Tap/Hold)
  const [inspectedSale, setInspectedSale] = useState<{
    sale: Sale;
    pos?: { top: number; left: number };
    triggerType: 'hover' | 'click' | 'hold';
  } | null>(null);

  const hidePopoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportDropdownOpen]);

  function calculatePopoverPosition(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const width = 330;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));

    let top = rect.bottom + 8;
    // If popover would clip bottom of screen, show above
    if (top + 320 > window.innerHeight && rect.top > 320) {
      top = rect.top - 320 - 8;
    }

    return { top, left };
  }

  function handleItemsMouseEnter(s: Sale, e: React.MouseEvent<HTMLElement>) {
    if (hidePopoverTimer.current) {
      clearTimeout(hidePopoverTimer.current);
      hidePopoverTimer.current = null;
    }
    const pos = calculatePopoverPosition(e.currentTarget);
    setInspectedSale({
      sale: s,
      pos,
      triggerType: 'hover',
    });
  }

  function handleItemsMouseLeave() {
    hidePopoverTimer.current = setTimeout(() => {
      setInspectedSale(prev => (prev?.triggerType === 'hover' ? null : prev));
    }, 250);
  }

  function handlePopoverMouseEnter() {
    if (hidePopoverTimer.current) {
      clearTimeout(hidePopoverTimer.current);
      hidePopoverTimer.current = null;
    }
  }

  function handleItemsClick(s: Sale, e: React.MouseEvent<HTMLElement>) {
    e.stopPropagation();
    if (hidePopoverTimer.current) {
      clearTimeout(hidePopoverTimer.current);
      hidePopoverTimer.current = null;
    }

    if (inspectedSale?.sale.id === s.id && inspectedSale.triggerType !== 'hover') {
      setInspectedSale(null);
      return;
    }

    const pos = calculatePopoverPosition(e.currentTarget);
    setInspectedSale({
      sale: s,
      pos,
      triggerType: 'click',
    });
  }

  function handleItemsTouchStart(s: Sale, e: React.TouchEvent<HTMLElement>) {
    const target = e.currentTarget;
    if (touchHoldTimer.current) clearTimeout(touchHoldTimer.current);
    touchHoldTimer.current = setTimeout(() => {
      const pos = calculatePopoverPosition(target);
      setInspectedSale({
        sale: s,
        pos,
        triggerType: 'hold',
      });
      toast.success(`Showing items for ${s.id}`, { id: 'hold-toast', duration: 1500 });
    }, 380); // 380ms hold
  }

  function handleItemsTouchEnd() {
    if (touchHoldTimer.current) {
      clearTimeout(touchHoldTimer.current);
      touchHoldTimer.current = null;
    }
  }

  useEffect(() => {
    function onDocClick() {
      if (inspectedSale) {
        setInspectedSale(null);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => {
      document.removeEventListener('click', onDocClick);
    };
  }, [inspectedSale]);

  async function fetchReportsData() {
    setLoadingData(true);
    try {
      const [salesData, ingredientsData, expensesData, menuItemsData, batchesData] = await Promise.all([
        loadSales(),
        loadIngredients(),
        loadExpenses(),
        loadMenuItems(false),
        loadBatches(),
      ]);
      setSales(salesData);
      setIngredients(ingredientsData);
      setExpenses(expensesData);
      setMenuItems(menuItemsData);
      setBatches(batchesData);

      // Fetch recipes for all menu items to calculate accurate fallback COGS
      const recipeMap: Record<string, MenuItemIngredient[]> = {};
      await Promise.all(
        menuItemsData.map(async (m) => {
          const rec = await loadMenuItemRecipe(m.id);
          recipeMap[m.id] = rec;
        })
      );
      setRecipesByMenuId(recipeMap);
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    fetchReportsData();
  }, []);

  function handleSelectPreset(preset: DatePresetKey) {
    setDatePreset(preset);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'custom') {
      if (!dateFrom && !dateTo) {
        const todayStr = formatLocalDate(new Date());
        setDateFrom(todayStr);
        setDateTo(todayStr);
      }
    } else {
      const range = getPresetDateRange(preset);
      setDateFrom(range.dateFrom);
      setDateTo(range.dateTo);
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setSalesPage(1);
  }, [dateFrom, dateTo, datePreset, statusFilter, orderTypeFilter, tab]);

  // Filtered sales based on local date range, status filter, and order type filter
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.createdAt);
      const matchFrom = !dateFrom || d >= startOfDayLocal(dateFrom);
      const matchTo = !dateTo || d <= endOfDayLocal(dateTo);
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchOrderType =
        orderTypeFilter === 'all' ||
        s.orderType === orderTypeFilter ||
        (orderTypeFilter === 'dine_in' && !s.orderType);
      return matchFrom && matchTo && matchStatus && matchOrderType;
    });
  }, [sales, dateFrom, dateTo, statusFilter, orderTypeFilter]);

  // Filtered expenses based on local date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date);
      const matchFrom = !dateFrom || d >= startOfDayLocal(dateFrom);
      const matchTo = !dateTo || d <= endOfDayLocal(dateTo);
      return matchFrom && matchTo;
    });
  }, [expenses, dateFrom, dateTo]);

  // Paginated arrays
  const totalSalesPages = Math.ceil(filteredSales.length / PAGE_SIZE) || 1;
  const paginatedSales = useMemo(() => {
    return filteredSales.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  }, [filteredSales, salesPage]);

  // Helper to count item quantity in sale
  const getItemCount = (items: any[]) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum: number, item: any) => sum + Number(item.qty || 1), 0);
  };

  // ════════════════════════════════════════════════════════════
  // 1. SALES METRICS CALCULATIONS
  // ════════════════════════════════════════════════════════════
  const completedSalesInPeriod = useMemo(() => {
    return filteredSales.filter((s) => s.status === 'completed');
  }, [filteredSales]);

  const refundedSalesInPeriod = useMemo(() => {
    return filteredSales.filter((s) => s.status === 'refunded');
  }, [filteredSales]);

  // Gross Sales = Sum of (Subtotal or Total + Discount) for completed sales
  const grossSales = useMemo(() => {
    return completedSalesInPeriod.reduce((sum, s) => {
      const subtotal =
        s.subtotal != null ? Number(s.subtotal) : Number(s.total) + Number(s.discount || 0);
      return sum + subtotal;
    }, 0);
  }, [completedSalesInPeriod]);

  // Total Discounts for completed sales
  const totalDiscounts = useMemo(() => {
    return completedSalesInPeriod.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  }, [completedSalesInPeriod]);

  // Net Sales = Gross Sales - Discounts
  const netSales = grossSales - totalDiscounts;

  // ════════════════════════════════════════════════════════════
  // 2. COGS PER PRODUCT + PACKAGING + REFUND WASTAGE
  // ════════════════════════════════════════════════════════════
  const fallbackRecipeCogsMap = useMemo(() => {
    const map: Record<string, number> = {};
    menuItems.forEach((item) => {
      const recipe = recipesByMenuId[item.id] || [];
      const servingCost = recipe.reduce((acc, r) => {
        const ing = ingredients.find((i) => i.id === r.ingredient_id) || r.ingredient;
        const lineCost = calculateIngredientCost(
          Number(r.quantity_used) || 0,
          r.unit || ing?.unit || 'pcs',
          ing
        );
        return acc + lineCost;
      }, 0);
      map[item.id] = servingCost;
    });
    return map;
  }, [menuItems, recipesByMenuId, ingredients]);

  // Breakdown of completed sales COGS split into Ingredients vs Packaging & Supplies
  const { cogsBreakdown, estimatedLinesCount } = useMemo(() => {
    let fallbackCount = 0;
    const qtySoldMap: Record<
      string,
      {
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
    > = {};

    completedSalesInPeriod.forEach((sale) => {
      (sale.items || []).forEach((item: any) => {
        const id = item.menu_item_id || item.product?.id || item.id || item.name;
        const name = item.name || item.product?.name || 'Unknown Item';
        const qty = Number(item.qty || 1);

        const isEstimated = item.cogs_per_serving == null;
        if (isEstimated) fallbackCount++;

        // Snapshot ingredient cost; fallback to current recipe calculation
        const cogsIngPerServing =
          item.cogs_per_serving != null
            ? Number(item.cogs_per_serving)
            : fallbackRecipeCogsMap[id] || 0;

        // Snapshot supplies cost (per serving)
        const cogsSuppliesPerServing =
          item.cogs_supplies_per_serving != null ? Number(item.cogs_supplies_per_serving) : 0;

        if (!qtySoldMap[id]) {
          qtySoldMap[id] = {
            id,
            name,
            qtySold: 0,
            ingredientsCogs: 0,
            suppliesCogs: 0,
            totalCogs: 0,
            unitCogs: 0,
            cogsPctOfRev: 0,
            isEstimated,
          };
        }

        qtySoldMap[id].qtySold += qty;
        qtySoldMap[id].ingredientsCogs += qty * cogsIngPerServing;
        qtySoldMap[id].suppliesCogs += qty * cogsSuppliesPerServing;
        qtySoldMap[id].totalCogs += qty * (cogsIngPerServing + cogsSuppliesPerServing);
      });
    });

    const items = Object.values(qtySoldMap)
      .filter((p) => p.qtySold > 0)
      .map((p) => ({
        ...p,
        unitCogs: p.qtySold > 0 ? p.totalCogs / p.qtySold : 0,
        cogsPctOfRev: netSales > 0 ? (p.totalCogs / netSales) * 100 : 0,
      }));

    return { cogsBreakdown: items, estimatedLinesCount: fallbackCount };
  }, [completedSalesInPeriod, fallbackRecipeCogsMap, netSales]);

  // Order-level takeout packaging COGS
  const orderPackagingCogs = useMemo(() => {
    return completedSalesInPeriod.reduce((sum, sale) => {
      return sum + Number(sale.orderSuppliesCogs || 0);
    }, 0);
  }, [completedSalesInPeriod]);

  // Subtotals for line items
  const totalLineIngredientsCogs = useMemo(() => {
    return cogsBreakdown.reduce((sum, item) => sum + item.ingredientsCogs, 0);
  }, [cogsBreakdown]);

  const totalLineSuppliesCogs = useMemo(() => {
    return cogsBreakdown.reduce((sum, item) => sum + item.suppliesCogs, 0);
  }, [cogsBreakdown]);

  const totalLineCogs = useMemo(() => {
    return totalLineIngredientsCogs + totalLineSuppliesCogs;
  }, [totalLineIngredientsCogs, totalLineSuppliesCogs]);

  // COGS of refunded sales (ingredients & supplies consumed as wastage)
  const refundedCogsWastage = useMemo(() => {
    let sum = 0;
    refundedSalesInPeriod.forEach((sale) => {
      (sale.items || []).forEach((item: any) => {
        const id = item.menu_item_id || item.product?.id || item.id;
        const qty = Number(item.qty || 1);
        const ingCost =
          item.cogs_per_serving != null
            ? Number(item.cogs_per_serving)
            : fallbackRecipeCogsMap[id] || 0;
        const suppCost =
          item.cogs_supplies_per_serving != null ? Number(item.cogs_supplies_per_serving) : 0;
        sum += qty * (ingCost + suppCost);
      });
      sum += Number(sale.orderSuppliesCogs || 0);
    });
    return sum;
  }, [refundedSalesInPeriod, fallbackRecipeCogsMap]);

  const completedCogs = totalLineCogs + orderPackagingCogs;
  const totalCogs = completedCogs + refundedCogsWastage;

  // ════════════════════════════════════════════════════════════
  // 3. OPERATING EXPENSES BY CATEGORY
  // ════════════════════════════════════════════════════════════
  const operatingExpensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([category, amount]) => ({
      category,
      amount,
    }));
  }, [filteredExpenses]);

  const totalOperatingExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  // ════════════════════════════════════════════════════════════
  // 4. PROFIT & LOSS FORMULAS & RATIOS
  // ════════════════════════════════════════════════════════════
  const grossProfit = netSales - totalCogs;
  const netProfit = grossProfit - totalOperatingExpenses;
  const isNetProfitPositive = netProfit >= 0;

  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;
  const cogsPct = netSales > 0 ? (totalCogs / netSales) * 100 : 0;
  const opexPct = netSales > 0 ? (totalOperatingExpenses / netSales) * 100 : 0;
  const breakEvenSales =
    grossProfit > 0 && grossMarginPct > 0
      ? totalOperatingExpenses / (grossProfit / netSales)
      : null;

  // ════════════════════════════════════════════════════════════
  // 5. INVENTORY VALUATION & BATCH AUDIT
  // ════════════════════════════════════════════════════════════
  const inventoryValuationData = useMemo(() => {
    let totalVal = 0;
    let ingredientsVal = 0;
    let suppliesVal = 0;
    let lowCount = 0;
    let outCount = 0;
    let nearExpCount = 0;
    let expCount = 0;
    let expRiskVal = 0;

    const items = ingredients.map((ing) => {
      const activeBatches = batches.filter(
        (b) => b.ingredient_id === ing.id && b.status === 'active' && Number(b.quantity_remaining) > 0
      );

      // Prefer batch-weighted stock value using remaining quantity × batch unit cost
      let stockValue = 0;
      if (activeBatches.length > 0) {
        stockValue = activeBatches.reduce(
          (sum, b) => sum + Number(b.quantity_remaining) * Number(b.cost_per_unit || 0),
          0
        );
      } else {
        stockValue = Number(ing.stock_quantity || 0) * Number(ing.cost_per_unit || 0);
      }

      const activeExpDates = activeBatches
        .map((b) => b.expiration_date)
        .filter(Boolean) as string[];
      const earliestExp =
        activeExpDates.length > 0
          ? activeExpDates.sort()[0]
          : ing.expiration_date || null;

      const expInfo = getExpirationInfo(earliestExp);
      const isOut = isOutOfStock(ing);
      const isLow = isLowStock(ing);

      const status: 'In Stock' | 'Low Stock' | 'Out of Stock' = isOut
        ? 'Out of Stock'
        : isLow
        ? 'Low Stock'
        : 'In Stock';

      if (isOut) outCount++;
      else if (isLow) lowCount++;

      const isExpired = expInfo.status === 'expired' || expInfo.status === 'expired_today';
      const isNearExpiry = expInfo.status === 'near_expiry';

      if (isExpired) {
        expCount++;
        expRiskVal += stockValue;
      } else if (isNearExpiry) {
        nearExpCount++;
      }

      totalVal += stockValue;
      if (ing.item_type === 'supply') {
        suppliesVal += stockValue;
      } else {
        ingredientsVal += stockValue;
      }

      return {
        id: ing.id,
        name: ing.name,
        itemType: (ing.item_type || 'ingredient') as 'ingredient' | 'supply',
        unit: ing.unit,
        stockQuantity: Number(ing.stock_quantity || 0),
        unitCost: Number(ing.cost_per_unit || 0),
        stockValue,
        lowStockThreshold: Number(ing.low_stock_threshold || 10),
        status,
        earliestExpiry: earliestExp,
        daysToExpiry: expInfo.daysLeft,
        isExpired,
        isNearExpiry,
      };
    });

    return {
      items,
      totalValue: totalVal,
      ingredientsValue: ingredientsVal,
      suppliesValue: suppliesVal,
      lowStockCount: lowCount,
      outOfStockCount: outCount,
      nearExpiryCount: nearExpCount,
      expiredCount: expCount,
      expiredRiskValue: expRiskVal,
    };
  }, [ingredients, batches]);

  // ════════════════════════════════════════════════════════════
  // 6. SALES BREAKDOWNS (Payment, Order Type, Cashier, Menu Mix)
  // ════════════════════════════════════════════════════════════
  const salesBreakdownData = useMemo(() => {
    const completedCount = completedSalesInPeriod.length;
    const refundedCount = refundedSalesInPeriod.length;
    const refundedTotal = refundedSalesInPeriod.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const voidedSales = filteredSales.filter((s) => s.status === 'voided');
    const voidedCount = voidedSales.length;
    const voidedTotal = voidedSales.reduce(
      (acc, s) => acc + (s.subtotal != null ? Number(s.subtotal) : Number(s.total)),
      0
    );

    const totalItemsSold = completedSalesInPeriod.reduce((acc, s) => acc + getItemCount(s.items), 0);
    const atv = completedCount > 0 ? netSales / completedCount : 0;
    const avgItemsPerOrder = completedCount > 0 ? totalItemsSold / completedCount : 0;

    // Payment methods
    let cashCount = 0;
    let cashAmount = 0;
    let digitalCount = 0;
    let digitalAmount = 0;
    let totalCashTendered = 0;
    let totalCashChange = 0;

    completedSalesInPeriod.forEach((s) => {
      const netVal = s.subtotal != null ? Number(s.subtotal) - Number(s.discount || 0) : Number(s.total);
      if (s.paymentMethod === 'cash') {
        cashCount++;
        cashAmount += netVal;
        if (s.amountTendered != null) totalCashTendered += Number(s.amountTendered);
        if (s.changeDue != null) totalCashChange += Number(s.changeDue);
      } else {
        digitalCount++;
        digitalAmount += netVal;
      }
    });

    const completedNetSum = cashAmount + digitalAmount || 1;
    const cashSharePct = (cashAmount / completedNetSum) * 100;
    const digitalSharePct = (digitalAmount / completedNetSum) * 100;

    // Order type split
    let dineInCount = 0;
    let dineInNet = 0;
    let dineInCogs = 0;
    let takeoutCount = 0;
    let takeoutNet = 0;
    let takeoutCogs = 0;

    completedSalesInPeriod.forEach((s) => {
      const netVal = s.subtotal != null ? Number(s.subtotal) - Number(s.discount || 0) : Number(s.total);
      let saleCogs = 0;
      if (Array.isArray(s.items)) {
        s.items.forEach((it: any) => {
          const qty = Number(it.qty || 1);
          saleCogs += qty * (Number(it.cogs_per_serving || 0) + Number(it.cogs_supplies_per_serving || 0));
        });
      }
      saleCogs += Number(s.orderSuppliesCogs || 0);

      if (s.orderType === 'takeout') {
        takeoutCount++;
        takeoutNet += netVal;
        takeoutCogs += saleCogs;
      } else {
        dineInCount++;
        dineInNet += netVal;
        dineInCogs += saleCogs;
      }
    });

    const dineInProfit = dineInNet - dineInCogs;
    const takeoutProfit = takeoutNet - takeoutCogs;

    // Cashier breakdown
    const cashierMap: Record<string, { transactions: number; netSales: number }> = {};
    completedSalesInPeriod.forEach((s) => {
      const name = s.cashierName || 'Staff';
      const netVal = s.subtotal != null ? Number(s.subtotal) - Number(s.discount || 0) : Number(s.total);
      if (!cashierMap[name]) {
        cashierMap[name] = { transactions: 0, netSales: 0 };
      }
      cashierMap[name].transactions++;
      cashierMap[name].netSales += netVal;
    });

    const cashierSummary = Object.entries(cashierMap).map(([name, stat]) => ({
      name,
      transactions: stat.transactions,
      netSales: stat.netSales,
      sharePct: completedNetSum > 0 ? (stat.netSales / completedNetSum) * 100 : 0,
    }));

    // Daily summary table
    const dailyMap: Record<
      string,
      { transactions: number; gross: number; discounts: number; refunds: number; net: number; cogs: number }
    > = {};

    filteredSales.forEach((s) => {
      const dKey = format(new Date(s.createdAt), 'yyyy-MM-dd');
      if (!dailyMap[dKey]) {
        dailyMap[dKey] = { transactions: 0, gross: 0, discounts: 0, refunds: 0, net: 0, cogs: 0 };
      }
      if (s.status === 'completed') {
        dailyMap[dKey].transactions++;
        const subtotal = s.subtotal != null ? Number(s.subtotal) : Number(s.total) + Number(s.discount || 0);
        const discount = Number(s.discount || 0);
        dailyMap[dKey].gross += subtotal;
        dailyMap[dKey].discounts += discount;
        dailyMap[dKey].net += subtotal - discount;

        let saleCogs = 0;
        if (Array.isArray(s.items)) {
          s.items.forEach((it: any) => {
            const qty = Number(it.qty || 1);
            saleCogs += qty * (Number(it.cogs_per_serving || 0) + Number(it.cogs_supplies_per_serving || 0));
          });
        }
        saleCogs += Number(s.orderSuppliesCogs || 0);
        dailyMap[dKey].cogs += saleCogs;
      } else if (s.status === 'refunded') {
        dailyMap[dKey].refunds += Number(s.total || 0);
      }
    });

    const dailySales = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stat]) => ({
        date,
        transactions: stat.transactions,
        gross: stat.gross,
        discounts: stat.discounts,
        refunds: stat.refunds,
        net: stat.net,
        cogs: stat.cogs,
        grossProfit: stat.net - stat.cogs,
      }));

    // Product sales / Menu-mix table
    const productMap: Record<
      string,
      { name: string; qtySold: number; grossRevenue: number; cogs: number }
    > = {};

    completedSalesInPeriod.forEach((s) => {
      if (!Array.isArray(s.items)) return;
      s.items.forEach((it: any) => {
        const baseName = it.name || it.product?.name || 'Item';
        const sizeName = it.size_name ? ` (${it.size_name})` : '';
        const fullName = `${baseName}${sizeName}`;
        const qty = Number(it.qty || 1);
        const price = Number(it.price || it.unit_price || it.product?.price || 0);
        const lineRev = price * qty;
        const lineCogs =
          qty * (Number(it.cogs_per_serving || 0) + Number(it.cogs_supplies_per_serving || 0));

        if (!productMap[fullName]) {
          productMap[fullName] = { name: fullName, qtySold: 0, grossRevenue: 0, cogs: 0 };
        }
        productMap[fullName].qtySold += qty;
        productMap[fullName].grossRevenue += lineRev;
        productMap[fullName].cogs += lineCogs;
      });
    });

    const totalGrossRevenue = Object.values(productMap).reduce((acc, p) => acc + p.grossRevenue, 0) || 1;

    const productSales = Object.values(productMap)
      .map((p) => {
        const lineGrossProfit = p.grossRevenue - p.cogs;
        const avgPrice = p.qtySold > 0 ? p.grossRevenue / p.qtySold : 0;
        const marginPct = p.grossRevenue > 0 ? (lineGrossProfit / p.grossRevenue) * 100 : 0;
        const revenueSharePct = (p.grossRevenue / totalGrossRevenue) * 100;
        return {
          name: p.name,
          qtySold: p.qtySold,
          grossRevenue: p.grossRevenue,
          avgPrice,
          cogs: p.cogs,
          grossProfit: lineGrossProfit,
          marginPct,
          revenueSharePct,
        };
      })
      .sort((a, b) => b.grossRevenue - a.grossRevenue);

    return {
      completedCount,
      refundedCount,
      refundedTotal,
      voidedCount,
      voidedTotal,
      atv,
      totalItemsSold,
      avgItemsPerOrder,
      cashCount,
      cashAmount,
      cashSharePct,
      digitalCount,
      digitalAmount,
      digitalSharePct,
      totalCashTendered,
      totalCashChange,
      dineInCount,
      dineInNet,
      dineInCogs,
      dineInProfit,
      takeoutCount,
      takeoutNet,
      takeoutCogs,
      takeoutProfit,
      cashierSummary,
      dailySales,
      productSales,
    };
  }, [completedSalesInPeriod, refundedSalesInPeriod, filteredSales, netSales]);

  // ════════════════════════════════════════════════════════════
  // 7. PERIOD COMPARISON (If date range selected)
  // ════════════════════════════════════════════════════════════
  const periodComparison = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    const currentStart = startOfDayLocal(dateFrom).getTime();
    const currentEnd = endOfDayLocal(dateTo).getTime();
    const durationMs = currentEnd - currentStart;
    const prevStart = new Date(currentStart - durationMs);
    const prevEnd = new Date(currentStart - 1);

    const prevSales = sales.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= prevStart && d <= prevEnd && s.status === 'completed';
    });

    const prevGross = prevSales.reduce((acc, s) => {
      const subtotal = s.subtotal != null ? Number(s.subtotal) : Number(s.total) + Number(s.discount || 0);
      return acc + subtotal;
    }, 0);
    const prevDiscounts = prevSales.reduce((acc, s) => acc + Number(s.discount || 0), 0);
    const prevNetSales = prevGross - prevDiscounts;

    let prevCogs = 0;
    prevSales.forEach((s) => {
      if (Array.isArray(s.items)) {
        s.items.forEach((it: any) => {
          const qty = Number(it.qty || 1);
          prevCogs += qty * (Number(it.cogs_per_serving || 0) + Number(it.cogs_supplies_per_serving || 0));
        });
      }
      prevCogs += Number(s.orderSuppliesCogs || 0);
    });

    const prevExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= prevStart && d <= prevEnd;
    });
    const prevOpex = prevExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const prevNetProfit = prevNetSales - prevCogs - prevOpex;

    const salesGrowthPct = prevNetSales > 0 ? ((netSales - prevNetSales) / prevNetSales) * 100 : null;
    const profitGrowthPct =
      prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : null;

    return {
      prevPeriodLabel: `${format(prevStart, 'MMM dd')} - ${format(prevEnd, 'MMM dd')}`,
      prevNetSales,
      prevNetProfit,
      salesGrowthPct,
      profitGrowthPct,
    };
  }, [dateFrom, dateTo, sales, expenses, netSales, netProfit]);

  // ════════════════════════════════════════════════════════════
  // 8. UNIFIED FULL REPORT DATA MODEL
  // ════════════════════════════════════════════════════════════
  const fullReportData: FullReportData = useMemo(() => {
    const opexCategories = operatingExpensesByCategory.map((c) => ({
      category: c.category,
      amount: c.amount,
      sharePct: totalOperatingExpenses > 0 ? (c.amount / totalOperatingExpenses) * 100 : 0,
    }));

    return {
      meta: {
        dateFrom,
        dateTo,
        datePreset,
        periodLabel: buildPeriodCoveredString({ dateFrom, dateTo, datePreset }),
        statusFilter,
        orderTypeFilter,
        generatedBy: user?.name || user?.email || 'Administrator',
        generatedAt: new Date(),
        businessName: 'Espro Coffee & Tea',
      },
      summary: {
        grossSales,
        totalDiscounts,
        netSales,
        totalCogs,
        grossProfit,
        totalOperatingExpenses,
        netProfit,
        grossMarginPct,
        netMarginPct,
        cogsPct,
        opexPct,
        breakEvenSales,
      },
      sales: {
        ledger: filteredSales,
        breakdowns: salesBreakdownData,
      },
      cogs: {
        items: cogsBreakdown,
        orderPackagingCogs,
        refundedCogsWastage,
        totalCogs,
        estimatedLinesCount,
      },
      expenses: {
        ledger: filteredExpenses,
        byCategory: opexCategories,
        totalOpex: totalOperatingExpenses,
        periodComparison,
      },
      inventory: inventoryValuationData,
    };
  }, [
    dateFrom,
    dateTo,
    datePreset,
    statusFilter,
    orderTypeFilter,
    user,
    grossSales,
    totalDiscounts,
    netSales,
    totalCogs,
    grossProfit,
    totalOperatingExpenses,
    netProfit,
    grossMarginPct,
    netMarginPct,
    cogsPct,
    opexPct,
    breakEvenSales,
    filteredSales,
    salesBreakdownData,
    cogsBreakdown,
    orderPackagingCogs,
    refundedCogsWastage,
    estimatedLinesCount,
    filteredExpenses,
    operatingExpensesByCategory,
    periodComparison,
    inventoryValuationData,
  ]);

  // ════════════════════════════════════════════════════════════
  // 9. CONTEXT-AWARE EXPORT HANDLERS (CSV & PDF)
  // ════════════════════════════════════════════════════════════
  async function handleExportActiveTabCsv() {
    setExportDropdownOpen(false);
    setIsExporting(true);
    try {
      const slug = getPeriodFilenameSlug(fullReportData.meta);
      if (tab === 'sales') {
        if (filteredSales.length === 0) {
          toast.error('No sales data to export for selected filter');
          return;
        }
        const csv = buildSalesCsv(fullReportData);
        downloadCsv(`espro_sales_ledger_${slug}.csv`, csv);
        toast.success('Sales transaction ledger exported to CSV!');
      } else if (tab === 'expenses') {
        if (cogsBreakdown.length === 0 && filteredExpenses.length === 0) {
          toast.error('No expense data to export for selected filter');
          return;
        }
        const csv = buildExpensesCsv(fullReportData);
        downloadCsv(`espro_expenses_${slug}.csv`, csv);
        toast.success('Expense report exported to CSV!');
      } else if (tab === 'profit') {
        const csv = buildProfitCsv(fullReportData);
        downloadCsv(`espro_profit_loss_${slug}.csv`, csv);
        toast.success('Profit & Loss statement exported to CSV!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportSalesLineItemsCsv() {
    setExportDropdownOpen(false);
    setIsExporting(true);
    try {
      if (filteredSales.length === 0) {
        toast.error('No sales data to export for selected filter');
        return;
      }
      const slug = getPeriodFilenameSlug(fullReportData.meta);
      const csv = buildSalesLineItemsCsv(fullReportData);
      downloadCsv(`espro_sales_line_items_${slug}.csv`, csv);
      toast.success('Sales line items exported to CSV!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export line items CSV');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportActiveTabPdf() {
    setExportDropdownOpen(false);
    setIsExporting(true);
    try {
      if (tab === 'sales' && filteredSales.length === 0) {
        toast.error('No sales data to export for selected filter');
        return;
      }
      if (tab === 'expenses' && cogsBreakdown.length === 0 && filteredExpenses.length === 0) {
        toast.error('No expense data to export for selected filter');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      exportTabPdf(tab, fullReportData);
      toast.success('PDF report generated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportFullReportPdf() {
    setExportDropdownOpen(false);
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      exportFullReportPdf(fullReportData);
      toast.success('Full Financial Report (All Sections) exported to PDF!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate Full Report PDF');
    } finally {
      setIsExporting(false);
    }
  }


  function handleVoidClick(saleId: string) {
    setSelectedSaleId(saleId);
    setVoidReason('');
    setVoidType('voided');
    setVoidModal(true);
  }

  async function handleConfirmVoid() {
    if (!selectedSaleId) return;
    if (!voidReason.trim()) {
      toast.error('Please specify a reason');
      return;
    }

    setSavingVoid(true);
    try {
      if (voidType === 'voided') {
        const res = await voidSaleWithRestoration(selectedSaleId, voidType, voidReason.trim());
        if (res?.restored) {
          toast.success('Sale voided successfully! Raw ingredient stock restored.');
        } else {
          toast(
            'Voided, but stock could not be restored automatically (legacy sale). Adjust inventory manually.',
            {
              icon: '⚠️',
            }
          );
        }
      } else {
        await refundSaleNoRestoration(selectedSaleId, voidReason.trim());
        toast.success('Sale refunded successfully! Stock remains deducted.');
      }
      setVoidModal(false);
      await fetchReportsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update sale status');
    } finally {
      setSavingVoid(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'sales', label: 'Sales Report', icon: BarChart3 },
    { key: 'expenses', label: 'Expense Report', icon: Receipt },
    { key: 'profit', label: 'Profit Summary', icon: DollarSign },
  ];

  // ════════════════════════════════════════════════════════════
  // CONDITIONAL RENDERING BELOW ALL HOOKS (Rules of Hooks)
  // ════════════════════════════════════════════════════════════
  if (!authLoading && user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (authLoading || loadingData) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <TopBar title="Financial Reports" />
          <main className="page-body">
            <div className="empty-state" style={{ padding: '100px 20px' }}>
              <div className="spinner" />
              <p>Loading financial reports...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          title="Financial Reports"
          action={
            <div className="export-dropdown-wrapper" ref={exportDropdownRef}>
              <button
                className="btn-export-dropdown"
                onClick={() => setExportDropdownOpen((prev) => !prev)}
                disabled={isExporting}
                title="Export Financial Reports"
              >
                {isExporting ? <span className="spinner-sm" /> : <Download size={15} />}
                <span>Export</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: exportDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>

              {exportDropdownOpen && (
                <div className="export-dropdown-menu">
                  <div className="export-dropdown-header">
                    Current Section ({tabs.find((t) => t.key === tab)?.label})
                  </div>
                  <button
                    className="export-dropdown-item primary-action"
                    onClick={handleExportActiveTabPdf}
                    disabled={isExporting}
                  >
                    <div className="export-dropdown-icon pdf">
                      <FileText size={13} />
                    </div>
                    <span>Export {tabs.find((t) => t.key === tab)?.label} (PDF)</span>
                  </button>
                  <button
                    className="export-dropdown-item"
                    onClick={handleExportActiveTabCsv}
                    disabled={isExporting}
                  >
                    <div className="export-dropdown-icon csv">
                      <FileSpreadsheet size={13} />
                    </div>
                    <span>Export {tabs.find((t) => t.key === tab)?.label} (CSV)</span>
                  </button>
                  {tab === 'sales' && (
                    <button
                      className="export-dropdown-item"
                      onClick={handleExportSalesLineItemsCsv}
                      disabled={isExporting}
                    >
                      <div className="export-dropdown-icon csv">
                        <FileSpreadsheet size={13} />
                      </div>
                      <span>Export Sales Line Items (CSV)</span>
                    </button>
                  )}

                  <div className="export-dropdown-divider" />
                  <div className="export-dropdown-header">Complete Audit Pack</div>
                  <button
                    className="export-dropdown-item primary-action"
                    onClick={handleExportFullReportPdf}
                    disabled={isExporting}
                  >
                    <div className="export-dropdown-icon full">
                      <FileText size={13} />
                    </div>
                    <span>Full Financial Report (All Sections PDF)</span>
                  </button>
                </div>
              )}
            </div>
          }
        />
        <main className="page-body">
          {/* Date range & Filters */}
          <div
            className="reports-filters card card-pad"
            style={{
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* Date Preset Filter + Custom Date Range */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Date:
                </span>
                <div className="period-tabs">
                  {DATE_PRESET_OPTIONS.map((preset) => (
                    <button
                      key={preset.key}
                      className={`period-tab${datePreset === preset.key ? ' active' : ''}`}
                      onClick={() => handleSelectPreset(preset.key)}
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date pickers (always interactive and synchronized with active preset) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <input
                  type="date"
                  className="input"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setDatePreset('custom');
                  }}
                  style={{ width: 135 }}
                  title="Start Date"
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>to</span>
                <input
                  type="date"
                  className="input"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setDatePreset('custom');
                  }}
                  style={{ width: 135 }}
                  title="End Date"
                />
                {(dateFrom || dateTo || datePreset !== 'all') && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleSelectPreset('all')}
                    style={{ flexShrink: 0, padding: '4px 8px', fontSize: '0.8125rem' }}
                    title="Reset to All Time"
                    type="button"
                  >
                    <X size={13} /> Clear
                  </button>
                )}
              </div>
            </div>

            {tab === 'sales' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {/* Order Type Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Type:
                  </span>
                  <div className="period-tabs">
                    {(['all', 'dine_in', 'takeout'] as const).map((ot) => (
                      <button
                        key={ot}
                        className={`period-tab${orderTypeFilter === ot ? ' active' : ''}`}
                        onClick={() => setOrderTypeFilter(ot)}
                      >
                        {ot === 'all' ? 'All' : ot === 'dine_in' ? 'Dine-in' : 'Takeout'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Status:
                  </span>
                  <div className="period-tabs">
                    {(['all', 'completed', 'refunded', 'voided'] as const).map((st) => (
                      <button
                        key={st}
                        className={`period-tab${statusFilter === st ? ' active' : ''}`}
                        onClick={() => setStatusFilter(st)}
                      >
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="reports-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`reports-tab${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ════════════════════════════════════════════════════════════
                TAB 1: SALES REPORTS (Immediate Transactions Table)
               ════════════════════════════════════════════════════════════ */}
            {tab === 'sales' && (
              <div className="card">
                <div
                  className="card-pad"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                      Sales Transactions ({filteredSales.length})
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Complete ledger of sales, discounts, refunds, and receipts
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge-neutral">
                      Gross Sales: ₱
                      {grossSales.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="badge badge-success">
                      Discounts: -₱
                      {totalDiscounts.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                      Net Sales: ₱
                      {netSales.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                {filteredSales.length === 0 ? (
                  <div className="empty-state" style={{ padding: '50px 20px' }}>
                    <Inbox size={32} />
                    <p>No transactions found matching criteria.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Sale ID</th>
                          <th>Date</th>
                          <th>Order Type</th>
                          <th>Cashier</th>
                          <th>No. of Items</th>
                          <th>Subtotal</th>
                          <th>Discount</th>
                          <th>Refund</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSales.map((s) => {
                          const itemCount = getItemCount(s.items);
                          const discountVal = Number(s.discount || 0);
                          const subtotalVal =
                            s.subtotal != null ? Number(s.subtotal) : Number(s.total) + discountVal;
                          const refundVal = s.status === 'refunded' ? Number(s.total) : 0;

                          return (
                            <tr key={s.id}>
                              {/* Sale ID */}
                              <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{s.id}</td>

                              {/* Date */}
                              <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {format(new Date(s.createdAt), 'MMM dd, h:mm a')}
                              </td>

                              {/* Order Type */}
                              <td>
                                <span
                                  className={`badge ${
                                    s.orderType === 'takeout' ? 'badge-warning' : 'badge-neutral'
                                  }`}
                                >
                                  {s.orderType === 'takeout' ? 'Takeout' : 'Dine-in'}
                                </span>
                              </td>

                              {/* Cashier */}
                              <td>{s.cashierName}</td>

                              {/* No. of Items (Hover on desktop, tap or hold on touchscreen) */}
                              <td className="sale-items-cell">
                                <button
                                  type="button"
                                  className={`items-count-pill-btn ${inspectedSale?.sale.id === s.id ? 'active' : ''}`}
                                  onClick={(e) => handleItemsClick(s, e)}
                                  onMouseEnter={(e) => handleItemsMouseEnter(s, e)}
                                  onMouseLeave={handleItemsMouseLeave}
                                  onTouchStart={(e) => handleItemsTouchStart(s, e)}
                                  onTouchEnd={handleItemsTouchEnd}
                                  onTouchCancel={handleItemsTouchEnd}
                                  title="Hover, tap, or hold to view purchased items"
                                >
                                  <Package size={13} className="pill-pkg-icon" />
                                  <span className="pill-text">
                                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                  </span>
                                </button>
                              </td>

                              {/* Subtotal */}
                              <td style={{ fontWeight: 500 }}>
                                ₱
                                {subtotalVal.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              {/* Discount */}
                              <td>
                                {discountVal > 0 ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                    ₱
                                    {discountVal.toLocaleString('en-PH', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>0</span>
                                )}
                              </td>

                              {/* Refund */}
                              <td>
                                {refundVal > 0 ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                    ₱
                                    {refundVal.toLocaleString('en-PH', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>0</span>
                                )}
                              </td>

                              {/* Total */}
                              <td
                                style={{
                                  fontWeight: 700,
                                  color:
                                    s.status === 'voided'
                                      ? 'var(--text-muted)'
                                      : 'var(--text-primary)',
                                }}
                              >
                                ₱
                                {Number(s.total).toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              {/* Status */}
                              <td>
                                <span
                                  className={`badge ${
                                    s.status === 'completed'
                                      ? 'badge-success'
                                      : s.status === 'voided'
                                        ? 'badge-danger'
                                        : 'badge-warning'
                                  }`}
                                >
                                  ●{' '}
                                  {s.status === 'completed'
                                    ? 'Completed'
                                    : s.status === 'voided'
                                      ? 'Voided'
                                      : 'Refunded'}
                                </span>
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: 'right' }}>
                                {s.status === 'completed' ? (
                                  <button
                                    className="btn btn-sm btn-ghost"
                                    style={{
                                      color: 'var(--danger)',
                                      padding: '3px 8px',
                                      fontSize: '0.72rem',
                                    }}
                                    onClick={() => handleVoidClick(s.id)}
                                  >
                                    Void / Refund
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      display: 'inline-block',
                                      maxWidth: 160,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={s.voidReason}
                                  >
                                    {s.voidReason || 'No reason specified'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  currentPage={salesPage}
                  totalPages={totalSalesPages}
                  onPageChange={setSalesPage}
                  totalItems={filteredSales.length}
                  pageSize={PAGE_SIZE}
                />
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                TAB 2: EXPENSE REPORT (2 Sections: COGS and Operating Expenses)
               ════════════════════════════════════════════════════════════ */}
            {tab === 'expenses' && (
              <div className="expense-sections-grid">
                {/* SECTION 1: COST OF GOODS SOLD (COGS) */}
                <div className="card">
                  <div className="report-section-header">
                    <h3 className="report-section-title">
                      <UtensilsCrossed size={16} color="var(--primary)" />
                      SECTION 1: COST OF GOODS SOLD (COGS)
                    </h3>
                  </div>
                  {cogsBreakdown.length === 0 &&
                  orderPackagingCogs === 0 &&
                  refundedCogsWastage === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                      <p style={{ fontSize: '0.85rem' }}>No recipe items sold in selected period.</p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th style={{ textAlign: 'center' }}>Quantity Sold</th>
                            <th style={{ textAlign: 'right' }}>Ingredients</th>
                            <th style={{ textAlign: 'right' }}>Packaging &amp; Supplies</th>
                            <th style={{ textAlign: 'right' }}>Total COGS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cogsBreakdown.map((item) => (
                            <tr key={item.id}>
                              <td style={{ fontWeight: 600 }}>{item.name}</td>
                              <td style={{ textAlign: 'center' }}>{item.qtySold}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                ₱
                                {item.ingredientsCogs.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                ₱
                                {item.suppliesCogs.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--danger)',
                                }}
                              >
                                ₱
                                {item.totalCogs.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}

                          {/* Line items subtotal */}
                          <tr
                            style={{
                              background: 'var(--surface-2)',
                              fontWeight: 600,
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            <td style={{ fontWeight: 700 }}>Line items subtotal</td>
                            <td style={{ textAlign: 'center' }}>
                              {cogsBreakdown.reduce((sum, i) => sum + i.qtySold, 0)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₱
                              {totalLineIngredientsCogs.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₱
                              {totalLineSuppliesCogs.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                              ₱
                              {totalLineCogs.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>

                          {/* Order packaging (takeout) */}
                          <tr>
                            <td style={{ fontWeight: 600 }}>Order packaging (takeout)</td>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              ₱
                              {orderPackagingCogs.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 600,
                                color: 'var(--danger)',
                              }}
                            >
                              ₱
                              {orderPackagingCogs.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>

                          {/* Refunded orders (wastage) */}
                          {refundedCogsWastage > 0 && (
                            <tr>
                              <td style={{ fontWeight: 600, color: 'var(--warning, #e67e22)' }}>
                                Refunded orders (wastage)
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--danger)',
                                }}
                              >
                                ₱
                                {refundedCogsWastage.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          )}

                          {/* Total COGS */}
                          <tr className="table-total-row">
                            <td colSpan={4} style={{ fontWeight: 700 }}>
                              Total COGS
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: 'var(--danger)',
                              }}
                            >
                              ₱
                              {totalCogs.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* SECTION 2: OPERATING EXPENSES */}
                <div className="card">
                  <div className="report-section-header">
                    <h3 className="report-section-title">
                      <Receipt size={16} color="var(--primary)" />
                      SECTION 2: OPERATING EXPENSES
                    </h3>
                  </div>
                  {operatingExpensesByCategory.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                      <p style={{ fontSize: '0.85rem' }}>
                        No operating expenses recorded for selected period.
                      </p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Expense Category</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {operatingExpensesByCategory.map((cat, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{cat.category}</td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: 'var(--danger)',
                                }}
                              >
                                ₱
                                {cat.amount.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                          <tr className="table-total-row">
                            <td style={{ fontWeight: 700 }}>Total Operating Expenses</td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: 'var(--danger)',
                              }}
                            >
                              ₱
                              {totalOperatingExpenses.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                TAB 3: PROFIT SUMMARY (Exact Statement of Profit & Loss Format)
               ════════════════════════════════════════════════════════════ */}
            {tab === 'profit' && (
              <div className="income-statement-card">
                <div className="income-statement-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                      PROFIT SUMMARY
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Statement of Profit and Loss (Accounting Breakdown &amp; Performance Ratios)
                    </p>
                  </div>
                  <span
                    className={`badge ${isNetProfitPositive ? 'badge-success' : 'badge-danger'}`}
                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  >
                    {isNetProfitPositive ? '● Profitable Period' : '● Operating at Loss'}
                  </span>
                </div>

                <table className="income-statement-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: '55%' }}>DETAILS</th>
                      <th style={{ textAlign: 'right', width: '25%' }}>AMOUNT</th>
                      <th style={{ textAlign: 'right', width: '20%' }}>% OF NET SALES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* GROSS SALES */}
                    <tr>
                      <td className="income-statement-row-label">GROSS SALES</td>
                      <td className="income-statement-val val-positive">
                        {formatAccountingNumber(grossSales, false, true)}
                      </td>
                      <td className="income-statement-pct">
                        {netSales > 0 ? `${((grossSales / netSales) * 100).toFixed(2)}%` : '0.00%'}
                      </td>
                    </tr>

                    {/* LESS: DISCOUNT */}
                    <tr>
                      <td className="income-statement-row-label indent">LESS: DISCOUNT</td>
                      <td className="income-statement-val val-negative">
                        {formatAccountingNumber(totalDiscounts, true, false)}
                      </td>
                      <td className="income-statement-pct" style={{ color: 'var(--danger)' }}>
                        {netSales > 0 ? `(${((totalDiscounts / netSales) * 100).toFixed(2)}%)` : '0.00%'}
                      </td>
                    </tr>

                    {/* NET SALES */}
                    <tr className="income-statement-subtotal-row">
                      <td className="income-statement-row-label">NET SALES</td>
                      <td className="income-statement-val val-positive">
                        {formatAccountingNumber(netSales, false, false)}
                      </td>
                      <td className="income-statement-pct" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        100.00%
                      </td>
                    </tr>

                    {/* LESS: COST OF GOODS SOLD */}
                    <tr>
                      <td className="income-statement-row-label indent">
                        LESS: PRODUCT COGS (RECIPES &amp; SUPPLIES)
                      </td>
                      <td className="income-statement-val val-negative">
                        {formatAccountingNumber(totalLineCogs, true, false)}
                      </td>
                      <td className="income-statement-pct" style={{ color: 'var(--danger)' }}>
                        {netSales > 0 ? `(${((totalLineCogs / netSales) * 100).toFixed(2)}%)` : '0.00%'}
                      </td>
                    </tr>

                    {/* ORDER PACKAGING */}
                    {orderPackagingCogs > 0 && (
                      <tr>
                        <td className="income-statement-row-label indent" style={{ paddingLeft: 32 }}>
                          Order Packaging (Takeout)
                        </td>
                        <td className="income-statement-val val-negative">
                          {formatAccountingNumber(orderPackagingCogs, true, false)}
                        </td>
                        <td className="income-statement-pct" style={{ color: 'var(--danger)' }}>
                          {netSales > 0 ? `(${((orderPackagingCogs / netSales) * 100).toFixed(2)}%)` : '0.00%'}
                        </td>
                      </tr>
                    )}

                    {/* REFUNDED INVENTORY WASTAGE */}
                    {refundedCogsWastage > 0 && (
                      <tr>
                        <td className="income-statement-row-label indent" style={{ paddingLeft: 32, color: 'var(--warning, #e67e22)' }}>
                          Refunded Orders (Wastage COGS)
                        </td>
                        <td className="income-statement-val val-negative">
                          {formatAccountingNumber(refundedCogsWastage, true, false)}
                        </td>
                        <td className="income-statement-pct" style={{ color: 'var(--danger)' }}>
                          {netSales > 0 ? `(${((refundedCogsWastage / netSales) * 100).toFixed(2)}%)` : '0.00%'}
                        </td>
                      </tr>
                    )}

                    {/* TOTAL COGS */}
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td className="income-statement-row-label indent" style={{ fontWeight: 700 }}>
                        TOTAL COST OF GOODS SOLD
                      </td>
                      <td className="income-statement-val val-negative" style={{ fontWeight: 700 }}>
                        {formatAccountingNumber(totalCogs, true, false)}
                      </td>
                      <td className="income-statement-pct" style={{ fontWeight: 700, color: 'var(--danger)' }}>
                        {netSales > 0 ? `(${cogsPct.toFixed(2)}%)` : '0.00%'}
                      </td>
                    </tr>

                    {/* GROSS PROFIT */}
                    <tr className="income-statement-subtotal-row">
                      <td className="income-statement-row-label">GROSS PROFIT</td>
                      <td className="income-statement-val val-positive">
                        {formatAccountingNumber(grossProfit, false, false)}
                      </td>
                      <td className="income-statement-pct" style={{ fontWeight: 700, color: grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {grossMarginPct.toFixed(2)}%
                      </td>
                    </tr>

                    {/* LESS: OPERATING EXPENSES */}
                    <tr>
                      <td className="income-statement-row-label indent">
                        LESS: OPERATING EXPENSES
                      </td>
                      <td className="income-statement-val val-negative">
                        {formatAccountingNumber(totalOperatingExpenses, true, false)}
                      </td>
                      <td className="income-statement-pct" style={{ color: 'var(--danger)' }}>
                        {netSales > 0 ? `(${opexPct.toFixed(2)}%)` : '0.00%'}
                      </td>
                    </tr>

                    {/* FINAL ROW: NET PROFIT or NET LOSS */}
                    <tr className="income-statement-final-row">
                      <td
                        className="income-statement-row-label"
                        style={{ fontSize: '1.05rem', fontWeight: 800 }}
                      >
                        {isNetProfitPositive ? 'NET PROFIT' : 'NET LOSS'}
                      </td>
                      <td
                        className={`income-statement-val ${
                          isNetProfitPositive ? 'val-positive' : 'val-negative'
                        }`}
                        style={{ fontSize: '1.15rem', fontWeight: 800 }}
                      >
                        <span className={`double-underline ${isNetProfitPositive ? '' : 'loss'}`}>
                          {isNetProfitPositive
                            ? formatAccountingNumber(netProfit, false, true)
                            : formatAccountingNumber(netProfit, true, true)}
                        </span>
                      </td>
                      <td
                        className="income-statement-pct"
                        style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: isNetProfitPositive ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {netMarginPct.toFixed(2)}%
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Break-even helper row */}
                {breakEvenSales != null && (
                  <div className="income-statement-break-even">
                    <div>
                      <div className="break-even-title">
                        <DollarSign size={16} color="var(--primary)" />
                        <span>Break-Even Sales Target</span>
                      </div>
                      <div className="break-even-desc">
                        Target sales to fully cover period operating expenses at current {grossMarginPct.toFixed(1)}% gross margin
                      </div>
                    </div>
                    <div className="break-even-amount">
                      ₱{breakEvenSales.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Void Modal */}
      <AnimatePresence>
        {voidModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVoidModal(false)}
          >
            <motion.div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>Void or Refund Transaction</h3>
                <button
                  className="btn btn-icon btn-ghost"
                  onClick={() => setVoidModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Action</label>
                  <select
                    className="input select"
                    value={voidType}
                    onChange={(e) => setVoidType(e.target.value as any)}
                  >
                    <option value="voided">Void Order (Restores raw ingredient stock)</option>
                    <option value="refunded">Refund Order (Keeps raw ingredient stock deducted)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g. Customer returned items / Spilled drink"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => setVoidModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleConfirmVoid}
                  disabled={savingVoid}
                >
                  {savingVoid ? (
                    <span className="spinner-sm" />
                  ) : (
                    <>
                      <RotateCcw size={15} /> Confirm
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Order Items Popover / Inspector */}
      <AnimatePresence>
        {inspectedSale && (
          <div
            className="sale-items-floating-popover-portal"
            style={{
              position: 'fixed',
              top: Math.max(12, inspectedSale.pos?.top ?? 100),
              left: Math.max(12, inspectedSale.pos?.left ?? 100),
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handleItemsMouseLeave}
          >
            <motion.div
              className="sale-items-popover-card"
              initial={{ opacity: 0, scale: 0.94, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {/* Popover Header */}
              <div className="popover-card-header">
                <div className="popover-header-left">
                  <div className="popover-icon-box">
                    <ShoppingBag size={14} />
                  </div>
                  <div>
                    <div className="popover-title">Items Breakdown</div>
                    <div className="popover-sale-code">
                      <span>{inspectedSale.sale.id}</span>
                      <span className="popover-order-type-tag">
                        {inspectedSale.sale.orderType === 'takeout' ? 'Takeout' : 'Dine-In'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="popover-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectedSale(null);
                  }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Popover Items List */}
              <div className="popover-items-list">
                {(!Array.isArray(inspectedSale.sale.items) || inspectedSale.sale.items.length === 0) ? (
                  <div className="popover-empty-items">No item breakdown recorded for this transaction.</div>
                ) : (
                  inspectedSale.sale.items.map((it: any, idx: number) => {
                    const name = it.name || it.product?.name || 'Menu Item';
                    const qty = Number(it.qty || 1);
                    const price = Number(it.price || it.unit_price || it.product?.price || 0);
                    const sizeName = it.size_name || null;
                    const addons = Array.isArray(it.addons) ? it.addons : [];
                    const note = it.note || null;
                    const lineTotal = price * qty;

                    return (
                      <div key={idx} className="popover-item-row">
                        <div className="popover-item-qty">{qty}×</div>
                        <div className="popover-item-info">
                          <div className="popover-item-name">{name}</div>
                          {sizeName && (
                            <span className="popover-item-size">{sizeName}</span>
                          )}
                          {addons.length > 0 && (
                            <div className="popover-item-addons">
                              {addons.map((a: any, aIdx: number) => (
                                <span key={aIdx} className="addon-chip">
                                  +{a.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {note && (
                            <div className="popover-item-note">"{note}"</div>
                          )}
                        </div>
                        <div className="popover-item-price">
                          ₱{lineTotal.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Popover Footer Summary */}
              <div className="popover-card-footer">
                <div className="popover-footer-row">
                  <span>Total Items:</span>
                  <strong>{getItemCount(inspectedSale.sale.items)}</strong>
                </div>
                <div className="popover-footer-row total">
                  <span>Total Paid:</span>
                  <strong>
                    ₱
                    {Number(inspectedSale.sale.total).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
                <div className="popover-touch-hint">
                  💡 Touchscreen: Tap or hold number of items to toggle
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
