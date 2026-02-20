"use client";

import { useState, useEffect, useRef } from "react";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { createRecommendation } from "@/app/actions/recommendations";
import { showToast } from "./Toast";

type RecommendationModalProps = {
  albumId: string;
  albumTitle: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function RecommendationModal({
  albumId,
  albumTitle,
  isOpen,
  onClose,
}: RecommendationModalProps) {
  const [recommendationText, setRecommendationText] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchResultUI | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [users, setUsers] = useState<SearchResultUI[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (isPublic) {
      setUsers([]);
      return;
    }

    setLoadingUsers(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchInternal(searchQuery || " ", "users");
        setUsers(results);
      } catch (e) {
        console.error("Error searching users:", e);
      } finally {
        setLoadingUsers(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery, isPublic]);

  const handleSubmit = async () => {
    if (!albumId) return;
    if (!isPublic && !selectedUser) {
      showToast("Sélectionnez un utilisateur ou rendez-la publique", "error");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createRecommendation({
        albumId,
        recommendedToId: isPublic ? null : selectedUser!.id,
        message: recommendationText || null,
      });

      if (result.ok) {
        showToast("Recommandation envoyée!", "success");
        setRecommendationText("");
        setSelectedUser(null);
        setIsPublic(true);
        onClose();
      } else {
        showToast("Erreur lors de l'envoi", "error");
      }
    } catch (e) {
      console.error("Error sending recommendation:", e);
      showToast("Erreur lors de l'envoi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-[12px] max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-h2 font-medium text-text-primary">
            Recommander "{albumTitle}"
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-h2 leading-none transition-colors duration-150"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Public/Private Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setIsPublic(true); setSelectedUser(null); }}
              className={`flex-1 px-3 py-2 rounded-[8px] font-medium transition-colors duration-150 ${
                isPublic
                  ? "bg-[#8E6F5E] text-[#F5F3EF]"
                  : "bg-background-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              Publique
            </button>
            <button
              onClick={() => { setIsPublic(false); setSearchQuery(""); }}
              className={`flex-1 px-3 py-2 rounded-[8px] font-medium transition-colors duration-150 ${
                !isPublic
                  ? "bg-[#8E6F5E] text-[#F5F3EF]"
                  : "bg-background-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              Privée
            </button>
          </div>

          {/* User Selection (if private) */}
          {!isPublic && (
            <div>
              <label className="block text-meta text-text-secondary mb-2">
                Recommander à:
              </label>
              <input
                type="text"
                placeholder="Tapez un nom d'utilisateur..."
                value={selectedUser ? selectedUser.title : searchQuery}
                onChange={(e) => {
                  if (!selectedUser) setSearchQuery(e.target.value);
                }}
                onFocus={() => { if (selectedUser) setSelectedUser(null); }}
                className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-text-primary focus:border-[#8E6F5E] focus:outline-none mb-2"
              />
              <div className="bg-background-secondary rounded max-h-40 overflow-y-auto">
                {loadingUsers && (
                  <div className="p-3 text-text-secondary text-meta text-center">
                    Recherche...
                  </div>
                )}
                {!loadingUsers && users.length === 0 && searchQuery.length === 0 && (
                  <div className="p-3 text-text-secondary text-meta text-center">
                    Commencez à taper pour chercher
                  </div>
                )}
                {!loadingUsers && users.length === 0 && searchQuery.length > 0 && (
                  <div className="p-3 text-text-secondary text-meta text-center">
                    Aucun utilisateur trouvé
                  </div>
                )}
                {!selectedUser && users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => { setSelectedUser(user); setSearchQuery(""); }}
                    className="w-full px-3 py-2 text-left text-meta hover:bg-background-tertiary transition-colors duration-150 text-text-primary"
                  >
                    {user.title} ({user.subtitle})
                  </button>
                ))}
              </div>
              {selectedUser && (
                <div className="mt-2 text-meta text-[#8E6F5E]">
                  Recommandation privée sélectionnée
                </div>
              )}
            </div>
          )}

          {/* Recommendation Text */}
          <div>
            <label className="block text-meta text-text-secondary mb-2">
              Message (optionnel)
            </label>
            <textarea
              value={recommendationText}
              onChange={(e) => setRecommendationText(e.target.value)}
              className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-text-primary focus:border-[#8E6F5E] focus:outline-none"
              placeholder="Pourquoi tu recommandes cet album?"
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] px-4 py-2 font-medium transition-colors duration-150"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-[#1C1C1C] hover:opacity-85 disabled:opacity-50 text-[#F5F3EF] rounded-[8px] px-4 py-2 font-medium transition-opacity duration-150"
            >
              {submitting ? "Envoi..." : "Recommander"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
