"use client";

import { useState } from "react";
import UserCard from "@/components/UserCard";
import { toggleFollow } from "@/app/actions/social";

type User = {
  id: string;
  username: string;
  display_name: string;
  picture_url?: string;
  is_following?: boolean;
  is_me?: boolean;
};

type Props = {
  initialUsers: User[];
  currentUserId?: string | null;
};

export default function UserListClient({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const handleToggleFollow = async (id: string) => {
    setPending((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await toggleFollow(id);
      if (result.success && typeof result.following === "boolean") {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === id
              ? { ...user, is_following: result.following }
              : user
          )
        );
      }
    } finally {
      setPending((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  return (
    <div className="bg-background-secondary rounded-[12px] overflow-hidden">
      {users.map((user) => (
        <div key={user.id} className={pending[user.id] ? "opacity-70" : ""}>
          <UserCard
            user={user}
            currentUserId={currentUserId}
            onFollowToggle={currentUserId ? handleToggleFollow : undefined}
          />
        </div>
      ))}
    </div>
  );
}
