import { Pressable, Text, View } from 'react-native';
import { TrackEntryMenu } from './TrackEntryMenu';
import { h2Style, labelStyle } from '../../lib/typography';
import type { MyTrackDiaryEntry } from '../../lib/trackDiary';

type Props = {
  entry: MyTrackDiaryEntry;
  entriesCount: number;
  onEdit: () => void;
  onAddReview: () => void;
  onDeleted: () => void;
};

/** Miroir de TrackMyListenSection (web) — voir MyListenSection (mobile, albums) pour le pattern. */
export function TrackMyListenSection({ entry, entriesCount, onEdit, onAddReview, onDeleted }: Props) {
  return (
    <View className="border-b border-border-divider pb-12">
      <Text className="text-text-primary mb-4" style={h2Style}>Mon écoute</Text>

      <View className="bg-background-secondary rounded-card p-4 pl-5 relative overflow-hidden">
        <View className="absolute left-0 top-4 bottom-4 w-0.5 bg-accent rounded-r-full" style={{ opacity: 0.5 }} />

        <View className="flex-row items-center justify-between mb-3">
          {entry.rating ? (
            <View className="flex-row items-baseline gap-0.5 bg-[#FAF8F4] border border-accent rounded-badge px-2 py-1">
              <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 18, lineHeight: 18, paddingRight: 3 }}>
                {entry.rating}
              </Text>
              <Text className="uppercase text-accent" style={{ fontFamily: 'Inter_400Regular', fontSize: 9, letterSpacing: 1.44, opacity: 0.7 }}>
                /10
              </Text>
            </View>
          ) : <View />}
          <TrackEntryMenu entryId={entry.id} onEdit={onEdit} onDeleted={onDeleted} />
        </View>

        {entry.review_body ? (
          <Text className="text-accent-deep mb-3" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14, lineHeight: 24.5 }}>
            «{' '}{entry.review_body}{' '}»
          </Text>
        ) : (
          <Pressable onPress={onAddReview} className="mb-3">
            <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14, lineHeight: 21 }}>
              + Ajouter une critique
            </Text>
          </Pressable>
        )}

        <View className="self-start bg-[#FAF8F4] border border-rule rounded-pill px-2.5 py-1">
          <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 12, lineHeight: 12 }}>
            {new Date(entry.listened_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </Text>
        </View>
      </View>

      {entriesCount > 1 && (
        <Text className="text-text-tertiary mt-2" style={labelStyle}>
          {entriesCount} écoutes enregistrées
        </Text>
      )}
    </View>
  );
}
