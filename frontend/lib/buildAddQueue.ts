import { type ListAlbumItem, type ListTrackItem, type UnratedItem } from "@/app/actions/lists";
import { type ForYouAlbum, type ForYouTrack, type DiscoveryAlbum } from "@/app/actions/explore";
import { CLASSIC_ALBUMS } from "@/lib/classicAlbums";

export type AddQueueSource = "unrated" | "list" | "foryou" | "discovery" | "classic" | "search";

export type AddQueueItem =
    | { kind: "album"; id: string; title: string; artist: string; coverUrl: string | null; year?: number | null; source: AddQueueSource }
    | { kind: "track"; id: string; title: string; artist: string; coverUrl: string | null; albumId: string; albumTitle: string; artistId: string; source: AddQueueSource };

// Nombre de cartes qu'on garantit à tout utilisateur connecté, même tout
// neuf sans aucun signal — au-delà de ce seuil les classiques ne servent
// qu'à compléter, jamais à remplacer du contenu personnalisé.
const MIN_QUEUE_SIZE = 8;

export const ADD_QUEUE_SOURCE_LABELS: Record<AddQueueSource, string> = {
    unrated: "Ajouté, jamais noté",
    list: "Depuis ta liste",
    foryou: "Suggestion pour toi",
    discovery: "À découvrir",
    classic: "Pour démarrer",
    search: "Ajouté via la recherche",
};

function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

const isItem = (item: AddQueueItem | null): item is AddQueueItem => item !== null;

/**
 * File pour /add : priorise ce qui a déjà été ajouté à une liste mais jamais
 * noté, puis la liste sélectionnée, puis les suggestions personnalisées, et
 * complète avec des classiques jusqu'à MIN_QUEUE_SIZE si le signal réel ne
 * suffit pas (compte tout neuf ou avec trop peu d'historique). Plutôt que de
 * concaténer un palier entier après l'autre
 * (ce qui rend le début de file toujours prévisible — tout l'"ajouté jamais
 * noté" d'abord, puis toute la liste, etc.), les paliers sont interlacés en
 * tourniquet une fois chacun mélangé en interne.
 */
export function buildAddQueue(params: {
    unratedSaved: UnratedItem[];
    listAlbums: ListAlbumItem[];
    listTracks: ListTrackItem[];
    forYouAlbums: ForYouAlbum[];
    forYouTracks: ForYouTrack[];
    discoveryAlbums: DiscoveryAlbum[];
}): AddQueueItem[] {
    const { unratedSaved, listAlbums, listTracks, forYouAlbums, forYouTracks, discoveryAlbums } = params;

    const seenAlbums = new Set<string>();
    const seenTracks = new Set<string>();

    const toAlbumItem = (source: AddQueueSource, id: string, title: string, artist: string, coverUrl: string | null, year?: number | null): AddQueueItem | null => {
        if (!id || seenAlbums.has(id)) return null;
        seenAlbums.add(id);
        return { kind: "album", id, title, artist, coverUrl, year, source };
    };
    const toTrackItem = (source: AddQueueSource, id: string, title: string, artist: string, coverUrl: string | null, albumId: string, albumTitle: string, artistId: string): AddQueueItem | null => {
        if (!id || seenTracks.has(id)) return null;
        seenTracks.add(id);
        return { kind: "track", id, title, artist, coverUrl, albumId, albumTitle, artistId, source };
    };

    // Un palier = priorité de dédup (calculée dans cet ordre) ; à l'intérieur
    // d'un palier, albums et titres sont mélangés ensemble.
    const unratedTier = shuffle(
        unratedSaved.map((item) =>
            item.kind === "album"
                ? toAlbumItem("unrated", item.album_id, item.album_title, item.artist_name, item.cover_url)
                : toTrackItem("unrated", item.track_id, item.track_title, item.artist_name, item.cover_url, item.album_id, item.album_title, item.artist_id)
        ).filter(isItem)
    );

    const listTier = shuffle(
        [
            ...listAlbums.map((item) => toAlbumItem("list", item.album_id, item.album_title, item.artist_name, item.cover_url)),
            ...listTracks.map((item) => toTrackItem("list", item.track_id, item.track_title, item.artist_name, item.cover_url, item.album_id, item.album_title, item.artist_id)),
        ].filter(isItem)
    );

    const forYouTier = shuffle(
        [
            ...forYouAlbums.map((item) => toAlbumItem("foryou", item.album_id, item.title, item.artist, item.cover_url)),
            ...forYouTracks.map((item) => toTrackItem("foryou", item.track_id, item.track_title, item.artist, item.cover_url, item.album_id, "", item.artist_id)),
        ].filter(isItem)
    );

    const discoveryTier = shuffle(
        discoveryAlbums.map((item) => toAlbumItem("discovery", item.album_id, item.title, item.artist, item.cover_url)).filter(isItem)
    );

    const queue: AddQueueItem[] = [];
    const tiers = [unratedTier, listTier, forYouTier, discoveryTier];
    let hasMore = true;
    while (hasMore) {
        hasMore = false;
        for (const tier of tiers) {
            const next = tier.shift();
            if (next) {
                queue.push(next);
                hasMore = true;
            }
        }
    }

    // Complète jusqu'au minimum garanti — pas seulement quand la file est
    // vide : un compte avec un signal faible (1-2 suggestions) ne doit pas
    // se retrouver avec une file clairsemée.
    if (queue.length < MIN_QUEUE_SIZE) {
        for (const album of shuffle(CLASSIC_ALBUMS)) {
            if (queue.length >= MIN_QUEUE_SIZE) break;
            const item = toAlbumItem("classic", album.id, album.title, album.artist, album.coverUrl);
            if (item) queue.push(item);
        }
    }

    return queue;
}
