import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CircleAlert, X } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';

type ToastMessage = { id: string; message: string; type: ToastType };

let listeners: Array<(message: ToastMessage) => void> = [];

export function showToast(message: string, type: ToastType = 'success') {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach((listener) => listener({ id, message, type }));
}

/** Monté une seule fois à la racine de l'app (voir app/_layout.tsx). */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      timeouts.current.set(
        toast.id,
        setTimeout(() => removeToast(toast.id), 4000)
      );
    },
    [removeToast]
  );

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      listeners = listeners.filter((l) => l !== addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, gap: 8 }}
    >
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          className={`flex-row items-center gap-3 px-4 py-3 rounded-button ${
            toast.type === 'error' ? 'bg-[#1C1C1C]' : 'bg-[#1C1C1C]'
          }`}
          style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          {toast.type === 'error' && <CircleAlert size={18} color="#C86C6C" />}
          <Text
            className={`flex-1 text-[14px] ${toast.type === 'error' ? 'text-[#C86C6C]' : 'text-[#F5F3EF]'}`}
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {toast.message}
          </Text>
          <Pressable onPress={() => removeToast(toast.id)} hitSlop={8}>
            <X size={16} color={toast.type === 'error' ? '#C86C6C' : '#F5F3EF'} />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
