"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut, Settings, Heart, FileText, Shield } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { showToast } from "@/components/Toast";

type Props = {
  user: {
    id: string;
    username: string;
    display_name: string;
    picture_url: string | null;
    is_me?: boolean;
    is_admin?: boolean;
    is_following?: boolean;
    followers_count?: number;
    following_count?: number;
    bio?: string | null;
  };
  stats?: {
    reviews_count: number;
    albums_count: number;
  };
  onFollowClick?: () => void;
};

export default function ProfileHeader({ user, stats, onFollowClick }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      setMenuOpen(false);
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error("Logout error:", e);
      showToast("Erreur lors de la déconnexion", "error");
    }
  };

  return (
    <div className="bg-background-secondary border-b border-border-divider">
      <div className="max-w-page mx-auto px-4 sm:px-6 py-8 relative">
        {/* Hamburger Menu — top right, hidden on desktop (already in Header) */}
        {user.is_me && (
          <div className="absolute top-4 right-4 z-50 md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-[8px] hover:bg-background-tertiary transition-colors duration-150"
            >
              <Menu size={20} className="text-text-secondary" />
            </button>

            {menuOpen && (
              <div className="absolute top-12 right-0 bg-background border border-border rounded-[12px] overflow-hidden min-w-48 z-50 shadow-sm">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-[14px] text-text-primary"
                >
                  <Settings size={16} />
                  Éditer profil
                </Link>
                <Link
                  href="/settings/favorite-albums"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-[14px] text-text-primary"
                >
                  <Heart size={16} />
                  Albums favoris
                </Link>
                <Link
                  href="/legal"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-[14px] text-text-primary"
                >
                  <FileText size={16} />
                  Légal & infos
                </Link>
                {user.is_admin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-[14px] text-text-primary"
                  >
                    <Shield size={16} />
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-[14px] border-t border-border-divider text-[#C86C6C] text-left"
                >
                  <LogOut size={16} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        )}

        {/* Avatar + Name inline */}
        <div className="flex items-start gap-5">
          <div className="flex-shrink-0 rounded-full border border-border overflow-hidden">
            <div style={{ width: '80px', height: '80px' }}>
              <UserAvatar userId={user.id} src={user.picture_url} size={80} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2]">
              {user.display_name || user.username}
            </h1>
            {user.display_name && (
              <p className="text-[12px] text-text-tertiary mt-0.5">@{user.username}</p>
            )}

            {/* Follow button for other users */}
            {!user.is_me && onFollowClick && (
              <div className="mt-3">
                <button
                  onClick={onFollowClick}
                  className={user.is_following
                    ? "border border-border text-text-secondary text-[14px] font-medium px-4 py-2 rounded-[8px] hover:border-accent hover:text-accent transition-colors duration-150"
                    : "bg-[#1C1C1C] text-white text-[14px] font-medium px-4 py-2 rounded-[8px] hover:bg-[#333] transition-colors duration-150"
                  }
                >
                  {user.is_following ? "Suivi" : "Suivre"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-[14px] text-text-secondary leading-relaxed max-w-lg mt-5">
            {user.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="flex gap-6 text-[12px] text-text-tertiary mt-6">
          {stats && (
            <>
              <span>
                <span className="font-medium text-text-primary">{stats.albums_count}</span> écoute{stats.albums_count !== 1 ? 's' : ''}
              </span>
              <span>
                <span className="font-medium text-text-primary">{stats.reviews_count}</span> revue{stats.reviews_count !== 1 ? 's' : ''}
              </span>
            </>
          )}
          <Link href={`/u/${user.username}/followers`} className="hover:text-text-primary transition-colors duration-150">
            <span className="font-medium text-text-primary">{user.followers_count || 0}</span> abonné{(user.followers_count || 0) !== 1 ? 's' : ''}
          </Link>
          <Link href={`/u/${user.username}/following`} className="hover:text-text-primary transition-colors duration-150">
            <span className="font-medium text-text-primary">{user.following_count || 0}</span> abonnements
          </Link>
        </div>
      </div>
    </div>
  );
}
