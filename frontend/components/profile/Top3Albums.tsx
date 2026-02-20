"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Album = {
  id: string;
  title: string;
  artist_name: string;
  cover_url?: string;
  position: number;
};

type Props = {
  userId: string;
  isMe?: boolean;
};

export default function Top3Albums({ userId, isMe }: Props) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return null;

  return (
    <div className="mt-10">
      <h3 className="text-[16px] font-medium mb-5 text-text-primary">{albums.length === 1 ? "Album favori" : "Albums favoris"}</h3>

      {albums.length === 0 ? (
        <p className="text-[14px] text-text-tertiary">Aucun album favori</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="group"
            >
              {/* Cover */}
              <div className="relative overflow-hidden rounded-[10px] bg-background-secondary aspect-square mb-3">
                {album.cover_url ? (
                  <Image
                    src={album.cover_url}
                    alt={album.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-background-tertiary">
                    <span className="text-[24px] text-text-tertiary">â™ª</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

