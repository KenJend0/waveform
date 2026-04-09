import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "FAQ — Waveform",
};

const faq: { category: string; questions: { q: string; a: React.ReactNode }[] }[] = [
    {
        category: "Utiliser Waveform",
        questions: [
            {
                q: "Comment logger un album que j'ai écouté ?",
                a: (
                    <>
                        Appuie sur <strong>+</strong> dans la barre de navigation, puis choisis{" "}
                        <em>J'ai écouté un album</em>. Recherche l'album, ajoute une note de 0 à 10
                        et un avis (optionnel), puis valide. L'entrée apparaît dans ton journal
                        et dans le feed de tes abonnés.
                    </>
                ),
            },
            {
                q: "Qu'est-ce que la wishlist / «\u00a0À écouter\u00a0» ?",
                a: (
                    <>
                        La wishlist regroupe les albums que tu veux écouter. Pour en ajouter un,
                        appuie sur <strong>+</strong> puis <em>Je veux écouter un album</em>,
                        ou depuis la page d'un album. Tu retrouves ta wishlist sur ton profil.
                    </>
                ),
            },
            {
                q: "Comment fonctionne le feed ?",
                a: (
                    <>
                        Le feed affiche l'activité récente des personnes que tu suis : leurs écoutes,
                        notes, avis et albums sauvegardés. Plus tu suis de gens, plus ton feed est actif.
                    </>
                ),
            },
            {
                q: "Comment suivre quelqu'un ?",
                a: (
                    <>
                        Recherche un utilisateur via la barre de recherche ou visite son profil
                        via son @pseudo. Appuie sur <strong>Suivre</strong>. Tu peux gérer
                        tes abonnements depuis ton profil → Abonnements / Abonnés.
                    </>
                ),
            },
            {
                q: "Puis-je rendre mes avis privés ?",
                a: (
                    <>
                        Oui. Lors de l'ajout d'une entrée dans ton journal, tu peux basculer
                        la visibilité sur <em>Privé</em>. Une entrée privée n'apparaît pas dans
                        ton profil public ni dans le feed de tes abonnés. Tu peux aussi modifier
                        la visibilité après coup depuis ton journal.
                    </>
                ),
            },
        ],
    },
    {
        category: "Compte et données",
        questions: [
            {
                q: "Comment modifier mon profil ?",
                a: (
                    <>
                        Va dans <strong>Réglages</strong> (icône en haut à droite de ton profil).
                        Tu peux y changer ton nom d'affichage, ta bio, ta photo de profil et tes albums favoris.
                    </>
                ),
            },
            {
                q: "Puis-je changer mon @pseudo ?",
                a: (
                    <>
                        Oui, une seule fois. Va dans <strong>Réglages → Identifiants → Nom d'utilisateur</strong>.
                        Choisis-le bien, car ce changement est définitif.
                    </>
                ),
            },
            {
                q: "Comment changer mon adresse e-mail ?",
                a: (
                    <>
                        La modification d'adresse e-mail n'est pas encore disponible directement dans l'app.
                        Contacte-nous à{" "}
                        <a href="mailto:waveform.contact@proton.me" className="text-text-primary underline underline-offset-2">
                            waveform.contact@proton.me
                        </a>{" "}
                        depuis ton adresse actuelle.
                    </>
                ),
            },
            {
                q: "Comment supprimer mon compte ?",
                a: (
                    <>
                        Va dans <strong>Réglages → Zone dangereuse → Supprimer mon compte</strong>.
                        Cette action est irréversible : ton profil, ton journal, tes avis et toutes
                        tes données sont supprimés définitivement.
                    </>
                ),
            },
            {
                q: "Puis-je exporter mes données ?",
                a: (
                    <>
                        L'export automatique n'est pas encore disponible. Tu peux en faire la demande
                        à{" "}
                        <a href="mailto:waveform.contact@proton.me" className="text-text-primary underline underline-offset-2">
                            waveform.contact@proton.me
                        </a>
                        . Conformément au RGPD, nous répondrons sous 30 jours.
                    </>
                ),
            },
            {
                q: "J'ai oublié mon mot de passe. Comment faire ?",
                a: (
                    <>
                        Sur la page de connexion, appuie sur <em>Mot de passe oublié</em>.
                        Tu recevras un e-mail avec un lien pour en créer un nouveau.
                        Pense à vérifier tes spams si tu ne le reçois pas sous quelques minutes.
                    </>
                ),
            },
        ],
    },
    {
        category: "Données musicales",
        questions: [
            {
                q: "D'où viennent les informations sur les albums et artistes ?",
                a: (
                    <>
                        Toutes les données musicales (titres, artistes, dates de sortie, tracklists, pochettes)
                        proviennent de <strong>MusicBrainz</strong>, une base de données musicale libre et ouverte,
                        et du <strong>Cover Art Archive</strong>. Ces données sont publiées sous licence CC0
                        (domaine public).
                    </>
                ),
            },
            {
                q: "Un album que je cherche n'est pas disponible. Que faire ?",
                a: (
                    <>
                        Si l'album n'apparaît pas dans la recherche, il n'est peut-être pas encore
                        dans la base MusicBrainz. Tu peux contribuer à MusicBrainz directement sur{" "}
                        <a href="https://musicbrainz.org" target="_blank" rel="noopener noreferrer" className="text-text-primary underline underline-offset-2">
                            musicbrainz.org
                        </a>
                        . Une fois ajouté là-bas, il deviendra importable sur Waveform.
                    </>
                ),
            },
            {
                q: "Est-ce que Waveform propose du streaming musical ?",
                a: (
                    <>
                        Non. Waveform est un journal et réseau social musical, pas une plateforme de streaming.
                        L'application n'héberge aucun fichier audio. Pour écouter un album,
                        utilise Spotify, Apple Music, Deezer ou toute autre plateforme de ton choix.
                    </>
                ),
            },
            {
                q: "Les notes et avis sont-ils liés à d'autres sites ?",
                a: (
                    <>
                        Non. Les notes et avis sur Waveform sont propres à la plateforme et à sa communauté.
                        Ils ne sont pas synchronisés avec Last.fm, RateYourMusic ou d'autres services.
                    </>
                ),
            },
        ],
    },
];

