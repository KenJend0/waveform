'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { BottomSheetProvider } from '@/lib/BottomSheetContext';

// Pages où la navbar est masquée même pour les utilisateurs connectés
const NO_NAV_PATHS = ['/onboarding', '/auth/reset'];

type Props = {
  children: React.ReactNode;
};

/**
 * Gère l'affichage du layout selon l'état d'authentification.
 * Toutes les pages sont accessibles — chaque page gère son propre état auth.
 */
export default function AuthenticatedLayout({ children }: Props) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Afficher un loader pendant le chargement initial de la session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8E6F5E] mx-auto mb-4"></div>
          <p className="text-text-secondary text-meta">Chargement...</p>
        </div>
      </div>
    );
  }

  const hideNav = NO_NAV_PATHS.some(path => pathname.startsWith(path));

  return (
    <BottomSheetProvider>
      {user && !hideNav && <Header />}
      <main>{children}</main>
      {!hideNav && <BottomNav />}
    </BottomSheetProvider>
  );
}

