"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";
import { showToast } from "@/components/ui/Toast";

export type FavoriteAlbum = {
  id: string;
  title: string;
  artist_name: string;
  cover_url?: string | null;
  position: number;
};

type Props = {
  userId: string;
  initialAlbums?: FavoriteAlbum[];
  hideIfEmpty?: boolean;
};

export default function Top3Albums({ userId, initialAlbums, hideIfEmpty }: Props) {
  const [albums, setAlbums] = useState<FavoriteAlbum[]>(initialAlbums ?? []);
  const [loading, setLoading] = useState(!initialAlbums);

  useEffect(() => {
    if (initialAlbums) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/${userId}/favorite-albums`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setAlbums(data.albums || []);
        }
      } catch (e) {
        console.error("Error loading favorite albums:", e);
        showToast("Impossible de charger les albums favoris", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return null;
  if (hideIfEmpty && albums.length === 0) return null;

  return (
    <div className="mt-6">
      {albums.length === 0 ? (
        <p className="text-sm text-text-tertiary">Aucun album favori</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="group relative aspect-square block rounded-[8px] overflow-hidden hover:opacity-85 transition-opacity duration-150"
            >
              {album.cover_url ? (
                <CoverImage
                  src={album.cover_url}
                  alt={album.title}
                  fill
                  className="object-cover"
                  placeholder={
                    <div className="w-full h-full flex items-center justify-center bg-background-tertiary">
                      <span className="text-[24px] text-text-tertiary">♪</span>
                    </div>
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-background-tertiary">
                  <span className="text-[24px] text-text-tertiary">♪</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

