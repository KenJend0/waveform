import Link from "next/link";
import { type PublicListPreview } from "@/app/actions/lists";

type Props = {
    lists: PublicListPreview[];
    totalCount?: number;
};

export default function AppearsInLists({ lists, totalCount }: Props) {
    if (lists.length === 0) return null;

    const count = totalCount ?? lists.length;

    return (
        <section>
            <p className="text-[13px] text-text-tertiary mb-2">
                Dans {count} liste{count > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
                {lists.map((list) => (
                    <Link
                        key={list.id}
                        href={`/lists/${list.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background-secondary hover:bg-background-tertiary rounded-full text-[12px] text-text-secondary hover:text-text-primary transition-colors"
                    >
                        {list.title}
                        <span className="text-text-disabled">· @{list.creator_username}</span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
