import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, BarChart3, Mic, Receipt, User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import BottomTabNav from './BottomTabNav';
import './MobileAppShell.css';

export default function MobileAppShell({ children, header, activeTab, showBottomNav = true, className = '' }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isKm = language !== 'en';

  return (
    <div className={`dash-container font-kantumruy ${className}`}>
      {/* Desktop Persistent Left Sidebar */}
      <aside className="dash-sidebar">
        <div>
          <div className="dash-sidebar-brand" onClick={() => navigate('/')}>
           <img src="/logo-mascot.png" alt="KOTCHOMNOL" className="dash-brand-icon" />
            <span className="dash-brand-title">KOTCHOMNOL</span>
          </div>

          <nav className="dash-nav-menu" aria-label="Sidebar Navigation">
            <Link to="/dashboard" className={`dash-nav-link ${activeTab === 'home' ? 'active' : ''}`}>
              <Home size={18} />
              <span>{isKm ? 'ទំព័រដើម' : 'Home'}</span>
            </Link>

            <Link to="/dashboard/history" className={`dash-nav-link ${activeTab === 'history' || activeTab === 'dashboard' ? 'active' : ''}`}>
              <BarChart3 size={18} />
              <span>{isKm ? 'ផ្ទាំងគ្រប់គ្រង' : 'Dashboard'}</span>
            </Link>

            <Link to="/dashboard/voice" className={`dash-nav-link dash-nav-add-sale ${activeTab === 'add' ? 'active' : ''}`}>
              <span className="add-sale-icon-wrap">
                <Mic size={15} strokeWidth={2.4} />
              </span>
              <span>{isKm ? 'បន្ថែមការលក់' : 'Add Sale'}</span>
            </Link>

            <Link to="/dashboard/transactions" className={`dash-nav-link ${activeTab === 'transactions' ? 'active' : ''}`}>
              <Receipt size={18} />
              <span>{isKm ? 'កំណត់ត្រាការលក់' : 'Sales Records'}</span>
            </Link>

            <Link to="/dashboard/profile" className={`dash-nav-link ${activeTab === 'profile' ? 'active' : ''}`}>
              <User size={18} />
              <span>{isKm ? 'ប្រវត្តិរូប' : 'Profile'}</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Screen Wrapper */}
      <div className="dash-main-wrapper">
        {header}
        <main className="sub-screen-content">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Bar */}
      {showBottomNav && (
        <div className="mobile-only-tab-wrapper">
          <BottomTabNav activeTab={activeTab} />
        </div>
      )}
    </div>
  );
}