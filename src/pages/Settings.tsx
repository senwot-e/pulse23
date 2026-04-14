import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, Camera, Heart, MessageCircle, UserPlus, Mail, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Account
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({ likes: true, comments: true, followers: true, dms: true });

  // Appearance
  const [themeMode, setThemeMode] = useState<'light' | 'system' | 'dark'>(() => {
    const stored = localStorage.getItem('pulse23-theme');
    if (stored === 'dark') return 'dark';
    if (stored === 'light') return 'light';
    return 'system';
  });
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('pulse23-fontsize') as any) || 'medium';
  });

  // Privacy
  const [isPrivate, setIsPrivate] = useState(false);
  const [showOnline, setShowOnline] = useState(true);
  const [allowAI, setAllowAI] = useState(true);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { document.title = 'Pulse 23 · Settings'; }, []);

  useEffect(() => {
    if (!user) { navigate('/auth?next=/settings'); return; }
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio((profile as any).bio || '');
      setWebsiteUrl((profile as any).website_url || '');
      setUsername(profile.username);
      setAvatarUrl(profile.avatar_url);
      const np = (profile as any).notification_preferences;
      if (np) setNotifPrefs(np);
      setIsPrivate((profile as any).is_private || false);
      setShowOnline((profile as any).show_online_status ?? true);
      setAllowAI((profile as any).allow_ai_suggestions ?? true);
    }
  }, [user, profile, navigate]);

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

  const checkUsername = async () => {
    if (!username || username === profile?.username) { setUsernameError(''); return; }
    const { data } = await supabase.from('profiles').select('id').eq('username', username).neq('id', user?.id || '');
    if (data && data.length > 0) setUsernameError('Username taken');
    else setUsernameError('');
  };

  const handleSave = async () => {
    if (!user || usernameError) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
        username,
        website_url: websiteUrl,
      } as any).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const handleChangeEmail = async () => {
    if (!newEmail) return;
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success('Confirmation sent to new email');
      setShowChangeEmail(false);
    } catch { toast.error('Failed'); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error('Min 8 characters'); return; }
    if (newPassword !== confirmNewPass) { toast.error('Passwords don\'t match'); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated');
      setShowChangePass(false);
      setNewPassword('');
      setConfirmNewPass('');
    } catch { toast.error('Failed'); }
  };

  const updateNotifPref = async (key: string, val: boolean) => {
    const updated = { ...notifPrefs, [key]: val };
    setNotifPrefs(updated);
    try {
      await supabase.from('profiles').update({ notification_preferences: updated } as any).eq('id', user!.id);
    } catch { toast.error('Failed'); }
  };

  const applyTheme = (mode: 'light' | 'system' | 'dark') => {
    setThemeMode(mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pulse23-theme', 'dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pulse23-theme', 'light');
    } else {
      localStorage.removeItem('pulse23-theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    localStorage.setItem('pulse23-fontsize', size);
    const html = document.documentElement;
    html.classList.remove('text-sm', 'text-base', 'text-lg');
    html.classList.add(size === 'small' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-base');
  };

  const updatePrivacy = async (field: string, val: boolean) => {
    try {
      await supabase.from('profiles').update({ [field]: val } as any).eq('id', user!.id);
    } catch { toast.error('Failed'); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error('Failed');
      await signOut();
      navigate('/auth');
      toast.success('Account deleted');
    } catch { toast.error('Failed to delete account'); }
    setDeleting(false);
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-colors ${checked ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
      aria-label="Toggle"
    >
      <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
    </button>
  );

  if (!profile) return null;

  const maskedEmail = user?.email ? user.email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2') : '';

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>

      {/* Profile */}
      <section>
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-2">Profile</p>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={getAvatar(profile.username, avatarUrl)} alt="Avatar" className="w-[72px] h-[72px] rounded-full object-cover" />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center" aria-label="Change photo">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <button onClick={() => fileRef.current?.click()} className="text-sm text-blue-600 hover:underline">Change photo</button>
          </div>
          <div>
            <label className="text-sm text-zinc-500 mb-1 block">Display Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-sm text-zinc-500 mb-1 block">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-zinc-400">@</span>
              <input value={username} onChange={e => { setUsername(e.target.value); setUsernameError(''); }} onBlur={checkUsername} className={`w-full pl-7 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border ${usernameError ? 'border-red-400' : 'border-zinc-200 dark:border-zinc-700'} text-zinc-900 dark:text-white outline-none focus:border-blue-400`} />
            </div>
            {usernameError && <p className="text-red-500 text-xs mt-1">{usernameError}</p>}
          </div>
          <div>
            <label className="text-sm text-zinc-500 mb-1 block">Bio</label>
            <textarea value={bio} onChange={e => { if (e.target.value.length <= 160) setBio(e.target.value); }} rows={3} className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none resize-none focus:border-blue-400" />
            <p className="text-xs text-zinc-400 text-right">{bio.length}/160</p>
          </div>
          <div>
            <label className="text-sm text-zinc-500 mb-1 block">Website URL</label>
            <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://" className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:border-blue-400" />
          </div>
          <button onClick={handleSave} disabled={saving || !!usernameError} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center" aria-label="Save profile">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
          </button>
        </div>
      </section>

      {/* Account */}
      <section>
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-2">Account</p>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div>
            <p className="text-sm text-zinc-500">Email: <span className="text-zinc-700 dark:text-zinc-300">{maskedEmail}</span></p>
            <button onClick={() => setShowChangeEmail(!showChangeEmail)} className="text-sm text-blue-600 hover:underline mt-1">Change email</button>
            {showChangeEmail && (
              <div className="mt-2 space-y-2">
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="New email" className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none" />
                <button onClick={handleChangeEmail} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium" aria-label="Update email">Update</button>
              </div>
            )}
          </div>
          <div>
            <button onClick={() => setShowChangePass(!showChangePass)} className="text-sm text-blue-600 hover:underline">Change password</button>
            {showChangePass && (
              <div className="mt-2 space-y-2">
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="New password" className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none" />
                <input value={confirmNewPass} onChange={e => setConfirmNewPass(e.target.value)} type="password" placeholder="Confirm password" className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none" />
                <button onClick={handleChangePassword} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium" aria-label="Update password">Update</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-2">Notifications</p>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          {[
            { key: 'likes', label: 'Likes on my posts', icon: Heart },
            { key: 'comments', label: 'Comments on my posts', icon: MessageCircle },
            { key: 'followers', label: 'New followers', icon: UserPlus },
            { key: 'dms', label: 'DM messages', icon: Mail },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-zinc-400" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
              </div>
              <Toggle checked={(notifPrefs as any)[key]} onChange={v => updateNotifPref(key, v)} />
            </div>
          ))}
        </div>
      </section>

      {/* Appearance */}
      <section>
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-2">Appearance</p>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div>
            <p className="text-sm text-zinc-500 mb-2">Theme</p>
            <div className="flex gap-2">
              {(['light', 'system', 'dark'] as const).map(m => (
                <button key={m} onClick={() => applyTheme(m)} className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition ${themeMode === m ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>{m}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-2">Font size</p>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map(s => (
                <button key={s} onClick={() => applyFontSize(s)} className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition ${fontSize === s ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section>
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-2">Privacy</p>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          {[
            { label: 'Private account', val: isPrivate, setter: setIsPrivate, field: 'is_private' },
            { label: 'Show online status', val: showOnline, setter: setShowOnline, field: 'show_online_status' },
            { label: 'Allow AI to use my posts for suggestions', val: allowAI, setter: setAllowAI, field: 'allow_ai_suggestions' },
          ].map(({ label, val, setter, field }) => (
            <div key={field} className="flex items-center justify-between">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
              <Toggle checked={val} onChange={v => { setter(v); updatePrivacy(field, v); }} />
            </div>
          ))}
        </div>
      </section>

      {/* Beta Codes */}
      <section>
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-2">Beta Codes</p>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <p className="text-sm text-zinc-500">Enter a beta code to unlock early features.</p>
          <div className="flex gap-2">
            <input
              id="beta-code-input"
              placeholder="Enter beta code"
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:border-blue-400"
            />
            <button
              onClick={() => {
                const val = (document.getElementById('beta-code-input') as HTMLInputElement)?.value?.trim();
                if (!val) return;
                toast.success('Beta code submitted!');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              aria-label="Redeem beta code"
            >
              Redeem
            </button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-2">Danger Zone</p>
        <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900 p-5">
          <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition flex items-center gap-2" aria-label="Delete account">
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        </div>
      </section>

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Delete Account</h3>
            <p className="text-sm text-zinc-500 mb-4">This action is permanent. Type <strong>DELETE MY ACCOUNT</strong> to confirm.</p>
            <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type here..." className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm text-zinc-500">Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE MY ACCOUNT' || deleting} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1" aria-label="Confirm delete">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
