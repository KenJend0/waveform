import { getAuthUser } from "@/lib/supabase/server";
import { getUserSavedAlbums } from "@/app/actions/saved-albums";
import { getForYouSuggestions, getDiscoveryAlbums } from "@/app/actions/explore";
import AddPageClient from "./AddPageClient";

export default async function AddPage() {
    const user = await getAuthUser();
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                <p className="text-[16px] text-text-primary font-medium mb-2">Note tes écoutes.</p>
                <p className="text-[14px] text-text-tertiary mb-8 leading-relaxed max-w-xs">
                    Crée un compte pour noter tes albums, écrire des reviews et retrouver ton historique d&apos;écoutes.
                </p>
                <div className="flex flex-col items-center gap-3">
                    <a href="/auth?mode=signup" className="px-6 py-3 bg-[#1C1C1C] text-[#F5F3EF] text-[14px] font-medium rounded-[10px] hover:opacity-85 transition-opacity">
                        Créer un compte
                    </a>
                    <a href="/auth?mode=login" className="text-[14px] text-text-secondary hover:text-text-primary transition-colors">
                        Se connecter →
                    </a>
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
