import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Toast from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/AuthContext";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import DebugErrorBoundary from "@/components/ui/DebugErrorBoundary";
import { BackgroundColorProvider } from "@/lib/BackgroundColorContext";
import { BackgroundWrapper } from "@/components/layout/BackgroundWrapper";
import ServiceWorkerRegistration from "@/components/background/ServiceWorkerRegistration";
import NavigationTracker from "@/components/background/NavigationTracker";
import InstagramBanner from "@/components/background/InstagramBanner";
import InstallBanner from "@/components/background/InstallBanner";
import { Inter, Instrument_Serif } from 'next/font/google';
import type { Metadata, Viewport } from 'next';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Waveform',
    template: '%s — Waveform',
  },
  description:
    "Une application de journal musical. Suis tes écoutes, note tes albums, lis les avis de tes amis.",
  authors: [{ name: 'Waveform' }],
  keywords: ['musique', 'journal', 'albums', 'reviews', 'Waveform'],
  openGraph: {
    title: 'Waveform — Journal musical',
    description:
      "Une application de journal musical. Suis tes écoutes, note tes albums, lis les avis de tes amis.",
    siteName: 'Waveform',
    type: 'website',
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Waveform',
    description:
      "Une application de journal musical. Suis tes écoutes, note tes albums, lis les avis de tes amis.",
  },
  // metadataBase permet de construire des URL pour les pages / OG images.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // themeColor géré dynamiquement par BackgroundWrapper (évite conflit React DOM)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr" className={`${inter.variable} ${instrumentSerif.variable}`}>
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Waveform" />
          <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
          <link rel="manifest" href="/manifest.webmanifest" />
        </head>
        <body className="bg-background text-text-primary font-sans antialiased">
        <AuthProvider>
          <BackgroundColorProvider>
            <BackgroundWrapper>
              <DebugErrorBoundary>
                <AuthenticatedLayout>
                    {children}
                </AuthenticatedLayout>
              </DebugErrorBoundary>
              <NavigationTracker />
              <Toast />
              <Analytics />
              <ServiceWorkerRegistration />
              <InstagramBanner />
              <InstallBanner />
            </BackgroundWrapper>
          </BackgroundColorProvider>
        </AuthProvider>
        </body>
        </html>
    );
}

