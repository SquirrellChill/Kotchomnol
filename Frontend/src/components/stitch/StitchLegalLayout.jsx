import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Mail, Moon, Sun, Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import MobileAppShell from '../dashboard/MobileAppShell';
import '../../pages/LandingPage.css';
import '../../pages/TermsPolicy.css';

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

export default function StitchLegalLayout({ icon, title, updated, children, activeTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isKhmer = language === 'km';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDashboardRoute = location.pathname.startsWith('/dashboard');

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

  const closeMenu = () => setMobileMenuOpen(false);

  const content = (
    <div className="landing-page font-kantumruy legal-page-landing-wrapper">
      {/* Top Navbar: Home, Features, Pricing, FAQ */}
      {!isDashboardRoute && (
        <header className="landing-navbar-wrapper">
          <div className="landing-navbar">
            <button
              className="landing-brand-btn"
              type="button"
              onClick={() => { closeMenu(); navigate('/'); }}
              aria-label={isKhmer ? 'ទៅទំព័រដើម' : 'Go home'}
            >
              <img src="/logo-mascot.png" alt="KOTCHOMNOL" className="landing-brand-icon" />
              <span className="landing-brand-title">KOTCHOMNOL</span>
            </button>

            <nav className="landing-nav-links" aria-label={isKhmer ? 'ការរុករកចម្បង' : 'Primary Navigation'}>
              <Link to="/">{isKhmer ? 'ទំព័រដើម' : 'Home'}</Link>
              <a href="/#features">{isKhmer ? 'មុខងារ' : 'Features'}</a>
              <a href="/#pricing">{isKhmer ? 'តម្លៃ' : 'Pricing'}</a>
              <a href="/#faq">{isKhmer ? 'សំណួរ' : 'FAQ'}</a>
            </nav>

            <div className="landing-nav-right">
              <div className="desktop-controls">
                <button
                  type="button"
                  className="landing-theme-btn"
                  onClick={toggleTheme}
                  aria-label={isKhmer ? 'ប្តូររបៀបរូបរាង' : 'Toggle theme mode'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  type="button"
                  className="landing-lang-btn"
                  onClick={toggleLanguage}
                  aria-label={isKhmer ? 'ប្តូរភាសា' : 'Toggle language'}
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
                <button
                  type="button"
                  className="landing-text-btn"
                  onClick={() => navigate('/login')}
                >
                  {isKhmer ? 'ចូលគណនី' : 'Sign In'}
                </button>
                <button
                  type="button"
                  className="landing-primary-btn compact btn-start-free"
                  onClick={() => navigate('/register')}
                >
                  <span>{isKhmer ? 'ចាប់ផ្ដើម' : 'Start Free'}</span>
                  <ArrowRight size={16} className="btn-start-free-arrow" />
                </button>
              </div>

              <button
                type="button"
                className="landing-hamburger-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={isKhmer ? 'បើក/បិទម៉ឺនុយ' : 'Toggle menu'}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Drawer Backdrop */}
      {!isDashboardRoute && (
        <div
          className={`landing-drawer-backdrop ${mobileMenuOpen ? 'open' : ''}`}
          onClick={closeMenu}
        />
      )}

      {/* Mobile Drawer Menu: Home, Features, Pricing, FAQ */}
      {!isDashboardRoute && (
        <aside className={`landing-drawer-panel ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="drawer-header-row">
            <button
              type="button"
              className="drawer-x-btn"
              onClick={closeMenu}
              aria-label={isKhmer ? 'បិទម៉ឺនុយ' : 'Close menu'}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="drawer-nav-links">
            <Link to="/" onClick={closeMenu}>{isKhmer ? 'ទំព័រដើម' : 'Home'}</Link>
            <a href="/#features" onClick={closeMenu}>{isKhmer ? 'មុខងារ' : 'Features'}</a>
            <a href="/#pricing" onClick={closeMenu}>{isKhmer ? 'តម្លៃ' : 'Pricing'}</a>
            <a href="/#faq" onClick={closeMenu}>{isKhmer ? 'សំណួរ' : 'FAQ'}</a>

            <button
              type="button"
              className="drawer-list-btn"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              <span>
                {theme === 'dark'
                  ? (isKhmer ? 'របៀបភ្លឺ' : 'Light Mode')
                  : (isKhmer ? 'របៀបងងឹត' : 'Dark Mode')}
              </span>
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
      )}

      {/* Body Content */}
      <main className="stitch-legal-shell">
        {isDashboardRoute && (
          <header className="stitch-legal-header">
            <button
              type="button"
              className="legal-back-btn"
              onClick={() => navigate('/dashboard')}
              title={isKhmer ? 'ត្រឡប់ក្រោយ' : 'Back'}
            >
              <ArrowLeft size={16} />
              <span>{isKhmer ? 'ត្រឡប់ក្រោយ' : 'Back'}</span>
            </button>
          </header>
        )}

        <section className="stitch-legal-title">
          {icon && <div className="stitch-legal-icon">{icon}</div>}
          <h1>{title}</h1>
          {updated && <p>{updated}</p>}
        </section>

        <article className="stitch-legal-card">{children}</article>
      </main>

      {/* Footer: Home, Features, About, Terms, Privacy */}
      {!isDashboardRoute && (
        <footer className="landing-footer">
          <div className="landing-container">
            <div className="footer-grid">
              <div className="footer-brand-col">
                <div className="footer-brand-logo">
                  <img src="/logo-mascot.png" alt="KOTCHOMNOL" className="footer-brand-icon" />
                  <span className="footer-brand-title">KOTCHOMNOL</span>
                </div>
                <p className="footer-brand-desc">
                  {isKhmer
                    ? 'KOTCHOMNOL ជួយម្ចាស់ហាងកត់ត្រាការលក់ដោយសំឡេង ឬបញ្ចូលដោយដៃ ពិនិត្យទំនិញនីមួយៗ ហើយរក្សាទុកប្រតិបត្តិការដែលបានបញ្ជាក់ទៅក្នុងកំណត់ត្រាចំណូលដែលបានផ្ទៀងផ្ទាត់។'
                    : 'KOTCHOMNOL helps shop owners log sales via voice or manual entry, review each line item, and store confirmed transactions in a verified ledger.'}
                </p>
                <ul className="footer-social-row" aria-label={isKhmer ? 'បណ្តាញសង្គម' : 'Social media links'}>
                  <li>
                    <Link to="/contact" className="footer-contact-icon-btn" aria-label={isKhmer ? 'ទំនាក់ទំនង' : 'Contact'}>
                      <Mail size={18} />
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://facebook.com/kotchomnol"
                      target="_blank"
                      rel="noreferrer"
                      className="footer-contact-icon-btn"
                      aria-label="Facebook"
                    >
                      <FacebookIcon size={18} />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://instagram.com/kotchomnol"
                      target="_blank"
                      rel="noreferrer"
                      className="footer-contact-icon-btn"
                      aria-label="Instagram"
                    >
                      <InstagramIcon size={18} />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://t.me/kotchomnol"
                      target="_blank"
                      rel="noreferrer"
                      className="footer-contact-icon-btn"
                      aria-label="Telegram"
                    >
                      <TelegramIcon size={18} />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://tiktok.com/@kotchomnol"
                      target="_blank"
                      rel="noreferrer"
                      className="footer-contact-icon-btn"
                      aria-label="TikTok"
                    >
                      <TikTokIcon size={18} />
                    </a>
                  </li>
                </ul>
              </div>

              <nav className="footer-link-col" aria-label={isKhmer ? 'ផលិតផល' : 'Product'}>
                <span className="footer-col-heading">{isKhmer ? 'ផលិតផល' : 'Product'}</span>
                <Link to="/">{isKhmer ? 'ទំព័រដើម' : 'Home'}</Link>
                <a href="/#features">{isKhmer ? 'មុខងារ' : 'Features'}</a>
                <a href="/#pricing">{isKhmer ? 'តម្លៃ' : 'Pricing'}</a>
                <a href="/#faq">{isKhmer ? 'សំណួរ' : 'FAQ'}</a>
              </nav>

              <nav className="footer-link-col" aria-label={isKhmer ? 'ក្រុមហ៊ុន' : 'Company'}>
                <span className="footer-col-heading">{isKhmer ? 'ក្រុមហ៊ុន' : 'Company'}</span>
                <Link to="/about">{isKhmer ? 'អំពីយើង' : 'About'}</Link>
                <Link to="/terms">{isKhmer ? 'លក្ខខណ្ឌ' : 'Terms'}</Link>
                <Link to="/privacy">{isKhmer ? 'ឯកជនភាព' : 'Privacy'}</Link>
                <Link to="/contact">{isKhmer ? 'ទំនាក់ទំនង' : 'Contact'}</Link>
              </nav>
            </div>

            <div className="footer-bottom-row">
              <p>
                {isKhmer
                  ? 'រក្សាសិទ្ធិ 2026 KOTCHOMNOL​ រក្សាសិទ្ធិគ្រប់យ៉ាង'
                  : '© 2026 KOTCHOMNOL. All rights reserved.'}
              </p>
              <p>support@kotchomnol.ai</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );

  if (isDashboardRoute) {
    return <MobileAppShell activeTab={activeTab}>{content}</MobileAppShell>;
  }

  return content;
}