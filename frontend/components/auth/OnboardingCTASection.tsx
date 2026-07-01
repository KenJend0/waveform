import Link from "next/link";

export default function OnboardingCTASection() {
    return (
        <section>
            <div className="mb-3">
                <h2 className="text-h2 text-text-primary">
                    Pour <em className="italic text-accent-deep">toi</em>
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                    Note tes premiers albums pour débloquer des recommandations personnalisées.
                </p>
            </div>
            <div className="flex items-center gap-4 bg-background-secondary border border-border rounded-card p-5">
                <div className="w-11 h-11 rounded-full bg-paper-hi border border-border flex items-center justify-center font-display italic text-xl text-accent shrink-0">
                    +
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary font-medium">Ton journal est encore vide</p>
                    <p className="text-[13px] text-text-secondary mt-0.5">Note quelques albums pour qu'on commence à cerner tes goûts.</p>
                </div>
                <Link
                    href="/add"
                    className="shrink-0 font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors"
                >
                    noter un album
                </Link>
            </div>
        </section>
    );
}
