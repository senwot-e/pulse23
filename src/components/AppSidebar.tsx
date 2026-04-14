import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Bell, MessageSquare, Sparkles, Bookmark, User, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PulseLogo from './PulseLogo';

function getAvatar(username?: string, avatarUrl?: string | null) {
  return avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username || 'anon'}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export default function AppSidebar() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (!user) return;
    const fetchCounts = async () => {
      const { count: nc } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('read', false);
      setUnreadNotifs(nc || 0);
      // Unread DMs
      const { data: convos } = await supabase.from('dm_conversations').select('id').or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);
      if (convos && convos.length > 0) {
        const ids = convos.map(c => c.id);
        const { count: dc } = await supabase.from('dm_messages').select('*', { count: 'exact', head: true }).in('conversation_id', ids).neq('sender_id', user.id).is('read_at', null);
        setUnreadDMs(dc || 0);
      }
    };
    fetchCounts();
    const channel = supabase.channel('sidebar-notifs-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => setUnreadNotifs(c => c + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('pulse23-theme', next ? 'dark' : 'light');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/feed', label: 'Feed', icon: Home },
    { path: '/explore', label: 'Explore', icon: Search },
    { path: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs, authOnly: false },
    { path: '/dm', label: 'Messages', icon: MessageSquare, badge: unreadDMs, authOnly: false },
    { path: '/ai', label: 'Nemo', icon: Sparkles, pill: 'NEW' },
    
    { path: '/bookmarks', label: 'Bookmarks', icon: Bookmark, authOnly: true },
    { path: `/profile/${profile?.username || ''}`, label: 'Profile', icon: User, authOnly: true },
    { path: '/settings', label: 'Settings', icon: Settings, authOnly: true },
  ];

  const filteredItems = navItems.filter(item => !item.authOnly || user);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] h-screen fixed left-0 top-0 z-40 bg-white dark:bg-[#111118] border-r border-[#E4E7EC] dark:border-[#1F1F2E] shadow-[2px_0_12px_rgba(0,0,0,0.04)] dark:shadow-none">
        {/* Logo section */}
        <div className="px-5 pt-6 pb-4">
          <Link to="/feed" className="flex items-center gap-2.5">
            <PulseLogo size={28} />
            <span className="font-bold text-xl" style={{ background: 'linear-gradient(to right, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Pulse 23
            </span>
          </Link>
          <p className="text-[11px] text-zinc-400 mt-1">Your world, in motion.</p>
          <div className="h-px bg-zinc-100 dark:bg-zinc-800 mt-4" />
        </div>

        {/* Nav items */}
        <nav className="px-3 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {filteredItems.map(item => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-[11px] rounded-[14px] transition-all duration-150 group relative ${
                    active
                      ? 'bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] dark:bg-[rgba(99,102,241,0.12)] dark:from-transparent dark:to-transparent border-l-[3px] border-blue-600 text-blue-600 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-800 dark:hover:text-zinc-100 border-l-[3px] border-transparent'
                  }`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-600' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} strokeWidth={1.5} />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                  {item.pill && (
                    <span className="ml-auto bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.pill}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-3" />

        {/* Auth card (logged out) */}
        {!user && (
          <div className="p-3">
            <div className="bg-gradient-to-br from-[#EFF6FF] to-[#F5F3FF] dark:from-[rgba(99,102,241,0.08)] dark:to-[rgba(99,102,241,0.08)] border border-[#BFDBFE] dark:border-[rgba(99,102,241,0.2)] rounded-2xl p-4 text-center">
              <PulseLogo size={24} />
              <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-2">Join Pulse 23</p>
              <p className="text-xs text-zinc-500 mt-1">Connect, share, and discover.</p>
              <Link to="/auth?tab=signup" className="block w-full mt-3 h-[38px] leading-[38px] text-sm font-semibold text-white rounded-xl" style={{ background: 'linear-gradient(to right, #2563EB, #7C3AED)' }}>
                Sign Up
              </Link>
              <Link to="/auth?tab=signin" className="block w-full mt-2 h-[38px] leading-[38px] text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                Sign In
              </Link>
            </div>
          </div>
        )}

        {/* Bottom section (logged in) */}
        {user && profile && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-4">
            {/* User identity */}
            <div className="flex items-center gap-2.5">
              <img
                src={getAvatar(profile.username, profile.avatar_url)}
                alt={profile.username}
                className="w-[38px] h-[38px] rounded-full object-cover ring-2 ring-blue-100 dark:ring-zinc-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate max-w-[120px]">{profile.display_name || profile.username}</p>
                <p className="text-[11px] text-zinc-400 truncate">@{profile.username}</p>
              </div>
              <button onClick={toggleDark} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors mr-1" aria-label="Toggle dark mode">
                {isDark ? <Sun className="w-4 h-4 text-white" /> : <Moon className="w-4 h-4 text-zinc-600 fill-current" />}
              </button>
              <button onClick={handleSignOut} className="text-zinc-400 hover:text-red-500 transition-colors" aria-label="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <img
                src={getAvatar(profile.username, profile.avatar_url)}
                alt={profile.username}
                className="w-[38px] h-[38px] rounded-full object-cover ring-2 ring-blue-100 dark:ring-zinc-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate max-w-[120px]">{profile.display_name || profile.username}</p>
                <p className="text-[11px] text-zinc-400 truncate">@{profile.username}</p>
              </div>
              <button onClick={handleSignOut} className="text-zinc-400 hover:text-red-500 transition-colors" aria-label="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#111118] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around h-14">
        {[
          { path: '/feed', label: 'Feed', icon: Home },
          { path: '/explore', label: 'Explore', icon: Search },
          { path: '/notifications', label: 'Alerts', icon: Bell, badge: unreadNotifs },
          { path: '/dm', label: 'DMs', icon: MessageSquare, badge: unreadDMs },
          { path: '/ai', label: 'Nemo', icon: Sparkles },
        ].map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 relative ${isActive(item.path) ? 'text-blue-600' : 'text-zinc-400'}`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </Link>
        ))}
        {user ? (
          <Link to={`/profile/${profile?.username || ''}`} className={`flex flex-col items-center gap-0.5 py-1 px-2 ${location.pathname.startsWith('/profile') ? 'text-blue-600' : 'text-zinc-400'}`}>
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </Link>
        ) : (
          <Link to="/auth" className="flex flex-col items-center gap-0.5 py-1 px-2 text-zinc-400">
            <User className="w-5 h-5" />
            <span className="text-[10px]">Sign in</span>
          </Link>
        )}
      </div>
    </>
  );
}
