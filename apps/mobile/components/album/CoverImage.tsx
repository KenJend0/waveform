import { useState, type ReactNode } from 'react';
import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

type Props = {
  /** URL principale — CoverArt Archive release-group */
  src: string;
  /** URL de secours (ex. cover release-specific) — tentée si la principale échoue */
  fallback?: string;
  /** Affiché si les deux échouent */
  placeholder: ReactNode;
  style?: StyleProp<ImageStyle>;
};

/**
 * Deux niveaux de fallback comme la version web : src -> fallback -> placeholder.
 * expo-image gère déjà le cache disque/mémoire nativement (pas besoin de le refaire).
 */
export function CoverImage({ src, fallback, placeholder, style }: Props) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);

  if (failed) return <>{placeholder}</>;

  return (
    <Image
      source={{ uri: current }}
      style={style}
      contentFit="cover"
      transition={150}
      onError={() => {
        if (current === src && fallback) {
          setCurrent(fallback);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
