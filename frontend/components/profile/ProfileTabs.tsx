"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import ReviewsList from "./ReviewsList";
import DiaryList from "./DiaryList";
import SavedTracks from "./SavedTracks";
import type { DiaryEntryUI } from "@/app/actions/diary";
import { getUserDiary } from "@/app/actions/diary";
import type { SavedAlbumUI } from "@/app/actions/saved-albums";

const PAGE_SIZE = 50;

type Props = {
  isMe: boolean;
  userId: string;
  diaryEntries: DiaryEntryUI[];
  savedAlbums: SavedAlbumUI[];
};

type TabId = "diary" | "reviews" | "saved";

function resolveInitialTab(tab: string | null, isMe: boolean): TabId {
  if (tab === "reviews") return "reviews";
  if (tab === "saved" && isMe) return "saved";
  return "diary";
}

export default function ProfileTabs({ isMe, userId, diaryEntries, savedAlbums }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialTab = resolveInitialTab(searchParams.get("tab"), isMe);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [allEntries, setAllEntries] = useState<DiaryEntryUI[]>(diaryEntries);
  const [hasMore, setHasMore] = useState(diaryEntries.length === PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (initialTab !== "diary") {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "diary") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const more = await getUserDiary(userId, allEntries.length, PAGE_SIZE);
    setAllEntries((prev) => [...prev, ...more]);
    setHasMore(more.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "diary", label: isMe ? "Mon journal" : "Journal" },
    { id: "reviews", label: "Revues" },
    ...(isMe ? [{ id: "saved" as TabId, label: "À écouter" }] : []),
  ];

  const reviews = allEntries.filter(e => e.review_body);

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6 pb-28 lg:max-w-none lg:px-0 lg:pb-12">
      {/* Tabs Navigation */}
      <div ref={tabsRef} className="flex gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`text-[14px] pb-3 transition-colors duration-150 border-b-2 ${
              activeTab === tab.id
                ? "text-text-primary border-[#1C1C1C]"
                : "text-text-tertiary hover:text-text-secondary border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "diary" && (
          <>
            <DiaryList entries={allEntries} isMe={isMe} />
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                >
                  {loadingMore ? "Chargement…" : "Charger plus"}
                </button>
              </div>
            )}
          </>
        )}
        {activeTab === "reviews" && (
          <>
            <ReviewsList reviews={reviews} />
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                >
                  {loadingMore ? "Chargement…" : "Charger plus"}
                </button>
              </div>
            )}
          </>
        )}
        {activeTab === "saved" && <SavedTracks albums={savedAlbums} />}
      </div>
    </div>
  );
}
