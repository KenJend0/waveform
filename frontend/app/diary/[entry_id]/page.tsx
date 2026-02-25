import { notFound } from 'next/navigation';
import { getDiaryEntry } from '@/app/actions/diary';
import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';
import DiaryEntryClient from './DiaryEntryClient';

interface DiaryEntryPageProps {
  params: Promise<{ entry_id: string }>;
}

export async function generateMetadata({ params }: any) {
  const resolvedParams = params && typeof params.then === 'function' ? await params : params;
  const { entry_id } = resolvedParams;
  const supabase = await createSupabaseServer();

  const { data: entry } = await supabase
    .from('diary_entries')
    .select('review_title, review_body, rating, is_public, user_id, album_id')
    .eq('id', entry_id)
    .maybeSingle();

  if (!entry || !entry.is_public) return { title: 'Écoute' };

  const [{ data: album }, { data: profile }] = await Promise.all([
    supabase.from('albums').select('title, cover_url, artist_id').eq('id', entry.album_id).maybeSingle(),
    supabase.from('profiles').select('username, display_name').eq('id', entry.user_id).maybeSingle(),
  ]);

  let artistName = '';
  if (album?.artist_id) {
    const { data: artist } = await supabase.from('artists').select('name').eq('id', album.artist_id).maybeSingle();
    artistName = artist?.name || '';
  }

  const albumTitle = album?.title || 'Album inconnu';
  const authorName = profile?.display_name || (profile?.username ? `@${profile.username}` : 'Quelqu\'un');
  const rating = entry.rating ? `${entry.rating}/10` : null;

  const title = entry.review_title || `${albumTitle}${artistName ? ` — ${artistName}` : ''}`;
  const description = entry.review_body
    ? entry.review_body.slice(0, 160)
    : `${authorName} a écouté ${albumTitle}${artistName ? ` de ${artistName}` : ''}${rating ? ` — ${rating}` : ''}.`;

  return {
    title,
    description,
    openGraph: {
      images: album?.cover_url ? [{ url: album.cover_url }] : [],
    },
  };
}

export default async function DiaryEntryPage({ params }: DiaryEntryPageProps) {
  const { entry_id } = await params;

  const result = await getDiaryEntry(entry_id);

  if (!result.success) {
    notFound();
  }

  // Get current user to pass to client for auth checks
  const currentUser = await getAuthUser();

  return <DiaryEntryClient entry={result.data} currentUser={currentUser} />;
}
