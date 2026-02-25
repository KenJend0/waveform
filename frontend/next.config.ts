const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'coverartarchive.org' },
      { protocol: 'https', hostname: 'archive.org' },
      { protocol: 'https', hostname: '**.archive.org' },
      { protocol: 'https', hostname: 'is1-ssl.mzstatic.com' },
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' },
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'aypyrwqghxkgehibkfob.supabase.co' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://coverartarchive.org https://archive.org https://*.archive.org https://*.us.archive.org https://is1-ssl.mzstatic.com https://lastfm.freetls.fastly.net https://i.scdn.co https://lh3.googleusercontent.com https://res.cloudinary.com https://aypyrwqghxkgehibkfob.supabase.co https://api.dicebear.com https://commons.wikimedia.org https://upload.wikimedia.org",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://musicbrainz.org https://coverartarchive.org https://en.wikipedia.org https://fr.wikipedia.org https://de.wikipedia.org https://es.wikipedia.org https://it.wikipedia.org https://ja.wikipedia.org https://pt.wikipedia.org https://www.wikidata.org https://query.wikidata.org https://commons.wikimedia.org",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
