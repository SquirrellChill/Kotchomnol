import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Crown, X } from 'lucide-react';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { buildDashboardProfile } from '../../utils/profile';
import {
  createSubscription,
  getPaymentStatus,
  checkPaymentNow,
  getPaymentQrImageUrl,
} from '../../services/paymentService';
import './GoProPage.css';

const profileFallback = {
  name: 'Seller',
  firstName: 'Seller',
  lastName: '',
};

const POLL_INTERVAL_MS = 4000;

function extractErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => (typeof d === 'string' ? d : d?.msg)).filter(Boolean);
    return msgs.length ? msgs.join(' ') : fallback;
  }
  if (typeof detail === 'object') return detail.msg || fallback;
  return fallback;
}

const PLANS = [
  {
    id: 'free',
    labelEn: 'Free Tier',
    labelKm: 'គម្រោងឥតគិតថ្លៃ',
    taglineEn: 'For getting started',
    taglineKm: 'សម្រាប់ចាប់ផ្តើម',
    price: 0,
    purchasable: false,
    features: [
      { en: 'Basic sales recording', km: 'ការកត់ត្រាការលក់មូលដ្ឋាន' },
      { en: 'Manual entry', km: 'ការបញ្ចូលដោយដៃ' },
      { en: 'Limited voice transactions', km: 'ប្រតិបត្តិការសំឡេងមានកំណត់' },
      { en: 'Daily transaction history', km: 'ប្រវត្តិប្រតិបត្តិការប្រចាំថ្ងៃ' },
      { en: 'Basic revenue overview', km: 'ទិដ្ឋភាពទូទៅនៃចំណូលមូលដ្ឋាន' },
      { en: 'Daily report exports (PNG/PDF)', km: 'ការនាំចេញរបាយការណ៍ប្រចាំថ្ងៃ (PNG/PDF)' },
    ],
  },
  {
    id: 'starter',
    labelEn: 'Starter Plan',
    labelKm: 'ផែនការចាប់ផ្តើម',
    taglineEn: 'For growing businesses',
    taglineKm: 'សម្រាប់អាជីវកម្មកំពុងរីកចម្រើន',
    price: 3.99,
    periodEn: 'month',
    periodKm: 'ខែ',
    popular: true,
    purchasable: true,
    features: [
      { en: 'Everything in Free', km: 'អ្វីៗគ្រប់យ៉ាងនៅក្នុងគម្រោងឥតគិតថ្លៃ' },
      { en: 'Unlimited transactions & history (weekly, monthly)', km: 'ប្រតិបត្តិការ និងប្រវត្តិគ្មានដែនកំណត់ (ប្រចាំសប្តាហ៍, ប្រចាំខែ)' },
      { en: 'Voice-to-transaction', km: 'ការបញ្ចូលដោយសំឡេង' },
      { en: 'Revenue tracking', km: 'ការតាមដានចំណូល' },
      { en: 'Best-selling products', km: 'ផលិតផលលក់ដាច់បំផុត' },
      { en: 'Product management', km: 'ការគ្រប់គ្រងផលិតផល' },
      { en: 'Full report exports (PNG/PDF)', km: 'ការនាំចេញរបាយការណ៍ពេញលេញ (PNG/PDF)' },
    ],
  },
];

