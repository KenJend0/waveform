import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { TopTabs } from 'expo-router/js-top-tabs';
import { SearchOverlayProvider } from '../../lib/SearchOverlayContext';
import { SearchOverlayHost } from '../../components/layout/SearchOverlay';
import { useAuth } from '../../lib/AuthContext';

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <SearchOverlayProvider>
      <View style={{ flex: 1 }}>
        <TopTabs
          tabBar={() => null}
          screenOptions={{
            swipeEnabled: true,
            lazy: true,
          }}
        >
          <TopTabs.Screen name="explore" options={{ title: 'Découvrir' }} />
          <TopTabs.Screen name="add" options={{ title: 'Ajouter' }} />
          <TopTabs.Screen name="feed" options={{ title: 'Activité' }} />
          <TopTabs.Screen name="me" options={{ title: 'Moi' }} />
        </TopTabs>
        {/* zIndex 40 (< BottomNav's 50) — la nav reste visible et cliquable par-dessus. */}
        <SearchOverlayHost />
      </View>
    </SearchOverlayProvider>
  );
}
