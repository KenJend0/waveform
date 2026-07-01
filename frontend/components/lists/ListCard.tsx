"use client";

import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";
import { type UserList } from "@/app/actions/lists";
import { useListSave } from "@/lib/useListSave";

export function BookmarkIcon({ filled, size = 10 }: { filled: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
        </svg>
    );
}

type Props = {
    list: UserList;
    href: string;
};

export function CoverCollage({ urls, customCoverUrl }: { urls: (string | null)[], customCoverUrl?: string | null }) {
    if (customCoverUrl) {
        return (
            <div className="aspect-square rounded-[8px] overflow-hidden bg-background-secondary relative">
                <CoverImage
                    src={customCoverUrl}
                    alt=""
                    fill
                    className="object-cover"
                    placeholder={<div className="w-full h-full bg-background-tertiary" />}
                />
            </div>
        );
    }

    const filled = [...urls, null, null, null, null].slice(0, 4);
    const hasCovers = filled.some((u) => u !== null);

    if (!hasCovers) {
        return (
            <div className="aspect-square rounded-[8px] bg-background-secondary flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-text-disabled">
                    <path d="M19 11H5M19 11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2M19 11V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        );
    }

    if (filled.filter((u) => u !== null).length < 4) {
        return (
            <div className="aspect-square rounded-[8px] overflow-hidden bg-background-secondary relative">
                {filled[0] ? (
                    <CoverImage
                        src={filled[0]}
                        alt=""
                        fill
                        className="object-cover"
                        placeholder={<div className="w-full h-full bg-background-tertiary" />}
                    />
                ) : (
                    <div className="w-full h-full bg-background-secondary" />
                )}
            </div>
        );
    }

    return (
        <div className="aspect-square rounded-[8px] overflow-hidden grid grid-cols-2 gap-px bg-border-divider">
            {filled.map((url, i) => (
                <div key={i} className="relative overflow-hidden bg-background-secondary">
                    {url ? (
                        <CoverImage
                            src={url}
                            alt=""
                            fill
                            className="object-cover"
                            placeholder={<div className="w-full h-full bg-background-tertiary" />}
                        />
                    ) : (
                        <div className="w-full h-full bg-background-secondary" />
                    )}
                </div>
            ))}
        </div>
    );
}

export default function ListCard({ list, href }: Props) {
    const { saved, isOwnList, toggleSave } = useListSave(list);

    return (
        <Link href={href} className="group block">
            <div className="relative">
                <CoverCollage urls={list.cover_urls} customCoverUrl={list.custom_cover_url} />
                {list.creator_username && (
                    <span className="absolute top-2 left-2 flex items-center gap-1.5 bg-paper-hi/90 border border-border rounded-full pl-0.5 pr-2 py-0.5 backdrop-blur-sm z-10">
                        <span className="rounded-full overflow-hidden border border-rule flex-shrink-0" style={{ width: 18, height: 18 }}>
                            {list.creator_avatar ? (
                                <img src={list.creator_avatar} alt="" width={18} height={18} className="object-cover w-full h-full" />
                            ) : (
                                <span className="w-full h-full bg-accent/20 block" />
                            )}
                        </span>
                        <span className="text-[10px] font-medium text-text-primary leading-none">@{list.creator_username}</span>
                    </span>
                )}
                {list.is_public && !isOwnList && (
                    <button
                        onClick={toggleSave}
                        aria-label={saved ? "Retirer des sauvegardes" : "Sauvegarder cette liste"}
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-paper-hi/90 border border-border backdrop-blur-sm z-10 transition-colors ${saved ? "text-accent-deep" : "text-text-tertiary hover:text-accent"}`}
                    >
                        <BookmarkIcon filled={saved} size={13} />
                    </button>
                )}
            </div>
            <div className="mt-1.5">
                <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display font-normal text-sm text-text-warm leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                        {list.title}
                    </p>
                    <span className="inline-flex items-baseline gap-1.5 flex-shrink-0 font-display italic text-[15px] text-accent leading-none">
                        {list.item_count}
                        <span className="font-sans not-italic text-[10px] tracking-[0.12em] uppercase text-text-tertiary opacity-80">
                            {list.item_count === 1 ? 'item' : 'items'}
                        </span>
                    </span>
                </div>
                {list.preview_items.length > 0 && (
                    <ul className="mt-2 space-y-1">
                        {list.preview_items.map((item, i) => (
                            <li key={i} className="flex gap-1.5 text-[11.5px] text-text-secondary border-t border-border-divider first:border-t-0 pt-1 first:pt-0">
                                <span className="font-display italic text-accent shrink-0">{i + 1}</span>
                                <span className="truncate">{item}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {!list.is_public && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-label text-text-tertiary">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="5" y="11" width="14" height="9" rx="1.5"/>
                                <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
                            </svg>
                            privée
                        </span>
                    </div>
                )}
            </div>
        </Link>
    );
}
