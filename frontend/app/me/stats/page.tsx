import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/server';
import { getUserStatsData } from '@/app/actions/profile-stats';
import ProfileStatsPage from '@/components/profile/stats/ProfileStatsPage';
import BackButton from '@/components/ui/BackButton';

export const revalidate = 0;

export default async function MeStatsPage() {
  const user = await getAuthUser();
  if (!user) redirect('/');

  const statsData = await getUserStatsData(user.id);

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6 pb-28 pt-6">
      <div className="mb-6">
        <BackButton />
        <h1 className="font-display text-[28px] text-text-warm mt-4 leading-none">
          Mes <em className="italic text-accent-deep">stats</em>
        </h1>
      </div>
      <ProfileStatsPage data={statsData} />
    </div>
  );
}
