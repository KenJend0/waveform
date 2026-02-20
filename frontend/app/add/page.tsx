import Link from "next/link";

export default function AddPage() {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] max-w-page mx-auto px-4 sm:px-6">
      <div className="pt-10 pb-2">
        <h1 className="text-h1 text-text-primary">Ajouter</h1>
      </div>

      <div className="flex-1 flex flex-col divide-y divide-border-divider">
        <Link
          href="/diary"
          className="group flex-1 flex items-center justify-between gap-8"
        >
          <div>
            <h2 className="text-[18px] font-medium text-text-primary group-hover:text-[#8E6F5E] transition-colors duration-150 mb-3">
              J'ai écouté un album
            </h2>
            <p className="text-[14px] text-text-secondary leading-[1.75] max-w-sm">
              Ajoute une écoute dans ton journal 
              — date, note sur 10, et un avis si tu veux.
            </p>
          </div>
          <span className="text-text-disabled group-hover:text-[#8E6F5E] transition-colors duration-150 text-[20px] flex-shrink-0">→</span>
        </Link>

        <Link
          href="/import"
          className="group flex-1 flex items-center justify-between gap-8"
        >
          <div>
            <h2 className="text-[18px] font-medium text-text-primary group-hover:text-[#8E6F5E] transition-colors duration-150 mb-3">
              Je veux écouter un album
            </h2>
            <p className="text-[14px] text-text-secondary leading-[1.75] max-w-sm">
              Ajoute un album à ta liste 'À écouter' pour ne pas l'oublier.
            </p>
          </div>
          <span className="text-text-disabled group-hover:text-[#8E6F5E] transition-colors duration-150 text-[20px] flex-shrink-0">→</span>
        </Link>
      </div>
    </div>
  );
}
