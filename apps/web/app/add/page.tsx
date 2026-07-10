import { getAuthUser } from "@/lib/supabase/server";
import { getDefaultListAlbums, getDefaultListTracks, getUserLists, getUnratedSavedItems } from "@/app/actions/lists";
import { getForYouSuggestions, getDiscoveryAlbums, getForYouTracks, getTrendingThisWeek } from "@/app/actions/explore";
import { buildAddQueue } from "@/lib/buildAddQueue";
import AddPageClient from "./AddPageClient";
import UnauthTeaser from "@/components/auth/UnauthTeaser";
import { CoverImage } from "@/components/album/CoverImage";

export default async function AddPage() {
    const user = await getAuthUser();
    if (!user) {
        const trending = await getTrendingThisWeek(10);
        const [selected, ...queue] = trending;

        return (
            <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pb-28 lg:pb-12">
                <div className="pt-8 pb-6">
                    <h1 className="text-h1 text-text-primary mb-2">
                        Ajouter une <em className="italic text-accent-deep">écoute</em>
                    </h1>
                    <p className="text-meta text-text-secondary">
                        Cherche, pioche dans ta file, note sans quitter le flux.
                    </p>
                </div>

                <UnauthTeaser ctaTitle={<>Note tes écoutes, écris des reviews — <em className="italic text-accent-deep">garde une trace de tout ce que tu écoutes.</em></>}>
                    {/* Aperçu mobile — reprend l'esthétique carte de AddQueueMobile (pile de fiches),
                        pas le grid desktop qui n'a pas d'équivalent dans le rendu mobile réel. */}
                    <div className="lg:hidden">
                        <div className="flex gap-2 mb-4">
                            <div className="px-3.5 py-1.5 rounded-pill text-[13px] font-medium bg-background-secondary text-text-secondary">
                                Chercher un album
                            </div>
                            <div className="px-3.5 py-1.5 rounded-pill text-[13px] font-medium bg-background-secondary text-text-secondary">
                                Chercher un titre
                            </div>
                        </div>

                        {selected && (
                            <div className="relative w-full max-w-sm mx-auto rounded-card-lg overflow-hidden bg-paper-hi border border-border">
                                <div className="relative aspect-square bg-background-tertiary">
                                    <CoverImage
                                        src={selected.cover_url}
                                        alt=""
                                        fill
                                        className="object-cover"
                                        placeholder={<div className="h-full w-full bg-background-tertiary" />}
                                    />
                                </div>
                                <div className="p-4">
                                    <h2 className="font-display text-h2 text-text-warm leading-tight mb-1">
                                        {selected.album_title}
                                    </h2>
                                    <p className="text-meta text-text-secondary mb-3">{selected.artist_name}</p>
                                    <div className="flex gap-1 text-accent text-[18px] leading-none mb-3">★★★★★★★★☆☆</div>
                                    <div className="w-full h-11 rounded-button bg-text-warm" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="hidden lg:grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <section className="space-y-6">
                            <div className="rounded-input border border-border bg-background px-4 py-3 text-meta text-text-tertiary">
                                Rechercher un album, un titre...
                            </div>

                            {selected && (
                                <div className="rounded-card-lg border border-border bg-paper-hi p-5 shadow-sidebar">
                                    <div className="flex items-start gap-5 border-b border-border pb-5">
                                        <div className="w-36 flex-shrink-0">
                                            <div className="relative aspect-square overflow-hidden rounded-cover bg-background-secondary shadow-cover">
                                                <CoverImage
                                                    src={selected.cover_url}
                                                    alt=""
                                                    fill
                                                    className="object-cover"
                                                    placeholder={<div className="h-full w-full bg-background-tertiary" />}
                                                />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h2 className="font-display text-[30px] leading-tight text-text-warm truncate">
                                                {selected.album_title}
                                            </h2>
                                            <p className="text-meta text-text-secondary">{selected.artist_name}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-5">
                                        <div className="rounded-card border border-border bg-background p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="text-meta text-text-secondary">Note</span>
                                                <span className="font-display italic text-[15px] leading-none text-accent">8 / 10</span>
                                            </div>
                                            <div className="flex gap-1 text-accent text-[20px] leading-none">★★★★★★★★☆☆</div>
                                        </div>
                                        <div className="h-24 rounded-input border border-border bg-background" />
                                        <div className="h-11 w-full rounded-button bg-text-warm" />
                                    </div>
                                </div>
                            )}
                        </section>

                        <aside className="space-y-3">
                            <p className="text-meta text-text-secondary mb-1">File d&apos;attente</p>
                            {queue.slice(0, 5).map((a) => (
                                <div key={a.id} className="flex items-center gap-3 rounded-card border border-border bg-paper-hi p-2">
                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-cover bg-background-secondary">
                                        <CoverImage
                                            src={a.cover_url}
                                            alt=""
                                            fill
                                            className="object-cover"
                                            placeholder={<div className="h-full w-full bg-background-tertiary" />}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <p className="truncate text-meta text-text-primary">{a.album_title}</p>
                                        <p className="truncate text-label text-text-tertiary">{a.artist_name}</p>
                                    </div>
                                </div>
                            ))}
                        </aside>
                    </div>
                </UnauthTeaser>
            </div>
        );
    }

    const [defaultListItems, defaultListTracks, suggestions, discovery, forYouTracks, userLists, unratedSaved] = await Promise.all([
        getDefaultListAlbums(8),
        getDefaultListTracks(8),
        getForYouSuggestions(),
        getDiscoveryAlbums(),
        getForYouTracks(),
        getUserLists(user.id),
        getUnratedSavedItems(),
    ]);

    const initialQueue = buildAddQueue({
        unratedSaved,
        listAlbums: defaultListItems,
        listTracks: defaultListTracks,
        forYouAlbums: suggestions,
        forYouTracks,
        discoveryAlbums: discovery.albums,
    });

    return (
        <AddPageClient
            defaultListItems={defaultListItems}
            defaultListTracks={defaultListTracks}
            initialSuggestions={suggestions}
            initialDiscovery={discovery.albums}
            initialForYouTracks={forYouTracks}
            userLists={userLists}
            initialQueue={initialQueue}
        />
    );
}
