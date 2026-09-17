import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  Globe2,
  Info,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Mail,
  Moon,
  Pencil,
  Phone,
  Shield,
  ShieldCheck,
  Smile,
  Sun,
  User,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GoProPanel from '../../components/dashboard/GoProPanel';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { changePassword, forgotPassword, getErrorMessage, updateMe } from '../../services/authService';
import { buildDashboardProfile } from '../../utils/profile';
import './ProfileSettings.css';

const CARTOON_AVATARS = [
  {
    id: 'girl-short',
    url: '/avatars/avatar-1.png',
    labelKey: 'avatarGirlShortHair'
  },
  {
    id: 'boy-clean',
    url: '/avatars/avatar-2.png',
    labelKey: 'avatarBoyClean'
  },
  {
    id: 'girl-long',
    url: '/avatars/avatar-3.jpg',
    labelKey: 'avatarGirlLongHair'
  },
  {
    id: 'boy-beard',
    url: '/avatars/avatar-4.jpg',
    labelKey: 'avatarBoyBeard'
  },
];

const profileFallback = {
  name: 'Seller',
  firstName: 'Seller',
  lastName: '',
  email: '',
  phone: '',
  address: '',
};

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const isKm = language !== 'en';

  const profile = buildDashboardProfile(
    user,
    profileFallback
  );

  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [mobileView, setMobileView] = useState('menu');

  const [selectedAvatar, setSelectedAvatar] = useState(
    () =>
      user?.profile_picture ||
      user?.avatar_url ||
      user?.user_metadata?.avatar_url ||
      CARTOON_AVATARS[0].url
  );

  useEffect(() => {
    const avatar =
      user?.profile_picture ||
      user?.avatar_url ||
      user?.user_metadata?.avatar_url;

    if (avatar) {
      setSelectedAvatar(avatar);
    }
  }, [
    user?.profile_picture,
    user?.avatar_url,
    user?.user_metadata?.avatar_url,
  ]);

  const activeAvatar = selectedAvatar;

  const [form, setForm] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    phoneNumber: profile.phone || '',
    email: profile.email || '',
  });

  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState({
    type: '',
    message: ''
  });

  // Inline "Change Password" panel state (replaces the old My Account
  // panel in place instead of navigating to a separate page).
  const [pwdMode, setPwdMode] = useState('standard'); // 'standard' | 'forgot'
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdStatus, setPwdStatus] = useState({ type: '', message: '' });

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '' };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score += 1;
    if (/\d/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;
    const labels = [
      isKm ? 'ខ្សោយ' : 'Weak',
      isKm ? 'ខ្សោយ' : 'Weak',
      isKm ? 'មធ្យម' : 'Fair',
      isKm ? 'ល្អ' : 'Good',
      isKm ? 'ខ្លាំង' : 'Strong',
    ];
    return { score, label: labels[score] };
  })();

  const resetPasswordPanel = () => {
    setPwdMode('standard');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setResetEmail('');
    setLinkSent(false);
    setPwdStatus({ type: '', message: '' });
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdStatus({ type: '', message: '' });

    if (newPassword !== confirmPassword) {
      setPwdStatus({
        type: 'error',
        message: isKm ? 'លេខសម្ងាត់ទាំងពីរមិនត្រូវគ្នាទេ' : 'Passwords do not match.',
      });
      return;
    }

    setPwdSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPwdStatus({
        type: 'success',
        message: isKm ? 'បានផ្លាស់ប្តូរលេខសម្ងាត់ដោយជោគជ័យ!' : 'Password updated successfully!',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdStatus({
        type: 'error',
        message:
          getErrorMessage(err) ||
          (isKm ? 'លេខសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ' : 'Current password is incorrect.'),
      });
    } finally {
      setPwdSaving(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdStatus({ type: '', message: '' });
    setPwdSaving(true);
    try {
      await forgotPassword({ email: resetEmail });
      setLinkSent(true);
      setPwdStatus({
        type: 'success',
        message: isKm
          ? 'តំណកំណត់លេខសម្ងាត់ឡើងវិញត្រូវបានផ្ញើទៅអ៊ីមែលរបស់អ្នក!'
          : 'A password reset link has been sent to your email!',
      });
    } catch (err) {
      setPwdStatus({
        type: 'error',
        message: getErrorMessage(err) || (isKm ? 'បរាជ័យក្នុងការផ្ញើតំណ' : 'Failed to send reset link.'),
      });
    } finally {
      setPwdSaving(false);
    }
  };

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleCancel = () => {
    setForm({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phoneNumber: profile.phone || '',
      email: profile.email || '',
    });

    setStatus({
      type: '',
      message: ''
    });

    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    setSaving(true);

    setStatus({
      type: '',
      message: ''
    });

    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        profile_picture: activeAvatar,
      };

      if (form.email && form.email.trim()) {
        payload.email = form.email.trim();
      }
      if (form.phoneNumber && form.phoneNumber.trim()) {
        payload.phoneNumber = form.phoneNumber.trim();
      }

      const response = await updateMe(payload);
      const updated = response.data?.data?.user;

      if (updated) {
        updateUser({
          ...updated,
          profile_picture:
            updated.profile_picture || activeAvatar,
        });
      }

      setStatus({
        type: 'success',
        message:
          t('profileUpdated') ||
          (isKm
            ? 'បានធ្វើបច្ចុប្បន្នភាពគណនីដោយជោគជ័យ'
            : 'Profile updated successfully.')
      });

      setIsEditing(false);
    } catch (err) {
      const errMsg =
        err?.response?.data?.detail ||
        t('unableProfile') ||
        (isKm
          ? 'មិនអាចធ្វើបច្ចុប្បន្នភាពគណនីបានទេ'
          : 'Unable to update profile.');

      setStatus({
        type: 'error',
        message: errMsg
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAvatar = async (avatarUrl) => {
    setSavingAvatar(true);
    setSelectedAvatar(avatarUrl);

    const payload = {
      profile_picture: avatarUrl,
    };

    const fName = form.firstName || profile.firstName;
    if (fName && fName.trim()) payload.firstName = fName.trim();

    const lName = form.lastName || profile.lastName;
    if (lName && lName.trim()) payload.lastName = lName.trim();

    const emailVal = form.email || profile.email || user?.email;
    if (emailVal && emailVal.trim()) payload.email = emailVal.trim();

    const phoneVal = form.phoneNumber || profile.phone;
    if (phoneVal && phoneVal.trim()) payload.phoneNumber = phoneVal.trim();

    try {
      const response = await updateMe(payload);
      const updatedUser = response?.data?.data?.user;

      if (updatedUser) {
        updateUser({
          ...updatedUser,
          profile_picture: updatedUser.profile_picture || avatarUrl,
        });
      } else {
        updateUser({
          ...user,
          profile_picture: avatarUrl,
        });
      }

      setShowAvatarPicker(false);
      setStatus({
        type: 'success',
        message: isKm
          ? 'បានផ្លាស់ប្តូររូបតំណាងតុក្កតាដោយជោគជ័យ'
          : 'Avatar updated successfully!',
      });
    } catch (err) {
      console.warn('Backend update failed, falling back to client-side session sync:', err);

      updateUser({
        ...user,
        profile_picture: avatarUrl,
      });

      setShowAvatarPicker(false);
      setStatus({
        type: 'success',
        message: isKm
          ? 'បានផ្លាស់ប្តូររូបតំណាងដោយជោគជ័យ'
          : 'Avatar updated successfully!',
      });
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <MobileAppShell
      activeTab="profile"
      showBottomNav={true}
      header={
        <PageHeader
          icon={<User size={18} />}
          title={t('profile') || (isKm ? 'ប្រវត្តិរូប' : 'Profile')}
          subtitle={
            isKm
              ? 'គ្រប់គ្រងគណនី និងការកំណត់របស់អ្នក។'
              : 'Manage your account and preferences.'
          }
        />
      }
    >
      <div className="settings-page-wrapper">

        {(mobileView === 'account_details' || mobileView === 'password' || mobileView === 'go_pro') && (
          <div className="settings-topbar mobile-only-bar">
            <button
              className="settings-back-btn"
              type="button"
              onClick={() => {
                setMobileView('menu');
                setIsEditing(false);
                resetPasswordPanel();
              }}
            >
              <ArrowLeft size={18} />
              <span>
                {t('menu') ||
                  (isKm ? 'ម៉ឺនុយ' : 'Menu')}
              </span>
            </button>
          </div>
        )}

        <div className="settings-layout">

          {/* LEFT MENU CARD */}
          <aside
            className={`settings-sidebar ${
              mobileView === 'menu'
                ? 'mobile-visible'
                : 'mobile-hidden'
            }`}
          >
            <div className="sidebar-profile-header">

              <div className="sidebar-avatar-wrap">

                <div className="avatar-img-container">
                  <img
                    src={activeAvatar}
                    alt={t('profileAvatarAlt')}
                    className="cartoon-avatar-main"
                  />
                </div>

                <button
                  type="button"
                  className="avatar-edit-badge"
                  onClick={() =>
                    setShowAvatarPicker(true)
                  }
                  title={
                    isKm
                      ? 'ប្តូររូបភាពប្រវត្តិរូប'
                      : 'Change profile picture'
                  }
                >
                  <Smile size={16} />
                </button>

              </div>

              <h2 className="sidebar-user-name">
                {profile.name}
              </h2>

            </div>

            <nav
              className="settings-nav-menu"
              aria-label={t('settingsNavigation')}
            >

              <button
                type="button"
                className={`settings-nav-item ${mobileView === 'go_pro' ? 'active' : ''}`}
                onClick={() => setMobileView('go_pro')}
              >
                <Crown size={18} />

                <div className="nav-item-dual">
                  <span>
                    {t('goPro') ||
                      (isKm
                        ? 'ក្លាយជា Pro'
                        : 'Go Pro')}
                  </span>

                  <ChevronRight
                    size={16}
                    className="mobile-chevron"
                  />
                </div>
              </button>

              <button 
                type="button" 
                className={`settings-nav-item ${mobileView === 'account_details' ? 'active' : ''}`}
                onClick={() => setMobileView('account_details')}
              >
                <User size={18} />

                <div className="nav-item-dual">
                  <span>
                    {t('myAccount') ||
                      (isKm
                        ? 'គណនីរបស់ខ្ញុំ'
                        : 'My Account')}
                  </span>

                  <ChevronRight
                    size={16}
                    className="mobile-chevron"
                  />
                </div>
              </button>

              <button
                type="button"
                className={`settings-nav-item ${mobileView === 'password' ? 'active' : ''}`}
                onClick={() => {
                  resetPasswordPanel();
                  setMobileView('password');
                }}
              >
                <Lock size={18} />

                <div className="nav-item-dual">
                  <span>
                    {t('changePassword') ||
                      (isKm
                        ? 'ផ្លាស់ប្តូរលេខសម្ងាត់'
                        : 'Change password')}
                  </span>

                  <ChevronRight
                    size={16}
                    className="mobile-chevron"
                  />
                </div>
              </button>

              <button
                type="button"
                className="settings-nav-item"
                onClick={toggleLanguage}
              >
                <Languages size={18} />

                <div className="nav-item-dual">
                  <span>
                    {t('language') ||
                      (isKm
                        ? 'ភាសា'
                        : 'Language')}
                  </span>

                  <span className="lang-tag">
                    {language === 'km' ? 'KH' : 'EN'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="settings-nav-item"
                onClick={toggleTheme}
              >
                {theme === 'dark'
                  ? <Sun size={18} />
                  : <Moon size={18} />}

                <div className="nav-item-dual">
                  <span>
                    {t('theme') ||
                      (isKm
                        ? 'ទម្រង់'
                        : 'Theme')}
                  </span>

                  <span className="theme-tag">
                    {theme === 'dark'
                      ? 'LIGHT'
                      : 'DARK'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="settings-nav-item"
                onClick={() => navigate('/')}
              >
                <Globe2 size={18} />

                <div className="nav-item-dual">
                  <span>
                    {t('backToWebsite') ||
                      (isKm
                        ? 'ត្រឡប់ទៅគេហទំព័រដើម'
                        : 'Back to Website')}
                  </span>

                  <ChevronRight
                    size={16}
                    className="mobile-chevron"
                  />
                </div>
              </button>

              <div className="settings-nav-divider" />

              <button
                type="button"
                className="settings-nav-item logout-item"
                onClick={handleLogout}
              >
                <LogOut size={18} />

                <span>
                  {t('logout') ||
                    (isKm
                      ? 'ចាកចេញ'
                      : 'Log out')}
                </span>
              </button>

            </nav>
          </aside>

          {/* RIGHT ACCOUNT DETAILS / CHANGE PASSWORD PANEL */}
          <main
            className={`settings-content-panel ${
              mobileView === 'account_details' || mobileView === 'password' || mobileView === 'go_pro'
                ? 'mobile-visible'
                : 'mobile-hidden'
            }`}
          >

            {mobileView === 'go_pro' ? (
              <GoProPanel onDone={() => setMobileView('menu')} />
            ) : mobileView === 'password' ? (
              <>
                <header className="content-card-header">
                  <div className="header-icon-shield">
                    <Lock size={18} />
                  </div>

                  <div className="header-text-block">
                    <h1>
                      {t('changePassword') || (isKm ? 'ផ្លាស់ប្តូរលេខសម្ងាត់' : 'Change Password')}
                    </h1>
                    <p>
                      {pwdMode === 'forgot'
                        ? (isKm
                            ? 'បញ្ចូលអាសយដ្ឋានអ៊ីមែលគណនីរបស់អ្នក ដើម្បីទទួលតំណកំណត់លេខសម្ងាត់ឡើងវិញ។'
                            : 'Enter your account email to receive a password reset link.')
                        : (isKm
                            ? 'បញ្ជាក់លេខសម្ងាត់បច្ចុប្បន្ន រួចជ្រើសរើសលេខសម្ងាត់ថ្មី។'
                            : 'Confirm your current password, then choose a new one.')}
                    </p>
                  </div>
                </header>

                {pwdStatus.message && (
                  <div className={`settings-alert-banner ${pwdStatus.type}`}>{pwdStatus.message}</div>
                )}

                {pwdMode === 'standard' ? (
                  <form className="reference-form password-panel-form" onSubmit={handleChangePasswordSubmit}>
                    <div className="view-info-footer">
                      <span className="view-info-footer-icon">
                        <ShieldCheck size={14} />
                      </span>
                      <p>
                        {isKm
                          ? 'ប្រើលេខសម្ងាត់យ៉ាងតិច ៨ តួអក្សរ ដោយលាយអក្សរធំតូច លេខ និងសញ្ញាសម្គាល់។'
                          : 'Use at least 8 characters, mixing upper/lowercase letters, numbers, and symbols.'}
                      </p>
                    </div>

                    <div className="floating-field full-width">
                      <label htmlFor="currentPassword">
                        {isKm ? 'លេខសម្ងាត់បច្ចុប្បន្ន' : 'Current Password'}
                      </label>
                      <div className="password-field-wrap">
                        <KeyRound size={15} className="password-field-icon" />
                        <input
                          id="currentPassword"
                          type={showCurrentPwd ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowCurrentPwd((v) => !v)}
                          aria-label={showCurrentPwd ? (isKm ? 'លាក់' : 'Hide') : (isKm ? 'បង្ហាញ' : 'Show')}
                        >
                          {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="floating-field full-width">
                      <label htmlFor="newPassword">
                        {isKm ? 'លេខសម្ងាត់ថ្មី' : 'New Password'}
                      </label>
                      <div className="password-field-wrap">
                        <KeyRound size={15} className="password-field-icon" />
                        <input
                          id="newPassword"
                          type={showNewPwd ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowNewPwd((v) => !v)}
                          aria-label={showNewPwd ? (isKm ? 'លាក់' : 'Hide') : (isKm ? 'បង្ហាញ' : 'Show')}
                        >
                          {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {newPassword && (
                        <div className={`password-strength-meter strength-${passwordStrength.score}`}>
                          <div className="password-strength-track">
                            {[1, 2, 3, 4].map((segment) => (
                              <span
                                key={segment}
                                className={`password-strength-segment ${segment <= passwordStrength.score ? 'filled' : ''}`}
                              />
                            ))}
                          </div>
                          <span className="password-strength-label">{passwordStrength.label}</span>
                        </div>
                      )}
                    </div>

                    <div className="floating-field full-width">
                      <label htmlFor="confirmPassword">
                        {isKm ? 'បញ្ជាក់លេខសម្ងាត់ថ្មី' : 'Confirm New Password'}
                      </label>
                      <div className="password-field-wrap">
                        <KeyRound size={15} className="password-field-icon" />
                        <input
                          id="confirmPassword"
                          type={showConfirmPwd ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPwd((v) => !v)}
                          aria-label={showConfirmPwd ? (isKm ? 'លាក់' : 'Hide') : (isKm ? 'បង្ហាញ' : 'Show')}
                        >
                          {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {confirmPassword && (
                        <p className={`password-match-hint ${newPassword === confirmPassword ? 'match' : 'mismatch'}`}>
                          {newPassword === confirmPassword ? (
                            <>
                              <Check size={13} /> {isKm ? 'លេខសម្ងាត់ត្រូវគ្នា' : 'Passwords match'}
                            </>
                          ) : (
                            <>
                              <X size={13} /> {isKm ? 'លេខសម្ងាត់មិនត្រូវគ្នា' : 'Passwords do not match'}
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    <button className="settings-primary-btn full-width" type="submit" disabled={pwdSaving}>
                      {pwdSaving
                        ? (isKm ? 'កំពុងដំណើរការ...' : 'Updating...')
                        : (isKm ? 'ផ្លាស់ប្តូរលេខសម្ងាត់' : 'Change Password')}
                    </button>
                    <button
                      className="form-link-btn"
                      type="button"
                      onClick={() => {
                        setPwdMode('forgot');
                        setPwdStatus({ type: '', message: '' });
                      }}
                    >
                      {isKm ? 'ភ្លេចលេខសម្ងាត់?' : 'Forgot your password?'}
                    </button>
                  </form>
                ) : (
                  <form className="reference-form password-panel-form" onSubmit={handleForgotPasswordSubmit}>
                    <div className="floating-field full-width">
                      <label htmlFor="resetEmail">
                        {isKm ? 'អាសយដ្ឋានអ៊ីមែលគណនី' : 'Registered Email Address'}
                      </label>
                      <div className="password-field-wrap">
                        <Mail size={15} className="password-field-icon" />
                        <input
                          id="resetEmail"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="yourname@domain.com"
                          disabled={linkSent}
                          required
                        />
                      </div>
                    </div>

                    {linkSent && (
                      <div className="view-info-footer">
                        <span className="view-info-footer-icon">
                          <Mail size={14} />
                        </span>
                        <p>
                          {isKm
                            ? 'ពិនិត្យអ៊ីមែលរបស់អ្នក ហើយចុចលើតំណដើម្បីកំណត់លេខសម្ងាត់ថ្មី។'
                            : 'Check your inbox and click the link to set a new password.'}
                        </p>
                      </div>
                    )}

                    {!linkSent && (
                      <button className="settings-primary-btn full-width" type="submit" disabled={pwdSaving}>
                        {pwdSaving
                          ? (isKm ? 'កំពុងផ្ញើ...' : 'Sending...')
                          : (isKm ? 'ផ្ញើតំណកំណត់ឡើងវិញ' : 'Send Reset Link')}
                      </button>
                    )}
                    <button
                      className="form-link-btn"
                      type="button"
                      onClick={() => {
                        setPwdMode('standard');
                        setLinkSent(false);
                        setPwdStatus({ type: '', message: '' });
                      }}
                    >
                      {isKm ? 'ចាំលេខសម្ងាត់ចាស់? ត្រឡប់ក្រោយ' : 'Remember your password? Go back'}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
            <header className="content-card-header">

              <div className="header-icon-shield">
                <Shield size={18} />
              </div>

              <div className="header-text-block">
                <h1>
                  {t('myAccount') ||
                    (isKm
                      ? 'គណនីរបស់ខ្ញុំ'
                      : 'My Account')}
                </h1>

                <p>
                  {isKm
                    ? 'គ្រប់គ្រងព័ត៌មានផ្ទាល់ខ្លួន និងអត្តសញ្ញាណប្រព័ន្ធរបស់អ្នក។'
                    : 'Manage your personal details and system identity.'}
                </p>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  className="edit-toggle-btn"
                  onClick={() =>
                    setIsEditing(true)
                  }
                >
                  <Pencil size={15} />

                  <span>
                    {t('edit') ||
                      (isKm
                        ? 'កែ'
                        : 'Edit')}
                  </span>
                </button>
              )}

            </header>

            {status.message && (
              <div
                className={`settings-alert-banner ${status.type}`}
              >
                {status.message}
              </div>
            )}

            {!isEditing ? (
              <div className="profile-view-container">

                <div className="view-grid">

                  <div className="info-display-tile">
                    <span className="info-tile-label">
                      {t('firstName') ||
                        (isKm
                          ? 'នាមត្រកូល / ឈ្មោះ'
                          : 'First Name')}
                    </span>

                    <strong className="info-tile-value">
                      {profile.firstName || '—'}
                    </strong>
                  </div>

                  <div className="info-display-tile">
                    <span className="info-tile-label">
                      {t('lastName') ||
                        (isKm
                          ? 'គោត្តនាម'
                          : 'Last Name')}
                    </span>

                    <strong className="info-tile-value">
                      {profile.lastName || '—'}
                    </strong>
                  </div>

                </div>

                <div className="info-display-tile full-width">
                  <span className="info-tile-label">
                    {t('emailAddress') ||
                      (isKm
                        ? 'អាសយដ្ឋានអ៊ីមែល'
                        : 'Email Address')}
                  </span>

                  <div className="info-tile-iconic">
                    <Mail
                      size={16}
                      className="info-icon"
                    />

                    <strong className="info-tile-value">
                      {profile.email || '—'}
                    </strong>
                  </div>
                </div>

                <div className="info-display-tile full-width">
                  <span className="info-tile-label">
                    {t('phoneNumber') ||
                      (isKm
                        ? 'លេខទូរស័ព្ទ'
                        : 'Phone Number')}
                  </span>

                  <div className="info-tile-iconic">
                    <Phone
                      size={16}
                      className="info-icon"
                    />

                    <strong className="info-tile-value">
                      {profile.phone || '—'}
                    </strong>
                  </div>
                </div>

                <div className="view-info-footer">
                  <span className="view-info-footer-icon">
                    <Info size={14} />
                  </span>
                  <p>
                    {isKm
                      ? 'ចុចប៊ូតុង «កែ» ខាងលើនៅពេលណាដែលអ្នកចង់ធ្វើបច្ចុប្បន្នភាពលេខទូរស័ព្ទ ឬឈ្មោះរបស់អ្នក។'
                      : 'Click "Edit" above whenever you need to update your phone number or name.'}
                  </p>
                </div>

              </div>
            ) : (

              <form
                className="reference-form"
                onSubmit={handleSave}
              >

                <div className="form-row-grid">

                  <div className="floating-field">
                    <label htmlFor="firstName">
                      {t('firstName') ||
                        (isKm
                          ? 'នាមត្រកូល / ឈ្មោះ'
                          : 'First Name')}
                    </label>

                    <input
                      id="firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      placeholder={
                        isKm
                          ? 'ឈ្មោះ'
                          : 'First Name'
                      }
                      required
                    />
                  </div>

                  <div className="floating-field">
                    <label htmlFor="lastName">
                      {t('lastName') ||
                        (isKm
                          ? 'គោត្តនាម'
                          : 'Last Name')}
                    </label>

                    <input
                      id="lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder={
                        isKm
                          ? 'គោត្តនាម'
                          : 'Last Name'
                      }
                      required
                    />
                  </div>

                </div>

                <div className="floating-field full-width">
                  <label htmlFor="email">
                    {t('emailAddress') ||
                      (isKm
                        ? 'អាសយដ្ឋានអ៊ីមែល'
                        : 'Email Address')}
                  </label>

                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="yourname@domain.com"
                  />
                </div>

                <div className="floating-field full-width">
                  <label htmlFor="phoneNumber">
                    {t('phoneNumber') ||
                      (isKm
                        ? 'លេខទូរស័ព្ទ'
                        : 'Phone Number')}
                  </label>

                  <div className="phone-prefix-input">

                    <span className="phone-tag">
                      🇰🇭 +855
                    </span>

                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      value={form.phoneNumber}
                      onChange={handleChange}
                      placeholder="71 995 6996"
                    />

                  </div>
                </div>

                <p className="form-explanatory-copy">
                  {isKm
                    ? 'ដើម្បីទទួលបានបទពិសោធន៍ប្រើប្រាស់ និងសុវត្ថិភាពល្អបំផុត សូមរក្សាលេខទូរស័ព្ទ និងព័ត៌មានគណនីរបស់អ្នកឱ្យទាន់សម័យ។'
                    : 'Please keep your phone and account details updated to ensure seamless access.'}
                </p>

                <div className="form-actions-group">

                  <button
                    className="settings-primary-btn"
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? (
                        t('saving') ||
                        (isKm
                          ? 'កំពុងរក្សាទុក...'
                          : 'Saving...')
                      )
                      : (
                        t('saveChanges') ||
                        (isKm
                          ? 'រក្សាទុកការផ្លាស់ប្តូរ'
                          : 'Save Changes')
                      )}
                  </button>

                  <button
                    className="settings-cancel-btn"
                    type="button"
                    disabled={saving}
                    onClick={handleCancel}
                  >
                    {t('cancel') ||
                      (isKm
                        ? 'បោះបង់'
                        : 'Cancel')}
                  </button>

                </div>

              </form>
            )}
              </>
            )}

          </main>
        </div>
      </div>

      {/* AVATAR MODAL (PRESETS ONLY) */}
      {showAvatarPicker && (
        <div
          className="avatar-modal-backdrop"
          onClick={() =>
            setShowAvatarPicker(false)
          }
        >
          <div
            className="avatar-modal-card"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="avatar-modal-header">

              <div>
                <h3>
                  {isKm
                    ? 'ជ្រើសរើសរូបតំណាង'
                    : 'Choose Avatar'}
                </h3>

                <p>
                  {isKm
                    ? 'ជ្រើសរើសរូបតុក្កតាសម្រាប់គណនីរបស់អ្នក'
                    : 'Select a cartoon avatar for your profile'}
                </p>
              </div>

              <button
                type="button"
                className="avatar-close-btn"
                onClick={() =>
                  setShowAvatarPicker(false)
                }
              >
                <X size={18} />
              </button>

            </div>

            <div className="cartoon-avatar-grid">

              {CARTOON_AVATARS.map((avatar) => {

                const isSelected =
                  activeAvatar === avatar.url;

                return (
                  <button
                    key={avatar.id}
                    type="button"
                    className={`cartoon-choice-item ${
                      isSelected
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      handleSelectAvatar(
                        avatar.url
                      )
                    }
                    disabled={savingAvatar}
                    title={t(avatar.labelKey)}
                  >

                    <div className="modal-avatar-img-wrap">
                      <img
                        src={avatar.url}
                        alt={t(avatar.labelKey)}
                      />
                    </div>

                    {isSelected && (
                      <div className="avatar-check-indicator">
                        <Check size={14} />
                      </div>
                    )}

                  </button>
                );
              })}

            </div>

          </div>
        </div>
      )}

    </MobileAppShell>
  );
}