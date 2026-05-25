import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/server';

export default async function HomePage() {
    const user = await getAuthUser();

    if (user) {
        redirect('/feed');
    }

    return (
        <div className="max-w-page mx-auto px-6 pt-[20vh] pb-[10vh] min-h-screen">
            <h1 className="mb-section-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/mark.svg" alt="Waveform" className="h-14 w-auto" />
            </h1>

            <p className="text-[16px] text-text-primary leading-snug mb-4 max-w-xs">
                Un journal intime<br />
                pour la musique que tu écoutes.
            </p>

            <p className="text-[14px] text-text-tertiary leading-relaxed mb-12 max-w-xs">
                Garde une trace de tes écoutes.<br />
                Écris quelques mots quand l'envie vient.<br />
                Partage — ou garde pour toi.
            </p>

            <div className="flex items-center gap-4">
                <Link
                    href="/auth?mode=signup"
                    className="bg-[#1C1C1C] text-[#F5F3EF] px-6 py-3 rounded-[8px] text-[16px] font-medium hover:opacity-85 transition-opacity duration-150"
                >
                    Créer un compte
                </Link>
                <Link
                    href="/auth"
                    className="text-[16px] text-text-secondary hover:text-[#8E6F5E] transition-colors duration-150 !underline underline-offset-2"
                    style={{ textDecorationColor: 'rgba(0,0,0,0.25)', textDecorationThickness: '1px' }}
                >
                    Se connecter
                </Link>
            </div>
        </div>
    );
}

