import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SocialPostCard, { PostData } from '@/components/SocialPostCard';
import CommentSection from '@/components/CommentSection';
import { PostSkeleton } from '@/components/Skeletons';
import { Loader2 } from 'lucide-react';

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => { document.title = 'Pulse 23 · Post'; }, []);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').eq('id', id).single();
      setPost(data as any);
      if (user && data) {
        const [{ data: l }, { data: b }] = await Promise.all([
          supabase.from('likes').select('id').match({ user_id: user.id, post_id: data.id }),
          supabase.from('bookmarks').select('id').match({ user_id: user.id, post_id: data.id }),
        ]);
        setIsLiked((l?.length || 0) > 0);
        setIsBookmarked((b?.length || 0) > 0);
      }
      setLoading(false);
    };
    if (id) fetch();
  }, [id, user]);

  if (loading) return <div className="max-w-xl mx-auto px-4 py-4"><PostSkeleton /></div>;
  if (!post) return <div className="max-w-xl mx-auto px-4 py-12 text-center text-muted-foreground">Post not found</div>;

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <SocialPostCard post={post} isLiked={isLiked} isBookmarked={isBookmarked} />
      <CommentSection postId={post.id} postUserId={post.user_id} />
    </div>
  );
}
