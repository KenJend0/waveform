"use client";

type Props = {
    count: number;
    className: string;
};

export default function ScrollToReviewsStat({ count, className }: Props) {
    const handleClick = () => {
        document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <button onClick={handleClick} className={`${className} text-left hover:opacity-70 transition-opacity duration-150`}>
            <span className="font-display italic text-[26px] text-text-warm leading-none">{count.toLocaleString()}</span>
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Critiques</span>
        </button>
    );
}
