'use client';

import { useBackgroundColor } from '@/lib/BackgroundColorContext';
import { useEffect } from 'react';

interface BackgroundWrapperProps {
  children: React.ReactNode;
}

// Charte Waveform â€” seules couleurs autorisÃ©es
const colorMap: Record<string, string> = {
  'bg-background': '#F5F3EF',
  'bg-background-secondary': '#ECE8E1',
  'bg-background-tertiary': '#E4DFD6',
};

export function BackgroundWrapper({ children }: BackgroundWrapperProps) {
  const { backgroundColor, textColor, themeColor } = useBackgroundColor();

  useEffect(() => {
    const htmlElement = document.documentElement;
    const body = document.body;

    // Supprimer les anciennes classes de fond et texte
    Array.from(htmlElement.classList).forEach(className => {
      if (className.startsWith('bg-') || className.startsWith('text-')) {
        htmlElement.classList.remove(className);
      }
    });

    Array.from(body.classList).forEach(className => {
      if (className.startsWith('bg-') || className.startsWith('text-')) {
        body.classList.remove(className);
      }
    });

    // Ajouter les nouvelles classes
    htmlElement.classList.add(backgroundColor, textColor);
    body.classList.add(backgroundColor, textColor);

    // Appliquer le background en inline â€” fallback sur fond charte principal
    const hexColor = colorMap[backgroundColor] || '#F5F3EF';
    htmlElement.style.backgroundColor = hexColor;
    body.style.backgroundColor = hexColor;

    document.documentElement.style.setProperty('--background', hexColor);

    // Mettre Ã  jour theme-color pour iOS
    const statusBarColor = themeColor || hexColor;

    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (themeMeta) {
      themeMeta.setAttribute('content', statusBarColor);
    } else {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      themeMeta.content = statusBarColor;
      document.head.appendChild(themeMeta);
    }

    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement;
    if (!appleMeta) {
      appleMeta = document.createElement('meta');
      appleMeta.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(appleMeta);
    }
    appleMeta.content = 'default';
  }, [backgroundColor, textColor, themeColor]);

  return <>{children}</>;
}

