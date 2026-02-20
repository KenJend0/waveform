'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

// Pages publiques qui ne nÃ©cessitent pas d'authentification
const PUBLIC_PATHS = ['/auth', '/search', '/albums', '/artists', '/explore'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some(path => pathname.startsWith(path));
}

type Props = {
  children: React.ReactNode;
};

/**
 * Composant client qui gÃ¨re l'affichage du layout selon l'Ã©tat d'authentification.
 * - Affiche Header et BottomNav uniquement si l'utilisateur est connectÃ©
 * - Redirige vers /auth si l'utilisateur n'est pas connectÃ© et sur une page protÃ©gÃ©e
 */
export default function AuthenticatedLayout({ children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Rediriger vers /auth si non connectÃ© et sur une page protÃ©gÃ©e
    if (!loading && !user && !isPublicPath(pathname)) {
      router.push('/auth');
    }
  }, [user, loading, pathname, router]);

  // Afficher un loader pendant le chargement initial
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

  // Si pas connectÃ© et sur une page protÃ©gÃ©e, ne rien afficher (redirection en cours)
  if (!user && !isPublicPath(pathname)) {
    return null;
  }

  return (
    <>
      {user && <Header />}
      <main>{children}</main>
      {user && <BottomNav />}
    </>
  );
}

