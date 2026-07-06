import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CoverImage } from '../album/CoverImage';
import { labelStyle } from '../../lib/typography';

function TrendBadge({ delta }: { delta?: number | null }) {
  if (delta === undefined) return null;
  if (delta === null) {
    return <View className="w-1.5 h-1.5 rounded-full bg-blue-500" />;
  }
  if (delta === 0) {
    return <Text className="text-text-tertiary" style={labelStyle}>=</Text>;
  }
  const isUp = delta > 0;
  return (
    <Text className={isUp ? 'text-sage' : 'text-like'} style={labelStyle}>
      {isUp ? '▲' : '▼'} {Math.abs(delta)}
    </Text>
  );
}

type Props = {
  href: string;
  rank: number;
  cover_url: string;
  title: string;
  subtitle: string;
  delta?: number | null;
};

/** Miroir de ChartRow (web) — ligne de classement pour Tendances/Découverte "voir tout". */
export function ChartRow({ href, rank, cover_url, title, subtitle, delta }: Props) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href as any)}
      className="flex-row items-center gap-3 py-2.5 border-t border-border-divider"
      style={{ borderTopWidth: rank === 1 ? 0 : 1 }}
    >
      <Text className="text-accent w-6 text-center" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 24 }}>
        {rank}
      </Text>
      <View className="w-12 h-12 rounded-cover-sm overflow-hidden bg-background-secondary">
        {cover_url ? (
          <CoverImage src={cover_url} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
        ) : (
          <View className="w-full h-full bg-background-tertiary" />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text numberOfLines={1} className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 14 }}>
          {title}
        </Text>
        <Text numberOfLines={1} className="text-text-tertiary mt-0.5" style={labelStyle}>
          {subtitle}
        </Text>
      </View>
      <TrendBadge delta={delta} />
    </Pressable>
  );
}
