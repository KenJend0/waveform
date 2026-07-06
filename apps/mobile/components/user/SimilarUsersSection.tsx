import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Avatar } from '../avatars/Avatar';
import { toggleFollow } from '../../lib/social';
import { type SimilarUser } from '../../lib/explore';
import { h2Style, smStyle } from '../../lib/typography';

function UserRow({ user }: { user: SimilarUser }) {
  const router = useRouter();
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFollow() {
    setLoading(true);
    const result = await toggleFollow(user.username);
    if (result.success) setFollowed(true);
    setLoading(false);
  }

  return (
    <Pressable
      onPress={() => router.push(`/u/${user.username}` as any)}
      className="flex-row items-center gap-3 bg-background-secondary border border-border rounded-card pl-4 pr-3 py-2.5"
    >
      <View className="rounded-full overflow-hidden border border-rule" style={{ width: 42, height: 42 }}>
        <Avatar src={user.avatar_url} size={42} />
      </View>

      <View className="flex-1 min-w-0">
        <Text numberOfLines={1} className="text-text-primary" style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}>
          @{user.username}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 12.5 }} className="text-text-secondary">
          {user.shared_albums_count > 0
            ? `${user.shared_albums_count} album${user.shared_albums_count > 1 ? 's' : ''} en commun`
            : 'goûts similaires'}
        </Text>
      </View>

      {user.shared_covers.length > 0 && (
        <View className="flex-row gap-1">
          {user.shared_covers.map((cover, i) => (
            <Image key={i} source={{ uri: cover }} style={{ width: 24, height: 24, borderRadius: 5 }} contentFit="cover" />
          ))}
          {user.shared_albums_count > user.shared_covers.length && (
            <View className="w-6 h-6 rounded-[5px] bg-background-tertiary border border-border items-center justify-center">
              <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 10 }} className="text-text-secondary">
                +{user.shared_albums_count - user.shared_covers.length}
              </Text>
            </View>
          )}
        </View>
      )}

      <Pressable
        onPress={handleFollow}
        disabled={followed || loading}
        className={`px-3.5 py-1.5 rounded-pill border ${followed ? 'border-border' : 'border-sage'}`}
      >
        {loading ? (
          <ActivityIndicator size="small" color={followed ? '#6B6B6B' : '#7A8471'} />
        ) : (
          <Text className={followed ? 'text-text-tertiary' : 'text-sage'} style={{ fontFamily: 'Inter_500Medium', fontSize: 11.5 }}>
            {followed ? 'Suivi' : 'Suivre'}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

/** Miroir de SimilarUsersSection (web) — masqué pour tier != 'established' par la page appelante. */
export function SimilarUsersSection({ users }: { users: SimilarUser[] }) {
  if (users.length === 0) return null;

  return (
    <View>
      <View className="mb-4">
        <Text style={h2Style} className="text-text-primary">
          Goûts <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">similaires</Text>
        </Text>
        <Text style={smStyle} className="text-text-secondary mt-1">
          Triés par affinité de goût. Au plus proche en premier.
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {users.map((user) => (
          <UserRow key={user.user_id} user={user} />
        ))}
      </View>
    </View>
  );
}
