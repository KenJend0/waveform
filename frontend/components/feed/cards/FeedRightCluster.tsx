import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import { CoverImage } from '@/components/CoverImage';

interface FeedRightClusterProps {
  rating?: number | null;
  coverUrl?: string | null;
  coverHref?: string | null;
  coverAlt?: string;
  /** Stacked-card effect, used for "added to list" lines */
  stacked?: boolean;
}

/**
 * Right-hand cluster shared by every feed line with a musical target:
 * cover on top, rating dial stacked underneath it — keeps the cluster as
 * narrow as the cover itself, leaving more width for the text column.
 * The timestamp lives inline at the end of the line's text, not here.
 */
export function FeedRightCluster({ rating, coverUrl, coverHref, coverAlt = '', stacked = false }: FeedRightClusterProps) {
  const cover = coverUrl && (
    <div className={`relative w-11 h-11 rounded-cover-sm overflow-hidden bg-background-secondary flex-shrink-0 ${stacked ? 'shadow-cover' : ''}`}>
      {stacked && (
        <div className="absolute inset-0 rounded-cover-sm bg-background-tertiary rotate-6 translate-x-0.5 -translate-y-0.5 -z-10" />
      )}
      <CoverImage
        src={coverUrl}
        alt={coverAlt}
        width={44}
        height={44}
        className="w-full h-full object-cover"
        placeholder={<div className="w-full h-full bg-background-tertiary flex items-center justify-center"><Disc3 size={16} className="text-text-disabled" /></div>}
      />
    </div>
  );

  const ratingBadge = rating != null && (
    <span className="inline-flex items-baseline gap-0.5 bg-paper-hi border border-accent rounded-badge px-1.5 py-0.5 text-accent font-display italic text-[13px] leading-none flex-shrink-0">
      {Math.round(rating)}
      <span className="font-sans not-italic text-[7.5px] tracking-[0.16em] uppercase opacity-70">/10</span>
    </span>
  );

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0 ml-auto">
      {cover && (coverHref ? <Link href={coverHref} className="flex-shrink-0">{cover}</Link> : cover)}
      {ratingBadge}
    </div>
  );
}
