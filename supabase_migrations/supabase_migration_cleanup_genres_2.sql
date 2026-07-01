-- ============================================================
-- WAVEFORM — Migration : nettoyage des genres parasites (vague 2)
-- À exécuter via le Supabase SQL Editor
-- ============================================================

-- Étape 1 : supprimer les album_genres liés aux genres à retirer
DELETE FROM album_genres WHERE genre_id IN (
  SELECT id FROM genres WHERE slug IN (
    -- Noms d'artistes / groupes
    '21-savage', '3-doors-down', 'action-bronson', 'adele', 'al-green',
    'allan-holdsworth', 'amy-winehouse', 'audioslave', 'baby-keem',
    'bill-withers', 'bob-marley', 'bob-seger', 'buckcherry', 'chantal-goya',
    'curtis-mayfield', 'dan-reed-network', 'destroy-lonely', 'dido',
    'dj-premier', 'dr-dre', 'drake', 'eagles', 'fleetwood-mac',
    'foo-fighters', 'gang-starr', 'george-michael', 'green-day',
    'grover-washington-jr', 'guns-n-roses', 'herbie-hancock', 'james-taylor',
    'jamiroquai', 'johnny-cash', 'judas-priest', 'kate-bush', 'katy-perry',
    'kenza-flowers', 'kid-cudi', 'kid-rock', 'lana-del-rey', 'led-zeppelin',
    'leonard-cohen', 'level-42', 'li-twan', 'lil-baby', 'lil-tecca',
    'lil-uzi-vert', 'mac-miller', 'marcus-miller', 'mariah-carey', 'metallica',
    'michael-giacchino', 'michel-delpech', 'michel-polnareff', 'mike-patton',
    'miles-davis', 'milton-nascimento', 'modest-mouse', 'muse', 'nas',
    'nick-drake', 'nina-simone', 'norah-jones', 'outkast', 'pete-rock',
    'serge-gainsbourg', 'shreya-ghoshal', 'silver-jews', 'snoop-dogg',
    'system-of-a-down', 'taylor-swift', 'the-alchemist', 'the-beatles',
    'the-offspring', 'the-roots', 'the-runners', 'toni-braxton',
    'trippie-redd', 'wayne-shorter', 'whitney-houston', 'willie-colon',
    'zeph-ellis', 'mohitchauhan', 'anirudh', 'ravichander', 'conny-plank',
    'gilles-peterson',

    -- Pays / nationalités
    'africa', 'african', 'algerie', 'australian', 'benin', 'brasil',
    'brazilian', 'california', 'canada', 'colombia', 'cuba', 'cuban',
    'deutsch', 'english', 'florida', 'icelandic', 'india', 'indian',
    'italian', 'italiano', 'japan', 'korean', 'london', 'louisiana', 'mali',
    'morocco', 'nigeria', 'nigerian', 'ohio', 'panama', 'polish',
    'quebecois', 'spanish', 'swedish', 'switzerland', 'tamil', 'uk',

    -- Notes / scores
    '10', '10-of-10-stars', '2-out-of-5', '3-out-of-5', '4-out-of-5',
    '4-stars', '8-of-10-stars', 'billboard-hot-100',

    -- Listes "best of [année]"
    'best-of-2008', 'best-of-2009', 'best-of-2010', 'best-of-2011',
    'best-of-2013', 'best-of-2014', 'best-of-2016', 'best-of-2025',
    'best-of-breakcore',

    -- Tags d'opinion / méta
    'aaa', 'albumsiown', 'banned', 'best-album-ever', 'best-song-ever',
    'disliked', 'fav', 'funny', 'genius', 'great-quality-stuff', 'happy',
    'holy-fucking-shit', 'hope', 'insane', 'listen', 'love-at-first-listen',
    'love-songs', 'masterpiece', 'mid', 'mistagged', 'my-top-songs', 'nice',
    'nice-slow', 'powerful', 'romantic', 'serious', 'simon-approved',
    'something-beautiful', 'something-lovely', 'soundtrack-to-my-life',
    'sweet', 'sexy', 'sex', 'ass', 'tension', 'time', 'try-later', 'up',
    'vinyl', 'vinyl-i-own', 'warm', 'weed', 'drugs', 'god', 'goat',
    'cursed', 'cult', 'animals', 'woman', 'yeah', 'drama',

    -- Films / pop culture
    'arrival', 'inception', 'interstellar', 'star-wars', 'blade-runner',
    'marvel', 'requiem-for-a-dream', 'as-above-so-below',

    -- Données de test
    'batch-test', 'test-tag', 'artist-session1-track1', '77davez-all-tracks',
    'drjazzmrfunkmusic', 'kg0516',

    -- Bruit pur / tags absurdes
    'aldi', 'berro', 'chasin', 'domo', 'drums-please-fab', 'fiesta-shit',
    'heis', 'juggin', 'luanco', 'sauce', 'ysl', 'bangin-beats',
    'motherfuckin-rabbits-ejaculating-sunshine', 'post-revolutionary-pop-song',
    'we-love-glaive', 'wills-beat-radio', 'labores-somnium', 'nervous-music',
    'boy-slow-down', 'fool-game', 'xav', 'mitch', 'of',

    -- Doublons (on garde k-pop / mashup)
    'kpop', 'mash-up'
  )
);

