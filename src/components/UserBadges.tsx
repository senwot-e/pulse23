import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Badge {
  id: string;
  name: string;
  color: string;
  image_url: string | null;
}

export default function UserBadges({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('user_badges')
          .select('badge_id, badges(id, name, color, image_url)')
          .eq('user_id', userId);
        if (!cancelled && data) {
          setBadges(data.map((ub: any) => ub.badges).filter(Boolean));
        }
      } catch {}
    };
    fetch();
    return () => { cancelled = true; };
  }, [userId]);

  if (badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {badges.map(b => (
        <span
          key={b.id}
          title={b.name}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: b.color }}
        >
          {b.image_url && <img src={b.image_url} alt={b.name} className="w-3 h-3 rounded-full" />}
          {b.name}
        </span>
      ))}
    </span>
  );
}
