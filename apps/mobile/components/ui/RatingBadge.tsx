import { Text, View } from 'react-native';

/**
 * Badge de note "x /10" — pastille accent (bg-paper-hi, border-accent, chiffre en
 * serif italique). Extrait de GroupCoverStack.tsx (où il vivait sous le nom
 * GroupRatingBadge, utilisé par LikeGroupCard/ListenGroupCard) pour être réutilisé
 * partout où une note est affichée sur une cover ou dans une carte (Journal/Critiques
 * du profil, groupes du feed).
 */
export function RatingBadge({ rating }: { rating?: number | null }) {
  if (rating == null) return null;

  return (
    <View className="bg-paper-hi border border-accent rounded-badge px-1.5 py-0.5">
      <Text className="text-accent text-[13px]" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', lineHeight: 14, paddingRight: 2 }}>
        {Math.round(rating)}
        <Text style={{ fontSize: 7, fontFamily: 'Inter_400Regular', letterSpacing: 0.5 }}> /10</Text>
      </Text>
    </View>
  );
}
