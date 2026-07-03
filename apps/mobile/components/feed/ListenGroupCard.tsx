import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Disc3 } from 'lucide-react-native';
import { getTimeAgo } from '../../lib/formatDate';
import { Avatar } from '../Avatar';
import { ActorLink } from './ActorLink';
import { CoverImage } from '../CoverImage';
import { GroupCoverStack, GroupRatingBadge } from './GroupCoverStack';
import { formatPreviewTitles, type ListenGroup } from './groupFeedEvents';

type Props = { group: ListenGroup; currentUserId?: string };

/** Carte dépliable pour les écoutes rapprochées — miroir de ListenGroupCard (web). */
export function ListenGroupCard({ group, currentUserId }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(group.created_at);
  const isMe = currentUserId === group.actor.id;
  const total = group.items.length;
  const ratedCount = group.items.filter((item) => item.rating != null).length;
  const trackItems = group.items.filter((item) => item.kind === 'track');
  const albumTitleCounts = new Map<string, number>();
  for (const item of trackItems) {
    if (!item.albumTitle) continue;
    albumTitleCounts.set(item.albumTitle, (albumTitleCounts.get(item.albumTitle) ?? 0) + 1);
  }
  const dominantAlbum = [...albumTitleCounts.entries()].find(([, count]) => count >= 3 && count === trackItems.length)?.[0];
  const previewTitles = formatPreviewTitles(group.items.slice(0, 3).map((item) => item.title));
  const previewIsPartial = total > 3;

  const action = dominantAlbum
    ? `a noté ${total} titres de ${dominantAlbum}${previewIsPartial ? ' dont' : ''}`
    : ratedCount === total
      ? `a noté ${total} écoutes${previewIsPartial ? ' dont' : ''}`
      : ratedCount === 0
        ? `a ajouté ${total} écoutes${previewIsPartial ? ' dont' : ''}`
        : `a écouté ${total} titres, dont ${ratedCount} noté${ratedCount > 1 ? 's' : ''}`;

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center gap-3 px-6 py-2"
      >
        <Avatar src={group.actor.avatar_url} size={32} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9A9A9A' }}>
            {isMe ? (
              action.replace('a ', 'Tu as ')
            ) : (
              <>
                <ActorLink username={group.actor.username} />
                {` ${action}`}
              </>
            )}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 14, fontFamily: 'InstrumentSerif_400Regular', color: '#2A2520', flexShrink: 1 }}
            >
              {previewTitles}
            </Text>
            <Text style={{ color: '#BDBDBD', fontFamily: 'Inter_400Regular', fontSize: 13, flexShrink: 0 }}>
              {' '}
              · {timeAgo}
            </Text>
          </View>
        </View>

        <View className="items-center justify-center w-7 h-7 rounded-full">
          {expanded ? <ChevronUp size={16} color="#9A9A9A" /> : <ChevronDown size={16} color="#9A9A9A" />}
        </View>

        <GroupCoverStack items={group.items} />
      </Pressable>

      {expanded && (
        <View className="mt-2 ml-14 pl-3 pr-6 border-l border-rule" style={{ gap: 6 }}>
          {group.items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.href as any)}
              className="flex-row items-center gap-2 py-1"
            >
              <View className="w-8 h-8 rounded-cover-sm overflow-hidden bg-background-secondary">
                {item.coverUrl ? (
                  <CoverImage
                    src={item.coverUrl}
                    style={{ width: '100%', height: '100%' }}
                    placeholder={
                      <View className="w-full h-full items-center justify-center">
                        <Disc3 size={13} color="#BDBDBD" />
                      </View>
                    }
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Disc3 size={13} color="#BDBDBD" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'InstrumentSerif_400Regular', color: '#2A2520' }}>
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9A9A9A' }}>
                    {item.subtitle}
                  </Text>
                )}
              </View>
              <GroupRatingBadge rating={item.rating} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
