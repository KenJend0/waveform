import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { DiscoverCard } from './DiscoverCard';
import { type DiscoveryResult } from '../../lib/explore';
import { h2Style, smStyle } from '../../lib/typography';

const CARD_WIDTH = 148;

/** Miroir de DiscoverySection (web) — carrousel horizontal, section "voir tout" sur /explore/decouverte. */
export function DiscoverySection({ result }: { result: DiscoveryResult }) {
  const router = useRouter();
  const { user } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visible = result.albums.filter((a) => !dismissedIds.has(a.album_id)).slice(0, 5);
  if (visible.length === 0) return null;

  function handleDismiss(albumId: string) {
    setDismissedIds((prev) => new Set(prev).add(albumId));
  }

  const isBubble = result.mode === 'bubble';

  return (
    <View>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text style={h2Style} className="text-text-primary mb-1">
            {isBubble ? (
              <>Hors de ta <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">bulle</Text></>
            ) : (
              <>À <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">découvrir</Text></>
            )}
          </Text>
          <Text style={smStyle} className="text-text-secondary">
            {isBubble
              ? 'Des artistes absents de ton journal, suggérés par des comptes que tu suis.'
              : result.hasTasteProfile
                ? 'Des albums largement salués, en dehors de tes artistes habituels.'
                : 'Des albums largement salués sur Waveform, pour commencer à explorer.'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/explore/decouverte' as any)} className="border-b border-accent pb-0.5">
          <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14 }}>
            voir tout
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
        {visible.map((album) => (
          <DiscoverCard key={album.album_id} album={album} width={CARD_WIDTH} onDismiss={user ? handleDismiss : undefined} />
        ))}
      </ScrollView>
    </View>
  );
}
