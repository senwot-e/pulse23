import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shield, Users, AlertTriangle, MessageSquare, Lock, Unlock, Search } from 'lucide-react';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

function NiceTryScreen() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
          <Shield className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Nice try, buddy. 😏</h1>
        <p className="text-zinc-500 mb-2">You thought you could just waltz in here?</p>
        <p className="text-zinc-400 text-sm">This area requires a special beta code. Head to Settings if you think you've got one.</p>
        <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-6">Error code: 403_NICE_TRY</p>
      </div>
    </div>
  );
}

export default function Moderation() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'profiles' | 'appeals' | 'reports' | 'lockdown'>('profiles');

  // Profiles tab
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [banReason, setBanReason] = useState('');
  const [banningUser, setBanningUser] = useState<string | null>(null);
  const [loadingBans, setLoadingBans] = useState(true);

  // Appeals
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loadingAppeals, setLoadingAppeals] = useState(true);

  // Reports
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Lockdown
  const [lockdown, setLockdown] = useState(false);
  const [lockdownLoading, setLockdownLoading] = useState(true);

  useEffect(() => { document.title = 'Pulse 23 · Moderation'; }, []);

  useEffect(() => {
    if (!user) { navigate('/auth?next=/moderation'); return; }
    const checkAccess = async () => {
      const { data } = await supabase.from('beta_codes_redeemed').select('id').eq('user_id', user.id).eq('code', 'pulse23moderation');
      // Also check if admin
      const isAdmin = profile?.username === 'senwot';
      setHasAccess((data && data.length > 0) || isAdmin);
    };
    checkAccess();
  }, [user, profile, navigate]);

  const fetchBannedUsers = useCallback(async () => {
    setLoadingBans(true);
    const { data } = await supabase.from('bans').select('*').is('unbanned_at', null);
    if (data && data.length > 0) {
      const userIds = data.map(b => b.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setBannedUsers(data.map(b => ({ ...b, profile: profileMap.get(b.user_id) })));
    } else {
      setBannedUsers([]);
    }
    setLoadingBans(false);
  }, []);

  const fetchAppeals = useCallback(async () => {
    setLoadingAppeals(true);
    const { data } = await supabase.from('ban_appeals').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const userIds = data.map(a => a.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setAppeals(data.map(a => ({ ...a, profile: profileMap.get(a.user_id) })));
    } else {
      setAppeals([]);
    }
    setLoadingAppeals(false);
  }, []);

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    const { data } = await supabase.from('user_reports').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const allIds = [...new Set([...data.map(r => r.reporter_id), ...data.map(r => r.reported_user_id)])];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', allIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setReports(data.map(r => ({ ...r, reporter: profileMap.get(r.reporter_id), reported: profileMap.get(r.reported_user_id) })));
    } else {
      setReports([]);
    }
    setLoadingReports(false);
  }, []);

  const fetchLockdown = useCallback(async () => {
    setLockdownLoading(true);
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'lockdown').single();
    setLockdown(data?.value?.enabled || false);
    setLockdownLoading(false);
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchBannedUsers();
      fetchAppeals();
      fetchReports();
      fetchLockdown();
    }
  }, [hasAccess, fetchBannedUsers, fetchAppeals, fetchReports, fetchLockdown]);

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`).limit(10);
    setSearchResults(data || []);
  };

  const banUser = async (userId: string) => {
    if (!banReason.trim()) { toast.error('Enter a ban reason'); return; }
    if (!user) return;
    try {
      await supabase.from('bans').insert({ user_id: userId, reason: banReason, banned_by: user.id });
      toast.success('User banned');
      setBanReason('');
      setBanningUser(null);
      setSearchResults([]);
      setSearchQuery('');
      fetchBannedUsers();
    } catch (e: any) {
      if (e?.code === '23505') toast.error('User already banned');
      else toast.error('Failed to ban');
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      await supabase.from('bans').update({ unbanned_at: new Date().toISOString() }).eq('user_id', userId).is('unbanned_at', null);
      toast.success('User unbanned');
      fetchBannedUsers();
    } catch { toast.error('Failed'); }
  };

  const handleAppeal = async (appealId: string, userId: string, approve: boolean) => {
    if (!user) return;
    try {
      await supabase.from('ban_appeals').update({
        status: approve ? 'approved' : 'denied',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', appealId);
      if (approve) {
        await supabase.from('bans').update({ unbanned_at: new Date().toISOString() }).eq('user_id', userId).is('unbanned_at', null);
      }
      toast.success(approve ? 'Appeal approved — user unbanned' : 'Appeal denied');
      fetchAppeals();
      if (approve) fetchBannedUsers();
    } catch { toast.error('Failed'); }
  };

  const dismissReport = async (reportId: string) => {
    if (!user) return;
    try {
      await supabase.from('user_reports').update({ status: 'dismissed', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', reportId);
      toast.success('Report dismissed');
      fetchReports();
    } catch { toast.error('Failed'); }
  };

  const toggleLockdown = async () => {
    if (!user) return;
    const next = !lockdown;
    setLockdown(next);
    try {
      await supabase.from('app_settings').update({ value: { enabled: next }, updated_by: user.id, updated_at: new Date().toISOString() }).eq('key', 'lockdown');
      toast.success(next ? 'Lockdown enabled' : 'Lockdown disabled');
    } catch { toast.error('Failed'); setLockdown(!next); }
  };

  if (hasAccess === null) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;
  if (!hasAccess) return <NiceTryScreen />;

  const tabs = [
    { id: 'profiles' as const, label: 'Profiles', icon: Users },
    { id: 'appeals' as const, label: 'Appeals', icon: MessageSquare, count: appeals.length },
    { id: 'reports' as const, label: 'Reports', icon: AlertTriangle, count: reports.length },
    { id: 'lockdown' as const, label: 'Lockdown', icon: Lock },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Moderation Panel</h1>
          <p className="text-xs text-zinc-400">Manage users, appeals, and reports</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ${tab === t.id ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* PROFILES TAB */}
      {tab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUsers()} placeholder="Search users..." className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none text-sm" />
            </div>
            <button onClick={searchUsers} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium">Search</button>
          </div>

          {searchResults.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {searchResults.map(p => (
                <div key={p.id} className="p-3 flex items-center gap-3">
                  <img src={getAvatar(p.username, p.avatar_url)} alt={p.username} className="w-10 h-10 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{p.display_name || p.username}</p>
                    <p className="text-xs text-zinc-400">@{p.username}</p>
                  </div>
                  {banningUser === p.id ? (
                    <div className="flex items-center gap-2">
                      <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Reason for ban..." className="px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white outline-none w-48" />
                      <button onClick={() => banUser(p.id)} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium">Confirm</button>
                      <button onClick={() => { setBanningUser(null); setBanReason(''); }} className="text-xs text-zinc-400">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setBanningUser(p.id)} className="px-3 py-1 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-full text-xs font-medium hover:bg-red-200 dark:hover:bg-red-950/50 transition">Ban</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mt-6">Currently Banned</h3>
          {loadingBans ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-xl animate-pulse" />)}</div>
          ) : bannedUsers.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">No banned users</p>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {bannedUsers.map(b => (
                <div key={b.id} className="p-3 flex items-center gap-3">
                  <img src={getAvatar(b.profile?.username || '', b.profile?.avatar_url)} alt="" className="w-10 h-10 rounded-full opacity-50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{b.profile?.display_name || b.profile?.username || 'Unknown'}</p>
                    <p className="text-xs text-red-500">Reason: {b.reason}</p>
                  </div>
                  <button onClick={() => unbanUser(b.user_id)} className="px-3 py-1 bg-green-100 dark:bg-green-950/30 text-green-600 rounded-full text-xs font-medium hover:bg-green-200 transition flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> Unban
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* APPEALS TAB */}
      {tab === 'appeals' && (
        <div className="space-y-3">
          {loadingAppeals ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-700 rounded-xl animate-pulse" />)}</div>
          ) : appeals.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">No pending appeals</p>
            </div>
          ) : (
            appeals.map(a => (
              <div key={a.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <img src={getAvatar(a.profile?.username || '', a.profile?.avatar_url)} alt="" className="w-9 h-9 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{a.profile?.display_name || a.profile?.username}</p>
                    <p className="text-xs text-zinc-400">@{a.profile?.username}</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 mb-3">"{a.message}"</p>
                <div className="flex gap-2">
                  <button onClick={() => handleAppeal(a.id, a.user_id, true)} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium">Approve & Unban</button>
                  <button onClick={() => handleAppeal(a.id, a.user_id, false)} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium">Deny</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* REPORTS TAB */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {loadingReports ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-700 rounded-xl animate-pulse" />)}</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">No pending reports</p>
            </div>
          ) : (
            reports.map(r => (
              <div key={r.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src={getAvatar(r.reporter?.username || '', r.reporter?.avatar_url)} alt="" className="w-7 h-7 rounded-full" />
                    <span className="text-xs text-zinc-400">@{r.reporter?.username} reported</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={getAvatar(r.reported?.username || '', r.reported?.avatar_url)} alt="" className="w-7 h-7 rounded-full" />
                    <span className="text-xs text-zinc-900 dark:text-white font-medium">@{r.reported?.username}</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 mb-3">"{r.reason}"</p>
                <div className="flex gap-2">
                  <button onClick={() => { setBanningUser(r.reported_user_id); setBanReason(r.reason); setTab('profiles'); setSearchQuery(r.reported?.username || ''); searchUsers(); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium">Ban User</button>
                  <button onClick={() => dismissReport(r.id)} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs font-medium">Dismiss</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* LOCKDOWN TAB */}
      {tab === 'lockdown' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${lockdown ? 'bg-red-100 dark:bg-red-950/30' : 'bg-green-100 dark:bg-green-950/30'}`}>
              {lockdown ? <Lock className="w-7 h-7 text-red-600" /> : <Unlock className="w-7 h-7 text-green-600" />}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Lockdown Pulse 23</h3>
              <p className="text-sm text-zinc-500">
                {lockdown ? 'Users can sign in but cannot post or send messages.' : 'Platform is operating normally.'}
              </p>
            </div>
            {lockdownLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            ) : (
              <button
                onClick={toggleLockdown}
                className={`relative w-14 h-8 rounded-full transition-colors ${lockdown ? 'bg-red-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                aria-label="Toggle lockdown"
              >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${lockdown ? 'translate-x-[26px]' : 'translate-x-1'}`} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
