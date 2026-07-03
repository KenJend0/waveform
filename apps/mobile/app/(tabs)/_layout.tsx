import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { TopTabs } from 'expo-router/js-top-tabs';
import { ScrollNavProvider } from '../../lib/ScrollNavContext';
import BottomNav from '../../components/BottomNav';
import { useAuth } from '../../lib/AuthContext';

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ScrollNavProvider>
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
        <BottomNav />
      </View>
    </ScrollNavProvider>
  );
}
