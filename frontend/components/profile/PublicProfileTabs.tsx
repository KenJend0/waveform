"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import Top3Albums from "./Top3Albums";
import type { DiaryEntryUI } from "@/app/actions/diary";
import { toggleDiaryLike } from "@/app/actions/diary";
import type { SavedAlbumUI } from "@/app/actions/saved-albums";

type Tab = "journal" | "revues" | "ecouter";
type ListenFilter = "all" | "listened" | "undiscovered";
type SavedFilter = "all" | "in_list" | "not_in_list";
type EcoutesSort = "date_listened" | "release_date" | "their_rating" | "my_rating";
type EnviesSort = "saved_date" | "release_date";

type Props = {
  profileUserId: string;
  username: string;
  diaryEntries: DiaryEntryUI[];
  savedAlbums: SavedAlbumUI[];
  myListenedAlbums: Record<string, number | null>;
  mySavedAlbumIds: string[];
  isLoggedIn: boolean;
};

// ─── Ghost filter toggle (charte : minimal, éditorial) ───────────────────────
function FilterToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 text-[12px]">
      {options.map((opt, i) => (
        <span key={opt.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-text-disabled select-none">·</span>}
          <button
            onClick={() => onChange(opt.id)}
            className={`transition-colors duration-150 ${
              value === opt.id
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {opt.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Sort dropdown ───────────────────────────────────────────────────────────
function SortDropdown<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
      >
        Tri :{" "}
        <span className="font-medium text-text-primary">{current?.label}</span>
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max shadow-sm"
          onMouseLeave={() => setOpen(false)}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                value === opt.id
                  ? "bg-background-secondary text-text-primary font-medium"
                  : "text-text-tertiary hover:bg-background-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function PublicProfileTabs({
  profileUserId,
  diaryEntries,
  savedAlbums,
  myListenedAlbums,
  mySavedAlbumIds,
  isLoggedIn,
}: Props) {
  const [tab, setTab] = useState<Tab>("journal");
  const [listenFilter, setListenFilter] = useState<ListenFilter>("all");
  const [savedFilter, setSavedFilter] = useState<SavedFilter>("all");
  const [ecoutesSort, setEcoutesSort] = useState<EcoutesSort>("date_listened");
  const [enviesSort, setEnviesSort] = useState<EnviesSort>("saved_date");
  const [likeState, setLikeState] = useState<Record<string, { liked: boolean; count: number }>>(() =>
    Object.fromEntries(diaryEntries.map((e) => [e.id, { liked: e.is_liked, count: e.likes_count }]))
  );

  const handleLike = async (entryId: string) => {
    if (!isLoggedIn) return;
    setLikeState((prev) => {
      const cur = prev[entryId];
      return { ...prev, [entryId]: { liked: !cur.liked, count: cur.liked ? cur.count - 1 : cur.count + 1 } };
    });
    await toggleDiaryLike(entryId);
  };

  const mySavedSet = new Set(mySavedAlbumIds);

  // Deduplicate diary by album (keep latest)
  const uniqueDiary = Array.from(
    new Map(diaryEntries.map((e) => [e.album_id, e])).values()
  );
  const reviews = Array.from(
    new Map(
      diaryEntries.filter((e) => e.review_body).map((e) => [e.album_id, e])
    ).values()
  );

  const TABS = [
    { id: "journal" as Tab, label: "Journal", count: uniqueDiary.length },
    { id: "revues" as Tab, label: "Revues", count: reviews.length },
    { id: "ecouter" as Tab, label: "À écouter", count: savedAlbums.length },
  ];

  const LISTEN_FILTER_OPTIONS: { id: ListenFilter; label: string }[] = [
    { id: "all", label: "Tout" },
    ...(isLoggedIn
      ? [
          { id: "listened" as ListenFilter, label: "Déjà écouté" },
          { id: "undiscovered" as ListenFilter, label: "Pas écouté" },
        ]
      : []),
  ];

  const SAVED_FILTER_OPTIONS: { id: SavedFilter; label: string }[] = [
    { id: "all", label: "Tout" },
    ...(isLoggedIn
      ? [
          { id: "in_list" as SavedFilter, label: "Dans ma liste" },
          { id: "not_in_list" as SavedFilter, label: "Pas encore" },
        ]
      : []),
  ];

  const ECOUTES_SORT_OPTIONS: { id: EcoutesSort; label: string }[] = [
    { id: "date_listened", label: "Date d'écoute" },
    { id: "release_date", label: "Parution" },
    { id: "their_rating", label: "Sa note" },
    ...(isLoggedIn ? [{ id: "my_rating" as EcoutesSort, label: "Ma note" }] : []),
  ];

  const ENVIES_SORT_OPTIONS: { id: EnviesSort; label: string }[] = [
    { id: "saved_date", label: "Date d'ajout" },
    { id: "release_date", label: "Parution" },
  ];

  // ── Filters ──
  const applyListenFilter = (entries: DiaryEntryUI[]) => {
    if (listenFilter === "listened") return entries.filter((e) => e.album_id in myListenedAlbums);
    if (listenFilter === "undiscovered") return entries.filter((e) => !(e.album_id in myListenedAlbums));
    return entries;
  };

  const applyEnviesFilter = (albums: SavedAlbumUI[]) => {
    if (savedFilter === "in_list") return albums.filter((a) => mySavedSet.has(a.album_id));
    if (savedFilter === "not_in_list") return albums.filter((a) => !mySavedSet.has(a.album_id));
    return albums;
  };

  // ── Sorts ──
  const sortDiary = (entries: DiaryEntryUI[]) =>
    [...entries].sort((a, b) => {
      switch (ecoutesSort) {
        case "release_date":
          return (new Date(b.release_date || 0).getTime()) - (new Date(a.release_date || 0).getTime());
        case "their_rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "my_rating":
          return (myListenedAlbums[b.album_id] ?? -1) - (myListenedAlbums[a.album_id] ?? -1);
        default:
          return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
      }
    });

  const sortSaved = (albums: SavedAlbumUI[]) =>
    [...albums].sort((a, b) =>
      enviesSort === "release_date"
        ? (new Date(b.release_date || 0).getTime()) - (new Date(a.release_date || 0).getTime())
        : new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
    );

  const filteredDiary = sortDiary(applyListenFilter(uniqueDiary));
  const filteredReviews = sortDiary(applyListenFilter(reviews));
  const filteredSaved = sortSaved(applyEnviesFilter(savedAlbums));

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6">
      {/* Albums favoris */}
      <Top3Albums userId={profileUserId} />
      <div className="py-6" />

      <div className="pb-28">
        {/* Tab bar */}
        <div className="flex gap-5 mb-8 border-b border-border-divider">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-[14px] pb-3 transition-colors duration-150 border-b-2 -mb-px flex items-baseline gap-1.5 ${
                tab === t.id
                  ? "text-text-primary border-[#1C1C1C]"
                  : "text-text-tertiary hover:text-text-secondary border-transparent"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="text-[11px] text-text-disabled">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Journal ── */}
        {tab === "journal" && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              {isLoggedIn && (
                <FilterToggle
                  value={listenFilter}
                  onChange={setListenFilter}
                  options={LISTEN_FILTER_OPTIONS}
                />
              )}
              <div className={isLoggedIn ? "" : "ml-auto"}>
                <SortDropdown
                  value={ecoutesSort}
                  onChange={setEcoutesSort}
                  options={ECOUTES_SORT_OPTIONS}
                />
              </div>
            </div>

            {filteredDiary.length === 0 ? (
              <p className="text-center text-text-tertiary py-12 text-[14px]">
                {listenFilter === "listened"
                  ? "Aucun album en commun avec cet utilisateur"
                  : listenFilter === "undiscovered"
                  ? "Vous avez tout découvert — beau palmarès !"
                  : "Aucune écoute pour l'instant"}
              </p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-6">
                {filteredDiary.map((entry) => {
                  const myRating = myListenedAlbums[entry.album_id];
                  return (
                    <div key={entry.id}>
                      <Link
                        href={`/diary/${entry.id}`}
                        className="group relative block aspect-square rounded-[10px] overflow-hidden"
                      >
                        {entry.cover_url ? (
                          <Image
                            src={entry.cover_url}
                            alt={entry.album_title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-background-tertiary" />
                        )}
                      </Link>
                      <div className="mt-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-text-primary truncate">
                              {entry.album_title}
                            </p>
                            <p className="text-[10px] text-text-tertiary truncate">
                              {entry.artist_name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 ml-1.5 flex-shrink-0">
                            {entry.rating != null && (
                              <span className="text-[10px] font-medium text-[#8E6F5E]">
                                {entry.rating}/10
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Revues ── */}
        {tab === "revues" && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              {isLoggedIn && (
                <FilterToggle
                  value={listenFilter}
                  onChange={setListenFilter}
                  options={LISTEN_FILTER_OPTIONS}
                />
              )}
              <div className={isLoggedIn ? "" : "ml-auto"}>
                <SortDropdown
                  value={ecoutesSort}
                  onChange={setEcoutesSort}
                  options={ECOUTES_SORT_OPTIONS}
                />
              </div>
            </div>

            {filteredReviews.length === 0 ? (
              <p className="text-center text-text-tertiary py-12 text-[14px]">
                {listenFilter === "listened"
                  ? "Aucune revue sur des albums que vous avez aussi écoutés"
                  : listenFilter === "undiscovered"
                  ? "Toutes les revues portent sur des albums que vous connaissez"
                  : "Aucune revue pour l'instant"}
              </p>
            ) : (
              <div className="space-y-6">
                {filteredReviews.map((review) => {
                  const myRating = myListenedAlbums[review.album_id];
                  return (
                    <article
                      key={review.id}
                      className="p-4 border border-border hover:border-[#8E6F5E] transition-colors duration-150 flex gap-4 bg-background-secondary rounded-[12px]"
                    >
                      {review.cover_url && (
                        <Link href={`/albums/${review.album_id}`} className="flex-shrink-0">
                          <Image
                            src={review.cover_url}
                            alt={review.album_title}
                            width={80}
                            height={80}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-[10px] object-cover"
                          />
                        </Link>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="mb-3">
                          <Link href={`/albums/${review.album_id}`} className="hover:text-[#8E6F5E] transition-colors duration-150 block">
                            <h3 className="font-medium text-[14px] text-text-primary truncate">{review.album_title}</h3>
                          </Link>
                          <Link href={`/artists/${review.artist_id}`} className="text-text-tertiary text-[12px] hover:text-[#8E6F5E] transition-colors duration-150">
                            {review.artist_name}
                          </Link>
                        </div>
                        {review.review_body && (
                          <p className="text-[14px] leading-[1.6] text-text-secondary line-clamp-3 mb-3">
                            {review.review_body}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t border-border-divider">
                          <div className="flex flex-col gap-0.5">
                            {review.rating != null && (
                              <span className="text-[#8E6F5E] font-medium text-[12px]">
                                {Math.round(review.rating)}/10
                              </span>
                            )}
                            {myRating != null && (
                              <span className="text-[11px] text-text-disabled">
                                Ma note : {Math.round(myRating)}/10
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-text-tertiary ml-auto">
                            <button
                              onClick={() => handleLike(review.id)}
                              disabled={!isLoggedIn}
                              className="flex items-center gap-1 hover:text-[#C86C6C] transition-colors duration-150 disabled:cursor-default"
                            >
                              <Heart size={14} className={likeState[review.id]?.liked ? "fill-[#C86C6C] text-[#C86C6C]" : ""} />
                              <span>{likeState[review.id]?.count ?? 0}</span>
                            </button>
                            <Link
                              href={`/diary/${review.id}`}
                              className="flex items-center gap-1 hover:text-text-secondary transition-colors duration-150"
                            >
                              <MessageCircle size={14} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── À écouter ── */}
        {tab === "ecouter" && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              {isLoggedIn && (
                <FilterToggle
                  value={savedFilter}
                  onChange={setSavedFilter}
                  options={SAVED_FILTER_OPTIONS}
                />
              )}
              <div className={isLoggedIn ? "" : "ml-auto"}>
                <SortDropdown
                  value={enviesSort}
                  onChange={setEnviesSort}
                  options={ENVIES_SORT_OPTIONS}
                />
              </div>
            </div>

            {filteredSaved.length === 0 ? (
              <p className="text-center text-text-tertiary py-12 text-[14px]">
                {savedFilter === "in_list"
                  ? "Aucun album en commun dans vos listes"
                  : savedFilter === "not_in_list"
                  ? "Tous ses albums sont déjà dans votre liste !"
                  : "Aucun album sauvegardé"}
              </p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-6">
                {filteredSaved.map((album) => (
                  <div key={album.id}>
                    <Link
                      href={`/albums/${album.album_id}`}
                      className="group relative block aspect-square rounded-[10px] overflow-hidden"
                    >
                      {album.cover_url ? (
                        <Image
                          src={album.cover_url}
                          alt={album.album_title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-background-tertiary" />
                      )}
                    </Link>
                    <div className="mt-2">
                      <p className="text-[12px] font-medium text-text-primary truncate">
                        {album.album_title}
                      </p>
                      <p className="text-[10px] text-text-tertiary truncate">{album.artist_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
