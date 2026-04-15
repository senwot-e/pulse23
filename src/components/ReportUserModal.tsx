import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReportUserModalProps {
  targetUserId: string;
  targetUsername: string;
  onClose: () => void;
}

export default function ReportUserModal({ targetUserId, targetUsername, onClose }: ReportUserModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || !user) return;
    setSending(true);
    try {
      await supabase.from('user_reports').insert({ reporter_id: user.id, reported_user_id: targetUserId, reason });
      toast.success('Report submitted');
      onClose();
    } catch { toast.error('Failed to submit report'); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Report @{targetUsername}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Why are you reporting this user?"
          rows={4}
          className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none resize-none text-sm mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-500">Cancel</button>
          <button onClick={handleSubmit} disabled={sending || !reason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
