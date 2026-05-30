import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.waveformapp',
  appName: 'Waveform',
  // webDir is required by Capacitor CLI but unused in remote URL mode
  webDir: 'public',
  server: {
    url: 'https://waveformapp.online',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['waveformapp.online', '*.supabase.co'],
  },
  ios: {
    // Respect device safe areas (notch, home indicator)
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#F5F3EF',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
};

export default config;
