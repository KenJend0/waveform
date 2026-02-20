import { getTimeAgo } from './utils/formatDate';

export const timeAgo = getTimeAgo;

export function msToMMSS(ms: number | null) {
    if (!ms || ms === 0) return "—";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}
