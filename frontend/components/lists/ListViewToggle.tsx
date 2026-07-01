"use client";

type Props = {
    view: "grid" | "list";
    onChange: (view: "grid" | "list") => void;
};

export default function ListViewToggle({ view, onChange }: Props) {
    return (
        <div className="flex items-center gap-0.5 bg-background-secondary rounded-full p-0.5 flex-shrink-0">
            <button
                onClick={() => onChange("grid")}
                aria-label="Vue grille"
                className={`p-1.5 rounded-full transition-colors ${view === "grid" ? "bg-text-primary text-background" : "text-text-tertiary hover:text-text-primary"}`}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
                    <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" />
                    <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" />
                    <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" />
                </svg>
            </button>
            <button
                onClick={() => onChange("list")}
                aria-label="Vue liste"
                className={`p-1.5 rounded-full transition-colors ${view === "list" ? "bg-text-primary text-background" : "text-text-tertiary hover:text-text-primary"}`}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1.5" width="12" height="2" rx="1" fill="currentColor" />
                    <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor" />
                    <rect x="1" y="10.5" width="12" height="2" rx="1" fill="currentColor" />
                </svg>
            </button>
        </div>
    );
}
