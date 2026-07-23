import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { showToast } from '../ui/Toast';
import { createList, type ProfileListUI } from '../../lib/lists';
import { metaMediumStyle, smStyle } from '../../lib/typography';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onCreated: (list: ProfileListUI) => void;
};

/**
 * Miroir de CreateListForm (web) — en BottomSheet plutôt qu'un formulaire inline dans la
 * page profil. L'inline (précédente implémentation) avait un TextInput autoFocus dans le
 * ScrollView plein écran du profil : à l'ouverture du clavier, ce ScrollView remontait tout
 * en haut au lieu de révéler le champ (pas de gestion clavier sur cette page). Le BottomSheet
 * gère déjà la compensation clavier (voir components/ui/BottomSheet.tsx) — même pattern que
 * EditListBottomSheet/AddListItemsBottomSheet, plus fiable qu'ajouter une logique de scroll
 * manuelle sur la page profil pour ce seul champ.
 */
export function CreateListBottomSheet({ isOpen, onClose, userId, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setIsPublic(false);
    }
  }, [isOpen]);

  async function handleCreate() {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      const { id } = await createList({ title: t, isPublic });
      showToast(`Liste "${t}" créée`, 'success');
      onCreated({
        id,
        user_id: userId ?? '',
        title: t,
        is_public: isPublic,
        is_default: false,
        item_count: 0,
        cover_urls: [],
      });
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la création', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Nouvelle liste" snapPoint="40%">
      <View className="px-6 py-4" style={{ gap: 16 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nom de la liste"
          placeholderTextColor="#9A9A9A"
          autoFocus
          onSubmitEditing={handleCreate}
          className="bg-background-secondary border border-border rounded-input px-3 py-2.5 text-text-primary"
          style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
        />
        {/* onPressIn plutôt que onPress : sur iOS, le sheet natif (@expo/ui) se redimensionne
            tout seul quand le clavier se ferme (perte de focus du TextInput au tap sur un
            autre élément) — si l'action n'est confirmée qu'au relâchement (onPress), ce
            redimensionnement en plein geste fait bouger le bouton sous le doigt et annule le
            tap. onPressIn se déclenche dès le contact, avant que ça n'ait le temps d'arriver. */}
        <Pressable onPressIn={() => setIsPublic((v) => !v)} className="flex-row items-center gap-3">
          <View className={`relative w-9 h-5 rounded-full ${isPublic ? 'bg-text-primary' : 'bg-border-divider'}`}>
            <View className="absolute top-0.5 w-4 h-4 rounded-full bg-background" style={{ left: isPublic ? 16 : 2 }} />
          </View>
          <Text className="text-text-secondary" style={smStyle}>{isPublic ? 'Publique' : 'Privée'}</Text>
        </Pressable>
        <Pressable
          onPressIn={handleCreate}
          disabled={!title.trim() || saving}
          className="bg-text-primary rounded-button py-2.5 items-center"
          style={{ opacity: !title.trim() || saving ? 0.4 : 1 }}
        >
          <Text className="text-background" style={metaMediumStyle}>{saving ? 'Création…' : 'Créer'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
