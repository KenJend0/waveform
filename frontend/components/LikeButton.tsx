"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleDiaryLike } from "@/app/actions/diary";

export default function LikeButton({
                                       entryId, initialLiked, initialCount,
                                   }: { entryId: string; initialLiked: boolean; initialCount: number; }) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [loading, setLoading] = useState(false);

    const toggleLike = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await toggleDiaryLike(entryId);
            setLiked((prev) => !prev);
            setCount((prev) => (liked ? prev - 1 : prev + 1));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleLike} 
                disabled={loading} 
                className="text-text-secondary hover:text-[#8E6F5E] transition-colors duration-150 focus:outline-none"
            >
                <Heart 
                    size={20} 
                    fill={liked ? "currentColor" : "none"}
                    className={liked ? "text-[#8E6F5E]" : ""}
                />
            </button>
            <span className="text-meta text-text-secondary">{count}</span>
        </div>
    );
}

