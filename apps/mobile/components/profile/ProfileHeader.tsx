import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Menu, LogOut, Settings, Heart, LifeBuoy, Flame, BarChart2 } from 'lucide-react-native';
import { Avatar } from '../avatars/Avatar';
import { Top3Albums } from './Top3Albums';
import { FollowButton } from '../social/FollowButton';
import { ProfileActionsMenu } from '../social/ProfileActionsMenu';
import { BottomSheet } from '../ui/BottomSheet';
import { ExpandableText } from '../ui/ExpandableText';
import { showToast } from '../ui/Toast';
import { useAuth } from '../../lib/AuthContext';
import type { FavoriteAlbum } from '../../lib/profile';
import { labelStyle, metaStyle } from '../../lib/typography';

type Props = {
  user: {
    id: string;
    username: string;
    pictureUrl: string | null;
    bio: string | null;
    isMe: boolean;
    isFollowing?: boolean;
    isBlocking?: boolean;
  };
  reviewsCount: number;
  followersCount: number;
  followingCount: number;
  streak?: { days: number; isActiveToday: boolean };
  favoriteAlbums: FavoriteAlbum[];
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onFollowChange?: (following: boolean) => void;
  onBlockChange?: (blocking: boolean) => void;
};

/**
 * Miroir de ProfileHeader (web) — hero du profil (avatar, nom, bio, streak, Top3, stats row).
 * Menu hamburger (soi) : toutes les destinations (Éditer profil, Albums favoris, Mes
 * stats, Aide & support) ont désormais un écran mobile — voir docs/MOBILE_ROADMAP.md.
 */
export function ProfileHeader({
  user,
  reviewsCount,
  followersCount,
  followingCount,
  streak,
  favoriteAlbums,
  onOpenFollowers,
  onOpenFollowing,
  onFollowChange,
  onBlockChange,
}: Props) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      setMenuOpen(false);
      router.replace('/');
    } catch {
      showToast('Erreur lors de la déconnexion', 'error');
    }
  };

  const navigateTo = (href: string) => {
    setMenuOpen(false);
    router.push(href as any);
  };

  return (
    <View className="bg-background-secondary border-b border-border-divider" style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
      <View className="flex-row items-center gap-5">
        <View className="rounded-full border border-border overflow-hidden" style={{ width: 80, height: 80 }}>
          <Avatar src={user.pictureUrl} size={80} />
        </View>
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} className="text-text-primary" style={{ fontFamily: 'Inter_500Medium', fontSize: 22, letterSpacing: -0.22 }}>
            {user.isMe ? user.username : `@${user.username}`}
          </Text>

          {user.isMe && streak && streak.days >= 2 && (
            <View className="mt-1.5 self-start flex-row items-center gap-1 bg-paper-hi border border-border rounded-badge px-2 py-0.5">
              <Flame size={12} color="#8B6F47" />
              <Text className="text-accent-deep" style={labelStyle}>{streak.days} jours d'affilés</Text>
            </View>
          )}

          {!user.isMe && (
            <View className="mt-3 flex-row items-center gap-2">
              <FollowButton userId={user.id} initialIsFollowing={!!user.isFollowing} onChange={onFollowChange} />
              <ProfileActionsMenu userId={user.id} initialIsBlocking={!!user.isBlocking} onBlockChange={onBlockChange} />
            </View>
          )}
        </View>

        {user.isMe && (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} className="p-2">
            <Menu size={20} color="#6B6B6B" />
          </Pressable>
        )}
      </View>

      {user.bio && (
        <View className="mt-5">
          <ExpandableText text={user.bio} style={[metaStyle, { lineHeight: 21, color: '#6B6B6B' }]} clampLines={4} />
        </View>
      )}

      <Top3Albums albums={favoriteAlbums} hideIfEmpty={!user.isMe} />

      <View className="flex-row mt-5 pt-4 border-t border-rule">
        <View className="flex-1 pr-4 border-r border-rule">
          <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 32 }}>
            {reviewsCount}
          </Text>
          <Text className="uppercase text-text-tertiary mt-1.5" style={labelStyle}>
            critique{reviewsCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable onPress={onOpenFollowers} className="flex-1 px-4 border-r border-rule">
          <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 32 }}>
            {followersCount}
          </Text>
          <Text className="uppercase text-text-tertiary mt-1.5" style={labelStyle}>
            abonné{followersCount !== 1 ? 's' : ''}
          </Text>
        </Pressable>
        <Pressable onPress={onOpenFollowing} className="flex-1 pl-4">
          <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 32 }}>
            {followingCount}
          </Text>
          <Text className="uppercase text-text-tertiary mt-1.5" style={labelStyle}>
            suivi{followingCount !== 1 ? 's' : ''}
          </Text>
        </Pressable>
      </View>

      {user.isMe && (
        <BottomSheet isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" snapPoint="45%">
          <View className="px-6 py-2">
            <Pressable onPress={() => navigateTo('/me/settings')} className="flex-row items-center gap-3 py-3 border-b border-border-divider">
              <Settings size={16} color="#6B6B6B" />
              <Text className="text-text-primary" style={metaStyle}>Éditer mon profil</Text>
            </Pressable>
            <Pressable onPress={() => navigateTo('/me/favorite-albums')} className="flex-row items-center gap-3 py-3 border-b border-border-divider">
              <Heart size={16} color="#6B6B6B" />
              <Text className="text-text-primary" style={metaStyle}>Mes albums favoris</Text>
            </Pressable>
            <Pressable onPress={() => navigateTo('/me/stats')} className="flex-row items-center gap-3 py-3 border-b border-border-divider">
              <BarChart2 size={16} color="#6B6B6B" />
              <Text className="text-text-primary" style={metaStyle}>Mes statistiques</Text>
            </Pressable>
            <Pressable onPress={() => navigateTo('/me/legal')} className="flex-row items-center gap-3 py-3 border-b border-border-divider">
              <LifeBuoy size={16} color="#6B6B6B" />
              <Text className="text-text-primary" style={metaStyle}>Aide & support</Text>
            </Pressable>
            <Pressable onPress={handleLogout} className="flex-row items-center gap-3 py-3">
              <LogOut size={16} color="#C86C6C" />
              <Text className="text-[#C86C6C]" style={metaStyle}>Se déconnecter</Text>
            </Pressable>
          </View>
        </BottomSheet>
      )}
    </View>
  );
}
