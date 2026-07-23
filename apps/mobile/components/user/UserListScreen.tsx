import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../ui/BackButton';
import { LoadingScreen } from '../ui/LoadingScreen';
import { UserCard } from './UserCard';
import { getFollowersList, getFollowingList, toggleFollow, type SocialUser } from '../../lib/social';

type Props = {
  username: string;
  mode: 'followers' | 'following';
};

/** Miroir de FollowersList/FollowingList + UserListClient (web). */
export function UserListScreen({ username, mode }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const result = mode === 'followers' ? await getFollowersList(username) : await getFollowingList(username);
    if (!result.success) {
      setError(true);
    } else {
      setUsers(result.items ?? []);
    }
    setLoading(false);
  }, [username, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleFollow = async (id: string) => {
    setPending((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await toggleFollow(id);
      if (result.success && typeof result.following === 'boolean') {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isFollowing: result.following! } : u)));
      }
    } finally {
      setPending((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const title = mode === 'followers' ? 'abonné' : 'abonnement';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4">
        <View style={{ paddingTop: 16 }}>
          <BackButton label="Profil" />
        </View>
        <View className="mt-6 mb-4">
          <Text className="text-text-primary" style={{ fontFamily: 'Inter_500Medium', fontSize: 20 }}>@{username}</Text>
          {!loading && !error && (
            <Text className="text-text-secondary mt-1" style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}>
              {users.length} {users.length <= 1 ? title : `${title}s`}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View className="items-center" style={{ marginTop: 40 }}>
          <LoadingScreen fullScreen={false} />
        </View>
      ) : error ? (
        <Text className="text-text-tertiary px-4" style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}>
          Impossible de charger {mode === 'followers' ? 'les abonnés' : 'les abonnements'}.
        </Text>
      ) : users.length === 0 ? (
        <View className="mx-4 bg-background-secondary rounded-input py-12 items-center">
          <Text className="text-text-tertiary" style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}>
            Aucun {mode === 'followers' ? 'abonné' : 'abonnement'} pour le moment
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <UserCard
              user={{ id: item.id, username: item.username, pictureUrl: item.pictureUrl, isFollowing: item.isFollowing, isMe: item.isMe }}
              onFollowToggle={handleToggleFollow}
              isLoading={!!pending[item.id]}
            />
          )}
        />
      )}
    </View>
  );
}
