
import React, { useState } from 'react';
import {
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getErrorMessage,
  register,
} from '../../services/authService';

import './RegisterPage.css';

const emptyForm = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();

  const {
    login,
    loginWithGoogle,
  } = useAuth();

  const { t } = useLanguage();

  // Form state
  const [formData, setFormData] = useState(emptyForm);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // --------------------------------------------------
  // INPUT CHANGE
  // --------------------------------------------------

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: '',
    }));

    setError('');
  };

  // --------------------------------------------------
  // VALIDATION
  // --------------------------------------------------

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.firstName.trim()) {
      nextErrors.firstName = t('fieldRequired');
    }

    if (!formData.lastName.trim()) {
      nextErrors.lastName = t('fieldRequired');
    }

    if (!formData.phoneNumber.trim()) {
      nextErrors.phoneNumber = t('fieldRequired');
    }

    if (
      formData.phoneNumber.trim() &&
      !/^[+\d][\d\s().-]{6,}$/.test(
        formData.phoneNumber.trim()
      )
    ) {
      nextErrors.phoneNumber = t('invalidPhone');
    }

    if (!formData.email.trim()) {
      nextErrors.email = t('fieldRequired');
    }

    if (
      formData.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formData.email.trim()
      )
    ) {
      nextErrors.email = t('invalidEmail');
    }

    if (!formData.password) {
      nextErrors.password = t('fieldRequired');
    }

    if (
      formData.password &&
      formData.password.length < 8
    ) {
      nextErrors.password = t('passwordTooShort');
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = t('fieldRequired');
    }

    if (
      formData.password &&
      formData.confirmPassword &&
      formData.password !== formData.confirmPassword
    ) {
      nextErrors.confirmPassword = t('passwordsNoMatch');
    }

    return nextErrors;
  };

  // --------------------------------------------------
  // BACKEND FIELD ERRORS
  // --------------------------------------------------

  const fieldErrorsFromBackend = (message) => {
    const lower = String(message || '').toLowerCase();

    if (
      lower.includes('email') &&
      (
        lower.includes('exist') ||
        lower.includes('registered') ||
        lower.includes('taken')
      )
    ) {
      return {
        email: t('emailAlreadyRegistered'),
      };
    }

    if (
      lower.includes('phone') &&
      (
        lower.includes('exist') ||
        lower.includes('registered') ||
        lower.includes('taken')
      )
    ) {
      return {
        phoneNumber: t('phoneAlreadyRegistered'),
      };
    }

    if (lower.includes('email')) {
      return {
        email: message,
      };
    }

    if (lower.includes('phone')) {
      return {
        phoneNumber: message,
      };
    }

    if (lower.includes('password')) {
      return {
        password: message,
      };
    }

    return {};
  };

  // --------------------------------------------------
  // NORMAL REGISTER
  // --------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');

    const validationErrors = validateForm();

    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const response = await register(formData);

      const requiresEmailVerification =
        response.data?.data?.requires_email_verification !== false;

      // --------------------------------------------
      // EMAIL VERIFICATION REQUIRED
      // --------------------------------------------

      if (requiresEmailVerification) {
        navigate('/verify-email', {
          state: {
            email: formData.email,
            password: formData.password,
          },
        });

        return;
      }

      // --------------------------------------------
      // NO EMAIL VERIFICATION
      // --------------------------------------------

      try {
        await login({
          email: formData.email,
          password: formData.password,
        });

        navigate('/dashboard');
      } catch {
        navigate('/login', {
          state: {
            registered: true,
            email: formData.email,
          },
        });
      }
    } catch (err) {
      const message = getErrorMessage(err);

      const backendFieldErrors =
        fieldErrorsFromBackend(message);

      setFieldErrors(backendFieldErrors);

      if (
        Object.keys(backendFieldErrors).length === 0
      ) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // GOOGLE LOGIN
  // --------------------------------------------------

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      await loginWithGoogle();

      // Supabase will redirect the browser to Google.
      // No navigate() is needed here.
    } catch (err) {
      setError(getErrorMessage(err));
      setGoogleLoading(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="register-page">
      <div className="register-wrapper">

        {/* BACK BUTTON */}
        <div className="register-top-nav">
          <button
            type="button"
            className="register-back-button"
            onClick={() => navigate('/login')}
          >
            <ArrowLeft size={16} />

            <span>
              {t('backToSignIn') || 'Back to Sign In'}
            </span>
          </button>
        </div>

        {/* MAIN CARD */}
        <div className="register-card">

          {/* LEFT / BANNER */}
          <div className="register-banner">

            <div className="register-banner-content">

              <div className="register-icon-badge">
                <KeyRound size={22} />
              </div>

              <span className="register-brand">
                KOTCHOMNOL
              </span>

              <h1 className="register-title">
                {t('createAccount') || 'Create Account'}
              </h1>

              <p className="register-description">
                {t('signInSubtitle') ||
                  'Sign up to manage your sales voice records and track revenue.'}
              </p>

            </div>

            <div className="register-security">
              <ShieldCheck size={16} />

              <span>
                {t('encryptedSecureAuth')}
              </span>
            </div>

          </div>

          {/* RIGHT / FORM */}
          <div className="register-body">

            <div className="register-form-header">
              <h2>
                {t('signUp') || 'Sign Up'}
              </h2>

              <p>
                {t('enterDetails') ||
                  'Enter your details to create your workspace.'}
              </p>
            </div>

            {/* GENERAL ERROR */}
            {error && (
              <div className="register-error">
                {error}
              </div>
            )}

            <div className="register-form-container">

              <form
                onSubmit={handleSubmit}
                className="register-form"
              >

                {/* FIRST NAME + LAST NAME */}
                <div className="register-grid-2">

                  <div className="register-field">

                    <label htmlFor="firstName">
                      {t('firstName') || 'First Name'}
                    </label>

                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      autoComplete="given-name"
                    />

                    {fieldErrors.firstName && (
                      <span className="register-field-error">
                        {fieldErrors.firstName}
                      </span>
                    )}

                  </div>

                  <div className="register-field">

                    <label htmlFor="lastName">
                      {t('lastName') || 'Last Name'}
                    </label>

                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      autoComplete="family-name"
                    />

                    {fieldErrors.lastName && (
                      <span className="register-field-error">
                        {fieldErrors.lastName}
                      </span>
                    )}

                  </div>

                </div>

                {/* PHONE + EMAIL */}
                <div className="register-grid-2">

                  <div className="register-field">

                    <label htmlFor="phoneNumber">
                      {t('phoneNumber') || 'Phone Number'}
                    </label>

                    <input
                      id="phoneNumber"
                      type="tel"
                      name="phoneNumber"
                      placeholder="+855 12 345 678"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      autoComplete="tel"
                    />

                    {fieldErrors.phoneNumber && (
                      <span className="register-field-error">
                        {fieldErrors.phoneNumber}
                      </span>
                    )}

                  </div>

                  <div className="register-field">

                    <label htmlFor="email">
                      {t('emailAddress') || 'Email Address'}
                    </label>

                    <input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      autoComplete="email"
                    />

                    {fieldErrors.email && (
                      <span className="register-field-error">
                        {fieldErrors.email}
                      </span>
                    )}

                  </div>

                </div>

                {/* PASSWORD + CONFIRM PASSWORD */}
                <div className="register-grid-2">

                  <div className="register-field">

                    <label htmlFor="password">
                      {t('password') || 'Password'}
                    </label>

                    <div className="register-password-wrapper">

                      <input
                        id="password"
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        name="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        className="register-password-toggle"
                        onClick={() =>
                          setShowPassword(
                            !showPassword
                          )
                        }
                        aria-label={
                          showPassword
                            ? t('hidePassword')
                            : t('showPassword')
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>

                    </div>

                    {fieldErrors.password && (
                      <span className="register-field-error">
                        {fieldErrors.password}
                      </span>
                    )}

                  </div>

                  <div className="register-field">

                    <label htmlFor="confirmPassword">
                      {t('confirmPassword') ||
                        'Confirm Password'}
                    </label>

                    <div className="register-password-wrapper">

                      <input
                        id="confirmPassword"
                        type={
                          showConfirmPassword
                            ? 'text'
                            : 'password'
                        }
                        name="confirmPassword"
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        className="register-password-toggle"
                        onClick={() =>
                          setShowConfirmPassword(
                            !showConfirmPassword
                          )
                        }
                        aria-label={
                          showConfirmPassword
                            ? t('hidePassword')
                            : t('showPassword')
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>

                    </div>

                    {fieldErrors.confirmPassword && (
                      <span className="register-field-error">
                        {fieldErrors.confirmPassword}
                      </span>
                    )}

                  </div>

                </div>

                {/* REGISTER BUTTON */}
                <button
                  type="submit"
                  className="register-submit-button"
                  disabled={loading || googleLoading}
                >
                  {loading
                    ? t('registering') ||
                      'Registering...'
                    : t('register') || 'Register'}
                </button>

              </form>

              {/* DIVIDER */}
              <div className="register-divider">
                <div className="register-divider-line" />

                <span>
                  {t('or')}
                </span>

                <div className="register-divider-line" />
              </div>

              {/* GOOGLE */}
              <button
                type="button"
                className="google-login-button"
                onClick={handleGoogleLogin}
                disabled={
                  googleLoading || loading
                }
              >

                <svg
                  className="google-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M21.35 12.23c0-.79-.07-1.55-.2-2.28H12v4.32h5.23a4.47 4.47 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.92-4.18 2.92-7.43z"
                  />

                  <path
                    fill="#34A853"
                    d="M12 21.99c2.63 0 4.84-.87 6.45-2.33l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.99z"
                  />

                  <path
                    fill="#FBBC05"
                    d="M6.54 14.11A5.86 5.86 0 0 1 6.23 12c0-.73.13-1.44.31-2.11V7.36H3.3A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.3 4.64l3.24-2.53z"
                  />

                  <path
                    fill="#EA4335"
                    d="M12 5.86c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.84 2.92 14.63 2 12 2a9.74 9.74 0 0 0-8.7 5.36l3.24 2.53C7.31 7.58 9.46 5.86 12 5.86z"
                  />
                </svg>

                <span>
                  {googleLoading
                    ? t('connectingToGoogle')
                    : t('continueWithGoogle')}
                </span>

              </button>

              {/* LOGIN LINK */}
              <div className="register-footer">
                <span>
                  {t('alreadyAccount') ||
                    'Already have an account?'}
                </span>

                <Link to="/login">
                  {t('signIn') || 'Sign In'}
                </Link>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
