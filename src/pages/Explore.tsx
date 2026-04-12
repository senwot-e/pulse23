import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SocialPostCard, { PostData } from '@/components/SocialPostCard';
import CommentSection from '@/components/CommentSection';
import { PostSkeleton } from '@/components/Skeletons';
import VerifiedBadge from '@/components/VerifiedBadge';
import { Search, TrendingUp, Users } from 'lucide-react';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export default function Explore() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tag = searchParams.get('tag');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [searchTab, setSearchTab] = useState<'posts' | 'people'>('posts');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);
  const [discoverPeople, setDiscoverPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<string | null>(null);

  useEffect(() => { document.title = 'Pulse 23 · Explore'; }, []);

  const fetchTrending = useCallback(async () => {
    const { data } = await supabase.from('posts').select('content').order('created_at', { ascending: false }).limit(200);
    const hashtags: Record<string, number> = {};
    (data || []).forEach(p => {
      const matches = p.content.match(/#\w+/g);
      matches?.forEach(h => { hashtags[h] = (hashtags[h] || 0) + 1; });
    });
    setTrending(Object.entries(hashtags).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count })));
  }, []);

  const fetchDiscover = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').limit(6);
    setDiscoverPeople(data || []);
  }, []);

  const fetchFollowing = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    setFollowingSet(new Set((data || []).map(f => f.following_id)));
  }, [user]);

  const fetchLikes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
    setLikes(new Set((data || []).map(l => l.post_id)));
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (tag) {
        const { data } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url, is_verified)').ilike('content', `%${tag}%`).order('created_at', { ascending: false }).limit(50);
        setPosts((data as any) || []);
      } else if (!query) {
        const { data } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url, is_verified)').order('created_at', { ascending: false }).limit(20);
        setPosts((data as any) || []);
        await fetchTrending();
        await fetchDiscover();
      }
      await fetchFollowing();
      await fetchLikes();
      setLoading(false);
    };
    init();
  }, [tag, fetchTrending, fetchDiscover, fetchFollowing, fetchLikes]);

  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      if (searchTab === 'posts') {
        const { data } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url, is_verified)').ilike('content', `%${query}%`).order('created_at', { ascending: false }).limit(30);
        setPosts((data as any) || []);
      } else {
        const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${query}%,display_name.ilike.%${query}%`).limit(20);
        setPeople(data || []);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchTab]);

  const toggleFollow = async (profileId: string) => {
    if (!user) { toast.error('Sign in to follow'); return; }
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
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="relative mb-4">
        <Search className="absolute left-4 top-3 w-5 h-5 text-zinc-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (tag) setSearchParams({}); }}
          placeholder="Search posts and people..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
        />
      </div>

      {query ? (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setSearchTab('posts')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${searchTab === 'posts' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>Posts</button>
            <button onClick={() => setSearchTab('people')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${searchTab === 'people' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>People</button>
          </div>
          {loading ? (
            searchTab === 'posts' ? Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />) :
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-zinc-200 dark:bg-zinc-700 rounded-2xl animate-pulse" />)}</div>
          ) : searchTab === 'posts' ? (
            posts.length === 0 ? <p className="text-center text-zinc-400 py-8">No posts found</p> :
            posts.map(p => (
              <div key={p.id}>
                <SocialPostCard post={p} isLiked={likes.has(p.id)} onCommentClick={id => setExpandedComments(expandedComments === id ? null : id)} />
                {expandedComments === p.id && <CommentSection postId={p.id} postUserId={p.user_id} />}
              </div>
            ))
          ) : (
            people.length === 0 ? <p className="text-center text-zinc-400 py-8">No people found</p> :
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {people.map(p => (
                <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-blue-200 transition-all text-center">
                  <Link to={`/profile/${p.username}`}>
                    <img src={getAvatar(p.username, p.avatar_url)} alt={p.username} className="w-14 h-14 rounded-full" />
                  </Link>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{p.display_name || p.username}</p>
                    {p.is_verified && <VerifiedBadge />}
                  </div>
                  <p className="text-xs text-zinc-500">@{p.username}</p>
                  {user && p.id !== user.id && (
                    <button onClick={() => toggleFollow(p.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${followingSet.has(p.id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' : 'bg-blue-600 text-white'}`}>
                      {followingSet.has(p.id) ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {tag && <p className="text-sm text-zinc-400 mb-3">Showing posts with {tag}</p>}
          {!tag && trending.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-blue-600" /> Trending</h3>
              <div className="flex flex-wrap gap-2">
                {trending.map(h => (
                  <button key={h.tag} onClick={() => setSearchParams({ tag: h.tag })} className="px-4 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 transition">{h.tag}</button>
                ))}
              </div>
            </div>
          )}
          {!tag && discoverPeople.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-blue-600" /> Discover People</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {discoverPeople.filter(p => p.id !== user?.id).slice(0, 6).map(p => (
                  <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-blue-200 transition-all text-center">
                    <Link to={`/profile/${p.username}`}>
                      <img src={getAvatar(p.username, p.avatar_url)} alt={p.username} className="w-14 h-14 rounded-full" />
                    </Link>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{p.display_name || p.username}</p>
                      {p.is_verified && <VerifiedBadge />}
                    </div>
                    <p className="text-xs text-zinc-500">@{p.username}</p>
                    {user && (
                      <button onClick={() => toggleFollow(p.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${followingSet.has(p.id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' : 'bg-blue-600 text-white'}`}>
                        {followingSet.has(p.id) ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading ? Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />) :
            posts.map(p => (
              <div key={p.id}>
                <SocialPostCard post={p} isLiked={likes.has(p.id)} onCommentClick={id => setExpandedComments(expandedComments === id ? null : id)} />
                {expandedComments === p.id && <CommentSection postId={p.id} postUserId={p.user_id} />}
              </div>
            ))
          }
        </>
      )}
    </div>
  );
}
