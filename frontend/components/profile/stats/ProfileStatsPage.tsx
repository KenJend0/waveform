'use client';

import type { StatsData } from '@/app/actions/profile-stats';
import ProfileStatsEmpreinte from './ProfileStatsEmpreinte';
import ProfileStatsTrajectoire from './ProfileStatsTrajectoire';
import ProfileStatsAnchors from './ProfileStatsAnchors';
import ProfileStatsAnglesMorts from './ProfileStatsAnglesMorts';
import ProfileStatsEvolution from './ProfileStatsEvolution';

type Props = {
  data: StatsData;
};

export default function ProfileStatsPage({ data }: Props) {
  const { entries, genreData, anglesMorts } = data;

  if (entries.length < 10) {
    return (
      <div className="py-16 text-center">
        <p className="text-[32px] mb-3">🎧</p>
        <p className="text-meta text-text-secondary max-w-[260px] mx-auto">
          Reviens quand tu auras un peu plus d&apos;écoutes dans ton journal.
        </p>
        <p className="text-label text-text-tertiary mt-2">
          {entries.length}/10 entrées
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileStatsEmpreinte genreData={genreData} />
      <ProfileStatsTrajectoire entries={entries} />
      <ProfileStatsAnchors entries={entries} />
      <ProfileStatsAnglesMorts anglesMorts={anglesMorts} genreData={genreData} />
      <ProfileStatsEvolution entries={entries} />
    </div>
  );
}