export default function GoProPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isKm = language !== 'en';

  const profile = buildDashboardProfile(user, profileFallback);
  const fullDisplayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || 'Seller';

  const [selectedPlanId, setSelectedPlanId] = useState('starter');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [payment, setPayment] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);

  const pollRef = useRef(null);

  const selectedPlan = useMemo(
    () => PLANS.find((p) => p.id === selectedPlanId) || PLANS.find((p) => p.purchasable) || PLANS[0],
    [selectedPlanId]
  );

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (paymentId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getPaymentStatus(paymentId);
        if (data.status === 'paid') {
          stopPolling();
          setPayment((prev) => (prev ? { ...prev, status: 'paid' } : prev));
        } else if (data.status === 'expired' || data.status === 'failed') {
          stopPolling();
          setPayment((prev) => (prev ? { ...prev, status: data.status } : prev));
        }
      } catch {
        // network retry tick
      }
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    return () => {
      stopPolling();
      if (qrImageUrl) URL.revokeObjectURL(qrImageUrl);
    };
  }, []);

  const autoStartRequested = Boolean(location.state?.autoStart);
  const autoStartFiredRef = useRef(false);

  useEffect(() => {
    if (!autoStartRequested || autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    navigate(location.pathname, { replace: true, state: {} });
    handleContinue();
  }, [autoStartRequested]);

  const handleContinue = async () => {
    if (!selectedPlan.purchasable) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const { data } = await createSubscription(selectedPlan.id);
      setPayment(data);
      const url = await getPaymentQrImageUrl(data.id);
      setQrImageUrl(url);
      startPolling(data.id);
    } catch (err) {
      console.error('Failed to start Pro checkout:', err);
      setErrorMsg(
        extractErrorMessage(
          err,
          isKm ? 'មិនអាចបង្កើតការទូទាត់បានទេ។ សូមព្យាយាមម្តងទៀត។' : 'Could not start checkout. Please try again.'
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckNow = async () => {
    if (!payment) return;
    setIsChecking(true);
    try {
      const { data } = await checkPaymentNow(payment.id);
      setPayment((prev) => (prev ? { ...prev, status: data.status } : prev));
      if (data.status !== 'pending') stopPolling();
    } catch {
      // background polling handles retry
    } finally {
      setIsChecking(false);
    }
  };

  const closeModal = () => {
    stopPolling();
    if (qrImageUrl) URL.revokeObjectURL(qrImageUrl);
    setQrImageUrl(null);
    setPayment(null);
  };

  return (
    <MobileAppShell activeTab="profile">
      <div className="gopro-page font-kantumruy">
        <div className="gopro-content">
          <div className="gopro-topbar">
            <button
              type="button"
              className="gopro-back-btn"
              onClick={() => navigate('/dashboard/profile')}
            >
              <ArrowLeft size={18} />
              <span>{isKm ? 'ត្រឡប់ទៅគណនី' : 'Back to Profile'}</span>
            </button>
          </div>

          <div className="gopro-heading">
            <div className="page-title-row">
              <span className="page-icon-badge gold">
                <Crown size={22} />
              </span>
              <div>
                <h1>{isKm ? 'ក្លាយជា Pro' : 'Go Pro'}</h1>
                <p>
                  {isKm
                    ? 'ជ្រើសរើសគម្រោងមួយ ដើម្បីដោះសោការបញ្ចូលគ្មានដែនកំណត់ និងការកត់ត្រាដោយសំឡេង។'
                    : 'Choose a plan to unlock unlimited entries and voice logging.'}
                </p>
              </div>
            </div>
          </div>

          <div className="gopro-hero">
            <div className="gopro-hero-orb" aria-hidden="true" />
            <div className="gopro-hero-copy">
              <div className="gopro-hero-crown" aria-hidden="true">
                <Crown size={28} fill="#fbbf24" />
              </div>
              <h2>{isKm ? 'លក់វៃឆ្លាតជាមួយ KotChomnol Pro' : 'Sell smarter with KotChomnol Pro'}</h2>
              <p>
                {isKm
                  ? 'ការបញ្ចូលគ្មានដែនកំណត់ ការកត់ត្រាដោយសំឡេង និងការយល់ដឹងអំពីរូបិយប័ណ្ណច្រើនប្រភេទសម្រាប់ការលក់របស់អ្នក។'
                  : 'Unlimited entries, voice logging, and multi-currency insight for your cart.'}
              </p>
            </div>
          </div>

          <div className="gopro-grid">
            <div className="gopro-plans">
              {PLANS.map((plan) => {
                const isActive = plan.id === selectedPlanId;
                const isFree = !plan.purchasable;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    className={`gopro-plan-card ${isActive ? 'active' : ''} ${isFree ? 'gopro-plan-card-static' : ''}`}
                    onClick={() => plan.purchasable && setSelectedPlanId(plan.id)}
                    aria-pressed={isActive}
                    aria-disabled={isFree}
                  >
                    {plan.popular && (
                      <span className="gopro-popular-badge">
                        {isKm ? 'ពេញនិយមបំផុត' : 'MOST POPULAR'}
                      </span>
                    )}

                    <div className="gopro-plan-row">
                      <div className="gopro-plan-left">
                        <span className="gopro-plan-tagline">
                          {isKm ? plan.taglineKm : plan.taglineEn}
                        </span>
                        <span className="gopro-plan-name">{isKm ? plan.labelKm : plan.labelEn}</span>
                        {isFree && (
                          <span className="gopro-plan-period-pill">
                            {isKm ? 'គម្រោងបច្ចុប្បន្នរបស់អ្នក' : 'Your current plan'}
                          </span>
                        )}
                      </div>
                      <div className="gopro-plan-right">
                        <span className="gopro-plan-price">
                          {plan.price === 0 ? (isKm ? '0$' : '$0') : `$${plan.price.toFixed(2)}`}
                        </span>
                        {plan.periodEn && (
                          <span className="gopro-plan-original">
                            / {isKm ? plan.periodKm : plan.periodEn}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              <p className="gopro-cta-note" style={{ textAlign: 'left', padding: '0 4px' }}>
                {isKm
                  ? `អ្នកកំពុងលក់ក្នុងនាម ${fullDisplayName}`
                  : `Signed in as ${fullDisplayName}`}
              </p>
            </div>

            <div className="gopro-side">
              <div className="gopro-features-card">
                <div className="gopro-feature-row">
                  <span className="gopro-feature-label" style={{ fontWeight: 700 }}>
                    {isKm ? `រួមបញ្ចូលក្នុង ${selectedPlan.labelKm}` : `Included in ${selectedPlan.labelEn}`}
                  </span>
                </div>
                {selectedPlan.features.map((f, idx) => (
                  <div className="gopro-feature-row" key={idx}>
                    <span className="gopro-feature-label">{isKm ? f.km : f.en}</span>
                    <Check size={16} className="gopro-feature-check" />
                  </div>
                ))}
              </div>

              <div className="gopro-cta-card">
                <button
                  type="button"
                  className="gopro-continue-btn"
                  onClick={handleContinue}
                  disabled={isProcessing || !selectedPlan.purchasable}
                >
                  {isProcessing
                    ? isKm
                      ? 'កំពុងដំណើរការ...'
                      : 'Processing...'
                    : selectedPlan.price === 0
                    ? isKm
                      ? 'អ្នកកំពុងប្រើគម្រោងនេះ'
                      : "You're on this plan"
                    : isKm
                    ? `បន្ត — $${selectedPlan.price.toFixed(2)} / ${selectedPlan.periodKm}`
                    : `Continue — $${selectedPlan.price.toFixed(2)} / ${selectedPlan.periodEn}`}
                </button>
                {errorMsg && <p className="gopro-cta-error">{errorMsg}</p>}
                <p className="gopro-cta-note">
                  {isKm
                    ? 'បង់ប្រាក់តាម KHQR — លុបចោលបានគ្រប់ពេល គ្មានការបន្តដោយស្វ័យប្រវត្តិ'
                    : 'Pay by KHQR — cancel anytime, no auto-renewal'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {payment && (
          <div className="gopro-modal-overlay" onClick={closeModal}>
            <div className="gopro-modal" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="gopro-modal-close" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>

              {payment.status === 'paid' ? (
                <div className="gopro-modal-state">
                  <Check size={36} className="gopro-feature-check" />
                  <h3>{isKm ? 'ការទូទាត់ជោគជ័យ!' : 'Payment successful!'}</h3>
                  <p>{isKm ? 'គណនីរបស់អ្នកឥឡូវនេះគឺជា Pro រួចហើយ។' : 'Your account is now Pro.'}</p>
                  <button type="button" className="gopro-continue-btn" onClick={() => navigate('/dashboard/profile')}>
                    {isKm ? 'ទៅកាន់គណនី' : 'Go to profile'}
                  </button>
                </div>
              ) : payment.status === 'expired' || payment.status === 'failed' ? (
                <div className="gopro-modal-state">
                  <h3>{isKm ? 'ការទូទាត់មិនបានសម្រេច' : 'Payment not completed'}</h3>
                  <p>
                    {isKm
                      ? 'QR ផុតកំណត់ ឬការទូទាត់បរាជ័យ។ សូមព្យាយាមម្តងទៀត។'
                      : 'The QR expired or the payment failed. Please try again.'}
                  </p>
                  <button type="button" className="gopro-continue-btn" onClick={closeModal}>
                    {isKm ? 'បិទ' : 'Close'}
                  </button>
                </div>
              ) : (
                <div className="gopro-modal-state">
                  <h3>{isKm ? 'ស្កេន QR ដើម្បីទូទាត់' : 'Scan to pay'}</h3>
                  <p className="gopro-modal-amount">${Number(payment.amount).toFixed(2)}</p>
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt="Bakong KHQR" className="gopro-qr-image" />
                  ) : (
                    <div className="gopro-qr-loading" />
                  )}
                  {payment.deeplink && (
                    <a className="gopro-deeplink-btn" href={payment.deeplink} target="_blank" rel="noreferrer">
                      {isKm ? 'បើកកម្មវិធី Bakong' : 'Open in Bakong app'}
                    </a>
                  )}
                  <button
                    type="button"
                    className="gopro-continue-btn"
                    onClick={handleCheckNow}
                    disabled={isChecking}
                  >
                    {isChecking
                      ? isKm
                        ? 'កំពុងពិនិត្យ...'
                        : 'Checking...'
                      : isKm
                      ? 'ខ្ញុំបានទូទាត់រួច'
                      : "I've paid"}
                  </button>
                  <p className="gopro-cta-note">
                    {isKm ? 'កំពុងរង់ចាំការទូទាត់ដោយស្វ័យប្រវត្តិ...' : 'Waiting for payment automatically...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MobileAppShell>
  );
}