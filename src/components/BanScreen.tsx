import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface BanScreenProps {
  username: string;
  reason: string;
}

export default function BanScreen({ username, reason }: BanScreenProps) {
  const { user } = useAuth();
  const [showAppeal, setShowAppeal] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleAppeal = async () => {
    if (!appealText.trim() || !user) return;
    setSending(true);
    try {
      await supabase.from('ban_appeals').insert({ user_id: user.id, message: appealText });
      toast.success('Appeal submitted');
      setSent(true);
    } catch { toast.error('Failed to submit appeal'); }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-950/50 flex items-center justify-center">
          <span className="text-4xl">🚫</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Goodbye, {username}.</h1>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mt-6 mb-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Reason for ban</p>
          <p className="text-sm text-zinc-300">{reason}</p>
        </div>

        {sent ? (
          <p className="text-green-400 text-sm">Your appeal has been submitted. A moderator will review it.</p>
        ) : showAppeal ? (
          <div className="space-y-3">
            <textarea
              value={appealText}
              onChange={e => setAppealText(e.target.value)}
              placeholder="Explain why you should be unbanned..."
              rows={4}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 outline-none resize-none text-sm"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAppeal(false)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-sm">Cancel</button>
              <button onClick={handleAppeal} disabled={sending || !appealText.trim()} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Appeal'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAppeal(true)} className="px-6 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition">
            Appeal Ban
          </button>
        )}
      </div>
    </div>
  );
}
