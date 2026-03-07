-- Ajoute la colonne spotify_url à album_metadata
ALTER TABLE album_metadata ADD COLUMN IF NOT EXISTS spotify_url TEXT;

-- Index pour requêtes admin (albums sans lien Spotify)
CREATE INDEX IF NOT EXISTS album_metadata_spotify_url_idx ON album_metadata (spotify_url) WHERE spotify_url IS NULL;
