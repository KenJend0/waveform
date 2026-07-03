import { Pressable, Text, View } from 'react-native';
import type { FeedScope } from '../../lib/feed';

type Tab = Extract<FeedScope, 'notifications' | 'activity'>;

const TABS: { id: Tab; label: string }[] = [
  { id: 'notifications', label: 'Pour moi' },
  { id: 'activity', label: 'Réseau' },
];

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
  unreadCounts?: Record<Tab, number>;
};

export function FeedTabs({ active, onChange, unreadCounts }: Props) {
  return (
    <View
      className="flex-row rounded-full border border-border bg-paper-hi p-1 mx-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const unread = unreadCounts?.[tab.id] ?? 0;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            className="flex-1 flex-row rounded-full py-2 items-center justify-center gap-1.5"
            style={
              isActive
                ? {
                    backgroundColor: '#F5F3EF',
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 2,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : undefined
            }
          >
            <Text
              className={`text-[13px] ${isActive ? 'text-accent-deep' : 'text-text-tertiary'}`}
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              {tab.label}
            </Text>
            {unread > 0 && (
              <View
                className="min-w-[16px] px-1.5 py-0.5 rounded-full items-center justify-center"
                style={{ backgroundColor: '#8E6F5E' }}
              >
                <Text
                  className="text-[10px] leading-none"
                  style={{ fontFamily: 'Inter_500Medium', color: '#FAF8F4' }}
                >
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
