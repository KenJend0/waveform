'use client';

import { useMemo } from 'react';
import type { StatsEntry } from '@/app/actions/profile-stats';

type Props = {
  entries: StatsEntry[];
};

type ArtistStat = {
  id: string;
  name: string;
  count: number;
  firstListen: Date;
};

export default function ProfileStatsAnchors({ entries }: Props) {
  const { anchors, eclairs, fideliteScore, totalArtists } = useMemo(() => {
    const artistMap = new Map<string, ArtistStat>();
    for (const e of entries) {
      if (!e.artist_id) continue;
      const existing = artistMap.get(e.artist_id);
      const date = new Date(e.listened_at);
      if (existing) {
        existing.count++;
        if (date < existing.firstListen) existing.firstListen = date;
      } else {
        artistMap.set(e.artist_id, { id: e.artist_id, name: e.artist_name, count: 1, firstListen: date });
      }
    }

    const all = [...artistMap.values()];
    const total = all.length;

    const anc = all
      .filter((a) => a.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const ecl = all
      .filter((a) => a.count <= 2 && a.firstListen >= ninetyDaysAgo)
      .sort((a, b) => b.firstListen.getTime() - a.firstListen.getTime())
      .slice(0, 8);

    const score = total > 0 ? Math.round((anc.length / total) * 100) : 0;

    return { anchors: anc, eclairs: ecl, fideliteScore: score, totalArtists: total };
  }, [entries]);

  if (totalArtists < 3) {
    return (
      <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
        <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
          Tes <em className="italic text-accent-deep">ancres</em> & éclairs
        </h3>
        <p className="text-meta text-text-tertiary py-6 text-center">
          Pas encore assez d&apos;artistes dans ton journal.
        </p>
      </div>
    );
  }

  const fideliteLabel =
    fideliteScore >= 60
      ? 'plutôt loyal'
      : fideliteScore >= 30
      ? 'entre les deux'
      : 'plutôt explorateur';

  return (
    <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
      <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
        Tes <em className="italic text-accent-deep">ancres</em> & éclairs
      </h3>
      <p className="text-label text-text-tertiary mb-5">
        Fidélité vs découverte — tu es <span className="text-accent-deep">{fideliteLabel}</span>
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Ancres */}
        <div>
          <p className="text-label uppercase tracking-[0.12em] text-text-tertiary mb-2.5">
            Ancres
          </p>
          {anchors.length === 0 ? (
            <p className="text-meta text-text-tertiary">Pas encore d&apos;ancres.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {anchors.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 bg-background rounded-[6px] px-2.5 py-1.5 border border-border"
                >
                  <span className="text-meta text-text-primary truncate">{a.name}</span>
                  <span className="text-label text-text-tertiary shrink-0">{a.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Éclairs */}
        <div>
          <p className="text-label uppercase tracking-[0.12em] text-text-tertiary mb-2.5">
            Éclairs récents
          </p>
          {eclairs.length === 0 ? (
            <p className="text-meta text-text-tertiary">Aucune nouvelle découverte ce trimestre.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {eclairs.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 bg-background rounded-[6px] px-2.5 py-1.5 border border-border"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-deep shrink-0" />
                  <span className="text-meta text-text-primary truncate">{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
