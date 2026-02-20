import { notFound } from 'next/navigation';
import { getDiaryEntry } from '@/app/actions/diary';
import { getAuthUser } from '@/lib/supabase/server';
import DiaryEntryClient from './DiaryEntryClient';

interface DiaryEntryPageProps {
  params: Promise<{ entry_id: string }>;
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
