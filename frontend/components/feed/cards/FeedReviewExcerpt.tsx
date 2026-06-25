interface FeedReviewExcerptProps {
  text?: string | null;
  className?: string;
}

export function cleanReviewExcerpt(text?: string | null) {
  return text?.replace(/\s+/g, ' ').trim() || null;
}

export function formatReviewExcerpt(text?: string | null) {
  const cleaned = cleanReviewExcerpt(text);
  if (!cleaned) return null;
  return `« ${cleaned} »`;
}

export function FeedInlineReviewExcerpt({ text }: { text?: string | null }) {
  const cleaned = cleanReviewExcerpt(text);
  if (!cleaned) return null;

  return (
    <span className="inline-flex max-w-full min-w-0 align-baseline font-display italic text-[13.5px] text-accent-deep leading-[1.35]">
      <span className="flex-shrink-0">«&nbsp;</span>
      <span className="truncate min-w-0">{cleaned}</span>
      <span className="flex-shrink-0">&nbsp;»</span>
    </span>
  );
}

export function FeedReviewExcerpt({ text, className = '' }: FeedReviewExcerptProps) {
  const excerpt = formatReviewExcerpt(text);
  if (!excerpt) return null;

  return (
    <p
      className={`font-display italic text-[13.5px] text-accent-deep leading-[1.35] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:1] [-webkit-box-orient:vertical] ${className}`}
    >
      {excerpt}
    </p>
  );
}
