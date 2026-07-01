export const dynamic = 'force-dynamic';

import BackButton from "@/components/ui/BackButton";
import { getPublicLists, type UserList } from "@/app/actions/lists";
import ListCard from "@/components/lists/ListCard";

export default async function ListsPage() {
    let lists: UserList[] = [];

    try {
        lists = await getPublicLists(30);
    } catch (err) {
        console.error("Lists fetch failed:", err);
    }

    return (
        <>
            <section className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 max-w-page lg:max-w-5xl mx-auto">
                <BackButton label="Explorer" fallbackHref="/explore" className="mb-4" />
                <h1 className="text-h1 text-text-primary mb-1">
                    Listes <em className="font-display italic text-accent-deep">populaires</em>
                </h1>
                <p className="text-[14px] text-text-secondary">
                    Sélections musicales partagées par la communauté.
                </p>
            </section>

            <main className="px-6 pb-28 lg:pb-10 max-w-page lg:max-w-5xl mx-auto">
                {lists.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                        {lists.map((list) => (
                            <ListCard key={list.id} list={list} href={`/lists/${list.id}`} />
                        ))}
                    </div>
                ) : (
                    <p className="text-text-tertiary text-meta">Rien pour le moment.</p>
                )}
            </main>
        </>
    );
}
