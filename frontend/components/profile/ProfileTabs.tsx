"use client";

import { useState } from "react";
import ReviewsList from "./ReviewsList";
import DiaryList from "./DiaryList";
import SavedTracks from "./SavedTracks";
import type { DiaryEntryUI } from "@/app/actions/diary";
import type { SavedAlbumUI } from "@/app/actions/saved-albums";

type Props = {
  isMe: boolean;
  diaryEntries: DiaryEntryUI[];
  savedAlbums: SavedAlbumUI[];
};

export default function ProfileTabs({ isMe, diaryEntries, savedAlbums }: Props) {
  const [activeTab, setActiveTab] = useState<"diary" | "reviews" | "saved">("diary");

  type TabId = "diary" | "reviews" | "saved";

  const tabs: { id: TabId; label: string }[] = [
    { id: "diary", label: isMe ? "Mon journal" : "Journal" },
    { id: "reviews", label: "Revues" },
    ...(isMe ? [{ id: "saved" as TabId, label: "À écouter" }] : []),
  ];

  // Filter reviews (entries with review_body)
  const reviews = diaryEntries.filter(e => e.review_body);

  return (
    <div className="max-w-page mx-auto px-4 sm:px-6 pb-28">
      {/* Tabs Navigation */}
      <div className="flex gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        {activeTab === "diary" && <DiaryList entries={diaryEntries} isMe={isMe} />}
        {activeTab === "reviews" && <ReviewsList reviews={reviews} />}
        {activeTab === "saved" && <SavedTracks albums={savedAlbums} />}
      </div>
    </div>
  );
}

