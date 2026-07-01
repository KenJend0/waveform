import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Client Supabase côté serveur (Server Actions + Route Handlers).
 * - Authentification par cookies (gérée automatiquement par Supabase)
 * - Accès à auth.getUser() et aux données via RLS
 * - Ne JAMAIS utiliser service_role côté client
 * - Service role réservé à app/actions ou fonctions strictement serveur
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Les cookies ne peuvent pas être définis lors de la fonction de lecture
          }
        },
      },
    }
  );
}

/**
 * Client Supabase anonyme — sans cookies, sans session utilisateur.
 * À utiliser pour fetcher des données publiques dans des pages ISR/statiques.
 * N'appelle PAS cookies() → ne force pas le rendu dynamique.
 */
export function createSupabaseAnon() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Client Supabase admin (service role) - server only.
 * A utiliser uniquement dans les server actions pour bypass RLS.
 */
export function createSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY is not set');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY
  );
}

/**
 * Récupère l'utilisateur authentifié (côté serveur).
 * Utilise les cookies pour la session.
 * Retourne null si le token est invalide ou expiré (ne lance pas d'exception).
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    // Token invalide, expiré ou absent - retourner null plutôt que crasher
    console.warn('getAuthUser: session invalide -', error.message);
    return null;
  }

  return user;
}

/**
 * Détermine si un utilisateur connecté doit être redirigé vers /onboarding
 * (pseudo jamais choisi — encore sur le défaut généré à l'inscription).
 */
export async function userNeedsOnboarding(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServer();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  const defaultUsername = userId.substring(0, 8);
  return !profile || !profile.username || profile.username === defaultUsername;
}
