import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      if (res.data.success) {
        setDone(true);
        if (res.data.emailSent) {
          toast.success('קישור נשלח לאימייל שלך');
        } else if (res.data.resetUrl) {
          // Dev mode — no SMTP configured, show the link directly
          toast(
            <span>
              <strong>מצב פיתוח</strong> — אין SMTP, לחץ{' '}
              <a href={res.data.resetUrl} className="underline text-blue-600">כאן</a>{' '}
              לאיפוס
            </span>,
            { duration: 30000, icon: '🔧' }
          );
        }
      }
    } catch {
      toast.error('שגיאה — נסה שוב');
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
          /* Success state */
          <div className="text-center py-4">
            <div className="text-5xl mb-4">📬</div>
            <h2 className="text-xl font-bold text-white mb-2">בדוק את האימייל שלך</h2>
            <p className="text-blue-200 text-sm leading-relaxed">
              אם האימייל קיים במערכת, שלחנו קישור לאיפוס הסיסמה.
              הקישור תקף לשעה אחת.
            </p>
            <Link to="/login"
              className="inline-block mt-6 text-blue-300 hover:text-white text-sm transition-colors">
              ← חזרה להתחברות
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-white mb-1">שכחת סיסמה?</h2>
            <p className="text-blue-300 text-sm mb-6">הזן את האימייל שלך ונשלח לך קישור לאיפוס</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1.5">אימייל</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-400 active:scale-[0.98] disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg shadow-blue-500/30">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    שולח...
                  </span>
                ) : 'שלח קישור לאיפוס'}
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
