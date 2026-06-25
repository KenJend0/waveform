'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from './supabase/client';
import { AuthApiError, type User as SupabaseUser } from '@supabase/supabase-js';
import { ensureProfile } from '@/app/actions/profile';
import { hasUnseenActivity } from '@/app/actions/feed';
import { showToast } from '@/components/Toast';

type AuthContextType = {
  user: SupabaseUser | null;
  profile: any | null;
  isAdmin: boolean;
  loading: boolean;
  unseenActivity: boolean;
  refreshUnseenActivity: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unseenActivity, setUnseenActivity] = useState(false);

  async function syncAdminStatus() {
    try {
      const response = await fetch('/api/me', { credentials: 'include' });
      if (!response.ok) {
        setIsAdmin(false);
        return;
      }

      const payload = await response.json();
      setIsAdmin(Boolean(payload?.user?.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  }

  async function refreshUnseenActivity() {
    try {
      setUnseenActivity(await hasUnseenActivity());
    } catch {
      setUnseenActivity(false);
    }
  }

  /**
   * Ensure profile exists for authenticated user
   */
  async function ensureUserProfile(authUser: SupabaseUser) {
    try {
      const result = await ensureProfile();

      if (result.ok) {
        setProfile(result.profile);
      } else {
        console.warn('Failed to ensure profile:', result.error);
      }
    } catch (err) {
      console.error('Error ensuring profile:', err);
      // Continue anyway - user is authenticated even if profile sync fails
    }
  }

  useEffect(() => {
    // Vérifier la session existante avec validation serveur
    const checkSession = async () => {
      try {
        // getUser() valide le token côté serveur Supabase (contrairement à getSession qui lit juste le localStorage)
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.warn('Session invalide, déconnexion:', error.message);
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        } else if (user) {
          setUser(user);
          syncAdminStatus().catch(() => setIsAdmin(false));
          refreshUnseenActivity().catch(() => setUnseenActivity(false));
          // 🎯 NEW: Ensure profile exists (non-blocking)
          ensureUserProfile(user).catch(err => console.error('Profile sync error:', err));
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setUnseenActivity(false);
        }
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        } else {
          console.error('Erreur lors de la vérification de la session:', error);
          try { showToast("Erreur de session — vous avez été déconnecté", "error"); } catch {}
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Écouter les changements de session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          setUser(session.user);
          syncAdminStatus().catch(() => setIsAdmin(false));
          refreshUnseenActivity().catch(() => setUnseenActivity(false));
          // 🎯 NEW: Ensure profile on auth state change (non-blocking)
          ensureUserProfile(session.user).catch(err => console.error('Profile sync error:', err));
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setUnseenActivity(false);
        }
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        } else {
          console.error('Erreur lors du changement d\'état de session:', error);
          try { showToast("Erreur de session", "error"); } catch {}
        }
      } finally {
        setLoading(false);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Le badge "non lu" ne se mettait à jour qu'aux évènements d'auth (rares,
  // ex. refresh de token) — on le rafraîchit aussi à chaque navigation pour
  // qu'il reste synchronisé avec l'activité réelle.
  // Exception : /feed gère déjà son propre marquage + rafraîchissement
  // après exposition de l'onglet "Pour moi" — le faire aussi ici créerait une course entre les
  // deux appels (l'un avec l'ancienne donnée, l'autre avec la nouvelle) qui
  // peut ré-afficher le badge juste après qu'il ait été effacé.
  useEffect(() => {
    if (!user || pathname === '/feed') return;
    refreshUnseenActivity().catch(() => setUnseenActivity(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setUnseenActivity(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, unseenActivity, refreshUnseenActivity, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
