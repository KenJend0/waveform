"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";

import SearchAlbumModal from "@/components/profile/SearchAlbumModal";
import { useAuth } from "@/lib/AuthContext";
import BackButton from "@/components/BackButton";
import { showToast } from "@/components/Toast";

type Album = {
  id: string;
  title: string;
  artist_name: string;
  cover_url?: string;
  position: number;
  empty?: boolean;
};

export default function EditFavoriteAlbumsPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!authUser) return;

    (async () => {
      try {
        const res = await fetch("/api/me/favorite-albums");
        if (res.ok) {
          const data = await res.json();
          const sorted = data.albums || [];
          while (sorted.length < 3) {
            sorted.push({
              id: `empty-${sorted.length + 1}`,
              title: "",
              artist_name: "",
              position: sorted.length + 1,
              empty: true,
            });
          }
          setAlbums(sorted);
        } else {
          setAlbums(emptySlots());
        }
      } catch {
        setAlbums(emptySlots());
      } finally {
        setLoading(false);
      }
    })();
  }, [authUser]);

  function emptySlots(): Album[] {
    return [1, 2, 3].map((i) => ({
      id: `empty-${i}`, title: "", artist_name: "", position: i, empty: true,
    }));
  }

  const handleSelectAlbum = (album: Album) => {
    if (modalOpen !== null) {
      const newAlbums = [...albums];
      newAlbums[modalOpen - 1] = { ...album, position: modalOpen, empty: false };
      setAlbums(newAlbums);
      setModalOpen(null);
    }
  };

  const handleRemoveAlbum = (position: number) => {
    const newAlbums = [...albums];
    newAlbums[position - 1] = {
      id: `empty-${position}`, title: "", artist_name: "", cover_url: undefined, position, empty: true,
    };
    setAlbums(newAlbums);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const filledAlbums = albums
        .filter((a) => !a.empty && a.title)
        .map((a) => ({ album_id: a.id, position: a.position }));

      const res = await fetch("/api/me/favorite-albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albums: filledAlbums }),
      });

      if (res.ok) {
        router.push("/me");
      }
    } catch (e) {
      console.error("Error saving favorite albums:", e);
      showToast("Impossible d'enregistrer la sélection", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-page mx-auto px-4 py-12 pb-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8E6F5E] mx-auto mb-4" />
          <p className="text-text-tertiary text-meta">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-page mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-12">
        <BackButton />

        <div className="mt-12">
          <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2] mb-2">
            Mon Top 3
          </h1>
          <p className="text-[14px] text-text-secondary">
            Tes trois albums essentiels.
          </p>
        </div>
      </div>

      {/* Album Slots */}
      <div className="grid grid-cols-3 gap-4 mb-12">
        {albums.map((album) => (
          <div key={album.position}>
            {/* Position label */}
            <p className="text-h2 text-text-tertiary mb-3">
              {album.position === 1 ? "Premier" : album.position === 2 ? "Deuxieme" : "Troisieme"}
            </p>

            {album.empty || !album.title ? (
              /* Empty slot */
              <button
                onClick={() => setModalOpen(album.position)}
                className="w-full aspect-square border border-dashed border-border rounded-[10px] hover:border-[#8E6F5E] transition-colors duration-150 flex items-center justify-center cursor-pointer bg-background-secondary"
              >
                <p className="text-[12px] text-text-tertiary">Ajouter</p>
              </button>
            ) : (
              /* Filled slot */
              <div className="relative group">
                <div className="aspect-square rounded-[10px] overflow-hidden bg-background-secondary">
                  {album.cover_url ? (
                    <Image
                      src={album.cover_url}
                      alt={album.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-background-tertiary" />
                  )}
                </div>
                {/* Remove button */}
                <button
                  onClick={() => handleRemoveAlbum(album.position)}
                  className="absolute top-1.5 right-1.5 p-0.5 transition-opacity duration-150 hover:opacity-50 z-10"
                >
                  <X
                    size={11}
                    strokeWidth={2}
                    className="text-[#1C1C1C]"
                    style={{ filter: "drop-shadow(0 0 2px #ECE8E1) drop-shadow(0 0 2px #ECE8E1)" }}
                  />
                </button>
                {/* Replace overlay */}
                <button
                  onClick={() => setModalOpen(album.position)}
                  className="absolute inset-0 rounded-[10px] bg-transparent hover:bg-[#1C1C1C]/10 transition-colors duration-150 cursor-pointer"
                />
              </div>
            )}

            {/* Album info */}
            {album.title && (
              <div className="mt-3">
                <p className="text-[14px] font-medium text-text-primary truncate">{album.title}</p>
                <p className="text-[12px] text-text-secondary truncate mt-0.5">{album.artist_name}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="border-t border-border-divider pt-12">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#1C1C1C] hover:opacity-85 disabled:bg-[#BDBDBD] disabled:cursor-not-allowed text-[#F5F3EF] text-[14px] font-medium rounded-[8px] transition-opacity duration-150"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          onClick={() => router.push("/me")}
          className="w-full py-3 mt-2 text-text-secondary hover:text-[#8E6F5E] text-[14px] font-medium transition-colors duration-150"
        >
          Annuler
        </button>
      </div>

      {/* Search Modal */}
      {modalOpen !== null && (
        <SearchAlbumModal
          position={modalOpen}
          onSelect={handleSelectAlbum}
          onClose={() => setModalOpen(null)}
        />
      )}
    </main>
  );
}

