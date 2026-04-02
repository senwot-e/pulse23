import { useState, useRef } from 'react';
import { ImagePlus, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface PostComposerProps {
  onPost?: () => void;
}

export default function PostComposer({ onPost }: PostComposerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [originalDraft, setOriginalDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const charCount = content.length;
  const charColor = charCount >= 275 ? 'text-destructive' : charCount >= 260 ? 'text-amber-500' : 'text-muted-foreground';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('post-images').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path);
      setImageUrl(publicUrl);
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const handleEnhance = async () => {
    if (!content.trim()) return;
    setEnhancing(true);
    setOriginalDraft(content);
    try {
      const { data, error } = await supabase.functions.invoke('ai-enhance', { body: { draft: content } });
      if (error) throw error;
      setContent(data.enhanced);
      setEnhanced(true);
    } catch { toast.error('Enhancement failed'); }
    setEnhancing(false);
  };

  const handleUndo = () => {
    setContent(originalDraft);
    setEnhanced(false);
  };

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim(),
        image_url: imageUrl,
      });
      if (error) throw error;
      setContent('');
      setImageUrl(null);
      setEnhanced(false);
      toast.success('Posted!');
      onPost?.();
    } catch { toast.error('Failed to post'); }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="bg-card rounded-lg border p-6 mb-4 text-center">
        <p className="text-muted-foreground">Sign in to share what's on your mind</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-4 mb-4">
      <textarea
        value={content}
        onChange={e => { setContent(e.target.value); setEnhanced(false); }}
        placeholder="What's happening?"
        maxLength={280}
        rows={2}
        className="w-full bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground"
        style={{ maxHeight: '7.5rem' }}
      />
      {imageUrl && (
        <div className="relative mt-2">
          <img src={imageUrl} alt="" className="rounded-lg max-h-48 object-cover" />
          <button onClick={() => setImageUrl(null)} className="absolute top-1 right-1 bg-background/80 rounded-full p-1 text-foreground text-xs">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="p-2 rounded-full hover:bg-secondary transition text-muted-foreground">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          </button>
          <button onClick={handleEnhance} disabled={enhancing || !content.trim()} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full hover:bg-secondary transition text-muted-foreground disabled:opacity-50">
            {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {enhanced ? '✨ Enhanced' : 'Enhance'}
          </button>
          {enhanced && (
            <button onClick={handleUndo} className="text-sm text-primary hover:underline">Undo</button>
          )}
          <span className={`text-sm ${charColor}`}>{charCount}/280</span>
        </div>
        <button onClick={handleSubmit} disabled={loading || !content.trim() || charCount > 280} className="px-5 py-2 bg-primary text-primary-foreground rounded-full font-medium text-sm hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pulse it'}
        </button>
      </div>
    </div>
  );
}
