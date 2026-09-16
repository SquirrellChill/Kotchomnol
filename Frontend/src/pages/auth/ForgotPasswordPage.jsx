import React, { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { forgotPassword, getErrorMessage } from '../../services/authService';
import '../dashboard/ChangePasswordScreen.css';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await forgotPassword({ email });
      setStatusMsg({
        type: 'success',
        text: t('resetLinkSent') || 'Password reset link sent to your email.',
      });
    } catch (err) {
      console.error('Failed to send verification code:', err);
      setStatusMsg({
        type: 'error',
        text: getErrorMessage(err) || t('resetLinkFailed') || 'Failed to send reset link.',
      });
    } finally {
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
                {t('accountSecurity') || 'Account Security'}
              </h2>
              <p className="pwd-banner-desc">
                {t('resetRequestSubtitle') || 'Request a reset link and regain access to your workspace.'}
              </p>
            </div>

            <div className="pwd-banner-footer">
              <ShieldCheck size={16} />
              <span>{t('encryptedSecureAuth')}</span>
            </div>
          </div>

          <div className="pwd-card-body">
            <div className="pwd-form-header">
              <h3>{t('forgotPasswordTitle') || 'Forgot Password'}</h3>
              <p>{t('enterEmailReset') || 'Enter your email to receive a password reset link.'}</p>
            </div>

            {statusMsg.text && (
              <div className={statusMsg.type === 'success' ? 'pwd-alert-success' : 'pwd-alert-error'}>
                {statusMsg.text}
              </div>
            )}

            <div className="pwd-form-embed">
              <form onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email">{t('emailAddress') || 'EMAIL ADDRESS'}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? (t('sendingRequest') || 'Sending...') : (t('sendReset') || 'Send Verification Code')}
                </button>
              </form>

              <div className="pwd-footer-link">
                {t('rememberedPassword') || 'Remembered your password?'}{' '}
                <Link to="/login">{t('backToSignIn') || 'Back to Sign In'}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}