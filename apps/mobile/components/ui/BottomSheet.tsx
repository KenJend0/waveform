import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  type KeyboardEvent,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Fraction de l'écran (0–1), reprend le rôle de maxHeight côté web. Hauteur "compacte" par défaut à l'ouverture. */
  snapPoint?: `${number}%`;
};

const ANIM_MS = 220;
const EXPANDED_FRACTION = 0.92;
const VELOCITY_THRESHOLD = 0.5;

/**
 * Implémentation maison (RN Modal + Animated core, sans Reanimated ni lib tierce) —
 * utilisée sur Android et web (voir BottomSheet.ios.tsx pour iOS, qui utilise
 * @expo/ui/community/bottom-sheet). @expo/ui a plusieurs bugs natifs non résolus côté
 * Android au moment de l'écriture — contenu invisible, crash partialExpand quand
 * plusieurs snap points sont fournis (github.com/expo/expo issues #46302, #46379,
 * #46941) — donc pas encore fiable sur cette plateforme.
 *
 * Deux paliers, comme un vrai sheet natif : "compact" (snapPoint, ouverture par
 * défaut) et "étendu" (92% de l'écran). Glisser la poignée vers le haut étend,
 * vers le bas replie puis ferme.
 */
export function BottomSheet({ isOpen, onClose, title, children, snapPoint = '50%' }: Props) {
  const [mounted, setMounted] = useState(isOpen);
  const screenHeight = Dimensions.get('window').height;
  const compactHeight = screenHeight * Math.min(Math.max(parseFloat(snapPoint) / 100, 0.1), 0.95);
  const expandedHeight = screenHeight * EXPANDED_FRACTION;

  // Le conteneur a une hauteur fixe (expandedHeight) ; on ne montre que le bas via translateY.
  // closedY = tout en dehors de l'écran, compactY = ne montre que compactHeight, expandedY = 0 (tout visible).
  const closedY = expandedHeight;
  const compactY = expandedHeight - compactHeight;
  const expandedY = 0;

  const translateY = useRef(new Animated.Value(closedY)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentY = useRef(closedY);
  const dragBaseY = useRef(closedY);
  // Palier "au repos" courant (compact ou étendu), hors drag/fermeture — sert de référence
  // pour recaler le sheet quand le clavier apparaît/disparaît (voir effet clavier plus bas).
  const restingRef = useRef<'compact' | 'expanded'>('compact');
  const keyboardHeightRef = useRef(0);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { currentY.current = value; });
    return () => translateY.removeListener(id);
  }, [translateY]);

  // N'anime que translateY/backdrop, sans toucher au palier de repos mémorisé — utilisé
  // par la compensation clavier ci-dessous, qui décale temporairement le sheet sans que
  // ça compte comme un nouveau palier "compact"/"étendu" choisi par l'utilisateur.
  const animateRaw = (target: number, onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: target,
        duration: ANIM_MS,
        easing: target === closedY ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        // 0.45 max — assombrit sans masquer complètement la page derrière (vrai bottom sheet, pas un modal opaque).
        toValue: target === closedY ? 0 : 0.45,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
    ]).start(() => onDone?.());
  };

  const animateTo = (target: number, onDone?: () => void) => {
    if (target === compactY) restingRef.current = 'compact';
    else if (target === expandedY) restingRef.current = 'expanded';
    animateRaw(target, onDone);
  };

  // Le clavier peut couvrir entièrement un TextInput quand le sheet est en position
  // "compact" (souvent plus bas que la hauteur du clavier) — le KeyboardAvoidingView
  // ci-dessous ne fait que rajouter du padding interne, il ne déplace pas le sheet
  // lui-même. On remonte donc explicitement le sheet de la hauteur du clavier à
  // l'ouverture, et on revient au palier de repos à la fermeture.
  const hideRepositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      if (hideRepositionTimer.current) {
        clearTimeout(hideRepositionTimer.current);
        hideRepositionTimer.current = null;
      }
      if (!mounted) return;
      const kbHeight = e.endCoordinates?.height ?? 0;
      keyboardHeightRef.current = kbHeight;
      const base = restingRef.current === 'expanded' ? expandedY : compactY;
      animateRaw(Math.max(expandedY, base - kbHeight));
    };
    const onHide = () => {
      keyboardHeightRef.current = 0;
      // Taper un bouton pendant que le clavier est ouvert lui fait perdre le focus
      // (comportement normal iOS), ce qui déclenche keyboardWillHide EN PLEIN geste — si on
      // repositionne le sheet tout de suite, le bouton bouge sous le doigt et RN annule le
      // tap en cours (deuxième tap nécessaire pour que l'action passe). On laisse le temps
      // au press en cours de se terminer avant de redescendre le sheet.
      if (hideRepositionTimer.current) clearTimeout(hideRepositionTimer.current);
      hideRepositionTimer.current = setTimeout(() => {
        hideRepositionTimer.current = null;
        if (!mounted) return;
        animateRaw(restingRef.current === 'expanded' ? expandedY : compactY);
      }, 120);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      if (hideRepositionTimer.current) clearTimeout(hideRepositionTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, compactY, expandedY]);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else if (mounted) {
      animateTo(closedY, () => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (mounted && isOpen) {
      translateY.setValue(closedY);
      animateTo(compactY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const requestClose = () => animateTo(closedY, () => { setMounted(false); onClose(); });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        dragBaseY.current = currentY.current;
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(closedY, Math.max(expandedY, dragBaseY.current + gesture.dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const y = currentY.current;
        const draggingDown = gesture.dy > 0 || gesture.vy > 0;

        if (gesture.vy > VELOCITY_THRESHOLD) {
          // Flick rapide vers le bas : ferme si on était déjà en compact, sinon replie en compact.
          if (dragBaseY.current >= compactY - 1) requestClose();
          else animateTo(compactY);
          return;
        }
        if (gesture.vy < -VELOCITY_THRESHOLD) {
          animateTo(expandedY);
          return;
        }

        // Sans flick net : snap au palier le plus proche (fermé / compact / étendu).
        const distToClosed = Math.abs(y - closedY);
        const distToCompact = Math.abs(y - compactY);
        const distToExpanded = Math.abs(y - expandedY);
        const minDist = Math.min(distToClosed, distToCompact, distToExpanded);

        if (minDist === distToClosed && draggingDown) requestClose();
        else if (minDist === distToExpanded) animateTo(expandedY);
        else animateTo(compactY);
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={requestClose}>
          <Animated.View style={{ flex: 1, backgroundColor: '#1C1C1C', opacity: backdropOpacity }} />
        </Pressable>

        <Animated.View
          style={{
            height: expandedHeight,
            backgroundColor: '#F5F3EF',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            transform: [{ translateY }],
            overflow: 'hidden',
          }}
        >
          <View {...panResponder.panHandlers}>
            <View className="items-center pt-2.5 pb-1.5">
              <View style={{ width: 36, height: 4, borderRadius: 2 }} className="bg-border" />
            </View>
            <View className="px-6 pb-4 border-b border-border-divider items-center">
              <Text className="text-[15px] text-text-primary" style={{ fontFamily: 'Inter_500Medium' }}>
                {title}
              </Text>
            </View>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Pressable plutôt que TouchableWithoutFeedback (l'ancien système tactile de RN) :
                ce dernier peut capter le premier tap avant qu'il n'atteigne un Pressable enfant
                (bouton, toggle…), obligeant à taper deux fois — une fois pour fermer le clavier,
                une fois pour l'action. Pressable compose correctement avec ses enfants, même
                pattern que les écrans auth et /add. */}
            <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
              {children}
            </Pressable>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}
