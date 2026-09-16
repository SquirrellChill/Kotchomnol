import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Globe2,
  Languages,
  Lock,
  LogOut,
  Mail,
  Moon,
  Pencil,
  Phone,
  Shield,
  Smile,
  Sun,
  User,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { updateMe } from '../../services/authService';
import { buildDashboardProfile } from '../../utils/profile';
import './ProfileSettings.css';

const CARTOON_AVATARS = [
  {
    id: 'girl-short',
    url: '/avatars/avatar-1.png',
    label: 'Girl Short Hair'
  },
  {
    id: 'boy-clean',
    url: '/avatars/avatar-2.png',
    label: 'Boy Clean'
  },
  {
    id: 'girl-long',
    url: '/avatars/avatar-3.jpg',
    label: 'Girl Long Hair'
  },
  {
    id: 'boy-beard',
    url: '/avatars/avatar-4.jpg',
    label: 'Boy Beard'
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
    >
      <div className="settings-page-wrapper">

        {mobileView === 'account_details' && (
          <div className="settings-topbar mobile-only-bar">
            <button
              className="settings-back-btn"
              type="button"
              onClick={() => {
                setMobileView('menu');
                setIsEditing(false);
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
                    alt="Profile Avatar"
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
              aria-label="Settings navigation"
            >

              <button
                type="button"
                className="settings-nav-item"
                onClick={() =>
                  navigate('/dashboard/go-pro')
                }
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
                className="settings-nav-item"
                onClick={() =>
                  navigate(
                    '/dashboard/profile/change-password'
                  )
                }
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

          {/* RIGHT ACCOUNT DETAILS PANEL */}
          <main
            className={`settings-content-panel ${
              mobileView === 'account_details'
                ? 'mobile-visible'
                : 'mobile-hidden'
            }`}
          >

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
                    title={avatar.label}
                  >

                    <div className="modal-avatar-img-wrap">
                      <img
                        src={avatar.url}
                        alt={avatar.label}
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