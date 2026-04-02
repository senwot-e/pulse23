import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/feed';
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Pulse 23 · Sign In'; }, []);
  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, navigate, next]);

  const strength = password.length >= 12 ? 100 : password.length >= 8 ? 66 : password.length >= 4 ? 33 : 0;
  const strengthColor = strength >= 66 ? 'bg-green-500' : strength >= 33 ? 'bg-amber-500' : 'bg-destructive';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    else navigate(next, { replace: true });
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split('@')[0] } },
    });
    if (err) setError(err.message);
    else { toast.success('Check your email to confirm!'); }
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + next } });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 gradient-primary items-center justify-center p-12">
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold text-primary-foreground mb-3">⚡ Pulse 23</h1>
          <p className="text-lg text-primary-foreground/80 mb-8">Your world, in motion.</p>
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {['Share your thoughts in 280 characters', 'AI-powered post enhancement', 'Real-time messaging & notifications'].map(text => (
              <div key={text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="text-xl">✨</span>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-card">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-heading font-bold text-foreground mb-6 lg:hidden">⚡ Pulse 23</h2>
          <div className="flex bg-secondary rounded-full p-1 mb-6">
            <button onClick={() => setTab('signin')} className={`flex-1 py-2 text-sm font-medium rounded-full transition ${tab === 'signin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Sign In</button>
            <button onClick={() => setTab('signup')} className={`flex-1 py-2 text-sm font-medium rounded-full transition ${tab === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Create Account</button>
          </div>

          {error && <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mb-4">{error}</div>}

          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {tab === 'signup' && (
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display name" className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary" />
            )}
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" required className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary" />
            <div className="relative">
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Password" required minLength={tab === 'signup' ? 8 : undefined} className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary pr-10" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3.5 text-muted-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {tab === 'signup' && password && (
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${strengthColor} transition-all`} style={{ width: `${strength}%` }} />
              </div>
            )}
            {tab === 'signup' && (
              <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm password" required className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary" />
            )}
            {tab === 'signin' && (
              <button type="button" className="text-sm text-primary hover:underline">Forgot password?</button>
            )}
            <button type="submit" disabled={loading} className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (tab === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-sm text-muted-foreground">or</span></div>
          </div>

          <button onClick={handleGoogle} className="w-full py-3 border rounded-lg text-foreground font-medium hover:bg-secondary transition flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
