import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, Moon, Sun, Camera, Mail, Zap, Shield } from 'lucide-react';
import toast from 'react-hot-toast';


function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
}

export default function Settings() {
  const { user, profile, signOut, isAdmin, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [sendingConfirm, setSendingConfirm] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => { document.title = 'Pulse 23 · Settings'; }, []);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      setEmailConfirmed(!!user.email_confirmed_at);
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
      }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
    navigate('/auth');
  };

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('pulse23-theme', next ? 'dark' : 'light');
  };

  const handleResendConfirmation = async () => {
    if (!user?.email) return;
    setSendingConfirm(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
      toast.success('Confirmation email sent!');
    } catch { toast.error('Failed to send'); }
    setSendingConfirm(false);
  };

  if (!profile) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>

      {/* Profile Editing */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-foreground">Profile</h2>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <img src={getAvatar(profile.username, avatarUrl)} alt="" className="w-16 h-16 rounded-full object-cover" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div>
            <p className="font-medium text-foreground">@{profile.username}</p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>{profile.pulse_count || 0} Pulse</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Display Name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none resize-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </button>
      </div>

      {/* Email Confirmation */}
      {!emailConfirmed && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">Email not confirmed</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Confirm your email to unlock all features. You can still post and browse!
              </p>
              <button
                onClick={handleResendConfirmation}
                disabled={sendingConfirm}
                className="mt-2 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50 flex items-center gap-1"
              >
                {sendingConfirm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Confirmation Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dark Mode */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">{isDark ? 'Dark theme active' : 'Light theme active'}</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative w-12 h-6 rounded-full transition ${isDark ? 'bg-primary' : 'bg-secondary'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Pulse Count Display */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Pulse Score</p>
            <p className="text-sm text-muted-foreground">Posts: +1 · Likes received: +10 · Followers: +15</p>
          </div>
          <span className="ml-auto text-2xl font-heading font-bold text-primary">{profile.pulse_count || 0}</span>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-card border rounded-lg p-4">
        <button
          onClick={handleSignOut}
          className="w-full py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:opacity-90 transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
