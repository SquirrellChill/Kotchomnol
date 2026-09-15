import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  Receipt, 
  User, 
  Edit3, 
  Mic, 
  ShoppingCart 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getSales } from '../services/transactionService';
import { calculateEquivalentTotals, APPLICATION_EXCHANGE_RATE } from '../utils/currency';
import { normalizeSaleFromApi, summarizeSaleTitle } from '../utils/sales';
import { buildDashboardProfile } from '../utils/profile';
import UserAvatar from '../components/dashboard/UserAvatar';
import './DashboardPage.css';

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

  // State to hold live sales data
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // Calculate Today's Metrics and Recent Sales
  const { todayTotalUSD, todayTotalKHR, todaySalesCount, recentSales } = useMemo(() => {
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Filter sales strictly made today
    const todaysSales = sales.filter((item) => {
      const saleDate = new Date(item.date || item.createdAt || Date.now());
      return saleDate >= startOfToday;
    });

    // Sum raw amounts for today
    let rawUsd = 0;
    let rawKhr = 0;
    todaysSales.forEach((sale) => {
      rawUsd += Number(sale.totalUSD || 0);
      rawKhr += Number(sale.totalKHR || 0);
    });

    // Calculate unified equivalent totals
    const unified = calculateEquivalentTotals({
      usd: rawUsd,
      khr: rawKhr,
      exchangeRate: EXCHANGE_RATE,
    });

    // Sort recent sales descending (newest first)
    const sorted = [...sales].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB - dateA;
    });

    return {
      todayTotalUSD: unified.totalUSD,
      todayTotalKHR: unified.totalKHR,
      todaySalesCount: todaysSales.length,
      recentSales: sorted.slice(0, 5),
    };
  }, [sales, today]);

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
              {isKm ? `សូមស្វាគមន៍ ${firstName}!` : `Welcome back, ${firstName}!`}
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
                    {isKm ? 'ចំណូលថ្ងៃនេះ' : "Today's Revenue"}
                  </span>
                  <span className="dash-rev-date">{formattedToday}</span>
                </div>

                <div className="dash-rev-amounts">
                  <div>
                    <span className="dash-amt-label">{isKm ? 'សរុប (USD)' : 'Total (USD)'}</span>
                    <span className="dash-usd-val">${todayTotalUSD.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="dash-amt-label">{isKm ? 'សរុប (KHR)' : 'Total (KHR)'}</span>
                    <span className="dash-khr-val">{Math.round(todayTotalKHR).toLocaleString()} KHR</span>
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
                  {isKm ? `ចំនួនការលក់: ${todaySalesCount}` : `Sales count: ${todaySalesCount}`}
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
              </div>
            </div>
          </div>

          {/* Dynamic Recent Transactions Section */}
          <div className="dash-transactions-card">
            <div className="dash-tx-header">
              <h3 className="dash-section-heading">
                {isKm ? 'ប្រតិបត្តិការថ្មីៗ' : 'Recent Transactions'}
              </h3>
              <Link to="/dashboard/transactions" className="dash-view-all-link">
                {isKm ? 'មើលទាំងអស់' : 'View all'}
              </Link>
            </div>

            <div className="dash-tx-list">
              {loading && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                  {isKm ? 'កំពុងផ្ទុកទិន្នន័យ...' : 'Loading transactions...'}
                </div>
              )}
              {!loading && recentSales.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                  {isKm ? 'មិនទាន់មានការលក់នៅឡើយទេ។' : 'No sales recorded yet.'}
                </div>
              ) : (
                recentSales.map((sale) => {
                  const saleTotals = calculateEquivalentTotals({
                    usd: sale.totalUSD,
                    khr: sale.totalKHR,
                    exchangeRate: EXCHANGE_RATE,
                  });

                  const itemName = summarizeSaleTitle(sale);

                  return (
                    <div 
                      key={sale.saleId || sale.id} 
                      className="dash-tx-item"
                      style={{ cursor: 'pointer' }}
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
                    </div>
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