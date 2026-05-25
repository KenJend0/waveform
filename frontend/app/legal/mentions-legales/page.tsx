import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Mentions légales",
};

export default function MentionsLegales() {
    return (
        <article className="prose-legal">
            <h1 className="text-h1 text-text-primary mb-2">Mentions légales</h1>
            <p className="text-[13px] text-text-tertiary mb-10">Dernière mise à jour : février 2026</p>

            <Section title="Éditeur">
                <p>
                    Waveform est un projet indépendant édité à titre personnel.
                </p>
                <dl>
                    <Row label="Nom du projet" value="Waveform" />
                    <Row label="Site" value="waveformapp.online" />
                    <Row label="Contact" value="waveform.contact@proton.me" />
                    <Row label="Statut" value="Projet personnel non commercial" />
                </dl>
            </Section>

            <Section title="Hébergement">
                <dl>
                    <Row label="Hébergeur frontend" value="Vercel Inc." />
                    <Row label="Adresse" value="340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis" />
                    <Row label="Site" value="vercel.com" />
                </dl>
                <p className="mt-4">
                    La base de données est hébergée via Supabase (AWS, région Europe de l'Ouest).
                </p>
            </Section>

            <Section title="Données musicales">
                <p>
                    Les informations sur les albums, artistes et morceaux (titres, dates, pochettes) proviennent de{" "}
                    <strong>MusicBrainz</strong>, une base de données musicale ouverte publiée sous licence{" "}
                    <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer" className="text-text-primary underline underline-offset-2">
                        Creative Commons CC0
                    </a>
                    . Les pochettes d'albums sont issues du{" "}
                    <strong>Cover Art Archive</strong>, également sous CC0.
                </p>
                <p className="mt-3">
                    Waveform n'héberge aucun fichier audio et ne propose aucun service de streaming musical.
                </p>
            </Section>

            <Section title="Propriété intellectuelle">
                <p>
                    Le code source, le design et les textes propres à Waveform sont la propriété de l'éditeur.
                    Toute reproduction sans autorisation est interdite.
                </p>
                <p className="mt-3">
                    Les contenus publiés par les utilisateurs (avis, notes, listes) restent leur propriété.
                    En les publiant sur Waveform, ils accordent à l'application une licence d'affichage non exclusive.
                </p>
            </Section>

            <Section title="Responsabilité">
                <p>
                    Waveform est fourni "tel quel", sans garantie de disponibilité ou d'exactitude des données.
                    L'éditeur ne saurait être tenu responsable des contenus publiés par les utilisateurs.
                </p>
            </Section>

            <Section title="Contact">
                <p>
                    Pour toute question relative aux présentes mentions légales :{" "}
                    <a href="mailto:waveform.contact@proton.me" className="text-text-primary underline underline-offset-2">
                        waveform.contact@proton.me
                    </a>
                </p>
            </Section>
        </article>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-10">
            <h2 className="text-[17px] font-medium text-text-primary mb-4 pb-2 border-b border-border-divider">{title}</h2>
            <div className="text-[14px] text-text-secondary leading-relaxed space-y-2">
                {children}
            </div>
        </section>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-3 py-1">
            <dt className="text-text-tertiary w-40 flex-shrink-0">{label}</dt>
            <dd className="text-text-primary">{value}</dd>
        </div>
    );
}
