"use client";

import { useState } from "react";

const COLLAPSE_THRESHOLD = 240; // characters

export default function DescriptionCollapse({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const needsCollapse = text.length > COLLAPSE_THRESHOLD;

    return (
        <div>
            <p className="text-[14px] text-text-secondary leading-relaxed max-w-prose">
                {needsCollapse && !expanded ? text.slice(0, COLLAPSE_THRESHOLD).trimEnd() + "…" : text}
            </p>
            {needsCollapse && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 text-[13px] text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                >
                    {expanded ? "Réduire" : "Lire plus"}
                </button>
            )}
        </div>
    );
}
