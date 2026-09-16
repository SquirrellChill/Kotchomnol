import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import ProfileForm from '../../components/dashboard/ProfileForm';
import ScreenHeader from '../../components/dashboard/ScreenHeader';
import UserAvatar from '../../components/dashboard/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { updateMe } from '../../services/authService';
import { buildDashboardProfile } from '../../utils/profile';
import '../DashboardPage.css';

const profileFallback = {
  name: 'Seller',
  firstName: 'Seller',
  businessName: '',
  role: 'Owner',
  email: '',
  phone: '',
  address: '',
};

const getErrorMessage = (error, fallback) => error?.response?.data?.detail || fallback;

export default function EditProfileScreen() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const profile = buildDashboardProfile(user, profileFallback);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (form) => {
    setSaving(true);
    setStatus('');
    try {
      const response = await updateMe(form);
      updateUser(response.data.data.user);
      setStatus(t('profileUpdated'));
    } catch (err) {
      setStatus(getErrorMessage(err, t('unableProfile')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileAppShell showBottomNav={false}>
      <ScreenHeader title={t('profile')} onBack={() => navigate('/dashboard/profile')} />
      <div className="profile-edit-avatar">
        <UserAvatar size="xl" />
      </div>
      <ProfileForm profile={profile} onSubmit={handleSubmit} saving={saving} status={status} />
    </MobileAppShell>
  );
}
