export type ClassicAlbum = { id: string; title: string; artist: string; coverUrl: string };

/**
 * Repli ultime quand un utilisateur n'a ni liste, ni suggestion, ni
 * découverte — typiquement un compte tout neuf sans profil de goût.
 */
export const CLASSIC_ALBUMS: ClassicAlbum[] = [
    { id: "044150fe-fdef-42ad-85da-0ff9c38652db", title: "Thriller", artist: "Michael Jackson", coverUrl: "https://archive.org/download/mbid-e1b94ba6-c63c-4c2d-8928-9d1a525b7000/mbid-e1b94ba6-c63c-4c2d-8928-9d1a525b7000-22018478497.jpg" },
    { id: "f10a17a5-f193-4805-8353-58bd74c5f657", title: "Abbey Road", artist: "The Beatles", coverUrl: "https://archive.org/download/mbid-31765b9f-e969-4257-855f-c7ea1f657b2a/mbid-31765b9f-e969-4257-855f-c7ea1f657b2a-39706767821.jpg" },
    { id: "e2f98e07-20bf-4db6-a58e-5cb69e4221b1", title: "The Dark Side of the Moon", artist: "Pink Floyd", coverUrl: "https://archive.org/download/mbid-956fbc58-362d-43b8-b880-3779e0508559/mbid-956fbc58-362d-43b8-b880-3779e0508559-34025419985.jpg" },
    { id: "7407d2b4-40ce-4a65-966e-d13a1c7df77a", title: "Nevermind", artist: "Nirvana", coverUrl: "https://archive.org/download/mbid-c771f7fc-9e62-4349-a2e3-ceaf7122bf5b/mbid-c771f7fc-9e62-4349-a2e3-ceaf7122bf5b-30501372565.jpg" },
    { id: "a654e860-8efc-45c7-8378-c506883c2d72", title: "Random Access Memories", artist: "Daft Punk", coverUrl: "https://archive.org/download/mbid-5000a285-b67e-4cfc-b54b-2b98f1810d2e/mbid-5000a285-b67e-4cfc-b54b-2b98f1810d2e-32554171842.jpg" },
    { id: "43132421-6ba3-4a6f-924e-a1dae799f8e7", title: "Back to Black", artist: "Amy Winehouse", coverUrl: "https://archive.org/download/mbid-ccf4da26-ea82-462f-b753-88bb976fd40e/mbid-ccf4da26-ea82-462f-b753-88bb976fd40e-36926439244.jpg" },
    { id: "fd8c382d-7186-40a6-838a-8749f1f2fd68", title: "To Pimp a Butterfly", artist: "Kendrick Lamar", coverUrl: "https://archive.org/download/mbid-b4d6e526-4195-49bc-b660-b6df4c27686e/mbid-b4d6e526-4195-49bc-b660-b6df4c27686e-9896943304.jpg" },
    { id: "b2207a0f-2b1c-4357-b6f2-5ae7dc032e0c", title: "folklore", artist: "Taylor Swift", coverUrl: "https://archive.org/download/mbid-0ca6db69-0719-4a00-99be-f87ef1cff6cb/mbid-0ca6db69-0719-4a00-99be-f87ef1cff6cb-26803653721.jpg" },
];
