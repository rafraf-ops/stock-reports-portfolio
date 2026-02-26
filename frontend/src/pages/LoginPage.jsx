import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(formData.email, formData.password);
    if (result.success) {
      toast.success('ברוך הבא! 🎉');
      setTimeout(() => navigate('/portfolio'), 400);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleDevPrefill = () => {
    setFormData({ email: 'dev@local.com', password: '' });
    toast('הוזן אימייל פיתוח — הזן סיסמה להמשך', { icon: '🔧' });
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4"
      dir="rtl"
    >
      <Toaster position="top-center" />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>

      {/* Brand header */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 backdrop-blur rounded-2xl border border-blue-400/30 mb-3 text-3xl shadow-lg shadow-blue-500/20">
          📊
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">StockAnalyzer</h1>
        <p className="text-blue-300 text-sm mt-0.5">ניתוח מניות בזמן אמת · ישראל &amp; עולם</p>
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1">ברוך הבא 👋</h2>
        <p className="text-blue-300 text-sm mb-6">התחבר לניהול התיק שלך</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-1.5">אימייל</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              disabled={loading}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-blue-200">סיסמה</label>
              <Link to="/forgot-password" className="text-xs text-blue-400 hover:text-blue-200 transition-colors">
                שכחתי סיסמה
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                disabled={loading}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white text-sm transition-colors"
                tabIndex={-1}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-400 active:scale-[0.98] disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg shadow-blue-500/30 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                מתחבר...
              </span>
            ) : 'התחבר →'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-blue-400 text-xs">או</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Dev prefill */}
        <button
          type="button"
          onClick={handleDevPrefill}
          disabled={loading}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-blue-300 hover:text-white py-2.5 rounded-xl text-sm font-medium transition-all"
        >
          🔧 מלא אימייל פיתוח
        </button>

        {/* Register link */}
        <p className="text-center text-blue-300 text-sm mt-5">
          אין לך חשבון?{' '}
          <Link to="/register" className="text-white font-semibold hover:text-blue-200 transition-colors">
            הירשם עכשיו
          </Link>
        </p>

        <div className="text-center mt-3">
          <Link to="/" className="text-xs text-blue-400 hover:text-blue-200 transition-colors">
            ← המשך ללא התחברות
          </Link>
        </div>
      </div>
    </div>
  );
}
