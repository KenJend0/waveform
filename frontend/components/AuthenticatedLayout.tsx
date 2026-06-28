'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import { BottomSheetProvider, useBottomSheet } from '@/lib/BottomSheetContext';
import { useIsStandalone } from '@/hooks/useIsStandalone';

const NO_NAV_PATHS = ['/onboarding', '/auth/reset'];

type Props = {
  children: React.ReactNode;
};

function MainContent({ children }: Props) {
  const isStandalone = useIsStandalone();
  const { openCount } = useBottomSheet();

  return (
    <PullToRefresh enabled={isStandalone && openCount === 0}>
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
      {!loading && !hideNav && <Header />}
      <MainContent>{children}</MainContent>
      {showBottomNav && <BottomNav />}
    </BottomSheetProvider>
  );
}

