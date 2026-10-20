import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Package,
  ShoppingCart,
  DollarSign,
  Coins,
  Award,
  Image as ImageIcon,
  FileDown,
  FileSpreadsheet,
  Download,
  ChevronDown,
  Share2,
  X
} from 'lucide-react';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import PageHeader from '../../components/dashboard/PageHeader';
import {
  InvoiceSheet,
  InvoicePages,
  buildInvoiceData,
  paginateInvoice,
} from '../../components/dashboard/SalesInvoice';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getSales } from '../../services/transactionService';
import { APPLICATION_EXCHANGE_RATE, calculateEquivalentTotals } from '../../utils/currency';
import { normalizeSaleFromApi, resolveUnitPrice, formatDisplayDate, formatLocalDate } from '../../utils/sales';
import { buildDashboardProfile } from '../../utils/profile';
import './HistoryScreen.css';

const EXCHANGE_RATE = APPLICATION_EXCHANGE_RATE || 4050;

const PIE_COLOR_VARS = [
  'var(--pie-color-1)',
  'var(--pie-color-2)',
  'var(--pie-color-3)',
  'var(--pie-color-4)',
  'var(--pie-color-5)',
  'var(--pie-color-6)',
];
const PIE_OTHER_COLOR_VAR = 'var(--pie-color-other)';
const PIE_MAX_SLOTS = 6;

// The transactions API caps a page at 200 rows, so "All Time" needs every page.
const SALES_PAGE_SIZE = 200;
const SALES_MAX_PAGES = 50;

