import { Text } from 'react-native';

export function cleanReviewExcerpt(text?: string | null): string | null {
  return text?.replace(/\s+/g, ' ').trim() || null;
}

/** Extrait de critique en citation — miroir typographique de FeedReviewExcerpt (web). */
export function FeedInlineReviewExcerpt({ text }: { text?: string | null }) {
  const cleaned = cleanReviewExcerpt(text);
  if (!cleaned) return null;

  return (
    <Text
      style={{
        fontFamily: 'InstrumentSerif_400Regular_Italic',
        fontSize: 14,
        color: '#5C4538',
        lineHeight: 18,
      }}
    >
      « {cleaned} »
    </Text>
  );
}
