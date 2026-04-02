import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null };
}

export default function CommentSection({ postId, postUserId }: { postId: string; postUserId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('comments').select('*, profiles(username, display_name, avatar_url)').eq('post_id', postId).order('created_at', { ascending: true });
      setComments((data as any) || []);
      setLoading(false);
    };
    fetch();
  }, [postId]);

  useEffect(() => {
    if (!user) return;
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const post = await supabase.from('posts').select('content').eq('id', postId).single();
        if (post.data) {
          const { data } = await supabase.functions.invoke('ai-suggest', { body: { postContent: post.data.content } });
          if (data?.suggestions) setSuggestions(data.suggestions);
        }
      } catch { /* ignore */ }
      setLoadingSuggestions(false);
    };
    fetchSuggestions();
  }, [postId, user]);

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('comments').insert({ user_id: user.id, post_id: postId, content: content.trim() }).select('*, profiles(username, display_name, avatar_url)').single();
      if (error) throw error;
      setComments(prev => [...prev, data as any]);
      setContent('');
      await supabase.from('posts').update({ comments_count: comments.length + 1 }).eq('id', postId);
      if (postUserId !== user.id) {
        await supabase.from('notifications').insert({ recipient_id: postUserId, actor_id: user.id, type: 'comment', post_id: postId });
      }
    } catch { toast.error('Failed to comment'); }
    setSubmitting(false);
  };

  return (
    <div className="bg-card border rounded-lg p-3 mb-3 ml-6">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 mb-3">
              <img src={c.profiles.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profiles.username}`} alt="" className="w-7 h-7 rounded-full" />
              <div>
                <p className="text-sm"><span className="font-medium text-foreground">{c.profiles.display_name || c.profiles.username}</span> <span className="text-muted-foreground text-xs">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span></p>
                <p className="text-sm text-foreground">{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-muted-foreground py-2">No comments yet</p>}

          {user && (
            <>
              {loadingSuggestions ? (
                <div className="flex gap-2 mb-2">
                  {[1,2,3].map(i => <div key={i} className="h-7 w-24 bg-muted rounded-full animate-pulse" />)}
                </div>
              ) : suggestions.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => setContent(s)} className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition">{s}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()} placeholder="Write a comment..." maxLength={500} className="flex-1 text-sm bg-secondary rounded-full px-3 py-2 outline-none text-foreground placeholder:text-muted-foreground" />
                <button onClick={handleSubmit} disabled={submitting || !content.trim()} className="p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
