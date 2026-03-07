-- Migration manuelle : genres pour les albums sans genres détectés via l'admin
-- Tous les genres sont assignés avec source='community', weight=5
-- Idempotent : ON CONFLICT DO NOTHING

-- 1. S'assurer que tous les genres nécessaires existent
INSERT INTO genres (name, slug) VALUES
  ('Hip-hop / Rap',       'hip-hop'),
  ('Rap français',        'rap-francais'),
  ('Trap',                'trap'),
  ('Drill',               'drill'),
  ('Afrotrap',            'afrotrap'),
  ('Boom bap',            'boom-bap'),
  ('Rap conscient',       'conscious-rap'),
  ('Cloud rap',           'cloud-rap'),
  ('Melodic rap',         'melodic-rap'),
  ('UK rap',              'uk-rap'),
  ('Afrobeats',           'afrobeats'),
  ('Neo-soul',            'neo-soul'),
  ('Pop',                 'pop'),
  ('Pop arabe',           'arabic-pop'),
  ('Jazz fusion',         'jazz-fusion'),
  ('Post-punk',           'post-punk'),
  ('Punk',                'punk'),
  ('R&B contemporain',    'contemporary-rnb')
ON CONFLICT (slug) DO NOTHING;

-- 2. Assignation des genres par album
-- Format : (title_pattern, artist_pattern, genre_slug)
WITH assignments(title_pat, artist_pat, genre_slug) AS (
  VALUES
    -- Khali
    ('23',                        'Khali',          'rap-francais'),
    ('23',                        'Khali',          'trap'),
    ('PLM DEATHROW',              'Khali',          'rap-francais'),
    ('PLM DEATHROW',              'Khali',          'trap'),

    -- La Fève (cloud rap / melodic)
    ('24',                        'La Fève',        'rap-francais'),
    ('24',                        'La Fève',        'melodic-rap'),
    ('24',                        'La Fève',        'cloud-rap'),

    -- Gazo (drill français)
    ('APOCALYPSE',                'Gazo',           'rap-francais'),
    ('APOCALYPSE',                'Gazo',           'drill'),
    ('APOCALYPSE',                'Gazo',           'trap'),

    -- FEMTOGO
    ('archives',                  'FEMTOGO',        'rap-francais'),
    ('archives',                  'FEMTOGO',        'trap'),
    ('NAMELESS BELLIGERENT',      'FEMTOGO',        'rap-francais'),
    ('NAMELESS BELLIGERENT',      'FEMTOGO',        'trap'),
    ('One Man Army',              'FEMTOGO',        'rap-francais'),

    -- Jeune Lion
    ('BABYLONE BRÛLE',            'Jeune Lion',     'rap-francais'),
    ('BABYLONE BRÛLE',            'Jeune Lion',     'trap'),
    ('HIGHLY SPIRITUAL',          'Jeune Lion',     'rap-francais'),
    ('HIGHLY SPIRITUAL',          'Jeune Lion',     'trap'),
    ('S/O DIEU',                  'Jeune Lion',     'rap-francais'),
    ('S/O DIEU',                  'Jeune Lion',     'trap'),

    -- ISHA (rap conscient / boom bap)
    ('Bitume Caviar%',            'ISHA',           'rap-francais'),
    ('Bitume Caviar%',            'ISHA',           'conscious-rap'),
    ('Bitume Caviar%',            'ISHA',           'boom-bap'),

    -- The Messthetics (post-punk / jazz fusion)
    ('Deface the Currency',       'The Messthetics','post-punk'),
    ('Deface the Currency',       'The Messthetics','jazz-fusion'),

    -- Ino Casablanca
    ('DEMNA',                     'Ino Casablanca', 'rap-francais'),
    ('DEMNA',                     'Ino Casablanca', 'trap'),
    ('EXTASIA',                   'Ino Casablanca', 'rap-francais'),
    ('EXTASIA',                   'Ino Casablanca', 'trap'),
    ('TAMARA',                    'Ino Casablanca', 'rap-francais'),
    ('TAMARA',                    'Ino Casablanca', 'trap'),

    -- Josman (melodic trap / rap fr)
    ('DOM PERIGNON CRYING',       'Josman',         'rap-francais'),
    ('DOM PERIGNON CRYING',       'Josman',         'melodic-rap'),
    ('DOM PERIGNON CRYING',       'Josman',         'trap'),
    ('J.000.$',                   'Josman',         'rap-francais'),
    ('J.000.$',                   'Josman',         'trap'),
    ('M.A.N',                     'Josman',         'rap-francais'),
    ('M.A.N',                     'Josman',         'trap'),

    -- Ragheb Alama (pop arabe / libanaise)
    ('Farq Kebir',                '%',              'arabic-pop'),
    ('Farq Kebir',                '%',              'pop'),

    -- Luther (rap fr)
    ('GARÇON',                    'Luther',         'rap-francais'),
    ('GARÇON',                    'Luther',         'trap'),

    -- Guy2Bezbar (afrotrap)
    ('Jeunesse Dorée',            'Guy2Bezbar',     'rap-francais'),
    ('Jeunesse Dorée',            'Guy2Bezbar',     'afrotrap'),
    ('Jeunesse Dorée',            'Guy2Bezbar',     'trap'),

    -- Vilhelm. (rap fr)
    ('La Bête',                   'Vilhelm%',       'rap-francais'),
    ('La Bête',                   'Vilhelm%',       'melodic-rap'),

    -- Tuerie (rap fr)
    ('Les Amants Terribles',      'Tuerie',         'rap-francais'),
    ('Les Amants Terribles',      'Tuerie',         'trap'),

    -- fakemink (UK rap / afrobeats)
    ('London''s Saviour',         'fakemink',       'uk-rap'),
    ('London''s Saviour',         'fakemink',       'afrobeats'),

    -- Luidji (rap fr / storytelling)
    ('Mécanique des fluides',     'Luidji',         'rap-francais'),
    ('Mécanique des fluides',     'Luidji',         'conscious-rap'),
    ('Saison 00',                 'Luidji',         'rap-francais'),
    ('Station 999',               'Luidji',         'rap-francais'),
    ('Tristesse Business%',       'Luidji',         'rap-francais'),

    -- Tiakola (afrotrap)
    ('Mélo',                      'Tiakola',        'rap-francais'),
    ('Mélo',                      'Tiakola',        'afrotrap'),

    -- Mairo (rap fr)
    ('omar chappier',             'Mairo',          'rap-francais'),

    -- Ptite Soeur (rap fr, trap)
    ('PRETTY DOLLCORPSE',         'Ptite Soeur',    'rap-francais'),
    ('PRETTY DOLLCORPSE',         'Ptite Soeur',    'trap'),

    -- Green Montana (afrotrap / rap fr)
    ('SAUDADE',                   'Green Montana',  'rap-francais'),
    ('SAUDADE',                   'Green Montana',  'afrotrap'),

    -- Theodora (R&B / pop)
    ('Neptune',                   'Theodora',       'contemporary-rnb'),
    ('Neptune',                   'Theodora',       'pop'),

    -- Makala (rap fr / afrobeats)
    ('YAMOTO',                    'Makala',         'rap-francais'),
    ('YAMOTO',                    'Makala',         'afrobeats'),

    -- Leto (rap fr / trap)
    ('THUG CEREMONY',             'Leto',           'rap-francais'),
    ('THUG CEREMONY',             'Leto',           'trap')
)
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT
  a.id    AS album_id,
  g.id    AS genre_id,
  'community' AS source,
  5           AS weight
