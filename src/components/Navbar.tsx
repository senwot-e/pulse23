import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Bell, Mail, Sparkles, User, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function getAvatar(username?: string, avatarUrl?: string | null) {
  return avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'anon'}`;
}

const desktopTabs = [
  { path: '/feed', label: 'Feed', icon: Home },
  { path: '/explore', label: 'Explore', icon: Search },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/dm', label: 'Messages', icon: Mail },
  { path: '/ai', label: 'AI', icon: Sparkles },
];

const mobileTabs = [
  { path: '/feed', label: 'Feed', icon: Home },
  { path: '/explore', label: 'Explore', icon: Search },
  { path: '/dm', label: 'Messages', icon: Mail },
  { path: '/ai', label: 'AI', icon: Sparkles },
];

export default function Navbar() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase.channel('nav-notifs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => {
      setUnreadCount(c => c + 1);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      {/* Desktop navbar */}
      <nav className="hidden md:flex sticky top-0 z-50 w-full gradient-navbar items-center h-14 px-4">
        <Link to="/feed" className="font-heading font-bold text-lg text-primary-foreground mr-8 flex items-center gap-1">
          ⚡ Pulse 23
        </Link>
        <div className="flex items-center gap-1">
          {desktopTabs.map(tab => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition relative ${
                isActive(tab.path) ? 'bg-card text-primary' : 'text-primary-foreground/90 hover:text-primary-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.path === '/notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <button onClick={() => navigate('/feed')} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition">
                <Plus className="w-4 h-4" /> New Post
              </button>
              <Link to={`/profile/${profile?.username || ''}`}>
                <img src={getAvatar(profile?.username, profile?.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover" />
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth" className="text-sm text-primary-foreground/80 hover:text-primary-foreground">Sign in</Link>
              <Link to="/auth" className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium">Sign up</Link>
            </>
          )}
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-50 gradient-navbar h-12 flex items-center px-4 justify-between">
        <Link to="/feed" className="font-heading font-bold text-primary-foreground flex items-center gap-1">⚡ Pulse 23</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link to={`/profile/${profile?.username || ''}`}>
              <img src={getAvatar(profile?.username, profile?.avatar_url)} alt="" className="w-7 h-7 rounded-full object-cover" />
            </Link>
          ) : (
            <Link to="/auth" className="text-sm text-primary-foreground">Sign in</Link>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex items-center justify-around h-14 safe-area-pb">
        {mobileTabs.map(tab => (
          <Link key={tab.path} to={tab.path} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${isActive(tab.path) ? 'text-primary' : 'text-muted-foreground'}`}>
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px]">{tab.label}</span>
          </Link>
        ))}
        {user ? (
          <Link to={`/profile/${profile?.username || ''}`} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${location.pathname.startsWith('/profile') ? 'text-primary' : 'text-muted-foreground'}`}>
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </Link>
        ) : (
          <Link to="/auth" className="flex flex-col items-center gap-0.5 py-1 px-3 text-muted-foreground">
            <User className="w-5 h-5" />
            <span className="text-[10px]">Sign in</span>
          </Link>
        )}
      </div>
    </>
  );
}
