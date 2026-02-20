'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface BackgroundColorContextType {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  textColor: string;
  setTextColor: (color: string) => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
}

const BackgroundColorContext = createContext<BackgroundColorContextType | undefined>(undefined);

export function BackgroundColorProvider({ children }: { children: React.ReactNode }) {
  const [backgroundColor, setBackgroundColor] = useState('bg-background');
  const [textColor, setTextColor] = useState('text-text-primary');
  const [themeColor, setThemeColor] = useState('#F5F3EF');

  return (
    <BackgroundColorContext.Provider value={{ backgroundColor, setBackgroundColor, textColor, setTextColor, themeColor, setThemeColor }}>
      {children}
    </BackgroundColorContext.Provider>
  );
}

export function useBackgroundColor() {
  const context = useContext(BackgroundColorContext);
  if (!context) {
    throw new Error('useBackgroundColor doit être utilisé dans BackgroundColorProvider');
  }
  return context;
}
