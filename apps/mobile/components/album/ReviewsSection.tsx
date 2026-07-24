import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '../avatars/Avatar';
import { BottomSheet } from '../ui/BottomSheet';
import { showToast } from '../ui/Toast';
import { getAlbumReviewsPage, type AlbumReview, type AlbumReviewsTab } from '../../lib/diary';
import { h2Style, metaStyle, metaMediumStyle, labelStyle } from '../../lib/typography';

type Props = {
  albumId: string;
  reviewsCount: number;
  initialReviews: AlbumReview[];
};

/** Miroir de la carte de Reviews.tsx (web) — badge note 15px, avatar 28, corps 13px italique. */
function ReviewItem({ review }: { review: AlbumReview }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/diary/${review.id}` as any)}
      className="bg-background-secondary rounded-card p-4"
    >
      <View className="flex-row items-start gap-3">
        <Avatar src={review.avatar_url} size={28} />
        <View className="flex-1">
          <View className="flex-row items-baseline justify-between mb-1.5">
            <View className="flex-row items-baseline gap-1">
              <Text className="text-text-primary" style={metaMediumStyle}>
                {review.username || 'User'}
              </Text>
              <Text className="text-text-tertiary" style={labelStyle}>
                · {new Date(review.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            {review.rating !== null && (
              <View className="flex-row items-baseline gap-0.5 bg-[#FAF8F4] border border-accent rounded-badge px-1.5 py-0.5">
                <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 15, lineHeight: 15, paddingRight: 2 }}>
                  {review.rating}
                </Text>
                <Text
                  className="uppercase text-accent"
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 9, opacity: 0.7 }}
                >
                  /10
                </Text>
              </View>
            )}
          </View>
          {review.review_body && (
            <Text
              numberOfLines={3}
              className="text-accent-deep"
              style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 13, lineHeight: 22.75 }}
            >
              «{' '}{review.review_body}{' '}»
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** Miroir de AlbumReviewSection + Reviews + ReviewsBottomSheet (web) fusionnés en un composant. */
export function ReviewsSection({ albumId, reviewsCount, initialReviews }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [items, setItems] = useState<AlbumReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<AlbumReviewsTab>('all');
  const [userId, setUserId] = useState<string | null>(null);
  const [hasFollowing, setHasFollowing] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    setItems([]);
    setOffset(0);
    loadReviews(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, tab]);

  async function loadReviews(startOffset: number, replace: boolean) {
    setLoading(true);
    try {
      const result = await getAlbumReviewsPage({ albumId, tab, offset: startOffset, limit: 12 });
      setUserId(result.userId);
      setHasFollowing(result.hasFollowing);
      setHasMore(result.hasMore);
      setOffset(startOffset + result.items.length);
      setItems((prev) => (replace ? result.items : [...prev, ...result.items]));
    } catch {
      showToast('Impossible de charger les critiques', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="border-t border-border-divider pt-8 mb-12">
      <View className="flex-row items-baseline justify-between mb-6">
        <Text className="text-text-primary" style={h2Style}>Critiques</Text>
        {reviewsCount > 0 && (
          <Pressable onPress={() => setSheetOpen(true)} className="border-b border-accent pb-0.5">
            <Text
              className="text-accent"
              style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 13, lineHeight: 13 }}
            >
              voir toutes
            </Text>
          </Pressable>
        )}
      </View>

      {initialReviews.length === 0 ? (
        <Text className="text-text-tertiary" style={metaStyle}>Aucune critique pour le moment.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {initialReviews.map((review) => <ReviewItem key={review.id} review={review} />)}
        </View>
      )}

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Critiques" snapPoint="70%">
        <View className="flex-row border-b border-border-divider px-6">
          {(['all', 'friends', 'my'] as AlbumReviewsTab[])
            .filter((t) => t === 'all' || (userId && (t === 'my' || hasFollowing)))
            .map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`px-4 py-3 border-b-2 ${tab === t ? 'border-[#1C1C1C]' : 'border-transparent'}`}
              >
                <Text
                  className={tab === t ? 'text-text-primary' : 'text-text-secondary'}
                  style={metaMediumStyle}
                >
                  {t === 'all' ? 'Tous' : t === 'friends' ? 'Amis' : 'Moi'}
                </Text>
              </Pressable>
            ))}
        </View>
        <View className="px-6 py-4" style={{ gap: 10 }}>
          {loading && items.length === 0 ? (
            <Text className="text-text-tertiary text-center py-8" style={metaStyle}>Chargement...</Text>
          ) : items.length === 0 ? (
            <Text className="text-text-tertiary text-center py-8" style={metaStyle}>
              {tab === 'my' ? "Vous n'avez pas encore critiqué cet album" : tab === 'friends' ? "Vos amis n'ont pas encore critiqué cet album" : 'Pas de critiques pour l\'instant'}
            </Text>
          ) : (
            <>
              {items.map((review) => <ReviewItem key={review.id} review={review} />)}
              {hasMore && (
                <Pressable onPress={() => loadReviews(offset, false)} disabled={loading} className="bg-background-secondary rounded-button py-2.5 items-center mt-2">
                  <Text className="text-text-primary" style={metaMediumStyle}>
                    {loading ? 'Chargement...' : 'Charger plus'}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}
