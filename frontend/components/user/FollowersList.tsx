import { getFollowersList } from "@/app/actions/followers";
import { getAuthUser } from "@/lib/supabase/server";
import UserListClient from "@/components/user/UserListClient";
import BackButton from "@/components/ui/BackButton";

interface FollowersListProps {
  username: string;
}

export default async function FollowersList({
  username,
}: FollowersListProps) {
  const result = await getFollowersList(username);
  const currentUser = await getAuthUser();

  if (!result.success) {
    return (
      <main className="max-w-page mx-auto px-4 pt-4 pb-24">
        <BackButton label="Profil" />
        <p className="text-text-tertiary text-[14px] mt-6">
          Impossible de charger les abonnés.
        </p>
      </main>
    );
  }

  const users = result.items || [];

  return (
    <main className="max-w-page mx-auto px-4 pt-4 pb-24">
      <BackButton label="Profil" />

      <div className="mt-6 mb-8">
        <h1 className="text-[22px] font-medium text-text-primary tracking-[-0.01em] leading-[1.3]">
          @{username}
        </h1>
        <p className="text-[14px] text-text-secondary mt-1">
          {users.length} {users.length <= 1 ? "abonné" : "abonnés"}
        </p>
      </div>

      {users.length === 0 ? (
        <div className="bg-background-secondary rounded-[12px] px-4 py-12 text-center">
          <p className="text-text-tertiary text-[14px]">
            Aucun abonné pour le moment
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

