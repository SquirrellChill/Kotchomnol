import React, { useState } from 'react';
import { ArrowLeft, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage, verifyEmail } from '../../services/authService';
import '../dashboard/ChangePasswordScreen.css';

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState(location.state?.email || '');
  const password = location.state?.password || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = t('fieldRequired');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = t('invalidEmail');
    if (!code.trim()) nextErrors.code = t('fieldRequired');
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      await verifyEmail({ email, code: code.trim() });

      // Skip the separate login step: if we still have the password from
      // registration, sign the user in right away and drop them into the
      // app. Otherwise (e.g. page was opened directly), fall back to login.
      if (password) {
        try {
          await login({ email, password });
          navigate('/dashboard');
          return;
        } catch {
          // Auto-login failed — the account is verified, just send them to
          // the login page instead of leaving them stuck here.
        }
      }
      navigate('/login');
    } catch (err) {
      const message = getErrorMessage(err);
      const lower = String(message).toLowerCase();
      if (lower.includes('code') || lower.includes('verification') || lower.includes('invalid')) {
        setFieldErrors({ code: t('invalidVerificationCode') || 'Invalid verification code.' });
      } else {
        setError(message);
      }
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
                <MailCheck size={22} />
              </div>
              <span className="pwd-brand-text">KOTCHOMNOL</span>
              <h2 className="pwd-banner-title">
                {t('verifyEmail') || 'Verify Email'}
              </h2>
              <p className="pwd-banner-desc">
                {t('verifySubtitle') || 'Confirm your email address to complete your registration.'}
              </p>
            </div>

            <div className="pwd-banner-footer">
              <ShieldCheck size={16} />
              <span>{t('encryptedSecureAuth')}</span>
            </div>
          </div>

          <div className="pwd-card-body">
            <div className="pwd-form-header">
              <h3>{t('verifyEmail') || 'Verify Email'}</h3>
              <p>{t('confirmEmail') || 'Enter the code sent to your inbox.'}</p>
            </div>

            {error && <div className="pwd-alert-error">{error}</div>}

            <div className="pwd-form-embed">
              <form onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email">{t('email') || 'Email Address'}</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldErrors((current) => ({ ...current, email: '' }));
                    }}
                    required
                  />
                  {fieldErrors.email && (
                    <span style={{ color: '#ef4444', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      {fieldErrors.email}
                    </span>
                  )}
                </div>

                <div>
                  <label htmlFor="code">{t('verificationCode') || 'Verification Code'}</label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    autoComplete="one-time-code"
                    placeholder="••••••"
                    style={{
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '16px',
                    }}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setFieldErrors((current) => ({ ...current, code: '' }));
                    }}
                    required
                  />
                  {fieldErrors.code && (
                    <span style={{ color: '#ef4444', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      {fieldErrors.code}
                    </span>
                  )}
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? (t('verifying') || 'Verifying...') : (t('verifyEmail') || 'Verify Email')}
                </button>
              </form>

              <div className="pwd-footer-link">
                {t('alreadyVerified') || 'Already verified?'}{' '}
                <Link to="/login">{t('signIn') || 'Sign In'}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}