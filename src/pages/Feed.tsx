import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SocialPostCard, { PostData } from '@/components/SocialPostCard';
import PostComposer from '@/components/PostComposer';
import { PostSkeleton } from '@/components/Skeletons';
import CommentSection from '@/components/CommentSection';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [newPostsBanner, setNewPostsBanner] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Pulse 23 · Feed'; }, []);

  const fetchPosts = useCallback(async (pageNum: number) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(username, display_name, avatar_url)')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const mapped = (data || []).map((p: any) => ({ ...p, profiles: p.profiles }));
      if (pageNum === 0) setPosts(mapped);
      else setPosts(prev => [...prev, ...mapped]);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch { toast.error('Failed to load posts'); }
    setLoading(false);
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    const [likesRes, bookmarksRes] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id),
      supabase.from('bookmarks').select('post_id').eq('user_id', user.id),
    ]);
    setLikes(new Set((likesRes.data || []).map(l => l.post_id)));
    setBookmarks(new Set((bookmarksRes.data || []).map(b => b.post_id)));
  }, [user]);

  useEffect(() => { fetchPosts(0); fetchUserData(); }, [fetchPosts, fetchUserData]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPosts(nextPage);
      }
    }, { rootMargin: '200px' });
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, fetchPosts]);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('feed-posts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
      setNewPostsBanner(true);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRevealNew = () => {
    setNewPostsBanner(false);
    setPage(0);
    setLoading(true);
    fetchPosts(0);
    fetchUserData();
  };

  const handleDelete = (id: string) => setPosts(prev => prev.filter(p => p.id !== id));

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <PostComposer onPost={() => { setPage(0); fetchPosts(0); fetchUserData(); }} />
      {newPostsBanner && (
        <button onClick={handleRevealNew} className="w-full py-2 mb-3 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition">
          New posts — tap to see
        </button>
      )}
      {loading && posts.length === 0 ? (
        Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-heading">No posts yet</p>
          <p className="text-sm mt-1">Be the first to pulse something!</p>
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id}>
            <SocialPostCard
              post={post}
              isLiked={likes.has(post.id)}
              isBookmarked={bookmarks.has(post.id)}
              onDelete={handleDelete}
              onCommentClick={(id) => setExpandedComments(expandedComments === id ? null : id)}
            />
            {expandedComments === post.id && <CommentSection postId={post.id} postUserId={post.user_id} />}
          </div>
        ))
      )}
      <div ref={observerRef} className="h-4" />
    </div>
  );
}
