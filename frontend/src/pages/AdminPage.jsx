import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';

// ─── API helpers ──────────────────────────────────────────────────────────────
const adminAPI = (token) => ({
  getUsers:        ()         => axios.get('/api/admin/users',
                                   { headers: { Authorization: `Bearer ${token}` } }),
  resetPassword:   (id, pwd)  => axios.post(`/api/admin/users/${id}/reset-password`, { password: pwd },
                                   { headers: { Authorization: `Bearer ${token}` } }),
  deleteUser:      (id)       => axios.delete(`/api/admin/users/${id}`,
                                   { headers: { Authorization: `Bearer ${token}` } }),
});

// ─── Password reset modal ─────────────────────────────────────────────────────
function ResetModal({ user, onClose, onSave }) {
  const [pwd,  setPwd]  = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1">איפוס סיסמה</h3>
        <p className="text-sm text-gray-500 mb-4">{user.email}</p>

        <div className="relative mb-4">
          <input
            type={show ? 'text' : 'password'}
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="סיסמה חדשה (לפחות 6 תווים)"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm">
            {show ? '🙈' : '👁️'}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onSave(user.id, pwd)}
            disabled={pwd.length < 6}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
            עדכן סיסמה
          </button>
          <button onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-semibold transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function DeleteModal({ user, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="text-4xl mb-3">🗑️</div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">מחיקת משתמש</h3>
        <p className="text-sm text-gray-500 mb-1">{user.name}</p>
        <p className="text-sm text-red-500 mb-5">
          פעולה זו תמחק את כל הנתונים של המשתמש — תיק, עסקאות, רשימת מעקב.
        </p>
        <div className="flex gap-2">
          <button onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
            מחק לצמיתות
          </button>
          <button onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-semibold transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate    = useNavigate();
  const { token, user } = useAuth();
  const qc          = useQueryClient();
  const api         = adminAPI(token);

  const [resetTarget,  setResetTarget]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  () => api.getUsers().then(r => r.data.data),
  });

  // Reset password mutation
  const resetMutation = useMutation({
    mutationFn: ({ id, pwd }) => api.resetPassword(id, pwd),
    onSuccess: (_, { id }) => {
      const u = data?.find(u => u.id === id);
      toast.success(`סיסמה עודכנה עבור ${u?.email}`);
      setResetTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'שגיאה'),
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteUser(id),
    onSuccess: () => {
      toast.success('משתמש נמחק');
      setDeleteTarget(null);
      qc.invalidateQueries(['admin-users']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'שגיאה'),
  });

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />

      {resetTarget  && <ResetModal  user={resetTarget}  onClose={() => setResetTarget(null)}
        onSave={(id, pwd) => resetMutation.mutate({ id, pwd })} />}
      {deleteTarget && <DeleteModal user={deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)} />}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="text-gray-400 hover:text-gray-700 text-lg transition-colors">←</button>
            <span className="text-lg font-bold text-gray-800">🛡️ ניהול משתמשים</span>
          </div>
          <span className="text-sm text-gray-400">{user?.name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'סה"כ משתמשים', value: data.length, icon: '👥', color: 'blue' },
              { label: 'עם תיק השקעות', value: data.filter(u => u.holdings > 0).length, icon: '💼', color: 'purple' },
              { label: 'עם רשימת מעקב', value: data.filter(u => u.watchlist_items > 0).length, icon: '🔭', color: 'emerald' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Users table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-700">משתמשים רשומים</h2>
            {data && <span className="text-xs text-gray-400">{data.length} משתמשים</span>}
          </div>

          {isLoading && (
            <div className="p-8 text-center text-gray-400">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              טוען...
            </div>
          )}

          {error && (
            <div className="p-8 text-center text-red-400">
              ❌ שגיאה בטעינת המשתמשים — ודא שאתה מחובר כמנהל
            </div>
          )}

          {data && (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-right">#</th>
                      <th className="px-5 py-3 text-right">שם</th>
                      <th className="px-5 py-3 text-right">אימייל</th>
                      <th className="px-5 py-3 text-right">סוג</th>
                      <th className="px-5 py-3 text-right">תאריך הצטרפות</th>
                      <th className="px-5 py-3 text-right">תיק</th>
                      <th className="px-5 py-3 text-right">רדאר</th>
                      <th className="px-5 py-3 text-right">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-400 text-xs">#{u.id}</td>
                        <td className="px-5 py-3 font-medium text-gray-800">
                          {u.name}
                          {u.id === 1 && <span className="mr-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">מנהל</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-600 font-mono text-xs">{u.email}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            u.provider === 'local' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.provider === 'local' ? '🔑 סיסמה' : `🌐 ${u.provider}`}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                        <td className="px-5 py-3 text-center">
                          {u.holdings > 0
                            ? <span className="text-purple-600 font-medium">{u.holdings}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {u.watchlist_items > 0
                            ? <span className="text-blue-600 font-medium">{u.watchlist_items}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {u.provider === 'local' && (
                              <button onClick={() => setResetTarget(u)}
                                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
                                🔑 סיסמה
                              </button>
                            )}
                            {u.id !== 1 && (
                              <button onClick={() => setDeleteTarget(u)}
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors">
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {data.map(u => (
                  <div key={u.id} className="px-4 py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          {u.name}
                          {u.id === 1 && <span className="mr-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">מנהל</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(u.created_at)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                        u.provider === 'local' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {u.provider === 'local' ? '🔑' : '🌐'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      {u.holdings > 0 && <span>💼 {u.holdings} אחזקות</span>}
                      {u.watchlist_items > 0 && <span>🔭 {u.watchlist_items} מעקב</span>}
                    </div>
                    <div className="flex gap-2">
                      {u.provider === 'local' && (
                        <button onClick={() => setResetTarget(u)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          🔑 איפוס סיסמה
                        </button>
                      )}
                      {u.id !== 1 && (
                        <button onClick={() => setDeleteTarget(u)}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          🗑️ מחק
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
