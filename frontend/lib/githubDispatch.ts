import 'server-only';

const REPO_OWNER = 'KenJend0';
const REPO_NAME = 'waveform';
const WORKFLOW_FILE = 'process-external-imports.yml';

/**
 * Déclenche immédiatement le worker GitHub Actions qui traite les imports Last.fm/RYM,
 * au lieu d'attendre le prochain tick du cron (jusqu'à 1h, cf. concurrency + schedule
 * réduit dans process-external-imports.yml). Best-effort : si l'appel échoue (token
 * absent/expiré, panne GitHub), l'import reste en file et sera quand même repris par
 * le cron de secours — ne doit jamais faire échouer le flux d'import côté utilisateur.
 */
export async function triggerExternalImportsWorkflow(): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return;

  try {
    await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: AbortSignal.timeout(5000),
      },
    );
  } catch (err) {
    console.warn('[githubDispatch] échec du déclenchement workflow_dispatch:', (err as Error)?.message ?? err);
  }
}
