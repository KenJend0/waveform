import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MoreHorizontal, Pencil, Lock, Globe, Trash2 } from 'lucide-react-native';
import { ListCard } from './ListCard';
import { BottomSheet } from '../ui/BottomSheet';
import { showToast } from '../ui/Toast';
import { updateList, deleteList, type ProfileListUI } from '../../lib/lists';
import { metaStyle, metaMediumStyle, labelStyle } from '../../lib/typography';

type Props = {
  list: ProfileListUI;
  onChanged: (list: ProfileListUI) => void;
  onDeleted: (listId: string) => void;
};

/**
 * Miroir de ListCardWithMenu (web) — Renommer/Rendre publique-privée/Supprimer, en
 * BottomSheet plutôt qu'un dropdown ancré + modale centrée (pattern déjà établi côté
 * mobile, cf. AlbumEntryMenu). Utilisé uniquement dans ListsTab pour ses propres listes.
 */
export function ListCardWithMenu({ list, onChanged, onDeleted }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(list.title);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRename() {
    const t = newTitle.trim();
    setRenaming(false);
    if (!t || t === list.title) return;
    setSaving(true);
    try {
      await updateList(list.id, { title: t });
      onChanged({ ...list, title: t });
      showToast('Renommée', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVisibility() {
    setMenuOpen(false);
    try {
      await updateList(list.id, { isPublic: !list.is_public });
      onChanged({ ...list, is_public: !list.is_public });
      showToast(list.is_public ? 'Liste rendue privée' : 'Liste rendue publique', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteList(list.id);
      showToast('Liste supprimée', 'success');
      setConfirmDelete(false);
      onDeleted(list.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la suppression', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={{ width: '48%' }}>
      <View className="relative">
        <ListCard list={list} style={{ width: '100%' }} />
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 items-center justify-center"
        >
          <MoreHorizontal size={13} color="#6B6B6B" />
        </Pressable>
      </View>

      <BottomSheet isOpen={renaming} onClose={() => setRenaming(false)} title="Renommer" snapPoint="30%">
        <View className="px-6 py-4" style={{ gap: 16 }}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            autoFocus
            onSubmitEditing={handleRename}
            className="bg-background-secondary border border-border rounded-input px-3 py-2.5 text-text-primary"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
          />
          <Pressable
            onPressIn={handleRename}
            disabled={saving || !newTitle.trim()}
            className="bg-text-primary rounded-button py-2.5 items-center"
            style={{ opacity: saving || !newTitle.trim() ? 0.4 : 1 }}
          >
            <Text className="text-background" style={metaMediumStyle}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet isOpen={menuOpen} onClose={() => setMenuOpen(false)} title={list.title} snapPoint="32%">
        <View className="px-6 py-2">
          <Pressable
            onPress={() => { setMenuOpen(false); setNewTitle(list.title); setRenaming(true); }}
            className="flex-row items-center gap-2.5 py-3 border-b border-border-divider"
          >
            <Pencil size={15} color="#6B6B6B" />
            <Text className="text-text-primary" style={metaStyle}>Renommer</Text>
          </Pressable>
          {!list.is_default && (
            <Pressable
              onPress={handleToggleVisibility}
              className="flex-row items-center gap-2.5 py-3 border-b border-border-divider"
            >
              {list.is_public ? <Lock size={15} color="#6B6B6B" /> : <Globe size={15} color="#6B6B6B" />}
              <Text className="text-text-primary" style={metaStyle}>
                {list.is_public ? 'Rendre privée' : 'Rendre publique'}
              </Text>
            </Pressable>
          )}
          {!list.is_default && (
            <Pressable
              onPress={() => { setMenuOpen(false); setConfirmDelete(true); }}
              className="flex-row items-center gap-2.5 py-3"
            >
              <Trash2 size={15} color="#C86C6C" />
              <Text className="text-[#C86C6C]" style={metaStyle}>Supprimer</Text>
            </Pressable>
          )}
        </View>
      </BottomSheet>

      <BottomSheet isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer ?" snapPoint="25%">
        <View className="px-6 py-4">
          <Text className="text-text-secondary mb-5" style={labelStyle}>Cette action ne peut pas être annulée.</Text>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setConfirmDelete(false)} className="flex-1 bg-background-secondary rounded-button py-2.5 items-center">
              <Text className="text-text-primary" style={metaStyle}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              className="flex-1 bg-[#C86C6C] rounded-button py-2.5 items-center"
              style={{ opacity: deleting ? 0.5 : 1 }}
            >
              <Text className="text-[#F5F3EF]" style={metaMediumStyle}>{deleting ? 'Suppression…' : 'Supprimer'}</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
