'use server';

import { getAuthUser, createSupabaseAdmin } from '@/lib/supabase/server';
import { parseRymCsv } from '@/lib/rymCsv';
import type { RawExternalItem } from '@/lib/externalImport';
import { triggerExternalImportsWorkflow } from '@/lib/githubDispatch';

const COOLDOWN_HOURS = 24;
const DEFAULT_ROWS = 500;
const MAX_RYM_CSV_BYTES = 3 * 1024 * 1024;
// Garde-fou contre un upload pathologique — pas une limite "normale" : les vrais gros
// catalogues (700-1000+ écoutes) doivent pouvoir tout importer via le champ côté UI.
const ABSOLUTE_MAX_ROWS = 2000;

/** Parse le fichier sans rien créer — permet à l'UI d'afficher le nombre réel d'écoutes avant de lancer l'import. */
export async function countRymCsvRows(fileContent: string) {
  const user = await getAuthUser();
  if (!user) return { success: false as const, error: 'Not authenticated' };

  if (Buffer.byteLength(fileContent, 'utf8') > MAX_RYM_CSV_BYTES) {
    return { success: false as const, error: 'Fichier CSV trop lourd — taille max 3MB.' };
  }

  try {
    const parsed = parseRymCsv(fileContent);
    return { success: true as const, total: parsed.length, defaultLimit: Math.min(parsed.length, DEFAULT_ROWS), maxLimit: ABSOLUTE_MAX_ROWS };
  } catch {
    return { success: false as const, error: 'Fichier CSV invalide.' };
  }
}

export async function startRymImport(fileContent: string, fileName: string, requestedLimit?: number) {
  const user = await getAuthUser();
  if (!user) return { success: false as const, error: 'Not authenticated' };

  if (Buffer.byteLength(fileContent, 'utf8') > MAX_RYM_CSV_BYTES) {
    return { success: false as const, error: 'Fichier CSV trop lourd — taille max 3MB.' };
  }

  const admin = createSupabaseAdmin();

  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('external_imports')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'rym')
    .gte('created_at', cutoff);

  if ((count || 0) > 0) {
    return {
      success: false as const,
      error: `Tu as déjà lancé un import RYM dans les dernières ${COOLDOWN_HOURS}h. Réessaie plus tard.`,
    };
  }

  let parsed: RawExternalItem[];
  try {
    parsed = parseRymCsv(fileContent);
  } catch {
    return { success: false as const, error: 'Fichier CSV invalide.' };
  }

  if (parsed.length === 0) {
    return { success: false as const, error: "Aucun album reconnu dans ce fichier — vérifie que c'est bien un export RYM (Catalog)." };
  }

  const limit = Math.min(requestedLimit && requestedLimit > 0 ? requestedLimit : DEFAULT_ROWS, ABSOLUTE_MAX_ROWS);
  const items = parsed.slice(0, limit);

  const { data: importRow, error } = await admin
    .from('external_imports')
    .insert({
      user_id: user.id,
      source: 'rym',
      source_label: fileName,
      status: 'matching',
      raw_items: items,
      total_items: items.length,
    })
    .select('id')
    .single();

  if (error || !importRow) {
    return { success: false as const, error: "Erreur lors de la création de l'import" };
  }

  await triggerExternalImportsWorkflow();

  return { success: true as const, importId: importRow.id, total: items.length };
}
