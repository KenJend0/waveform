import { getAuthUser } from "@/lib/supabase/server";
import { getUserSavedAlbums } from "@/app/actions/saved-albums";
import { getForYouSuggestions, getDiscoveryAlbums } from "@/app/actions/explore";
import AddPageClient from "./AddPageClient";

export default async function AddPage() {
    const user = await getAuthUser();
    if (!user) {
        return (
            <div className="mx-auto max-w-page lg:max-w-5xl px-4 md:px-6 pb-28 lg:pb-12">
                <div className="pt-8 pb-6">
                    <h1 className="text-h1 text-text-primary mb-2">Ajouter</h1>
                    <p className="text-[14px] text-text-tertiary">Note une écoute, donne une note, écris une review.</p>
                </div>
                <div className="flex flex-col items-start gap-3 px-4 py-4 bg-background-secondary border border-border rounded-[12px]">
                    <p className="text-[14px] text-text-secondary leading-snug">
                        Crée un compte pour noter tes écoutes.
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                        <a href="/auth?mode=signup" className="text-[13px] font-medium px-3 py-1.5 bg-[#1C1C1C] text-[#F5F3EF] rounded-[8px] hover:opacity-85 transition-opacity">
                            Créer un compte
                        </a>
                        <a href="/auth?mode=login" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors underline">
                            Se connecter
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const [savedAlbums, suggestions, discovery] = await Promise.all([
        getUserSavedAlbums(user.id, 8),
        getForYouSuggestions(),
        getDiscoveryAlbums(),
    ]);

    return (
        <AddPageClient
            initialSavedAlbums={savedAlbums}
            initialSuggestions={suggestions}
            initialDiscovery={discovery}
        />
    );
}
