import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  pulse_count: number;
  created_at: string;
}

interface BanInfo {
  reason: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  banInfo: BanInfo | null;
  isModerator: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profile: null, loading: true, isAdmin: false, isBanned: false, banInfo: null, isModerator: false, signOut: async () => {}, refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [isModerator, setIsModerator] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
  };

  const checkBanStatus = async (userId: string) => {
    const { data } = await supabase.from('bans').select('reason').eq('user_id', userId).is('unbanned_at', null).maybeSingle();
    if (data) {
      setIsBanned(true);
      setBanInfo({ reason: data.reason });
    } else {
      setIsBanned(false);
      setBanInfo(null);
    }
  };

  const checkModStatus = async (userId: string) => {
    const { data } = await supabase.from('beta_codes_redeemed').select('id').eq('user_id', userId).eq('code', 'pulse23moderation');
    setIsModerator((data && data.length > 0) || false);
  };

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
        checkBanStatus(session.user.id);
        checkModStatus(session.user.id);
      } else {
        setProfile(null);
        setIsBanned(false);
        setBanInfo(null);
        setIsModerator(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkBanStatus(session.user.id);
        checkModStatus(session.user.id);
      }
      setLoading(false);
    });
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsBanned(false);
    setBanInfo(null);
    setIsModerator(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      checkModStatus(user.id);
    }
  };

  const isAdmin = profile?.username === 'senwot';

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, isBanned, banInfo, isModerator, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
