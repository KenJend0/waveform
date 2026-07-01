"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { type CuratorPick } from "@/app/actions/curator";

function ExpandableNote({
    note,
    textClassName,
    clampLines,
}: {
    note: string;
    textClassName: string;
    clampLines: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const ref = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Avec -webkit-line-clamp, scrollHeight reflète la hauteur réelle du texte
        // non tronqué, clientHeight la hauteur visible après troncature.
        setCanExpand(el.scrollHeight > el.clientHeight + 1);
    }, [note]);

    return (
        <>
            <p
                ref={ref}
                className={`font-display italic text-accent-deep ${textClassName}`}
                style={!expanded ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: clampLines, overflow: "hidden" } : undefined}
            >
                « {note.trim()} »
            </p>
            {canExpand && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="font-display italic text-[12.5px] text-accent border-b border-accent pb-px mt-1 hover:text-accent-deep hover:border-accent-deep transition-colors"
                >
                    {expanded ? "voir moins" : "voir plus"}
                </button>
            )}
        </>
    );
}

function Cover({ pick, showStamp }: { pick: CuratorPick; showStamp: boolean }) {
    return (
        <div className="aspect-square rounded-cover overflow-hidden bg-background-secondary relative shadow-[0_6px_18px_-8px_rgba(40,28,16,0.5)]">
            {pick.cover_url ? (
                <CoverImage
                    src={pick.cover_url}
                    alt={pick.album_title}
                    fill
                    className="object-cover"
                    placeholder={<div className="w-full h-full bg-background-tertiary" />}
                />
            ) : (
                <div className="w-full h-full bg-background-tertiary" />
            )}
            {showStamp && pick.avg_rating !== null && (
                <span className="badge-stamp-cover" style={{ top: "auto", bottom: 8, right: 8 }}>
                    {pick.avg_rating.toFixed(1)}
                    <span className="badge-stamp-denom">/10</span>
                </span>
            )}
        </div>
    );
}

export default function CuratorPickSection({
    pick,
    variant = "feature",
}: {
    pick: CuratorPick;
    variant?: "feature" | "compact";
}) {
    if (variant === "compact") {
        return (
            <section>
                <div className="mb-4">
                    <h2 className="text-h2 text-text-primary whitespace-nowrap">
                        La <em className="italic text-accent-deep">sélection</em> par @{pick.curator_username}
                    </h2>
                </div>

                <div className="bg-paper-hi border border-accent rounded-card-lg p-4 shadow-cover">
                    <Link href={`/albums/${pick.album_id}`} className="block mb-3">
                        <Cover pick={pick} showStamp={true} />
                    </Link>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="rounded-full overflow-hidden border border-rule shrink-0" style={{ width: 24, height: 24 }}>
                            <UserAvatar userId={pick.curator_id} src={pick.curator_avatar} size={24} />
                        </div>
                        <p className="text-[12px] text-text-secondary truncate">
                            <span className="text-accent-deep font-medium">@{pick.curator_username}</span> recommande
                        </p>
                    </div>
                    <Link href={`/albums/${pick.album_id}`} className="group">
                        <p className="font-display text-[22px] text-text-warm leading-tight group-hover:text-accent transition-colors duration-150">
                            {pick.album_title}
                        </p>
                    </Link>
                    <p className="text-[12.5px] text-text-secondary mt-1 mb-3">
                        {pick.artist_name}{pick.release_year && ` — ${pick.release_year}`}
                    </p>
                    <ExpandableNote note={pick.note} textClassName="text-[14px] leading-relaxed" clampLines={4} />
                </div>
            </section>
        );
    }

    return (
        <section>
            <div className="mb-5">
                <h2 className="text-h2 text-text-primary">
                    La <em className="italic text-accent-deep">sélection</em> de {pick.curator_username}
                </h2>
            </div>

            <div className="bg-paper-hi border border-accent rounded-card-lg p-4 lg:hidden">
                <div className="flex items-center gap-1.5 mb-3">
                    <div className="rounded-full overflow-hidden border border-rule shrink-0" style={{ width: 24, height: 24 }}>
                        <UserAvatar userId={pick.curator_id} src={pick.curator_avatar} size={24} />
                    </div>
                    <p className="text-[11.5px] text-text-primary">
                        Sélectionné par <span className="text-accent-deep font-medium">{pick.curator_username}</span> · créateur
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href={`/albums/${pick.album_id}`} className="shrink-0 w-[92px]">
                        <Cover pick={pick} showStamp={false} />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <Link href={`/albums/${pick.album_id}`}>
                            <p className="font-display text-[19px] text-text-warm leading-[1.12]">
                                {pick.album_title}
                            </p>
                        </Link>
                        <p className="text-[11.5px] text-text-secondary mt-0.5 mb-1.5">
                            {pick.artist_name}{pick.release_year && ` — ${pick.release_year}`}
                        </p>
                        <ExpandableNote note={pick.note} textClassName="text-[13.5px] leading-[1.45]" clampLines={3} />
                    </div>
                </div>
            </div>

            <div className="relative hidden lg:flex gap-8 bg-paper-hi border border-accent rounded-card-lg p-7 shadow-cover overflow-hidden">
                <div className="absolute inset-[7px] border border-accent-muted rounded-[11px] pointer-events-none" />

                <Link href={`/albums/${pick.album_id}`} className="relative shrink-0 w-[260px]">
                    <Cover pick={pick} showStamp={true} />
                </Link>
                <div className="relative flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="rounded-full overflow-hidden border border-rule shrink-0" style={{ width: 30, height: 30 }}>
                            <UserAvatar userId={pick.curator_id} src={pick.curator_avatar} size={30} />
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-text-primary leading-tight">
                                Sélectionné par <span className="text-accent-deep">{pick.curator_username}</span>
                            </p>
                            <p className="text-[11.5px] text-text-tertiary leading-tight mt-0.5">
                                créateur de Waveform · une trouvaille par semaine
                            </p>
                        </div>
                    </div>
                    <Link href={`/albums/${pick.album_id}`} className="group">
                        <p className="font-display text-[30px] text-text-warm leading-tight group-hover:text-accent transition-colors duration-150">
                            {pick.album_title}
                        </p>
                    </Link>
                    <p className="text-sm text-text-secondary mt-0.5 mb-3">
                        {pick.artist_name}{pick.release_year && ` — ${pick.release_year}`}
                    </p>
                    <div className="border-l-2 border-accent pl-4">
                        <ExpandableNote note={pick.note} textClassName="text-xl leading-relaxed" clampLines={4} />
                    </div>
                </div>
            </div>
        </section>
    );
}
