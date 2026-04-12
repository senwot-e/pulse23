import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SocialPostCard, { PostData } from '@/components/SocialPostCard';
import CommentSection from '@/components/CommentSection';
import { PostSkeleton } from '@/components/Skeletons';
import { Bookmark } from 'lucide-react';

export default function Bookmarks() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [likes, setLikes] = useState<Set<string>>(new Set());

  useEffect(() => { document.title = 'Pulse 23 · Bookmarks'; }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('bookmarks')
        .select('*, posts(*, profiles(username, display_name, avatar_url, is_verified))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const mapped = (data || []).map((b: any) => b.posts).filter(Boolean);
      setPosts(mapped);
      const { data: l } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
      setLikes(new Set((l || []).map(x => x.post_id)));
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const handleDelete = (id: string) => setPosts(prev => prev.filter(p => p.id !== id));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Bookmark className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Bookmarks</h1>
      </div>
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" className="text-zinc-200 dark:text-zinc-700" />
            <path d="M16 14h16v22l-8-5-8 5V14z" stroke="currentColor" strokeWidth="2" className="text-zinc-300 dark:text-zinc-600" />
          </svg>
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Nothing saved yet</p>
          <p className="text-sm text-zinc-400 mt-1">Bookmark posts to find them here</p>
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id}>
            <SocialPostCard post={post} isLiked={likes.has(post.id)} isBookmarked onDelete={handleDelete} onCommentClick={id => setExpandedComments(expandedComments === id ? null : id)} />
            {expandedComments === post.id && <CommentSection postId={post.id} postUserId={post.user_id} />}
          </div>
        ))
      )}
    </div>
  );
}
