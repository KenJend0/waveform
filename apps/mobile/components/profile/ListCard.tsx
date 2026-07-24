import { memo } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Lock, Bookmark } from 'lucide-react-native';
import { CoverImage } from '../album/CoverImage';
import { coverSrcWithFallback } from '../../lib/cover';
import type { ProfileListUI } from '../../lib/lists';
import { useListSave } from '../../lib/useListSave';

type Props = {
  list: ProfileListUI;
  /** Remplace la largeur par défaut (48%, grille 2 colonnes) — utilisé par
   * ListCardWithMenu qui gère lui-même la largeur sur son conteneur englobant. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Miroir de ListCard (web) — grille de couvertures + titre, bouton sauvegarder (visible
 * seulement si list.is_public && !isOwnList, comme le web) et navigation vers /lists/[id]
 * (Phase 7 — remplace l'ancien toast "Bientôt disponible").
 */
export const ListCard = memo(function ListCard({ list, style }: Props) {
  const router = useRouter();
  const covers = list.cover_urls.slice(0, 4);
  const { saved, isOwnList, toggleSave } = useListSave(list);

  return (
    <Pressable onPress={() => router.push(`/lists/${list.id}`)} style={style ?? { width: '48%' }}>
      <View className="aspect-square rounded-input overflow-hidden bg-background-tertiary flex-row flex-wrap">
        {covers.length === 0 ? (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-2xl text-text-tertiary">♪</Text>
          </View>
        ) : (
          covers.map((cover, i) => {
            const { src, fallback } = coverSrcWithFallback(cover.mbid, cover.url);
            return (
              <View key={i} style={{ width: covers.length > 1 ? '50%' : '100%', height: covers.length > 2 ? '50%' : '100%' }}>
                {src ? (
                  <CoverImage src={src} fallback={fallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
                ) : (
                  <View className="w-full h-full bg-background-tertiary" />
                )}
              </View>
            );
          })
        )}
        {list.creator_username && (
          <Pressable
            onPress={() => router.push(`/u/${list.creator_username}` as any)}
            hitSlop={4}
            className="absolute top-2 left-2 flex-row items-center gap-1.5 bg-paper-hi/90 border border-border rounded-full pl-0.5 pr-2 py-0.5"
          >
            <View className="rounded-full overflow-hidden border border-rule bg-accent/20" style={{ width: 18, height: 18 }}>
              {list.creator_avatar && (
                <Image source={{ uri: list.creator_avatar }} style={{ width: 18, height: 18 }} contentFit="cover" />
              )}
            </View>
            <Text numberOfLines={1} className="text-text-primary" style={{ fontFamily: 'Inter_500Medium', fontSize: 10 }}>
              @{list.creator_username}
            </Text>
          </Pressable>
        )}
        {list.is_public && !isOwnList && (
          <Pressable
            onPress={toggleSave}
            hitSlop={8}
            className="absolute top-2 right-2 w-7 h-7 rounded-full items-center justify-center bg-paper-hi/90 border border-border"
          >
            <Bookmark size={13} color={saved ? '#8E6F5E' : '#9A9A9A'} fill={saved ? '#8E6F5E' : 'transparent'} />
          </Pressable>
        )}
      </View>
      <View className="flex-row items-baseline justify-between gap-2 mt-2">
        <View className="flex-row items-center gap-1" style={{ flexShrink: 1, minWidth: 0 }}>
          {!list.is_public && <Lock size={11} color="#9A9A9A" />}
          <Text numberOfLines={1} className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 14, flexShrink: 1 }}>
            {list.title}
          </Text>
        </View>
        <View className="flex-row items-baseline gap-1" style={{ flexShrink: 0 }}>
          {/* paddingRight : l'italique déborde de sa propre boîte de texte (rendu penché),
              sans marge "ITEMS" juste à côté rognait visuellement le dernier chiffre. */}
          <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 15, paddingRight: 3 }} className="text-accent">
            {list.item_count}
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9, letterSpacing: 1 }} className="uppercase text-text-tertiary">
            {list.item_count === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>
      {list.preview_items.length > 0 && (
        <View className="mt-2" style={{ gap: 4 }}>
          {list.preview_items.map((item, i) => (
            <View
              key={i}
              className={`flex-row gap-1.5 ${i > 0 ? 'pt-1 border-t border-border-divider' : ''}`}
            >
              <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 11.5 }} className="text-accent">
                {i + 1}
              </Text>
              <Text numberOfLines={1} className="flex-1 text-text-secondary" style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5 }}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
});
