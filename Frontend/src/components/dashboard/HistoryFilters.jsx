import { Calendar, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function HistoryFilters({ activeFilter, onChange, onPickDate }) {
  const { t } = useLanguage();
  const filters = [
    ['today', t('today')],
    ['week', t('thisWeek')],
    ['month', t('thisMonth')],
  ];

  return (
    <nav className="history-filter-bar" aria-label={t('timePeriodRange')}>
      {filters.map(([value, label]) => (
        <button key={value} className={activeFilter === value ? 'active' : ''} type="button" onClick={() => onChange(value)}>
          {label}
        </button>
      ))}
      <button className="date-filter-button" type="button" onClick={onPickDate} aria-label={t('customDateRange')}>
        <Calendar size={16} />
        <ChevronDown size={14} />
      </button>
    </nav>
  );
}
