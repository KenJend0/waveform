import { Pressable, View } from 'react-native';
import { Star } from 'lucide-react-native';

type Props = {
  value: number | null;
  onChange: (rating: number) => void;
  compact?: boolean;
};

/** Notation 0–10, une étoile par point (pas de demi-étoile). */
export function StarRating({ value, onChange, compact }: Props) {
  const size = compact ? 20 : 24;

  return (
    <View className="flex-row justify-between w-full">
      {Array.from({ length: 10 }).map((_, i) => {
        const starValue = i + 1;
        const isFilled = value != null && starValue <= value;

        return (
          <Pressable
            key={i}
            onPress={() => onChange(starValue)}
            hitSlop={4}
            className={compact ? 'p-0.5' : 'p-1'}
          >
            <Star
              size={size}
              color={isFilled ? '#1C1C1C' : '#D8D3CB'}
              fill={isFilled ? '#1C1C1C' : 'transparent'}
              strokeWidth={isFilled ? 0 : 1.5}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
