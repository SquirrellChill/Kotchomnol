import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Home,
  BarChart3,
  Receipt,
  User,
  Edit3,
  Mic,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getSales } from '../services/transactionService';
import { calculateEquivalentTotals, APPLICATION_EXCHANGE_RATE } from '../utils/currency';
import { normalizeSaleFromApi, summarizeSaleTitle, formatLocalDate } from '../utils/sales';
import { buildDashboardProfile } from '../utils/profile';
import UserAvatar from '../components/dashboard/UserAvatar';
import './DashboardPage.css';

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const EXCHANGE_RATE = APPLICATION_EXCHANGE_RATE || 4050; // 1 USD = 4,050 KHR

const profileFallback = {
  name: 'Seller',
  firstName: 'Seller',
  lastName: '',
  businessName: '',
  role: 'Owner',
  email: '',
  phone: '',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();

  const isKm = language !== 'en';

  // Dynamic user profile
  const profile = buildDashboardProfile(user, profileFallback);
  const firstName = profile.firstName || profile.name?.split(' ')[0] || (isKm ? 'អ្នកលក់' : 'Seller');
  const fullDisplayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || 'Seller';

  // Dynamic live date
  const today = new Date();
  const formattedToday = today.toLocaleDateString(isKm ? 'km-KH' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Time-of-day greeting
  const hour = today.getHours();
  const greetingPeriod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const greeting = {
    en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    km: { morning: 'អរុណសួស្តី', afternoon: 'ទិវាសួស្តី', evening: 'សាយណ្ហសួស្តី' },
  }[isKm ? 'km' : 'en'][greetingPeriod];

  // State to hold live sales data
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  // Which day the revenue card / recent list is showing (defaults to today)
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);

  useEffect(() => {
    if (!isDatePickerOpen) return undefined;
    const handleOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsDatePickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDatePickerOpen]);

  const isViewingToday = isSameDay(selectedDate, today);
  const formattedSelectedDate = selectedDate.toLocaleDateString(isKm ? 'km-KH' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const pickDate = (date) => {
    setSelectedDate(date);
    setIsDatePickerOpen(false);
  };

  // Fetch real-time sales from backend
  useEffect(() => {
    let isMounted = true;
    const fetchLiveSales = async () => {
      setLoading(true);
      try {
        const res = await getSales({ limit: 100 });
        if (isMounted && res?.data) {
          setSales(res.data.map(normalizeSaleFromApi));
        }
      } catch (err) {
        console.error('Failed to load live sales for dashboard:', err);
        try {
          const cached = JSON.parse(localStorage.getItem('kotchomnol_sales') || '[]');
          if (isMounted) setSales(cached.map(normalizeSaleFromApi));
        } catch {
          // ignore cache parse errors
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLiveSales();
    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate metrics for today (trend/week strip) and for whichever day is selected
  const {
    selectedTotalUSD,
    selectedTotalKHR,
    selectedSalesCount,
    selectedDaySales,
    recentSales,
    trendPercent,
    trendDirection,
    weekTotalUSD,
    weekTotalKHR,
  } = useMemo(() => {
    const sorted = [...sales].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB - dateA;
    });

    const sumRange = (fromInclusive, toExclusive) => {
      let rawUsd = 0;
      let rawKhr = 0;
      let count = 0;
      sorted.forEach((sale) => {
        const saleDate = new Date(sale.date || sale.createdAt || Date.now());
        if (saleDate >= fromInclusive && (!toExclusive || saleDate < toExclusive)) {
          rawUsd += Number(sale.totalUSD || 0);
          rawKhr += Number(sale.totalKHR || 0);
          count += 1;
        }
      });
      return { ...calculateEquivalentTotals({ usd: rawUsd, khr: rawKhr, exchangeRate: EXCHANGE_RATE }), count };
    };

    const filterRange = (fromInclusive, toExclusive) =>
      sorted.filter((sale) => {
        const saleDate = new Date(sale.date || sale.createdAt || Date.now());
        return saleDate >= fromInclusive && (!toExclusive || saleDate < toExclusive);
      });

    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfYesterday = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - 1);
    const startOfWeek = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - 6);
    const startOfSelected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const endOfSelected = new Date(startOfSelected.getFullYear(), startOfSelected.getMonth(), startOfSelected.getDate() + 1);

    const todaysTotals = sumRange(startOfToday, null);
    const yesterdaysTotals = sumRange(startOfYesterday, startOfToday);
    const weekTotals = sumRange(startOfWeek, null);
    const selectedTotals = sumRange(startOfSelected, endOfSelected);

    let percent = null;
    let direction = 'neutral';
    if (yesterdaysTotals.totalUSD > 0) {
      percent = Math.round(((todaysTotals.totalUSD - yesterdaysTotals.totalUSD) / yesterdaysTotals.totalUSD) * 100);
      direction = percent >= 0 ? 'up' : 'down';
    } else if (todaysTotals.totalUSD > 0) {
      direction = 'new';
    }

    return {
      selectedTotalUSD: selectedTotals.totalUSD,
      selectedTotalKHR: selectedTotals.totalKHR,
      selectedSalesCount: selectedTotals.count,
      selectedDaySales: filterRange(startOfSelected, endOfSelected),
      recentSales: sorted.slice(0, 5),
      trendPercent: percent,
      trendDirection: direction,
      weekTotalUSD: weekTotals.totalUSD,
      weekTotalKHR: weekTotals.totalKHR,
    };
  }, [sales, today, selectedDate]);

  const transactionsToShow = isViewingToday ? recentSales : selectedDaySales;

  return (
    <div className="dash-container font-kantomruy">
      {/* Desktop Sidebar / Mobile Bottom Nav */}
      <aside className="dash-sidebar">
        <div>
          <div className="dash-sidebar-brand" onClick={() => navigate('/')}>
            <img src="/logo-mascot.png" alt="KOTCHOMNOL" className="dash-brand-icon" />
            <span className="dash-brand-title">KOTCHOMNOL</span>
          </div>

          <nav className="dash-nav-menu" aria-label="Dashboard Sidebar">
            <Link to="/dashboard" className="dash-nav-link active">
              <Home size={18} />
              <span>{isKm ? 'ទំព័រដើម' : 'Home'}</span>
            </Link>

            <Link to="/dashboard/history" className="dash-nav-link">
              <BarChart3 size={18} />
              <span>{isKm ? 'ផ្ទាំងគ្រប់គ្រង' : 'Dashboard'}</span>
            </Link>

            <Link 
              to="/dashboard/voice" 
              state={{ entryMode: 'voice' }}
              className="dash-nav-link dash-nav-add-sale"
            >
              <span className="add-sale-icon-wrap">
                <Mic size={15} strokeWidth={2.4} />
              </span>
              <span>{isKm ? 'បន្ថែមការលក់' : 'Add Sale'}</span>
            </Link>

            <Link to="/dashboard/transactions" className="dash-nav-link">
              <Receipt size={18} />
              <span>{isKm ? 'កំណត់ត្រាការលក់' : 'Sales Records'}</span>
            </Link>

            <Link to="/dashboard/profile" className="dash-nav-link">
              <User size={18} />
              <span>{isKm ? 'ប្រវត្តិរូប' : 'Profile'}</span>
            </Link>
          </nav>
        </div>

        <div className="dash-sidebar-footer">
          {isKm ? 'គណនី:' : 'Account:'} <span className="dash-user-label">{fullDisplayName}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dash-main-wrapper">
        <header className="dash-header">
          <div>
            <h1 className="dash-header-title">
              <span className="dash-header-title-icon-badge">
                <Home size={18} />
              </span>
              {`${greeting}, ${firstName}!`}
            </h1>
            <p className="dash-header-sub">
              {isKm ? 'នេះជាសង្ខេបអាជីវកម្មថ្ងៃនេះ។' : 'Here is your business overview today.'}
            </p>
          </div>
          <div
            className="dash-header-avatar-btn"
            onClick={() => navigate('/dashboard/profile')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/dashboard/profile');
              }
            }}
            title={isKm ? 'ប្រវត្តិរូប' : 'Profile'}
          >
            <UserAvatar size="md" initials={firstName.charAt(0)} />
          </div>
        </header>

        <main className="dash-content-body">
          <div className="dash-metrics-grid">
            {/* Dynamic Today's Revenue Card */}
            <div className="dash-revenue-card">
              <div>
                <div className="dash-rev-header">
                  <span className="dash-rev-label">
                    {isViewingToday
                      ? (isKm ? 'ចំណូលថ្ងៃនេះ' : "Today's Revenue")
                      : (isKm ? 'ចំណូលថ្ងៃ' : 'Revenue on')}
                  </span>

                  <div className="dash-rev-date-wrap" ref={datePickerRef}>
                    <button
                      type="button"
                      className={`dash-rev-date-btn ${!isViewingToday ? 'is-custom' : ''}`}
                      onClick={() => setIsDatePickerOpen((open) => !open)}
                      aria-haspopup="true"
                      aria-expanded={isDatePickerOpen}
                    >
                      <Calendar size={12} />
                      <span>{isViewingToday ? formattedToday : formattedSelectedDate}</span>
                      <ChevronDown size={12} />
                    </button>

                    {isDatePickerOpen && (
                      <div className="dash-date-popover" role="dialog" aria-label={isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ' : 'Select a date'}>
                        <div className="dash-date-quick-row">
                          <button
                            type="button"
                            className={isViewingToday ? 'active' : ''}
                            onClick={() => pickDate(new Date())}
                          >
                            {isKm ? 'ថ្ងៃនេះ' : 'Today'}
                          </button>
                          <button
                            type="button"
                            onClick={() => pickDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))}
                          >
                            {isKm ? 'ម្សិលមិញ' : 'Yesterday'}
                          </button>
                        </div>
                        <input
                          type="date"
                          className="dash-date-input"
                          value={formatLocalDate(selectedDate)}
                          max={formatLocalDate(today)}
                          onChange={(e) => e.target.value && pickDate(new Date(`${e.target.value}T00:00:00`))}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {isViewingToday && trendDirection !== 'neutral' && (
                  <div className={`dash-trend-badge ${trendDirection}`}>
                    {trendDirection === 'up' && <TrendingUp size={13} />}
                    {trendDirection === 'down' && <TrendingDown size={13} />}
                    {trendDirection === 'new' && <Sparkles size={13} />}
                    <span>
                      {trendDirection === 'new'
                        ? (isKm ? 'ការលក់ដំបូងថ្ងៃនេះ' : 'First sales logged today')
                        : `${trendPercent >= 0 ? '+' : ''}${trendPercent}% ${isKm ? 'ធៀបនឹងម្សិលមិញ' : 'vs yesterday'}`}
                    </span>
                  </div>
                )}

                <div className="dash-rev-amounts">
                  <div>
                    <span className="dash-amt-label">{isKm ? 'សរុប (USD)' : 'Total (USD)'}</span>
                    <span className="dash-usd-val">${selectedTotalUSD.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="dash-amt-label">{isKm ? 'សរុប (KHR)' : 'Total (KHR)'}</span>
                    <span className="dash-khr-val">{Math.round(selectedTotalKHR).toLocaleString()} KHR</span>
                  </div>
                </div>
              </div>

              <div className="dash-rev-footer">
                <span>
                  {isKm
                    ? `អត្រាប្តូរប្រាក់: 1 USD = ${EXCHANGE_RATE.toLocaleString()} KHR`
                    : `Exchange rate: 1 USD = ${EXCHANGE_RATE.toLocaleString()} KHR`}
                </span>
                <span className="dash-orders-badge">
                  {isKm ? `ចំនួនការលក់: ${selectedSalesCount}` : `Sales count: ${selectedSalesCount}`}
                </span>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="dash-quick-actions-card">
              <h3 className="dash-section-heading">
                {isKm ? 'សកម្មភាពរហ័ស' : 'Quick Actions'}
              </h3>
              <div className="dash-action-buttons">
                <button 
                  type="button" 
                  className="dash-action-btn manual"
                  onClick={() => navigate('/dashboard/voice', { state: { entryMode: 'manual' } })}
                >
                  <span className="dash-action-icon"><Edit3 size={18} /></span>
                  <div>
                    <div className="dash-action-btn-title">
                      {isKm ? 'បញ្ចូលដោយដៃ' : 'Manual Entry'}
                    </div>
                    <div className="dash-action-btn-sub">
                      {isKm ? 'បន្ថែមការលក់ដោយវាយទំនិញ' : 'Add sale by typing items'}
                    </div>
                  </div>
                </button>

                <button 
                  type="button" 
                  className="dash-action-btn voice"
                  onClick={() => navigate('/dashboard/voice', { state: { entryMode: 'voice' } })}
                >
                  <span className="dash-action-icon"><Mic size={18} /></span>
                  <div>
                    <div className="dash-action-btn-title">
                      {isKm ? 'ថតការលក់' : 'Voice Entry'}
                    </div>
                    <div className="dash-action-btn-sub">
                      {isKm ? 'កំពុងស្តាប់ព័ត៌មានការលក់' : 'Speak to record your sales'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="dash-action-btn records"
                  onClick={() => navigate('/dashboard/transactions')}
                >
                  <span className="dash-action-icon"><Receipt size={18} /></span>
                  <div>
                    <div className="dash-action-btn-title">
                      {isKm ? 'កំណត់ត្រាការលក់' : 'Sales Records'}
                    </div>
                    <div className="dash-action-btn-sub">
                      {isKm ? 'មើលប្រតិបត្តិការទាំងអស់' : 'Browse every transaction'}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* 7-Day Performance Teaser */}
          <Link to="/dashboard/history" className="dash-week-teaser">
            <span className="dash-week-teaser-icon">
              <BarChart3 size={20} />
            </span>
            <div className="dash-week-teaser-copy">
              <span className="dash-week-teaser-label">
                {isKm ? '៧ ថ្ងៃចុងក្រោយ' : 'Last 7 days'}
              </span>
              <span className="dash-week-teaser-value">
                ${weekTotalUSD.toFixed(2)} <span className="dash-week-teaser-khr">({Math.round(weekTotalKHR).toLocaleString()} KHR)</span>
              </span>
            </div>
            <span className="dash-week-teaser-cta">
              <span>{isKm ? 'មើលរបាយការណ៍' : 'View insights'}</span>
              <ArrowRight size={15} />
            </span>
          </Link>

          {/* Dynamic Recent Transactions Section */}
          <div className="dash-transactions-card">
            <div className="dash-tx-header">
              <h3 className="dash-section-heading">
                {isViewingToday
                  ? (isKm ? 'ប្រតិបត្តិការថ្មីៗ' : 'Recent Transactions')
                  : (isKm ? `ប្រតិបត្តិការនៅថ្ងៃទី ${formattedSelectedDate}` : `Transactions on ${formattedSelectedDate}`)}
              </h3>
              <Link to="/dashboard/transactions" className="dash-view-all-link">
                {isKm ? 'មើលទាំងអស់' : 'View all'}
              </Link>
            </div>

            <div className="dash-tx-list">
              {loading && (
                <div className="dash-list-placeholder">
                  {isKm ? 'កំពុងផ្ទុកទិន្នន័យ...' : 'Loading transactions...'}
                </div>
              )}
              {!loading && transactionsToShow.length === 0 ? (
                <div className="dash-list-placeholder">
                  {isViewingToday
                    ? (isKm ? 'មិនទាន់មានការលក់នៅឡើយទេ។' : 'No sales recorded yet.')
                    : (isKm ? 'មិនមានការលក់នៅថ្ងៃនេះទេ។' : 'No sales recorded on this day.')}
                </div>
              ) : (
                transactionsToShow.map((sale) => {
                  const saleTotals = calculateEquivalentTotals({
                    usd: sale.totalUSD,
                    khr: sale.totalKHR,
                    exchangeRate: EXCHANGE_RATE,
                  });

                  const itemName = summarizeSaleTitle(sale);

                  return (
                    <button
                      type="button"
                      key={sale.saleId || sale.id}
                      className="dash-tx-item"
                      onClick={() => navigate('/dashboard/transactions', { state: { saleId: sale.saleId || sale.id } })}
                    >
                      <div className="dash-tx-left">
                        <div className="dash-tx-icon">
                          <ShoppingCart size={18} />
                        </div>
                        <div>
                          <div className="dash-tx-name">{itemName}</div>
                          <div className="dash-tx-meta">
                            {new Date(sale.date || sale.createdAt || Date.now()).toLocaleDateString(isKm ? 'km-KH' : 'en-US', {
                              month: 'short',
                              day: 'numeric'
                            })} • {isKm ? 'ការលក់' : 'Sale'}
                          </div>
                        </div>
                      </div>
                      <div className="dash-tx-right">
                        <div className="dash-tx-usd">${saleTotals.totalUSD.toFixed(2)}</div>
                        <div className="dash-tx-khr">{Math.round(saleTotals.totalKHR).toLocaleString()} KHR</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}