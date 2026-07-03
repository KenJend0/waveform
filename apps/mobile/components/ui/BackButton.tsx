import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

type Props = {
  label?: string;
  className?: string;
};

/**
 * Le retour natif (swipe iOS, bouton hardware Android) est déjà géré par le Stack
 * navigator de chaque tab — ce composant n'est qu'un bouton stylé pour les endroits
 * où on veut un affordance de retour visible en plus.
 */
export function BackButton({ label = 'Retour', className }: Props) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
      hitSlop={8}
      className={`flex-row items-center gap-1 ${className ?? ''}`}
    >
      <ChevronLeft size={18} color="#6B6B6B" />
      <Text className="text-[13px] text-text-secondary" style={{ fontFamily: 'Inter_400Regular' }}>
        {label}
      </Text>
    </Pressable>
  );
}
