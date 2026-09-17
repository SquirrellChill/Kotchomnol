import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronDown
} from 'lucide-react';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getSales } from '../../services/transactionService';
import { APPLICATION_EXCHANGE_RATE, calculateEquivalentTotals } from '../../utils/currency';
import { normalizeSaleFromApi, resolveUnitPrice, formatDisplayDate, formatLocalDate } from '../../utils/sales';
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

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isKm = language !== 'en';

  const [period, setPeriod] = useState('today'); // 'today' | 'week' | 'month'
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hoveredShareIndex, setHoveredShareIndex] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!isExportMenuOpen) return undefined;
    const handleOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExportMenuOpen]);

  // Fetch real-time sales directly from backend
  useEffect(() => {
    let isMounted = true;
    const fetchSales = async () => {
      setLoading(true);
      try {
        const res = await getSales({ limit: 100 });
        if (isMounted && res?.data) {
          setSales(res.data.map(normalizeSaleFromApi));
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
    filteredSales
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

    const maxVal = Math.max(...weeklyAmounts, 1);
    const bars = days.map((d) => ({
      label: d.label,
      value: weeklyAmounts[d.index],
      percent: Math.max(8, Math.round((weeklyAmounts[d.index] / maxVal) * 100))
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
      filteredSales: filtered
    };
  }, [sales, period, isKm]);

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
    const width = 700;
    const height = 260;
    const padX = 34;
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
  }, [weeklyBars]);

  const periodLabel = period === 'today'
    ? (isKm ? 'ថ្ងៃនេះ' : 'Today')
    : period === 'week'
      ? (isKm ? 'របាយការណ៍ប្រចាំសប្តាហ៍' : 'Weekly Report')
      : (isKm ? 'របាយការណ៍ប្រចាំខែ' : 'Monthly Report');

  const reportDateLabel = formatDisplayDate(new Date(), isKm ? 'km' : 'en');

  const handleDownloadImage = async () => {
    if (!reportRef.current || exporting) return;
    setIsExportMenuOpen(false);
    setExporting(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
      });
      const link = document.createElement('a');
      link.download = `kotchomnol_${period}-report_${formatLocalDate(new Date())}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export report image:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || exporting) return;
    setIsExportMenuOpen(false);
    setExporting(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 24;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = (canvas.height * printableWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, printableHeight);
      pdf.save(`kotchomnol_${period}-report_${formatLocalDate(new Date())}.pdf`);
    } catch (err) {
      console.error('Failed to export report PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const csvEscape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const handleDownloadTable = () => {
    if (exporting) return;
    setIsExportMenuOpen(false);
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

  return (
    <MobileAppShell activeTab="history">
      <div className="analytics-page-wrapper font-kantumruy">
        {/* Header Title */}
        <div className="analytics-header">
          <div>
            <h1 className="analytics-title">
              <span className="analytics-title-icon-badge">
                <BarChart3 size={18} />
              </span>
              {isKm ? 'ផ្ទាំងគ្រប់គ្រង & ការវិភាគ' : 'Dashboard & Analytics'}
            </h1>
            <p className="analytics-sub">
              {isKm ? 'នេះជាសង្ខេបអាជីវកម្ម និងក្រាហ្វវិភាគទិន្នន័យជាក់ស្តែងរបស់អ្នក' : 'Here is your real-time business performance and sales analytics.'}
            </p>
          </div>
        </div>

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
          </div>

          <div className="export-dropdown" ref={exportMenuRef}>
            <button
              type="button"
              className="export-dropdown-trigger"
              onClick={() => setIsExportMenuOpen((open) => !open)}
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
                <button
                  type="button"
                  className="export-dropdown-item"
                  onClick={handleDownloadImage}
                  disabled={exporting}
                >
                  <span className="export-option-icon image"><ImageIcon size={15} /></span>
                  <span className="export-dropdown-item-text">
                    <span className="export-option-label">{isKm ? 'រូបភាព' : 'Image'}</span>
                    <span className="export-option-hint">.png</span>
                  </span>
                </button>
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
            </div>
          </div>
        </div>

        {/* Analytics Charts & Summaries */}
        <div className="analytics-sections-grid">
          {/* Revenue Line Chart */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-header-left">
                <TrendingUp size={18} className="chart-header-icon" />
                <h3>{isKm ? 'និន្នាការចំណូលប្រចាំសប្តាហ៍ ($)' : 'Weekly Revenue Trend ($)'}</h3>
              </div>
              <span className="chart-badge">{isKm ? 'សប្តាហ៍នេះ' : 'This Week'}</span>
            </div>

            <div className="line-chart-wrap">
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
                      ${p.value.toFixed(1)}
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
                      {donutGeometry.arcs.map((arc, idx) => (
                        <circle
                          key={idx}
                          cx={donutGeometry.size / 2}
                          cy={donutGeometry.size / 2}
                          r={donutGeometry.radius}
                          fill="none"
                          strokeWidth={donutGeometry.strokeWidth}
                          strokeDasharray={arc.dashArray}
                          strokeDashoffset={arc.dashOffset}
                          style={{ stroke: arc.colorVar }}
                          className="product-donut-arc"
                          onMouseEnter={() => setHoveredShareIndex(idx)}
                          onMouseLeave={() => setHoveredShareIndex(null)}
                        >
                          <title>{`${arc.name}: ${arc.percent.toFixed(1)}% ($${arc.totalUSD.toFixed(2)})`}</title>
                        </circle>
                      ))}
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
                    <div key={idx} className="product-summary-row">
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
      </div>
    </MobileAppShell>
  );
}