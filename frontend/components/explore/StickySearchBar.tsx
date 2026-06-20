import SearchOverlay from '@/components/SearchOverlay';

/**
 * Garde la barre de recherche accessible quel que soit le défilement de la
 * page, sans changer son apparence (pas de rétrécissement).
 */
export default function StickySearchBar() {
    return (
        <div className="sticky top-0 md:top-[72px] z-40 bg-background px-6 lg:px-8 py-2 mb-5">
            <SearchOverlay />
        </div>
    );
}
