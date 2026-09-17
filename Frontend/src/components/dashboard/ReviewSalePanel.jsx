import React from 'react';
import { Check, Minus, Plus, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { calculateEquivalentTotals, formatCurrencyValue } from '../../utils/currency';
import './ReviewSalePanel.css';

const getUnitPrice = (item) =>
  Number(item.unit_price ?? item.unitPrice ?? item.unitPriceKHR ?? item.unitPriceUSD ?? item.price ?? 0);

const getCurrency = (item) =>
  item.currency || (item.unitPriceKHR !== undefined || item.totalKHR !== undefined ? 'KHR' : 'USD');

const normalizeNumberInput = (value) => {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  const [wholeRaw, ...rest] = cleaned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || (cleaned.startsWith('0') ? '0' : '');
  return rest.length ? `${whole || '0'}.${rest.join('')}` : whole;
};

function EditableItemRow({ item, onUpdate, onDelete }) {
  const { t, language } = useLanguage();
  const isKm = language !== 'en';

  const productName = item.product || item.description || '';
  const quantity = String(item.quantity ?? 1);
  const unitPrice = String(item.unit_price ?? getUnitPrice(item));
  const currency = getCurrency(item);
  const total = Number(quantity || 0) * Number(unitPrice || 0);

  const patch = (fields) => onUpdate(item.id, fields);

  return (
    <div className="review-item-card">
      <div className="review-item-top-row">
        <input
          className="review-item-name-input"
          value={productName}
          onChange={(event) => patch({ product: event.target.value, description: event.target.value })}
          placeholder={isKm ? 'ឈ្មោះទំនិញ' : 'Item name'}
        />
        <button
          type="button"
          className="review-item-delete-btn"
          onClick={() => onDelete(item.id)}
          aria-label={t('delete') || 'Delete'}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="review-item-fields-row">
        <div className="review-item-field qty-field">
          <span className="review-item-field-label">{t('qty') || 'Qty'}</span>
          <div className="review-qty-stepper">
            <button
              type="button"
              onClick={() => patch({ quantity: Math.max(1, Number(quantity || 1) - 1) })}
              aria-label={t('decreaseQuantity') || 'Decrease'}
            >
              <Minus size={13} />
            </button>
            <input
              inputMode="decimal"
              value={quantity}
              onChange={(event) => patch({ quantity: normalizeNumberInput(event.target.value) })}
              aria-label={t('qty') || 'Quantity'}
            />
            <button
              type="button"
              onClick={() => patch({ quantity: Number(quantity || 0) + 1 })}
              aria-label={t('increaseQuantity') || 'Increase'}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div className="review-item-field price-field">
          <span className="review-item-field-label">{t('unitPrice') || 'Unit Price'}</span>
          <div className="review-price-input-wrap">
            <input
              inputMode="decimal"
              value={unitPrice}
              onChange={(event) => patch({ unit_price: normalizeNumberInput(event.target.value) })}
            />
            <div className="review-currency-toggle">
              <button
                type="button"
                className={currency === 'KHR' ? 'active' : ''}
                onClick={() => patch({ currency: 'KHR' })}
              >
                KHR
              </button>
              <button
                type="button"
                className={currency === 'USD' ? 'active' : ''}
                onClick={() => patch({ currency: 'USD' })}
              >
                USD
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="review-item-total-row">
        <span>{t('total') || 'Total'}</span>
        <strong>{formatCurrencyValue(total, currency)}</strong>
      </div>
    </div>
  );
}

export default function ReviewSalePanel({
  items = [],
  onUpdateItem,
  onDeleteItem,
  onConfirm,
  onRerecord,
  onDeleteSale,
  deletedIds = [],
  error = '',
  isSaving = false,
  exchangeRate = 4050,
  isEditingExisting = false,
}) {
  const { t, language } = useLanguage();
  const isKm = language !== 'en';

  const visibleItems = items.filter((item) => !deletedIds.includes(item.id));

  // Compute item totals
  let rawUsd = 0;
  let rawKhr = 0;

  visibleItems.forEach((item) => {
    const qty = Number(item.quantity || 1);
    const unitPrice = getUnitPrice(item);
    const currency = getCurrency(item);
    const lineTotal = qty * unitPrice;

    if (currency === 'USD') {
      rawUsd += lineTotal;
    } else {
      rawKhr += lineTotal;
    }
  });

  const totals = calculateEquivalentTotals({
    usd: rawUsd,
    khr: rawKhr,
    exchangeRate,
  });

  return (
    <div className="review-sale-panel font-kantomruy">
      {/* Success AI Alert Banner */}
      <section className="review-success-banner">
        <div className="banner-left">
          <span className="success-icon-badge">
            <Check size={18} strokeWidth={2.6} />
          </span>
          <div className="success-copy">
            <strong>
              {isEditingExisting
                ? (isKm ? 'កែប្រែកំណត់ត្រាលក់' : 'Editing Sale Record')
                : (t('aiExtractionComplete') || 'AI Extraction Complete!')}
            </strong>
            <small>
              {isKm
                ? 'អ្នកអាចកែប្រែទំនិញនីមួយៗដោយផ្ទាល់ខាងក្រោម រួចរក្សាទុក។'
                : 'Edit any item directly below, then save when ready.'}
            </small>
          </div>
        </div>
        {onRerecord && (
          <button type="button" className="rerecord-btn" onClick={onRerecord}>
            <RotateCcw size={14} />
            <span>{t('rerecord') || 'Re-record'}</span>
          </button>
        )}
      </section>

      {/* Items List Card */}
      <div className="review-card">
        <div className="review-card-header">
          <div className="header-title-wrap">
            <ShoppingBag size={18} className="header-icon" />
            <span className="header-title">{t('foundItems') || 'Identified Items'}</span>
          </div>
          <span className="items-count-badge">
            {visibleItems.length} {isKm ? 'មុខទំនិញ' : 'items'}
          </span>
        </div>

        <div className="review-items-list">
          {visibleItems.length === 0 ? (
            <div className="empty-review-text">
              {isKm ? 'មិនមានទំនិញសម្រាប់ពិនិត្យទេ។' : 'No items found to review.'}
            </div>
          ) : (
            visibleItems.map((item) => (
              <EditableItemRow key={item.id} item={item} onUpdate={onUpdateItem} onDelete={onDeleteItem} />
            ))
          )}
        </div>
      </div>

      {/* Totals Summary Card */}
      <section className="review-totals-card">
        <div className="totals-row-item">
          <span className="totals-label">{t('totalItems') || 'Total Items'}</span>
          <span className="totals-value">{visibleItems.length}</span>
        </div>

        {/* Riel and Dollar totals as two separate grid blocks side by side */}
        <div className="totals-currency-grid">
          <div className="totals-currency-block khr-block">
            <span className="totals-label">{t('totalKhrLabel') || 'Total (KHR)'}</span>
            <strong className="totals-value khr-text">{Math.round(totals.totalKHR).toLocaleString()}៛</strong>
          </div>
          <div className="totals-currency-block usd-block">
            <span className="totals-label">{t('totalUsdLabel') || 'Total (USD)'}</span>
            <strong className="totals-value usd-text">${totals.totalUSD.toFixed(2)}</strong>
          </div>
        </div>
      </section>

      {error && <p className="review-error-message">{error}</p>}

      {/* Action Buttons */}
      <section className="review-screen-actions">
        {isEditingExisting && onDeleteSale && (
          <button
            className="review-delete-sale-btn"
            type="button"
            onClick={onDeleteSale}
            disabled={isSaving}
          >
            <Trash2 size={16} />
            <span>{isKm ? 'លុបកំណត់ត្រា' : 'Delete Sale'}</span>
          </button>
        )}
        <button
          className="review-confirm-btn"
          type="button"
          onClick={onConfirm}
          disabled={!visibleItems.length || isSaving}
        >
          <Check size={18} />
          <span>{isSaving ? (isKm ? 'កំពុងរក្សាទុក...' : 'Saving...') : (t('confirmSaveSale') || 'Confirm & Save Sale')}</span>
        </button>
      </section>
    </div>
  );
}
