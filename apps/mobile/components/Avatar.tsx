import { View } from 'react-native';
import { Image } from 'expo-image';
import { User } from 'lucide-react-native';

type Props = {
  src?: string | null;
  size?: number;
};

/** Avatar utilisateur — photo si disponible, sinon icône par défaut. */
export function Avatar({ src, size = 40 }: Props) {
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-background-tertiary items-center justify-center"
    >
      <User size={Math.round(size * 0.45)} color="#9A9A9A" />
    </View>
  );
}
