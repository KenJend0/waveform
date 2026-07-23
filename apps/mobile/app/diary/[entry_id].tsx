import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Share2, Link2, Flag } from 'lucide-react-native';
import { BackButton } from '../../components/ui/BackButton';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Avatar } from '../../components/avatars/Avatar';
import { AlbumEntryMenu } from '../../components/album/AlbumEntryMenu';
import { DiaryEntryBottomSheet } from '../../components/album/DiaryEntryBottomSheet';
import { LikesBottomSheet } from '../../components/ui/LikesBottomSheet';
import { CommentThread } from '../../components/social/CommentThread';
import { showToast } from '../../components/ui/Toast';
import { useAuth } from '../../lib/AuthContext';
import { getDiaryEntry, getEntryComments, type DiaryEntryDetail } from '../../lib/diary';
import { toggleDiaryLike, addComment, deleteComment } from '../../lib/feed';
import { reportContent } from '../../lib/moderation';
import { ensureProfile } from '../../lib/profile';
import { creditParts } from '../../lib/creditedArtists';
import { metaStyle, labelStyle } from '../../lib/typography';

function relativeTime(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`;
}

const SITE_URL = 'https://sillon.fm';

/** Miroir de apps/web/app/diary/[entry_id]/DiaryEntryClient.tsx — détail d'une écoute album. */
export default function DiaryEntryPage() {
  const { entry_id, scrollTo } = useLocalSearchParams<{ entry_id: string; scrollTo?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const commentsY = useRef(0);
  const scrolledToComments = useRef(false);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [entry, setEntry] = useState<DiaryEntryDetail | null>(null);
  const [composerAvatarUrl, setComposerAvatarUrl] = useState<string | null>(null);

  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [liking, setLiking] = useState(false);
  const [showLikesSheet, setShowLikesSheet] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!entry_id) return;
    const result = await getDiaryEntry(entry_id);
    if (!result.success) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setEntry(result.data);
    setHasLiked(result.data.has_liked);
    setLikesCount(result.data.stats.likes_count);
    setLoading(false);
  }, [entry_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    ensureProfile().then((profile) => setComposerAvatarUrl(profile?.avatar_url ?? null));
  }, [user]);

  const refreshComments = useCallback(async () => {
    if (!entry_id) return;
    const comments = await getEntryComments(entry_id);
    setEntry((prev) => (prev ? { ...prev, comments } : prev));
  }, [entry_id]);

  const handleLike = async () => {
    if (!user) { showToast('Connecte-toi pour aimer cette entrée', 'error'); return; }
    if (liking || !entry) return;
    const prevLiked = hasLiked;
    const prevCount = likesCount;
    setHasLiked(!prevLiked);
    setLikesCount(!prevLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
    setLiking(true);
    try {
      await toggleDiaryLike(entry.id);
    } catch {
      setHasLiked(prevLiked);
      setLikesCount(prevCount);
      showToast("Impossible d'aimer cette entrée", 'error');
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    if (!entry) return;
    try {
      await Share.share({ url: `${SITE_URL}/diary/${entry.id}`, message: `${SITE_URL}/diary/${entry.id}` });
    } catch {}
  };

  const handleCopyLink = async () => {
    if (!entry) return;
    await Clipboard.setStringAsync(`${SITE_URL}/diary/${entry.id}`);
    showToast('Lien copié', 'success');
  };

  const handleReportEntry = async () => {
    if (!entry) return;
    const result = await reportContent('diary_entry', entry.id);
    showToast(result.success ? 'Contenu signalé — merci' : (result.error ?? 'Erreur'), result.success ? 'success' : 'error');
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (notFound || !entry) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 pt-4">
          <BackButton label="Journal" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-text-tertiary text-center" style={metaStyle}>Cette écoute est introuvable.</Text>
        </View>
      </View>
    );
  }

  const isAuthor = user?.id === entry.author.id;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4">
          <BackButton label="Journal" />

          {/* ── Album hero ─────────────────────────────────────────── */}
          <View className="mt-4 pb-5 border-b border-border flex-row gap-4 items-end">
            <Pressable onPress={() => router.push(`/albums/${entry.album.id}` as any)}>
              <View className="w-[84px] h-[84px] rounded-cover overflow-hidden bg-background-secondary">
                {entry.album.cover_url && (
                  <Image source={{ uri: entry.album.cover_url }} style={{ width: 84, height: 84 }} contentFit="cover" transition={150} />
                )}
              </View>
            </Pressable>
            <View className="flex-1 pb-1">
              <Text className="text-text-tertiary mb-1" style={[labelStyle, { fontSize: 9.5 }]}>ALBUM</Text>
              <Pressable onPress={() => router.push(`/albums/${entry.album.id}` as any)}>
                <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 28, lineHeight: 30 }}>
                  {entry.album.title}
                </Text>
              </Pressable>
              <View className="flex-row items-baseline flex-wrap gap-2 mt-1.5">
                <Text className="text-text-secondary" style={[metaStyle, { fontFamily: 'Inter_500Medium', fontSize: 13.5 }]}>
                  {creditParts(entry.artist, entry.featuredArtists).map((part, i) => (
                    <Text key={part.artist.id || i}>
                      {part.prefix}
                      <Text onPress={() => router.push(`/artists/${part.artist.id}` as any)}>{part.artist.name}</Text>
                    </Text>
                  ))}
                </Text>
                {entry.album.release_date && (
                  <Text className="text-text-tertiary" style={[labelStyle, { fontSize: 12, textTransform: 'none', letterSpacing: 0 }]}>
                    · {new Date(entry.album.release_date).getFullYear()}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* ── Critique block ───────────────────────────────────────── */}
          <View className="relative pl-4 mt-5">
            <View className="absolute left-0 top-2 bottom-4 w-0.5 bg-accent rounded-full" style={{ opacity: 0.55 }} />

            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => router.push(`/u/${entry.author.username}` as any)}>
                <Avatar src={entry.author.avatar_url} size={34} />
              </Pressable>
              <View className="flex-1">
                <Text className="text-text-secondary" style={metaStyle}>
                  Une écoute de{' '}
                  <Text className="text-text-warm" style={{ fontFamily: 'Inter_500Medium' }}>{entry.author.username}</Text>
                  {entry.re_listen && <Text className="text-text-disabled"> · ré-écoute</Text>}
                </Text>
                <Text className="text-text-disabled mt-1" style={[labelStyle, { fontSize: 11, textTransform: 'none', letterSpacing: 0.3 }]}>
                  {relativeTime(entry.listened_at)}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Pressable onPress={handleShare} hitSlop={8} className="p-1.5">
                  <Share2 size={16} color="#9A9A9A" />
                </Pressable>
                <Pressable onPress={handleCopyLink} hitSlop={8} className="p-1.5">
                  <Link2 size={16} color="#9A9A9A" />
                </Pressable>
                {isAuthor ? (
                  <AlbumEntryMenu
                    entryId={entry.id}
                    onEdit={() => setEditSheetOpen(true)}
                    onDeleted={() => router.replace('/me' as any)}
                  />
                ) : user ? (
                  <Pressable onPress={handleReportEntry} hitSlop={8} className="p-1.5">
                    <Flag size={16} color="#9A9A9A" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {entry.rating !== null && (
              <View className="flex-row items-baseline gap-1 mt-5">
                <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 48, lineHeight: 44, color: '#5C4538' }}>
                  {entry.rating}
                </Text>
                <Text className="text-accent ml-0.5" style={[labelStyle, { fontSize: 10, opacity: 0.75 }]}>/10</Text>
              </View>
            )}

            {entry.review_body && (
              <Text
                className="text-accent-deep mt-4"
                style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 16, lineHeight: 24 }}
              >
                «{' '}{entry.review_body.trim()}{' '}»
              </Text>
            )}

            <View className="h-px bg-rule mt-5" style={{ opacity: 0.7 }} />
            <View className="flex-row items-center gap-1 mt-3">
              <Pressable onPress={handleLike} disabled={liking} hitSlop={8} className="flex-row items-center gap-1" style={{ opacity: liking ? 0.5 : 1 }}>
                <Heart size={15} color={hasLiked ? '#C86C6C' : '#9A9A9A'} fill={hasLiked ? '#C86C6C' : 'none'} />
              </Pressable>
              {likesCount > 0 ? (
                <Pressable onPress={() => setShowLikesSheet(true)} className="flex-row items-baseline gap-1.5 ml-1">
                  <Text style={[metaStyle, { color: hasLiked ? '#C86C6C' : '#9A9A9A' }]}>{likesCount}</Text>
                  <Text style={[metaStyle, { color: hasLiked ? '#C86C6C' : '#9A9A9A' }]}>J&apos;aime</Text>
                </Pressable>
              ) : (
                <Text className="text-text-tertiary ml-2" style={metaStyle}>J&apos;aime</Text>
              )}
            </View>
          </View>

          {!user && (
            <View className="mt-4 px-4 py-3.5 bg-paper-hi border border-border rounded-card">
              <Text className="text-text-secondary" style={metaStyle}>
                <Text className="text-text-warm" style={{ fontFamily: 'Inter_500Medium', textDecorationLine: 'underline' }} onPress={() => router.push('/(auth)/login' as any)}>
                  Connecte-toi
                </Text>
                {' '}pour liker et commenter cette écoute.
              </Text>
            </View>
          )}

          <LikesBottomSheet entryId={entry.id} isOpen={showLikesSheet} onClose={() => setShowLikesSheet(false)} count={likesCount} />

          {/* ── CTA ────────────────────────────────────────────────── */}
          <Pressable
            onPress={() => router.push(`/albums/${entry.album.id}?scrollTo=reviews` as any)}
            className="mt-5 flex-row items-center justify-between gap-3 px-4 py-3.5 bg-background-secondary border border-border rounded-input"
          >
            <View style={{ gap: 2 }}>
              <Text className="text-text-tertiary" style={[labelStyle, { fontSize: 9.5 }]}>CONTINUER LA LECTURE</Text>
              <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 16 }}>
                Les <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: '#5C4538' }}>critiques</Text> de cet album
              </Text>
            </View>
            <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 18, color: '#8E6F5E' }}>→</Text>
          </Pressable>

          <View
            onLayout={(e) => {
              commentsY.current = e.nativeEvent.layout.y;
              if (scrollTo === 'comments' && !scrolledToComments.current) {
                scrolledToComments.current = true;
                scrollViewRef.current?.scrollTo({ y: commentsY.current - 16, animated: true });
              }
            }}
          >
            <CommentThread
              comments={entry.comments}
              currentUserId={user?.id ?? null}
              isAuthor={isAuthor}
              composerAvatarUrl={composerAvatarUrl}
              scrollViewRef={scrollViewRef}
              onAddComment={async (body) => { await addComment(entry.id, body); await refreshComments(); }}
              onAddReply={async (parentId, body) => { await addComment(entry.id, body, parentId); await refreshComments(); }}
              onDelete={async (commentId) => { await deleteComment(commentId); await refreshComments(); }}
              onReport={async (commentId) => { const r = await reportContent('diary_comment', commentId); if (!r.success) throw new Error(r.error); }}
            />
          </View>
        </View>
      </ScrollView>

      <DiaryEntryBottomSheet
        isOpen={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        albumId={entry.album.id}
        editingEntry={{ id: entry.id, rating: entry.rating, review_body: entry.review_body, listened_at: entry.listened_at, created_at: entry.created_at }}
        onSaved={load}
      />
    </View>
  );
}
