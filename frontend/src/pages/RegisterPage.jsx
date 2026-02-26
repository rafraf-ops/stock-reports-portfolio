import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);

  const pwdStrength = (p) => {
    if (!p) return 0;
    let score = 0;
    if (p.length >= 6)  score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score; // 0-5
  };
  const strength     = pwdStrength(formData.password);
  const strengthText = ['', 'חלשה מאוד', 'חלשה', 'בינונית', 'חזקה', 'חזקה מאוד'][strength];
  const strengthColor = strength <= 1 ? 'bg-red-400' : strength <= 2 ? 'bg-yellow-400' : strength <= 3 ? 'bg-blue-400' : 'bg-green-400';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { toast.error('הסיסמאות לא תואמות'); return; }
    if (formData.password.length < 6)                   { toast.error('סיסמה חייבת להיות לפחות 6 תווים'); return; }
    setLoading(true);
    const result = await register(formData.email, formData.password, formData.name);
    if (result.success) {
      toast.success('נרשמת בהצלחה! 🎉');
      setTimeout(() => navigate('/portfolio'), 400);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col items-center justify-center p-4"
      dir="rtl"
    >
      <Toaster position="top-center" />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      </div>

      {/* Brand */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 backdrop-blur rounded-2xl border border-purple-400/30 mb-3 text-3xl shadow-lg shadow-purple-500/20">
          🚀
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">StockAnalyzer</h1>
        <p className="text-purple-300 text-sm mt-0.5">הצטרף ונהל את ההשקעות שלך</p>
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1">יצירת חשבון ✨</h2>
        <p className="text-purple-300 text-sm mb-6">מלא פרטים להתחלה</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1.5">שם מלא</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="ישראל ישראלי"
              disabled={loading}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1.5">אימייל</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              disabled={loading}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1.5">סיסמה</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="לפחות 6 תווים"
                disabled={loading}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white text-sm transition-colors">
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {/* Strength bar */}
            {formData.password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= strength ? strengthColor : 'bg-white/10'}`} />
                  ))}
                </div>
                <p className="text-xs text-purple-300">{strengthText}</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1.5">אימות סיסמה</label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              value={formData.confirmPassword}
              onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="הזן סיסמה שוב"
              disabled={loading}
              className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                formData.confirmPassword && formData.password !== formData.confirmPassword
                  ? 'border-red-400/60 focus:ring-red-400'
                  : 'border-white/20 focus:ring-purple-400'
              }`}
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-400 mt-1">הסיסמאות לא תואמות</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-400 active:scale-[0.98] disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg shadow-purple-500/30 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                נרשם...
              </span>
            ) : 'הירשם →'}
          </button>
        </form>

        <p className="text-center text-purple-300 text-sm mt-5">
          כבר יש לך חשבון?{' '}
          <Link to="/login" className="text-white font-semibold hover:text-purple-200 transition-colors">
            התחבר
          </Link>
        </p>

        <div className="text-center mt-3">
          <Link to="/" className="text-xs text-purple-400 hover:text-purple-200 transition-colors">
            ← המשך ללא התחברות
          </Link>
        </div>
      </div>
    </div>
  );
}
