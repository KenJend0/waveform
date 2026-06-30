/**
 * Supprime les avatars orphelins du bucket Storage "avatars" — fichiers
 * nommés `${userId}.jpg` dont le profil correspondant n'existe plus.
 *
 * Nécessaire car la suppression d'un compte ne nettoie l'avatar que côté
 * application (deleteAccount() dans app/actions/profile.ts), uniquement
 * quand l'utilisateur supprime lui-même son compte depuis Settings. Une
 * suppression depuis le dashboard Supabase Auth (ou via l'API Admin
 * directement) contourne ce code et laisse l'avatar orphelin.
 *
 * Un trigger SQL direct sur storage.objects a été tenté et rejeté :
 * Supabase bloque toute suppression SQL directe sur cette table
 * (storage.protect_delete()), même depuis une fonction SECURITY DEFINER —
 * il faut obligatoirement passer par la Storage API, d'où ce script.
 *
 * Usage (depuis frontend/) :
 *   node --env-file=.env.local scripts/cleanup-orphaned-avatars.mjs            (dry-run, défaut)
 *   node --env-file=.env.local scripts/cleanup-orphaned-avatars.mjs --apply    (supprime pour de vrai)
 */

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function listAllAvatarFiles() {
  const PAGE_SIZE = 1000;
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from('avatars')
      .list('', { limit: PAGE_SIZE, offset });
    if (error) throw new Error(`list avatars failed: ${error.message}`);
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

async function listAllProfileIds() {
  const PAGE_SIZE = 1000;
  const ids = new Set();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetch profiles failed: ${error.message}`);
    data.forEach((p) => ids.add(p.id));
    if (data.length < PAGE_SIZE) break;
  }
  return ids;
}

async function main() {
  console.log(APPLY ? 'APPLY — suppression réelle' : 'DRY-RUN — aucune suppression, --apply pour exécuter');

  const [files, profileIds] = await Promise.all([listAllAvatarFiles(), listAllProfileIds()]);
  console.log(`${files.length} fichier(s) dans le bucket "avatars", ${profileIds.size} profil(s) actif(s)`);

  const orphaned = files.filter((f) => {
    const userId = f.name.replace(/\.jpg$/, '');
    return !profileIds.has(userId);
  });

  if (orphaned.length === 0) {
    console.log('✓ aucun avatar orphelin');
    return;
  }

  console.log(`${orphaned.length} avatar(s) orphelin(s) : ${orphaned.map((f) => f.name).join(', ')}`);

  if (!APPLY) {
    console.log('\nDry-run terminé. Re-lancer avec --apply pour supprimer.');
    return;
  }

  const { error } = await supabase.storage.from('avatars').remove(orphaned.map((f) => f.name));
  if (error) {
    console.error(`✗ suppression échouée: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${orphaned.length} avatar(s) orphelin(s) supprimé(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
