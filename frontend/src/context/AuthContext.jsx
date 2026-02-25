import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ─── Inactivity settings ──────────────────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;  // 10 minutes
const WARNING_BEFORE_MS     =  1 * 60 * 1000;  // warn 1 minute before logout
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [token,   setToken]   = useState(localStorage.getItem('token'));

  // Inactivity refs (avoid re-renders)
  const inactivityTimer = useRef(null);
  const warningTimer    = useRef(null);
  const warningShown    = useRef(false);
  const isAuthRef       = useRef(false); // mirrors !!user without stale closure issues

  // ── Axios default auth header ──────────────────────────────────────────────
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // ── Logout helper (called by inactivity timer too) ─────────────────────────
  const logout = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    warningShown.current = false;
    isAuthRef.current    = false;
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  // ── Inactivity timeout logic ───────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (!isAuthRef.current) return;

    // Clear existing timers
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);

    // If a warning was already shown, dismiss it
    if (warningShown.current) {
      warningShown.current = false;
      // Remove any visible warning banner (see below)
      window.dispatchEvent(new CustomEvent('inactivity-reset'));
    }

    // Set warning timer (fires 1 min before logout)
    warningTimer.current = setTimeout(() => {
      if (!isAuthRef.current) return;
      warningShown.current = true;
      window.dispatchEvent(new CustomEvent('inactivity-warning', { detail: { secondsLeft: WARNING_BEFORE_MS / 1000 } }));
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set logout timer
    inactivityTimer.current = setTimeout(() => {
      if (!isAuthRef.current) return;
      window.dispatchEvent(new CustomEvent('inactivity-logout'));
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  // ── Register / unregister activity event listeners ─────────────────────────
  useEffect(() => {
    if (!user) {
      // User logged out – clear timers
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
      return;
    }

    isAuthRef.current = true;
    resetInactivityTimer(); // start on login

    const handleActivity = () => resetInactivityTimer();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
    };
  }, [user, resetInactivityTimer]);

  // ── Check if user is logged in on mount ───────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const response = await axios.get(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          if (response.data.success) {
            setUser(response.data.user);
            setToken(savedToken);
            isAuthRef.current = true;
          } else {
            localStorage.removeItem('token');
          }
        } catch {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      if (response.data.success) {
        const { token: t, user: u } = response.data;
        localStorage.setItem('token', t);
        setToken(t);
        setUser(u);
        isAuthRef.current = true;
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const register = async (email, password, name) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, { email, password, name });
      if (response.data.success) {
        const { token: t, user: u } = response.data;
        localStorage.setItem('token', t);
        setToken(t);
        setUser(u);
        isAuthRef.current = true;
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Registration failed' };
    }
  };

  // ── Google Login ───────────────────────────────────────────────────────────
  const googleLogin = async (googleData) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/google`, googleData);
      if (response.data.success) {
        const { token: t, user: u } = response.data;
        localStorage.setItem('token', t);
        setToken(t);
        setUser(u);
        isAuthRef.current = true;
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Google login failed' };
    }
  };

  const value = {
    user, token, login, register, googleLogin, logout,
    isAuthenticated: !!user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
