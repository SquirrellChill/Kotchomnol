import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { nodeApi } from '../../services/api';
export default function AuthCallback() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { t } = useLanguage();

  const [error, setError] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase automatically detects the OAuth session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          throw new Error(t('googleSessionNotFound'));
        }

        // Get Google/Supabase user
        const supabaseUser = session.user;

        console.log('Google user:', supabaseUser);

        await nodeApi.post('/auth/google-sync', {
            access_token: session.access_token,
        });

        // Create/update the local KotChomnol user
        // through your backend if needed.
        //
        // For now, store the Supabase user locally.
        const user = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          first_name:
            supabaseUser.user_metadata?.first_name ||
            supabaseUser.user_metadata?.given_name ||
            '',
          last_name:
            supabaseUser.user_metadata?.last_name ||
            supabaseUser.user_metadata?.family_name ||
            '',
          phone_number: supabaseUser.phone || '',
          profile_picture:
            supabaseUser.user_metadata?.avatar_url ||
            supabaseUser.user_metadata?.picture ||
            null,
        };

        updateUser(user);

        // Store Supabase access token
        localStorage.setItem(
          'kc_token',
          session.access_token
        );

        localStorage.setItem(
          'kc_user',
          JSON.stringify(user)
        );

        // Go to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Google authentication callback error:', err);

        setError(
          err?.message ||
            t('googleSignInFailedMessage')
        );
      }
    };

    handleAuthCallback();
  }, [navigate, updateUser]);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Kantumruy Pro, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '450px',
            padding: '32px',
            borderRadius: '16px',
            background: '#fff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            textAlign: 'center',
          }}
        >
          <h2>{t('googleSignInFailedTitle')}</h2>

          <p
            style={{
              color: '#dc2626',
              marginTop: '12px',
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              marginTop: '20px',
              padding: '12px 20px',
              border: 'none',
              borderRadius: '8px',
              background: '#7c3aed',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {t('backToSignIn')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Kantumruy Pro, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2>{t('signingYouIn')}</h2>

        <p>
          {t('pleaseWaitGoogleSignIn')}
        </p>
      </div>
    </div>
  );
}