import type { ComponentProps, ComponentType } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Compass, Plus, Bell } from 'lucide-react-native';
import { useScrollNav } from '../../lib/ScrollNavContext';
import { useAuth } from '../../lib/AuthContext';
import { Avatar } from '../avatars/Avatar';

type NavRoute = 'explore' | 'add' | 'feed' | 'me';

const NAV_ITEMS: { route: NavRoute; label: string; icon: ComponentType<ComponentProps<typeof Compass>> }[] = [
  { route: 'explore', label: 'Découvrir', icon: Compass },
  { route: 'add', label: 'Ajouter', icon: Plus },
  { route: 'feed', label: 'Activité', icon: Bell },
];

const COLOR_ACTIVE = '#2A2520';
const COLOR_INACTIVE = '#9A9A9A';

export default function BottomNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { navCompact } = useScrollNav();
  const { session, unseenActivity, profile } = useAuth();

  const allRoutes: NavRoute[] = ['explore', 'add', 'feed', 'me'];
  const activeRoute = allRoutes.find((route) => pathname.startsWith(`/${route}`));
  // Hors des 4 pages principales elles-mêmes (pas leurs sous-pages : /me/settings,
  // fiches artiste/album/track, journal, etc.), la barre reste toujours compacte —
  // mêmes règles que web/components/layout/BottomNav.tsx (comparaison stricte du pathname).
  const isMainPage = allRoutes.some((route) => pathname === `/${route}`);

  useEffect(() => {
    if (!isMainPage) {
      navCompact.value = withTiming(1, { duration: 200 });
    }
  }, [isMainPage, navCompact]);

  const navStyle = useAnimatedStyle(() => ({
    width: interpolate(navCompact.value, [0, 1], [300, 232], Extrapolation.CLAMP),
    borderRadius: interpolate(navCompact.value, [0, 1], [20, 999], Extrapolation.CLAMP),
    paddingHorizontal: interpolate(navCompact.value, [0, 1], [10, 6], Extrapolation.CLAMP),
  }));

  if (!session) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: insets.bottom + 4 }]}>
      <Animated.View style={[styles.nav, navStyle]}>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.route}
            item={item}
            active={activeRoute === item.route}
            navCompact={navCompact}
            showUnseenDot={item.route === 'feed' && unseenActivity}
            onPress={() => router.push(`/(tabs)/${item.route}`)}
          />
        ))}
        <ProfileNavItem
          active={activeRoute === 'me'}
          navCompact={navCompact}
          avatarUrl={profile?.avatar_url ?? null}
          onPress={() => router.push('/(tabs)/me')}
        />
      </Animated.View>
    </View>
  );
}

function ProfileNavItem({
  active,
  navCompact,
  avatarUrl,
  onPress,
}: {
  active: boolean;
  navCompact: SharedValue<number>;
  avatarUrl: string | null;
  onPress: () => void;
}) {
  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(navCompact.value, [0, 1], [-5, 0], Extrapolation.CLAMP) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(navCompact.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Pressable onPress={onPress} style={styles.item}>
      {active && <View style={styles.activeIndicator} />}

      <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
        <View style={[styles.avatarRing, { borderColor: active ? '#8E6F5E' : '#D8D3CB' }]}>
          <Avatar src={avatarUrl} size={20} />
        </View>
      </Animated.View>

      <Animated.Text
        style={[styles.label, labelStyle, { color: active ? COLOR_ACTIVE : COLOR_INACTIVE }]}
      >
        Moi
      </Animated.Text>
    </Pressable>
  );
}

function NavItem({
  item,
  active,
  navCompact,
  showUnseenDot,
  onPress,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  navCompact: SharedValue<number>;
  showUnseenDot?: boolean;
  onPress: () => void;
}) {
  const Icon = item.icon;
  const isAdd = item.route === 'add';

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(navCompact.value, [0, 1], [-5, 0], Extrapolation.CLAMP) },
      ...(isAdd ? [{ rotate: '-4deg' }] : []),
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(navCompact.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Pressable onPress={onPress} style={styles.item}>
      {active && <View style={styles.activeIndicator} />}

      <Animated.View style={[isAdd ? styles.addIconWrap : styles.iconWrap, iconWrapStyle]}>
        <Icon color={isAdd ? '#FAF8F4' : active ? COLOR_ACTIVE : COLOR_INACTIVE} size={isAdd ? 18 : 22} />
        {showUnseenDot && <View style={styles.unseenDot} />}
      </Animated.View>

      <Animated.Text
        style={[styles.label, labelStyle, { color: active ? COLOR_ACTIVE : COLOR_INACTIVE }]}
      >
        {item.label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: 44,
    paddingVertical: 6,
    backgroundColor: 'rgba(250, 248, 244, 0.94)',
    borderWidth: 1,
    borderColor: '#D8D3CB',
    shadowColor: '#3C2814',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: {
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -1,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#8E6F5E',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unseenDot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8E6F5E',
  },
  addIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#2A2520',
  },
  label: {
    position: 'absolute',
    bottom: 1,
    fontSize: 9,
    lineHeight: 10,
    fontFamily: 'Inter_500Medium',
  },
});
