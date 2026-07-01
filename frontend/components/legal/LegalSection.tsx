export default function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-10">
            <h2 className="text-[13px] font-medium text-text-tertiary tracking-widest uppercase mb-3">
                {title}
            </h2>
            <div className="text-[14px] text-text-secondary leading-relaxed space-y-2">
                {children}
            </div>
        </section>
    );
}