FROM assignments asn
JOIN albums a  ON a.title ILIKE asn.title_pat
JOIN artists ar ON a.artist_id = ar.id AND ar.name ILIKE asn.artist_pat
JOIN genres g  ON g.slug = asn.genre_slug
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- Vérification
SELECT
  ar.name AS artist,
  a.title,
  string_agg(g.slug, ', ' ORDER BY ag.weight DESC) AS genres
FROM album_genres ag
JOIN albums a   ON ag.album_id = a.id
JOIN genres g   ON ag.genre_id = g.id
JOIN artists ar ON a.artist_id = ar.id
WHERE ag.source = 'community'
  AND a.title ILIKE ANY(ARRAY[
    '23','24','APOCALYPSE','archives','BABYLONE BRÛLE','Bitume Caviar%',
    'Deface the Currency','DEMNA','DOM PERIGNON CRYING','EXTASIA',
    'Farq Kebir','GARÇON','HIGHLY SPIRITUAL','J.000.$','Jeunesse Dorée',
    'La Bête','Les Amants Terribles','London''s Saviour','M.A.N',
    'Mécanique des fluides','Mélo','NAMELESS BELLIGERENT','Neptune',
    'omar chappier','One Man Army','PLM DEATHROW','PRETTY DOLLCORPSE',
    'S/O DIEU','Saison 00','SAUDADE','Station 999','TAMARA',
    'THUG CEREMONY','Tristesse Business%','YAMOTO'
  ])
GROUP BY ar.name, a.title
ORDER BY ar.name, a.title;
