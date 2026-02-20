// components/AuthForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { useSearchParams } from "next/navigation";
import { canAttemptAuth } from "@/lib/rateLimit";

type AuthMode = "login" | "signup" | "reset";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Rate limiting check
    const { allowed, remainingTime } = canAttemptAuth(mode === "login" ? "login" : mode === "signup" ? "signup" : "reset");
    if (!allowed) {
      const minutes = Math.ceil(remainingTime / 60);
      setError(
        `Trop de tentatives. Réessaye dans ${minutes} minute${minutes > 1 ? "s" : ""}.`
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          let errorMessage = signInError.message;
          if (errorMessage.includes("Invalid login credentials")) {
            errorMessage = "Adresse mail ou mot de passe incorrect";
          } else if (errorMessage.includes("Email not confirmed")) {
            errorMessage = "Veuillez confirmer votre email avant de vous connecter. Vérifiez votre boîte mail.";
          }
          throw new Error(errorMessage);
        }

        if (data.user && data.session) {
          setSuccess("Connexion réussie!");
          router.push("/feed");
        }
      } else if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split("@")[0],
            },
          },
        });

        if (signUpError) {
          let errorMessage = signUpError.message;
          if (errorMessage.includes("already registered")) {
            errorMessage = "Cet email est déjà utilisé";
          } else if (errorMessage.includes("Password")) {
            errorMessage = "Le mot de passe doit contenir au moins 8 caractères";
          }
          throw new Error(errorMessage);
        }

        if (data.user) {
          setSuccess(
            "Compte créé ! Un email de confirmation a été envoyé. Vérifie ta boîte mail et clique sur le lien pour activer ton compte, puis connecte-toi."
          );
          setMode("login");
          setEmail("");
          setPassword("");
          setDisplayName("");
        } else {
          throw new Error("Signup succeeded but no user returned");
        }
      } else if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=login`,
        });

        if (resetError) {
          throw new Error(resetError.message);
        }

        setSuccess(
          "Email de réinitialisation envoyé ! Vérifie ta boîte mail pour réinitialiser ton mot de passe."
        );
        setMode("login");
        setEmail("");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur s'est produite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="text-center mb-8">
        <h1 className="text-h1 text-text-primary mb-2">Waveform</h1>
        <p className="text-[14px] text-text-secondary">
          {mode === "login" ? "Connecte-toi à ton compte" : mode === "signup" ? "Crée ton compte Waveform" : "Réinitialise ton mot de passe"}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-background-secondary border border-border rounded-[8px] text-[#C86C6C] text-[14px]">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-background-secondary border border-border rounded-[8px] text-text-secondary text-[14px]">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="block text-[14px] font-medium text-text-secondary mb-1">
              Nom d'affichage (optionnel)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre nom"
              className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
            />
          </div>
        )}

        {mode !== "reset" && (
          <div>
            <label className="block text-[14px] font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@example.com"
              required
              className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
            />
          </div>
        )}

        {mode === "reset" && (
          <div>
            <label className="block text-[14px] font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@example.com"
              required
              className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
            />
            <p className="text-[12px] text-text-tertiary mt-1">
              Nous t'enverrons un lien pour réinitialiser ton mot de passe.
            </p>
          </div>
        )}

        {mode !== "reset" && (
          <div>
            <label className="block text-[14px] font-medium text-text-secondary mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              minLength={8}
              className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
            />
            {mode === "signup" && (
              <p className="text-[12px] text-text-tertiary mt-1">Minimum 8 caractères</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 bg-[#1C1C1C] hover:opacity-85 disabled:bg-[#D8D3CB] disabled:text-text-disabled rounded-[8px] text-[#F5F3EF] font-medium transition-opacity"
        >
          {loading ? "Chargement..." : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer un compte" : "Envoyer le lien"}
        </button>
      </form>

      <div className="text-center text-[14px] text-text-secondary space-y-2">
        {mode === "login" ? (
          <>
            <div>
              Pas encore de compte ?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setSuccess(null);
                  setEmail("");
                  setPassword("");
                }}
                className="text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
              >
                Créer un compte
              </button>
            </div>
            <div>
              <button
                onClick={() => {
                  setMode("reset");
                  setError(null);
                  setSuccess(null);
                  setPassword("");
                }}
                className="text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
              >
                Mot de passe oublié ?
              </button>
            </div>
          </>
        ) : mode === "signup" ? (
          <div>
            Déjà un compte ?{" "}
            <button
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
                setDisplayName("");
              }}
              className="text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
            >
              Se connecter
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
                setEmail("");
              }}
              className="text-text-secondary hover:text-[#8E6F5E] transition-colors duration-150"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


