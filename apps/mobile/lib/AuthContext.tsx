import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { usePathname } from 'expo-router';
import { supabase } from './supabase';
import { hasUnseenActivity } from './feed';
import { ensureProfile, type Profile } from './profile';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  unseenActivity: boolean;
  refreshUnseenActivity: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unseenActivity, setUnseenActivity] = useState(false);

  const refreshUnseenActivity = useCallback(async () => {
    try {
      setUnseenActivity(await hasUnseenActivity());
    } catch {
      setUnseenActivity(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        refreshUnseenActivity().catch(() => setUnseenActivity(false));
        ensureProfile().then(setProfile).catch(() => setProfile(null));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        refreshUnseenActivity().catch(() => setUnseenActivity(false));
        ensureProfile().then(setProfile).catch(() => setProfile(null));
      } else {
        setUnseenActivity(false);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rafraîchit le badge à chaque changement d'onglet — miroir de AuthContext (web), qui le
  // refait à chaque navigation. Exception : l'écran /feed gère déjà son propre marquage +
  // rafraîchissement (voir markActivitySeen dans app/(tabs)/feed/index.tsx) ; le refaire ici
  // créerait une course entre les deux appels qui peut réafficher le badge juste après qu'il
  // ait été effacé.
  useEffect(() => {
    if (!session?.user || pathname === '/feed') return;
    refreshUnseenActivity().catch(() => setUnseenActivity(false));
  }, [pathname, session?.user, refreshUnseenActivity]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUnseenActivity(false);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, unseenActivity, refreshUnseenActivity, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
}
