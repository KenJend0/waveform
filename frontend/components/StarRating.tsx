"use client";

import { useState } from "react";

type StarRatingProps = {
    value: number | null;
    onChange: (rating: number) => void;
};

export default function StarRating({ value, onChange }: StarRatingProps) {
    const [hoverValue, setHoverValue] = useState<number | null>(null);
    const currentValue = hoverValue ?? value ?? 0;

    return (
        <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => {
                const starValue = i + 1;
                const isFilled = starValue <= currentValue;

                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => onChange(starValue)}
                        onMouseEnter={() => setHoverValue(starValue)}
                        onMouseLeave={() => setHoverValue(null)}
                        className="transition-colors duration-150"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill={isFilled ? "currentColor" : "none"}
                            stroke={isFilled ? "none" : "currentColor"}
                            strokeWidth={isFilled ? 0 : "1.5"}
                            className={`w-6 h-6 ${
                                isFilled ? "text-text-primary" : "text-[#D8D3CB]"
                            }`}
                        >
                            <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                        </svg>
                    </button>
                );
            })}
        </div>
    );
}

