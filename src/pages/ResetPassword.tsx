import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import PulseLogo from '@/components/PulseLogo';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Pulse 23 · Reset Password'; }, []);

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

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setSuccess(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/feed', { replace: true }), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <PulseLogo size={28} />
          <h2 className="text-2xl font-bold" style={{ background: 'linear-gradient(to right, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pulse 23</h2>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Password Reset!</h3>
              <p className="text-sm text-zinc-400 mt-1">Redirecting you to the feed...</p>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Set New Password</h3>
              <p className="text-sm text-zinc-400 mb-5">Enter your new password below.</p>

              {error && <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-xl p-3 mb-4 border border-red-200 dark:border-red-900">{error}</div>}

              <form onSubmit={handleReset} className="space-y-4">
                <div className="relative">
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3.5 text-zinc-400" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? strengthColors[strength - 1] : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                    ))}
                  </div>
                )}
                <input
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Confirm new password"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center"
                  aria-label="Reset password"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
