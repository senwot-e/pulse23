import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Send } from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null; is_verified?: boolean };
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
      try {
        const { data } = await supabase.from('comments').select('*, profiles(username, display_name, avatar_url, is_verified)').eq('post_id', postId).order('created_at', { ascending: true });
        setComments((data as any) || []);
      } catch {}
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
      } catch {}
      setLoadingSuggestions(false);
    };
    fetchSuggestions();
  }, [postId, user]);

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('comments').insert({ user_id: user.id, post_id: postId, content: content.trim() }).select('*, profiles(username, display_name, avatar_url, is_verified)').single();
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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 mb-3 ml-6">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : (
        <>
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 mb-3">
              <img src={getAvatar(c.profiles.username, c.profiles.avatar_url)} alt={c.profiles.username} className="w-7 h-7 rounded-full" />
              <div>
                <p className="text-sm">
                  <span className="font-medium text-zinc-900 dark:text-white">{c.profiles.display_name || c.profiles.username}</span>
                  {c.profiles.is_verified && <VerifiedBadge className="ml-1" />}
                  {' '}<span className="text-zinc-400 text-xs">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-zinc-400 py-2">No comments yet</p>}

          {user && (
            <>
              {loadingSuggestions ? (
                <div className="flex gap-2 mb-2">
                  {[1,2,3].map(i => <div key={i} className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-full animate-pulse" />)}
                </div>
              ) : suggestions.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => setContent(s)} className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-950/50 transition">{s}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()} placeholder="Write a comment..." maxLength={500} className="flex-1 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" />
                <button onClick={handleSubmit} disabled={submitting || !content.trim()} className="p-2 bg-blue-600 text-white rounded-xl disabled:opacity-50" aria-label="Send comment">
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
