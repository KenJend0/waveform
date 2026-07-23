import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { Heart, MessageCircle } from 'lucide-react-native';
import { toggleDiaryLike, toggleTrackDiaryLike } from '../../../lib/feed';
import { showToast } from '../../ui/Toast';

const AnimatedHeart = Animated.createAnimatedComponent(Heart);

type Props = {
  entryId?: string;
  type?: 'album' | 'track';
  currentUserId?: string;
  isLiked?: boolean;
  likesCount?: number;
  commentsCount?: number;
  onCommentPress?: () => void;
  time?: string;
  /** Marge gauche pour aligner sous le texte des cartes du feed (après l'avatar). Désactiver
   *  hors contexte feed (ex. ReviewsList du profil, qui n'a pas cet avatar en tête de ligne). */
  indent?: boolean;
};

export function FeedActions({ entryId, type = 'album', currentUserId, isLiked = false, likesCount = 0, commentsCount = 0, onCommentPress, time, indent = true }: Props) {
  const [liked, setLiked] = useState(isLiked);
  const [count, setCount] = useState(likesCount);
  const [pending, setPending] = useState(false);
  const heartScale = useSharedValue(1);

  useEffect(() => {
    setLiked(isLiked);
    setCount(likesCount);
  }, [entryId, isLiked, likesCount]);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleLike = async () => {
    if (!currentUserId) {
      showToast('Connecte-toi pour aimer cette critique', 'error');
      return;
    }
    if (!entryId || pending) return;

    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(!prevLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
    if (!prevLiked) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      heartScale.value = withSequence(withSpring(1.35, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10 }));
    }
    setPending(true);
    try {
      if (type === 'track') {
        await toggleTrackDiaryLike(entryId);
      } else {
        await toggleDiaryLike(entryId);
      }
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
      showToast("Impossible d'aimer cette critique", 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <View className={`flex-row items-center mt-1.5 ${indent ? 'ml-11' : ''}`}>
      <View className="flex-row items-center gap-5">
        <Pressable onPress={handleLike} disabled={pending} className="flex-row items-center gap-1.5">
          <AnimatedHeart style={heartAnimatedStyle} size={14} color={liked ? '#C86C6C' : '#9A9A9A'} fill={liked ? '#C86C6C' : 'transparent'} />
          {count > 0 && <Text className="text-[12px] text-text-tertiary">{count}</Text>}
        </Pressable>
        <Pressable onPress={onCommentPress} className="flex-row items-center gap-1.5">
          <MessageCircle size={14} color="#9A9A9A" />
          {commentsCount > 0 && <Text className="text-[12px] text-text-tertiary">{commentsCount}</Text>}
        </Pressable>
      </View>
      {!!time && <Text style={{ marginLeft: 10 }} className="text-[12px] text-text-disabled">· {time}</Text>}
    </View>
  );
}
