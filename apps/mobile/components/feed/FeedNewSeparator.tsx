import { Text, View } from 'react-native';

type Props = {
  label: string;
  /** La carte juste au-dessus est une critique (bordure + label qui chevauche le haut de sa
   * bordure) — lui laisser un peu plus d'air au-dessus du filet, sinon le filet colle à sa
   * bordure. */
  leadingCritique?: boolean;
};

/** Filet séparant les événements déjà vus des nouveaux — miroir de FeedNewSeparator (web). */
export function FeedNewSeparator({ label, leadingCritique }: Props) {
  return (
    <View className={`${leadingCritique ? 'mt-5' : 'mt-3'} mb-3 px-3 flex-row items-center gap-3`}>
      <View className="h-px flex-1 bg-rule" />
      <View className="rounded-full border border-rule bg-paper-hi px-3 py-1">
        <Text
          className="text-accent text-[14px]"
          style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', lineHeight: 16 }}
        >
          {label}
        </Text>
      </View>
      <View className="h-px flex-1 bg-rule" />
    </View>
  );
}
