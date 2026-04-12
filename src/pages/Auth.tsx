import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Eye, EyeOff, MessageSquare, Sparkles, Zap } from 'lucide-react';
import PulseLogo from '@/components/PulseLogo';
import toast from 'react-hot-toast';

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/feed';
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => { document.title = 'Pulse 23 · Sign In'; }, []);
  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, navigate, next]);

  const getStrength = () => {
    let s = 0;
    if (password.length >= 4) s++;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) s++;
    if (password.length >= 12 && /[^A-Za-z0-9]/.test(password)) s++;
    return s;
  };
  const strength = getStrength();
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  const validateEmail = () => {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Invalid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else navigate(next, { replace: true });
    } catch { setError('Something went wrong'); }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || email.split('@')[0] } },
      });
      if (err) setError(err.message);
      else toast.success('Check your email to confirm!');
    } catch { setError('Something went wrong'); }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email first'); return; }
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      toast.success('Password reset email sent!');
    } catch { toast.error('Failed to send reset email'); }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #4F46E5 50%, #7C3AED 100%)' }}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <PulseLogo size={48} />
            <h1 className="text-4xl font-bold text-white">Pulse 23</h1>
          </div>
          <p className="text-lg text-white/80 mb-8">Your world, in motion.</p>
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {[
              { icon: MessageSquare, text: 'Share your thoughts in 280 characters' },
              { icon: Sparkles, text: 'AI-powered post enhancement' },
              { icon: Zap, text: 'Real-time messaging and notifications' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/90">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-zinc-950">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <PulseLogo size={28} />
            <h2 className="text-2xl font-bold" style={{ background: 'linear-gradient(to right, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pulse 23</h2>
          </div>

          {/* Pill toggle */}
          <div className="relative flex bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 mb-6">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-zinc-700 rounded-full shadow-sm transition-transform duration-200"
              style={{ transform: tab === 'signup' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
            />
            <button onClick={() => setTab('signin')} className={`flex-1 py-2 text-sm font-medium rounded-full transition relative z-10 ${tab === 'signin' ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-500'}`}>Sign In</button>
            <button onClick={() => setTab('signup')} className={`flex-1 py-2 text-sm font-medium rounded-full transition relative z-10 ${tab === 'signup' ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-500'}`}>Create Account</button>
          </div>

          {error && <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-xl p-3 mb-4 border border-red-200 dark:border-red-900">{error}</div>}

          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {tab === 'signup' && (
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
              />
            )}
            <div>
              <input
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                onBlur={validateEmail}
                type="email"
                placeholder="Email"
                required
                className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border ${emailError ? 'border-red-400' : 'border-zinc-200 dark:border-zinc-700'} text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900`}
              />
              {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
            </div>
            <div className="relative">
              <input
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
                onBlur={() => { if (tab === 'signup' && password.length > 0 && password.length < 8) setPasswordError('At least 8 characters'); else setPasswordError(''); }}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                required
                className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border ${passwordError ? 'border-red-400' : 'border-zinc-200 dark:border-zinc-700'} text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 pr-10`}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3.5 text-zinc-400" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}
            </div>
            {tab === 'signup' && password && (
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? strengthColors[strength - 1] : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                ))}
              </div>
            )}
            {tab === 'signup' && (
              <input
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                type="password"
                placeholder="Confirm password"
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
              />
            )}
            {tab === 'signin' && (
              <button type="button" onClick={handleForgotPassword} className="text-sm text-blue-600 hover:underline">Forgot password?</button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center"
              aria-label={tab === 'signin' ? 'Sign in' : 'Create account'}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (tab === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
