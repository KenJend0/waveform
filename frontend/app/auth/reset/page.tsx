'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const verified = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (verified.current) return;
    verified.current = true;

    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (token_hash && type === 'recovery') {
      // Lien direct (flow OTP) — vérifier le token
      supabase.auth
        .verifyOtp({ token_hash, type: 'recovery' })
        .then(({ error: verifyError }) => {
          if (verifyError) {
            setError('Lien invalide ou expiré. Demande un nouvel email de réinitialisation.');
          } else {
            setReady(true);
          }
        })
        .finally(() => setLoading(false));
    } else {
      // Pas de token_hash — vérifier si une session recovery existe déjà (flow PKCE via /auth/callback)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        } else {
          router.replace('/auth?mode=login');
        }
        setLoading(false);
      });
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess('Mot de passe changé. Tu vas être redirigé vers la connexion.');
      await supabase.auth.signOut();
      setTimeout(() => router.push('/auth?mode=login'), 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-h1 text-text-primary mb-6">Nouveau mot de passe</h1>

        {loading && (
          <p className="text-[14px] text-text-tertiary">Vérification du lien…</p>
        )}

        {!loading && (
          <>
            {error && (
              <div className="p-3 bg-background-secondary border border-border rounded-[8px] text-[#C86C6C] text-[14px] mb-4">
                <p>{error}</p>
                <button
                  onClick={() => router.push('/auth?mode=reset')}
                  className="mt-2 text-[13px] text-text-primary underline"
                >
                  Renvoyer un email
                </button>
              </div>
            )}

            {success && (
              <div className="p-3 bg-background-secondary border border-border rounded-[8px] text-text-secondary text-[14px] mb-4">
                {success}
              </div>
            )}

            {ready && !success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[14px] font-medium text-text-secondary mb-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-text-secondary mb-1">
                    Confirmer
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-[#1C1C1C] hover:opacity-85 disabled:bg-[#D8D3CB] disabled:text-text-disabled rounded-[8px] text-[#F5F3EF] font-medium transition-opacity"
                >
                  {loading ? 'Chargement...' : 'Changer le mot de passe'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/auth?mode=login')}
                    className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150"
                  >
                    Retour à la connexion
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
