import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

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
}

function getAvatar(username: string, avatarUrl?: string | null) {
  return avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
}

export default function SocialPostCard({ post, isLiked: initialLiked = false, isBookmarked: initialBookmarked = false, onDelete, onCommentClick }: PostCardProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showMenu, setShowMenu] = useState(false);

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

  return (
    <div className="bg-card rounded-lg border p-4 mb-3 transition hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.profiles.username}`}>
            <img src={getAvatar(post.profiles.username, post.profiles.avatar_url)} alt="" className="w-10 h-10 rounded-full object-cover" />
          </Link>
          <div>
            <Link to={`/profile/${post.profiles.username}`} className="font-heading font-semibold text-foreground hover:underline">
              {post.profiles.display_name || post.profiles.username}
            </Link>
            <p className="text-sm text-muted-foreground">
              @{post.profiles.username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        {user?.id === post.user_id && (
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)} className="p-1 rounded hover:bg-secondary transition">
              <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
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

      <div className="mt-3 text-foreground whitespace-pre-wrap">
        {post.content.split(/(\#\w+)/g).map((part, i) =>
          part.startsWith('#') ? <span key={i} className="text-primary font-medium">{part}</span> : part
        )}
      </div>

      {post.image_url && (
        <img src={post.image_url} alt="" className="mt-3 rounded-lg max-h-96 w-full object-cover" />
      )}

      <div className="flex items-center mt-3 border-t pt-2 -mx-1">
        <button onClick={handleLike} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm hover:bg-secondary transition">
          <Heart className={`w-4 h-4 ${liked ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`} />
          <span className={liked ? 'text-destructive' : 'text-muted-foreground'}>{likesCount}</span>
        </button>
        <button onClick={() => onCommentClick?.(post.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm hover:bg-secondary transition text-muted-foreground">
          <MessageCircle className="w-4 h-4" />
          <span>{post.comments_count}</span>
        </button>
        <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm hover:bg-secondary transition text-muted-foreground">
          <Share2 className="w-4 h-4" />
        </button>
        <button onClick={handleBookmark} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm hover:bg-secondary transition">
          <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
        </button>
      </div>
    </div>
  );
}
