import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { CoverImage } from '../album/CoverImage';
import {
  dismissRecommendation,
  dismissTrackRecommendation,
  type ForYouAlbum,
  type ForYouTrack,
} from '../../lib/explore';
import { h2Style, labelStyle, smStyle } from '../../lib/typography';

const CARD_GAP = 12;

function Cover({
  cover_url,
  title,
  onDismiss,
}: {
  cover_url: string | null;
  title: string;
  onDismiss: () => void;
}) {
  return (
    <View className="rounded-input overflow-hidden bg-background-secondary mb-2 aspect-square">
      {cover_url ? (
        <CoverImage src={cover_url} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
      ) : (
        <View className="w-full h-full items-center justify-center">
          <Text className="text-2xl text-text-tertiary">♪</Text>
        </View>
      )}
      <Pressable onPress={onDismiss} hitSlop={6} className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/45 items-center justify-center">
        <X size={13} color="#F5F3EF" />
      </Pressable>
    </View>
  );
}

type Props = {
  albums: ForYouAlbum[];
  tracks: ForYouTrack[];
};

/** Miroir de PourToiSection (web) — recommandations personnalisées, avec dismiss optimiste. */
export function PourToiSection({ albums, tracks }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'albums' | 'titres'>('albums');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [dismissedTrackIds, setDismissedTrackIds] = useState<Set<string>>(new Set());

  const visibleAlbums = albums.filter((a) => !dismissedIds.has(a.album_id)).slice(0, 3);
  const allDismissed = albums.length > 0 && visibleAlbums.length === 0;

  const visibleTracks = tracks.filter((t) => !dismissedTrackIds.has(t.track_id)).slice(0, 3);
  const allTracksDismissed = tracks.length > 0 && visibleTracks.length === 0;

  async function handleDismissAlbum(albumId: string) {
    setDismissedIds((prev) => new Set(prev).add(albumId));
    const { success } = await dismissRecommendation(albumId);
    if (!success) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(albumId);
        return next;
      });
    }
  }

  async function handleDismissTrack(trackId: string) {
    setDismissedTrackIds((prev) => new Set(prev).add(trackId));
    const { success } = await dismissTrackRecommendation(trackId);
    if (!success) {
      setDismissedTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
    }
  }

  return (
    <View>
      <View className="mb-3">
        <Text style={h2Style} className="text-text-primary">
          Pour <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">toi</Text>
        </Text>
        <Text style={smStyle} className="text-text-secondary mt-1">
          Reviens demain pour une nouvelle sélection.
        </Text>
      </View>

      <View className="flex-row gap-1.5 mb-4">
        {(['albums', 'titres'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} className={`px-3 py-1 rounded-full ${tab === t ? 'bg-text-primary' : 'bg-background-secondary'}`}>
            <Text className={tab === t ? 'text-background' : 'text-text-secondary'} style={labelStyle}>
              {t === 'albums' ? 'Albums' : 'Titres'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'albums' && (
        visibleAlbums.length > 0 ? (
          <View className="flex-row" style={{ gap: CARD_GAP }}>
            {visibleAlbums.map((album) => (
              <Pressable key={album.album_id} onPress={() => router.push(`/albums/${album.album_id}` as any)} style={{ flex: 1 }}>
                <Cover cover_url={album.cover_url} title={album.title} onDismiss={() => handleDismissAlbum(album.album_id)} />
                <Text numberOfLines={2} className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 13, lineHeight: 17 }}>
                  {album.title}
                </Text>
                <Text numberOfLines={1} className="text-text-tertiary mt-0.5" style={labelStyle}>
                  {album.artist}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-text-tertiary" style={smStyle}>
            {allDismissed ? 'Tu as écarté toutes les suggestions du jour. Reviens demain pour une nouvelle sélection.' : 'Pas encore de recommandations.'}
          </Text>
        )
      )}

      {tab === 'titres' && (
        visibleTracks.length > 0 ? (
          <View className="flex-row" style={{ gap: CARD_GAP }}>
            {visibleTracks.map((track) => (
              <Pressable key={track.track_id} onPress={() => router.push(`/tracks/${track.track_id}` as any)} style={{ flex: 1 }}>
                <Cover cover_url={track.cover_url} title={track.track_title} onDismiss={() => handleDismissTrack(track.track_id)} />
                <Text numberOfLines={2} className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 13, lineHeight: 17 }}>
                  {track.track_title}
                </Text>
                <Text numberOfLines={1} className="text-text-tertiary mt-0.5" style={labelStyle}>
                  {track.artist}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-text-tertiary" style={smStyle}>
            {allTracksDismissed ? 'Tu as écarté toutes les suggestions du jour. Reviens demain pour une nouvelle sélection.' : 'Pas encore de recommandations.'}
          </Text>
        )
      )}
    </View>
  );
}
