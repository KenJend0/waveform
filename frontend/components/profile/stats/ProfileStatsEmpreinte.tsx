'use client';

import { buildFamilyWeights } from '@/lib/stats-dimensions';
import type { StatsGenreEntry } from '@/app/actions/profile-stats';

type Props = {
  genreData: StatsGenreEntry[];
};

const CX = 180;
const CY = 170;
const R = 120;
const LABEL_R = 152;

function polarPoint(axisIndex: number, n: number, value: number) {
  const angle = ((axisIndex * (360 / n)) - 90) * (Math.PI / 180);
  return {
    x: CX + value * R * Math.cos(angle),
    y: CY + value * R * Math.sin(angle),
  };
}

function gridPolygonPath(n: number, value: number) {
  return Array.from({ length: n }, (_, i) => {
    const p = polarPoint(i, n, value);
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join(' ') + ' Z';
}

// Split "Folk / Acoustique" into ["Folk", "Acoustique"]
function splitLabel(label: string): [string, string | null] {
  const idx = label.indexOf(' / ');
  if (idx !== -1) return [label.slice(0, idx), label.slice(idx + 3)];
  return [label, null];
}

export default function ProfileStatsEmpreinte({ genreData }: Props) {
  const families = buildFamilyWeights(genreData).slice(0, 6);
  const n = families.length;

  const hasData = n >= 3;

  // Normalize weights to 0–1
  const maxWeight = hasData ? Math.max(...families.map((f) => f.weight)) : 1;
  const scores = families.map((f) => f.weight / maxWeight);

  const polygonPoints = families
    .map((_, i) => {
      const p = polarPoint(i, n, scores[i]);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
      <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
        Ton <em className="italic text-accent-deep">empreinte</em>
      </h3>
      <p className="text-label text-text-tertiary mb-4">
        Tes genres dominants, pondérés par le nombre d&apos;albums
      </p>

      {!hasData ? (
        <p className="text-meta text-text-tertiary py-6 text-center">
          Pas assez de données genre pour l&apos;instant.
        </p>
      ) : (
        <svg viewBox="-20 -20 400 380" className="w-full block">
          {/* Grid polygons */}
          {[0.25, 0.5, 0.75, 1].map((v) => (
            <path
              key={v}
              d={gridPolygonPath(n, v)}
              fill="none"
              stroke="#D4C9B0"
              strokeWidth={v === 1 ? 1.5 : 1}
              strokeDasharray={v < 1 ? '4 4' : undefined}
              opacity={0.55}
            />
          ))}

          {/* Axis lines center → outer vertex */}
          {families.map((_, i) => {
            const outer = polarPoint(i, n, 1);
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={outer.x.toFixed(2)}
                y2={outer.y.toFixed(2)}
                stroke="#D4C9B0"
                strokeWidth={1}
                opacity={0.45}
              />
            );
          })}

          {/* User polygon */}
          <polygon
            points={polygonPoints}
            fill="#B08D57"
            fillOpacity={0.2}
            stroke="#8B6914"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* Score dots on each axis */}
          {families.map((_, i) => {
            const p = polarPoint(i, n, scores[i]);
            return (
              <circle
                key={i}
                cx={p.x.toFixed(2)}
                cy={p.y.toFixed(2)}
                r={4.5}
                fill="#8B6914"
                stroke="#FAF8F4"
                strokeWidth={1.5}
              />
            );
          })}

          {/* Labels — centered exactly on axis extension */}
          {families.map((f, i) => {
            const p = polarPoint(i, n, LABEL_R / R);
            const [line1, line2] = splitLabel(f.label);
            return (
              <text
                key={f.slug}
                x={p.x.toFixed(2)}
                y={p.y.toFixed(2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="Inter, sans-serif"
                fill="#6B5D45"
                fontWeight={500}
              >
                {line2 ? (
                  <>
                    <tspan x={p.x.toFixed(2)} dy="-0.65em">{line1}</tspan>
                    <tspan x={p.x.toFixed(2)} dy="1.3em">{line2}</tspan>
                  </>
                ) : (
                  line1
                )}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
