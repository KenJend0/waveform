import { getFollowingList } from "@/app/actions/following";
import { getAuthUser } from "@/lib/supabase/server";
import UserListClient from "@/components/UserListClient";
import BackButton from "@/components/BackButton";

interface FollowingListProps {
  username: string;
}

export default async function FollowingList({
  username,
}: FollowingListProps) {
  const result = await getFollowingList(username);
  const currentUser = await getAuthUser();

  if (!result.success) {
    return (
      <main className="max-w-page mx-auto px-4 py-8 pb-24">
        <BackButton />
        <p className="text-text-tertiary text-[14px] mt-6">
          Impossible de charger les abonnements.
        </p>
      </main>
    );
  }

  const users = result.items || [];

  return (
    <main className="max-w-page mx-auto px-4 py-8 pb-24">
      <BackButton />

      <div className="mt-6 mb-8">
        <h1 className="text-[22px] font-medium text-text-primary tracking-[-0.01em] leading-[1.3]">
          Abonnements
        </h1>
        <p className="text-[14px] text-text-secondary mt-1">
          @{username} · {users.length} {users.length <= 1 ? "abonnement" : "abonnements"}
        </p>
      </div>

      {users.length === 0 ? (
        <div className="bg-background-secondary rounded-[12px] px-4 py-12 text-center">
          <p className="text-text-tertiary text-[14px]">
            Aucun abonnement pour le moment
          </p>
        </div>
      ) : (
        <UserListClient
          initialUsers={users}
          currentUserId={currentUser?.id || null}
        />
      )}
    </main>
  );
}

