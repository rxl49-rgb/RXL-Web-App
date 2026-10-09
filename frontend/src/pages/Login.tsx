import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Clock3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPending, setShowPending] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.response?.data?.code === 'PENDING') {
        setShowPending(true);
      } else {
        setError(err.response?.data?.error || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: 'admin' | 'customer') => {
    setForm(role === 'admin'
      ? { email: 'admin@rxllogistics.com', password: 'admin123' }
      : { email: 'demo@rxllogistics.com', password: 'customer123' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)] flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-5">
            <img src="/logo.png" alt="RXL Logistics" className="w-12 h-12 object-contain" />
            <span className="text-xl font-bold text-brand-900">RXL Logistics</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="text-gray-500 dark:text-white/50 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Demo accounts */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => fillDemo('customer')} className="flex-1 text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 py-2 px-3 rounded-lg transition-colors">
            Demo Customer
          </button>
          <button onClick={() => fillDemo('admin')} className="flex-1 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-2 px-3 rounded-lg transition-colors">
            Demo Admin
          </button>
        </div>

        <div className="bg-white dark:bg-white/[0.06] rounded-2xl shadow-sm dark-depth border p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required placeholder="••••••••"
                  className="w-full border rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-white/50 mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-700 hover:text-brand-600 font-medium">Create one</Link>
        </p>
      </div>

      {showPending && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl dark-depth max-w-md w-full p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
              <Clock3 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Account Under Review</h3>
            <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">
              Your account is currently being reviewed and is not yet active. Please allow up to 24 hours for activation.
            </p>
            <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed mt-3">
              Account activations are processed during regular business hours. Once activated, you'll receive an email with your shipping instructions and important policies.
            </p>
            <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed mt-3">
              Thank you for choosing RXL Logistics.
            </p>
            <button onClick={() => setShowPending(false)}
              className="w-full mt-6 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-3 rounded-xl transition-colors">
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
