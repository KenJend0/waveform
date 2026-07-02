import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';

type User = {
  id: string;
  username: string;
  pictureUrl?: string | null;
  isFollowing?: boolean;
  isMe?: boolean;
};

type Props = {
  user: User;
  currentUserId?: string | null;
  onFollowToggle?: (id: string, next: boolean) => void;
  isLoading?: boolean;
};

export function UserCard({ user, currentUserId, onFollowToggle, isLoading }: Props) {
  const router = useRouter();
  const hideButton = user.isMe || (!!currentUserId && user.id === currentUserId);

  return (
    <View className="flex-row items-center gap-3.5 px-4 py-3.5 border-b border-border/40">
      <Pressable
        onPress={() => router.push(`/u/${user.username}`)}
        className="flex-row items-center gap-3.5 flex-1 min-w-0"
      >
        <Avatar src={user.pictureUrl} size={44} />
        <Text numberOfLines={1} className="text-[14px] text-text-primary" style={{ fontFamily: 'Inter_500Medium' }}>
          @{user.username}
        </Text>
      </Pressable>
      {!hideButton && onFollowToggle && (
        <Pressable
          onPress={() => !isLoading && onFollowToggle(user.id, !user.isFollowing)}
          disabled={isLoading}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-pill ${
            user.isFollowing ? 'bg-background-tertiary' : 'border border-sage'
          }`}
        >
          {isLoading && <ActivityIndicator size="small" color={user.isFollowing ? '#6B6B6B' : '#7A8471'} />}
          <Text
            className={`text-[12px] ${user.isFollowing ? 'text-text-secondary' : 'text-sage'}`}
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            {user.isFollowing ? 'Suivi' : 'Suivre'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
