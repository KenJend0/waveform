import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../../components/ui/BackButton';
import { DiscoverCard } from '../../../components/explore/DiscoverCard';
import { getDiscoveryAlbums, type DiscoveryResult } from '../../../lib/explore';
import { useAuth } from '../../../lib/AuthContext';
import { smStyle } from '../../../lib/typography';

const CARD_GAP = 14;

/** "Voir tout" de la découverte — miroir de apps/web/app/explore/decouverte/. */
export default function DecouverteScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DiscoveryResult>({ albums: [], mode: 'discover', hasTasteProfile: false });
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        setResult(await getDiscoveryAlbums(24));
      } catch (err) {
        console.error('Decouverte fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isBubble = result.mode === 'bubble';
  const visible = result.albums.filter((a) => !dismissedIds.has(a.album_id));

  function handleDismiss(albumId: string) {
    setDismissedIds((prev) => new Set(prev).add(albumId));
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 100 }}>
      <BackButton label="Explorer" className="mb-4" />
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 26 }} className="text-text-primary mb-1">
        {isBubble ? (
          <>Hors de ta <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">bulle</Text></>
        ) : (
          <>À <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">découvrir</Text></>
        )}
      </Text>
      <Text className="text-text-secondary mb-5" style={smStyle}>
        {isBubble
          ? 'Des artistes absents de ton journal, suggérés par des comptes que tu suis.'
          : result.hasTasteProfile
            ? 'Des albums largement salués, en dehors de tes artistes habituels.'
            : 'Des albums largement salués sur Waveform, pour commencer à explorer.'}
      </Text>

      {loading ? (
        <View className="py-16 items-center">
          <ActivityIndicator color="#8E6F5E" />
        </View>
      ) : visible.length === 0 ? (
        <Text className="text-text-tertiary" style={smStyle}>Rien pour le moment.</Text>
      ) : (
        <View className="flex-row flex-wrap" style={{ gap: CARD_GAP }}>
          {visible.map((album) => (
            <DiscoverCard
              key={album.album_id}
              album={album}
              onDismiss={user ? handleDismiss : undefined}
              width="47%"
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
