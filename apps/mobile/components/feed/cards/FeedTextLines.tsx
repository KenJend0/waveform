import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type Line = { content: ReactNode; style: object };

type Props = {
  context: ReactNode;
  title?: ReactNode | null;
  artist?: ReactNode | null;
  time: string;
};

const contextStyle = { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9A9A9A' };
const titleStyle = { fontSize: 14, fontFamily: 'InstrumentSerif_400Regular', color: '#2A2520', marginTop: 2 };
const artistStyle = { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9A9A9A', marginTop: 2 };

/** Empile context / titre / artiste-extrait sur 1 à 3 lignes, l'heure suit la dernière. */
export function FeedTextLines({ context, title, artist, time }: Props) {
  const lines: Line[] = [{ content: context, style: contextStyle }];
  if (title) lines.push({ content: title, style: titleStyle });
  if (artist) lines.push({ content: artist, style: artistStyle });

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        if (isLast && !!time) {
          // Time sits in its own non-shrinking Text so a long context/title
          // (e.g. several actor names on an aggregated card) truncates on its
          // own without ever swallowing the trailing timestamp — mirrors the
          // web's separate flex-shrink-0 span (FeedTextLines.tsx web).
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text numberOfLines={1} style={[line.style, { flexShrink: 1 }]}>
                {line.content}
              </Text>
              <Text style={{ color: '#BDBDBD', fontSize: 12, fontFamily: 'Inter_400Regular', flexShrink: 0 }}>
                {' '}
                · {time}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} numberOfLines={1} style={line.style}>
            {line.content}
          </Text>
        );
      })}
    </View>
  );
}
