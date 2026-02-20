'use client';

import { useBackgroundColor } from '@/lib/BackgroundColorContext';
import { useEffect } from 'react';

interface PageBackgroundProps {
  children: React.ReactNode;
  backgroundColor: string;
  textColor?: string;
  themeColor?: string;
}

export function PageBackground({ children, backgroundColor, textColor = 'text-text-primary', themeColor }: PageBackgroundProps) {
  const { setBackgroundColor, setTextColor, setThemeColor } = useBackgroundColor();

  useEffect(() => {
    setBackgroundColor(backgroundColor);
    setTextColor(textColor);
    if (themeColor) {
      setThemeColor(themeColor);
    }
  }, [backgroundColor, textColor, themeColor, setBackgroundColor, setTextColor, setThemeColor]);

  return <>{children}</>;
}

