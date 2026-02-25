import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import CompanyPage from './pages/CompanyPage';
import PortfolioPage from './pages/PortfolioPage';
import PnLPage from './pages/PnLPage';
import FinancePage from './pages/FinancePage';
import TransactionsPage from './pages/TransactionsPage';
import ImportPage from './pages/ImportPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WatchlistPage from './pages/WatchlistPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1
    },
  },
});

// ─── Inactivity warning banner ────────────────────────────────────────────────
function InactivityBanner() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(null); // null = hidden

  useEffect(() => {
    let countdown = null;

    const showWarning = (e) => {
      let secs = e.detail?.secondsLeft || 60;
      setSecondsLeft(secs);
      countdown = setInterval(() => {
        secs -= 1;
        if (secs <= 0) {
          clearInterval(countdown);
          setSecondsLeft(null);
        } else {
          setSecondsLeft(secs);
        }
      }, 1000);
    };

    const hideWarning = () => {
      clearInterval(countdown);
      setSecondsLeft(null);
    };

    const handleLogout = () => {
      clearInterval(countdown);
      setSecondsLeft(null);
      navigate('/login');
    };

    window.addEventListener('inactivity-warning', showWarning);
    window.addEventListener('inactivity-reset',   hideWarning);
    window.addEventListener('inactivity-logout',  handleLogout);

    return () => {
      clearInterval(countdown);
      window.removeEventListener('inactivity-warning', showWarning);
      window.removeEventListener('inactivity-reset',   hideWarning);
      window.removeEventListener('inactivity-logout',  handleLogout);
    };
  }, [navigate]);

  if (!isAuthenticated || secondsLeft === null) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-4 bg-orange-600 text-white px-5 py-3 rounded-2xl shadow-2xl animate-bounce-once"
    >
      <span className="text-xl">⏳</span>
      <div>
        <p className="font-bold text-sm">חוסר פעילות — התנתקות אוטומטית בעוד</p>
        <p className="text-orange-100 text-xs font-mono">{secondsLeft} שניות</p>
      </div>
      <button
        onClick={() => {
          // Trigger any activity event to reset the timer
          window.dispatchEvent(new MouseEvent('mousedown'));
          setSecondsLeft(null);
        }}
        className="bg-white text-orange-600 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
      >
        הישאר מחובר
      </button>
      <button
        onClick={() => { logout(); navigate('/login'); }}
        className="text-orange-200 hover:text-white text-xs underline"
      >
        התנתק עכשיו
      </button>
    </div>
  );
}

// ─── Protected route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ─── App wrapper (needs to be inside AuthProvider for InactivityBanner) ───────
function AppRoutes() {
  return (
    <>
      <InactivityBanner />
      <Routes>
        {/* Public */}
        <Route path="/"                  element={<HomePage />} />
        <Route path="/company/:symbol"   element={<CompanyPage />} />
        <Route path="/login"             element={<LoginPage />} />
        <Route path="/register"          element={<RegisterPage />} />

        {/* Protected */}
        <Route path="/portfolio"         element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
        <Route path="/portfolio/pnl"     element={<ProtectedRoute><PnLPage /></ProtectedRoute>} />
        <Route path="/finance"           element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
        <Route path="/finance/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
        <Route path="/finance/import"    element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
        <Route path="/watchlist"         element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
