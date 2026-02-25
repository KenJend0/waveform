'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase/client';
import { AuthApiError, type User as SupabaseUser } from '@supabase/supabase-js';
import { ensureProfile } from '@/app/actions/profile';
import { showToast } from '@/components/Toast';

type AuthContextType = {
  user: SupabaseUser | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
        } else if (user) {
          setUser(user);
          // 🎯 NEW: Ensure profile exists (non-blocking)
          ensureUserProfile(user).catch(err => console.error('Profile sync error:', err));
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
        } else {
          console.error('Erreur lors de la vérification de la session:', error);
          try { showToast("Erreur de session — vous avez été déconnecté", "error"); } catch {}
          setUser(null);
          setProfile(null);
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
          // 🎯 NEW: Ensure profile on auth state change (non-blocking)
          ensureUserProfile(session.user).catch(err => console.error('Profile sync error:', err));
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) {
          setUser(null);
          setProfile(null);
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
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
