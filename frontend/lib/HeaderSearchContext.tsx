'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type HeaderSearchContextType = {
  showHeaderSearch: boolean;
  setShowHeaderSearch: (visible: boolean) => void;
};

const HeaderSearchContext = createContext<HeaderSearchContextType>({
  showHeaderSearch: false,
  setShowHeaderSearch: () => {},
});

export function HeaderSearchProvider({ children }: { children: ReactNode }) {
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const value = useMemo(
    () => ({ showHeaderSearch, setShowHeaderSearch }),
    [showHeaderSearch]
  );

  return (
    <HeaderSearchContext.Provider value={value}>
      {children}
    </HeaderSearchContext.Provider>
  );
}

export function useHeaderSearch() {
  return useContext(HeaderSearchContext);
}
