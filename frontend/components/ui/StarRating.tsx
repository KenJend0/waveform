"use client";

import { useState } from "react";

type StarRatingProps = {
    value: number | null;
    onChange: (rating: number) => void;
    // Réduit la taille/le padding de chaque étoile — nécessaire quand la
    // rangée doit partager sa largeur avec un bouton voisin (ex. la croix
    // d'annulation sur les cartes mobiles de /add) : à taille normale, les
    // 10 étoiles dépassent la largeur restante et débordent sous ce bouton.
    compact?: boolean;
};

export default function StarRating({ value, onChange, compact }: StarRatingProps) {
    const [hoverValue, setHoverValue] = useState<number | null>(null);
    const currentValue = hoverValue ?? value ?? 0;

    return (
        <div className="flex justify-between w-full">
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
                        className={`flex items-center justify-center transition-colors duration-150 ${compact ? "p-0.5" : "p-1"}`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill={isFilled ? "currentColor" : "none"}
                            stroke={isFilled ? "none" : "currentColor"}
                            strokeWidth={isFilled ? 0 : "1.5"}
                            className={`${compact ? "w-5 h-5" : "w-6 h-6"} ${
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

