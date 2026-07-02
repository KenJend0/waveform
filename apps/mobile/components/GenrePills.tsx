import { Pressable, Text, View } from 'react-native';

type Props = {
  genres: string[];
  genreWeights?: Record<string, number>;
  onGenrePress?: (genre: string) => void;
  /** Affiche le bouton "+ Genre" — le handler ouvre le BottomSheet de vote (branché en Phase 6). */
  onAddPress?: () => void;
};

export function GenrePills({ genres, genreWeights, onGenrePress, onAddPress }: Props) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {genres.map((genre) => {
        const votes = genreWeights?.[genre];
        const isHeavy = votes != null && votes > 0;
        const Pill = onGenrePress ? Pressable : View;

        return (
          <Pill
            key={genre}
            {...(onGenrePress ? { onPress: () => onGenrePress(genre) } : {})}
            className={`rounded-pill px-2.5 py-1 border ${
              isHeavy ? 'border-[#B8AFA0]' : 'border-rule'
            }`}
          >
            <Text
              className={`text-[11px] capitalize ${isHeavy ? 'text-text-warm' : 'text-text-secondary'}`}
              style={{ fontFamily: 'Inter_400Regular', letterSpacing: 0.2 }}
            >
              {genre}
            </Text>
          </Pill>
        );
      })}
      {onAddPress && (
        <Pressable onPress={onAddPress} className="rounded-pill px-2.5 py-0.5 border border-border">
          <Text className="text-[11px] text-text-tertiary" style={{ fontFamily: 'Inter_400Regular' }}>
            + Genre
          </Text>
        </Pressable>
      )}
    </View>
  );
}
