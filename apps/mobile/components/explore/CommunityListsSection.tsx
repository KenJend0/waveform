import { Pressable, Text, View } from 'react-native';
import { ListCard } from '../profile/ListCard';
import { showToast } from '../ui/Toast';
import { type ProfileListUI } from '../../lib/lists';
import { h2Style, smStyle } from '../../lib/typography';

/**
 * Section bonus "Listes populaires" — présente sur le web (CommunityListsSection,
 * inline dans app/explore/page.tsx) mais absente du checklist Phase 7 d'origine.
 * "voir tout" mène à /lists (web) — pas encore de page mobile équivalente (Phase 7
 * "Listes" séparée, pas commencée) : affiche un toast au lieu de naviguer.
 */
export function CommunityListsSection({ lists }: { lists: ProfileListUI[] }) {
  if (lists.length === 0) return null;

  return (
    <View>
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1 pr-3">
          <Text style={h2Style} className="text-text-primary">
            Listes <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">populaires</Text>
          </Text>
          <Text style={smStyle} className="text-text-secondary mt-1">
            Sélections musicales partagées par la communauté.
          </Text>
        </View>
        <Pressable onPress={() => showToast('Bientôt disponible', 'info')} className="border-b border-accent pb-0.5">
          <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14 }}>
            voir tout
          </Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap justify-between" style={{ rowGap: 20 }}>
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </View>
    </View>
  );
}
