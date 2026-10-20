import axios from 'axios';
import { supabase } from '../lib/supabase';

export const AUTH_BOOTSTRAP_TIMEOUT_MS = Number(
  import.meta.env.VITE_AUTH_BOOTSTRAP_TIMEOUT_MS || 10000
);

// Fired when the session can't be renewed; AuthContext logs the user out.
export const SESSION_EXPIRED_EVENT = 'kc:session-expired';

// When the dev server is opened from a phone on the same Wi-Fi
// (http://192.168.x.x:5173), "localhost" in the API URL would point at the
// phone itself. Use the laptop's address the page was loaded from instead.
const resolveApiUrl = (url) => {
  if (!url || typeof window === 'undefined') return url;
  try {
    const api = new URL(url);
    const pageHost = window.location.hostname;
    const isLocal = (host) => host === 'localhost' || host === '127.0.0.1';
    if (isLocal(api.hostname) && !isLocal(pageHost)) {
      api.hostname = pageHost;
      return api.toString().replace(/\/$/, '');
    }
  } catch {
    // Not an absolute URL; use it as given.
  }
  return url;
};

// Backend: the FastAPI service handling auth, transactions, and voice.
export const nodeApi = axios.create({
  baseURL: resolveApiUrl(import.meta.env.VITE_NODE_API_URL),
  headers: { 'Content-Type': 'application/json' },
});

// Kept as a separate client shape for compatibility with existing callers.
export const aiApi = axios.create({
  baseURL: resolveApiUrl(import.meta.env.VITE_AI_API_URL),
});

// core/dependencies.py uses HTTPBearer and expects "Authorization: Bearer <token>".
nodeApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('kc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const storeSession = (session) => {
  localStorage.setItem('kc_token', session.access_token);
  if (session.refresh_token) {
    localStorage.setItem('kc_refresh_token', session.refresh_token);
  }
};

// supabase-js renews the session it holds about a minute before it expires.
// Keep our stored token in step so requests rarely hit a 401 at all.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session && localStorage.getItem('kc_token')) {
    storeSession(session);
  }
});

// Supabase access tokens last an hour. Get a fresh one, preferring the
// session supabase-js already holds (it may have renewed it already), since
// re-using an old refresh token after it was rotated revokes the session.
let refreshInFlight = null;

const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const expiredToken = localStorage.getItem('kc_token');
      const { data } = await supabase.auth.getSession();
      let session = data?.session;

      if (!session || session.access_token === expiredToken) {
        const refreshToken = session?.refresh_token || localStorage.getItem('kc_refresh_token');
        if (!refreshToken) return null;
        const { data: refreshed, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !refreshed?.session) return null;
        session = refreshed.session;
      }

      storeSession(session);
      return session.access_token;
    })()
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

// These return 401 for wrong credentials, not for an expired session.
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/telegram/login', '/auth/google-sync'];

const expireSession = () => {
  localStorage.removeItem('kc_token');
  localStorage.removeItem('kc_refresh_token');
  localStorage.removeItem('kc_user');
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};

nodeApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const sentToken = Boolean(config?.headers?.Authorization);
    const isCredentialCheck = CREDENTIAL_ENDPOINTS.some((path) => config?.url?.startsWith(path));

    if (response?.status === 401 && sentToken && !isCredentialCheck) {
      if (!config._retriedAfterRefresh) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          config._retriedAfterRefresh = true;
          config.headers.Authorization = `Bearer ${newToken}`;
          return nodeApi(config);
        }
      }
      expireSession();
    }

    return Promise.reject(error);
  }
);

export const isTimeoutError = (error) => error?.code === 'ECONNABORTED';
