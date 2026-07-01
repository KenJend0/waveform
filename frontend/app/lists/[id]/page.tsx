import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { getListWithItems } from "@/app/actions/lists";
import BackButton from "@/components/ui/BackButton";
import ListPageContent from "./ListPageContent";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
    const { id } = await params;
    const result = await getListWithItems(id);
    if (!result) return { title: "Liste" };
    return {
        title: `${result.list.title} — ${result.list.creator_username}`,
        description: result.list.description ?? undefined,
    };
}

export default async function ListPage({ params }: PageProps) {
    const { id } = await params;
    const [result, user] = await Promise.all([
        getListWithItems(id),
        getAuthUser(),
    ]);

    if (!result) notFound();

    const { list, items } = result;
    const isOwner = !!user && user.id === list.user_id;

    return (
        <main className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-28 lg:pb-10 max-w-page lg:max-w-5xl mx-auto">
            <BackButton className="mb-4" />

            <ListPageContent list={list} items={items} isOwner={isOwner} />
        </main>
    );
}
