import type { Metadata } from "next";
import LegalSection from "@/components/legal/LegalSection";

export const metadata: Metadata = {
    title: "Politique de confidentialité",
};

export default function Confidentialite() {
    return (
        <article>
            <h1 className="text-h1 text-text-primary mb-2">Politique de confidentialité</h1>
            <p className="text-[13px] text-text-tertiary mb-10">Dernière mise à jour : février 2026</p>

            <LegalSection title="Qui sommes-nous ?">
                <p>
                    Waveform est un journal musical social, projet indépendant non commercial.
                    Cette politique décrit quelles données personnelles nous collectons, pourquoi,
                    et quels droits vous avez sur celles-ci.
                </p>
                <p className="mt-3">
                    Responsable de traitement : Waveform — <a href="mailto:waveform.contact@proton.me" className="text-text-primary underline underline-offset-2">waveform.contact@proton.me</a>
                </p>
            </LegalSection>

            <LegalSection title="Données collectées">
                <p className="mb-3">Lors de l'utilisation de Waveform, nous collectons :</p>
                <ul className="space-y-3">
                    <Li label="Compte">
                        Adresse e-mail, nom d'affichage, nom d'utilisateur (@pseudo), biographie,
                        photo de profil (optionnelle). Ces données sont nécessaires au fonctionnement du compte.
                    </Li>
                    <Li label="Activité musicale">
                        Albums écoutés, notes (0–10), avis écrits, albums sauvegardés, albums favoris.
                        Ces données sont le cœur du service.
                    </Li>
                    <Li label="Interactions sociales">
                        Relations de suivi (qui tu suis, qui te suit), likes et commentaires sur les avis.
                    </Li>
                    <Li label="Données techniques">
                        Vercel Analytics collecte des données agrégées et anonymisées de navigation
                        (pages vues, pays, type d'appareil) sans cookies ni identification individuelle.
                    </Li>
                </ul>
                <p className="mt-4 text-text-tertiary text-[13px]">
                    Nous ne collectons aucune donnée de genre, d'âge, de localisation précise,
                    ni aucune information de paiement. Nous n'utilisons pas de cookies publicitaires.
                </p>
            </LegalSection>

            <LegalSection title="Finalités du traitement">
                <table className="w-full text-[13px] border-collapse">
                    <thead>
                        <tr className="border-b border-border-divider">
                            <th className="text-left py-2 pr-4 text-text-tertiary font-normal">Finalité</th>
                            <th className="text-left py-2 text-text-tertiary font-normal">Base légale</th>
                        </tr>
                    </thead>
                    <tbody className="text-text-secondary">
                        <tr className="border-b border-border-divider/50">
                            <td className="py-2 pr-4">Authentification et gestion du compte</td>
                            <td className="py-2">Exécution du contrat</td>
                        </tr>
                        <tr className="border-b border-border-divider/50">
                            <td className="py-2 pr-4">Affichage du journal et du feed social</td>
                            <td className="py-2">Exécution du contrat</td>
                        </tr>
                        <tr className="border-b border-border-divider/50">
                            <td className="py-2 pr-4">Amélioration du service (analytics anonymes)</td>
                            <td className="py-2">Intérêt légitime</td>
                        </tr>
                        <tr>
                            <td className="py-2 pr-4">Envoi d'e-mails de confirmation de compte</td>
                            <td className="py-2">Exécution du contrat</td>
                        </tr>
                    </tbody>
                </table>
            </LegalSection>

            <LegalSection title="Conservation des données">
                <p>
                    Vos données sont conservées tant que votre compte est actif.
                    En cas de suppression du compte, toutes vos données personnelles
                    (profil, journal, avis, suivis) sont supprimées définitivement et immédiatement.
                </p>
                <p className="mt-3">
                    Vous pouvez supprimer votre compte à tout moment depuis{" "}
                    <strong>Réglages → Zone dangereuse → Supprimer mon compte</strong>.
                </p>
            </LegalSection>

            <LegalSection title="Hébergement et transferts">
                <p>
                    Les données sont hébergées par <strong>Supabase</strong> (infrastructure AWS,
                    région Europe de l'Ouest) et <strong>Vercel</strong> (États-Unis).
                    Ces transferts hors UE sont encadrés par les clauses contractuelles types de la Commission européenne.
                </p>
                <p className="mt-3">
                    Les photos de profil sont stockées dans Supabase Storage.
                    Les données musicales proviennent de MusicBrainz (CC0) et ne sont pas des données personnelles.
                </p>
            </LegalSection>

            <LegalSection title="Vos droits (RGPD)">
                <p className="mb-3">
                    Conformément au Règlement Général sur la Protection des Données (RGPD),
                    vous disposez des droits suivants :
                </p>
                <ul className="space-y-2">
                    <Li label="Accès">Consulter vos données via votre profil et votre journal.</Li>
                    <Li label="Rectification">Modifier vos informations depuis les Réglages.</Li>
                    <Li label="Suppression">Supprimer votre compte et toutes vos données depuis les Réglages.</Li>
                    <Li label="Portabilité">Télécharger un export JSON de vos données depuis les Réglages.</Li>
                    <Li label="Opposition">Vous opposer à un traitement spécifique par e-mail.</Li>
                </ul>
                <p className="mt-4">
                    Pour exercer ces droits :{" "}
                    <a href="mailto:waveform.contact@proton.me" className="text-text-primary underline underline-offset-2">
                        waveform.contact@proton.me
                    </a>
                    . Vous pouvez également introduire une réclamation auprès de la{" "}
                    <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-text-primary underline underline-offset-2">
                        CNIL
                    </a>
                    .
                </p>
            </LegalSection>

            <LegalSection title="Cookies">
                <p>
                    Waveform utilise uniquement des cookies de session strictement nécessaires
                    au maintien de votre connexion. Aucun cookie publicitaire ou de tracking tiers n'est utilisé.
                </p>
            </LegalSection>

            <LegalSection title="Contact">
                <p>
                    Pour toute question relative à vos données personnelles :{" "}
                    <a href="mailto:waveform.contact@proton.me" className="text-text-primary underline underline-offset-2">
                        waveform.contact@proton.me
                    </a>
                </p>
            </LegalSection>
        </article>
    );
}

function Li({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="text-text-tertiary flex-shrink-0 w-32">{label}</span>
            <span>{children}</span>
        </li>
    );
}
