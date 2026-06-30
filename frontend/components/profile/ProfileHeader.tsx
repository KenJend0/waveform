"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut, Settings, Heart, LifeBuoy, Shield, Flame } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { showToast } from "@/components/Toast";
import Top3Albums, { FavoriteAlbum } from "@/components/profile/Top3Albums";
import ExpandableText from "@/components/ExpandableText";

type Props = {
  user: {
    id: string;
    username: string;
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
  };
  streak?: {
    days: number;
    isActiveToday: boolean;
  };
  favoriteAlbums?: FavoriteAlbum[];
  onFollowClick?: () => void;
};

export default function ProfileHeader({ user, stats, streak, favoriteAlbums, onFollowClick }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();
  const alignIdentityToAvatar = !!user.is_me;

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
    <div className="bg-background-secondary border-b border-border-divider lg:bg-transparent lg:border-0">
      <div className="max-w-page mx-auto px-4 sm:px-6 py-8 lg:px-0 lg:py-6 relative">
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
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
                >
                  <Settings size={16} />
                  Éditer profil
                </Link>
                <Link
                  href="/settings/favorite-albums"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
                >
                  <Heart size={16} />
                  Albums favoris
                </Link>
                <Link
                  href="/legal"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
                >
                  <LifeBuoy size={16} />
                  Aide & support
                </Link>
                {user.is_admin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
                  >
                    <Shield size={16} />
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta border-t border-border-divider text-[#C86C6C] text-left"
                >
                  <LogOut size={16} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        )}

        {/* Avatar + Name inline */}
        <div className={`flex gap-5 ${alignIdentityToAvatar ? 'items-center' : 'items-start'}`}>
          <div className="flex-shrink-0 rounded-full border border-border overflow-hidden">
            <div className="w-[80px] h-[80px] lg:w-[96px] lg:h-[96px]">
              <UserAvatar userId={user.id} src={user.picture_url} size={96} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] lg:text-[22px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2]">
              {user.username}
            </h1>

            {user.is_me && streak && streak.days >= 2 && (
              <span className="mt-1.5 inline-flex items-center gap-1 bg-paper-hi border border-border rounded-badge px-2 py-0.5 text-label text-accent-deep">
                <Flame size={12} />
                {streak.days} jours d&apos;affilés
              </span>
            )}

            {/* Follow button for other users */}
            {!user.is_me && onFollowClick && (
              <div className="mt-3">
                <button
                  onClick={onFollowClick}
                  className={user.is_following
                    ? "border border-border text-text-secondary text-meta font-medium px-4 py-2 rounded-[8px] hover:border-accent hover:text-accent transition-colors duration-150"
                    : "bg-[#1C1C1C] text-white text-meta font-medium px-4 py-2 rounded-[8px] hover:bg-[#333] transition-colors duration-150"
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
          <div className="max-w-lg mt-5">
            <ExpandableText
              text={user.bio}
              className="text-meta text-text-secondary leading-relaxed whitespace-pre-line"
              clampLines={4}
            />
          </div>
        )}

        {/* Albums favoris */}
        <Top3Albums
          userId={user.id}
          initialAlbums={favoriteAlbums}
          hideIfEmpty={!user.is_me}
        />

        {/* Stats row */}
        <div className="flex w-full mt-5 pt-4 border-t border-rule">
          {stats && (
            <div className="flex-1 flex flex-col border-r border-rule pr-4">
              <span className="font-display italic text-[28px] text-text-warm leading-none">{stats.reviews_count}</span>
              <span className="text-label uppercase tracking-[0.14em] text-text-tertiary mt-1.5">critique{stats.reviews_count !== 1 ? 's' : ''}</span>
            </div>
          )}
          <Link href={`/u/${user.username}/followers`} className={`flex-1 flex flex-col hover:opacity-75 transition-opacity duration-150 border-r border-rule ${stats ? 'px-4' : 'pr-4'}`}>
            <span className="font-display italic text-[28px] text-text-warm leading-none">{user.followers_count || 0}</span>
            <span className="text-label uppercase tracking-[0.14em] text-text-tertiary mt-1.5">abonné{(user.followers_count || 0) !== 1 ? 's' : ''}</span>
          </Link>
          <Link href={`/u/${user.username}/following`} className="flex-1 flex flex-col hover:opacity-75 transition-opacity duration-150 pl-4">
            <span className="font-display italic text-[28px] text-text-warm leading-none">{user.following_count || 0}</span>
            <span className="text-label uppercase tracking-[0.14em] text-text-tertiary mt-1.5">suivis</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
