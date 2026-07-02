import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Fraction de l'écran (0–1), reprend le rôle de maxHeight côté web. */
  snapPoint?: `${number}%`;
};

/** Modale qui remonte du bas — wrapper autour de @gorhom/bottom-sheet (gestes natifs, pas de réimplémentation maison). */
export function BottomSheet({ isOpen, onClose, title, children, snapPoint = '50%' }: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [snapPoint], [snapPoint]);

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
      handleIndicatorStyle={{ backgroundColor: '#D8D3CB' }}
    >
      <View className="flex-row items-center justify-between px-6 pb-4 border-b border-border-divider">
        <Text className="text-[15px] text-text-primary" style={{ fontFamily: 'Inter_500Medium' }}>
          {title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} className="p-1.5 rounded-button">
          <X size={18} color="#6B6B6B" />
        </Pressable>
      </View>
      <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}
