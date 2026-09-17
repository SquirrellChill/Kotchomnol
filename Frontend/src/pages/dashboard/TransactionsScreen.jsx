import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  Search,
  Calendar,
  FileText,
  Download,
  Image as ImageIcon,
  FileDown,
  Coins
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ConfirmDialog from '../../components/dashboard/ConfirmDialog';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import PageHeader from '../../components/dashboard/PageHeader';
import ReviewSalePanel from '../../components/dashboard/ReviewSalePanel';
import TransactionSavedView from '../../components/dashboard/TransactionSavedView';
import { useLanguage } from '../../context/LanguageContext';
import { createSale, deleteSale, getSale, getSales, updateSale } from '../../services/transactionService';
import {
  APPLICATION_EXCHANGE_RATE,
  calculateEquivalentTotals,
  formatCurrencyTotals,
  formatCurrencyValue,
} from '../../utils/currency';
import {
  firstDefined,
  formatDisplayDate,
  formatLocalDate,
  normalizeReviewItem,
  normalizeSaleFromApi,
  resolveCurrency,
  resolveSaleDate,
  resolveUnitPrice,
  saleToPayload,
  summarizeSaleTitle,
} from '../../utils/sales';
import './TransactionsScreen.css';

const resolveDraft = (state) => state?.saleDraft || state?.record || state?.sale || null;
const resolveDraftItems = (draft) => (Array.isArray(draft?.items) ? draft.items : []).map(normalizeReviewItem);

