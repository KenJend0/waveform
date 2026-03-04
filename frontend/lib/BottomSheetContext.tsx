'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type BottomSheetContextType = {
  openCount: number;
  register: () => void;
  unregister: () => void;
};

const BottomSheetContext = createContext<BottomSheetContextType>({
  openCount: 0,
  register: () => {},
  unregister: () => {},
});

export function BottomSheetProvider({ children }: { children: ReactNode }) {
  const [openCount, setOpenCount] = useState(0);

  const register = useCallback(() => setOpenCount((n) => n + 1), []);
  const unregister = useCallback(() => setOpenCount((n) => Math.max(0, n - 1)), []);

  return (
    <BottomSheetContext.Provider value={{ openCount, register, unregister }}>
      {children}
    </BottomSheetContext.Provider>
  );
}

export function useBottomSheet() {
  return useContext(BottomSheetContext);
}
