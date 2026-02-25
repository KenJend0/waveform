'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setOnboardingUsername, checkUsernameAvailability } from '@/app/actions/profile';
import FollowButton from '@/components/social/FollowButton';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { showToast } from '@/components/Toast';

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,32}$/;
const USERNAME_CHARS_REGEX = /^[a-zA-Z0-9_.-]*$/;
const MIN_LENGTH = 3;

type SuggestedUser = {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
};

type Props = {
    currentDisplayName: string;
    suggestedUsers: SuggestedUser[];
};

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'too_short';

export default function OnboardingFlow({ currentDisplayName, suggestedUsers }: Props) {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [username, setUsername] = useState('');
    const [checkState, setCheckState] = useState<CheckState>('idle');
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Step 1 helpers ────────────────────────────────────────────────────────

    const checkAvailability = useCallback(async (value: string) => {
        const trimmed = value.trim();
        setCheckState('checking');
        const result = await checkUsernameAvailability(trimmed);
        if (!result.ok) { setCheckState('idle'); return; }
        setCheckState(result.available ? 'available' : 'taken');
    }, []);

    const handleUsernameChange = (value: string) => {
        setUsername(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        const trimmed = value.trim();
        if (!trimmed) { setCheckState('idle'); return; }
        if (!USERNAME_CHARS_REGEX.test(trimmed)) { setCheckState('invalid'); return; }
        if (trimmed.length < MIN_LENGTH) { setCheckState('too_short'); return; }
        if (trimmed.length > 32) { setCheckState('invalid'); return; }

        // Format is valid — debounce the API check
        setCheckState('checking');
        debounceRef.current = setTimeout(() => checkAvailability(trimmed), 500);
    };

    const handleContinueStep1 = async () => {
        const trimmed = username.trim();
        if (!trimmed || !USERNAME_REGEX.test(trimmed)) {
            showToast('Pseudo invalide', 'error');
            return;
        }
        if (checkState === 'taken') {
            showToast('Ce pseudo est déjà pris', 'error');
            return;
        }
        setLoading(true);
        try {
            const result = await setOnboardingUsername(trimmed);
            if (!result.ok) {
                showToast('Erreur, réessaie.', 'error');
                return;
            }
            setStep(2);
        } catch {
            showToast('Erreur, réessaie.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Progress indicator ────────────────────────────────────────────────────

    const Progress = () => (
        <div className="flex items-center gap-2 mb-10">
            {[1, 2, 3].map((s) => (
                <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        s <= step ? 'bg-text-primary' : 'bg-border'
                    }`}
                />
            ))}
        </div>
    );

    // ── Step 1 — Pseudo ───────────────────────────────────────────────────────

    if (step === 1) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="w-full max-w-sm">
                    <Progress />

                    <p className="text-[12px] text-text-tertiary uppercase tracking-widest mb-6">Waveform</p>
                    <h1 className="text-h1 text-text-primary mb-2">
                        Bienvenue{currentDisplayName ? `, ${currentDisplayName.split(' ')[0]}` : ''} !
                    </h1>
                    <p className="text-[14px] text-text-secondary mb-8">
                        Commence par choisir ton pseudo. C'est ce que verront les autres.
                    </p>

                    <div className="space-y-3">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-text-tertiary select-none">@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => handleUsernameChange(e.target.value)}
                                placeholder="ton-pseudo"
                                autoFocus
                                autoCapitalize="none"
                                autoCorrect="off"
                                maxLength={32}
                                className={`w-full bg-background-secondary border rounded-[10px] pl-7 pr-10 py-3 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150 ${
                                    checkState === 'available'
                                        ? 'border-green-500'
                                        : checkState === 'taken' || checkState === 'invalid'
                                        ? 'border-[#C86C6C]'
                                        : 'border-border hover:border-[#8E6F5E] focus:border-[#8E6F5E]'
                                }`}
                            />
                            {/* Icône d'état à droite */}
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none">
                                {checkState === 'checking' && (
                                    <span className="text-text-tertiary">…</span>
                                )}
                                {checkState === 'available' && (
                                    <span className="text-green-500">✓</span>
                                )}
                                {(checkState === 'taken' || checkState === 'invalid') && (
                                    <span className="text-[#C86C6C]">✕</span>
                                )}
                            </span>
                        </div>

                        {/* Feedback ligne */}
                        <div className="flex items-center justify-between">
                            <p className={`text-[12px] transition-colors duration-150 ${
                                checkState === 'invalid' ? 'text-[#C86C6C]' :
                                checkState === 'too_short' ? 'text-[#C86C6C]' :
                                checkState === 'taken' ? 'text-[#C86C6C]' :
                                checkState === 'available' ? 'text-green-500' :
                                'text-text-tertiary'
                            }`}>
                                {checkState === 'invalid' && 'Caractères non autorisés'}
                                {checkState === 'too_short' && `Minimum ${MIN_LENGTH} caractères`}
                                {checkState === 'taken' && 'Déjà pris'}
                                {checkState === 'available' && 'Disponible'}
                                {(checkState === 'idle' || checkState === 'checking') && `${MIN_LENGTH}–32 car. · lettres, chiffres, _, ., -`}
                            </p>
                            {username.length > 0 && (
                                <p className={`text-[12px] tabular-nums ${username.length < MIN_LENGTH ? 'text-[#C86C6C]' : 'text-text-tertiary'}`}>
                                    {username.length}/32
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleContinueStep1}
                            disabled={
                                loading ||
                                !username.trim() ||
                                checkState === 'taken' ||
                                checkState === 'invalid' ||
                                checkState === 'too_short' ||
                                checkState === 'checking' ||
                                checkState === 'idle'
                            }
                            className="w-full py-3 bg-[#1C1C1C] text-[#F5F3EF] text-[14px] font-medium rounded-[8px] hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? 'En cours...' : 'Continuer →'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Step 2 — Suggestions ──────────────────────────────────────────────────

    if (step === 2) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="w-full max-w-sm">
                    <Progress />

                    <h1 className="text-h1 text-text-primary mb-2">Qui veux-tu suivre ?</h1>
                    <p className="text-[14px] text-text-secondary mb-8">
                        Suis des gens pour remplir ton feed avec leurs écoutes.
                    </p>

                    {suggestedUsers.length > 0 ? (
                        <div className="divide-y divide-border-divider mb-8">
                            {suggestedUsers.map((user) => (
                                <div key={user.id} className="flex items-center gap-4 py-4">
                                    <div className="flex-shrink-0 rounded-full overflow-hidden border border-border">
                                        <UserAvatar userId={user.id} src={user.avatar_url} size={40} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-medium text-text-primary truncate">
                                            {user.display_name || user.username}
                                        </p>
                                        <p className="text-[12px] text-text-tertiary">@{user.username}</p>
                                    </div>
                                    <FollowButton userId={user.id} initialIsFollowing={false} skipRefresh />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[14px] text-text-tertiary mb-8">
                            Pas encore de suggestions — tu pourras trouver des gens via la recherche.
                        </p>
                    )}

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setStep(3)}
                            className="text-[14px] text-text-tertiary hover:text-text-primary transition-colors duration-150"
                        >
                            Passer
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            className="flex-1 py-3 bg-[#1C1C1C] text-[#F5F3EF] text-[14px] font-medium rounded-[8px] hover:opacity-85 transition-opacity"
                        >
                            Continuer →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Step 3 — Lancement ────────────────────────────────────────────────────

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
                <Progress />

                <h1 className="text-h1 text-text-primary mb-2">C'est parti !</h1>
                <p className="text-[14px] text-text-secondary mb-10">
                    Commence par ajouter un album à ton profil.
                </p>

                <Link
                    href="/add"
                    className="flex items-center justify-between w-full px-4 py-4 bg-[#1C1C1C] text-[#F5F3EF] rounded-[12px] hover:opacity-85 transition-opacity"
                >
                    <div>
                        <p className="text-[14px] font-medium">Ajouter un album</p>
                        <p className="text-[12px] text-[#F5F3EF]/60 mt-0.5">Commence à construire ton profil</p>
                    </div>
                    <span className="text-[20px] leading-none ml-4">→</span>
                </Link>
            </div>
        </div>
    );
}
