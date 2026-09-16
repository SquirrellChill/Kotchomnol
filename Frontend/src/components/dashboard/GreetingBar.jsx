import React from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function GreetingBar() {
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

  const goToProfile = () => navigate('/dashboard/profile');

  return (
    <div className="greeting-bar">
      <span className="greeting-bar-text">{`${greeting}, ${firstName}!`}</span>
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
        <UserAvatar size="sm" initials={firstName.charAt(0)} />
      </div>
    </div>
  );
}
