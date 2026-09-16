import React, { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { resetPassword } from '../../services/authService';
import '../dashboard/ChangePasswordScreen.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setStatusMsg({ type: 'error', text: t('resetMissing') || 'Reset token is missing or invalid.' });
      return;
    }

    if (password !== confirmPassword) {
      setStatusMsg({ type: 'error', text: t('passwordsNoMatch') || 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await resetPassword({ token, password });
      setStatusMsg({ type: 'success', text: t('resetSuccess') || 'Password updated successfully! Redirecting to login...' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      console.error('Reset error:', err);
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.detail || t('resetTokenInvalid'),
      });
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="pwd-split-wrapper font-kantumruy" style={{ width: '100%' }}>
        <div className="pwd-top-nav">
          <button type="button" className="pwd-back-btn" onClick={() => navigate('/login')}>
            <ArrowLeft size={16} />
            <span>{t('backToSignIn') || 'Back to Login'}</span>
          </button>
        </div>

        <div className="pwd-auth-card">
          <div className="pwd-card-banner">
            <div>
              <div className="pwd-icon-badge">
                <KeyRound size={22} />
              </div>
              <span className="pwd-brand-text">KOTCHOMNOL</span>
              <h2 className="pwd-banner-title">
                {t('resetPassword') || 'Change Password'}
              </h2>
              <p className="pwd-banner-desc">
                {t('resetSubtitle') || 'Update your password regularly to keep your business records and sales safe.'}
              </p>
            </div>

            <div className="pwd-banner-footer">
              <ShieldCheck size={16} />
              <span>{t('encryptedSecureAuth')}</span>
            </div>
          </div>

          <div className="pwd-card-body">
            <div className="pwd-form-header">
              <h3>{t('setNewPassword') || 'Create a New Password'}</h3>
              <p>{t('enterNewPassword') || 'Please enter your current and new credentials below.'}</p>
            </div>

            {statusMsg.text && (
              <div className={statusMsg.type === 'success' ? 'pwd-alert-success' : 'pwd-alert-error'}>
                {statusMsg.text}
              </div>
            )}

            <div className="pwd-form-embed">
              <form onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="new-password">{t('newPassword') || 'NEW PASSWORD'}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      className="pwd-input-with-toggle"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pwd-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password">{t('confirmNewPassword') || 'CONFIRM PASSWORD'}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      className="pwd-input-with-toggle"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pwd-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? (t('updatingPassword') || 'Updating Password...') : (t('resetPassword') || 'Change password')}
                </button>
              </form>

              <div className="pwd-footer-link">
                <Link to="/login">{t('backToSignIn') || 'Cancel and return to Sign In'}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}