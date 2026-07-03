import { Text } from 'react-native';
import { useRouter } from 'expo-router';

export function ActorLink({ username }: { username: string }) {
  const router = useRouter();
  return (
    <Text onPress={() => router.push(`/u/${username}`)} style={{ color: '#6B6B6B' }}>
      {username}
    </Text>
  );
}
