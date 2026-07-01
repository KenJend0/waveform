'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { BottomSheetProvider, useBottomSheet } from '@/lib/BottomSheetContext';
import { HeaderSearchProvider } from '@/lib/HeaderSearchContext';
import { useIsStandalone } from '@/hooks/useIsStandalone';

const NO_NAV_PATHS = ['/onboarding', '/auth/reset'];
// Pas de "rien à rafraîchir" sur ces pages (formulaires, contenu statique) — le geste
// gênerait plus qu'il n'aiderait (ex: interrompre une saisie sur /auth).
const NO_PULL_TO_REFRESH_PATHS = ['/auth', '/onboarding', '/legal'];

type Props = {
  children: React.ReactNode;
};

function MainContent({ children, pathname }: Props & { pathname: string }) {
  const isStandalone = useIsStandalone();
  const { openCount } = useBottomSheet();
  const disablePullToRefresh = NO_PULL_TO_REFRESH_PATHS.some(path => pathname.startsWith(path));

  return (
    <PullToRefresh enabled={isStandalone && openCount === 0 && !disablePullToRefresh}>
      <main>{children}</main>
    </PullToRefresh>
  );
}

/**
 * Gère l'affichage du layout selon l'état d'authentification.
 * Toutes les pages sont accessibles — chaque page gère son propre état auth.
 */
export default function AuthenticatedLayout({ children }: Props) {
  const { loading } = useAuth();
  const pathname = usePathname();

  const hideNav = NO_NAV_PATHS.some(path => pathname.startsWith(path));
  // La bottom nav doit rester visible même sans compte : /explore, /lists et les
  // pages "voir tout" sont désormais navigables par des utilisateurs anonymes.
  const showBottomNav = !loading && !hideNav;

  return (
    <BottomSheetProvider>
      <HeaderSearchProvider>
        {!loading && !hideNav && <Header />}
        <MainContent pathname={pathname}>{children}</MainContent>
        {showBottomNav && <BottomNav />}
      </HeaderSearchProvider>
    </BottomSheetProvider>
  );
}

