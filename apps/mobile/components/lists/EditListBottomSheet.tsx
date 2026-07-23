import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { showToast } from '../ui/Toast';
import { updateList, type ListDetail } from '../../lib/lists';
import { metaStyle, metaMediumStyle, smStyle } from '../../lib/typography';

type Props = {
  list: ListDetail;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updates: { title: string; description: string | null; is_public: boolean }) => void;
};

/**
 * Miroir de EditListForm (web) — titre, description, visibilité. Pas de cover
 * personnalisée (uploadListCover/removeListCover) : nécessite sharp + service_role,
 * hors scope de cette passe (voir docs/MOBILE_ROADMAP.md, note de scope Phase 7).
 */
export function EditListBottomSheet({ list, isOpen, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description ?? '');
  const [isPublic, setIsPublic] = useState(list.is_public);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(list.title);
      setDescription(list.description ?? '');
      setIsPublic(list.is_public);
    }
  }, [isOpen, list]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateList(list.id, { title, description, isPublic });
      showToast('Liste mise à jour', 'success');
      onSaved({ title: title.trim(), description: description.trim() || null, is_public: isPublic });
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la mise à jour', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Infos" snapPoint="55%">
      <View className="px-6 py-4" style={{ gap: 16 }}>
        <View>
          <Text className="text-text-secondary mb-1" style={metaStyle}>Titre</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            className="bg-background-secondary border border-border rounded-input px-3 py-2.5 text-text-primary"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
          />
        </View>
        <View>
          <Text className="text-text-secondary mb-1" style={metaStyle}>Description (optionnelle)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
            className="bg-background-secondary border border-border rounded-input px-3 py-2.5 text-text-primary"
            style={{ height: 64, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 14 }}
          />
        </View>
        <Pressable onPress={() => setIsPublic((v) => !v)} className="flex-row items-center gap-3">
          <View className={`relative w-9 h-5 rounded-full ${isPublic ? 'bg-text-primary' : 'bg-border-divider'}`}>
            <View className="absolute top-0.5 w-4 h-4 rounded-full bg-background" style={{ left: isPublic ? 16 : 2 }} />
          </View>
          <Text className="text-text-secondary" style={smStyle}>{isPublic ? 'Publique' : 'Privée'}</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving || !title.trim()}
          className="bg-text-primary rounded-button py-2.5 items-center"
          style={{ opacity: saving || !title.trim() ? 0.4 : 1 }}
        >
          <Text className="text-background" style={metaMediumStyle}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
