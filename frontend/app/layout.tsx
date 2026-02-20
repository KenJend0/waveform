import "./globals.css";
import Toast from "@/components/Toast";
import { AuthProvider } from "@/lib/AuthContext";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { BackgroundColorProvider } from "@/lib/BackgroundColorContext";
import { BackgroundWrapper } from "@/components/BackgroundWrapper";
import { Inter } from 'next/font/google';
import type { Metadata, Viewport } from 'next';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // themeColor géré dynamiquement par BackgroundWrapper (évite conflit React DOM)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr" className={inter.variable}>
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        </head>
        <body className="bg-background text-text-primary font-sans antialiased">
        <AuthProvider>
          <BackgroundColorProvider>
            <BackgroundWrapper>
              <AuthenticatedLayout>
                  {children}
              </AuthenticatedLayout>
              <Toast />
            </BackgroundWrapper>
          </BackgroundColorProvider>
        </AuthProvider>
        </body>
        </html>
    );
}

