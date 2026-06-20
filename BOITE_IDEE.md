sur les cartes "critique" de la page Activité (FeedCardReviewCreated/FeedCardTrackReviewCreated), les boutons like/répondre ont été retirés (commentés dans le code, pas supprimés) pour la refonte ligne uniforme — la carte entière navigue déjà vers la critique complète où ces actions existent. Trouver une façon plus subtile de les réintroduire sur la carte du feed (icône discrète dans le coin, au survol, etc.) sans recharger la ligne.

liker les titres sur les pages albums, ajouter les singles a la recherche
creer une feed card en consequence : 'X aime 'titre' sur 'album.titre'
version pc
ameliorer encore les scores de pertinence dans la barre de recherche
sur la page album ajouter si des amis ont dej aecouté
ajouter les infos en general sur la page album et artiste, une bio, une description, des tags de genre, les autres albums de la disco ou les artistes / albums similaires
trouver un moyen de mettre un peu des stats sur le profil (peut etre dans un autre onglet du hamburger menu)
dans la page explorer ajouter une section pourtoi
design et UX a fond avec agent special claude
rate limiting partout ?
preparer vps donc rest api, schema de bdd, migration des données
gestion abus, signalement, bloquage
compte privé/public
supprimer page inutiles /diary /import etc
sur le feed, quand on like, il faut refresh la page pour le voir s'activer, ca peut porter a confusion. 
repnser les modals de commentaires et d'ecriture de review pour que plutot que former une carte au milieu, ca fasse comme une page qui monte et prend tout le bas en laissant de la place en haut
changer la presentation du like, pour le moment c'est coeur X en coeur X j'aime et pouvoir cliker sur le 'j'aime' et avoir la liste des gens qui ont liké. 
ajouter les liens spotify partout grace a la commu, et un ecran de modo pour valider les liens. faire participer la commu simplement c'est la clé

si j'ai ecouté l'album, l'activté resau apparait dans le truc mon ecoute alors que ca devrit etre dans le hero juste en dessous des stats

dans les du meme artiste de album, on prend ceux qui ont le plus de listeners

le signalement doit fonctionner dans le pannel admin. le signalement de tracks ne retourne pas le texte. signaler aussi les commentaires ? rate limit sur les signalements ? 

revoir le feed entierement ? ou au moins les textes dans les cartes

taffer sur les listes : ajout rapide, enlever de la liste quand on note etc. 

contenu pour le snouveaux utilisateurs

onboarding tout neuf

pages legales a refaire un peu surtotu que maintenant qu'il y a la page support

voir le parcours utilisateur, est ce que c'est vraiment bien de faire / puis /auth, ca peut casser l'experience.

refaire /, /auth, /add avec claude design. 



---

## Triage suite à un gros doc d'idées "engagement/addictif" (session redesign Explore/Activité)

### Déjà construit mais sous-exploité — à corriger avant d'ajouter du neuf
- cartes de partage : ShareButton existe mais c'est une icône de 15px planquée dans un sous-menu d'entrée de journal, quasi invisible. Le vrai chantier c'est de lui donner une place (CTA visible juste après avoir noté un album), pas refaire le partage.
- "profils proches" / taste-matching : SimilarUsersSection existe sur Explore mais dépend d'une table ML (user_similarity) peuplée en batch offline — vide tant que le batch n'a pas tourné pour l'utilisateur. Vérifier si ce batch tourne vraiment en prod.
- badge "ça me concerne" sur Activité : déjà vrai dans le code, exclut déjà tes propres actions.
- onboarding première action rapide : déjà fait (genres → 3 albums → suivre quelqu'un).

### Idées neuves pertinentes, effort modeste
- feedback après notation (pas juste un toast "ajouté", un retour qui fait sentir que le profil évolue)
- "à noter rapidement" sur Explore : cartes avec notation inline, sans ouvrir la page album
- critique minimale / tags "vibe" (sombre, nostalgique, énergique...) au lieu de forcer du texte
- collections implicites (X/10 albums essentiels d'un artiste, X albums des années 2010 explorés) — à vérifier si les albums ont déjà des métadonnées de genre/décennie exploitables

### Pertinent mais gros effort ou ROI incertain à l'échelle actuelle
- weekly recap (genre dominant, album le plus clivant, etc.) — demande de vraies agrégations
- comparaisons sociales ("plus sévère que 72% des gens") — avec peu d'utilisateurs, les pourcentages seraient statistiquement creux
- formule de ranking pondérée pour Explore — le problème actuel c'est le volume de données (cold start), pas la sophistication du ranking
- nav contextuelle (bouton + qui change de label selon le contexte) — risque de complexité pour un gain cosmétique

### Process à prioriser, pas une feature
- instrumentation/analytics : aucun event "jour actif"/retention tracké aujourd'hui. Construire des features d'engagement sans pouvoir mesurer si elles marchent, c'est designer à l'aveugle — probablement plus urgent que la moitié des idées ci-dessus.

### À ne pas faire pour l'instant
messagerie privée, ML lourd, refonte complète du feed, trop de badges/notifs push, marketplace de recommandations, playlists trop ambitieuses.

