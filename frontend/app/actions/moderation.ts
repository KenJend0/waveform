'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { checkActionRateLimit } from '@/lib/serverRateLimit';

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export type ReportReason = 'inappropriate' | 'spam' | 'harassment';

/**
 * Report a diary entry or comment.
 * Silently deduplicates: if the user already reported this content, returns success.
 */
export async function reportContent(
  contentType: 'diary_entry' | 'diary_comment' | 'track_diary_entry' | 'track_diary_comment',
  contentId: string,
  reason: ReportReason = 'inappropriate'
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const rlError = await checkActionRateLimit(user.id, 'report');
  if (rlError) return { success: false, error: rlError };

  const supabase = await createSupabaseServer();

  const { error } = await (supabase as any).from('content_reports').insert({
    reporter_id: user.id,
    content_type: contentType,
    content_id: contentId,
    reason,
  });

  if (error) {
    // Unique constraint violation = already reported, treat as success
    if (error.code === '23505') return { success: true };
    console.error('reportContent error:', error);
    return { success: false, error: 'An error occurred' };
  }

  return { success: true };
}

/**
 * Admin only: delete reported content and its associated reports.
 */
export async function adminDeleteContent(
  contentType: 'diary_entry' | 'diary_comment' | 'track_diary_entry' | 'track_diary_comment',
  contentId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return { success: false, error: 'Forbidden' };

  const supabase = createSupabaseAdmin();

  const tableMap: Record<string, string> = {
    diary_entry: 'diary_entries',
    diary_comment: 'diary_comments',
    track_diary_entry: 'track_diary_entries',
    track_diary_comment: 'track_diary_comments',
  };
  const table = tableMap[contentType];
  if (!table) return { success: false, error: 'Type inconnu' };
  const { error } = await supabase.from(table as any).delete().eq('id', contentId);

  if (error) {
    console.error('adminDeleteContent error:', error);
    return { success: false, error: 'An error occurred' };
  }

  // Clean up the reports for this content
  await (supabase as any)
    .from('content_reports')
    .delete()
    .eq('content_type', contentType)
    .eq('content_id', contentId);

  return { success: true };
}

const HF_LABELS: Record<string, string> = {
  OK:  'Légitime',
  S:   'Contenu sexuel',
  H:   'Harcèlement',
  V:   'Violence',
  HR:  'Haine / racisme',
  SH:  'Automutilation',
  S3:  'Contenu sexuel (mineurs)',
  H2:  'Menace',
  V2:  'Violence graphique',
};

export type ModerationResult = {
  label: string;      // raw label e.g. "OK", "H"
  labelFr: string;    // French label
  score: number;      // 0-1
  safe: boolean;      // true if label === "OK"
};

/**
 * Admin only: analyze reported content with HuggingFace KoalaAI/Text-Moderation.
 * Requires HUGGINGFACE_API_TOKEN in env.
 */
export async function adminAnalyzeContent(
  contentType: 'diary_entry' | 'diary_comment',
  contentId: string
): Promise<{ success: boolean; result?: ModerationResult; error?: string }> {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return { success: false, error: 'Forbidden' };

  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) return { success: false, error: 'HUGGINGFACE_API_TOKEN manquant' };

  // Fetch the content text
  const supabase = createSupabaseAdmin();
  let text: string | null = null;

  if (contentType === 'diary_entry') {
    const { data } = await supabase
      .from('diary_entries')
      .select('review_title, review_body')
      .eq('id', contentId)
      .maybeSingle();
    text = [data?.review_title, data?.review_body].filter(Boolean).join(' — ') || null;
  } else {
    const { data } = await supabase
      .from('diary_comments')
      .select('body')
      .eq('id', contentId)
      .maybeSingle();
    text = data?.body ?? null;
  }

  if (!text) return { success: false, error: 'Contenu introuvable ou sans texte' };

  // Call HuggingFace Inference API
  const res = await fetch('https://router.huggingface.co/hf-inference/models/KoalaAI/Text-Moderation', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('HF moderation error:', err);
    return { success: false, error: 'Erreur API HuggingFace' };
  }

  // Response: [[{label, score}, ...]] — outer array = batch
  const data: Array<Array<{ label: string; score: number }>> = await res.json();
  const scores = data[0] ?? [];
  const top = scores.reduce((a, b) => (b.score > a.score ? b : a), scores[0]);

  return {
    success: true,
    result: {
      label: top.label,
      labelFr: HF_LABELS[top.label] ?? top.label,
      score: top.score,
      safe: top.label === 'OK',
    },
  };
}

/**
 * Admin only: dismiss a report without deleting the content.
 */
export async function adminDismissReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return { success: false, error: 'Forbidden' };

  const supabase = createSupabaseAdmin();
  const { error } = await (supabase as any).from('content_reports').delete().eq('id', reportId);

  if (error) {
    console.error('adminDismissReport error:', error);
    return { success: false, error: 'An error occurred' };
  }

  return { success: true };
}
