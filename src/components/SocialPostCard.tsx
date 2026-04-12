import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Fish,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import VerifiedBadge from './VerifiedBadge';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

interface PostProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
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
  return avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export default function SocialPostCard({ post, isLiked: initialLiked = false, isBookmarked: initialBookmarked = false, onDelete, onCommentClick, trollMessage }: PostCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleFish = () => {
    const content = trollMessage || post.content;
    navigate(`/ai?upload=${encodeURIComponent(content)}`);
  };

  const displayContent = trollMessage || post.content;

  return (
    <div
      className={`rounded-3xl mb-4 overflow-hidden transition-all duration-200 hover:shadow-lg ${
        trollMessage ? 'border border-red-300/30' : ''
      }`}
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
      }}
    >
      <style>{`.dark .post-card-dark { background: rgba(24,24,27,0.85) !important; border-color: rgba(255,255,255,0.08) !important; }`}</style>
      <div className="p-4 post-card-dark">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${post.profiles.username}`}>
              <img
                src={getAvatar(post.profiles.username, post.profiles.avatar_url)}
                alt={post.profiles.username}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-transparent hover:ring-blue-100 transition-all"
              />
            </Link>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link to={`/profile/${post.profiles.username}`} className="font-semibold text-sm text-zinc-900 dark:text-white hover:underline">
                  {post.profiles.display_name || post.profiles.username}
                </Link>
                {post.profiles.is_verified && <VerifiedBadge />}
              </div>
              <p className="text-xs text-zinc-400">
                @{post.profiles.username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={handleBookmark} className={`p-1.5 rounded-full transition-colors ${bookmarked ? 'text-yellow-500' : 'text-zinc-400 hover:text-zinc-600'}`} aria-label="Bookmark">
              <Bookmark className={`w-4 h-4 ${bookmarked && 'fill-current'}`} />
            </button>
            {user?.id === post.user_id && (
              <div className="relative">
                <button onClick={() => setShowMenu(v => !v)} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-400" aria-label="More options">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-10 py-1 min-w-[120px]">
                    <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 w-full" aria-label="Delete post">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>
          {displayContent.split(/(#\w+)/g).map((part, i) =>
            part.startsWith('#') ? <span key={i} className="text-blue-500 hover:underline cursor-pointer">{part}</span> : part
          )}
        </div>

        {post.image_url && !trollMessage && (
          <div className="mt-3 rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800">
            <img src={post.image_url} alt="Post image" className="w-full max-h-96 object-cover" />
          </div>
        )}
      </div>

      {/* Reactions */}
      <div className="flex items-center border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={handleLike}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20 ${liked ? 'text-rose-600' : 'text-zinc-400 hover:text-rose-500'}`}
          aria-label="Like"
        >
          <Heart className={`w-4 h-4 ${liked && 'fill-current'}`} />
          <span className="text-xs">{likesCount}</span>
        </button>
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />
        <button
          onClick={() => onCommentClick?.(post.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
          aria-label="Comment"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">{post.comments_count}</span>
        </button>
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-zinc-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button onClick={handleFish} className="flex items-center justify-center p-2.5 text-zinc-400 hover:text-blue-500 transition-colors" title="Send to Nemo" aria-label="Send to Nemo">
          <Fish className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
