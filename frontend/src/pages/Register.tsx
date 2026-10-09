import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, Upload, FileText, X, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: '', trn: '', password: '', confirm: '',
  });
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdDocument(e.target.files?.[0] || null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.address || !form.city || !form.trn || !form.password || !form.confirm) {
      return setError('All fields are required');
    }
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (!idDocument) return setError('Government ID is required');
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('firstName', form.firstName);
      fd.append('lastName', form.lastName);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('address', form.address);
      fd.append('city', form.city);
      fd.append('trn', form.trn);
      fd.append('password', form.password);
      fd.append('idDocument', idDocument);
      await register(fd);
      setShowWelcome(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)] flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-5">
            <img src="/logo-print.png" alt="RXL Logistics" className="w-12 h-12 object-contain" />
            <span className="text-xl font-bold text-brand-900">RXL Logistics</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h1>
          <p className="text-gray-500 dark:text-white/50 text-sm mt-1">Get started with RXL Logistics today</p>
        </div>

        <div className="bg-white dark:bg-white/[0.06] rounded-2xl shadow-sm dark-depth border p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">First Name</label>
                <input type="text" value={form.firstName} onChange={set('firstName')} required placeholder="John"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Last Name</label>
                <input type="text" value={form.lastName} onChange={set('lastName')} required placeholder="Doe"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')} required placeholder="+1-555-0100"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Address</label>
              <input type="text" value={form.address} onChange={set('address')} required placeholder="Street address"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">City</label>
                <input type="text" value={form.city} onChange={set('city')} required placeholder="Kingston"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">TRN</label>
                <input type="text" value={form.trn} onChange={set('trn')} required placeholder="000-000-000"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                Government ID <span className="text-red-500">*</span>
              </label>
              <input ref={fileInputRef} type="file" hidden accept="image/*,application/pdf" onChange={handleFileSelected} />
              {!idDocument ? (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-4 text-sm text-gray-500 dark:text-white/50 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                  <Upload className="w-4 h-4" /> Upload a photo or PDF of your ID
                </button>
              ) : (
                <div className="flex items-center justify-between border rounded-xl px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-white/70 truncate">
                    <FileText className="w-4 h-4 text-brand-700 dark:text-brand-400 flex-shrink-0" /> {idDocument.name}
                  </span>
                  <button type="button" onClick={() => { setIdDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-gray-400 dark:text-white/30 hover:text-red-500 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-white/30 mt-1.5">Driver's license, passport, or national ID — required to create an account.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required placeholder="Min 6 characters"
                  className="w-full border rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">Confirm Password</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} required placeholder="Repeat password"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs text-gray-400 dark:text-white/30">
          {['Free to create', 'Real-time tracking', 'Secure & private'].map(text => (
            <div key={text} className="flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" />{text}</div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-white/50 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-700 hover:text-brand-600 font-medium">Sign in</Link>
        </p>
      </div>

      {showWelcome && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl dark-depth max-w-md w-full p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-500/15 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-6 h-6 text-brand-700 dark:text-brand-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Welcome to RXL Logistics</h3>
            <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">
              Your application has been successfully received and is currently being processed. Please allow up to 24 hours for your account to be activated.
            </p>
            <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed mt-3">
              Once your account is active, you will receive a confirmation email containing your shipping instructions, warehouse information, and important policies. Account activations are processed during regular business hours.
            </p>
            <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed mt-3">
              Thank you for choosing RXL Logistics.
            </p>
            <button onClick={() => navigate('/login')}
              className="w-full mt-6 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-3 rounded-xl transition-colors">
              Continue to Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
