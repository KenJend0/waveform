export default function Loading() {
    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-28 pt-6 animate-pulse">
            {/* BackButton */}
            <div className="h-4 w-16 bg-background-secondary rounded mb-8" />

            {/* ── Section profil : avatar + champs ── */}
            <section className="mb-10">
                <div className="h-5 bg-background-secondary rounded w-28 mb-6" />

                {/* Avatar circulaire */}
                <div className="flex items-center gap-5 mb-8">
                    <div className="w-20 h-20 rounded-full bg-background-secondary flex-shrink-0" />
                    <div className="space-y-2">
                        <div className="h-8 w-28 bg-background-secondary rounded-[8px]" />
                        <div className="h-3 bg-background-secondary rounded w-36" />
                    </div>
                </div>

                {/* Champ nom d'affichage */}
                <div className="mb-5">
                    <div className="h-3.5 bg-background-secondary rounded w-32 mb-2" />
                    <div className="h-11 bg-background-secondary rounded-[10px]" />
                </div>

                {/* Champ bio */}
                <div className="mb-5">
                    <div className="h-3.5 bg-background-secondary rounded w-16 mb-2" />
                    <div className="h-24 bg-background-secondary rounded-[10px]" />
                </div>

                {/* Email (lecture seule) */}
                <div>
                    <div className="h-3.5 bg-background-secondary rounded w-16 mb-2" />
                    <div className="h-11 bg-background-secondary rounded-[10px]" />
                </div>
            </section>

            {/* ── Section imports ── */}
            <section className="border-t border-border-divider pt-8 mb-10">
                <div className="h-5 bg-background-secondary rounded w-24 mb-6" />
                <div className="space-y-3">
                    {/* Last.fm card */}
                    <div className="h-[72px] bg-background-secondary rounded-[12px]" />
                    {/* RYM card */}
                    <div className="h-[72px] bg-background-secondary rounded-[12px]" />
                </div>
            </section>

            {/* ── Section export ── */}
            <section className="border-t border-border-divider pt-8 mb-10">
                <div className="h-5 bg-background-secondary rounded w-32 mb-4" />
                <div className="h-3.5 bg-background-secondary rounded w-80 max-w-full mb-4" />
                <div className="h-10 bg-background-secondary rounded-[10px] w-36" />
            </section>

            {/* ── Zone dangereuse ── */}
            <section className="border-t border-border-divider pt-8">
                <div className="h-5 bg-background-secondary rounded w-32 mb-4" />
                <div className="h-10 bg-background-secondary rounded-[10px] w-40" />
            </section>
        </div>
    );
}
