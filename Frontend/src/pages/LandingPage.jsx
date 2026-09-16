import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sun, Moon, Mic, BarChart3, ShieldCheck, Menu, X, 
  Check, Mail, ChevronDown, ArrowRight, ShoppingCart, 
  FileText 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  createSubscription,
  getPaymentStatus,
  checkPaymentNow,
  getPaymentQrImageUrl,
} from '../services/paymentService';
import './LandingPage.css';
import './dashboard/GoProPage.css';
import faqPhoto from '../assets/image 1.png';

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

function FacebookIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.5 9.87v-6.99H7.9v-2.88h2.6V9.84c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.88h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

function InstagramIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TelegramIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.5 3.5 3.2 10.6c-.8.3-.8 1.4.1 1.7l4.6 1.5 1.8 5.7c.2.7 1.1.9 1.6.4l2.5-2.4 4.7 3.5c.7.5 1.6.1 1.8-.7L23 4.7c.2-.9-.7-1.6-1.5-1.2zM9.4 13.8l7.7-6.6c.3-.3.7.1.4.4l-6.4 7.4-.3 3.1c-.1.3-.5.3-.6 0z" />
    </svg>
  );
}

function TikTokIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.3 1.9 1.5 3.5 3.2 4.3v3a7.1 7.1 0 0 1-3.2-.9v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.8 2.5V3h2.9z" />
    </svg>
  );
}

