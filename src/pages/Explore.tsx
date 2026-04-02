import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SocialPostCard, { PostData } from '@/components/SocialPostCard';
import CommentSection from '@/components/CommentSection';
import { PostSkeleton } from '@/components/Skeletons';
import { Search, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
}

export default function Explore() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tag = searchParams.get('tag');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [searchTab, setSearchTab] = useState<'posts' | 'people'>('posts');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
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
    setTrending(Object.entries(hashtags).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([h]) => h));
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
        const { data } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').ilike('content', `%${tag}%`).order('created_at', { ascending: false }).limit(50);
        setPosts((data as any) || []);
      } else if (!query) {
        const { data } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').order('created_at', { ascending: false }).limit(20);
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
        const { data } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').ilike('content', `%${query}%`).order('created_at', { ascending: false }).limit(30);
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
    <div className="max-w-xl mx-auto px-4 py-4">
      <div className="relative mb-4">
        <Search className="absolute left-4 top-3 w-5 h-5 text-muted-foreground" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (tag) setSearchParams({}); }}
          placeholder="Search posts and people..."
          className="w-full pl-11 pr-4 py-3 bg-secondary rounded-full text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {query ? (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setSearchTab('posts')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${searchTab === 'posts' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>Posts</button>
            <button onClick={() => setSearchTab('people')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${searchTab === 'people' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>People</button>
          </div>
          {loading ? Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />) : searchTab === 'posts' ? (
            posts.length === 0 ? <p className="text-center text-muted-foreground py-8">No posts found</p> :
            posts.map(p => (
              <div key={p.id}>
                <SocialPostCard post={p} isLiked={likes.has(p.id)} onCommentClick={id => setExpandedComments(expandedComments === id ? null : id)} />
                {expandedComments === p.id && <CommentSection postId={p.id} postUserId={p.user_id} />}
              </div>
            ))
          ) : (
            people.length === 0 ? <p className="text-center text-muted-foreground py-8">No people found</p> :
            people.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-card rounded-lg border p-3 mb-2">
                <Link to={`/profile/${p.username}`} className="flex items-center gap-3">
                  <img src={getAvatar(p.username, p.avatar_url)} alt="" className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="font-medium text-foreground">{p.display_name || p.username}</p>
                    <p className="text-sm text-muted-foreground">@{p.username}</p>
                  </div>
                </Link>
                {user && p.id !== user.id && (
                  <button onClick={() => toggleFollow(p.id)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${followingSet.has(p.id) ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
                    {followingSet.has(p.id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))
          )}
        </>
      ) : (
        <>
          {tag && <p className="text-sm text-muted-foreground mb-3">Showing posts with {tag}</p>}
          {!tag && trending.length > 0 && (
            <div className="mb-6">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-primary" /> Trending</h3>
              <div className="flex flex-wrap gap-2">
                {trending.map(h => (
                  <button key={h} onClick={() => setSearchParams({ tag: h })} className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition">{h}</button>
                ))}
              </div>
            </div>
          )}
          {!tag && discoverPeople.length > 0 && (
            <div className="mb-6">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-primary" /> Discover People</h3>
              <div className="grid grid-cols-2 gap-2">
                {discoverPeople.filter(p => p.id !== user?.id).slice(0, 6).map(p => (
                  <div key={p.id} className="bg-card rounded-lg border p-3 flex flex-col items-center text-center">
                    <Link to={`/profile/${p.username}`}>
                      <img src={getAvatar(p.username, p.avatar_url)} alt="" className="w-12 h-12 rounded-full mb-2" />
                    </Link>
                    <p className="text-sm font-medium text-foreground truncate w-full">{p.display_name || p.username}</p>
                    <p className="text-xs text-muted-foreground mb-2">@{p.username}</p>
                    {user && (
                      <button onClick={() => toggleFollow(p.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${followingSet.has(p.id) ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
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
