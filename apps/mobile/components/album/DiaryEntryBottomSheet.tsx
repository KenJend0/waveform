import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { StarRating } from '../ui/StarRating';
import { DatePickerField } from '../ui/DatePickerField';
import { showToast } from '../ui/Toast';
import { upsertDiaryEntry, updateDiaryEntry, type MyDiaryEntry } from '../../lib/diary';
import { toggleListItem, type UserListSummary } from '../../lib/lists';
import { metaStyle, metaMediumStyle } from '../../lib/typography';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  albumId: string;
  /** Entrée existante à modifier — omis pour une nouvelle écoute/ré-écoute. */
  editingEntry?: MyDiaryEntry;
  /** true si l'utilisateur a déjà au moins une écoute de cet album (bascule le libellé + le mode insert). */
  hasExistingEntry?: boolean;
  /** Listes de l'utilisateur + IDs de celles contenant cet album — pour l'option "Retirer de À écouter" (miroir de AddToDiaryButton, web). */
  userLists?: UserListSummary[];
  listsContaining?: string[];
  onSaved: () => void;
};

const today = new Date().toISOString().split('T')[0];

/**
 * Formulaire noter/écrire une écoute — fusion de AddToDiaryButton + EditDiaryEntryButton
 * (web) en un seul composant réutilisé pour créer ET modifier, les deux formulaires étant
 * identiques à l'exception de l'appel réseau final.
 */
export function DiaryEntryBottomSheet({ isOpen, onClose, albumId, editingEntry, hasExistingEntry, userLists = [], listsContaining = [], onSaved }: Props) {
  const [rating, setRating] = useState<number | null>(editingEntry?.rating ?? null);
  const [body, setBody] = useState(editingEntry?.review_body ?? '');
  const [listenedAt, setListenedAt] = useState(editingEntry?.listened_at ?? today);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editingEntry;

  const defaultListId = userLists.find((l) => l.is_default)?.id;
  const isSaved = !!defaultListId && listsContaining.includes(defaultListId);
  const [removeFromSaved, setRemoveFromSaved] = useState(isSaved);

  useEffect(() => {
    if (isOpen) {
      setRating(editingEntry?.rating ?? null);
      setBody(editingEntry?.review_body ?? '');
      setListenedAt(editingEntry?.listened_at ?? today);
      setRemoveFromSaved(isSaved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingEntry]);

  async function handleSubmit() {
    if (saving) return;
    setSaving(true);
    try {
      if (isEdit) {
        const result = await updateDiaryEntry({
          entryId: editingEntry.id,
          listenedAt,
          rating,
          reviewBody: body || undefined,
        });
        if (!result.success) {
          showToast(result.error || 'Erreur lors de la mise à jour', 'error');
          return;
        }
        showToast('Mis à jour !', 'success');
      } else {
        const result = await upsertDiaryEntry({
          albumId,
          listenedAt,
          rating: rating ?? 0,
          reviewBody: body || undefined,
          relisten: hasExistingEntry,
        });
        if (!result.success) {
          showToast(result.error || 'Erreur lors de l\'enregistrement', 'error');
          return;
        }
        if (removeFromSaved && defaultListId) {
          try {
            await toggleListItem(defaultListId, { albumId });
            showToast('Retiré de "À écouter"', 'success');
          } catch {
            showToast('Impossible de retirer l\'album de "À écouter"', 'error');
          }
        }
        showToast('Enregistré !', 'success');
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Mettre à jour' : hasExistingEntry ? 'Enregistrer une ré-écoute' : 'Évaluer cet album'}
      snapPoint="65%"
    >
      <View className="px-6 py-4" style={{ gap: 20 }}>
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-secondary" style={metaStyle}>Note</Text>
            <Text className="text-text-primary" style={{ fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19.5 }}>
              {rating ?? 0} / 10
            </Text>
          </View>
          <StarRating value={rating} onChange={setRating} />
        </View>

        <View>
          <Text className="text-text-secondary mb-2" style={metaStyle}>Date d'écoute</Text>
          <DatePickerField value={listenedAt} onChange={setListenedAt} maxDate={new Date()} />
        </View>

        <View>
          <Text className="text-text-secondary mb-2" style={metaStyle}>Quelques mots</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Ce que tu as ressenti, si tu en as envie."
            placeholderTextColor="#9A9A9A"
            multiline
            numberOfLines={4}
            className="bg-background-secondary border border-border rounded-input px-4 py-3 text-text-primary"
            style={{ height: 96, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}
          />
        </View>

        {!isEdit && isSaved && (
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setRemoveFromSaved((v) => !v)}
              className="rounded-full"
              style={{ width: 36, height: 20, backgroundColor: removeFromSaved ? '#1C1C1C' : '#DDD7CF' }}
            >
              <View
                className="rounded-full bg-background"
                style={{ width: 16, height: 16, marginTop: 2, marginLeft: removeFromSaved ? 18 : 2 }}
              />
            </Pressable>
            <Text className="text-text-secondary" style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>
              Retirer de "À écouter"
            </Text>
          </View>
        )}

        <View className="flex-row gap-2 pb-4">
          <Pressable onPress={onClose} className="flex-1 bg-background-secondary rounded-button py-2.5 items-center">
            <Text className="text-text-primary" style={metaStyle}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            className="flex-1 bg-[#1C1C1C] rounded-button py-2.5 items-center"
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            <Text className="text-[#F5F3EF]" style={metaMediumStyle}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
