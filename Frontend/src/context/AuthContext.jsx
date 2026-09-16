import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../services/authService.js';
import { isTimeoutError } from '../services/api.js';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('kc_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kc_token');

    if (!token) {
      setLoading(false);
      return;
    }

    authService
      .getMe()
      .then((res) => {
        const freshUser = res.data.data.user;

        setUser(freshUser);
        localStorage.setItem('kc_user', JSON.stringify(freshUser));
      })
      .catch((error) => {
        if (isTimeoutError(error)) {
          console.warn(
            'Session check timed out. Continuing as logged out.',
            error
          );
        } else {
          console.warn(
            'Session check failed. Continuing as logged out.',
            error
          );
        }

        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // EMAIL + PASSWORD LOGIN
  const login = async ({ email, password }) => {
    const res = await authService.login({
      email,
      password,
    });

    const { token, user: loggedInUser } = res.data.data;

    localStorage.setItem('kc_token', token);
    localStorage.setItem('kc_user', JSON.stringify(loggedInUser));

    setUser(loggedInUser);

    return loggedInUser;
  };

  // GOOGLE LOGIN
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }
  };

  // LOGOUT
  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Token may already be invalid — clear local state regardless
    }

    // Also sign out from Supabase
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore Supabase logout errors
    }

    localStorage.removeItem('kc_token');
    localStorage.removeItem('kc_user');

    setUser(null);
  };

  // UPDATE USER
  const updateUser = (nextUser) => {
    localStorage.setItem('kc_user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return ctx;
}
