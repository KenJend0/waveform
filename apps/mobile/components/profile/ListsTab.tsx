import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { ListCard } from './ListCard';
import { ListCardWithMenu } from './ListCardWithMenu';
import { CreateListBottomSheet } from '../lists/CreateListBottomSheet';
import { type ProfileListUI } from '../../lib/lists';
import { labelStyle, metaMediumStyle, smStyle } from '../../lib/typography';

type Props = {
  lists: ProfileListUI[];
  savedLists?: ProfileListUI[];
  isOwner: boolean;
  userId?: string;
};

type ListFilter = 'mine' | 'saved' | 'all';

/**
 * Miroir de ListsTab (web) — grille + filtre Tout/Mes listes/Sauvegardées quand le
 * propriétaire a des listes sauvegardées, + création d'une liste (CreateListBottomSheet)
 * et menu propriétaire (ListCardWithMenu : renommer/visibilité/supprimer) sur ses propres
 * listes. `lists`/`savedLists` ne sont chargées qu'une fois par le parent (pas de
 * router.refresh() côté mobile) : create/rename/delete/visibilité mettent donc à jour
 * une copie locale en state, comme le reste des écrans profil mobile (voir DiaryList).
 */
export const ListsTab = memo(function ListsTab({ lists: initialLists, savedLists: initialSavedLists = [], isOwner, userId }: Props) {
  const [lists, setLists] = useState(initialLists);
  const savedLists = initialSavedLists;

  // `lists` ne fait que démarrer sur initialLists — sans resync, un pull-to-refresh ou un
  // retour sur l'onglet (le parent /me refetch dans les deux cas) ne se propage jamais ici :
  // une liste supprimée depuis cet onglet OU depuis sa propre page /lists/[id] continue de
  // s'afficher tant que ce composant reste monté (voir aussi la note lazy-mount dans
  // ProfileTabs, qui garde ListsTab monté une fois visité).
  useEffect(() => {
    setLists(initialLists);
  }, [initialLists]);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [creating, setCreating] = useState(false);

  const showFilter = isOwner && savedLists.length > 0;

  const displayed = !showFilter
    ? lists
    : filter === 'mine'
      ? lists
      : filter === 'saved'
        ? savedLists
        : [...lists, ...savedLists];

  function handleListChanged(updated: ProfileListUI) {
    setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  function handleListDeleted(listId: string) {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }

  return (
    <View>
      {isOwner && (
        <Pressable onPress={() => setCreating(true)} className="flex-row items-center gap-2 mb-5">
          <Plus size={14} color="#6B6B6B" />
          <Text className="text-text-secondary" style={smStyle}>Nouvelle liste</Text>
        </Pressable>
      )}

      {showFilter && (
        <View className="flex-row gap-1.5 mb-5">
          {([
            ['all', 'Tout'],
            ['mine', 'Mes listes'],
            ['saved', 'Sauvegardées'],
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              className={`px-3 py-1 rounded-full ${filter === id ? 'bg-text-primary' : 'bg-background-secondary'}`}
            >
              <Text className={filter === id ? 'text-white' : 'text-text-secondary'} style={labelStyle}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {displayed.length === 0 ? (
        <View className="py-8 items-center">
          <Text className="text-text-secondary" style={metaMediumStyle}>
            {!isOwner ? 'Aucune liste publique.' : filter === 'saved' ? 'Aucune liste sauvegardée.' : "Tu n'as pas encore de listes."}
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 20 }}>
          {displayed.map((list) =>
            isOwner && list.user_id === userId ? (
              <ListCardWithMenu key={list.id} list={list} onChanged={handleListChanged} onDeleted={handleListDeleted} />
            ) : (
              <ListCard key={list.id} list={list} />
            )
          )}
        </View>
      )}

      {isOwner && (
        <CreateListBottomSheet
          isOpen={creating}
          onClose={() => setCreating(false)}
          userId={userId}
          onCreated={(list) => setLists((prev) => [list, ...prev])}
        />
      )}
    </View>
  );
});
