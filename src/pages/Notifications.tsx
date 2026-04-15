import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, UserPlus, CheckCheck, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Changelog from '@/components/Changelog';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => { document.title = 'Pulse 23 · Notifications'; }, []);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*, profiles:actor_id(username, display_name, avatar_url)')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setNotifications(data || []);
      } catch { toast.error('Failed to load notifications'); }
      setLoading(false);
    };
    fetch();

    const channel = supabase.channel('user-notifs').on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}`,
    }, (payload) => {
      setNotifications(prev => [payload.new as any, ...prev]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id).eq('read', false);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const iconBg = (type: string) => {
    if (type === 'like') return 'bg-rose-500';
    if (type === 'comment') return 'bg-blue-500';
    return 'bg-purple-500';
  };

  const icon = (type: string) => {
    if (type === 'like') return <Heart className="w-3.5 h-3.5 text-white fill-white" />;
    if (type === 'comment') return <MessageCircle className="w-3.5 h-3.5 text-white" />;
    return <UserPlus className="w-3.5 h-3.5 text-white" />;
  };

  const text = (type: string) => {
    if (type === 'like') return 'liked your post';
    if (type === 'comment') return 'commented on your post';
    return 'started following you';
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
            <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Notifications</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChangelog(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 transition" aria-label="View changelog">
            <BookOpen className="w-3.5 h-3.5" /> What's New
          </button>
          {notifications.some(n => !n.read) && (
            <button onClick={markAllRead} className="flex items-center gap-1 text-sm text-blue-600 hover:underline" aria-label="Mark all read">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {showChangelog && <Changelog onClose={() => setShowChangelog(false)} />}

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" className="text-zinc-200 dark:text-zinc-700" />
            <path d="M16 24l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500" />
          </svg>
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">You're all caught up ✓</p>
          <p className="text-sm text-zinc-400 mt-1">No new notifications</p>
        </div>
      ) : (
        notifications.map(n => (
          <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl mb-1 transition ${!n.read ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
            <div className={`w-8 h-8 rounded-full ${iconBg(n.type)} flex items-center justify-center shrink-0`}>
              {icon(n.type)}
            </div>
            <Link to={`/profile/${n.profiles?.username || ''}`} className="flex items-center gap-3 flex-1 min-w-0">
              <img src={getAvatar(n.profiles?.username || '', n.profiles?.avatar_url)} alt={n.profiles?.username || ''} className="w-10 h-10 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-900 dark:text-white">
                  <span className="font-medium">{n.profiles?.display_name || n.profiles?.username}</span>
                  {' '}{text(n.type)}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
            </Link>
          </div>
        ))
      )}
    </div>
  );
}
