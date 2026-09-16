import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Eye, 
  Trash2, 
  ArrowLeft, 
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
import EditItemModal from '../../components/dashboard/EditItemModal';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
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
  const [editingItem, setEditingItem] = useState(null);
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

  const handleDeleteItem = (id) => {
    setDeletedIds((current) => (current.includes(id) ? current : [...current, id]));
    setEditingItem(null);
  };

  const handleSaveItem = (updatedItem) => {
    setSaleItems((current) =>
      current.map((item) => (item.id === updatedItem.id ? normalizeReviewItem(updatedItem, 0) : item))
    );
    setEditingItem(null);
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

  const handleDeleteSale = async () => {
    if (!selectedSale || saving) return;
    setSaving(true);
    setError('');
    try {
      await deleteSale(selectedSale.saleId);
      setSelectedSale(null);
      await refreshSales();
    } catch {
      setError(isKm ? 'មិនអាចលុបបានទេ។' : 'Failed to delete sale.');
    } finally {
      setSaving(false);
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
      <MobileAppShell activeTab="transactions">
        <div className="tx-screen-top-bar">
          <button
            type="button"
            className="tx-back-btn"
            onClick={() => {
              if (editingSavedSale) setEditingSavedSale(false);
              else navigate('/dashboard');
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="tx-page-title">
            {editingSavedSale
              ? isKm
                ? 'កែប្រែកំណត់ត្រា'
                : 'Edit Sale Record'
              : isKm
              ? 'ពិនិត្យ និងបញ្ជាក់'
              : 'Review & Confirm'}
          </h2>
        </div>

        <ReviewSalePanel
          items={saleItems}
          deletedIds={deletedIds}
          error={error}
          isSaving={saving}
          exchangeRate={exchangeRate}
          onEdit={setEditingItem}
          onConfirm={handleConfirm}
        />
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onDelete={handleDeleteItem}
          onSave={handleSaveItem}
        />
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell activeTab="transactions">
      <div className="tx-screen-top-bar">
        {selectedSale && (
          <button
            type="button"
            className="tx-back-btn"
            onClick={() => setSelectedSale(null)}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h2 className="tx-page-title">
          {!selectedSale && (
            <span className="tx-title-icon-badge">
              <FileText size={18} />
            </span>
          )}
          {selectedSale
            ? isKm
              ? 'ព័ត៌មានលម្អិត'
              : 'Sale Details'
            : isKm
            ? 'កំណត់ត្រាការលក់'
            : 'Sales Records'}
        </h2>
      </div>

      {selectedSale ? (
        <TransactionDetail
          sale={selectedSale}
          exchangeRate={exchangeRate}
          isBusy={saving}
          isKm={isKm}
          onEdit={() => {
            setSaleItems(selectedSale.items.map(normalizeReviewItem));
            setDeletedIds([]);
            setEditingSavedSale(true);
          }}
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
              <span className="summary-khr-value">{Math.round(totalKHR).toLocaleString()} KHR</span>
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
            {!loadingSales && filteredSales.length === 0 && (
              <div className="records-empty">
                <FileText size={36} />
                <p>
                  {isKm
                    ? 'គ្មានកំណត់ត្រាលក់ក្នុងកំឡុងពេលនេះទេ។'
                    : 'No sales records found for this period.'}
                </p>
              </div>
            )}
            {!loadingSales && filteredSales.length > 0 && (
              <div className="records-table-wrapper">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>{isKm ? 'កាលបរិច្ឆេទ' : 'Date'}</th>
                      <th>{isKm ? 'កំណត់ត្រា' : 'Record'}</th>
                      <th className="text-center">{isKm ? 'ទំនិញ' : 'Items'}</th>
                      <th className="text-right">USD</th>
                      <th className="text-right">KHR</th>
                      <th className="text-center">{isKm ? 'សកម្មភាព' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => {
                      const rowTotals = calculateEquivalentTotals({
                        usd: sale.totalUSD,
                        khr: sale.totalKHR,
                        exchangeRate,
                      });
                      const formattedDate = formatDisplayDate(sale.date, language);

                      return (
                        <tr
                          key={sale.saleId}
                          className="records-table-row"
                          onClick={() => handleSelectSale(sale.saleId)}
                        >
                          <td className="records-table-date">{formattedDate}</td>
                          <td className="records-table-title">{summarizeSaleTitle(sale)}</td>
                          <td className="text-center">
                            {sale.items.length} {isKm ? 'ទំនិញ' : 'items'}
                          </td>
                          <td className="text-right records-table-usd">
                            ${rowTotals.totalUSD.toFixed(2)}
                          </td>
                          <td className="text-right records-table-khr">
                            {Math.round(rowTotals.totalKHR).toLocaleString()} KHR
                          </td>
                          <td className="text-center">
                            <button
                              className="view-detail-link"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSale(sale.saleId);
                              }}
                            >
                              <Eye size={14} /> {isKm ? 'មើល' : 'View'}
                            </button>
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
              <strong>{Math.round(totals.totalKHR).toLocaleString()} KHR</strong>
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

          {sale.items.map((item, idx) => {
            const unitPrice = resolveUnitPrice(item);
            const currency = resolveCurrency(item);
            const total = Number(firstDefined(item.amount, Number(item.quantity || 0) * unitPrice, 0));

            return (
              <div className="tx-table-row" key={item.id || idx}>
                <span className="item-name">{item.product || item.description}</span>
                <span className="text-center">{item.quantity}</span>
                <span className="text-center">{formatCurrencyValue(unitPrice, currency)}</span>
                <strong className="text-right">{formatCurrencyValue(total, currency)}</strong>
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
              <div className="grand-khr">{Math.round(totals.totalKHR).toLocaleString()} KHR</div>
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