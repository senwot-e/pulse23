import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Fish,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

interface PostProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface PostData {
  id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  user_id: string;
  profiles: PostProfile;
}

interface PostCardProps {
  post: PostData;
  isLiked?: boolean;
  isBookmarked?: boolean;
  onDelete?: (id: string) => void;
  onCommentClick?: (postId: string) => void;
  trollMessage?: string | null;
}

function getAvatar(username: string, avatarUrl?: string | null) {
  return avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
}

interface Badge {
  id: string;
  name: string;
  image_url: string | null;
  detail: string | null;
  color: string;
}

export default function SocialPostCard({ post, isLiked: initialLiked = false, isBookmarked: initialBookmarked = false, onDelete, onCommentClick, trollMessage }: PostCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showMenu, setShowMenu] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    const fetchBadges = async () => {
      const { data } = await supabase
        .from('user_badges')
        .select('badge_id, badges(id, name, image_url, detail, color)')
        .eq('user_id', post.user_id);
      if (data) {
        setBadges(data.map((ub: any) => ub.badges).filter(Boolean));
      }
    };
    fetchBadges();
  }, [post.user_id]);

  const handleLike = async () => {
    if (!user) { toast.error('Sign in to like posts'); return; }
    const next = !liked;
    setLiked(next);
    setLikesCount(c => next ? c + 1 : c - 1);
    try {
      if (next) {
        await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
        await supabase.from('posts').update({ likes_count: likesCount + 1 }).eq('id', post.id);
        if (post.user_id !== user.id) {
          await supabase.from('notifications').insert({ recipient_id: post.user_id, actor_id: user.id, type: 'like', post_id: post.id });
        }
      } else {
        await supabase.from('likes').delete().match({ user_id: user.id, post_id: post.id });
        await supabase.from('posts').update({ likes_count: Math.max(0, likesCount - 1) }).eq('id', post.id);
      }
    } catch { toast.error('Failed to update like'); }
  };

  const handleBookmark = async () => {
    if (!user) { toast.error('Sign in to bookmark'); return; }
    const next = !bookmarked;
    setBookmarked(next);
    try {
      if (next) {
        await supabase.from('bookmarks').insert({ user_id: user.id, post_id: post.id });
        toast.success('Bookmarked');
      } else {
        await supabase.from('bookmarks').delete().match({ user_id: user.id, post_id: post.id });
        toast.success('Removed');
      }
    } catch { toast.error('Failed'); }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.origin + '/post/' + post.id);
    toast.success('Link copied!');
  };

  const handleDelete = async () => {
    if (!user || user.id !== post.user_id) return;
    try {
      await supabase.from('posts').delete().eq('id', post.id);
      toast.success('Deleted');
      onDelete?.(post.id);
    } catch { toast.error('Failed to delete'); }
  };

  const handleFish = () => {
    const content = trollMessage || post.content;
    navigate(`/ai?upload=${encodeURIComponent(content)}`);
  };

  const displayContent = trollMessage || post.content;

  return (
    <div className={cn(
      "bg-card rounded-xl border shadow-sm mb-3 overflow-hidden transition-all duration-200 hover:shadow-md",
      trollMessage && "border-destructive/30"
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${post.profiles.username}`}>
              <img src={getAvatar(post.profiles.username, post.profiles.avatar_url)} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-border" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link to={`/profile/${post.profiles.username}`} className="font-heading font-semibold text-foreground hover:underline text-sm">
                  {post.profiles.display_name || post.profiles.username}
                </Link>
                {badges.map(badge => (
                  <span key={badge.id} title={badge.detail || badge.name} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: badge.color }}>
                    {badge.image_url && <img src={badge.image_url} alt="" className="w-3 h-3 rounded-full" />}
                    {badge.name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                @{post.profiles.username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={handleBookmark} className={cn("p-1.5 rounded-full transition-colors", bookmarked ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Bookmark className={cn("w-4 h-4", bookmarked && "fill-current")} />
            </button>
            {user?.id === post.user_id && (
              <div className="relative">
                <button onClick={() => setShowMenu(v => !v)} className="p-1.5 rounded-full hover:bg-secondary transition text-muted-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 bg-card border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                    <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary w-full">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 text-foreground text-sm leading-relaxed whitespace-pre-wrap">
          {displayContent.split(/(\#\w+)/g).map((part, i) =>
            part.startsWith('#') ? <span key={i} className="text-primary font-medium hover:underline cursor-pointer">{part}</span> : part
          )}
        </div>

        {post.image_url && !trollMessage && (
          <div className="mt-3 rounded-lg overflow-hidden border">
            <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
          </div>
        )}
      </div>

      {/* Reactions */}
      <div className="flex items-center border-t px-2">
        <button onClick={handleLike} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm transition-colors", liked ? "text-destructive" : "text-muted-foreground hover:text-destructive")}>
          <Heart className={cn("w-4 h-4", liked && "fill-current")} />
          <span className="text-xs">{likesCount}</span>
        </button>
        <button onClick={() => onCommentClick?.(post.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">{post.comments_count}</span>
        </button>
        <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <Share2 className="w-4 h-4" />
        </button>
        <button onClick={handleFish} className="flex items-center justify-center p-2.5 text-muted-foreground hover:text-primary transition-colors" title="Send to Nemo">
          <Fish className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