// "▲ 12% vs last week" under a stat. `change` is a percentage, 'new' when the
// previous period had nothing, or null to show nothing.
function TrendBadge({ change, label, newLabel }) {
  if (change == null) return null;
  if (change === 'new') {
    return <span className="stat-trend up">▲ {newLabel}</span>;
  }
  const rounded = Math.round(change);
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  const arrow = { up: '▲', down: '▼', flat: '–' }[direction];
  return (
    <span className={`stat-trend ${direction}`}>
      {arrow} {Math.abs(rounded)}% <span className="stat-trend-label">{label}</span>
    </span>
  );
}

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isKm = language !== 'en';

  const [period, setPeriod] = useState('today'); // 'today' | 'week' | 'month' | 'all'
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hoveredShareIndex, setHoveredShareIndex] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const reportRef = useRef(null);
  const invoiceSheetRef = useRef(null);
  const invoicePagesRef = useRef(null);
  // null = nothing rendered; { pages: null } = continuous sheet only;
  // { pages: [...] } = sheet plus paginated A4 pages for the PDF.
  const [invoiceStage, setInvoiceStage] = useState(null);
  // Invoice file waiting for a second tap to share (see shareInvoiceFile).
  const [pendingShare, setPendingShare] = useState(null);
  // The trend chart is drawn at its real on-screen width so its labels aren't
  // squashed horizontally on phones.
  const chartWrapRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(700);
  const narrowChart = chartWidth < 500;

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const shareMenuRef = useRef(null);
  // Invoice language: null follows the app language until the user picks one.
  const [invoiceLang, setInvoiceLang] = useState(null);
  const invoiceIsKm = invoiceLang ? invoiceLang === 'km' : isKm;

  const closeMenus = () => {
    setIsExportMenuOpen(false);
    setIsShareMenuOpen(false);
  };

  useEffect(() => {
    if (!isExportMenuOpen && !isShareMenuOpen) return undefined;
    const handleOutside = (event) => {
      const inside = [exportMenuRef, shareMenuRef].some((ref) => ref.current?.contains(event.target));
      if (!inside) closeMenus();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') closeMenus();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExportMenuOpen, isShareMenuOpen]);

  // Fetch real-time sales directly from backend
  useEffect(() => {
    let isMounted = true;
    const fetchSales = async () => {
      setLoading(true);
      try {
        const allSales = [];
        for (let page = 0; page < SALES_MAX_PAGES; page += 1) {
          const res = await getSales({ limit: SALES_PAGE_SIZE, offset: page * SALES_PAGE_SIZE });
          const rows = Array.isArray(res?.data) ? res.data : [];
          allSales.push(...rows);
          if (rows.length < SALES_PAGE_SIZE) break;
        }
        if (isMounted) {
          setSales(allSales.map(normalizeSaleFromApi));
        }
      } catch (err) {
        console.error('Failed to load history sales:', err);
        try {
          const cached = JSON.parse(localStorage.getItem('kotchomnol_sales') || '[]');
          if (isMounted) setSales(cached.map(normalizeSaleFromApi));
        } catch {
          // ignore cache errors
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSales();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute analytics dynamically based on active period
  const {
    totalUSD,
    totalKHR,
    salesCount,
    totalProductsSold,
    productBreakdown,
    weeklyBars,
    filteredSales,
    comparison
  } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = (startOfWeek.getDay() + 6) % 7; // Monday = 0
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter sales according to period
    const filtered = sales.filter((item) => {
      const d = new Date(item.date || item.createdAt || Date.now());
      if (period === 'today') return d >= startOfToday;
      if (period === 'week') return d >= startOfWeek;
      if (period === 'month') return d >= startOfMonth;
      return true;
    });

    // The same stretch of the previous period, so a half-finished week is
    // compared with the same days of last week rather than all of it.
    const shiftDays = (date, days) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };
    const startOfTomorrow = shiftDays(startOfToday, 1);
    const prevRange = {
      today: [shiftDays(startOfToday, -1), startOfToday],
      week: [shiftDays(startOfWeek, -7), shiftDays(startOfTomorrow, -7)],
      month: [
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(Math.min(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1), startOfMonth)),
      ],
    }[period];

    const summarize = (list) => list.reduce(
      (acc, s) => {
        acc.revenue += Number(s.totalUSD || 0) + Number(s.totalKHR || 0) / EXCHANGE_RATE;
        acc.products += (s.items || []).reduce((sum, it) => sum + Number(it.quantity || 1), 0);
        acc.count += 1;
        return acc;
      },
      { revenue: 0, products: 0, count: 0 }
    );

    let comparisonResult = null;
    if (prevRange) {
      const [prevStart, prevEnd] = prevRange;
      const prev = summarize(sales.filter((s) => {
        const d = new Date(s.date || s.createdAt || Date.now());
        return d >= prevStart && d < prevEnd;
      }));
      const cur = summarize(filtered);
      const change = (c, p) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 'new' : null);
      comparisonResult = {
        revenue: change(cur.revenue, prev.revenue),
        products: change(cur.products, prev.products),
        count: change(cur.count, prev.count),
      };
    }

    let rawUsd = 0;
    let rawKhr = 0;
    let productsCount = 0;
    const itemMap = {};

    filtered.forEach((sale) => {
      rawUsd += Number(sale.totalUSD || 0);
      rawKhr += Number(sale.totalKHR || 0);

      if (Array.isArray(sale.items)) {
        sale.items.forEach((it) => {
          const name = it.product || it.description || (isKm ? 'ទំនិញទូទៅ' : 'General Item');
          const qty = Number(it.quantity || 1);
          productsCount += qty;

          const unitPrice = resolveUnitPrice(it);
          const currency = it.currency || (it.unitPriceKHR || it.totalKHR ? 'KHR' : 'USD');
          let amountUSD = 0;
          let amountKHR = 0;

          if (currency === 'USD') {
            amountUSD = it.amount ? Number(it.amount) : qty * unitPrice;
            amountKHR = amountUSD * EXCHANGE_RATE;
          } else {
            amountKHR = it.amount ? Number(it.amount) : qty * unitPrice;
            amountUSD = amountKHR / EXCHANGE_RATE;
          }

          if (!itemMap[name]) {
            itemMap[name] = { name, qty: 0, totalUSD: 0, totalKHR: 0 };
          }
          itemMap[name].qty += qty;
          itemMap[name].totalUSD += amountUSD;
          itemMap[name].totalKHR += amountKHR;
        });
      }
    });

    // Unify totals via standard exchange rate
    const unified = calculateEquivalentTotals({
      usd: rawUsd,
      khr: rawKhr,
      exchangeRate: EXCHANGE_RATE,
    });

    // 7-day Weekly Trend (Mon - Sun of current week)
    const days = [
      { label: isKm ? 'ច័ន្ទ' : 'Mon', index: 0 },
      { label: isKm ? 'អង្គារ' : 'Tue', index: 1 },
      { label: isKm ? 'ពុធ' : 'Wed', index: 2 },
      { label: isKm ? 'ព្រហ' : 'Thu', index: 3 },
      { label: isKm ? 'សុក្រ' : 'Fri', index: 4 },
      { label: isKm ? 'សៅរ៍' : 'Sat', index: 5 },
      { label: isKm ? 'អាទិត្យ' : 'Sun', index: 6 }
    ];

    const weeklyAmounts = [0, 0, 0, 0, 0, 0, 0];
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    sales.forEach((s) => {
      const d = new Date(s.date || s.createdAt || Date.now());
      if (d >= startOfWeek && d < endOfWeek) {
        const dayIdx = (d.getDay() + 6) % 7;
        const sUsd = Number(s.totalUSD || 0);
        const sKhr = Number(s.totalKHR || 0);
        weeklyAmounts[dayIdx] += sUsd + (sKhr / EXCHANGE_RATE);
      }
    });

    let trend = days.map((d) => ({ label: d.label, value: weeklyAmounts[d.index] }));

    // All Time: one point per month instead of this week's days. Starts at the
    // first month with sales, showing at least 6 and at most the last 12 months.
    if (period === 'all') {
      const monthNames = isKm
        ? ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();
      const currentMonth = monthIndex(now);
      const earliestMonth = sales.reduce(
        (min, s) => Math.min(min, monthIndex(new Date(s.date || s.createdAt || Date.now()))),
        currentMonth
      );
      // Phones have room for 6 readable month labels, wider screens for 12.
      const maxMonths = narrowChart ? 6 : 12;
      const firstMonth = Math.min(Math.max(earliestMonth, currentMonth - (maxMonths - 1)), currentMonth - 5);

      const monthlyAmounts = new Array(currentMonth - firstMonth + 1).fill(0);
      sales.forEach((s) => {
        const slot = monthIndex(new Date(s.date || s.createdAt || Date.now())) - firstMonth;
        if (slot >= 0 && slot < monthlyAmounts.length) {
          monthlyAmounts[slot] += Number(s.totalUSD || 0) + (Number(s.totalKHR || 0) / EXCHANGE_RATE);
        }
      });

      const spansYears = Math.floor(firstMonth / 12) !== Math.floor(currentMonth / 12);
      trend = monthlyAmounts.map((value, i) => {
        const m = firstMonth + i;
        const name = monthNames[m % 12];
        return { label: spansYears ? `${name} ${String(Math.floor(m / 12)).slice(-2)}` : name, value };
      });
    }

    const maxVal = Math.max(...trend.map((b) => b.value), 1);
    const bars = trend.map((b) => ({
      ...b,
      percent: Math.max(8, Math.round((b.value / maxVal) * 100))
    }));

    // Primary ranking by volume (quantity); Secondary ranking by revenue
    const sortedProducts = Object.values(itemMap).sort((a, b) => {
      if (b.qty !== a.qty) {
        return b.qty - a.qty;
      }
      return b.totalUSD - a.totalUSD;
    });

    return {
      totalUSD: unified.totalUSD,
      totalKHR: unified.totalKHR,
      salesCount: filtered.length,
      totalProductsSold: productsCount,
      productBreakdown: sortedProducts,
      weeklyBars: bars,
      filteredSales: filtered,
      comparison: comparisonResult
    };
  }, [sales, period, isKm, narrowChart]);

  const comparisonLabel = {
    today: isKm ? 'ធៀបម្សិលមិញ' : 'vs yesterday',
    week: isKm ? 'ធៀបសប្តាហ៍មុន' : 'vs last week',
    month: isKm ? 'ធៀបខែមុន' : 'vs last month',
  }[period];

  // Revenue share per product, capped to a readable number of slices with the
  // remainder folded into "Other" so the donut always sums to 100%.
  const productShare = useMemo(() => {
    const sortedByRevenue = [...productBreakdown].sort((a, b) => b.totalUSD - a.totalUSD);
    const totalRevenue = sortedByRevenue.reduce((sum, p) => sum + p.totalUSD, 0);
    const topSlots = sortedByRevenue.slice(0, PIE_MAX_SLOTS);
    const rest = sortedByRevenue.slice(PIE_MAX_SLOTS);

    const toShare = (p, colorVar) => ({
      name: p.name,
      qty: p.qty,
      totalUSD: p.totalUSD,
      percent: totalRevenue > 0 ? (p.totalUSD / totalRevenue) * 100 : 0,
      colorVar,
    });

    const slices = topSlots.map((p, idx) => toShare(p, PIE_COLOR_VARS[idx]));

    if (rest.length > 0) {
      const restQty = rest.reduce((sum, p) => sum + p.qty, 0);
      const restUSD = rest.reduce((sum, p) => sum + p.totalUSD, 0);
      slices.push(
        toShare(
          { name: isKm ? 'ផ្សេងទៀត' : 'Other', qty: restQty, totalUSD: restUSD },
          PIE_OTHER_COLOR_VAR
        )
      );
    }

    return { slices, totalRevenue };
  }, [productBreakdown, isKm]);

  useEffect(() => {
    setHoveredShareIndex(null);
  }, [productShare]);

  // SVG donut geometry: each slice is a dashed arc on a shared circle,
  // offset to sit right after the previous one with a small surface gap.
  const donutGeometry = useMemo(() => {
    const size = 200;
    const strokeWidth = 30;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const gap = productShare.slices.length > 1 ? 4 : 0;

    let cumulative = 0;
    const arcs = productShare.slices.map((slice) => {
      const rawLength = (slice.percent / 100) * circumference;
      const segLength = Math.max(rawLength - gap, 0);
      const dashArray = `${segLength} ${Math.max(circumference - segLength, 0)}`;
      const dashOffset = -cumulative;
      cumulative += rawLength;
      return { ...slice, dashArray, dashOffset };
    });

    return { size, strokeWidth, radius, arcs };
  }, [productShare]);

  // Precompute pixel-accurate points for the SVG line chart
  const chartPoints = useMemo(() => {
    // Matches the SVG's rendered size (CSS height is 240px), so 1 unit = 1px.
    const width = chartWidth;
    const height = 240;
    const padX = narrowChart ? 22 : 34;
    const top = 36;
    const bottom = height - 46;

    const values = weeklyBars.map((b) => b.value);
    const maxVal = Math.max(...values, 1);
    const stepX = weeklyBars.length > 1 ? (width - padX * 2) / (weeklyBars.length - 1) : 0;

    const points = weeklyBars.map((b, i) => ({
      ...b,
      x: padX + i * stepX,
      y: bottom - (b.value / maxVal) * (bottom - top),
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

    const areaPath = points.length
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${bottom} L${points[0].x.toFixed(1)},${bottom} Z`
      : '';

    return { points, linePath, areaPath, width, height, top, bottom };
  }, [weeklyBars, chartWidth, narrowChart]);

  const formatChartValue = (value) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    if (value >= 100) return `$${Math.round(value)}`;
    return `$${value.toFixed(1)}`;
  };

  const periodLabel = period === 'today'
    ? (isKm ? 'ថ្ងៃនេះ' : 'Today')
    : period === 'week'
      ? (isKm ? 'របាយការណ៍ប្រចាំសប្តាហ៍' : 'Weekly Report')
      : period === 'month'
        ? (isKm ? 'របាយការណ៍ប្រចាំខែ' : 'Monthly Report')
        : (isKm ? 'របាយការណ៍សរុប' : 'Overall Report');

  const reportDateLabel = formatDisplayDate(new Date(), isKm ? 'km' : 'en');

  // Header details for the exported invoice.
  const invoiceMeta = useMemo(() => {
    const km = invoiceIsKm;
    const lang = km ? 'km' : 'en';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const earliest = sales.reduce((min, s) => {
      const d = new Date(s.date || s.createdAt || Date.now());
      return d < min ? d : min;
    }, startOfToday);

    const rangeStart = { today: startOfToday, week: startOfWeek, month: startOfMonth, all: earliest }[period];
    const rangeLabel = rangeStart >= startOfToday
      ? formatDisplayDate(now, lang)
      : `${formatDisplayDate(rangeStart, lang)} – ${formatDisplayDate(now, lang)}`;

    const periodLabels = {
      today: km ? 'ថ្ងៃនេះ' : 'Today',
      week: km ? 'សប្តាហ៍នេះ' : 'This week',
      month: km ? 'ខែនេះ' : 'This month',
      all: km ? 'ទាំងអស់' : 'All time',
    };

    const profile = buildDashboardProfile(user, { name: '', firstName: '', lastName: '', businessName: '', phone: '', email: '' });
    const ownerName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || '';

    const time = now.toLocaleTimeString(km ? 'km-KH' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const periodCode = { today: 'D', week: 'W', month: 'M', all: 'A' }[period];

    return {
      shopName: profile.businessName || ownerName || (km ? 'ហាងរបស់ខ្ញុំ' : 'My Shop'),
      ownerName,
      phone: profile.phone,
      email: profile.email,
      invoiceNo: `INV-${formatLocalDate(now).replace(/-/g, '')}-${periodCode}`,
      issuedLabel: formatDisplayDate(now, lang),
      periodLabel: periodLabels[period],
      rangeLabel,
      exchangeRate: EXCHANGE_RATE,
      generatedLabel: `${formatDisplayDate(now, lang)} ${time}`,
    };
  }, [period, sales, invoiceIsKm, user]);

  const invoiceData = useMemo(
    () => buildInvoiceData(filteredSales, { isKm: invoiceIsKm, exchangeRate: EXCHANGE_RATE }),
    [filteredSales, invoiceIsKm]
  );

  const exportFileName = (ext) => `kotchomnol_invoice_${period}_${formatLocalDate(new Date())}.${ext}`;

  // The invoice sits off-screen in the page; bring it into view in the cloned
  // document html2canvas renders from.
  const captureInvoice = (element, scale) =>
    html2canvas(element, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc) => {
        const holder = doc.querySelector('.inv-offscreen');
        if (holder) holder.style.left = '0';
      },
    });

  const prepareInvoice = async (stage) => {
    flushSync(() => setInvoiceStage(stage));
    if (document.fonts?.ready) await document.fonts.ready;
  };

  const renderInvoiceImage = async () => {
    await prepareInvoice({ pages: null });
    const sheet = invoiceSheetRef.current;
    // Keep very long invoices under mobile browsers' canvas size limits.
    const { width, height } = sheet.getBoundingClientRect();
    const scale = Math.min(2, Math.sqrt(16_000_000 / (width * height)), 30_000 / height);
    return captureInvoice(sheet, scale);
  };

  const handleDownloadImage = async (format) => {
    if (exporting) return;
    closeMenus();
    setExporting(true);
    try {
      const canvas = await renderInvoiceImage();
      const link = document.createElement('a');
      link.download = exportFileName(format);
      link.href = canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
      link.click();
    } catch (err) {
      console.error('Failed to export invoice image:', err);
    } finally {
      setInvoiceStage(null);
      setExporting(false);
    }
  };

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Opens the phone's share sheet (Telegram, Messenger, ...). Browsers that
  // can't share files get a normal download instead.
  const shareInvoiceFile = async (file) => {
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: invoiceMeta.shopName });
        setPendingShare(null);
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          setPendingShare(null);
          return;
        }
        // Some browsers (notably iOS Safari) only allow sharing straight from
        // a tap, and rendering the invoice took too long. Ask for one more tap.
        if (err.name === 'NotAllowedError') {
          setPendingShare(file);
          return;
        }
        console.error('Share failed, downloading instead:', err);
      }
    }
    setPendingShare(null);
    downloadFile(file);
  };

  // format: 'png' (previews right in the chat) or 'pdf' (sent as a document).
  const handleShareInvoice = async (format) => {
    if (exporting) return;
    closeMenus();
    setExporting(true);
    let file = null;
    try {
      let blob;
      if (format === 'pdf') {
        const pdf = await renderInvoicePdf();
        blob = pdf.output('blob');
      } else {
        const canvas = await renderInvoiceImage();
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      }
      const type = format === 'pdf' ? 'application/pdf' : 'image/png';
      file = new File([blob], exportFileName(format), { type });
    } catch (err) {
      console.error('Failed to prepare invoice for sharing:', err);
    } finally {
      setInvoiceStage(null);
      setExporting(false);
    }
    if (file) await shareInvoiceFile(file);
  };

  const renderInvoicePdf = async () => {
    await prepareInvoice({ pages: null });
    const layout = paginateInvoice(invoiceSheetRef.current);
    await prepareInvoice({ pages: layout });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageEls = invoicePagesRef.current.querySelectorAll('[data-page]');

    for (let i = 0; i < pageEls.length; i += 1) {
      const canvas = await captureInvoice(pageEls[i], 2);
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, pageHeight);
    }
    return pdf;
  };

  const handleDownloadPDF = async () => {
    if (exporting) return;
    closeMenus();
    setExporting(true);
    try {
      const pdf = await renderInvoicePdf();
      pdf.save(exportFileName('pdf'));
    } catch (err) {
      console.error('Failed to export invoice PDF:', err);
    } finally {
      setInvoiceStage(null);
      setExporting(false);
    }
  };

  const csvEscape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const handleDownloadTable = () => {
    if (exporting) return;
    closeMenus();
    const headerRow = isKm
      ? ['កាលបរិច្ឆេទ', 'ផលិតផល', 'ចំនួន', 'តម្លៃឯកតា', 'រូបិយប័ណ្ណ', 'សរុប']
      : ['Date', 'Product', 'Quantity', 'Unit Price', 'Currency', 'Total'];

    const rows = [headerRow];
    filteredSales.forEach((sale) => {
      const dateLabel = formatDisplayDate(sale.date, isKm ? 'km' : 'en');
      (sale.items || []).forEach((item) => {
        const qty = Number(item.quantity || 0);
        const unitPrice = resolveUnitPrice(item);
        const currency = item.currency || 'KHR';
        const total = item.amount ? Number(item.amount) : qty * unitPrice;
        rows.push([
          dateLabel,
          item.product || item.description || '',
          qty,
          unitPrice.toFixed(2),
          currency,
          total.toFixed(2),
        ]);
      });
    });

    // BOM prefix so Excel detects UTF-8 and renders Khmer text correctly.
    const csvContent = '﻿' + rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kotchomnol_${period}-report_${formatLocalDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Shown at the top of the Share and Export menus. The invoice can be in a
  // different language from the app, e.g. an English UI sending a Khmer invoice.
  const invoiceLangToggle = (
    <div className="invoice-lang-row">
      <span>{isKm ? 'ភាសាវិក្កយបត្រ' : 'Invoice language'}</span>
      <div className="invoice-lang-toggle" role="group">
        {[['km', 'ខ្មែរ'], ['en', 'EN']].map(([code, label]) => (
          <button
            key={code}
            type="button"
            className={(invoiceIsKm ? 'km' : 'en') === code ? 'active' : ''}
            aria-pressed={(invoiceIsKm ? 'km' : 'en') === code}
            onClick={() => setInvoiceLang(code)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <MobileAppShell
      activeTab="history"
      header={
        <PageHeader
          icon={<BarChart3 size={18} />}
          title={isKm ? 'ផ្ទាំងគ្រប់គ្រង & ការវិភាគ' : 'Dashboard & Analytics'}
          subtitle={
            isKm
              ? 'នេះជាសង្ខេបអាជីវកម្ម និងក្រាហ្វវិភាគទិន្នន័យជាក់ស្តែងរបស់អ្នក'
              : 'Here is your real-time business performance and sales analytics.'
          }
        />
      }
    >
      <div className="analytics-page-wrapper font-kantumruy">
        {/* Filter Period Pills + Export */}
        <div className="analytics-filter-bar">
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill ${period === 'today' ? 'active' : ''}`}
              onClick={() => setPeriod('today')}
            >
              {isKm ? 'ថ្ងៃនេះ' : 'Today'}
            </button>
            <button
              type="button"
              className={`filter-pill ${period === 'week' ? 'active' : ''}`}
              onClick={() => setPeriod('week')}
            >
              {isKm ? 'សប្តាហ៍នេះ' : 'This Week'}
            </button>
            <button
              type="button"
              className={`filter-pill ${period === 'month' ? 'active' : ''}`}
              onClick={() => setPeriod('month')}
            >
              {isKm ? 'ខែនេះ' : 'This Month'}
            </button>
            <button
              type="button"
              className={`filter-pill ${period === 'all' ? 'active' : ''}`}
              onClick={() => setPeriod('all')}
            >
              {isKm ? 'ទាំងអស់' : 'All Time'}
            </button>
          </div>

          <div className="export-actions">
          <div className="export-dropdown" ref={shareMenuRef}>
            <button
              type="button"
              className="share-trigger"
              onClick={() => {
                setIsExportMenuOpen(false);
                setIsShareMenuOpen((open) => !open);
              }}
              aria-haspopup="true"
              aria-expanded={isShareMenuOpen}
              disabled={exporting}
            >
              <Share2 size={16} />
              {isKm ? 'ចែករំលែក' : 'Share'}
            </button>

            {isShareMenuOpen && (
              <div className="export-dropdown-menu" role="menu">
                {invoiceLangToggle}
                <button
                  type="button"
                  className="export-dropdown-item"
                  onClick={() => handleShareInvoice('png')}
                  disabled={exporting}
                >
                  <span className="export-option-icon share"><ImageIcon size={15} /></span>
                  <span className="export-dropdown-item-text">
                    <span className="export-option-label">{isKm ? 'ជារូបភាព' : 'As image'}</span>
                    <span className="export-option-hint plain">{isKm ? 'បង្ហាញភ្លាមក្នុង Telegram' : 'Previews in Telegram chats'}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="export-dropdown-item"
                  onClick={() => handleShareInvoice('pdf')}
                  disabled={exporting}
                >
                  <span className="export-option-icon pdf"><FileDown size={15} /></span>
                  <span className="export-dropdown-item-text">
                    <span className="export-option-label">{isKm ? 'ជា PDF' : 'As PDF'}</span>
                    <span className="export-option-hint plain">{isKm ? 'ឯកសារសម្រាប់បោះពុម្ព' : 'Document for printing'}</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="export-dropdown" ref={exportMenuRef}>
            <button
              type="button"
              className="export-dropdown-trigger"
              onClick={() => {
                setIsShareMenuOpen(false);
                setIsExportMenuOpen((open) => !open);
              }}
              aria-haspopup="true"
              aria-expanded={isExportMenuOpen}
              disabled={exporting}
            >
              <span className="export-dropdown-trigger-left">
                <Download size={14} />
                {exporting ? (isKm ? 'កំពុងទាញយក...' : 'Exporting...') : (isKm ? 'នាំចេញ' : 'Export')}
              </span>
              <ChevronDown size={14} className={`export-dropdown-chevron ${isExportMenuOpen ? 'open' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="export-dropdown-menu" role="menu">
                {invoiceLangToggle}
                <button
                  type="button"
                  className="export-dropdown-item"
                  onClick={handleDownloadTable}
                  disabled={exporting || filteredSales.length === 0}
                >
                  <span className="export-option-icon table"><FileSpreadsheet size={15} /></span>
                  <span className="export-dropdown-item-text">
                    <span className="export-option-label">{isKm ? 'តារាង (Excel)' : 'Table (Excel)'}</span>
                    <span className="export-option-hint">.csv</span>
                  </span>
                </button>
                {['png', 'jpg'].map((format) => (
                  <button
                    key={format}
                    type="button"
                    className="export-dropdown-item"
                    onClick={() => handleDownloadImage(format)}
                    disabled={exporting}
                  >
                    <span className="export-option-icon image"><ImageIcon size={15} /></span>
                    <span className="export-dropdown-item-text">
                      <span className="export-option-label">
                        {isKm ? 'រូបភាព' : 'Image'} ({format.toUpperCase()})
                      </span>
                      <span className="export-option-hint">.{format}</span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="export-dropdown-item"
                  onClick={handleDownloadPDF}
                  disabled={exporting}
                >
                  <span className="export-option-icon pdf"><FileDown size={15} /></span>
                  <span className="export-dropdown-item-text">
                    <span className="export-option-label">{isKm ? 'ឯកសារ' : 'PDF'}</span>
                    <span className="export-option-hint">.pdf</span>
                  </span>
                </button>
              </div>
            )}
          </div>
          </div>
        </div>

        <div className="analytics-report-capture" ref={reportRef}>
        <div className="report-brand-row">
          <span className="report-badge">KOTCHOMNOL {periodLabel.toUpperCase()}</span>
          <span className="report-date">{reportDateLabel}</span>
        </div>

        {/* 4-Column Stat Cards Across 1 Row */}
        <div className="analytics-four-grid">
          {/* Card 1: Total in KHR */}
          <div className="stat-tile-card">
            <div className="stat-icon-wrap amber">
              <Coins size={22} />
            </div>
            <div className="stat-tile-content">
              <span className="stat-tile-label">{isKm ? 'សរុបជារៀល (KHR)' : 'Total in KHR'}</span>
              <h3 className="stat-tile-val text-amber">{Math.round(totalKHR).toLocaleString()} ៛</h3>
              <TrendBadge change={comparison?.revenue} label={comparisonLabel} newLabel={isKm ? 'ថ្មី' : 'New'} />
            </div>
          </div>

          {/* Card 2: Total in USD */}
          <div className="stat-tile-card">
            <div className="stat-icon-wrap emerald">
              <DollarSign size={22} />
            </div>
            <div className="stat-tile-content">
              <span className="stat-tile-label">{isKm ? 'សរុបជាដុល្លារ (USD)' : 'Total in USD'}</span>
              <h3 className="stat-tile-val text-emerald">${totalUSD.toFixed(2)}</h3>
              <TrendBadge change={comparison?.revenue} label={comparisonLabel} newLabel={isKm ? 'ថ្មី' : 'New'} />
            </div>
          </div>

          {/* Card 3: Products Sold */}
          <div className="stat-tile-card">
            <div className="stat-icon-wrap violet">
              <Package size={22} />
            </div>
            <div className="stat-tile-content">
              <span className="stat-tile-label">{isKm ? 'មុខទំនិញលក់បាន' : 'Products Sold'}</span>
              <h3 className="stat-tile-val">{totalProductsSold} {isKm ? 'ឯកតា' : 'items'}</h3>
              <TrendBadge change={comparison?.products} label={comparisonLabel} newLabel={isKm ? 'ថ្មី' : 'New'} />
            </div>
          </div>

          {/* Card 4: Transactions */}
          <div className="stat-tile-card">
            <div className="stat-icon-wrap indigo">
              <ShoppingCart size={22} />
            </div>
            <div className="stat-tile-content">
              <span className="stat-tile-label">{isKm ? 'ចំនួនប្រតិបត្តិការ' : 'Transactions'}</span>
              <h3 className="stat-tile-val">{salesCount} {isKm ? 'លើក' : 'records'}</h3>
              <TrendBadge change={comparison?.count} label={comparisonLabel} newLabel={isKm ? 'ថ្មី' : 'New'} />
            </div>
          </div>
        </div>

        {/* Phones hide the "vs yesterday" text inside each card for space and
            say it once here instead. */}
        {comparison && (
          <p className="stat-trend-caption">
            {{
              today: isKm ? '▲▼ ការប្រែប្រួលធៀបនឹងម្សិលមិញ' : '▲▼ Change compared with yesterday',
              week: isKm ? '▲▼ ការប្រែប្រួលធៀបនឹងសប្តាហ៍មុន' : '▲▼ Change compared with last week',
              month: isKm ? '▲▼ ការប្រែប្រួលធៀបនឹងខែមុន' : '▲▼ Change compared with last month',
            }[period]}
          </p>
        )}

        {/* Analytics Charts & Summaries */}
        <div className="analytics-sections-grid">
          {/* Revenue Line Chart */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-header-left">
                <TrendingUp size={18} className="chart-header-icon" />
                <h3>
                  {period === 'all'
                    ? (isKm ? 'និន្នាការចំណូលប្រចាំខែ ($)' : 'Monthly Revenue Trend ($)')
                    : (isKm ? 'និន្នាការចំណូលប្រចាំសប្តាហ៍ ($)' : 'Weekly Revenue Trend ($)')}
                </h3>
              </div>
              <span className="chart-badge">
                {period === 'all'
                  ? (isKm ? `${weeklyBars.length} ខែចុងក្រោយ` : `Last ${weeklyBars.length} Months`)
                  : (isKm ? 'សប្តាហ៍នេះ' : 'This Week')}
              </span>
            </div>

            <div className="line-chart-wrap" ref={chartWrapRef}>
              <svg
                viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
                preserveAspectRatio="none"
                className="line-chart-svg"
              >
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 1, 2, 3].map((i) => {
                  const y = chartPoints.top + (i * (chartPoints.bottom - chartPoints.top)) / 3;
                  return (
                    <line
                      key={i}
                      x1={20}
                      x2={chartPoints.width - 20}
                      y1={y}
                      y2={y}
                      className="chart-grid-line"
                    />
                  );
                })}

                {/* Area + line */}
                <path d={chartPoints.areaPath} fill="url(#revenueFill)" />
                <path
                  d={chartPoints.linePath}
                  fill="none"
                  stroke="#7e22ce"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Points + labels */}
                {chartPoints.points.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.x} cy={p.y} r="5" className="chart-point" />
                    <text
                      x={p.x}
                      y={Math.max(14, p.y - 14)}
                      textAnchor="middle"
                      className="chart-point-value"
                    >
                      {formatChartValue(p.value)}
                    </text>
                    <text
                      x={p.x}
                      y={chartPoints.height - 12}
                      textAnchor="middle"
                      className="chart-point-day"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Product Share Breakdown */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-header-left">
                <PieChart size={18} className="chart-header-icon" />
                <h3>{isKm ? 'ចំណែកផលិតផល' : 'Product Share'}</h3>
              </div>
              <span className="chart-badge">{productBreakdown.length} {isKm ? 'មុខ' : 'items'}</span>
            </div>

            {productShare.slices.length === 0 ? (
              <div className="empty-chart-text">
                {isKm ? 'គ្មានទិន្នន័យទំនិញក្នុងកំឡុងពេលនេះទេ។' : 'No product sales recorded for this period.'}
              </div>
            ) : (
              <div className="product-donut-layout">
                <div className="product-donut-wrap">
                  <svg
                    viewBox={`0 0 ${donutGeometry.size} ${donutGeometry.size}`}
                    className="product-donut-svg"
                    role="img"
                    aria-label={isKm ? 'ក្រាហ្វិកចំណែកផលិតផលតាមចំណូល' : 'Product revenue share chart'}
                  >
                    <g transform={`rotate(-90 ${donutGeometry.size / 2} ${donutGeometry.size / 2})`}>
                      {donutGeometry.arcs.map((arc, idx) => {
                        const selectSlice = () =>
                          setHoveredShareIndex((prev) => (prev === idx ? null : idx));
                        return (
                          <g key={idx}>
                            {/* Wider invisible stroke so the slice stays easy to
                                tap on a phone even though the visible ring is thin.
                                Handles all interaction; the visible circle below is
                                purely decorative. */}
                            <circle
                              cx={donutGeometry.size / 2}
                              cy={donutGeometry.size / 2}
                              r={donutGeometry.radius}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={donutGeometry.strokeWidth + 16}
                              strokeDasharray={arc.dashArray}
                              strokeDashoffset={arc.dashOffset}
                              style={{ pointerEvents: 'stroke' }}
                              className="product-donut-hit"
                              onMouseEnter={() => setHoveredShareIndex(idx)}
                              onMouseLeave={() => setHoveredShareIndex(null)}
                              onClick={selectSlice}
                              onTouchEnd={(e) => {
                                // Mobile browsers drop the synthetic click that
                                // normally follows a tap if the finger moved even
                                // slightly, which a mouse click never has to
                                // survive — so handle the tap directly instead of
                                // relying on onClick here.
                                e.preventDefault();
                                selectSlice();
                              }}
                            >
                              <title>{`${arc.name}: ${arc.percent.toFixed(1)}% ($${arc.totalUSD.toFixed(2)})`}</title>
                            </circle>
                            <circle
                              cx={donutGeometry.size / 2}
                              cy={donutGeometry.size / 2}
                              r={donutGeometry.radius}
                              fill="none"
                              strokeWidth={donutGeometry.strokeWidth}
                              strokeDasharray={arc.dashArray}
                              strokeDashoffset={arc.dashOffset}
                              style={{ stroke: arc.colorVar, pointerEvents: 'none' }}
                              className={`product-donut-arc ${hoveredShareIndex === idx ? 'active' : ''}`}
                            />
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                  <div className="product-donut-center">
                    {hoveredShareIndex != null && productShare.slices[hoveredShareIndex] ? (
                      <>
                        <span className="product-donut-center-value">
                          {productShare.slices[hoveredShareIndex].percent.toFixed(0)}%
                        </span>
                        <span className="product-donut-center-label">
                          {productShare.slices[hoveredShareIndex].name} · ${productShare.slices[hoveredShareIndex].totalUSD.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="product-donut-center-value">${productShare.totalRevenue.toFixed(0)}</span>
                        <span className="product-donut-center-label">{isKm ? 'ចំណូលសរុប' : 'Total revenue'}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="products-summary-list">
                  {productShare.slices.map((slice, idx) => (
                    <div
                      key={idx}
                      className={`product-summary-row ${hoveredShareIndex === idx ? 'active' : ''}`}
                      onMouseEnter={() => setHoveredShareIndex(idx)}
                      onMouseLeave={() => setHoveredShareIndex(null)}
                      onClick={() => setHoveredShareIndex((prev) => (prev === idx ? null : idx))}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        setHoveredShareIndex((prev) => (prev === idx ? null : idx));
                      }}
                    >
                      <div className="prod-left">
                        <span className="prod-color-dot" style={{ backgroundColor: slice.colorVar }} />
                        <div className="prod-name">{slice.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Best Selling Products Card */}
        <div className="analytics-best-sellers-card">
          <div className="chart-card-header">
            <div className="chart-header-left">
              <Award size={18} className="chart-header-icon gold" />
              <h3>{isKm ? 'ទំនិញលក់ដាច់បំផុត' : 'Best Selling Products'}</h3>
            </div>
            <span className="chart-badge">{productBreakdown.length} {isKm ? 'មុខ' : 'items'}</span>
          </div>

          <div className="best-sellers-list">
            {productBreakdown.length === 0 ? (
              <div className="empty-chart-text">
                {isKm ? 'គ្មានទិន្នន័យទំនិញលក់ដាច់ទេ។' : 'No best selling products recorded yet.'}
              </div>
            ) : (
              productBreakdown.map((item, idx) => (
                <div key={idx} className="best-seller-row">
                  <div className="best-seller-left">
                    <div className={`best-seller-rank ${idx < 3 ? `top-${idx + 1}` : ''}`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className="best-seller-title">{item.name}</div>
                      <div className="best-seller-qty">
                        {item.qty} {isKm ? 'ចំនួនបានលក់' : 'units sold'}
                      </div>
                    </div>
                  </div>

                  <div className="best-seller-right">
                    <div className="best-seller-usd">${item.totalUSD.toFixed(2)}</div>
                    <div className="best-seller-khr">
                      {Math.round(item.totalKHR).toLocaleString()} ៛
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </div>

        {pendingShare && (
          <div className="share-ready-bar" role="status">
            <span>{isKm ? 'វិក្កយបត្ររួចរាល់ហើយ' : 'Your invoice is ready'}</span>
            <button type="button" className="share-ready-btn" onClick={() => shareInvoiceFile(pendingShare)}>
              <Share2 size={15} />
              {isKm ? 'ចែករំលែក' : 'Share'}
            </button>
            <button
              type="button"
              className="share-ready-close"
              onClick={() => setPendingShare(null)}
              aria-label={isKm ? 'បិទ' : 'Close'}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Off-screen invoice, rendered only while an export is running */}
        {invoiceStage && createPortal(
          <div className="inv-offscreen" aria-hidden="true">
            <InvoiceSheet ref={invoiceSheetRef} data={invoiceData} meta={invoiceMeta} isKm={invoiceIsKm} />
            {invoiceStage.pages && (
              <InvoicePages
                ref={invoicePagesRef}
                data={invoiceData}
                meta={invoiceMeta}
                isKm={invoiceIsKm}
                layout={invoiceStage.pages}
              />
            )}
          </div>,
          document.body
        )}
      </div>
    </MobileAppShell>
  );
}