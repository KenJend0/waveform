"use client";

import { useRouter } from "next/navigation";
import ArrowLeftIcon from "@/components/icons/ArrowLeftIcon";

type Props = { fallbackHref?: string; className?: string; children?: React.ReactNode; };

export default function BackButton({ fallbackHref = "/", className = "", children }: Props) {
    const router = useRouter();
    const onClick = () => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={className || "flex items-center gap-2 text-meta text-text-secondary hover:text-text-primary transition-colors duration-150"}
            aria-label="Go back"
        >
            <ArrowLeftIcon />
            {children ?? "Back"}
        </button>
    );
}

