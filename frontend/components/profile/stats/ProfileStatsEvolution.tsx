'use client';

import { useMemo } from 'react';
import type { StatsEntry } from '@/app/actions/profile-stats';

type Props = {
  entries: StatsEntry[];
};

type Semester = {
  label: string;
  avg: number;
  count: number;
};

export default function ProfileStatsEvolution({ entries }: Props) {
  const semesters = useMemo<Semester[]>(() => {
    const byDecade: Record<string, number[]> = {};
    for (const e of entries) {
      if (e.rating == null || e.rating === 0) continue;
      const year = new Date(e.listened_at).getFullYear();
      const decade = `${Math.floor(year / 10) * 10}`;
      byDecade[decade] = [...(byDecade[decade] ?? []), e.rating];
    }
    return Object.entries(byDecade)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([decade, ratings]) => ({
        label: `${decade}s`,
        avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
        count: ratings.length,
      }));
  }, [entries]);

  if (semesters.length < 2) {
    return (
      <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
        <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
          L&apos;évolution de <em className="italic text-accent-deep">ton oreille</em>
        </h3>
        <p className="text-meta text-text-tertiary py-6 text-center">
          Reviens dans quelques mois pour voir ton évolution.
        </p>
      </div>
    );
  }

  const maxAvg = Math.max(...semesters.map((s) => s.avg));

  return (
    <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
      <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
        L&apos;évolution de <em className="italic text-accent-deep">ton oreille</em>
      </h3>
      <p className="text-label text-text-tertiary mb-5">Note moyenne par décennie</p>

      <div className="flex flex-col gap-2.5">
        {semesters.map((s) => {
          const widthPct = (s.avg / 10) * 100;
          const relWidthPct = (s.avg / maxAvg) * 100;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="text-[10px] text-text-tertiary shrink-0 w-12 text-right font-medium">
                {s.label}
              </span>
              <div className="flex-1 h-[10px] bg-background-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${relWidthPct}%`, opacity: 0.3 + (relWidthPct / 100) * 0.7 }}
                />
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium text-accent-deep">
                  {s.avg.toFixed(1)}
                </span>
                <span className="text-[9px] text-text-disabled ml-1">
                  /{s.count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
