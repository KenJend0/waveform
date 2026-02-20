'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import AuthForm from '@/components/AuthForm';


export default function AuthPage() {
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        // Si déjà connecté, rediriger vers le feed
        if (user) {
            router.push('/feed');
        }
    }, [user, router]);

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-6">
            <div className="w-full max-w-sm">
                <AuthForm />

                <p className="text-center text-[12px] text-text-tertiary mt-8">
                    En continuant, tu acceptes nos conditions d'utilisation
                </p>
            </div>
        </div>
    );
}

