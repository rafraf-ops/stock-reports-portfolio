import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd,         setShowPwd]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center text-white">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold mb-2">קישור לא תקין</h2>
          <Link to="/forgot-password" className="text-blue-300 hover:text-white text-sm">בקש קישור חדש</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('הסיסמאות לא תואמות'); return; }
    if (password.length < 6)         { toast.error('סיסמה חייבת להיות לפחות 6 תווים'); return; }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/reset-password', { token, password });
      if (res.data.success) {
        setDone(true);
        toast.success('הסיסמה עודכנה!');
        setTimeout(() => navigate('/login'), 2500);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה — הקישור אולי פג תוקפו');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4" dir="rtl">
      <Toaster position="top-center" />

      {/* Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500/20 backdrop-blur rounded-2xl border border-blue-400/30 mb-3 text-2xl">
          📊
        </div>
        <h1 className="text-2xl font-bold text-white">StockAnalyzer</h1>
      </div>

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
        {done ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">הסיסמה עודכנה!</h2>
            <p className="text-blue-200 text-sm">מועבר לדף התחברות...</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-white mb-1">בחר סיסמה חדשה</h2>
            <p className="text-blue-300 text-sm mb-6">הזן סיסמה חדשה לחשבונך</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-blue-200 mb-1.5">סיסמה חדשה</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="לפחות 6 תווים"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute left-3 top-[2.35rem] text-blue-300 hover:text-white text-sm transition-colors">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1.5">אימות סיסמה</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="הזן סיסמה שוב"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                />
              </div>

              {/* Password strength dots */}
              {password.length > 0 && (
                <div className="flex gap-1">
                  {[2, 4, 6, 8, 10].map((min, i) => (
                    <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                      password.length >= min
                        ? i < 2 ? 'bg-red-400' : i < 4 ? 'bg-yellow-400' : 'bg-green-400'
                        : 'bg-white/10'
                    }`} />
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-400 active:scale-[0.98] disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg shadow-blue-500/30 mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    מעדכן...
                  </span>
                ) : 'עדכן סיסמה'}
              </button>
            </form>

            <div className="text-center mt-6">
              <Link to="/login" className="text-blue-300 hover:text-white text-sm transition-colors">
                ← חזרה להתחברות
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
