'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL et anon key requis côté client');
}

/**
 * Client Supabase côté navigateur (browser).
 * - Authentification avec localStorage
 * - Accès aux données publiques et privées selon RLS
 * - À utiliser uniquement dans les composants clients
 */
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);
