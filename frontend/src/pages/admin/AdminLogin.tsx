import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const stored = localStorage.getItem('rxl_user');
      const loggedInUser = stored ? JSON.parse(stored) : null;
      if (!loggedInUser || loggedInUser.role !== 'ADMIN') {
        logout();
        setError('This account does not have admin access.');
        return;
      }
      navigate('/admin');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-admin.png" alt="RXL Logistics" className="w-16 h-16 object-contain mb-4" />
          <h1 className="text-white font-bold text-xl">RXL <span className="text-accent-400">Admin</span></h1>
          <p className="text-white/40 text-sm mt-1">Sign in to manage the platform</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 space-y-4 shadow-xl">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2.5 flex items-center gap-2">
              <Lock className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Admin email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-white/30 text-xs mt-6">Customer? Use the regular <a href="/login" className="underline">sign in</a> page.</p>
      </div>
    </div>
  );
}
