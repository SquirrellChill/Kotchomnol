import { Edit, Minus, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrencyValue, setPreferredCurrency } from '../../utils/currency';
import './EditItemModal.css';

const normalizeNumberInput = (value) => {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  const [wholeRaw, ...rest] = cleaned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || (cleaned.startsWith('0') ? '0' : '');
  return rest.length ? `${whole || '0'}.${rest.join('')}` : whole;
};

export default function EditItemModal({ item, onClose, onDelete, onSave }) {
  const { t, language } = useLanguage();
  const isKm = language !== 'en';

  const [productName, setProductName] = useState(item?.product || '');
  const [quantity, setQuantity] = useState(String(item?.quantity || 1));
  const [currency, setCurrency] = useState(item?.currency || (item?.unitPriceKHR ? 'KHR' : 'USD'));
  const [unitPrice, setUnitPrice] = useState(String(item?.unit_price ?? item?.unitPriceKHR ?? item?.unitPriceUSD ?? 0));

  useEffect(() => {
    setProductName(item?.product || item?.description || '');
    setQuantity(String(item?.quantity || 1));
    setCurrency(item?.currency || (item?.unitPriceKHR ? 'KHR' : 'USD'));
    setUnitPrice(String(item?.unit_price ?? item?.unitPriceKHR ?? item?.unitPriceUSD ?? 0));
  }, [item]);

  const errors = useMemo(() => {
    const quantityValue = Number(quantity);
    const priceValue = Number(unitPrice);
    return {
      productName: productName.trim() ? '' : (t('fieldRequired') || 'Required'),
      quantity: Number.isFinite(quantityValue) && quantityValue > 0 ? '' : (t('quantityGreaterZero') || 'Must be > 0'),
      unitPrice: unitPrice !== '' && Number.isFinite(priceValue) && priceValue >= 0 ? '' : (t('validPriceRequired') || 'Invalid price'),
    };
  }, [productName, quantity, t, unitPrice]);

  if (!item) return null;

  const quantityValue = Number(quantity) || 0;
  const priceValue = Number(unitPrice) || 0;
  const lineTotal = quantityValue * priceValue;
  const isValid = !errors.productName && !errors.quantity && !errors.unitPrice;

  const chooseCurrency = (nextCurrency) => {
    setCurrency(nextCurrency);
    setPreferredCurrency(nextCurrency);
  };

  const handleSave = () => {
    if (!isValid) return;
    setPreferredCurrency(currency);
    onSave({
      ...item,
      product: productName.trim(),
      description: productName.trim(),
      quantity: Number(quantity),
      currency,
      unit_price: Number(unitPrice),
      price_basis: 'unit',
    });
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={t('editItems') || 'Edit Item'}>
      <div className="edit-item-panel font-kantomruy">
        {/* Modal Header */}
        <div className="modal-title-row">
          <h2>{t('editItems') || 'Edit Item'}</h2>
          <button className="plain-icon-button" type="button" onClick={onClose} aria-label={t('close')}>
            <X size={20} />
          </button>
        </div>

        {/* Product Field */}
        <div className="dash-field">
          <span className="field-label">{t('product') || 'Product'}</span>
          <div className="input-action-wrap">
            <input 
              value={productName} 
              onChange={(event) => setProductName(event.target.value)} 
              placeholder={isKm ? 'ឈ្មោះទំនិញ' : 'Item name'}
            />
          </div>
          {errors.productName && <small className="field-error">{errors.productName}</small>}
        </div>

        {/* Quantity & Currency Columns */}
        <div className="form-grid-two">
          <div className="dash-field">
            <span className="field-label">{t('qty') || 'Quantity'}</span>
            <div className="quantity-stepper">
              <button 
                type="button" 
                onClick={() => setQuantity(String(Math.max(1, Number(quantity || 1) - 1)))}
                aria-label={t('decreaseQuantity')}
              >
                <Minus size={15} />
              </button>
              <input 
                inputMode="decimal" 
                value={quantity} 
                onChange={(event) => setQuantity(normalizeNumberInput(event.target.value))} 
                aria-label={t('qty') || 'Quantity'} 
              />
              <button 
                type="button" 
                onClick={() => setQuantity(String(Number(quantity || 0) + 1))}
                aria-label={t('increaseQuantity')}
              >
                <Plus size={15} />
              </button>
            </div>
            {errors.quantity && <small className="field-error">{errors.quantity}</small>}
          </div>

          <div className="dash-field">
            <span className="field-label">{t('currency') || 'Currency'}</span>
            <div className="currency-toggle" aria-label={t('currency')}>
              <button 
                className={`curr-btn ${currency === 'KHR' ? 'active' : ''}`} 
                type="button" 
                onClick={() => chooseCurrency('KHR')}
              >
                KHR
              </button>
              <button 
                className={`curr-btn ${currency === 'USD' ? 'active' : ''}`} 
                type="button" 
                onClick={() => chooseCurrency('USD')}
              >
                USD
              </button>
            </div>
          </div>
        </div>

        {/* Unit Price Field */}
        <div className="dash-field">
          <span className="field-label">{t('unitPrice') || 'Unit Price'}</span>
          <div className="currency-input-wrap">
            <input 
              inputMode="decimal" 
              value={unitPrice} 
              placeholder="0"
              onChange={(event) => setUnitPrice(normalizeNumberInput(event.target.value))} 
            />
            <b className="currency-tag">{currency}</b>
          </div>
          {errors.unitPrice && <small className="field-error">{errors.unitPrice}</small>}
        </div>

        {/* Dynamic Calculation Banner */}
        <section className="price-calculation-card">
          <small>{t('total') || 'Total'} <span>({t('autoCalculated') || 'Auto-calculated'})</span></small>
          <strong>{formatCurrencyValue(lineTotal, currency)}</strong>
        </section>

        {/* Action Buttons */}
        <section className="modal-actions-row">
          <button className="delete-action-btn" type="button" onClick={() => onDelete(item.id)}>
            <Trash2 size={16} />
            <span>{t('delete') || 'Delete'}</span>
          </button>
          <button className="save-action-btn" type="button" onClick={handleSave} disabled={!isValid}>
            {t('saveChanges') || 'Save Changes'}
          </button>
        </section>
      </div>
    </div>
  );
}