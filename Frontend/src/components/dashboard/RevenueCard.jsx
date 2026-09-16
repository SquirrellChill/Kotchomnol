import { Calendar, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrencyTotals, getPreferredCurrency } from '../../utils/currency';
import { formatDisplayDate, formatDisplayDateRange } from '../../utils/sales';

export default function RevenueCard({ summary, variant = 'home' }) {
  const { language, t } = useLanguage();
  const label = variant === 'history' ? summary.filteredLabel : summary.label;
  const totals = formatCurrencyTotals({
    khr: summary.amountKHR || 0,
    usd: summary.amountUSD || 0,
    exchangeRate: summary.exchangeRate,
  });
  const preferredCurrency = getPreferredCurrency();
  const displayDate = summary.endDate
    ? formatDisplayDateRange(summary.date, summary.endDate, language)
    : formatDisplayDate(summary.date, language);

  return (
    <section className="revenue-summary-card polished-revenue-card">
      <div className="revenue-card-top">
        <div className="revenue-label">
          <TrendingUp size={16} />
          <span>{label}</span>
        </div>
        <div className="date-pill">
          <Calendar size={14} />
          <span>{displayDate}</span>
        </div>
      </div>

      <div className="receipt-total-stack" aria-label={t('totalAmount')}>
        <div className={preferredCurrency === 'USD' ? 'primary' : ''}>
          <span>{t('totalUsdLabel')}</span>
          <strong>{totals.usdLabel}</strong>
        </div>
        <div className={preferredCurrency === 'KHR' ? 'primary' : ''}>
          <span>{t('totalKhrLabel')}</span>
          <strong>{totals.khrLabel}</strong>
        </div>
      </div>

      <p className="exchange-rate-note">{t('exchangeRate', { rate: totals.rate.toLocaleString(language === 'km' ? 'km-KH' : 'en-US') })}</p>

      <div className="revenue-divider" />
      <div className="revenue-orders">
        <span>{t('totalOrders')}</span>
        <b>{summary.totalOrders || 0}</b>
      </div>
    </section>
  );
}