export default function FAQ() {
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150 mb-6"
                    >
                        ← <span className="underline underline-offset-2">Retour</span>
                    </Link>
                    <div className="mb-1">
                        <span className="text-[13px] font-medium text-text-tertiary tracking-widest uppercase">Waveform</span>
                    </div>
                </div>

                <h1 className="text-h1 text-text-primary mb-2">Questions fréquentes</h1>
                <p className="text-[14px] text-text-secondary mb-10">
                    Une autre question ?{" "}
                    <a href="mailto:waveform.contact@proton.me" className="text-text-primary underline underline-offset-2">
                        Écris-nous
                    </a>
                    .
                </p>

                <div className="space-y-12">
                    {faq.map((section) => (
                        <section key={section.category}>
                            <h2 className="text-[17px] font-medium text-text-primary mb-6 pb-2 border-b border-border-divider">
                                {section.category}
                            </h2>
                            <div className="space-y-6">
                                {section.questions.map((item) => (
                                    <div key={item.q}>
                                        <p className="text-[14px] font-medium text-text-primary mb-2">{item.q}</p>
                                        <p className="text-[14px] text-text-secondary leading-relaxed">{item.a}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <footer className="mt-16 pt-8 border-t border-border-divider">
                    <nav className="flex flex-wrap gap-x-6 gap-y-2">
                        <Link href="/legal/mentions-legales" className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            Mentions légales
                        </Link>
                        <Link href="/legal/confidentialite" className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            Confidentialité
                        </Link>
                        <Link href="/legal/cgu" className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            CGU
                        </Link>
                    </nav>
                </footer>
            </div>
        </div>
    );
}
