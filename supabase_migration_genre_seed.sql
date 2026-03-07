-- =============================================================================
-- GENRE SEED — Familles + sous-genres + assignation par artiste
-- Idempotent : ON CONFLICT DO NOTHING partout
-- =============================================================================

-- 1. INSERT toutes les familles et sous-genres
-- =============================================================================
INSERT INTO genres (name, slug) VALUES
  -- Familles
  ('Hip-hop / Rap',     'hip-hop'),
  ('R&B / Soul',        'soul'),
  ('Pop',               'pop'),
  ('Rock',              'rock'),
  ('Électronique',      'electronic'),
  ('Jazz',              'jazz'),
  ('Folk / Acoustique', 'folk'),
  ('Classique',         'classical'),
  ('Metal',             'metal'),
  ('Reggae',            'reggae'),
  ('Funk',              'funk'),
  ('Latin',             'latin'),
  ('Afrobeats',         'afrobeats'),
  ('Blues',             'blues'),
  ('Bande originale',   'soundtrack'),
  -- Hip-hop subgenres
  ('Trap',              'trap'),
  ('Drill',             'drill'),
  ('Boom bap',          'boom-bap'),
  ('Cloud rap',         'cloud-rap'),
  ('Afrotrap',          'afrotrap'),
  ('Lo-fi hip-hop',     'lo-fi-hip-hop'),
  ('Conscious rap',     'conscious-rap'),
  -- R&B subgenres
  ('Neo-soul',          'neo-soul'),
  ('R&B contemporain',  'contemporary-rnb'),
  ('Gospel',            'gospel'),
  -- Pop subgenres
  ('Indie pop',         'indie-pop'),
  ('Synth-pop',         'synth-pop'),
  ('Dream pop',         'dream-pop'),
  ('Dance-pop',         'dance-pop'),
  ('Art pop',           'art-pop'),
  ('K-pop',             'k-pop'),
  -- Rock subgenres
  ('Indie rock',        'indie-rock'),
  ('Alt. rock',         'alternative-rock'),
  ('Punk',              'punk'),
  ('Post-rock',         'post-rock'),
  ('Grunge',            'grunge'),
  ('Psychédélique',     'psychedelic-rock'),
  ('Garage rock',       'garage-rock'),
  -- Electronic subgenres
  ('House',             'house'),
  ('Techno',            'techno'),
  ('Ambient',           'ambient'),
  ('Drum & Bass',       'drum-and-bass'),
  ('Trip-hop',          'trip-hop'),
  ('IDM',               'idm'),
  ('Trance',            'trance'),
  -- Jazz subgenres
  ('Bebop',             'bebop'),
  ('Free jazz',         'free-jazz'),
  ('Jazz fusion',       'jazz-fusion'),
  ('Nu jazz',           'nu-jazz'),
  -- Folk subgenres
  ('Indie folk',        'indie-folk'),
  ('Singer-songwriter', 'singer-songwriter'),
  ('Bluegrass',         'bluegrass'),
  ('Country',           'country'),
  -- Classical subgenres
  ('Baroque',           'baroque'),
  ('Romantique',        'romantic'),
  ('Minimaliste',       'minimalism'),
  ('Opéra',             'opera'),
  -- Metal subgenres
  ('Heavy metal',       'heavy-metal'),
  ('Death metal',       'death-metal'),
  ('Black metal',       'black-metal'),
  ('Doom metal',        'doom-metal'),
  ('Post-metal',        'post-metal'),
  -- Reggae subgenres
  ('Dancehall',         'dancehall'),
  ('Dub',               'dub'),
  ('Roots reggae',      'roots-reggae'),
  ('Ska',               'ska'),
  -- Latin subgenres
  ('Reggaeton',         'reggaeton'),
  ('Salsa',             'salsa'),
  ('Bossa nova',        'bossa-nova'),
  ('Cumbia',            'cumbia'),
  -- Afrobeats subgenres
  ('Amapiano',          'amapiano'),
  ('Afropop',           'afropop'),
  ('Highlife',          'highlife'),
  -- Blues subgenres
  ('Delta blues',       'delta-blues'),
  ('Chicago blues',     'chicago-blues'),
  -- Soundtrack subgenres
  ('Film',              'film-score'),
  ('Jeux vidéo',        'video-game-music')
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- 2. ASSIGNATION par artiste — hip-hop / rap
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'hip-hop'
WHERE lower(ar.name) IN (
  -- FR
  'damso','booba','kaaris','jul','sch','ninho','niska','soolking','lacrim',
  'maes','sadek','hamza','freeze corleone','nekfeu','orelsan','bigflo & oli',
  'kery james','sinik','soprano','rohff','mc solaar','iam','akhenaton',
  'oxmo puccino','la fouine','gims','maître gims','alonzo','alkpote',
  'lomepal','vald','doomams','deen burbigo','youssoupha','kofs','zoxea',
  'dinos','furax barbarossa','médine','akhenaton','k-ricch','rim-k',
  -- US
  'kendrick lamar','drake','kanye west','jay-z','eminem','j. cole','nas',
  'wu-tang clan','a$ap rocky','travis scott','tyler, the creator',
  'earl sweatshirt','childish gambino','chance the rapper','common',
  'mos def','talib kweli','rakim','the notorious b.i.g.','tupac','2pac',
  'snoop dogg','dr. dre','outkast','a tribe called quest','de la soul',
  'gang starr','big l','big pun','fat joe','jadakiss','fabolous',
  'method man','redman','ghostface killah','raekwon','gza','rza',
  'lil wayne','nicki minaj','cardi b','migos','future','young thug',
  'lil baby','gunna','dababy','polo g','roddy ricch','lil uzi vert',
  'rick ross','meek mill','big sean','macklemore','logic','wale',
  'schoolboy q','ab-soul','jay rock','mac miller','vince staples',
  'freddie gibbs','boldy james','conway the machine','westside gunn',
  'benny the butcher','action bronson','flatbush zombies','joey bada$$',
  'denzel curry','jpegmafia','run the jewels','mf doom','j dilla',
  'pusha t','ice cube','ice-t','dmx','ll cool j','missy elliott',
  'lauryn hill','queen latifah','salt-n-pepa','eve','lil kim',
  'post malone','juice wrld','xxxtentacion','lil peep','trippie redd',
  'yelawolf','tech n9ne','hopsin','token','joyner lucas','tom macdonald'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 3. R&B / Soul
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'soul'
WHERE lower(ar.name) IN (
  'frank ocean','sza','h.e.r.','beyoncé','beyonce','rihanna','alicia keys',
  'john legend','d''angelo','erykah badu','maxwell','marvin gaye',
  'whitney houston','aretha franklin','ray charles','sam cooke',
  'otis redding','james brown','al green','earth, wind & fire',
  'lionel richie','luther vandross','mary j. blige','usher','chris brown',
  'ne-yo','miguel','the weeknd','bryson tiller','daniel caesar',
  'brent faiyaz','lucky daye','summer walker','ari lennox','jazmine sullivan',
  'kehlani','ella mai','khalid','giveon','dvsn','jeremih','trey songz',
  'r. kelly','aaliyah','destiny''s child','tlc','en vogue','new edition',
  'boyz ii men','98 degrees','jodeci','dru hill','jaheim','joe','musiq soulchild',
  'anthony hamilton','kem','ledisi','tank','ginuwine','tyrese','mario',
  'omarion','pleasure p','tank','robin thicke','jason derulo',
  'solange','janelle monáe','amy winehouse','lianne la havas','corinne bailey rae',
  'joss stone','duffy','adele','sam smith','tom jones'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 4. Rock / Alternative
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'rock'
WHERE lower(ar.name) IN (
  -- Alternative / Indie
  'pixies','radiohead','arctic monkeys','the strokes','the national',
  'interpol','bloc party','franz ferdinand','the white stripes','jack white',
  'the black keys','vampire weekend','mgmt','phoenix','tame impala',
  'beach house','bon iver','fleet foxes','sufjan stevens','angel olsen',
  'weezer','green day','blink-182','the killers','the libertines',
  'the hives','the vines','the datsuns','the coral',
  -- Grunge / 90s
  'nirvana','pearl jam','soundgarden','alice in chains','stone temple pilots',
  'smashing pumpkins','foo fighters','bush','live','matchbox twenty',
  -- Classic rock
  'the beatles','the rolling stones','led zeppelin','pink floyd','the doors',
  'jimi hendrix','cream','the who','the kinks','the animals',
  'david bowie','lou reed','the velvet underground','iggy pop','patti smith',
  'blondie','talking heads','the clash','sex pistols','the ramones',
  'bruce springsteen','tom petty','r.e.m.','u2','depeche mode',
  -- Post-punk / Goth
  'the smiths','the cure','joy division','new order','bauhaus',
  'siouxsie and the banshees','the sisters of mercy',
  -- Britpop
  'oasis','blur','pulp','suede','elastica','supergrass','the verve',
  -- Modern
  'queens of the stone age','muse','rage against the machine',
  'system of a down','linkin park','tool','a perfect circle',
  'nine inch nails','marilyn manson','the mars volta','at the drive-in',
  'wilco','the flaming lips','modest mouse','the shins','death cab for cutie',
  'bright eyes','conor oberst','pavement','built to spill','dinosaur jr',
  'sonic youth','pixies','guided by voices','tv on the radio','lcd soundsystem'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 5. Électronique
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'electronic'
WHERE lower(ar.name) IN (
  'daft punk','justice','aphex twin','burial','four tet','boards of canada',
  'massive attack','portishead','tricky','moby','the chemical brothers',
  'the prodigy','underworld','orbital','autechre','squarepusher','arca',
  'rone','mr. oizo','kavinsky','gesaffelstein','sebastian','boys noize',
  'moderat','nils frahm','jon hopkins','olafur arnalds','nils frahm',
  'tycho','bonobo','washed out','com truise','m83','air','phoenix',
  'lcd soundsystem','hot chip','james murphy','groove armada','basement jaxx',
  'deadmau5','skrillex','diplo','flume','odesza','porter robinson',
  'madeon','zedd','martin garrix','tiësto','armin van buuren',
  'eric prydz','bicep','andy c','goldie','roni size','lt j bukem',
  'lauryn hill' -- trip-hop edge case — skip actually
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 6. Jazz
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'jazz'
WHERE lower(ar.name) IN (
  'miles davis','john coltrane','charles mingus','thelonious monk',
  'bill evans','dave brubeck','charlie parker','dizzy gillespie',
  'duke ellington','louis armstrong','herbie hancock','wayne shorter',
  'chet baker','art blakey','max roach','sonny rollins','ornette coleman',
  'mingus','chick corea','keith jarrett','pat metheny','john scofield',
  'joe henderson','freddie hubbard','woody shaw','lee morgan',
  'cannonball adderley','wes montgomery','django reinhardt','oscar peterson',
  'erroll garner','ahmad jamal','mccoy tyner','elvin jones','tony williams',
  'jack dejohnette','paul motian','brad mehldau','jason moran',
  'kamasi washington','robert glasper','kendrick scott','christian scott',
  'nubya garcia','shabaka hutchings','sons of kemet','the comet is coming',
  'flying lotus','thundercat','anderson .paak' -- jazz-adjacent
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 7. Metal
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'metal'
WHERE lower(ar.name) IN (
  'black sabbath','deep purple','ac/dc','metallica','slayer','megadeth',
  'anthrax','iron maiden','judas priest','ozzy osbourne','dio',
  'pantera','sepultura','machine head','lamb of god','as i lay dying',
  'parkway drive','killswitch engage','trivium','bullet for my valentine',
  'avenged sevenfold','disturbed','breaking benjamin','three days grace',
  'tool','mastodon','opeth','gojira','converge','neurosis','isis',
  'sunn o)))','earth','electric wizard','sleep','kyuss',
  'death','cannibal corpse','obituary','morbid angel','deicide',
  'dimmu borgir','cradle of filth','emperor','mayhem','darkthrone',
  'burzum','satyricon','enslaved','wolves in the throne room',
  'ghost','avatar','babymetal','nightwish','within temptation','evanescence'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 8. Folk / Acoustique
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'folk'
WHERE lower(ar.name) IN (
  'bob dylan','neil young','joni mitchell','james taylor','paul simon',
  'simon & garfunkel','cat stevens','nick drake','leonard cohen','van morrison',
  'joan baez','pete seeger','woody guthrie','emmylou harris','townes van zandt',
  'john prine','guy clark','steve earle','lucinda williams','gillian welch',
  'iron & wine','sufjan stevens','bonnie prince billy','devendra banhart',
  'joanna newsom','antony and the johnsons','antony hegarty',
  'fleet foxes','bon iver','the head and the heart','the lumineers',
  'mumford & sons','the avett brothers','the civil wars','the decemberists',
  'sun kil moon','mark kozelek','conor oberst','bright eyes','damien rice',
  'laura marling','lucy rose','lucy dacus','phoebe bridgers','boygenius',
  'julien baker','mitski','angel olsen','hozier','ben howard','jose gonzalez',
  'nick mulvey','ed sheeran','james blunt','passenger','jake bugg'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 9. Pop
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'pop'
WHERE lower(ar.name) IN (
  'taylor swift','ariana grande','billie eilish','harry styles','dua lipa',
  'olivia rodrigo','lizzo','halsey','lorde','lana del rey','sia','adele',
  'katy perry','lady gaga','madonna','michael jackson','janet jackson',
  'prince','george michael','elton john','david bowie','cyndi lauper',
  'tina turner','diana ross','the supremes','abba','bee gees',
  'the jackson 5','new kids on the block','backstreet boys','nsync',
  '*nsync','spice girls','destiny''s child','tlc','no doubt','gwen stefani',
  'pink','avril lavigne','kelly clarkson','alicia keys','fergie',
  'selena gomez','demi lovato','miley cyrus','justin bieber','shawn mendes',
  'charlie puth','sam smith','troye sivan','børns','maggie rogers',
  'caroline polachek','charli xcx','sophie','rina sawayama','dorian electra',
  'stromae','zaz','indochine','m','master kg','aya nakamura','wejdene'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 10. Reggae
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'reggae'
WHERE lower(ar.name) IN (
  'bob marley','bob marley & the wailers','the wailers','peter tosh',
  'bunny wailer','jimmy cliff','toots and the maytals','desmond dekker',
  'lee scratch perry','king tubby','augustus pablo','burning spear',
  'culture','israel vibration','steel pulse','lucky dube','alpha blondy',
  'tiken jah fakoly','damian marley','stephen marley','ziggy marley',
  'julian marley','sean paul','beenie man','bounty killer','vybz kartel',
  'popcaan','chronixx','protoje','sizzla','capleton','buju banton',
  'shaggy','ini kamoze','shabba ranks','super cat','mad cobra'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 11. Afrobeats
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'afrobeats'
WHERE lower(ar.name) IN (
  'burna boy','wizkid','davido','ckay','rema','fireboy dml','omah lay',
  'tems','asake','kizz daniel','patoranking','yemi alade','tiwa savage',
  'mr eazi','afrozone','afro b','masterkraft','dj spinall',
  'black coffee','dj maphorisa','kabza de small','young stunna',
  'sun-el musician','focalistic','nasty c','nadia nakai','sjava',
  'ladysmith black mambazo','miriam makeba','fela kuti','femi kuti','seun kuti',
  'tony allen','king sunny ade','ebenezer obey','highlife'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 12. Latin
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'latin'
WHERE lower(ar.name) IN (
  'bad bunny','j balvin','maluma','ozuna','anuel aa','daddy yankee',
  'don omar','wisin & yandel','wisin','yandel','tego calderon',
  'nicky jam','farruko','sech','jhay cortez','rauw alejandro',
  'myke towers','lunay','mora','justin quiles','lenny tavárez',
  'celia cruz','marc anthony','marc anthony','salsa','carlos santana',
  'ibrahim ferrer','compay segundo','buena vista social club','rubén blades',
  'héctor lavoe','willie colón','tito puente','celia cruz',
  'astrud gilberto','stan getz','antonio carlos jobim','caetano veloso',
  'gilberto gil','jorge ben jor','seu jorge','tropicalismo',
  'shakira','juanes','carlos vives','vallenato','silvio rodríguez'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 13. Blues
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'blues'
WHERE lower(ar.name) IN (
  'muddy waters','howlin'' wolf','b.b. king','albert king','freddie king',
  'john lee hooker','robert johnson','son house','skip james',
  'charley patton','blind lemon jefferson','leadbelly','big bill broonzy',
  'elmore james','lightnin'' hopkins','sonny boy williamson','little walter',
  'buddy guy','junior wells','otis rush','magic sam','james cotton',
  'stevie ray vaughan','albert collins','gary moore','joe bonamassa',
  'tab benoit','jonny lang','kenny wayne shepherd','robert cray',
  'keb'' mo''','eric clapton' -- blues/rock crossover
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- 14. Classique
-- =============================================================================
INSERT INTO album_genres (album_id, genre_id, source, weight)
SELECT DISTINCT a.id, g.id, 'community', 8
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN genres g ON g.slug = 'classical'
WHERE lower(ar.name) IN (
  'bach','mozart','beethoven','chopin','brahms','schubert','schumann',
  'liszt','mendelssohn','dvorak','tchaikovsky','mahler','bruckner',
  'wagner','verdi','puccini','rossini','handel','vivaldi','telemann',
  'monteverdi','debussy','ravel','satie','faure','saint-saëns',
  'stravinsky','prokofiev','shostakovich','bartok','britten','ligeti',
  'messiaen','boulez','stockhausen','arvo pärt','john adams','philip glass',
  'steve reich','la monte young','morton feldman','georg friedrich haas',
  'max richter','ólafur arnalds','nils frahm','yann tiersen'
)
ON CONFLICT (album_id, genre_id) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
SELECT
  (SELECT count(*) FROM genres) as total_genres,
  (SELECT count(*) FROM album_genres WHERE source = 'community') as community_assignments,
  (SELECT count(DISTINCT album_id) FROM album_genres WHERE source = 'community') as albums_with_community_genre;
