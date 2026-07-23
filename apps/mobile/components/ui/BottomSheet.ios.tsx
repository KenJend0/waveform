import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Fraction de l'écran (0–1), reprend le rôle de maxHeight côté web. */
  snapPoint?: `${number}%`;
};

/**
 * Modale qui remonte du bas — wrapper autour de @expo/ui/community/bottom-sheet
 * (sheet natif : SwiftUI sur iOS, Material 3 ModalBottomSheet sur Android), pas de
 * réimplémentation maison. @gorhom/bottom-sheet (Phase 5) a été abandonné : sa v5 est
 * incompatible avec react-native-reanimated v4 (requis par newArchEnabled côté Expo 57) —
 * present() ne déclenchait aucune animation, sheet invisible sans erreur ni log
 * (https://github.com/gorhom/react-native-bottom-sheet/issues/2546). @expo/ui expose une
 * API drop-in compatible (mêmes méthodes présent/dismiss, mêmes props) sans dépendre de
 * Reanimated pour l'animation du sheet.
 */
export function BottomSheet({ isOpen, onClose, title, children, snapPoint = '50%' }: Props) {
  const ref = useRef<BottomSheetModal>(null);
  // Deux points même quand un seul est voulu : le composant Android sous-jacent
  // (Material3 ModalBottomSheet) saute l'état "partiellement ouvert" et ouvre direct
  // en plein écran dès que `snapPoints.length <= 1` (skipPartiallyExpanded devient
  // true dans ce cas — voir @expo/ui/community/bottom-sheet/BottomSheet.android.tsx).
  // present() ouvre à index=0 (le premier point), donc le second point n'est ici
  // qu'un palier "expand" jamais atteint en pratique — juste pour désactiver ce skip.
  const snapPoints = useMemo(() => [snapPoint, '95%' as const], [snapPoint]);

  useEffect(() => {
    if (isOpen) ref.current?.present();
    else ref.current?.dismiss();
  }, [isOpen]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: '#F5F3EF' }}
    >
      {/* Titre centré, quel que soit sa longueur : espaceur invisible à gauche de la même
          largeur que le bouton fermer à droite, plutôt qu'un simple justify-between qui
          pousse le titre à gauche. */}
      <View className="flex-row items-center px-6 pb-4 border-b border-border-divider">
        <View style={{ width: 30 }} />
        <Text className="flex-1 text-center text-[15px] text-text-primary" style={{ fontFamily: 'Inter_500Medium' }}>
          {title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} className="p-1.5 rounded-button" style={{ width: 30, alignItems: 'flex-end' }}>
          <X size={18} color="#6B6B6B" />
        </Pressable>
      </View>
      <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}
