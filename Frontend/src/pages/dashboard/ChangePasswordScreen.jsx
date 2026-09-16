import React, { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck, Mail, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import { useLanguage } from '../../context/LanguageContext';
import {
  changePassword,
  forgotPassword,
  getErrorMessage,
} from '../../services/authService';
import './ChangePasswordScreen.css';

export default function ChangePasswordScreen() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isKm = language !== 'en';

  // Modes: 'standard' (knows old pwd, changes it directly) or
  // 'forgot' (doesn't know it, gets an email reset link instead).
  const [mode, setMode] = useState('standard');

  const [currentPassword, setCurrentPassword] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleSwitchToForgot = () => {
    setMode('forgot');
    setLinkSent(false);
    setStatusMsg({ type: '', text: '' });
  };

  const handleSwitchToStandard = () => {
    setMode('standard');
    setLinkSent(false);
    setStatusMsg({ type: '', text: '' });
  };

  const handleStandardSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setStatusMsg({
        type: 'error',
        text: isKm ? 'លេខសម្ងាត់ទាំងពីរមិនត្រូវគ្នាទេ' : 'Passwords do not match.',
      });
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });

      setStatusMsg({
        type: 'success',
        text: isKm ? 'បានផ្លាស់ប្តូរលេខសម្ងាត់ដោយជោគជ័យ!' : 'Password updated successfully!',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => navigate('/dashboard/profile'), 1500);
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text:
          getErrorMessage(err) ||
          (isKm ? 'លេខសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ' : 'Current password is incorrect.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    setLoading(true);

    try {
      await forgotPassword({ email });
      setLinkSent(true);
      setStatusMsg({
        type: 'success',
        text: isKm
          ? 'តំណកំណត់លេខសម្ងាត់ឡើងវិញត្រូវបានផ្ញើទៅអ៊ីមែលរបស់អ្នក!'
          : 'A password reset link has been sent to your email!',
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text:
          getErrorMessage(err) ||
          (isKm ? 'បរាជ័យក្នុងការផ្ញើតំណ' : 'Failed to send reset link.'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileAppShell activeTab="profile">
      <div className="pwd-split-wrapper font-kantumruy">
        {/* Navigation Bar */}
        <div className="pwd-top-nav">
          <button
            type="button"
            className="pwd-back-btn"
            onClick={() => navigate('/dashboard/profile')}
          >
            <ArrowLeft size={16} />
            <span>{isKm ? 'ត្រឡប់ទៅប្រវត្តិរូប' : 'Back to Profile'}</span>
          </button>
        </div>

        {/* Master Card */}
        <div className="pwd-auth-card">
          {/* Left Gradient Banner */}
          <div className="pwd-card-banner">
            <div>
              <div className="pwd-icon-badge">
                {mode === 'forgot' ? <HelpCircle size={22} /> : <KeyRound size={22} />}
              </div>
              <span className="pwd-brand-text">KOTCHOMNOL</span>
              <h2 className="pwd-banner-title">
                {mode === 'forgot'
                  ? isKm
                    ? 'កំណត់លេខសម្ងាត់ឡើងវិញ'
                    : 'Reset Forgotten Password'
                  : isKm
                  ? 'ការការពារគណនី'
                  : 'Account Security'}
              </h2>
              <p className="pwd-banner-desc">
                {mode === 'forgot'
                  ? isKm
                    ? 'សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលគណនីរបស់អ្នកដើម្បីទទួលតំណកំណត់លេខសម្ងាត់ឡើងវិញ។'
                    : 'Enter your account email to receive a password reset link.'
                  : isKm
                  ? 'បញ្ជាក់លេខសម្ងាត់បច្ចុប្បន្នរបស់អ្នក រួចកំណត់លេខសម្ងាត់ថ្មី។'
                  : 'Confirm your current password, then set a new one.'}
              </p>
            </div>

            <div className="pwd-banner-footer">
              <ShieldCheck size={16} />
              <span>{isKm ? 'សុវត្ថិភាពខ្ពស់' : 'Encrypted & Secure'}</span>
            </div>
          </div>

          {/* Right Form Body */}
          <div className="pwd-card-body">
            <div className="pwd-form-header">
              <h3>
                {mode === 'forgot'
                  ? isKm
                    ? 'ភ្លេចលេខសម្ងាត់បច្ចុប្បន្ន?'
                    : 'Forgot Current Password?'
                  : isKm
                  ? 'ផ្លាស់ប្តូរលេខសម្ងាត់'
                  : 'Change Password'}
              </h3>
              <p>
                {mode === 'forgot'
                  ? isKm
                    ? 'បញ្ចូលអាសយដ្ឋានអ៊ីមែលគណនីរបស់អ្នក ដើម្បីទទួលតំណកំណត់លេខសម្ងាត់ឡើងវិញ។'
                    : 'Enter your account email to receive a password reset link.'
                  : isKm
                  ? 'បញ្ចូលលេខសម្ងាត់បច្ចុប្បន្ន និងលេខសម្ងាត់ថ្មីរបស់អ្នក'
                  : 'Enter your current password and choose a new one.'}
              </p>
            </div>

            {statusMsg.text && (
              <div className={statusMsg.type === 'success' ? 'pwd-alert-success' : 'pwd-alert-error'}>
                {statusMsg.text}
              </div>
            )}

            <div className="pwd-form-embed">
              {mode === 'standard' ? (
                <form onSubmit={handleStandardSubmit}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label htmlFor="current-password" style={{ margin: 0 }}>
                        {isKm ? 'លេខសម្ងាត់បច្ចុប្បន្ន' : 'CURRENT PASSWORD'}
                      </label>
                      <button
                        type="button"
                        onClick={handleSwitchToForgot}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '12px',
                          color: '#9333ea',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        {isKm ? 'ភ្លេចលេខសម្ងាត់?' : 'Forgot Password?'}
                      </button>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="current-password"
                        type={showCurrent ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        className="pwd-input-with-toggle"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pwd-toggle-btn"
                        onClick={() => setShowCurrent(!showCurrent)}
                      >
                        {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="new-password">
                      {isKm ? 'លេខសម្ងាត់ថ្មី' : 'NEW PASSWORD'}
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="new-password"
                        type={showNew ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        className="pwd-input-with-toggle"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pwd-toggle-btn"
                        onClick={() => setShowNew(!showNew)}
                      >
                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm-password">
                      {isKm ? 'បញ្ជាក់លេខសម្ងាត់ថ្មី' : 'CONFIRM NEW PASSWORD'}
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        className="pwd-input-with-toggle"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pwd-toggle-btn"
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading}>
                    {loading
                      ? isKm
                        ? 'កំពុងដំណើរការ...'
                        : 'Updating...'
                      : isKm
                      ? 'ផ្លាស់ប្តូរលេខសម្ងាត់'
                      : 'Change Password'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotSubmit}>
                  <div>
                    <label htmlFor="registered-email">
                      {isKm ? 'អាសយដ្ឋានអ៊ីមែលគណនី' : 'REGISTERED EMAIL ADDRESS'}
                    </label>
                    <input
                      id="registered-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={linkSent}
                    />
                  </div>

                  {!linkSent ? (
                    <button type="submit" disabled={loading}>
                      {loading
                        ? isKm
                          ? 'កំពុងផ្ញើ...'
                          : 'Sending...'
                        : isKm
                        ? 'ផ្ញើតំណកំណត់ឡើងវិញ'
                        : 'Send Reset Link'}
                    </button>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
                      <Mail size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                      {isKm
                        ? 'ពិនិត្យអ៊ីមែលរបស់អ្នក ហើយចុចលើតំណដើម្បីកំណត់លេខសម្ងាត់ថ្មី។'
                        : 'Check your inbox and click the link to set a new password.'}
                    </div>
                  )}

                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#9ca3af',
                      fontSize: '13px',
                      cursor: 'pointer',
                      marginTop: '6px',
                      textAlign: 'center',
                    }}
                    onClick={handleSwitchToStandard}
                  >
                    {isKm ? 'ចាំលេខសម្ងាត់ចាស់? ប្តូរធម្មតា' : 'Remember your password? Switch back'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </MobileAppShell>
  );
}
