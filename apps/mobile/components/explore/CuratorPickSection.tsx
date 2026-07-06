import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CoverImage } from '../album/CoverImage';
import { Avatar } from '../avatars/Avatar';
import { type CuratorPick } from '../../lib/curator';
import { smStyle } from '../../lib/typography';

function ExpandableNote({ note, fontSize, clampLines }: { note: string; fontSize: number; clampLines: number }) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textStyle = { fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize, lineHeight: fontSize * 1.35 };

  return (
    <View>
      {/* Mesure du nombre de lignes réel — avec numberOfLines, onTextLayout ne rapporte
       * que les lignes déjà tronquées côté RN (contrairement à scrollHeight/clientHeight
       * sur le web) : on ne peut donc pas détecter le dépassement sur le Text visible
       * lui-même, il faut une copie invisible sans troncature pour mesurer. */}
      {!canExpand && (
        <Text
          style={[textStyle, { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 }]}
          onTextLayout={(e) => {
            if (e.nativeEvent.lines.length > clampLines) setCanExpand(true);
          }}
        >
          « {note.trim()} »
        </Text>
      )}
      <Text
        numberOfLines={expanded ? undefined : clampLines}
        style={textStyle}
        className="text-accent-deep"
      >
        « {note.trim()} »
      </Text>
      {canExpand && (
        <Pressable onPress={() => setExpanded((v) => !v)} className="self-start mt-1 border-b border-accent">
          <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 12.5 }}>
            {expanded ? 'voir moins' : 'voir plus'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function CuratorPickSection({ pick }: { pick: CuratorPick }) {
  const router = useRouter();

  return (
    <View>
      <View className="mb-4">
        <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 22 }} className="text-text-primary">
          La <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">sélection</Text> de {pick.curator_username}
        </Text>
      </View>

      <Pressable
        onPress={() => router.push(`/albums/${pick.album_id}` as any)}
        className="bg-paper-hi border border-accent rounded-card-lg p-4"
      >
        <View className="flex-row items-center gap-1.5 mb-3">
          <View className="rounded-full overflow-hidden border border-rule" style={{ width: 24, height: 24 }}>
            <Avatar src={pick.curator_avatar} size={24} />
          </View>
          <Text numberOfLines={1} className="text-text-primary flex-1" style={{ fontSize: 11.5 }}>
            Sélectionné par <Text className="text-accent-deep" style={{ fontFamily: 'Inter_500Medium' }}>{pick.curator_username}</Text> · créateur
          </Text>
        </View>
        <View className="flex-row gap-3">
          <View className="shrink-0 relative" style={{ width: 92 }}>
            <View className="aspect-square rounded-cover overflow-hidden bg-background-secondary">
              {pick.cover_url ? (
                <CoverImage src={pick.cover_url} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
              ) : (
                <View className="w-full h-full bg-background-tertiary" />
              )}
            </View>
          </View>
          <View className="flex-1 min-w-0">
            <Text numberOfLines={2} style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 19, lineHeight: 21 }} className="text-text-warm">
              {pick.album_title}
            </Text>
            <Text style={smStyle} className="text-text-secondary mt-0.5 mb-1.5" numberOfLines={1}>
              {pick.artist_name}{pick.release_year ? ` — ${pick.release_year}` : ''}
            </Text>
            <ExpandableNote note={pick.note} fontSize={13.5} clampLines={3} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