const content = {
  km: {
    navHome: 'ទំព័រដើម',
    navFeatures: 'មុខងារ',
    navPricing: 'តម្លៃ',
    navFaq: 'សំណួរ',
    navAbout: 'អំពីយើង',
    navTerms: 'លក្ខខណ្ឌ',
    navPrivacy: 'ឯកជនភាព',
    navContact: 'ទំនាក់ទំនង',
    navSignIn: 'ចូលគណនី',
    navStartFree: 'ចាប់ផ្ដើម',
    navDashboard: 'កម្មវិធី',
    navLogout: 'ចាកចេញ',
    heroBadge: 'បង្កើតសម្រាប់ម្ចាស់ហាងខ្មែរ',
    heroTitle1: 'និយាយការលក់របស់អ្នក ',
    heroTitle2: 'មើលចំណូលរបស់អ្នក',
    heroSub: 'និយាយការលក់ក្នុងហាង ហើយបម្លែងទៅជាកំណត់ត្រាលក់ សង្ខេបចំណូល និងបញ្ជីដែលអាចពិនិត្យបាន។',
    heroBtnPrimaryAuth: 'កត់ត្រាការលក់',
    heroBtnPrimaryGuest: 'បង្កើតគណនី',
    heroBtnSecondaryAuth: 'ទំព័រដើម',
    heroBtnSecondaryGuest: 'ចូលគណនី',
    heroDisclaimer: 'គ្មានទិន្នន័យក្លែងក្លាយ​ ការលក់ដែលបានបញ្ជាក់ត្រូវបានរក្សាទុកតាមគណនីរបស់អ្នក។',
    revLabel: 'ចំណូលថ្ងៃនេះ',
    revBadge: 'ផ្សាយផ្ទាល់',
    revUsd: 'សមមូល: $10.25',
    revVoiceTitle: 'កត់ត្រាតាមសំឡេង',
    revVoiceStatus: 'AI បានស្គាល់',
    revItem1: 'កាហ្វេទឹកដោះគោទឹកកក x2',
    revItem2: 'នំប៉័ងក្រូសង់ x1',
    statTime: 'ពេលកត់ត្រាជាមធ្យម',
    statCurrency: 'គាំទ្រទ្វេដង',
    statCloud: 'Cloud Safe',
    featuresTitle: 'Key Capabilities',
    featuresSub: 'Built for the daily speed of local businesses',
    feat1Title: 'Khmer & English Voice Entry',
    feat1Desc: 'Record spoken sales, answer follow-ups if needed, and review extracted items before saving.',
    feat2Title: 'Saved Sales Revenue Tracking',
    feat2Desc: 'Clear revenue summaries with automated daily reports that are effortless to track.',
    feat3Title: 'Secure Account Workspace',
    feat3Desc: 'Your shop data is securely saved with cloud infrastructure and access protection.',
    feat1BadgeVoiceText: 'លក់ទឹកសុទ្ធ 5 ដប',
    feat1BadgeResultText: 'Sold 5 bottles of water',
    feat2BadgeToday: 'Today',
    feat2BadgeRevenue: "Today's Revenue",
    feat2BadgeSales: 'Sales',
    feat2BadgeOrders: 'Orders',
    feat3BadgeTitle: 'Your data is safe',
    feat3BadgeSub: 'Powered by secure cloud',
    pricingTitle: 'គម្រោង និងតម្លៃ',
    pricingSub: 'ចាប់ផ្តើមឥតគិតថ្លៃ ហើយដំឡើងកម្រិតនៅពេលអាជីវកម្មរបស់អ្នករីកចម្រើន',
    pricingPopular: 'ពេញនិយមបំផុត',
    pricingFreeLabel: 'Free Tier',
    pricingFreeTagline: 'For getting started',
    pricingFreePrice: '$0',
    pricingFreePeriod: 'forever',
    pricingStarterLabel: 'Starter Plan',
    pricingStarterTagline: 'For growing businesses',
    pricingStarterPrice: '$3.99',
    pricingStarterPeriod: '/month',
    pricingBtnFree: 'Start Free',
    pricingBtnStarter: 'Go Pro',
    faqTitle: 'Frequently Asked Questions',
    faq1Q: 'Can I review sales before saving?',
    faq1A: 'Yes. Voice results open in a review page so you can edit quantities and prices before confirming.',
    faq2Q: 'Does revenue come from verified transactions?',
    faq2A: 'Yes. All revenue is computed strictly from actual saved items and synced in real time.',
    faq3Q: 'Can I speak in Khmer?',
    faq3A: 'Our system natively supports Khmer and English voice entry and translation.',
    ctaDesc: 'និយាយការលក់ក្នុងហាង ហើយបម្លែងទៅជាកំណត់ត្រាលក់ សង្ខេបចំណូល និងបញ្ជីដែលអាចពិនិត្យបាន។',
    ctaBtn: 'ចាប់ផ្ដើមឥតគិតថ្លៃ',
    footerHome: 'ទំព័រដើម',
    footerFeatures: 'មុខងារ',
    footerAbout: 'អំពីយើង',
    footerTerms: 'លក្ខខណ្ឌ',
    footerPrivacy: 'ឯកជនភាព',
    footerContact: 'ទំនាក់ទំនង',
    footerCopyright: 'រក្សាសិទ្ធិ 2026 KOTCHOMNOL​ រក្សាសិទ្ធិគ្រប់យ៉ាង',
    footerDesc: 'KOTCHOMNOL ជួយម្ចាស់ហាងកត់ត្រាការលក់ដោយសំឡេង ឬបញ្ចូលដោយដៃ ពិនិត្យទំនិញនីមួយៗ ហើយរក្សាទុកប្រតិបត្តិការដែលបានបញ្ជាក់ទៅក្នុងកំណត់ត្រាចំណូលដែលបានផ្ទៀងផ្ទាត់។',
  },
  en: {
    navHome: 'Home',
    navFeatures: 'Features',
    navPricing: 'Pricing',
    navFaq: 'FAQ',
    navAbout: 'About',
    navTerms: 'Terms',
    navPrivacy: 'Privacy',
    navContact: 'Contact',
    navSignIn: 'Sign In',
    navStartFree: 'Start Free',
    navDashboard: 'App',
    navLogout: 'Logout',
    heroBadge: 'Built for Cambodian Shop Owners',
    heroTitle1: 'Speak your sales. ',
    heroTitle2: 'See your revenue.',
    heroSub: 'Speak in-store sales naturally, convert speech to sales records, revenue summaries, and reviewable lists.',
    heroBtnPrimaryAuth: 'Record Sale',
    heroBtnPrimaryGuest: 'Create Account',
    heroBtnSecondaryAuth: 'Home',
    heroBtnSecondaryGuest: 'Sign In',
    heroDisclaimer: 'No fake data. Verified sales are saved directly to your account.',
    revLabel: "Today's Revenue",
    revBadge: 'Live Sync',
    revUsd: 'Equivalent: $10.25',
    revVoiceTitle: 'Voice-to-sales',
    revVoiceStatus: 'AI Matched',
    revItem1: 'Iced coffee x2',
    revItem2: 'Croissant x1',
    statTime: 'Avg log time',
    statCurrency: 'Dual Currency',
    statCloud: 'Cloud Safe',
    featuresTitle: 'Key Capabilities',
    featuresSub: 'Built for the daily speed of local businesses',
    feat1Title: 'Khmer & English Voice Entry',
    feat1Desc: 'Record spoken sales naturally, answer follow-ups if needed, and review extracted items before saving.',
    feat2Title: 'Saved Sales Revenue Tracking',
    feat2Desc: 'Clear revenue summaries with automated daily reports that are effortless to track.',
    feat3Title: 'Secure Account Workspace',
    feat3Desc: 'Your shop data is securely saved with cloud infrastructure and access protection.',
    feat1BadgeVoiceText: 'លក់ទឹកសុទ្ធ 5 ដប',
    feat1BadgeResultText: 'Sold 5 bottles of water',
    feat2BadgeToday: 'Today',
    feat2BadgeRevenue: "Today's Revenue",
    feat2BadgeSales: 'Sales',
    feat2BadgeOrders: 'Orders',
    feat3BadgeTitle: 'Your data is safe',
    feat3BadgeSub: 'Powered by secure cloud',
    pricingTitle: 'Plans & Pricing',
    pricingSub: 'Start free, upgrade as your business grows',
    pricingPopular: 'Most Popular',
    pricingFreeLabel: 'Free Tier',
    pricingFreeTagline: 'For getting started',
    pricingFreePrice: '$0',
    pricingFreePeriod: 'forever',
    pricingStarterLabel: 'Starter Plan',
    pricingStarterTagline: 'For growing businesses',
    pricingStarterPrice: '$3.99',
    pricingStarterPeriod: '/month',
    pricingBtnFree: 'Start Free',
    pricingBtnStarter: 'Go Pro',
    faqTitle: 'Frequently Asked Questions',
    faq1Q: 'Can I review sales before saving?',
    faq1A: 'Yes. Voice results open in a review page so you can edit quantities and prices before confirming.',
    faq2Q: 'Does revenue come from verified transactions?',
    faq2A: 'Yes. All revenue is computed strictly from actual saved items and synced in real time.',
    faq3Q: 'Can I speak in Khmer?',
    faq3A: 'Our system natively supports Khmer and English voice entry and translation.',
    ctaDesc: 'Speak in-store sales, automate bookkeeping, and manage cash flow with zero paperwork.',
    ctaBtn: 'Start Free',
    footerHome: 'Home',
    footerFeatures: 'Features',
    footerAbout: 'About',
    footerTerms: 'Terms',
    footerPrivacy: 'Privacy',
    footerContact: 'Contact',
    footerCopyright: '© 2026 KOTCHOMNOL. All rights reserved.',
    footerDesc: 'KOTCHOMNOL helps shop owners log sales via voice or manual entry, review each line item, and store confirmed transactions in a verified ledger.',
  }
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeLang = language === 'en' ? 'en' : 'km';
  const txt = content[activeLang];

  const hasStoredSession = Boolean(localStorage.getItem('kc_token') || localStorage.getItem('kc_user'));
  const isLoggedIn = Boolean(user || hasStoredSession);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const faqItems = [
    { q: txt.faq1Q, a: txt.faq1A },
    { q: txt.faq2Q, a: txt.faq2A },
    { q: txt.faq3Q, a: txt.faq3A },
  ];

  const closeMenu = () => setMobileMenuOpen(false);

  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    closeMenu();
    const elem = document.getElementById(targetId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const [payment, setPayment] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const pollRef = useRef(null);

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
        // network polling retry
      }
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    return () => {
      stopPolling();
      if (qrImageUrl) URL.revokeObjectURL(qrImageUrl);
    };
  }, []);

  const closeCheckoutModal = () => {
    stopPolling();
    if (qrImageUrl) URL.revokeObjectURL(qrImageUrl);
    setQrImageUrl(null);
    setPayment(null);
    setCheckoutError(null);
  };

  const handleGoPro = async () => {
    closeMenu();
    if (!isLoggedIn) {
      navigate('/register');
      return;
    }
    setCheckoutError(null);
    setIsStartingCheckout(true);
    try {
      const { data } = await createSubscription('starter');
      setPayment(data);
      const url = await getPaymentQrImageUrl(data.id);
      setQrImageUrl(url);
      startPolling(data.id);
    } catch (err) {
      console.error('Failed to start Pro checkout:', err);
      setCheckoutError(
        extractErrorMessage(
          err,
          activeLang === 'km'
            ? 'មិនអាចបង្កើតការទូទាត់បានទេ។ សូមព្យាយាមម្តងទៀត។'
            : 'Could not start checkout. Please try again.'
        )
      );
    } finally {
      setIsStartingCheckout(false);
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
      // polling continues
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="landing-page font-kantumruy">
      {/* Floating Header */}
      <header className="landing-navbar-wrapper">
        <div className="landing-navbar">
          {/* Logo */}
          <button 
            className="landing-brand-btn" 
            type="button" 
            onClick={() => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <img src="/logo-mascot.png" alt="KOTCHOMNOL" className="landing-brand-icon" />
            <span className="landing-brand-title">KOTCHOMNOL</span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="landing-nav-links" aria-label="Primary Navigation">
            <a href="#top" onClick={() => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              {txt.navHome}
            </a>
            <a href="#features" onClick={(e) => handleNavClick(e, 'features')}>{txt.navFeatures}</a>
            <a href="#pricing" onClick={(e) => handleNavClick(e, 'pricing')}>{txt.navPricing}</a>
            <a href="#faq" onClick={(e) => handleNavClick(e, 'faq')}>{txt.navFaq}</a>
          </nav>

          {/* Nav Right Controls */}
          <div className="landing-nav-right">
            <div className="desktop-controls">
              <button 
                type="button" 
                className="landing-theme-btn" 
                onClick={toggleTheme}
                aria-label="Toggle theme mode"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button 
                type="button" 
                className="landing-lang-btn" 
                onClick={toggleLanguage}
                aria-label="Toggle language"
              >
                <img
                  src={language === 'en' ? 'https://flagcdn.com/w40/gb.png' : 'https://flagcdn.com/w40/kh.png'}
                  alt={language === 'en' ? 'Khmer' : 'English'}
                  width="22"
                  height="16"
                  style={{ borderRadius: '3px', objectFit: 'cover', display: 'block' }}
                />
              </button>
            </div>

            <div className="landing-auth-buttons">
              {isLoggedIn ? (
                <button 
                  type="button" 
                  className="landing-primary-btn compact" 
                  onClick={() => navigate('/dashboard')}
                >
                  {txt.navDashboard}
                </button>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="landing-text-btn" 
                    onClick={() => navigate('/login')}
                  >
                    {txt.navSignIn}
                  </button>
                  <button 
                    type="button" 
                    className="landing-primary-btn compact btn-start-free" 
                    onClick={() => navigate('/register')}
                  >
                    <span>{txt.navStartFree}</span>
                    <ArrowRight size={16} className="btn-start-free-arrow" />
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              className="landing-hamburger-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div 
        className={`landing-drawer-backdrop ${mobileMenuOpen ? 'open' : ''}`} 
        onClick={closeMenu}
      />

      {/* Mobile Drawer Menu */}
      <aside className={`landing-drawer-panel ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="drawer-header-row">
          <button 
            type="button" 
            className="drawer-x-btn" 
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="drawer-nav-links">
          <a href="#top" onClick={() => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            {txt.navHome}
          </a>
          <a href="#features" onClick={(e) => handleNavClick(e, 'features')}>{txt.navFeatures}</a>
          <a href="#pricing" onClick={(e) => handleNavClick(e, 'pricing')}>{txt.navPricing}</a>
          <a href="#faq" onClick={(e) => handleNavClick(e, 'faq')}>{txt.navFaq}</a>

          <button 
            type="button" 
            className="drawer-list-btn" 
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <button 
            type="button" 
            className="drawer-list-btn" 
            onClick={toggleLanguage}
          >
            <span>{language === 'en' ? 'KH Khmer' : 'EN English'}</span>
          </button>
        </nav>
      </aside>

      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-container">
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-hero-badge">
                {txt.heroBadge}
              </span>

              <h1 className="landing-hero-h1">
                {txt.heroTitle1}<span className="highlight">{txt.heroTitle2}</span>
              </h1>

              <p className="landing-hero-sub">
                {txt.heroSub}
              </p>

              <div className="landing-hero-actions">
                <button 
                  type="button" 
                  className="hero-btn-primary" 
                  onClick={() => navigate(isLoggedIn ? '/dashboard/voice' : '/register')}
                >
                  {isLoggedIn ? txt.heroBtnPrimaryAuth : txt.heroBtnPrimaryGuest}
                </button>
                <button 
                  type="button" 
                  className="hero-btn-secondary" 
                  onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')}
                >
                  {isLoggedIn ? txt.heroBtnSecondaryAuth : txt.heroBtnSecondaryGuest}
                </button>
              </div>

              <p className="landing-hero-disclaimer">
                {txt.heroDisclaimer}
              </p>
            </div>

            <div className="landing-hero-preview">
              <div className="revenue-card">
                <div className="rev-header">
                  <span className="rev-header-label">{txt.revLabel}</span>
                  <span className="rev-badge">{txt.revBadge}</span>
                </div>

                <div className="rev-amount-block">
                  <div className="rev-main-amount">42,000 KHR</div>
                  <div className="rev-usd-amount">{txt.revUsd}</div>
                </div>

                <div className="rev-voice-box">
                  <div className="voice-box-header">
                    <span>{txt.revVoiceTitle}</span>
                    <span>{txt.revVoiceStatus}</span>
                  </div>
                  <div className="voice-item-row">
                    <span>{txt.revItem1}</span>
                    <strong>4,000 KHR</strong>
                  </div>
                  <div className="voice-item-row">
                    <span>{txt.revItem2}</span>
                    <strong>6,000 KHR</strong>
                  </div>
                </div>

                <div className="rev-metrics-grid">
                  <div className="rev-metric-col">
                    <span className="metric-val">30s</span>
                    <span className="metric-sub">{txt.statTime}</span>
                  </div>
                  <div className="rev-metric-col">
                    <span className="metric-val">KHR/USD</span>
                    <span className="metric-sub">{txt.statCurrency}</span>
                  </div>
                  <div className="rev-metric-col">
                    <span className="metric-val">24/7</span>
                    <span className="metric-sub">{txt.statCloud}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Column Immersive Feature Cards */}
      <section id="features" className="landing-features-section">
        <div className="landing-container">
          <div className="section-title-wrap">
            <h2>{txt.featuresTitle}</h2>
            <p>{txt.featuresSub}</p>
          </div>

          <div className="photo-features-grid">
            {/* CARD 1: Voice Entry */}
            <div className="photo-card photo-card-1">
              <div className="photo-card-bg card-bg-1" />
              <div className="photo-card-gradient" />

              <div className="photo-card-top">
                <div className="photo-card-icon">
                  <Mic size={20} strokeWidth={2.4} />
                </div>
                <h3>{txt.feat1Title}</h3>
                <p>{txt.feat1Desc}</p>
              </div>

              <div className="photo-card-bottom">
                <div className="floating-ui-badge voice-ui-badge">
                  <div className="voice-wave-row">
                    <div className="voice-round-btn">
                      <Mic size={16} />
                    </div>
                    <div className="soundwave-anim">
                      <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
                    </div>
                  </div>
                  <div className="voice-badge-text-primary">
                    {txt.feat1BadgeVoiceText}
                  </div>
                  <div className="voice-badge-text-sub">
                    <Check size={13} className="voice-check-icon" />
                    <span>{txt.feat1BadgeResultText}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: Revenue Tracking */}
            <div className="photo-card photo-card-2">
              <div className="photo-card-bg card-bg-2" />
              <div className="photo-card-gradient" />

              <div className="photo-card-top">
                <div className="photo-card-icon">
                  <BarChart3 size={20} strokeWidth={2.4} />
                </div>
                <h3>{txt.feat2Title}</h3>
                <p>{txt.feat2Desc}</p>
              </div>

              <div className="photo-card-bottom">
                <div className="floating-ui-badge chart-ui-badge">
                  <div className="chart-badge-header">
                    <div>
                      <span className="chart-label">{txt.feat2BadgeRevenue}</span>
                      <div className="chart-amount">$128.50</div>
                    </div>
                    <span className="chart-filter-pill">
                      {txt.feat2BadgeToday} <ChevronDown size={12} />
                    </span>
                  </div>

                  {/* SVG Line Graph */}
                  <div className="chart-svg-wrap">
                    <svg viewBox="0 0 160 36" preserveAspectRatio="none" className="revenue-curve-svg">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d="M0,32 Q25,28 45,24 T95,16 T135,10 T160,6 L160,36 L0,36 Z" fill="url(#chartGrad)" />
                      <path d="M0,32 Q25,28 45,24 T95,16 T135,10 T160,6" fill="none" stroke="#7c3aed" strokeWidth="2.4" />
                      <circle cx="45" cy="24" r="2.5" fill="#7c3aed" />
                      <circle cx="95" cy="16" r="2.5" fill="#7c3aed" />
                      <circle cx="160" cy="6" r="2.5" fill="#7c3aed" />
                    </svg>
                  </div>

                  <div className="chart-metrics-row">
                    <div className="chart-stat-item">
                      <ShoppingCart size={14} className="stat-icon" />
                      <div>
                        <strong>24</strong>
                        <span>{txt.feat2BadgeSales}</span>
                      </div>
                    </div>
                    <div className="chart-stat-item">
                      <FileText size={14} className="stat-icon" />
                      <div>
                        <strong>18</strong>
                        <span>{txt.feat2BadgeOrders}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: Secure Workspace */}
            <div className="photo-card photo-card-3">
              <div className="photo-card-bg card-bg-3" />
              <div className="photo-card-gradient" />

              <div className="photo-card-top">
                <div className="photo-card-icon">
                  <ShieldCheck size={20} strokeWidth={2.4} />
                </div>
                <h3>{txt.feat3Title}</h3>
                <p>{txt.feat3Desc}</p>
              </div>

              <div className="photo-card-bottom">
                <div className="floating-ui-badge security-ui-badge">
                  <div className="security-icon-circle">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div className="security-badge-title">{txt.feat3BadgeTitle}</div>
                    <div className="security-badge-sub">{txt.feat3BadgeSub}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="landing-pricing-section">
        <div className="landing-container">
          <div className="section-title-wrap">
            <h2>{txt.pricingTitle}</h2>
            <p>{txt.pricingSub}</p>
          </div>

          <div className="pricing-grid">
            {/* Free Tier */}
            <div className="pricing-card">
              <div className="pricing-card-head">
                <h3>{txt.pricingFreeLabel}</h3>
                <p className="pricing-tagline">{txt.pricingFreeTagline}</p>
              </div>
              <div className="pricing-price">
                <span className="pricing-amount">{txt.pricingFreePrice}</span>
                <span className="pricing-period">{txt.pricingFreePeriod}</span>
              </div>
              <ul className="pricing-features">
                <li>{activeLang === 'en' ? 'Basic sales recording' : 'ការកត់ត្រាការលក់មូលដ្ឋាន'}</li>
                <li>{activeLang === 'en' ? 'Manual entry' : 'ការបញ្ចូលដោយដៃ'}</li>
                <li>{activeLang === 'en' ? 'Limited voice transactions' : 'ប្រតិបត្តិការសំឡេងមានកំណត់'}</li>
                <li>{activeLang === 'en' ? 'Daily transaction history' : 'ប្រវត្តិប្រតិបត្តិការប្រចាំថ្ងៃ'}</li>
                <li>{activeLang === 'en' ? 'Basic revenue overview' : 'ទិដ្ឋភាពទូទៅនៃចំណូលមូលដ្ឋាន'}</li>
                <li>{activeLang === 'en' ? 'Daily report exports (PNG/PDF)' : 'ការនាំចេញរបាយការណ៍ប្រចាំថ្ងៃ (PNG/PDF)'}</li>
              </ul>
              <button
                type="button"
                className="pricing-btn pricing-btn-outline"
                onClick={() => navigate(isLoggedIn ? '/dashboard/voice' : '/register')}
              >
                {txt.pricingBtnFree}
              </button>
            </div>

            {/* Starter Plan */}
            <div className="pricing-card pricing-card-popular">
              <span className="pricing-popular-badge">{txt.pricingPopular}</span>
              <div className="pricing-card-head">
                <h3>{txt.pricingStarterLabel}</h3>
                <p className="pricing-tagline">{txt.pricingStarterTagline}</p>
              </div>
              <div className="pricing-price">
                <span className="pricing-amount">{txt.pricingStarterPrice}</span>
                <span className="pricing-period">{txt.pricingStarterPeriod}</span>
              </div>
              <ul className="pricing-features">
                <li>{activeLang === 'en' ? 'Everything in Free' : 'អ្វីៗគ្រប់យ៉ាងនៅក្នុងគម្រោងឥតគិតថ្លៃ'}</li>
                <li>{activeLang === 'en' ? 'Unlimited transactions & history (weekly, monthly)' : 'ប្រតិបត្តិការ និងប្រវត្តិគ្មានដែនកំណត់ (ប្រចាំសប្តាហ៍, ប្រចាំខែ)'}</li>
                <li>{activeLang === 'en' ? 'Voice-to-transaction' : 'ការបញ្ចូលដោយសំឡេង'}</li>
                <li>{activeLang === 'en' ? 'Revenue tracking' : 'ការតាមដានចំណូល'}</li>
                <li>{activeLang === 'en' ? 'Best-selling products' : 'ផលិតផលលក់ដាច់បំផុត'}</li>
                <li>{activeLang === 'en' ? 'Product management' : 'ការគ្រប់គ្រងផលិតផល'}</li>
                <li>{activeLang === 'en' ? 'Full report exports (PNG/PDF)' : 'ការនាំចេញរបាយការណ៍ពេញលេញ (PNG/PDF)'}</li>
              </ul>
              <button
                type="button"
                className="pricing-btn pricing-btn-filled"
                onClick={handleGoPro}
                disabled={isStartingCheckout}
              >
                {isStartingCheckout
                  ? (activeLang === 'km' ? 'កំពុងដំណើរការ...' : 'Processing...')
                  : txt.pricingBtnStarter}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section (Rounded Rectangle Photo Card) */}
      <section id="faq" className="landing-faq-section">
        <div className="landing-container">
          <div className="faq-layout">
            <div className="faq-content">
              <span className="section-eyebrow">FAQ</span>
              <h2 className="faq-title">{txt.faqTitle}</h2>

              <div className="faq-accordion">
                {faqItems.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div key={index} className={`faq-accordion-item ${isOpen ? 'open' : ''}`}>
                      <button
                        type="button"
                        className="faq-accordion-trigger"
                        onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                        aria-expanded={isOpen}
                      >
                        <span>{item.q}</span>
                        <ChevronDown size={18} className="faq-accordion-chevron" />
                      </button>
                      <div className="faq-accordion-panel">
                        <p>{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="faq-visual" aria-hidden="true">
              <div className="faq-visual-card">
                <img
                  src={faqPhoto}
                  alt="Customer support assistant"
                  className="faq-photo-img"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="landing-cta-banner">
        <div className="faq-container">
          <h2>KOTCHOMNOL</h2>
          <p>{txt.ctaDesc}</p>
          <button 
            type="button" 
            className="cta-white-btn btn-start-free btn-start-free--gold" 
            onClick={() => navigate(isLoggedIn ? '/dashboard/voice' : '/register')}
          >
            <span>{txt.ctaBtn}</span>
            <ArrowRight size={18} className="btn-start-free-arrow" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top-row">
            <div className="footer-brand-col">
              <div className="footer-brand-logo">
                <img src="/logo-mascot.png" alt="KOTCHOMNOL" className="footer-brand-icon" />
                <span className="footer-brand-title">KOTCHOMNOL</span>
              </div>
              <p className="footer-brand-desc">
                {txt.footerDesc}
              </p>
              <div className="footer-social-row">
                <Link to="/contact" className="footer-contact-icon-btn" aria-label={txt.navContact}>
                  <Mail size={18} />
                </Link>
                <a
                  href="https://facebook.com/kotchomnol"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-contact-icon-btn"
                  aria-label="Facebook"
                >
                  <FacebookIcon size={18} />
                </a>
                <a
                  href="https://instagram.com/kotchomnol"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-contact-icon-btn"
                  aria-label="Instagram"
                >
                  <InstagramIcon size={18} />
                </a>
                <a
                  href="https://t.me/kotchomnol"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-contact-icon-btn"
                  aria-label="Telegram"
                >
                  <TelegramIcon size={18} />
                </a>
                <a
                  href="https://tiktok.com/@kotchomnol"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-contact-icon-btn"
                  aria-label="TikTok"
                >
                  <TikTokIcon size={18} />
                </a>
              </div>
            </div>

            <div className="footer-links-col">
              <a href="#top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>{txt.footerHome}</a>
              <a href="#features" onClick={(e) => handleNavClick(e, 'features')}>{txt.footerFeatures}</a>
              <Link to="/about">{txt.footerAbout}</Link>
              <Link to="/terms">{txt.footerTerms}</Link>
              <Link to="/privacy">{txt.footerPrivacy}</Link>
            </div>
          </div>

          <div className="footer-bottom-row">
            <p>{txt.footerCopyright}</p>
            <p>support@kotchomnol.ai</p>
          </div>
        </div>
      </footer>

      {/* Bakong Checkout Modal */}
      {payment && (
        <div className="gopro-modal-overlay" onClick={closeCheckoutModal}>
          <div className="gopro-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="gopro-modal-close"
              onClick={closeCheckoutModal}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {payment.status === 'paid' ? (
              <div className="gopro-modal-state">
                <Check size={36} className="gopro-feature-check" />
                <h3>{activeLang === 'km' ? 'ការទូទាត់ជោគជ័យ!' : 'Payment successful!'}</h3>
                <p>
                  {activeLang === 'km'
                    ? 'គណនីរបស់អ្នកឥឡូវនេះគឺជា Pro រួចហើយ។'
                    : 'Your account is now Pro.'}
                </p>
                <button
                  type="button"
                  className="gopro-continue-btn"
                  onClick={() => {
                    closeCheckoutModal();
                    navigate('/dashboard');
                  }}
                >
                  {activeLang === 'km' ? 'ទៅកាន់ទំព័រដើម' : 'Go to dashboard'}
                </button>
              </div>
            ) : payment.status === 'expired' || payment.status === 'failed' ? (
              <div className="gopro-modal-state">
                <h3>{activeLang === 'km' ? 'ការទូទាត់មិនបានសម្រេច' : 'Payment not completed'}</h3>
                <p>
                  {activeLang === 'km'
                    ? 'QR ផុតកំណត់ ឬការទូទាត់បរាជ័យ។ សូមព្យាយាមម្តងទៀត។'
                    : 'The QR expired or the payment failed. Please try again.'}
                </p>
                <button type="button" className="gopro-continue-btn" onClick={closeCheckoutModal}>
                  {activeLang === 'km' ? 'បិទ' : 'Close'}
                </button>
              </div>
            ) : (
              <div className="gopro-modal-state">
                <h3>{activeLang === 'km' ? 'ស្កេន QR ដើម្បីទូទាត់' : 'Scan to pay'}</h3>
                <p className="gopro-modal-amount">${Number(payment.amount).toFixed(2)}</p>
                {qrImageUrl ? (
                  <img src={qrImageUrl} alt="Bakong KHQR" className="gopro-qr-image" />
                ) : (
                  <div className="gopro-qr-loading" />
                )}
                {payment.deeplink && (
                  <a
                    className="gopro-deeplink-btn"
                    href={payment.deeplink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {activeLang === 'km' ? 'បើកកម្មវិធី Bakong' : 'Open in Bakong app'}
                  </a>
                )}
                <button
                  type="button"
                  className="gopro-continue-btn"
                  onClick={handleCheckNow}
                  disabled={isChecking}
                >
                  {isChecking
                    ? activeLang === 'km'
                      ? 'កំពុងពិនិត្យ...'
                      : 'Checking...'
                    : activeLang === 'km'
                    ? 'ខ្ញុំបានទូទាត់រួច'
                    : "I've paid"}
                </button>
                <p className="gopro-cta-note">
                  {activeLang === 'km'
                    ? 'កំពុងរង់ចាំការទូទាត់ដោយស្វ័យប្រវត្តិ...'
                    : 'Waiting for payment automatically...'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutError && !payment && (
        <div className="gopro-modal-overlay" onClick={() => setCheckoutError(null)}>
          <div className="gopro-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="gopro-modal-close"
              onClick={() => setCheckoutError(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="gopro-modal-state">
              <h3>{activeLang === 'km' ? 'មានបញ្ហា' : 'Something went wrong'}</h3>
              <p>{checkoutError}</p>
              <button type="button" className="gopro-continue-btn" onClick={handleGoPro}>
                {activeLang === 'km' ? 'ព្យាយាមម្តងទៀត' : 'Try again'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}