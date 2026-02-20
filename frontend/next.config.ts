// next.config.ts
export default {
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'coverartarchive.org' }, // ✅ pour tes pochettes d'albums
            { protocol: 'https', hostname: 'archive.org' },
            { protocol: 'https', hostname: 'is1-ssl.mzstatic.com' },
            { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' },
            { protocol: 'https', hostname: 'i.scdn.co' },
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: 'res.cloudinary.com' },
            { protocol: 'https', hostname: 'aypyrwqghxkgehibkfob.supabase.co' },
            { protocol: 'https', hostname: 'api.dicebear.com' },
        ],
    }
};
