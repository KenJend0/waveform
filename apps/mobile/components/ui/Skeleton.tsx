import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

type Props = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
};

/** Bloc qui pulse en opacité — brique de base pour tous les états de chargement. */
export function Skeleton({ width = '100%', height = 16, radius = 6, className }: Props) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={`bg-background-tertiary ${className ?? ''}`}
      style={[{ width, height, borderRadius: radius }, style]}
    />
  );
}

/** Placeholder pour une AlbumCard/ArtistCard en cours de chargement. */
export function SkeletonAlbumCard({ width = 160 }: { width?: number }) {
  return (
    <Animated.View style={{ width }}>
      <Skeleton width={width} height={width} radius={10} />
      <Skeleton width={width * 0.75} height={13} radius={4} className="mt-3" />
      <Skeleton width={width * 0.4} height={11} radius={4} className="mt-1.5" />
    </Animated.View>
  );
}

/** Placeholder pour une ligne UserCard/TrackCard en cours de chargement. */
export function SkeletonRow() {
  return (
    <Animated.View className="flex-row items-center gap-3.5 px-4 py-3.5">
      <Skeleton width={44} height={44} radius={22} />
      <Animated.View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={13} radius={4} />
        <Skeleton width="35%" height={11} radius={4} />
      </Animated.View>
    </Animated.View>
  );
}