-- Étape 2 : supprimer les genres eux-mêmes
DELETE FROM genres WHERE slug IN (
  '21-savage', '3-doors-down', 'action-bronson', 'adele', 'al-green',
  'allan-holdsworth', 'amy-winehouse', 'audioslave', 'baby-keem',
  'bill-withers', 'bob-marley', 'bob-seger', 'buckcherry', 'chantal-goya',
  'curtis-mayfield', 'dan-reed-network', 'destroy-lonely', 'dido',
  'dj-premier', 'dr-dre', 'drake', 'eagles', 'fleetwood-mac',
  'foo-fighters', 'gang-starr', 'george-michael', 'green-day',
  'grover-washington-jr', 'guns-n-roses', 'herbie-hancock', 'james-taylor',
  'jamiroquai', 'johnny-cash', 'judas-priest', 'kate-bush', 'katy-perry',
  'kenza-flowers', 'kid-cudi', 'kid-rock', 'lana-del-rey', 'led-zeppelin',
  'leonard-cohen', 'level-42', 'li-twan', 'lil-baby', 'lil-tecca',
  'lil-uzi-vert', 'mac-miller', 'marcus-miller', 'mariah-carey', 'metallica',
  'michael-giacchino', 'michel-delpech', 'michel-polnareff', 'mike-patton',
  'miles-davis', 'milton-nascimento', 'modest-mouse', 'muse', 'nas',
  'nick-drake', 'nina-simone', 'norah-jones', 'outkast', 'pete-rock',
  'serge-gainsbourg', 'shreya-ghoshal', 'silver-jews', 'snoop-dogg',
  'system-of-a-down', 'taylor-swift', 'the-alchemist', 'the-beatles',
  'the-offspring', 'the-roots', 'the-runners', 'toni-braxton',
  'trippie-redd', 'wayne-shorter', 'whitney-houston', 'willie-colon',
  'zeph-ellis', 'mohitchauhan', 'anirudh', 'ravichander', 'conny-plank',
  'gilles-peterson',

  'africa', 'african', 'algerie', 'australian', 'benin', 'brasil',
  'brazilian', 'california', 'canada', 'colombia', 'cuba', 'cuban',
  'deutsch', 'english', 'florida', 'icelandic', 'india', 'indian',
  'italian', 'italiano', 'japan', 'korean', 'london', 'louisiana', 'mali',
  'morocco', 'nigeria', 'nigerian', 'ohio', 'panama', 'polish',
  'quebecois', 'spanish', 'swedish', 'switzerland', 'tamil', 'uk',

  '10', '10-of-10-stars', '2-out-of-5', '3-out-of-5', '4-out-of-5',
  '4-stars', '8-of-10-stars', 'billboard-hot-100',

  'best-of-2008', 'best-of-2009', 'best-of-2010', 'best-of-2011',
  'best-of-2013', 'best-of-2014', 'best-of-2016', 'best-of-2025',
  'best-of-breakcore',

  'aaa', 'albumsiown', 'banned', 'best-album-ever', 'best-song-ever',
  'disliked', 'fav', 'funny', 'genius', 'great-quality-stuff', 'happy',
  'holy-fucking-shit', 'hope', 'insane', 'listen', 'love-at-first-listen',
  'love-songs', 'masterpiece', 'mid', 'mistagged', 'my-top-songs', 'nice',
  'nice-slow', 'powerful', 'romantic', 'serious', 'simon-approved',
  'something-beautiful', 'something-lovely', 'soundtrack-to-my-life',
  'sweet', 'sexy', 'sex', 'ass', 'tension', 'time', 'try-later', 'up',
  'vinyl', 'vinyl-i-own', 'warm', 'weed', 'drugs', 'god', 'goat',
  'cursed', 'cult', 'animals', 'woman', 'yeah', 'drama',

  'arrival', 'inception', 'interstellar', 'star-wars', 'blade-runner',
  'marvel', 'requiem-for-a-dream', 'as-above-so-below',

  'batch-test', 'test-tag', 'artist-session1-track1', '77davez-all-tracks',
  'drjazzmrfunkmusic', 'kg0516',

  'aldi', 'berro', 'chasin', 'domo', 'drums-please-fab', 'fiesta-shit',
  'heis', 'juggin', 'luanco', 'sauce', 'ysl', 'bangin-beats',
  'motherfuckin-rabbits-ejaculating-sunshine', 'post-revolutionary-pop-song',
  'we-love-glaive', 'wills-beat-radio', 'labores-somnium', 'nervous-music',
  'boy-slow-down', 'fool-game', 'xav', 'mitch', 'of',

  'kpop', 'mash-up'
);

-- Étape 3 : genres orphelins (0 albums liés)
DELETE FROM genres WHERE id NOT IN (SELECT DISTINCT genre_id FROM album_genres);
