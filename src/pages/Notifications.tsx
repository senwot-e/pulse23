import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, UserPlus, CheckCheck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Pulse 23 · Notifications'; }, []);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*, profiles:actor_id(username, display_name, avatar_url)')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data || []);
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

  const icon = (type: string) => {
    if (type === 'like') return <Heart className="w-4 h-4 text-destructive fill-destructive" />;
    if (type === 'comment') return <MessageCircle className="w-4 h-4 text-primary" />;
    return <UserPlus className="w-4 h-4 text-accent" />;
  };

  const text = (type: string) => {
    if (type === 'like') return 'liked your post';
    if (type === 'comment') return 'commented on your post';
    return 'started following you';
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-heading font-bold text-foreground">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">You're all caught up ✓</p>
        </div>
      ) : (
        notifications.map(n => (
          <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg mb-1 transition ${!n.read ? 'bg-primary/5' : 'hover:bg-secondary'}`}>
            <Link to={`/profile/${n.profiles?.username || ''}`}>
              <img src={getAvatar(n.profiles?.username || '', n.profiles?.avatar_url)} alt="" className="w-10 h-10 rounded-full" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                <Link to={`/profile/${n.profiles?.username || ''}`} className="font-medium hover:underline">{n.profiles?.display_name || n.profiles?.username}</Link>
                {' '}{text(n.type)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
            <div className="mt-1">{icon(n.type)}</div>
          </div>
        ))
      )}
    </div>
  );
}
