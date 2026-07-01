'use client';

import { useMemo, useState } from 'react';
import type { StatsEntry } from '@/app/actions/profile-stats';

type Props = {
  entries: StatsEntry[];
};

type Dot = {
  x: number;
  y: number;
  rating: number;
  album_title: string;
  artist_name: string;
  listened_at: string;
};

const W = 340;
const H = 200;
const PAD = { top: 16, right: 20, bottom: 32, left: 32 };
const DOT_R = 3;

function ratingColor(r: number): string {
  if (r <= 3) return '#C86C6C';
  if (r <= 5) return '#C8A84B';
  if (r <= 7) return '#7BA67A';
  return '#3D7A3B';
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProfileStatsTrajectoire({ entries }: Props) {
  const [tooltip, setTooltip] = useState<Dot | null>(null);

  const { dots, xLabels } = useMemo(() => {
    const rated = entries.filter((e) => e.rating !== null && e.rating > 0);
    if (rated.length === 0) return { dots: [], xLabels: [] };

    const sorted = [...rated].sort(
      (a, b) => new Date(a.listened_at).getTime() - new Date(b.listened_at).getTime()
    );

    const minTime = new Date(sorted[0].listened_at).getTime();
    const maxTime = new Date(sorted[sorted.length - 1].listened_at).getTime();
    const timeSpan = maxTime - minTime || 1;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    // Small deterministic horizontal jitter to separate dots on the same date
    const ds: Dot[] = sorted.map((e, i) => {
      const t = new Date(e.listened_at).getTime();
      const jitter = ((i % 5) - 2) * 0.8; // −1.6 to +1.6 px, no Math.random
      return {
        x: PAD.left + ((t - minTime) / timeSpan) * plotW + jitter,
        y: PAD.top + plotH - (e.rating! / 10) * plotH,
        rating: e.rating!,
        album_title: e.album_title,
        artist_name: e.artist_name,
        listened_at: e.listened_at,
      };
    });

    // X labels: decades
    const minYear = new Date(minTime).getFullYear();
    const maxYear = new Date(maxTime).getFullYear();
    const firstDecade = Math.floor(minYear / 10) * 10;
    const decadeLabels: { decade: number; x: number }[] = [];
    for (let d = firstDecade; d <= maxYear + 10; d += 10) {
      const t = new Date(`${d}-01-01`).getTime();
      const x = PAD.left + ((t - minTime) / timeSpan) * plotW;
      if (x >= PAD.left - 4 && x <= W - PAD.right + 4) {
        decadeLabels.push({ decade: d, x });
      }
    }

    return { dots: ds, xLabels: decadeLabels };
  }, [entries]);

  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;

  if (dots.length < 3) {
    return (
      <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
        <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
          Ta <em className="italic text-accent-deep">trajectoire</em>
        </h3>
        <p className="text-meta text-text-tertiary py-6 text-center">
          Pas encore assez d&apos;écoutes notées.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
      <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
        Ta <em className="italic text-accent-deep">trajectoire</em>
      </h3>
      <p className="text-label text-text-tertiary mb-3">
        Chaque point = un album noté, dans le temps
      </p>

      <div className="relative overflow-hidden" onMouseLeave={() => setTooltip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'hidden' }}>
          <defs>
            {/* Clip with DOT_R margin so edge dots aren't cut */}
            <clipPath id="traj-clip">
              <rect
                x={PAD.left - DOT_R - 2}
                y={PAD.top - DOT_R - 2}
                width={plotW + (DOT_R + 2) * 2}
                height={plotH + (DOT_R + 2) * 2}
              />
            </clipPath>
          </defs>

          {/* Y grid lines + labels */}
          {[0, 2, 4, 6, 8, 10].map((v) => {
            const y = PAD.top + plotH - (v / 10) * plotH;
            return (
              <g key={v}>
                <line
                  x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="#D4C9B0" strokeWidth={1} strokeDasharray="3 5"
                />
                <text
                  x={PAD.left - 5} y={y} dy={4}
                  textAnchor="end" fontSize={8} fill="#A8956D" fontFamily="Inter, sans-serif"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* Dots */}
          <g clipPath="url(#traj-clip)">
            {dots.map((d, i) => (
              <circle
                key={i}
                cx={d.x} cy={d.y} r={DOT_R}
                fill={ratingColor(d.rating)}
                fillOpacity={0.72}
                className="cursor-pointer"
                onMouseEnter={() => setTooltip(d)}
              />
            ))}
          </g>

          {/* X axis decade labels */}
          {xLabels.map(({ decade, x }) => (
            <text
              key={decade} x={x} y={H - PAD.bottom + 14}
              textAnchor="middle" fontSize={8} fill="#A8956D" fontFamily="Inter, sans-serif"
            >
              {decade}s
            </text>
          ))}
        </svg>

        {tooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 pointer-events-none z-10">
            <div className="bg-background border border-border rounded-[8px] px-3 py-2 shadow-sm whitespace-nowrap">
              <p className="text-label font-medium text-text-primary truncate max-w-[200px]">
                {tooltip.album_title}
              </p>
              <p className="text-[10px] text-text-tertiary">{tooltip.artist_name}</p>
              <p className="text-[10px] text-accent-deep font-medium">
                {tooltip.rating}/10 · {formatDate(tooltip.listened_at)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
