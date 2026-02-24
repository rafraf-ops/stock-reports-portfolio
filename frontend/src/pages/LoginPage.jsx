import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      toast.success('התחברת בהצלחה!');
      setTimeout(() => navigate('/portfolio'), 500);
    } else {
      toast.error(result.error);
    }

    setLoading(false);
  };

  const handleDevLogin = async () => {
    setLoading(true);
    const result = await login('dev@local.com', 'password123');
    
    if (result.success) {
      toast.success('התחברת כמשתמש פיתוח!');
      setTimeout(() => navigate('/portfolio'), 500);
    } else {
      toast.error('שגיאה בהתחברות');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">💼</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ברוכים הבאים</h1>
          <p className="text-gray-600">התחבר לניהול התיק שלך</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                אימייל
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                סיסמה
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">או</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleDevLogin}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors"
              disabled={loading}
            >
              🔧 התחברות פיתוח (dev@local.com)
            </button>
          </div>

          <div className="text-center mt-6">
            <p className="text-gray-600">
              אין לך חשבון?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                הירשם עכשיו
              </Link>
            </p>
          </div>

          <div className="text-center mt-4">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← חזרה לחיפוש חברות (גישה ציבורית)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}