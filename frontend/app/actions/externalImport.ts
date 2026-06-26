'use server';

import { getAuthUser, createSupabaseAdmin } from '@/lib/supabase/server';
import { progressOfImportRow } from '@/lib/externalImport';

/**
 * Le traitement des imports (Last.fm/RYM) se fait exclusivement côté worker
 * GitHub Actions (scripts/process-external-imports.mjs) — plus de polling
 * client. Ça évite la course entre deux écrivains concurrents sur la même
 * ligne `external_imports` (l'onglet ouvert et le cron pouvaient auparavant
 * s'écraser mutuellement la progression). /settings se contente d'afficher
 * un message tant qu'un import est en cours.
 */

/** Imports en cours (pending/matching) de l'utilisateur — permet à /settings d'afficher le message "import en cours" au montage. */
export async function getActiveImports() {
  const user = await getAuthUser();
  if (!user) return { success: false as const, error: 'Not authenticated' };

  const admin = createSupabaseAdmin() as any;
  const { data } = await admin
    .from('external_imports')
    .select('id, source, status, total_items, processed_count, matched_count, skipped_count, failed_count, list_id')
    .eq('user_id', user.id)
    .in('status', ['pending', 'matching'])
    .order('created_at', { ascending: false });

  interface ActiveImportRow {
    id: string;
    source: 'lastfm' | 'rym';
    status: string;
    total_items: number;
    processed_count: number;
    matched_count: number;
    skipped_count: number;
    failed_count: number;
    list_id: string | null;
  }

  return {
    success: true as const,
    imports: ((data || []) as ActiveImportRow[]).map((row) => ({
      id: row.id,
      source: row.source,
      ...progressOfImportRow(row),
    })),
  };
}
