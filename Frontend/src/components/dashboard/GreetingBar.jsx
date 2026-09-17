import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Sunset, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { buildDashboardProfile } from '../../utils/profile';
import UserAvatar from './UserAvatar';
import './GreetingBar.css';

const profileFallback = {
  name: 'Seller',
  firstName: 'Seller',
  lastName: '',
  businessName: '',
  role: 'Owner',
  email: '',
  phone: '',
};

export default function GreetingBar({ subtitle }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isKm = language !== 'en';

  const profile = buildDashboardProfile(user, profileFallback);
  const firstName = profile.firstName || profile.name?.split(' ')[0] || (isKm ? 'អ្នកលក់' : 'Seller');

  const hour = new Date().getHours();
  const greetingPeriod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const greeting = {
    en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    km: { morning: 'អរុណសួស្តី', afternoon: 'ទិវាសួស្តី', evening: 'សាយណ្ហសួស្តី' },
  }[isKm ? 'km' : 'en'][greetingPeriod];

  const GreetingIcon = greetingPeriod === 'morning' ? Sun : greetingPeriod === 'afternoon' ? Sunset : Moon;

  const goToProfile = () => navigate('/dashboard/profile');

  return (
    <header className="greeting-bar">
      <div className="greeting-bar-text-block">
        <h1 className="greeting-bar-title">
          <span className="greeting-bar-icon-badge">
            <GreetingIcon size={18} />
          </span>
          {`${greeting}, ${firstName}!`}
        </h1>
        {subtitle && <p className="greeting-bar-sub">{subtitle}</p>}
      </div>
      <div
        className="greeting-bar-avatar-btn"
        onClick={goToProfile}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goToProfile();
          }
        }}
        title={isKm ? 'ប្រវត្តិរូប' : 'Profile'}
      >
        <UserAvatar size="md" initials={firstName.charAt(0)} />
      </div>
    </header>
  );
}
