"use client";

import { useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import ReviewsList from "./ReviewsList";
import DiaryList from "./DiaryList";
import type { DiaryEntryUI, UnifiedReview } from "@/app/actions/diary";
import type { TrackDiaryEntryUI } from "@/app/actions/track-diary";
import type { UserList } from "@/app/actions/lists";
import ListsTab from "./ListsTab";

type Tab = "journal" | "critiques" | "listes";

type Props = {
  profileUserId: string;
  username: string;
  diaryEntries: DiaryEntryUI[];
  publicLists: UserList[];
  myListenedAlbums: Record<string, number | null>;
  isLoggedIn: boolean;
  trackEntries?: TrackDiaryEntryUI[];
  unifiedReviews?: UnifiedReview[];
};

export default function PublicProfileTabs({
  profileUserId,
  diaryEntries,
  publicLists,
  trackEntries = [],
  unifiedReviews = [],
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const resolveTab = (raw: string | null): Tab => {
    if (raw === "critiques" || raw === "revues") return "critiques";
    if (raw === "listes" || raw === "ecouter") return "listes";
    return "journal";
  };

  const [tab, setTab] = useState<Tab>(() => resolveTab(searchParams.get("tab")));

  const handleTabChange = (t: Tab) => {
    setTab(t);
    const params = new URLSearchParams(searchParams.toString());
    if (t === "journal") params.delete("tab");
    else params.set("tab", t);
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "journal", label: "Journal" },
    { id: "critiques", label: "Critiques" },
    { id: "listes", label: "Listes" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-0">
      <div className="pb-28">
        {/* Tab bar */}
        <div className="flex gap-5 mb-8 border-b border-border-divider">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`text-meta pb-3 transition-colors duration-150 border-b-2 -mb-px ${
                tab === t.id
                  ? "text-accent-deep border-accent"
                  : "text-text-tertiary hover:text-text-secondary border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Journal ── */}
        {tab === "journal" && (
          <DiaryList
            entries={diaryEntries}
            isMe={false}
            trackEntries={trackEntries}
            userId={profileUserId}
            ratingLabel="Sa note"
          />
        )}

        {/* ── Critiques ── */}
        {tab === "critiques" && (
          <ReviewsList reviews={unifiedReviews} />
        )}

        {/* ── Listes ── */}
        {tab === "listes" && (
          <ListsTab lists={publicLists} isOwner={false} />
        )}
      </div>
    </div>
  );
}
