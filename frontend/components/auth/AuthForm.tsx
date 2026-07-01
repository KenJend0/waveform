// components/AuthForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { useSearchParams } from "next/navigation";
import { canAttemptAuth } from "@/lib/rateLimit";
import { showToast } from "@/components/ui/Toast";
import { trackProductEvent } from "@/lib/productEventsClient";
import { Eye, EyeOff } from "lucide-react";

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
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const urlError = searchParams.get("error");

  const navigateAfterAuth = (destination: "/explore" | "/onboarding" = "/explore") => {
    window.location.assign(destination);
  };

  useEffect(() => {
    if (urlError === "confirmation_failed") {
      showToast(
        "Le lien de confirmation est invalide ou expiré. Crée un nouveau compte ou demande un renvoi.",
        "error"
      );
    }
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting check
    const { allowed, remainingTime } = canAttemptAuth(mode === "login" ? "login" : mode === "signup" ? "signup" : "reset");
    if (!allowed) {
      const minutes = Math.ceil(remainingTime / 60);
      showToast(
        `Trop de tentatives. Réessaye dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        "error"
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
          showToast("Connexion réussie !", "success");
          navigateAfterAuth('/explore');
          return;
        }
      } else if (mode === "signup") {
        const redirectTo = `${window.location.origin}/auth/callback`;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              display_name: firstName.trim() || null,
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

        if (data.user && data.session) {
          void trackProductEvent("signup_completed", {
            surface: "auth_form",
            properties: {
              method: "email",
            },
          });
          // New accounts should land on onboarding directly instead of relying on /explore.
          navigateAfterAuth('/onboarding');
          return;
        } else if (data.user) {
          // Email confirmation enabled — user needs to confirm
          showToast(
            "Compte créé ! Vérifie ta boîte mail et clique sur le lien pour activer ton compte.",
            "success"
          );
          setMode("login");
          setEmail("");
          setPassword("");
        } else {
          throw new Error("Signup succeeded but no user returned");
        }
      } else if (mode === "reset") {
        const getFrontendBase = () => {
          const envBase = process.env.NEXT_PUBLIC_FRONTEND_BASE;
          if (envBase && !envBase.includes("localhost")) return envBase;
          if (typeof window !== "undefined") return window.location.origin;
          return "";
        };

        const base = getFrontendBase().replace(/\/$/, '');
        if (!base) {
          console.error('Missing NEXT_PUBLIC_FRONTEND_BASE and window.location.origin not available');
          showToast("Impossible d'envoyer l'email de réinitialisation pour l'instant.", "error");
          setLoading(false);
          return;
        }

        const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${base}/auth/callback`,
        });

        if (resetError) {
          console.error("[AuthForm] reset password error:", resetError);
          throw new Error("Impossible d'envoyer l'email de réinitialisation pour l'instant.");
        }

        showToast(
          "Email de réinitialisation envoyé ! Vérifie ta boîte mail.",
          "success"
        );
        setMode("login");
        setEmail("");
      }
    } catch (err: any) {
      console.error(err);
      void trackProductEvent("auth_error", {
        surface: "auth_form",
        properties: {
          mode,
        },
      });
      showToast(err.message || "Une erreur s'est produite", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/mark.svg" alt="Waveform" className="h-10 w-auto mx-auto mb-4" />
        <p className="text-meta text-text-secondary">
          {mode === "login" ? "Connecte-toi à ton compte" : mode === "signup" ? "Crée ton compte Waveform" : "Réinitialise ton mot de passe"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {mode === "signup" && (
          <div>
            <label className="block text-meta font-medium text-text-secondary mb-1">
              Prénom
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ton prénom"
              className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
            />
          </div>
        )}

        {mode !== "reset" && (
          <div>
            <label className="block text-meta font-medium text-text-secondary mb-1">
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
            <label className="block text-meta font-medium text-text-secondary mb-1">
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
            <p className="text-label text-text-tertiary mt-1">
              Nous t'enverrons un lien pour réinitialiser ton mot de passe.
            </p>
          </div>
        )}

        {mode !== "reset" && (
          <div>
            <label className="block text-meta font-medium text-text-secondary mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                minLength={8}
                className="w-full bg-background border border-border rounded-[10px] px-3 py-2 pr-10 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Cacher le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {mode === "signup" && (
              <p className="text-label text-text-tertiary mt-1">Minimum 8 caractères</p>
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

      <div className="text-center text-meta text-text-secondary space-y-2">
        {mode === "login" ? (
          <>
            <div>
              Pas encore de compte ?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setEmail("");
                  setPassword("");
                  setFirstName("");
                }}
                className="underline underline-offset-2 text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
              >
                Créer un compte
              </button>
            </div>
            <div>
              <button
                onClick={() => {
                  setMode("reset");
                  setPassword("");
                }}
                className="underline underline-offset-2 text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
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
              }}
              className="underline underline-offset-2 text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
            >
              Se connecter
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => {
                setMode("login");
                setEmail("");
              }}
              className="underline underline-offset-2 text-text-secondary hover:text-[#8E6F5E] transition-colors duration-150"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
