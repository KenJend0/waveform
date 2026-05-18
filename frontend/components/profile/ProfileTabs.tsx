"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import ReviewsList from "./ReviewsList";
import DiaryList from "./DiaryList";
import ListsTab from "./ListsTab";
import type { DiaryEntryUI, UnifiedReview } from "@/app/actions/diary";
import type { TrackDiaryEntryUI } from "@/app/actions/track-diary";
import type { UserList } from "@/app/actions/lists";

const PAGE_SIZE = 50;

type Props = {
  isMe: boolean;
  userId: string;
  diaryEntries: DiaryEntryUI[];
  userLists: UserList[];
  trackEntries?: TrackDiaryEntryUI[];
  unifiedReviews?: UnifiedReview[];
};

type TabId = "diary" | "reviews" | "lists";

function resolveInitialTab(tab: string | null, isMe: boolean): TabId {
  if (tab === "reviews") return "reviews";
  if ((tab === "saved" || tab === "lists") && isMe) return "lists";
  return "diary";
}

export default function ProfileTabs({ isMe, userId, diaryEntries, userLists, trackEntries = [], unifiedReviews = [] }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialTab = resolveInitialTab(searchParams.get("tab"), isMe);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const tabsRef = useRef<HTMLDivElement>(null);

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
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "diary", label: isMe ? "Mon journal" : "Journal" },
    { id: "reviews", label: "Revues" },
    ...(isMe ? [{ id: "lists" as TabId, label: "Listes" }] : []),
  ];


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
          <DiaryList entries={diaryEntries} isMe={isMe} trackEntries={trackEntries} userId={userId} />
        )}
        {activeTab === "reviews" && (
          <ReviewsList reviews={unifiedReviews} />
        )}
        {activeTab === "lists" && <ListsTab lists={userLists} isOwner={isMe} />}
      </div>
    </div>
  );
}
