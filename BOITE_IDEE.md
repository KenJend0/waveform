sur les cartes "critique" de la page Activité (FeedCardReviewCreated/FeedCardTrackReviewCreated), les boutons like/répondre ont été retirés (commentés dans le code, pas supprimés) pour la refonte ligne uniforme — la carte entière navigue déjà vers la critique complète où ces actions existent. Trouver une façon plus subtile de les réintroduire sur la carte du feed (icône discrète dans le coin, au survol, etc.) sans recharger la ligne.


version pc

trouver un moyen de mettre un peu des stats sur le profil (peut etre dans un autre onglet du hamburger menu)


preparer vps donc rest api, schema de bdd, migration des données

gestion abus, signalement, bloquage

compte privé/public

supprimer page inutiles /diary /import etc

depuis la refonte de la page /feed en page secondaire /activité, il n'est plus possible de voir la liste des gens qui ont aimé que ce soit sur /diary ou /track-diary ou encore sur le profil dans la tab "critiques", on ne peut pas savoir qui a liké notre ecoute. 

voit l'affichage dans sur les pages albums et artistes si on a rien pour "albums similaires" ou "artistes similaires"

l'enrichissement des albums fonctionne bien on couvre a 99% les liens streaming et les covers mais seulement 30% les tags. dans une appli ou on veut faire de la recommendation aux gens, il faut trouver une solution pour peupler ca. ca peut etre fait a la main, une IA, une source externe, on a deja mis en place les votes communautaires, mais je ne sais pas si c'est vraiment pris en compte.

Concernant les votes de genres communautaires, il faut aider l'utilsateur a faire un choix, on ne connait pas tous les styles de musiques et on ne sait pas quoi choisir donc il faut reprenser un peu ca car pour le moment, beaucoup de monde prefere skipper le vote car il ne sait pas rpeondre plutot que proposer quelque chose 

le signalement doit fonctionner dans le pannel admin. le signalement de tracks ne retourne pas le texte. signaler aussi les commentaires ? rate limit sur les signalements ? 

revoir les textes dans les cartes de /feed pour que ce soit parfait.

taffer sur les listes : ajout rapide, enlever de la liste quand on note etc. 

contenu pour le snouveaux utilisateurs

onboarding tout neuf

pages legales a refaire un peu surtotu que maintenant qu'il y a la page support

voir le parcours utilisateur, est ce que c'est vraiment bien de faire / puis /auth, ca peut casser l'experience.

refaire /, /auth, /add avec claude design. 

l'idée de la fleche de retour, je suis de moins en moins convaincu, des fois on peut un peu se "perdre" genre activité puis diary puis artiste puis un album puis un track puis le compte de quelqu'un et la pour revenir a activité, il faut faire 5 fois la fleche de retour. il faut soit reintroduire la navbar partout, soit trouver un moyen d'etre plus clair avec l'utilisateur.

maintenant que /explore est devenue la page principale de l'app, est ce qu'il y a assez de contenu pour tout le monde (non c'est sur) comment changer ca et comment faire passer un cap au design de la page pour qu'elle fasse vraie entrée de l'app (prompt claude design).

peut etre essayer de creer un github action qui check si on a importer des doublons, albums ou titres et qui supprime la mauvaise version en recuperant les reviews et notes si il y en a et en les reattribuant a la bonne et unique version du titre ou de l'album.

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

---

## Mis de côté pendant la refonte /explore (lots 1-7 + ajustements)

- **Multi-curateurs pour "La sélection de [créateur]"** — aujourd'hui un seul curateur (toi), géré à la main via SQL. Ouvrir à d'autres personnes (influenceurs) demanderait une table d'allowlist + un vrai formulaire de soumission (piste évoquée : onglet dédié dans `/add`, toggle dans `/add`, ou entrée dans le menu hamburger de `/me`). Mis de côté car ça ouvre des questions non tranchées : qui peut devenir curateur, vérification, modération, cohabitation de plusieurs picks en même temps.
- **Signal implicite "clic sans note" sur les recos "Pour toi"** — symétrique du bouton "Pas pour moi" (signal négatif explicite) mais pour un signal positif faible. L'infra de tracking existe déjà (`product_events`), mais logguer l'événement ne servirait à rien tant que le pipeline ML ne le lit pas dans son scoring — demande une passe supplémentaire.
- **Raison affichée sur les recos "Pour toi"** ("comme La Femme", "tu as aimé Homework") — retiré du design final car aucune donnée de provenance n'est stockée aujourd'hui (le pipeline ML précalculé ne garde que album_id/score/rank). Le fallback Jaccard pourrait théoriquement la calculer, mais ce n'est pas branché.
- **Note moyenne et compteur d'écoutes affichés sur "Tendances"** — volontairement absents : avec le volume actuel d'utilisateurs, ces chiffres ne seraient pas fiables/honnêtes. À reconsidérer quand la base grandira.
- **% de compatibilité de goût affiché sur "Goûts similaires"** — calculé côté serveur et utilisé pour le tri, mais pas montré à l'écran pour la même raison (peu de données, risque de donner une impression fausse). À reconsidérer plus tard.
- **Pastilles de contexte par genre sur "Hors de ta bulle"** ("genre rare chez toi", "classique jazz") — bloquées tant que les tags de genre ne sont pas peuplés en base (cf. item d'enrichissement des tags plus haut dans ce fichier).
- **`is_saved` (sauvegarde de liste) non calculé dans `getUserLists`/`getPublicUserLists`** — seulement dans `getPublicLists` (utilisé par `/explore` et `/lists`). Pas un vrai manque sauf si on affiche un jour le bouton "sauvegarder" sur les listes depuis un profil public ou ses propres listes.
- **Pagination réelle de la page "Listes" (`/lists`)** — plafonnée à 30 résultats pour l'instant, largement suffisant au volume actuel. À remplacer par une vraie pagination si on approche un jour ce plafond.

