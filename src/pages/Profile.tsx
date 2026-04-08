import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SocialPostCard, { PostData } from '@/components/SocialPostCard';
import CommentSection from '@/components/CommentSection';
import { ProfileSkeleton, PostSkeleton } from '@/components/Skeletons';
import { Loader2, Edit2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface Badge {
  id: string;
  name: string;
  image_url: string | null;
  detail: string | null;
  color: string;
}

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user, profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'posts' | 'likes' | 'bookmarks'>('posts');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [badges, setBadges] = useState<Badge[]>([]);

  const isOwn = user?.id === profile?.id;

  useEffect(() => { document.title = `Pulse 23 · @${username}`; }, [username]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from('profiles').select('*').eq('username', username).single();
      setProfile(data);
      if (data) {
        const [{ count: fc }, { count: fgc }, badgesRes] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', data.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', data.id),
          supabase.from('user_badges').select('badge_id, badges(id, name, image_url, detail, color)').eq('user_id', data.id),
        ]);
        setFollowerCount(fc || 0);
        setFollowingCount(fgc || 0);
        setBadges((badgesRes.data || []).map((ub: any) => ub.badges).filter(Boolean));
        if (user) {
          const { data: f } = await supabase.from('follows').select('follower_id').match({ follower_id: user.id, following_id: data.id });
          setIsFollowing((f?.length || 0) > 0);
        }
      }
      setLoading(false);
    };
    if (username) fetch();
  }, [username, user]);

  const fetchTab = useCallback(async () => {
    if (!profile) return;
    setPostsLoading(true);
    let data: any[] = [];
    if (tab === 'posts') {
      const res = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').eq('user_id', profile.id).order('created_at', { ascending: false });
      data = res.data || [];
    } else if (tab === 'likes') {
      const res = await supabase.from('likes').select('post_id, posts(*, profiles(username, display_name, avatar_url))').eq('user_id', profile.id).order('created_at', { ascending: false });
      data = (res.data || []).map((l: any) => l.posts).filter(Boolean);
    } else if (tab === 'bookmarks' && isOwn) {
      const res = await supabase.from('bookmarks').select('post_id, posts(*, profiles(username, display_name, avatar_url))').eq('user_id', profile.id).order('created_at', { ascending: false });
      data = (res.data || []).map((b: any) => b.posts).filter(Boolean);
    }
    setPosts(data);
    if (user) {
      const { data: l } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
      setLikes(new Set((l || []).map(x => x.post_id)));
    }
    setPostsLoading(false);
  }, [profile, tab, isOwn, user]);

  useEffect(() => { fetchTab(); }, [fetchTab]);

  const toggleFollow = async () => {
    if (!user || !profile) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowerCount(c => next ? c + 1 : c - 1);
    try {
      if (next) {
        await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id });
        await supabase.from('notifications').insert({ recipient_id: profile.id, actor_id: user.id, type: 'follow' });
      } else {
        await supabase.from('follows').delete().match({ follower_id: user.id, following_id: profile.id });
      }
    } catch { toast.error('Failed'); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from('profiles').update({ display_name: editName, bio: editBio }).eq('id', user.id);
      setProfile((p: any) => ({ ...p, display_name: editName, bio: editBio }));
      setEditModal(false);
      toast.success('Profile updated');
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  if (loading) return <div className="max-w-xl mx-auto px-4 py-4"><ProfileSkeleton /></div>;
  if (!profile) return <div className="max-w-xl mx-auto px-4 py-12 text-center text-muted-foreground">User not found</div>;

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <div className="gradient-primary h-32 rounded-t-lg" />
      <div className="bg-card rounded-b-lg border border-t-0 px-4 pb-4">
        <div className="flex items-end justify-between -mt-10">
          <img src={getAvatar(profile.username, profile.avatar_url)} alt="" className="w-20 h-20 rounded-full border-4 border-card object-cover" />
          {isOwn ? (
            <button onClick={() => { setEditName(profile.display_name || ''); setEditBio(profile.bio || ''); setEditModal(true); }} className="flex items-center gap-1 px-4 py-2 border rounded-full text-sm font-medium text-foreground hover:bg-secondary transition mt-12">
              <Edit2 className="w-4 h-4" /> Edit profile
            </button>
          ) : user ? (
            <button onClick={toggleFollow} className={`px-4 py-2 rounded-full text-sm font-medium transition mt-12 ${isFollowing ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-heading font-bold text-foreground">{profile.display_name || profile.username}</h1>
            {badges.map(badge => (
              <span
                key={badge.id}
                title={badge.detail || badge.name}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: badge.color }}
              >
                {badge.image_url && <img src={badge.image_url} alt="" className="w-3 h-3 rounded-full" />}
                {badge.name}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="text-sm text-foreground mt-2">{profile.bio}</p>}
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-foreground"><strong>{followingCount}</strong> <span className="text-muted-foreground">Following</span></span>
            <span className="text-foreground"><strong>{followerCount}</strong> <span className="text-muted-foreground">Followers</span></span>
            <span className="text-foreground flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-primary" /><strong>{profile.pulse_count || 0}</strong> <span className="text-muted-foreground">Pulse</span></span>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mt-4 mb-3">
        {(['posts', 'likes', ...(isOwn ? ['bookmarks'] : [])] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)} className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{t}</button>
        ))}
      </div>

      {postsLoading ? Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />) :
        posts.length === 0 ? <p className="text-center text-muted-foreground py-8">Nothing here yet</p> :
        posts.map(p => (
          <div key={p.id}>
            <SocialPostCard post={p} isLiked={likes.has(p.id)} onCommentClick={id => setExpandedComments(expandedComments === id ? null : id)} />
            {expandedComments === p.id && <CommentSection postId={p.id} postUserId={p.user_id} />}
          </div>
        ))
      }

      {editModal && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setEditModal(false)}>
          <div className="bg-card rounded-lg border p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-heading font-bold text-foreground mb-4">Edit Profile</h3>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Display name" className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground mb-3 outline-none" />
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Bio" rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground mb-4 outline-none resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModal(false)} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
              <button onClick={handleSaveProfile} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
