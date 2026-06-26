# Prompt pour Claude Design — Refonte visuelle de la page /add (mobile)

## Contexte produit

Waveform est une app de journal musical (équivalent Letterboxd pour la musique) : les utilisateurs notent et commentent les albums/titres qu'ils écoutent. L'app a 4 sections principales accessibles depuis une bottom navbar mobile : /explore (découverte), /feed (activité sociale), /me (profil), et /add (noter une écoute).

/explore, /feed et /me sont considérées comme visuellement et fonctionnellement aboutie. /add, elle, était la page la moins travaillée de l'app — c'est ce qu'on vient de corriger fonctionnellement, et on a maintenant besoin d'un vrai saut qualitatif en design pour qu'elle soit au niveau des trois autres.

## Charte graphique actuelle (à respecter strictement)

Identité : "journal intime analogique" — chaud, doux, papier, surtout pas technologique/froid.

**Couleurs**
- Fond principal : `#F5F3EF` (crème chaude)
- Fond secondaire (cards, inputs) : `#ECE8E1`
- Fond tertiaire (hover, cards feed) : `#E4DFD6`
- Fond clair "papier" (hover, modales, sidebar, badges) : `#FAF8F4`
- Texte principal : `#1C1C1C` ; texte secondaire (métadonnées) : `#6B6B6B` ; texte tertiaire (timestamps) : `#9A9A9A` ; texte désactivé : `#BDBDBD`
- Encre tiède `#2A2520` — réservée aux titres en Instrument Serif uniquement
- Accent brun chaud `#8E6F5E` (liens, badges, ornements) ; accent profond `#5C4538` (hover, CTA primaires, italique display) ; accent muted `rgba(142,111,94,0.08)` pour les fonds très légers
- Sauge `#7A8471` (boutons "Suivre", états neutres) ; rouge désaturé `#C86C6C` (likes)
- Bordures `#D8D3CB` (standard) / `#DDD7CF` (séparateur léger) ; filet ornemental `#C9C2B5` (séparateurs de date)

**Typographie**
- Inter pour tout le corps de texte, labels, boutons
- Instrument Serif pour les titres de page, noms d'albums, stats chiffrées, badges de note, citations en italique — c'est la signature visuelle de la marque, à exploiter davantage si possible
- Échelle : h1 32px/1.1, h2 22px/1.2 (Instrument Serif), h3 24px/1.3 (Inter medium), body 16px/1.75, meta 14px/1.5, label 12px uppercase tracking 0.06em

**Rayons** : cards 12px, sidebar/banners 14px, boutons rectangulaires 8px, pills 99px, inputs 10px, covers d'album 10px (8px en compact), badges 6px/5px

**Ombres** : très subtiles (`0 1px 2px rgba(0,0,0,0.04)` pour cards, `0 2px 6px rgba(60,40,20,0.10)` pour covers) — jamais d'ombre dure ou de glassmorphism agressif, ça casserait l'esthétique papier.

## Ce qu'était /add avant

