const RECENT_SEARCHES_KEY = "musicboxd_recent_searches";
const MAX_RECENT_SEARCHES = 8;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string): string[] {
  if (typeof window === "undefined" || !query.trim()) return [];
  try {
    const searches = getRecentSearches();
    const filtered = searches.filter((s) => s.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeRecentSearch(query: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const searches = getRecentSearches();
    const updated = searches.filter((s) => s !== query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}

export { RECENT_SEARCHES_KEY, MAX_RECENT_SEARCHES };
