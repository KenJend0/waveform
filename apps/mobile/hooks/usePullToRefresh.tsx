import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

/**
 * Rafraîchissement par glissement — RefreshControl natif de React Native (pas de
 * PanGestureHandler maison), branché sur `refreshControl` d'un ScrollView/FlatList.
 *
 * Usage: const { refreshControl } = usePullToRefresh(refetch);
 *        <FlatList refreshControl={refreshControl} ... />
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor="#6B6B6B"
      colors={['#8E6F5E']}
    />
  );

  return { refreshing, refreshControl, handleRefresh };
}
