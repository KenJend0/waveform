import { ReactNode } from 'react';

interface FeedTextLinesProps {
  /** Sentence line — who did what. Always present. */
  context: ReactNode;
  /** Plain-text version of context, used for the hover tooltip. */
  contextText?: string;
  /** Musical target title, rendered on its own line when given. */
  title?: ReactNode | null;
  /** Plain-text version of title, used for the hover tooltip. */
  titleText?: string;
  /** Artist name, rendered on its own line below the title when given. */
  artist?: ReactNode | null;
  /** Plain-text version of artist, used for the hover tooltip. */
  artistText?: string;
  time: string;
  className?: string;
}

/**
 * Renders 1 to 3 lines (context, then optional title, then optional artist),
 * each on its own row so no element has to compete with another for space —
 * a single line can safely ellipsis without losing a sibling's content.
 * The timestamp sits next to the last line in its own flex-shrink-0 span so
 * it's never swallowed by that line's ellipsis when the text is long.
 */
export function FeedTextLines({
  context,
  contextText,
  title,
  titleText,
  artist,
  artistText,
  time,
  className = '',
}: FeedTextLinesProps) {
  const lines: { content: ReactNode; text?: string; cls: string }[] = [
    { content: context, text: contextText, cls: 'text-label text-text-tertiary leading-tight' },
  ];
  if (title) {
    lines.push({ content: title, text: titleText, cls: 'mt-0.5 text-meta leading-snug font-display italic text-text-warm' });
  }
  if (artist) {
    lines.push({ content: artist, text: artistText, cls: 'mt-0.5 text-sm text-text-tertiary leading-snug' });
  }

  return (
    <div className={className}>
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        return (
          <div key={i} className={`flex items-baseline gap-1 ${line.cls}`} title={line.text}>
            <p className="truncate min-w-0">{line.content}</p>
            {isLast && time && (
              <span className="flex-shrink-0 font-sans not-italic text-text-disabled" suppressHydrationWarning>{'· '}{time}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
