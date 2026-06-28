"use client";

import { useRatingFilter } from "./RatingFilterContext";

type Props = {
  ratings: (number | null)[];
  label?: string;
};

export default function RatingDistribution({ ratings, label = "Mes" }: Props) {
  const { selectedRating, selectRating } = useRatingFilter();
  const selected = selectedRating;

  const counts = Array(10).fill(0) as number[];
  let total = 0;

  ratings.forEach((r) => {
    if (r !== null && r >= 1 && r <= 10) {
      counts[Math.round(r) - 1]++;
      total++;
    }
  });

  if (total === 0) return null;

  const max = Math.max(...counts);
  const peakIdx = counts.indexOf(max);

  const handleBarClick = (i: number) => {
    if (counts[i] === 0) return;
    selectRating(selected === i ? null : i, counts[i]);
  };

  return (
    <div className="relative bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-3 overflow-hidden">
      <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-accent opacity-40 rounded-r-full" />

      <div className="flex items-baseline justify-between mb-3 pl-2">
        <h4 className="font-display font-normal text-[18px] text-text-warm leading-none">
          {label} <em className="italic text-accent-deep">notes</em>
        </h4>
        <span className="text-label text-text-tertiary">
          {selected !== null && counts[selected] > 0
            ? <><em className="font-display italic text-accent-deep not-italic">{selected + 1}/10</em> · {counts[selected]} écoute{counts[selected] > 1 ? 's' : ''}</>
            : <>{total} écoute{total > 1 ? 's' : ''}</>
          }
        </span>
      </div>

      <div className="flex items-end gap-[4px] pl-2 pr-1" style={{ height: '64px' }}>
        {counts.map((count, i) => {
          const heightPct = max > 0 ? (count / max) * 100 : 0;
          const isPeak = i === peakIdx && count > 0;
          const isSelected = selected === i;
          return (
            <div
              key={i}
              className={`flex-1 flex flex-col items-center justify-end h-full gap-1 relative ${count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => handleBarClick(i)}
            >
              <div
                className={`w-full rounded-[3px] transition-all duration-200 ${isSelected ? 'bg-accent-deep' : 'bg-accent'}`}
                style={{
                  height: count > 0 ? `${Math.max(heightPct, 6)}%` : '0',
                  opacity: count === 0
                    ? 0
                    : selected !== null
                      ? isSelected ? 1 : 0.12
                      : 0.25 + (heightPct / 100) * 0.75,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-1.5 pl-2 pr-1">
        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
          <span key={n} className={`flex-1 text-center text-[8px] transition-colors duration-150 ${selected === n - 1 ? 'text-accent-deep font-medium' : 'text-text-disabled'}`}>{n}</span>
        ))}
      </div>
    </div>
  );
}
