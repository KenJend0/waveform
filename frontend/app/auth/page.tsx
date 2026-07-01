'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import AuthForm from '@/components/auth/AuthForm';


export default function AuthPage() {
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        // Si déjà connecté, rediriger vers explore
        if (user) {
            router.push('/explore');
        }
    }, [user, router]);

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-6">
            <div className="w-full max-w-sm">
                <Suspense fallback={null}>
                    <AuthForm />
                </Suspense>

                <p className="text-center text-[12px] text-text-tertiary mt-8">
                    En continuant, tu acceptes nos{" "}
                    <a href="/legal/cgu" className="underline underline-offset-2 hover:text-text-secondary transition-colors duration-150">
                        conditions d&apos;utilisation
                    </a>
                    {" "}et notre{" "}
                    <a href="/legal/confidentialite" className="underline underline-offset-2 hover:text-text-secondary transition-colors duration-150">
                        politique de confidentialité
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}

