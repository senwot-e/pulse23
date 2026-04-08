import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Zap, Award, Skull, Rainbow, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MonkeyPanel() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'rainbow' | 'troll' | 'pulse' | 'badges'>('rainbow');

  // Rainbow state
  const [rainbowDuration, setRainbowDuration] = useState(10);
  const [rainbowLoading, setRainbowLoading] = useState(false);

  // Troll state
  const [trollMessage, setTrollMessage] = useState('🐒 You have been monkeyed!');
  const [trollDuration, setTrollDuration] = useState(30);
  const [trollLoading, setTrollLoading] = useState(false);

  // Pulse state
  const [targetUsername, setTargetUsername] = useState('');
  const [pulseAmount, setPulseAmount] = useState(100);
  const [pulseLoading, setPulseLoading] = useState(false);

  // Badge state
  const [badgeName, setBadgeName] = useState('');
  const [badgeDetail, setBadgeDetail] = useState('');
  const [badgeColor, setBadgeColor] = useState('#3B82F6');
  const [badgeImageUrl, setBadgeImageUrl] = useState('');
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [badgeTargetUsername, setBadgeTargetUsername] = useState('');
  const [existingBadges, setExistingBadges] = useState<any[]>([]);
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const badgeFileRef = useRef<HTMLInputElement>(null);
  const [uploadingBadge, setUploadingBadge] = useState(false);

  useEffect(() => {
    const fetchBadges = async () => {
      const { data } = await supabase.from('badges').select('*').order('created_at', { ascending: false });
      setExistingBadges(data || []);
    };
    fetchBadges();
  }, []);

  if (!isAdmin) return null;

  const triggerRainbow = async () => {
    setRainbowLoading(true);
    try {
      const activeUntil = new Date(Date.now() + rainbowDuration * 1000).toISOString();
      await supabase.from('admin_events').insert({
        type: 'rainbow_flash',
        config: { duration: rainbowDuration },
        active_until: activeUntil,
        created_by: user!.id,
      });
      toast.success('🌈 Rainbow flash activated!');
    } catch { toast.error('Failed'); }
    setRainbowLoading(false);
  };

  const triggerTroll = async () => {
    setTrollLoading(true);
    try {
      const activeUntil = new Date(Date.now() + trollDuration * 1000).toISOString();
      await supabase.from('admin_events').insert({
        type: 'troll_posts',
        config: { message: trollMessage, duration: trollDuration },
        active_until: activeUntil,
        created_by: user!.id,
      });
      toast.success('🐒 Troll mode activated!');
    } catch { toast.error('Failed'); }
    setTrollLoading(false);
  };

  const increasePulse = async () => {
    setPulseLoading(true);
    try {
      const { data: targetProfile } = await supabase.from('profiles').select('id, pulse_count').eq('username', targetUsername).single();
      if (!targetProfile) { toast.error('User not found'); setPulseLoading(false); return; }
      await supabase.from('profiles').update({ pulse_count: (targetProfile.pulse_count || 0) + pulseAmount }).eq('id', targetProfile.id);
      toast.success(`⚡ Added ${pulseAmount} Pulse to @${targetUsername}`);
      setTargetUsername('');
    } catch { toast.error('Failed'); }
    setPulseLoading(false);
  };

  const handleBadgeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingBadge(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `badges/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setBadgeImageUrl(publicUrl);
    } catch { toast.error('Upload failed'); }
    setUploadingBadge(false);
  };

  const createBadge = async () => {
    if (!badgeName.trim()) { toast.error('Badge name required'); return; }
    setBadgeLoading(true);
    try {
      const { data, error } = await supabase.from('badges').insert({
        name: badgeName,
        detail: badgeDetail,
        color: badgeColor,
        image_url: badgeImageUrl || null,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      setExistingBadges(prev => [data, ...prev]);
      setBadgeName('');
      setBadgeDetail('');
      setBadgeImageUrl('');
      toast.success('Badge created!');
    } catch { toast.error('Failed'); }
    setBadgeLoading(false);
  };

  const grantBadge = async () => {
    if (!selectedBadgeId || !badgeTargetUsername) { toast.error('Select badge and user'); return; }
    setGrantLoading(true);
    try {
      const { data: targetProfile } = await supabase.from('profiles').select('id').eq('username', badgeTargetUsername).single();
      if (!targetProfile) { toast.error('User not found'); setGrantLoading(false); return; }
      const { error } = await supabase.from('user_badges').insert({
        user_id: targetProfile.id,
        badge_id: selectedBadgeId,
        granted_by: user!.id,
      });
      if (error) throw error;
      toast.success(`Badge given to @${badgeTargetUsername}!`);
      setBadgeTargetUsername('');
    } catch (err: any) {
      if (err?.code === '23505') toast.error('User already has this badge');
      else toast.error('Failed');
    }
    setGrantLoading(false);
  };

  const tabs = [
    { id: 'rainbow' as const, label: '🌈 Rainbow', icon: Rainbow },
    { id: 'troll' as const, label: '🐒 Troll', icon: Skull },
    { id: 'pulse' as const, label: '⚡ Pulse', icon: Zap },
    { id: 'badges' as const, label: '🏅 Badges', icon: Award },
  ];

  return (
    <div className="bg-card border-2 border-destructive/50 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h2 className="text-lg font-heading font-bold text-foreground">🐵 Monkey Panel</h2>
        <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Admin Only</span>
      </div>

      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${activeTab === t.id ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'rainbow' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Flash rainbow on everyone's screen</p>
          <div>
            <label className="text-xs text-muted-foreground">Duration (seconds)</label>
            <input type="number" value={rainbowDuration} onChange={e => setRainbowDuration(Number(e.target.value))} min={1} max={300} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
          </div>
          <button onClick={triggerRainbow} disabled={rainbowLoading} className="w-full py-2 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center">
            {rainbowLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🌈 Activate Rainbow Flash'}
          </button>
        </div>
      )}

      {activeTab === 'troll' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Replace all posts with a custom message</p>
          <div>
            <label className="text-xs text-muted-foreground">Message</label>
            <input value={trollMessage} onChange={e => setTrollMessage(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration (seconds)</label>
            <input type="number" value={trollDuration} onChange={e => setTrollDuration(Number(e.target.value))} min={5} max={600} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
          </div>
          <button onClick={triggerTroll} disabled={trollLoading} className="w-full py-2 bg-destructive text-destructive-foreground rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center">
            {trollLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🐒 Activate Troll Mode'}
          </button>
        </div>
      )}

      {activeTab === 'pulse' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Increase a user's Pulse score</p>
          <div>
            <label className="text-xs text-muted-foreground">Username</label>
            <input value={targetUsername} onChange={e => setTargetUsername(e.target.value)} placeholder="username" className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount</label>
            <input type="number" value={pulseAmount} onChange={e => setPulseAmount(Number(e.target.value))} min={1} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
          </div>
          <button onClick={increasePulse} disabled={pulseLoading || !targetUsername} className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center">
            {pulseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `⚡ Add ${pulseAmount} Pulse`}
          </button>
        </div>
      )}

      {activeTab === 'badges' && (
        <div className="space-y-4">
          {/* Create badge */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Create Badge</p>
            <input value={badgeName} onChange={e => setBadgeName(e.target.value)} placeholder="Badge name" className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
            <input value={badgeDetail} onChange={e => setBadgeDetail(e.target.value)} placeholder="Description" className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Color</label>
                <input type="color" value={badgeColor} onChange={e => setBadgeColor(e.target.value)} className="w-full h-9 rounded-lg cursor-pointer" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Image</label>
                <button onClick={() => badgeFileRef.current?.click()} disabled={uploadingBadge} className="w-full h-9 bg-secondary rounded-lg text-sm text-muted-foreground hover:bg-secondary/80">
                  {uploadingBadge ? 'Uploading...' : badgeImageUrl ? '✓ Uploaded' : 'Choose image'}
                </button>
                <input ref={badgeFileRef} type="file" accept="image/*" className="hidden" onChange={handleBadgeImageUpload} />
              </div>
            </div>
            <button onClick={createBadge} disabled={badgeLoading || !badgeName.trim()} className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50">
              {badgeLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Badge'}
            </button>
          </div>

          {/* Grant badge */}
          {existingBadges.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <p className="text-sm font-medium text-foreground">Grant Badge</p>
              <select value={selectedBadgeId} onChange={e => setSelectedBadgeId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm">
                <option value="">Select badge...</option>
                {existingBadges.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <input value={badgeTargetUsername} onChange={e => setBadgeTargetUsername(e.target.value)} placeholder="Username to grant to" className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground outline-none text-sm" />
              <button onClick={grantBadge} disabled={grantLoading || !selectedBadgeId || !badgeTargetUsername} className="w-full py-2 bg-accent text-accent-foreground rounded-lg font-medium text-sm disabled:opacity-50">
                {grantLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🏅 Grant Badge'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
