import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Bell, MessageSquare, Fish, Settings, User, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

function getAvatar(username?: string, avatarUrl?: string | null) {
  return avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'anon'}`;
}

const navItems = [
  { path: '/feed', label: 'Feed', icon: Home },
  { path: '/explore', label: 'Explore', icon: Search },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/dm', label: 'Messages', icon: MessageSquare },
  { path: '/ai', label: 'Nemo', icon: Fish },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function AppSidebar() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel('sidebar-notifs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${user.id}`,
      }, () => setUnreadCount(c => c + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col items-center w-16 min-h-screen bg-sidebar-background border-r border-sidebar-border py-4 gap-1 fixed left-0 top-0 z-50">
        <Link to="/feed" className="mb-4 flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
          <Zap className="w-5 h-5" />
        </Link>

        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
                isActive(item.path)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.path === '/notifications' && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto">
          {user ? (
            <Link to={`/profile/${profile?.username || ''}`} title="Profile">
              <img
                src={getAvatar(profile?.username, profile?.avatar_url)}
                alt=""
                className={cn(
                  "w-9 h-9 rounded-full object-cover ring-2 transition-all",
                  isActive(`/profile/${profile?.username}`) ? "ring-primary" : "ring-transparent hover:ring-sidebar-border"
                )}
              />
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <User className="w-5 h-5" />
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex items-center justify-around h-14">
        {navItems.slice(0, 5).map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1 px-2 relative",
              isActive(item.path) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
            {item.path === '/notifications' && unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        ))}
        {user ? (
          <Link
            to={`/profile/${profile?.username || ''}`}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1 px-2",
              location.pathname.startsWith('/profile') ? "text-primary" : "text-muted-foreground"
            )}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </Link>
        ) : (
          <Link to="/auth" className="flex flex-col items-center gap-0.5 py-1 px-2 text-muted-foreground">
            <User className="w-5 h-5" />
            <span className="text-[10px]">Sign in</span>
          </Link>
        )}
      </div>
    </>
  );
}
