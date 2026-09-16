
import React, { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/authService';
import '../dashboard/ChangePasswordScreen.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const { language, t } = useLanguage();
  const isKm = language !== 'en';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // EMAIL + PASSWORD LOGIN
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      setError(getErrorMessage(err));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div
        className="pwd-split-wrapper font-kantumruy"
        style={{ width: '100%' }}
      >
        <div className="pwd-top-nav">
          <button
            type="button"
            className="pwd-back-btn"
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={16} />
            <span>
              {t('backToHomepage') || 'Back to Homepage'}
            </span>
          </button>
        </div>

        <div className="pwd-auth-card">
          <div className="pwd-card-banner">
            <div>
              <div className="pwd-icon-badge">
                <KeyRound size={22} />
              </div>

              <span className="pwd-brand-text">
                KOTCHOMNOL
              </span>

              <h2 className="pwd-banner-title">
                {t('welcomeBackTitle') || 'Welcome Back'}
              </h2>

              <p className="pwd-banner-desc">
                {t('signInSubtitle') ||
                  'Sign in to access your voice sales dashboard.'}
              </p>
            </div>

            <div className="pwd-banner-footer">
              <ShieldCheck size={16} />
              <span>
                Encrypted & Secure authentication
              </span>
            </div>
          </div>

          <div className="pwd-card-body">
            <div className="pwd-form-header">
              <h3>
                {t('signIn') || 'Sign In'}
              </h3>

              <p>
                {t('enterCredentials') ||
                  'Enter your credentials to continue.'}
              </p>
            </div>

            {error && (
              <div className="pwd-alert-error">
                {error}
              </div>
            )}

            <div className="pwd-form-embed">
              <form onSubmit={handleSubmit}>
                {/* EMAIL */}
                <div>
                  <label htmlFor="email">
                    {t('emailAddress') || 'EMAIL ADDRESS'}
                  </label>

                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                {/* PASSWORD */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <label
                      htmlFor="password"
                      style={{ margin: 0 }}
                    >
                      {t('password') || 'PASSWORD'}
                    </label>

                    <Link
                      to="/forgot-password"
                      style={{
                        fontSize: '12px',
                        color: '#9333ea',
                        textDecoration: 'none',
                        fontWeight: '600',
                      }}
                    >
                      {t('forgotPassword') ||
                        'Forgot Password?'}
                    </Link>
                  </div>

                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      id="password"
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      name="password"
                      required
                      autoComplete="current-password"
                      className="pwd-input-with-toggle"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                    />

                    <button
                      type="button"
                      className="pwd-toggle-btn"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* EMAIL LOGIN BUTTON */}
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                >
                  {loading
                    ? t('signingIn') || 'Signing in...'
                    : t('signIn') || 'Sign In'}
                </button>
              </form>

              {/* DIVIDER */}
              <div className="pwd-divider">
                <div className="pwd-divider-line" />

                <span className="pwd-divider-text">
                  {isKm
                    ? 'ឬ'
                    : t('or') || 'OR'}
                </span>

                <div className="pwd-divider-line" />
              </div>

              {/* GOOGLE LOGIN */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor:
                    googleLoading || loading
                      ? 'not-allowed'
                      : 'pointer',
                  marginBottom: '12px',
                }}
              >
                {googleLoading ? (
                  'Connecting to Google...'
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="#4285F4"
                        d="M21.35 12.23c0-.79-.07-1.55-.23-2.27H12v4.3h5.21a4.45 4.45 0 0 1-1.93 2.92v2.43h3.12c1.83-1.69 2.95-4.18 2.95-7.38z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 21.6c2.62 0 4.82-.87 6.43-2.36l-3.12-2.43c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.32v2.51A9.71 9.71 0 0 0 12 21.6z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M6.54 13.71A5.84 5.84 0 0 1 6.23 12c0-.59.11-1.17.31-1.71V7.78H3.32A9.72 9.72 0 0 0 2.29 12c0 1.57.38 3.05 1.03 4.22l3.22-2.51z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 6.26c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.82 3.27 14.62 2.4 12 2.4a9.71 9.71 0 0 0-8.68 5.38l3.22 2.51C7.31 7.98 9.46 6.26 12 6.26z"
                      />
                    </svg>

                    {t('continueWithGoogle') ||
                      'Continue with Google'}
                  </>
                )}
              </button>

              {/* REGISTER */}
              <div className="pwd-footer-link">
                {t('newHere') || 'New here?'}{' '}
                <Link to="/register">
                  {t('createAnAccount') ||
                    'Create an account'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
