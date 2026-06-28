'use client';

import { useEffect, useState } from 'react';

/**
 * Détecte le mode "standalone" (app ajoutée à l'écran d'accueil). C'est dans ce mode
 * que le pull-to-refresh natif de Safari disparaît (le rubber-band scroll est désactivé).
 */
export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const navigatorStandalone = (window.navigator as { standalone?: boolean }).standalone;
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches || navigatorStandalone === true
    );
  }, []);

  return isStandalone;
}
