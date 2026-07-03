import { Linking, Pressable, Text, View } from 'react-native';

type Links = {
  spotify?: string | null;
  appleMusic?: string | null;
  deezer?: string | null;
  tidal?: string | null;
};

type Props = {
  links: Links;
  showSeparator?: boolean;
};

export function StreamingLinks({ links, showSeparator = true }: Props) {
  const visible = [
    { key: 'spotify', label: 'Spotify', href: links.spotify },
    { key: 'appleMusic', label: 'Apple Music', href: links.appleMusic },
    { key: 'deezer', label: 'Deezer', href: links.deezer },
    { key: 'tidal', label: 'Tidal', href: links.tidal },
  ].filter((s) => s.href);

  if (visible.length === 0) return null;

  return (
    <View>
      {showSeparator && (
        <View className="flex-row items-center gap-3 mb-2.5">
          <View className="flex-1 h-px bg-rule" />
          <Text className="text-[10px] uppercase text-text-tertiary" style={{ letterSpacing: 1.5 }}>
            Écouter sur
          </Text>
          <View className="flex-1 h-px bg-rule" />
        </View>
      )}
      <View className="flex-row items-center justify-center flex-wrap gap-x-3.5 gap-y-1.5">
        {visible.map((s, i) => (
          <View key={s.key} className="flex-row items-center gap-3.5">
            <Pressable onPress={() => Linking.openURL(s.href!)}>
              <Text className="text-sm text-text-secondary" style={{ fontFamily: 'Inter_400Regular' }}>
                {s.label}
              </Text>
            </Pressable>
            {i < visible.length - 1 && <Text className="text-text-disabled">·</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
