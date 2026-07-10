import Link from 'next/link';

interface UnauthCTAProps {
  tagline?: string;
  title: React.ReactNode;
  className?: string;
}

export default function UnauthCTA({
  tagline = 'Bienvenue sur Waveform',
  title,
  className = '',
}: UnauthCTAProps) {
  return (
    <div className={`relative max-w-2xl px-5 py-5 bg-paper-hi border border-rule rounded-card-lg overflow-hidden ${className}`}>
      <div className="absolute left-0 top-5 bottom-5 w-[3px] bg-accent rounded-r-full" />
      <p className="text-label uppercase tracking-[0.18em] text-text-tertiary mb-2">{tagline}</p>
      <p className="font-display font-normal text-[20px] text-text-warm leading-snug mb-4">{title}</p>
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          href="/auth?mode=signup"
          className="text-sm font-medium px-[18px] py-[10px] bg-text-warm text-paper-hi rounded-button hover:opacity-90 transition-opacity"
        >
          Créer un compte
        </Link>
        <Link
          href="/auth?mode=login"
          className="text-sm text-text-secondary hover:text-accent transition-colors duration-150 !underline underline-offset-2"
          style={{ textDecorationColor: 'rgba(0,0,0,0.25)', textDecorationThickness: '1px' }}
        >
          J&apos;ai déjà un compte
        </Link>
      </div>
    </div>
  );
}
