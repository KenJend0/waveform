import UnauthCTA from './UnauthCTA';

type UnauthTeaserProps = {
  ctaTitle: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Enveloppe un aperçu flouté de la vraie page (passé en children, avec des
 * données publiques réelles) avec le CTA de connexion superposé — donne
 * l'impression d'une fonctionnalité verrouillée plutôt que d'une page vide.
 */
export default function UnauthTeaser({ ctaTitle, children }: UnauthTeaserProps) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none blur-[3px] opacity-50">
        {children}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background"
      />

      {/* Le conteneur reste absolute (calé sur toute la hauteur du contenu flouté) ;
          c'est la carte elle-même qui devient sticky (à tous les breakpoints)
          pour rester centrée à l'écran pendant le scroll, bornée par la
          hauteur de ce conteneur. */}
      <div className="absolute inset-0 flex items-start justify-center px-4">
        <UnauthCTA
          title={ctaTitle}
          className="shadow-[0_12px_32px_-8px_rgba(42,37,32,0.18)] sticky top-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
}
