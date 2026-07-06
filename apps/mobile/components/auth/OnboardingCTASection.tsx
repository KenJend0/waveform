import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { h2Style, smStyle } from '../../lib/typography';

/**
 * Miroir de OnboardingCTASection (web) — affiché à la place de "Pour toi" quand
 * tier === 'new'. Ne remplace PAS le flow d'onboarding complet (choix de username,
 * comptes suggérés) : ce flow n'existe pas côté mobile, hors scope de cette passe
 * (voir notes de scope de la Phase 7 "Explore" dans MOBILE_ROADMAP.md).
 */
export function OnboardingCTASection() {
  const router = useRouter();

  return (
    <View>
      <View className="mb-3">
        <Text style={h2Style} className="text-text-primary">
          Pour <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">toi</Text>
        </Text>
        <Text style={smStyle} className="text-text-secondary mt-1">
          Note tes premiers albums pour débloquer des recommandations personnalisées.
        </Text>
      </View>
      <View className="flex-row items-center gap-4 bg-background-secondary border border-border rounded-card p-5">
        <View className="w-11 h-11 rounded-full bg-paper-hi border border-border items-center justify-center">
          <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 20 }} className="text-accent">
            +
          </Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-text-primary" style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            Ton journal est encore vide
          </Text>
          <Text className="text-text-secondary mt-0.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            Note quelques albums pour qu'on commence à cerner tes goûts.
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/add' as any)}>
          <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14 }}>
            noter un album
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
