import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminEventListener() {
  const [rainbowActive, setRainbowActive] = useState(false);

  useEffect(() => {
    // Check for active events on mount
    const checkActive = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('admin_events')
        .select('*')
        .gt('active_until', now)
        .order('created_at', { ascending: false });

      if (data) {
        for (const event of data) {
          if (event.type === 'rainbow_flash') {
            activateRainbow(new Date(event.active_until).getTime() - Date.now());
          }
        }
      }
    };
    checkActive();

    // Subscribe to new events
    const channel = supabase
      .channel('admin-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_events' }, (payload) => {
        const event = payload.new as any;
        if (event.type === 'rainbow_flash') {
          const remaining = new Date(event.active_until).getTime() - Date.now();
          if (remaining > 0) activateRainbow(remaining);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const activateRainbow = (durationMs: number) => {
    setRainbowActive(true);
    setTimeout(() => setRainbowActive(false), durationMs);
  };

  if (!rainbowActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none animate-rainbow-flash opacity-30" />
  );
}
