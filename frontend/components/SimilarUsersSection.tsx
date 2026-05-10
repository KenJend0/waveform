import Link from "next/link";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { type SimilarUser } from "@/app/actions/explore";

export default function SimilarUsersSection({ users }: { users: SimilarUser[] }) {
    if (users.length === 0) return null;

    return (
        <section>
            <h2 className="text-h2 text-text-primary mb-5">Goûts similaires</h2>
            <div className="grid grid-cols-4 gap-3">
                {users.map((user) => (
                    <Link
                        key={user.user_id}
                        href={`/u/${user.username}`}
                        className="flex flex-col items-center gap-2 hover:opacity-75 transition-opacity duration-150"
                    >
                        <div className="rounded-full overflow-hidden border border-border flex-shrink-0" style={{ width: 52, height: 52 }}>
                            <UserAvatar userId={user.user_id} src={user.avatar_url} size={52} />
                        </div>
                        <p className="text-[12px] text-text-primary font-medium truncate w-full text-center">
                            @{user.username}
                        </p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
