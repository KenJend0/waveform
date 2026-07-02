import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';

type Props = {
  artist: { id: string; name: string; photoUrl?: string | null };
  size?: number;
};

export function ArtistCard({ artist, size = 88 }: Props) {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push(`/artists/${artist.id}`)} style={{ width: size }}>
      <View className="items-center">
        <Avatar src={artist.photoUrl} size={size} />
        <Text
          numberOfLines={2}
          className="mt-2 text-[13px] text-text-primary text-center"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          {artist.name}
        </Text>
      </View>
    </Pressable>
  );
}
