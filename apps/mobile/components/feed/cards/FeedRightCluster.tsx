import { Text, View } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import { CoverImage } from '../../album/CoverImage';

type Props = {
  rating?: number | null;
  coverUrl?: string | null;
};

/** Cover + badge de note empilés à droite de la ligne de feed. */
export function FeedRightCluster({ rating, coverUrl }: Props) {
  return (
    <View style={{ alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
      <View className="w-11 h-11 rounded-cover-sm overflow-hidden bg-background-secondary">
        {coverUrl ? (
          <CoverImage src={coverUrl} style={{ width: '100%', height: '100%' }} placeholder={<CoverFallback />} />
        ) : (
          <CoverFallback />
        )}
      </View>
      {rating != null && (
        <View className="bg-paper-hi border border-accent rounded-badge px-1.5 py-0.5">
          <Text
            className="text-accent text-[13px]"
            style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', lineHeight: 14 }}
          >
            {Math.round(rating)}
            <Text style={{ fontSize: 7, fontFamily: 'Inter_400Regular', letterSpacing: 0.5 }}> /10</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

function CoverFallback() {
  return (
    <View className="w-full h-full items-center justify-center">
      <Disc3 size={16} color="#BDBDBD" />
    </View>
  );
}