Une page en deux étapes : une barre de recherche pleine page (chercher un album ou un titre), puis un formulaire classique (note en étoiles, date, commentaire, bouton "Enregistrer") qui redirige vers la fiche de l'écoute une fois validé. En dessous, une grille statique de suggestions ("à noter depuis ta liste" ou des albums classiques en repli). Le défaut principal : c'était redondant avec le vrai réflexe des utilisateurs (chercher un album via la recherche globale de l'app, puis le noter directement depuis sa fiche), donc la page n'avait pas de raison d'être utilisée.

## Ce qu'on en a fait (à designer maintenant)

Sur mobile, /add devient une **file de triage** : une pile de cartes à noter une par une, façon "instantanés" Instagram empilées, plutôt qu'un formulaire de recherche statique. L'idée : permettre de rattraper plusieurs écoutes en rafale, vite, sans naviguer entre les pages.

Voici les 4 captures qu'on va faire et ce qu'elles contiennent fonctionnellement — c'est la base de travail, tu as toute liberté sur la mise en forme visuelle tant que ça reste dans le cadre de la charte ci-dessus et de l'identité de l'app.

### 1. Page de base (file de cartes)

- Un titre de page en haut ("Ajouter une écoute", avec le mot "écoute" en italique accent comme c'est déjà fait ailleurs dans l'app)
- Deux boutons/tabs "Chercher un album" / "Chercher un titre" (actuellement de simples onglets soulignés)
- En dessous, **une carte active au centre de l'écran**, avec **2 cartes partiellement visibles empilées derrière** (légèrement décalées vers le bas, mises à l'échelle plus petite, et tournées de quelques degrés — façon pile de cartes/stories) pour suggérer qu'on peut glisser pour passer à la suivante
- La carte active contient :
  - Un petit badge de provenance en haut (texte court genre "Ajouté, jamais noté" / "Depuis ta liste" / "Suggestion pour toi" / "À découvrir" / "Pour démarrer") — actuellement juste un texte uppercase tout petit dans une pill
  - La pochette de l'album (ou de l'album parent pour un titre), le titre, l'artiste, et pour un album l'année de sortie si connue
  - Une notation par étoiles (10 étoiles, tap pour noter, déjà existante ailleurs dans l'app)
  - Un petit indicateur "✓ Enregistré" qui apparaît après la notation
  - Un lien "Ajouter un commentaire…" qui déplie un champ texte
  - Un bouton "Suivant"/"Passer" en bas de carte
- **Données disponibles mais pas forcément toutes affichées actuellement** — libre à toi de les exploiter si ça enrichit le design : date de sortie de l'album, nom de l'artiste, pour un titre le nom ET la pochette de l'album parent, nombre d'écoutes/notes précédentes si l'utilisateur a déjà noté cet item (ré-écoute). Le but est justement de voir si en donnant plus de matière visuelle (date, contexte) on peut rendre la carte plus riche et moins "formulaire".

### 2. Page avec la recherche ouverte

Cliquer sur "Chercher un album" ou "Chercher un titre" ouvre une barre de recherche compacte au-dessus de la pile de cartes (dropdown de résultats avec pochette miniature, titre, sous-titre artiste/date, et un bouton "voir plus de résultats" qui apparaît si la recherche initiale est tronquée). Sélectionner un résultat l'insère comme carte courante immédiate dans la pile (sans navigation).

### 3. Page avec le commentaire ouvert (le "modale")

Ce n'est pas une vraie modale système — c'est une section qui se déplie dans la carte elle-même (sous le bouton "Ajouter un commentaire…") : juste un champ texte multi-lignes avec placeholder ("Ce que tu as ressenti, si tu en as envie."). Actuellement très sobre — c'est probablement l'écran où il y a le plus de marge de progression visuelle (transition d'ouverture, traitement du champ texte, intégration dans la carte sans qu'elle déborde).

### 4. Page à la fin du flux

Quand il n'y a plus rien à noter : état vide centré, message "Tout est à jour ✓", sous-texte, et un lien vers /explore pour découvrir de nouveaux albums. Actuellement très minimal (juste du texte centré) — c'est un bon candidat pour un moment un peu plus marquant/célébratoire vu que l'utilisateur vient de rattraper tout son retard.

## Ce qu'on attend de toi

Un design qui fait passer un vrai cap qualitatif à ces 4 écrans, dans l'esprit "journal intime analogique" de la marque, mais avec une proposition moderne et un peu plus audacieuse que le reste de l'app si ça sert l'expérience (l'idée n'est pas de se contenter de réappliquer les patterns déjà vus sur /explore ou /feed, mais de vraiment explorer ce que cette interaction "pile de cartes" peut offrir visuellement — transitions, profondeur, traitement de la pochette, façon de hiérarchiser note/commentaire/provenance). Tu n'es pas obligé de te limiter aux données qu'on affiche aujourd'hui : si exploiter la date de sortie, l'album parent d'un titre, ou d'autres métadonnées dont on dispose améliore le résultat, vas-y.
