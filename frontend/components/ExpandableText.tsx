"use client";

import { useEffect, useRef, useState } from "react";

export default function ExpandableText({
    text,
    className,
    clampLines = 3,
}: {
    text: string;
    className: string;
    clampLines?: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const ref = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        setCanExpand(el.scrollHeight > el.clientHeight + 1);
    }, [text]);

    return (
        <div>
            <p
                ref={ref}
                className={className}
                style={!expanded ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: clampLines, overflow: "hidden" } : undefined}
            >
                {text}
            </p>
            {canExpand && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="font-display italic text-[12.5px] text-accent border-b border-accent pb-px mt-1 hover:text-accent-deep hover:border-accent-deep transition-colors"
                >
                    {expanded ? "voir moins" : "voir plus"}
                </button>
            )}
        </div>
    );
}
