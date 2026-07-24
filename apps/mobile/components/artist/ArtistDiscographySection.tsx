import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CoverImage } from '../album/CoverImage';
import { coverSrcWithFallback } from '../../lib/cover';
import { canonicalAlbumKey } from '../../lib/albumCanonical';
import { useMusicBrainzAlbumImport } from '../../lib/useMusicBrainzImport';
import { h2Style, labelStyle, metaStyle } from '../../lib/typography';
import type { ArtistRelease } from '../../lib/musicbrainz';

type DbAlbum = {
  id: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  mbid: string | null;
  avg_rating: number | null;
};

type ReleaseType = 'Album' | 'EP' | 'Single' | 'Live';
const RELEASE_TYPE_FILTERS: { label: string; value: ReleaseType | 'Tous' }[] = [
  { label: 'Tous', value: 'Tous' },
  { label: 'Albums', value: 'Album' },
  { label: 'EPs', value: 'EP' },
  { label: 'Singles', value: 'Single' },
  { label: 'Lives', value: 'Live' },
];

type DiscographyItem = {
  key: string;
  title: string;
  date: string | null;
  coverSrc: string | null;
  coverFallback?: string;
  href: string | null;
  mbidForImport?: string;
  avgRating: number | null;
  releaseType: ReleaseType | null;
};

type Props = { albums: DbAlbum[]; mbReleases: ArtistRelease[]; artistName: string };

/**
 * Miroir de la section "Discographie" de ArtistPageContent (web) : albums DB +
 * releases MusicBrainz non importées, filtre par type. Le tap sur une release MB
 * déclenche l'import via l'Edge Function import-musicbrainz (voir lib/useMusicBrainzImport)
 * puis navigue directement vers la page créée — même flux que SearchOverlay et le web.
 */
export function ArtistDiscographySection({ albums, mbReleases, artistName }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<ReleaseType | 'Tous'>('Tous');
  const { importingMbid, importAlbum } = useMusicBrainzAlbumImport();

  const discography = useMemo(() => {
    const mbTypeByRgMbid = new Map(mbReleases.map((r) => [r.releaseGroupMbid, r.type as ReleaseType | null]));
    const existingRgMbids = new Set(albums.filter((a) => a.mbid).map((a) => a.mbid as string));
    const existingCanonicalKeys = new Set(albums.map((a) => canonicalAlbumKey(a.title, artistName)));

    const baseAlbums: DiscographyItem[] = albums.map((a) => {
      const { src, fallback } = coverSrcWithFallback(a.mbid, a.cover_url);
      return {
        key: `db-${a.id}`,
        title: a.title,
        date: a.release_date,
        coverSrc: src,
        coverFallback: fallback,
        href: `/albums/${a.id}`,
        avgRating: a.avg_rating,
        releaseType: a.mbid ? (mbTypeByRgMbid.get(a.mbid) ?? null) : null,
      };
    });

    const missingReleases: DiscographyItem[] = mbReleases
      .filter((r) => !existingRgMbids.has(r.releaseGroupMbid) && !existingCanonicalKeys.has(canonicalAlbumKey(r.title, artistName)))
      .map((r) => ({
        key: `mb-${r.mbid}`,
        title: r.title,
        date: r.date,
        // Namespace release-group de CoverArt Archive : seul /front est supporté
        // (pas de suffixe de taille -250/-500/-1200, réservé au namespace /release) —
        // miroir du pattern déjà utilisé côté mobile (searchMusicBrainzAlbums, ArtistAlbumsSection).
        coverSrc: `https://coverartarchive.org/release-group/${r.releaseGroupMbid}/front`,
        href: null,
        mbidForImport: r.releaseGroupMbid,
        avgRating: null,
        releaseType: r.type as ReleaseType | null,
      }));

    return [...baseAlbums, ...missingReleases].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [albums, mbReleases, artistName]);

  const typeOf = (item: DiscographyItem): ReleaseType => item.releaseType ?? 'Album';
  const typeCounts = discography.reduce((acc, item) => {
    const t = typeOf(item);
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {} as Record<ReleaseType, number>);
  const availableFilters = RELEASE_TYPE_FILTERS.filter((f) => f.value === 'Tous' || (typeCounts[f.value as ReleaseType] ?? 0) > 0);
  const showFilters = availableFilters.length > 2;
  const effectiveFilter = availableFilters.some((f) => f.value === typeFilter) ? typeFilter : 'Tous';
  const filtered = effectiveFilter === 'Tous' ? discography : discography.filter((item) => typeOf(item) === effectiveFilter);

  return (
    <View>
      <Text className="text-text-primary mb-6" style={h2Style}>Discographie</Text>

      {discography.length === 0 ? (
        <Text className="text-center text-text-tertiary py-12" style={metaStyle}>Aucun album trouvé pour cet artiste</Text>
      ) : (
        <>
          {showFilters && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 24 }}>
              {availableFilters.map((f) => {
                const isActive = effectiveFilter === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setTypeFilter(f.value)}
                    className={`px-3 py-1 rounded-pill ${isActive ? 'bg-text-primary' : 'bg-background-secondary'}`}
                  >
                    <Text style={[labelStyle, { color: isActive ? '#F5F3EF' : '#5A5650' }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
            {filtered.map((item) => {
              const year = item.date ? new Date(item.date).getFullYear() : null;
              const importing = !!item.mbidForImport && importingMbid === item.mbidForImport;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    if (importing) return;
                    if (item.href) router.push(item.href as any);
                    else if (item.mbidForImport) importAlbum(item.mbidForImport);
                  }}
                  style={{ width: '33.333%', paddingHorizontal: 6, marginBottom: 16, opacity: importing ? 0.6 : 1 }}
                >
                  <View className="aspect-square rounded-cover overflow-hidden bg-background-secondary">
                    {item.coverSrc ? (
                      <CoverImage
                        src={item.coverSrc}
                        fallback={item.coverFallback}
                        style={{ width: '100%', height: '100%' }}
                        placeholder={<View className="w-full h-full bg-background-secondary items-center justify-center"><Text className="text-text-disabled text-[20px]">♪</Text></View>}
                      />
                    ) : (
                      <View className="w-full h-full items-center justify-center">
                        <Text className="text-text-disabled text-[20px]">♪</Text>
                      </View>
                    )}
                    {importing && (
                      <View className="absolute inset-0 items-center justify-center bg-black/20">
                        <ActivityIndicator size="small" color="#F5F3EF" />
                      </View>
                    )}
                    {item.avgRating != null && (
                      <View className="absolute top-1.5 right-1.5 flex-row items-baseline gap-0.5 bg-paper-hi/90 border border-accent rounded-badge-sm px-1.5 py-0.5">
                        <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 13, lineHeight: 13, paddingRight: 2 }}>
                          {item.avgRating.toFixed(1).replace('.', ',')}
                        </Text>
                        <Text className="text-accent uppercase opacity-70" style={{ fontFamily: 'Inter_400Regular', fontSize: 8 }}>/10</Text>
                      </View>
                    )}
                  </View>
                  <View className="mt-2">
                    <Text numberOfLines={2} className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 14, lineHeight: 17 }}>
                      {item.title}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-0.5">
                      {year && <Text className="text-text-tertiary" style={labelStyle}>{year}</Text>}
                      {(item.releaseType === 'EP' || item.releaseType === 'Live') && (
                        <Text className="text-text-disabled uppercase" style={{ fontFamily: 'Inter_500Medium', fontSize: 10 }}>{item.releaseType}</Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
