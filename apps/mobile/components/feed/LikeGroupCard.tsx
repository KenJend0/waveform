import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Disc3 } from 'lucide-react-native';
import { getTimeAgo } from '../../lib/formatDate';
import { ActorLink } from './ActorLink';
import { CoverImage } from '../CoverImage';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { GroupCoverStack, GroupRatingBadge } from './GroupCoverStack';
import { formatPreviewTitles, type LikeGroup } from './groupFeedEvents';

type Props = { group: LikeGroup; currentUserId?: string };

/** Carte dépliable pour les likes rapprochés — miroir de LikeGroupCard (web). */
export function LikeGroupCard({ group, currentUserId }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(group.created_at);
  const isMe = currentUserId === group.actor.id;
  const total = group.items.length;
  const myCount = group.items.filter((i) => i.isMyEntry).length;
  const previewTitles = formatPreviewTitles(group.items.slice(0, 3).map((item) => item.title));
  const previewIsPartial = total > 3;

  const action = isMe
    ? `Tu as aimé ${total} écoutes${previewIsPartial ? ' dont' : ''}`
    : myCount === total
      ? `a aimé ${total} de tes écoutes${previewIsPartial ? ' dont' : ''}`
      : myCount === 0
        ? `a aimé ${total} écoutes${previewIsPartial ? ' dont' : ''}`
        : `a aimé ${total} écoutes dont ${myCount} des tiennes`;

  return (
    <View>
      <Pressable onPress={() => setExpanded((prev) => !prev)} className="flex-row items-center gap-3 px-6 py-2">
        <FeedAvatarCluster actor={group.actor} glyph="like" size={32} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9A9A9A' }}>
            {isMe ? (
              action
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