export default function TransactionsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const isKm = language !== 'en';

  const draft = useMemo(() => resolveDraft(location.state), [location.state]);
  const [saleItems, setSaleItems] = useState(() => resolveDraftItems(draft));
  const [deletedIds, setDeletedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState(null);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [editingSavedSale, setEditingSavedSale] = useState(false);
  const [exchangeRate] = useState(APPLICATION_EXCHANGE_RATE || 4050);
  const [pendingDeleteSaleId, setPendingDeleteSaleId] = useState(null);
  const [deletingSale, setDeletingSale] = useState(false);

  // Runtime Period Filtering: 'today' | 'week' | 'month' | 'all'
  const [timeFilter, setTimeFilter] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');

  const isReviewMode = Boolean(draft) || editingSavedSale;
  const activeItems = saleItems.filter((item) => !deletedIds.includes(item.id));

  const refreshSales = async () => {
    setLoadingSales(true);
    setError('');
    try {
      const salesResponse = await getSales({ limit: 100 });
      setSales(salesResponse.data.map(normalizeSaleFromApi));
    } catch (err) {
      try {
        const cached = JSON.parse(localStorage.getItem('kotchomnol_sales') || '[]');
        setSales(cached.map(normalizeSaleFromApi));
      } catch {
        setError(isKm ? 'មិនអាចទាញទិន្នន័យបានទេ។' : 'Unable to load sales records.');
      }
    } finally {
      setLoadingSales(false);
    }
  };

  const handleSelectSale = async (saleId) => {
    if (!saleId) return;
    setLoadingSales(true);
    setError('');
    try {
      const response = await getSale(saleId);
      setSelectedSale(normalizeSaleFromApi(response.data));
    } catch (err) {
      const found = sales.find((s) => s.saleId === saleId);
      if (found) setSelectedSale(found);
    } finally {
      setLoadingSales(false);
    }
  };

  const enterEditMode = (sale) => {
    setSelectedSale(sale);
    setSaleItems(sale.items.map(normalizeReviewItem));
    setDeletedIds([]);
    setEditingSavedSale(true);
  };

  // Jumps straight into the same inline-editable review screen used for a new
  // sale, skipping the read-only detail view for people who just want to edit.
  const handleEditSale = async (saleId) => {
    if (!saleId) return;
    setLoadingSales(true);
    setError('');
    try {
      const response = await getSale(saleId);
      enterEditMode(normalizeSaleFromApi(response.data));
    } catch (err) {
      const found = sales.find((s) => s.saleId === saleId);
      if (found) enterEditMode(found);
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    if (!isReviewMode) refreshSales();
  }, [isReviewMode]);

  useEffect(() => {
    if (location.state?.saleId && !isReviewMode) handleSelectSale(location.state.saleId);
  }, [location.state?.saleId, isReviewMode]);

  // Dynamic filter by period & search query
  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return sales.filter((sale) => {
      const saleDate = new Date(sale.date || sale.createdAt || Date.now());

      // Period matching
      if (timeFilter === 'today' && saleDate < startOfToday) return false;
      if (timeFilter === 'week' && saleDate < startOfWeek) return false;
      if (timeFilter === 'month' && saleDate < startOfMonth) return false;

      // Text search matching
      if (searchQuery.trim()) {
        const title = summarizeSaleTitle(sale).toLowerCase();
        const matchesQuery =
          title.includes(searchQuery.toLowerCase()) ||
          sale.items?.some((it) =>
            (it.product || it.description || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [sales, timeFilter, searchQuery]);

  // Unified aggregated totals for the active filtered period
  const { totalUSD, totalKHR } = useMemo(() => {
    let rawUsd = 0;
    let rawKhr = 0;

    filteredSales.forEach((s) => {
      rawUsd += Number(s.totalUSD || 0);
      rawKhr += Number(s.totalKHR || 0);
    });

    return calculateEquivalentTotals({
      usd: rawUsd,
      khr: rawKhr,
      exchangeRate,
    });
  }, [filteredSales, exchangeRate]);

  // Same product across different sales is combined into a single row, summing
  // quantity/USD/KHR, but only when those sales fall on the same day — the same
  // product sold on different days stays on its own row.
  const productSummaryRows = useMemo(() => {
    const map = new Map();

    filteredSales.forEach((sale) => {
      const saleDate = new Date(sale.date || sale.createdAt || Date.now());
      const dayKey = formatLocalDate(saleDate);

      (sale.items || []).forEach((item) => {
        const name = String(item.product || item.description || '').trim();
        if (!name) return;

        const currency = resolveCurrency(item);
        const key = `${dayKey}__${name.toLowerCase()}`;
        const quantity = Number(item.quantity || 0);
        const unitPrice = resolveUnitPrice(item);
        const amount = Number(firstDefined(item.amount, quantity * unitPrice, 0));
        const amountUSD = currency === 'USD' ? amount : amount / exchangeRate;
        const amountKHR = currency === 'USD' ? amount * exchangeRate : amount;

        const existing = map.get(key);
        if (existing) {
          existing.quantity += quantity;
          existing.totalUSD += amountUSD;
          existing.totalKHR += amountKHR;
          existing.saleCount += 1;
          if (saleDate > existing.lastDate) {
            existing.lastDate = saleDate;
            existing.lastSaleId = sale.saleId;
          }
        } else {
          map.set(key, {
            name,
            quantity,
            totalUSD: amountUSD,
            totalKHR: amountKHR,
            saleCount: 1,
            lastDate: saleDate,
            lastSaleId: sale.saleId,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.lastDate - a.lastDate);
  }, [filteredSales, exchangeRate]);

  const handleDeleteItem = (id) => {
    setDeletedIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleUpdateItem = (id, patch) => {
    setSaleItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    setError('');
  };

  const handleConfirm = async () => {
    if (saving) return;
    const payload = saleToPayload(selectedSale?.date || draft?.sale_date || draft?.date, activeItems);
    if (!payload.items.length) {
      setError(isKm ? 'សូមបន្ថែមទំនិញយ៉ាងហោចមួយ។' : 'Please add at least one item.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingSavedSale && selectedSale) {
        const response = await updateSale(selectedSale.saleId, payload);
        setSelectedSale(normalizeSaleFromApi(response.data));
        setEditingSavedSale(false);
        await refreshSales();
      } else {
        const response = await createSale(payload);
        setSavedSaleId(response.data?.sale_id || response.data?.saleId || null);
        setSaved(true);
      }
    } catch (err) {
      setError(isKm ? 'មិនអាចរក្សាទុកបានទេ។' : 'Unable to complete request.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = (saleId) => {
    const targetId = saleId || selectedSale?.saleId;
    if (!targetId) return;
    setPendingDeleteSaleId(targetId);
  };

  const cancelDeleteSale = () => {
    if (deletingSale) return;
    setPendingDeleteSaleId(null);
  };

  const confirmDeleteSale = async () => {
    const targetId = pendingDeleteSaleId;
    if (!targetId) return;

    setDeletingSale(true);
    setError('');
    try {
      await deleteSale(targetId);
      if (selectedSale?.saleId === targetId) setSelectedSale(null);
      if (editingSavedSale) setEditingSavedSale(false);
      await refreshSales();
      setPendingDeleteSaleId(null);
    } catch {
      setError(isKm ? 'មិនអាចលុបបានទេ។' : 'Failed to delete sale.');
    } finally {
      setDeletingSale(false);
    }
  };

  if (saved) {
    return (
      <MobileAppShell activeTab="transactions" showBottomNav={false}>
        <TransactionSavedView
          savedSaleId={savedSaleId}
          onNewSale={() => navigate('/dashboard/voice', { state: { entryMode: 'manual' } })}
        />
      </MobileAppShell>
    );
  }

  if (isReviewMode) {
    return (
      <MobileAppShell
        activeTab="transactions"
        header={
          <PageHeader
            icon={<FileText size={18} />}
            title={
              editingSavedSale
                ? isKm
                  ? 'កែប្រែកំណត់ត្រា'
                  : 'Edit Sale Record'
                : isKm
                ? 'ពិនិត្យ និងបញ្ជាក់'
                : 'Review & Confirm'
            }
            onBack={() => {
              if (editingSavedSale) setEditingSavedSale(false);
              else navigate('/dashboard');
            }}
          />
        }
      >
        <ReviewSalePanel
          items={saleItems}
          deletedIds={deletedIds}
          error={error}
          isSaving={saving}
          exchangeRate={exchangeRate}
          isEditingExisting={editingSavedSale}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onConfirm={handleConfirm}
          onDeleteSale={editingSavedSale ? () => handleDeleteSale(selectedSale?.saleId) : undefined}
        />
        <ConfirmDialog
          open={Boolean(pendingDeleteSaleId)}
          isBusy={deletingSale}
          onConfirm={confirmDeleteSale}
          onCancel={cancelDeleteSale}
        />
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell
      activeTab="transactions"
      header={
        <PageHeader
          icon={<FileText size={18} />}
          title={
            selectedSale
              ? isKm
                ? 'ព័ត៌មានលម្អិត'
                : 'Sale Details'
              : isKm
              ? 'កំណត់ត្រាការលក់'
              : 'Sales Records'
          }
          onBack={selectedSale ? () => setSelectedSale(null) : undefined}
        />
      }
    >
      {selectedSale ? (
        <TransactionDetail
          sale={selectedSale}
          exchangeRate={exchangeRate}
          isBusy={saving}
          isKm={isKm}
          onEdit={() => enterEditMode(selectedSale)}
          onDelete={handleDeleteSale}
        />
      ) : (
        <div className="sales-records-container">
          <div className="records-summary-header-row">
            <span className="records-summary-title">{isKm ? 'សរុបតាមការជ្រើសរើស' : 'Filtered Sales Total'}</span>
            <span className="records-count-pill">
              {filteredSales.length} {isKm ? 'ការលក់' : 'records'}
            </span>
          </div>

          <div className="records-summary-cards-grid">
            <div className="records-summary-card khr-summary-card">
              <span className="summary-currency-label">
                <Coins size={13} className="summary-khr-icon" />
                KHR
              </span>
              <span className="summary-khr-value">{Math.round(totalKHR).toLocaleString()}៛</span>
            </div>
            <div className="records-summary-card usd-summary-card">
              <span className="summary-currency-label">USD</span>
              <span className="summary-usd-value">${totalUSD.toFixed(2)}</span>
            </div>
          </div>

          <div className="time-filter-row">
            <button
              type="button"
              className={`time-pill-btn ${timeFilter === 'today' ? 'active' : ''}`}
              onClick={() => setTimeFilter('today')}
            >
              {isKm ? 'ថ្ងៃនេះ' : 'Today'}
            </button>
            <button
              type="button"
              className={`time-pill-btn ${timeFilter === 'week' ? 'active' : ''}`}
              onClick={() => setTimeFilter('week')}
            >
              {isKm ? 'សប្តាហ៍នេះ' : 'This Week'}
            </button>
            <button
              type="button"
              className={`time-pill-btn ${timeFilter === 'month' ? 'active' : ''}`}
              onClick={() => setTimeFilter('month')}
            >
              {isKm ? 'ខែនេះ' : 'This Month'}
            </button>
            <button
              type="button"
              className={`time-pill-btn ${timeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTimeFilter('all')}
            >
              {isKm ? 'ទាំងអស់' : 'All Time'}
            </button>
          </div>

          <div className="records-search-bar">
            <Search size={16} />
            <input
              type="text"
              placeholder={isKm ? 'ស្វែងរកតាមឈ្មោះទំនិញ...' : 'Search by item name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <section className="records-table-section">
            {loadingSales && (
              <div className="records-loading">
                {isKm ? 'កំពុងផ្ទុកទិន្នន័យ...' : 'Loading sales records...'}
              </div>
            )}
            {!loadingSales && productSummaryRows.length === 0 && (
              <div className="records-empty">
                <FileText size={36} />
                <p>
                  {isKm
                    ? 'គ្មានកំណត់ត្រាលក់ក្នុងកំឡុងពេលនេះទេ។'
                    : 'No sales records found for this period.'}
                </p>
              </div>
            )}
            {!loadingSales && productSummaryRows.length > 0 && (
              <div className="records-table-wrapper">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>{isKm ? 'កាលបរិច្ឆេទចុងក្រោយ' : 'Last Sold'}</th>
                      <th>{isKm ? 'ផលិតផល' : 'Product'}</th>
                      <th className="text-center">{isKm ? 'ចំនួន' : 'Qty'}</th>
                      <th className="text-right">USD</th>
                      <th className="text-right">KHR</th>
                      <th className="text-center">{isKm ? 'សកម្មភាព' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSummaryRows.map((row) => {
                      // row.totalUSD/row.totalKHR are already full equivalents of the
                      // same underlying amount (converted per item as it was summed),
                      // so they're rendered directly rather than unified again.
                      const formattedDate = formatDisplayDate(row.lastDate, language);

                      return (
                        <tr
                          key={`${row.lastDate.getTime()}__${row.name}`}
                          className="records-table-row"
                          onClick={() => handleSelectSale(row.lastSaleId)}
                        >
                          <td className="records-table-date">{formattedDate}</td>
                          <td className="records-table-title">{row.name}</td>
                          <td className="text-center">{row.quantity}</td>
                          <td className="text-right records-table-usd">
                            ${row.totalUSD.toFixed(2)}
                          </td>
                          <td className="text-right records-table-khr">
                            {Math.round(row.totalKHR).toLocaleString()}៛
                          </td>
                          <td className="text-center">
                            <div className="records-row-actions">
                              <button
                                className="view-detail-link icon-only"
                                type="button"
                                aria-label={isKm ? 'មើល' : 'View'}
                                title={isKm ? 'មើល' : 'View'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSale(row.lastSaleId);
                                }}
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                className="edit-detail-link icon-only"
                                type="button"
                                aria-label={isKm ? 'កែប្រែ' : 'Edit'}
                                title={isKm ? 'កែប្រែ' : 'Edit'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditSale(row.lastSaleId);
                                }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="delete-detail-link icon-only"
                                type="button"
                                aria-label={isKm ? 'លុប' : 'Delete'}
                                title={isKm ? 'លុប' : 'Delete'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSale(row.lastSaleId);
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteSaleId)}
        isBusy={deletingSale}
        onConfirm={confirmDeleteSale}
        onCancel={cancelDeleteSale}
      />
    </MobileAppShell>
  );
}

function TransactionDetail({ sale, exchangeRate, isBusy, isKm, onEdit, onDelete }) {
  const receiptRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const totals = calculateEquivalentTotals({
    usd: sale.totalUSD,
    khr: sale.totalKHR,
    exchangeRate,
  });

  const totalQty = (sale.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const formattedDate = sale.date ? formatDisplayDate(sale.date, isKm ? 'km' : 'en') : (isKm ? 'ថ្ងៃនេះ' : 'Today');

  // Merge line items that are the same product (+ currency) into one row,
  // summing quantity/total; genuinely different products stay on their own row.
  const aggregatedItems = useMemo(() => {
    const map = new Map();
    (sale.items || []).forEach((item, idx) => {
      const name = item.product || item.description || '';
      const currency = resolveCurrency(item);
      const key = `${name}__${currency}`;
      const quantity = Number(item.quantity || 0);
      const unitPrice = resolveUnitPrice(item);
      const total = Number(firstDefined(item.amount, quantity * unitPrice, 0));

      const existing = map.get(key);
      if (existing) {
        existing.quantity += quantity;
        existing.total += total;
      } else {
        map.set(key, { id: item.id || `${key}-${idx}`, name, currency, quantity, total });
      }
    });
    return Array.from(map.values());
  }, [sale.items]);

  const handleDownloadImage = async () => {
    if (!receiptRef.current || exporting) return;
    setExporting(true);
    try {
      const element = receiptRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
      });
      const link = document.createElement('a');
      link.download = `receipt_${sale.saleId || 'sale'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current || exporting) return;
    setExporting(true);
    try {
      const element = receiptRef.current;
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
      pdf.save(`receipt_${sale.saleId || 'sale'}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="tx-detail-container">
      <div className="export-action-bar">
        <span className="export-hint-text">
          {isKm ? 'ទាញយកវិក្កយបត្រ៖' : 'Export Receipt:'}
        </span>
        <div className="export-buttons-group">
          <button 
            type="button" 
            className="export-btn image-btn" 
            onClick={handleDownloadImage}
            disabled={exporting}
          >
            <ImageIcon size={15} />
            <span>{exporting ? '...' : (isKm ? 'ជារូបភាព (PNG)' : 'Image (PNG)')}</span>
          </button>
          <button 
            type="button" 
            className="export-btn pdf-btn" 
            onClick={handleDownloadPDF}
            disabled={exporting}
          >
            <FileDown size={15} />
            <span>{exporting ? '...' : (isKm ? 'ជាឯកសារ (PDF)' : 'PDF File')}</span>
          </button>
        </div>
      </div>

      <div className="receipt-capture-area" ref={receiptRef}>
        <div className="tx-detail-card">
          <div className="receipt-brand-row">
            <span className="receipt-badge">KOTCHOMNOL RECEIPT</span>
            <span className="tx-detail-date">{formattedDate}</span>
          </div>

          <h3>{summarizeSaleTitle(sale)}</h3>
          
          <div className="tx-detail-totals">
            <div>
              <label>USD</label>
              <strong>${totals.totalUSD.toFixed(2)}</strong>
            </div>
            <div>
              <label>KHR</label>
              <strong>{Math.round(totals.totalKHR).toLocaleString()}៛</strong>
            </div>
          </div>
        </div>

        <div className="tx-items-table-card">
          <h4 className="tx-items-title">{isKm ? 'បញ្ជីទំនិញ' : 'Items List'}</h4>
          
          <div className="tx-table-head">
            <span>{isKm ? 'ទំនិញ' : 'Item'}</span>
            <span className="text-center">{isKm ? 'ចំនួន' : 'Qty'}</span>
            <span className="text-center">{isKm ? 'តម្លៃរាយ' : 'Price'}</span>
            <span className="text-right">{isKm ? 'សរុប' : 'Total'}</span>
          </div>

          {aggregatedItems.map((item) => {
            const unitPrice = item.quantity > 0 ? item.total / item.quantity : 0;

            return (
              <div className="tx-table-row" key={item.id}>
                <span className="item-name">{item.name}</span>
                <span className="text-center">{item.quantity}</span>
                <span className="text-center">{formatCurrencyValue(unitPrice, item.currency)}</span>
                <strong className="text-right">{formatCurrencyValue(item.total, item.currency)}</strong>
              </div>
            );
          })}

          {/* Aggregate Grand Total Row */}
          <div className="tx-table-footer-row">
            <div className="footer-title">
              <strong>{isKm ? 'សរុបទឹកប្រាក់រួម' : 'Grand Total'}</strong>
            </div>
            <div className="text-center footer-qty">
              <strong>{totalQty}</strong>
            </div>
            <div></div>
            <div className="text-right footer-totals-col">
              <div className="grand-usd">${totals.totalUSD.toFixed(2)}</div>
              <div className="grand-khr">{Math.round(totals.totalKHR).toLocaleString()}៛</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tx-action-row">
        <button className="tx-btn-edit" type="button" onClick={onEdit} disabled={isBusy || exporting}>
          {isKm ? 'កែប្រែ' : 'Edit'}
        </button>
        <button className="tx-btn-delete" type="button" onClick={onDelete} disabled={isBusy || exporting}>
          <Trash2 size={16} /> {isKm ? 'លុប' : 'Delete'}
        </button>
      </div>
    </section>
  );
}