import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SocialPostCard, { PostData } from '@/components/SocialPostCard';
import PostComposer from '@/components/PostComposer';
import { PostSkeleton } from '@/components/Skeletons';
import CommentSection from '@/components/CommentSection';
import { TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

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
  const [trollMessage, setTrollMessage] = useState<string | null>(null);
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);
  const [suggestedPeople, setSuggestedPeople] = useState<any[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Pulse 23 · Feed'; }, []);

  useEffect(() => {
    // Fetch banned user IDs
    supabase.from('bans').select('user_id').is('unbanned_at', null).then(({ data }) => {
      setBannedIds(new Set((data || []).map(b => b.user_id)));
    });
  }, []);

  useEffect(() => {
    const checkTroll = async () => {
      try {
        const now = new Date().toISOString();
        const { data } = await supabase.from('admin_events').select('*').eq('type', 'troll_posts').gt('active_until', now).order('created_at', { ascending: false }).limit(1);
        if (data && data.length > 0) {
          setTrollMessage((data[0].config as any)?.message || '🐒 Monkeyed!');
          const remaining = new Date(data[0].active_until).getTime() - Date.now();
          setTimeout(() => setTrollMessage(null), remaining);
        }
      } catch {}
    };
    checkTroll();
    const channel = supabase.channel('troll-events').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_events' }, (payload) => {
      const event = payload.new as any;
      if (event.type === 'troll_posts') {
        setTrollMessage(event.config?.message || '🐒 Monkeyed!');
        const remaining = new Date(event.active_until).getTime() - Date.now();
        if (remaining > 0) setTimeout(() => setTrollMessage(null), remaining);
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch trending & suggested people for right sidebar
  useEffect(() => {
    const fetchSidebar = async () => {
      try {
        const { data } = await supabase.from('posts').select('content').order('created_at', { ascending: false }).limit(200);
        const hashtags: Record<string, number> = {};
        (data || []).forEach(p => {
          const matches = p.content.match(/#\w+/g);
          matches?.forEach(h => { hashtags[h] = (hashtags[h] || 0) + 1; });
        });
        setTrending(Object.entries(hashtags).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count })));
      } catch {}
      try {
        const { data } = await supabase.from('profiles').select('*').limit(4);
        setSuggestedPeople(data || []);
      } catch {}
      if (user) {
        try {
          const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
          setFollowingSet(new Set((data || []).map(f => f.following_id)));
        } catch {}
      }
    };
    fetchSidebar();
  }, [user]);

  const fetchPosts = useCallback(async (pageNum: number) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const { data, error } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url, is_verified)').order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const mapped = (data || []).map((p: any) => ({ ...p, profiles: p.profiles }));
      if (pageNum === 0) setPosts(mapped); else setPosts(prev => [...prev, ...mapped]);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch { toast.error('Failed to load posts'); }
    setLoading(false);
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const [likesRes, bookmarksRes] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', user.id),
        supabase.from('bookmarks').select('post_id').eq('user_id', user.id),
      ]);
      setLikes(new Set((likesRes.data || []).map(l => l.post_id)));
      setBookmarks(new Set((bookmarksRes.data || []).map(b => b.post_id)));
    } catch {}
  }, [user]);

  useEffect(() => { fetchPosts(0); fetchUserData(); }, [fetchPosts, fetchUserData]);

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

  const toggleFollow = async (profileId: string) => {
    if (!user) return;
    const isFollowing = followingSet.has(profileId);
    setFollowingSet(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(profileId); else next.add(profileId);
      return next;
    });
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().match({ follower_id: user.id, following_id: profileId });
      } else {
        await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
        await supabase.from('notifications').insert({ recipient_id: profileId, actor_id: user.id, type: 'follow' });
      }
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="flex justify-center gap-6 px-4 py-4">
      {/* Main feed */}
      <div className="w-full max-w-2xl">
        <PostComposer onPost={() => { setPage(0); fetchPosts(0); fetchUserData(); }} />
        {newPostsBanner && (
          <button onClick={handleRevealNew} className="w-full py-2 mb-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 transition" aria-label="Load new posts">
            New posts — tap to see
          </button>
        )}
        {loading && posts.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" className="text-zinc-200 dark:text-zinc-700" />
              <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="2" className="text-zinc-300 dark:text-zinc-600" />
            </svg>
            <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Nothing here yet</p>
            <p className="text-sm text-zinc-400 mt-1">Be the first to post!</p>
          </div>
        ) : (
          posts.filter(post => !bannedIds.has(post.user_id)).map(post => (
            <div key={post.id}>
              <SocialPostCard
                post={post}
                isLiked={likes.has(post.id)}
                isBookmarked={bookmarks.has(post.id)}
                onDelete={handleDelete}
                onCommentClick={(id) => setExpandedComments(expandedComments === id ? null : id)}
                trollMessage={trollMessage}
              />
              {expandedComments === post.id && <CommentSection postId={post.id} postUserId={post.user_id} />}
            </div>
          ))
        )}
        <div ref={observerRef} className="h-4" />
      </div>

      {/* Right sidebar - desktop only */}
      <div className="hidden xl:block w-64 shrink-0 space-y-4 sticky top-4 self-start">
        {/* Trending */}
        {trending.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-3 text-sm">
              <TrendingUp className="w-4 h-4 text-blue-600" /> Trending
            </h3>
            <div className="space-y-2">
              {trending.map(h => (
                <Link key={h.tag} to={`/explore?tag=${encodeURIComponent(h.tag)}`} className="flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg px-2 py-1.5 transition">
                  <span className="text-sm font-medium text-blue-600">{h.tag}</span>
                  <span className="text-xs text-zinc-400">{h.count} posts</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Who to follow */}
        {suggestedPeople.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-3 text-sm">
              <Users className="w-4 h-4 text-blue-600" /> Who to follow
            </h3>
            <div className="space-y-3">
              {suggestedPeople.filter(p => p.id !== user?.id).slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <Link to={`/profile/${p.username}`}>
                    <img src={getAvatar(p.username, p.avatar_url)} alt={p.username} className="w-9 h-9 rounded-full" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{p.display_name || p.username}</p>
                    <p className="text-xs text-zinc-400 truncate">@{p.username}</p>
                  </div>
                  {user && (
                    <button onClick={() => toggleFollow(p.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition shrink-0 ${followingSet.has(p.id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' : 'bg-blue-600 text-white'}`}>
                      {followingSet.has(p.id) ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
