import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../BottomSheet';
import { addComment, addTrackComment } from '../../lib/feed';
import { showToast } from '../Toast';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  entryId: string | undefined;
  type?: 'album' | 'track';
  onCommentAdded?: () => void;
};

export function CommentSheet({ isOpen, onClose, entryId, type = 'album', onCommentAdded }: Props) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!entryId || !body.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (type === 'track') {
        await addTrackComment(entryId, body);
      } else {
        await addComment(entryId, body);
      }
      setBody('');
      onCommentAdded?.();
      onClose();
      showToast('Commentaire ajouté', 'success');
    } catch {
      showToast("Erreur lors de l'ajout du commentaire", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Commenter" snapPoint="40%">
      <View className="px-6 py-4 gap-4">
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Écris un commentaire…"
          placeholderTextColor="#9A9A9A"
          multiline
          className="bg-background-secondary border border-border rounded-input px-4 py-3 text-text-primary min-h-24"
          style={{ fontFamily: 'Inter_400Regular', textAlignVertical: 'top' }}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !body.trim()}
          className="bg-[#1C1C1C] py-3 rounded-button items-center disabled:opacity-50"
        >
          <Text className="text-[#F5F3EF] text-[14px]" style={{ fontFamily: 'Inter_500Medium' }}>
            {submitting ? 'Envoi…' : 'Envoyer'}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
