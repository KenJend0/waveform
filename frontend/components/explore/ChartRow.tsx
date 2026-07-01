import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";

function TrendBadge({ delta }: { delta?: number | null }) {
    // undefined : pas de notion de tendance pour ce type d'item -> pas de badge
    if (delta === undefined) return null;
    // null : pas d'activité la période précédente -> nouvelle entrée dans le classement
    if (delta === null) {
        return <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Nouvelle entrée" />;
    }
    if (delta === 0) {
        return <span className="text-label text-text-tertiary shrink-0">=</span>;
    }
    const isUp = delta > 0;
    return (
        <span className={`text-label font-medium shrink-0 ${isUp ? "text-sage" : "text-like"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(delta)}
        </span>
    );
}

export default function ChartRow({
    href,
    rank,
    cover_url,
    title,
    subtitle,
    delta,
}: {
    href: string;
    rank: number;
    cover_url: string;
    title: string;
    subtitle: string;
    delta?: number | null;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-3 py-2.5 border-t border-border-divider first:border-t-0"
        >
            <span className="font-display italic text-2xl text-accent w-6 text-center shrink-0 leading-none">
                {rank}
            </span>
            <div className="w-12 h-12 rounded-cover-sm overflow-hidden bg-background-secondary shrink-0 shadow-cover relative">
                {cover_url ? (
                    <CoverImage
                        src={cover_url}
                        alt={title}
                        fill
                        className="object-cover"
                        placeholder={<div className="w-full h-full bg-background-tertiary" />}
                    />
                ) : (
                    <div className="w-full h-full bg-background-tertiary" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-display font-normal text-sm text-text-warm truncate group-hover:text-accent transition-colors duration-150">
                    {title}
                </p>
                <p className="text-label text-text-tertiary truncate mt-0.5">{subtitle}</p>
            </div>
            <TrendBadge delta={delta} />
        </Link>
    );
}
