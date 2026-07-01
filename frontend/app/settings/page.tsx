"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import AvatarCropModal from "@/components/ui/AvatarCropModal";
import Image from "next/image";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { uploadAvatar, deleteAvatar as deleteAvatarAction } from "@/app/actions/avatarActions";
import {
    getMyProfileSettings,
    updateProfileSettings,
    changeUsername as changeUsernameAction,
    checkUsernameAvailability,
    deleteAccount,
} from "@/app/actions/profile";
import { exportUserData } from "@/app/actions/export";
import { startLastfmImport } from "@/app/actions/lastfm";
import { startRymImport, countRymCsvRows } from "@/app/actions/rym";
import { getActiveImports } from "@/app/actions/externalImport";
import BackButton from "@/components/ui/BackButton";
import { showToast } from "@/components/ui/Toast";

type Profile = {
    id: string;
    username: string | null;
    bio: string | null;
    avatar_url: string | null;
    username_changed: boolean | null;
    email: string;
};

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{2,32}$/;

export default function ProfileSettings() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile>({
        id: "",
        username: "",
        bio: null,
        avatar_url: null,
        username_changed: null,
        email: "",
    });
    const [loading, setLoading] = useState(true);
    const [unauthenticated, setUnauthenticated] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [confirmDeleteAvatar, setConfirmDeleteAvatar] = useState(false);
    // Max avatar upload size (bytes) — 3MB
    const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const result = await getMyProfileSettings();
                if (!result.ok) {
                    if (result.error === "not_authenticated") {
                        setUnauthenticated(true);
                        setLoading(false);
                        return;
                    }
                    showToast("Erreur au chargement du profil", "error");
                    return;
                }

                const data = result.profile!;

                setProfile({
                    id: data.id,
                    username: data.username || "",
                    bio: data.bio,
                    avatar_url: data.avatar_url || null,
                    username_changed: data.username_changed ?? null,
                    email: data.email || "",
                });
            } catch (e: any) {
                console.error("Error loading profile:", e);
                showToast("Erreur au chargement du profil", "error");
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [router]);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_AVATAR_BYTES) {
            showToast("Image trop lourde — taille max 3MB", "error");
            // clear the input value to allow re-selecting same file if needed
            e.currentTarget.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setSelectedImage(event.target?.result as string);
            setShowCropModal(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropModal(false);
        setSelectedImage(null);

        if (croppedBlob.size > MAX_AVATAR_BYTES) {
            showToast("Image recadrée trop lourde — taille max 3MB", "error");
            return;
        }

        const previewUrl = URL.createObjectURL(croppedBlob);
        setAvatarPreview(previewUrl);

        setUploading(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("Not authenticated");
            }

            const formData = new FormData();
            formData.append("file", new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" }));
            const result = await uploadAvatar(user.id, formData);

            if (!result.ok) {
                throw new Error(result.error || "Upload failed");
            }

            setProfile((prev) => ({
                ...prev,
                avatar_url: result.avatarUrl ?? null,
            }));

            showToast("Avatar uploadé avec succès !", "success");
            setAvatarPreview(null);
            URL.revokeObjectURL(previewUrl);
        } catch (e: any) {
            console.error("Avatar upload error:", e);
            showToast(e.message || "Erreur lors de l'upload", "error");
            setAvatarPreview(null);
            URL.revokeObjectURL(previewUrl);
        } finally {
            setUploading(false);
        }
    };

    const handleCropCancel = () => {
        setShowCropModal(false);
        setSelectedImage(null);
    };

    const deleteAvatar = async () => {
        setUploading(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("Not authenticated");
            }

            const result = await deleteAvatarAction(user.id);

            if (!result.ok) {
                throw new Error(result.error || "Delete failed");
            }

            setProfile((prev) => ({
                ...prev,
                avatar_url: null,
            }));

            showToast("Photo de profil supprimée", "success");
            setConfirmDeleteAvatar(false);
        } catch (e: any) {
            console.error("Avatar delete error:", e);
            showToast(e.message || "Erreur lors de la suppression", "error");
        } finally {
            setUploading(false);
        }
    };

    const saveProfile = async () => {
        try {
            const result = await updateProfileSettings({
                bio: profile.bio,
            });

            if (!result.ok) {
                throw new Error(result.error || "update_failed");
            }

            showToast("Profil mis à jour !", "success");
        } catch (e: any) {
            console.error("Profile update error:", e);
            showToast(e.message || "Erreur lors de la mise à jour", "error");
        }
    };

    const [newUsername, setNewUsername] = useState("");
    const [changingUsername, setChangingUsername] = useState(false);
    const [showUsernameForm, setShowUsernameForm] = useState(false);
    const [usernameCheckState, setUsernameCheckState] = useState<
        "idle" | "checking" | "available" | "taken" | "invalid"
    >("idle");

    const changeUsername = async () => {
        const trimmed = newUsername.trim();

        if (!trimmed) {
            showToast("Veuillez entrer un pseudo", "error");
            return;
        }

        if (!USERNAME_REGEX.test(trimmed)) {
            showToast("Pseudo invalide", "error");
            setUsernameCheckState("invalid");
            return;
        }

        if (profile.username_changed) {
            showToast("Vous avez déjà changé votre pseudo", "error");
            return;
        }

        if (trimmed === (profile.username || "")) {
            showToast("Ce pseudo est déjà le vôtre", "error");
            return;
        }

        setChangingUsername(true);
        try {
            const availability = await checkUsernameAvailability(trimmed);
            if (!availability.ok) {
                throw new Error(availability.error || "username_check_failed");
            }
            if (!availability.available) {
                setUsernameCheckState("taken");
                showToast("Pseudo déjà pris", "error");
                return;
            }

            const result = await changeUsernameAction(trimmed);

            if (!result.ok) {
                throw new Error(result.error || "update_failed");
            }

            setProfile((prev) => ({
                ...prev,
                username: trimmed,
                username_changed: true,
            }));
            showToast("Pseudo changé avec succès !", "success");
            setShowUsernameForm(false);
            setNewUsername("");
            setUsernameCheckState("idle");
        } catch (e: any) {
            console.error("Username change error:", e);
            showToast(e.message || "Erreur lors du changement de pseudo", "error");
        } finally {
            setChangingUsername(false);
        }
    };

    const checkUsername = async () => {
        const trimmed = newUsername.trim();
        if (!trimmed) {
            setUsernameCheckState("idle");
            return;
        }

        if (!USERNAME_REGEX.test(trimmed)) {
            setUsernameCheckState("invalid");
            return;
        }

        setUsernameCheckState("checking");
        const result = await checkUsernameAvailability(trimmed);
        if (!result.ok) {
            setUsernameCheckState("idle");
            return;
        }
        setUsernameCheckState(result.available ? "available" : "taken");
    };

    const { signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
            router.push("/");
            router.refresh();
        } catch (e: any) {
            console.error("Logout error:", e);
            showToast(e.message || "Erreur lors de la déconnexion", "error");
        }
    };

    const [lastfmUsername, setLastfmUsername] = useState("");
    const [lastfmImporting, setLastfmImporting] = useState(false);
    const [lastfmError, setLastfmError] = useState<string | null>(null);

    const handleLastfmImport = async () => {
        setLastfmError(null);
        setLastfmImporting(true);
        try {
            const start = await startLastfmImport(lastfmUsername);
            if (!start.success) {
                setLastfmError(start.error);
                setLastfmImporting(false);
                return;
            }
            // Le traitement est repris par le worker GitHub Actions — pas de polling ici,
            // les résultats apparaîtront dans le journal/la liste de triage.
        } catch (e: any) {
            console.error("Lastfm import error:", e);
            setLastfmError(e.message || "Erreur lors de l'import");
            setLastfmImporting(false);
        }
    };

    const [rymImporting, setRymImporting] = useState(false);
    const [rymError, setRymError] = useState<string | null>(null);
    const [rymPending, setRymPending] = useState<{ fileContent: string; fileName: string; total: number; maxLimit: number } | null>(null);
    const [rymLimitInput, setRymLimitInput] = useState("");
    const [rymCounting, setRymCounting] = useState(false);
    const MAX_RYM_CSV_BYTES = 3 * 1024 * 1024;

    const handleRymFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.currentTarget.value = "";
        if (!file) return;

        setRymError(null);
        setRymPending(null);
        setRymCounting(true);
        try {
            if (file.size > MAX_RYM_CSV_BYTES) {
                setRymError("Fichier CSV trop lourd — taille max 3MB.");
                return;
            }

            const fileContent = await file.text();
            const counted = await countRymCsvRows(fileContent);
            if (!counted.success) {
                setRymError(counted.error);
                return;
            }
            setRymPending({ fileContent, fileName: file.name, total: counted.total, maxLimit: counted.maxLimit });
            setRymLimitInput(String(counted.defaultLimit));
        } catch (e: any) {
            console.error("RYM count error:", e);
            setRymError(e.message || "Erreur lors de la lecture du fichier");
        } finally {
            setRymCounting(false);
        }
    };

    const handleRymImport = async () => {
        if (!rymPending) return;
        const { fileContent, fileName } = rymPending;
        const limit = Math.min(parseInt(rymLimitInput, 10) || rymPending.total, rymPending.maxLimit);

        setRymError(null);
        setRymImporting(true);
        try {
            const start = await startRymImport(fileContent, fileName, limit);
            if (!start.success) {
                setRymError(start.error);
                setRymImporting(false);
                return;
            }
            setRymPending(null);
            // Le traitement est repris par le worker GitHub Actions — pas de polling ici,
            // les résultats apparaîtront directement dans le journal.
        } catch (e: any) {
            console.error("RYM import error:", e);
            setRymError(e.message || "Erreur lors de l'import");
            setRymImporting(false);
        }
    };

    // Affiche le message "import en cours" si un import est resté en cours
    // (onglet fermé/page rechargée avant la fin) — le traitement réel se fait
    // exclusivement côté worker GitHub Actions, /settings ne fait que refléter l'état.
    useEffect(() => {
        (async () => {
            const active = await getActiveImports();
            if (!active.success) return;

            for (const imp of active.imports) {
                if (imp.source === "lastfm") setLastfmImporting(true);
                else if (imp.source === "rym") setRymImporting(true);
            }
        })();
    }, []);

    const [exporting, setExporting] = useState(false);

    const handleExportData = async () => {
        setExporting(true);
        try {
            const result = await exportUserData();
            if (!result.success) {
                showToast(result.error || "Erreur lors de l'export", "error");
                return;
            }
            const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const date = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `waveform-export-${profile.username || "moi"}-${date}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            console.error("Export data error:", e);
            showToast(e.message || "Erreur lors de l'export", "error");
        } finally {
            setExporting(false);
        }
    };

    const [showDeleteZone, setShowDeleteZone] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            const result = await deleteAccount();
            if (!result.ok) {
                showToast(result.error || "Erreur lors de la suppression", "error");
                setDeleting(false);
                return;
            }
            await signOut();
            router.push("/");
        } catch (e: any) {
            console.error("Delete account error:", e);
            showToast(e.message || "Erreur lors de la suppression", "error");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E6F5E] mx-auto mb-4"></div>
                    <p className="text-text-secondary text-meta">Chargement...</p>
                </div>
            </div>
        );
    }

    if (unauthenticated) {
        return (
            <div className="mx-auto max-w-page lg:max-w-5xl px-4 md:px-6 pb-28 lg:pb-12">
                <div className="pt-8 pb-6">
                    <h1 className="text-h1 text-text-primary mb-2">Paramètres</h1>
                    <p className="text-meta text-text-tertiary">Personnalise ton profil et ton compte.</p>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-4 bg-background-secondary border border-border rounded-[12px]">
                    <p className="text-meta text-text-secondary leading-snug">
                        Crée un compte pour accéder à tes paramètres.
                    </p>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <a href="/auth?mode=signup" className="text-[13px] font-medium px-3 py-1.5 bg-[#1C1C1C] text-[#F5F3EF] rounded-[8px] hover:opacity-85 transition-opacity">
                            Créer un compte
                        </a>
                        <a href="/auth?mode=login" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors underline">
                            Se connecter
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24">
            <div className="max-w-page mx-auto px-6 pt-4 pb-12">
                <div className="mb-8">
                    <BackButton label="Mon profil" fallbackHref="/me" className="mb-6" />
                    <h1 className="text-h1 text-text-primary mb-1">Modifier le profil</h1>
                </div>

                {/* Avatar Section */}
                <section className="mb-12">
                    <h2 className="text-h2 text-text-tertiary mb-4">Photo de profil</h2>

                    <div className="py-4 border-b border-border-divider">
                        <div className="flex items-start gap-6">
                            {/* Avatar Display */}
                            <div className="flex-shrink-0">
                                {avatarPreview ? (
                                    <img
                                        src={avatarPreview}
                                        alt="Avatar preview"
                                        className="w-20 h-20 rounded-full object-cover bg-background-tertiary"
                                    />
                                ) : profile.avatar_url ? (
                                    <div className="w-20 h-20 rounded-full overflow-hidden relative">
                                        <Image src={profile.avatar_url} alt="Profile avatar" fill className="object-cover" sizes="80px" />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-background-tertiary flex items-center justify-center">
                                        <UserAvatar userId={profile.id} size={80} />
                                    </div>
                                )}
                            </div>

                            {/* Upload Controls */}
                            <div className="flex-1 space-y-2">
                                <label className="block">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                    <span className="inline-flex items-center text-meta text-text-secondary hover:text-text-primary cursor-pointer transition-colors duration-150 disabled:opacity-50">
                                        {uploading ? "Upload..." : "Changer la photo"}
                                    </span>
                                </label>

                                {profile.avatar_url && !uploading && (
                                    confirmDeleteAvatar ? (
                                        <div className="flex items-center gap-3">
                                            <span className="text-label text-text-secondary">Supprimer ?</span>
                                            <button
                                                onClick={deleteAvatar}
                                                className="text-label text-[#C86C6C] hover:opacity-75 transition-opacity"
                                            >
                                                Oui
                                            </button>
                                            <span className="text-label text-text-disabled">·</span>
                                            <button
                                                onClick={() => setConfirmDeleteAvatar(false)}
                                                className="text-label text-text-tertiary hover:text-text-primary transition-colors duration-150"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDeleteAvatar(true)}
                                            className="text-meta text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150"
                                        >
                                            Supprimer la photo
                                        </button>
                                    )
                                )}

                            </div>
                        </div>
                    </div>
                </section>

                {/* Profile Info Section */}
                <section className="mb-12">
                    <h2 className="text-h2 text-text-tertiary mb-4">Informations personnelles</h2>

                    {/* Bio */}
                    <div className="py-4 border-b border-border-divider">
                        <label className="block text-meta text-text-primary mb-2">Bio</label>
                        <textarea
                            value={profile.bio ?? ""}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value || null })}
                            placeholder="Parlez un peu de vous..."
                            maxLength={500}
                            rows={3}
                            className="w-full bg-background-secondary border border-border hover:border-[#8E6F5E] focus:border-[#8E6F5E] rounded-[10px] px-3 py-2 text-meta text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150 resize-none"
                        />
                        <p className="text-label text-text-tertiary mt-1">
                            {(profile.bio ?? "").length}/500 caractères
                        </p>
                    </div>
                </section>

                {/* Identifiers Section */}
                <section className="mb-12">
                    <h2 className="text-h2 text-text-tertiary mb-4">Identifiants</h2>

                    {/* Username */}
                    <div className="py-4 border-b border-border-divider">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-meta text-text-primary mb-1">Nom d'utilisateur</p>
                                <p className="text-meta text-text-secondary font-mono">@{profile.username || "Non défini"}</p>
                            </div>
                            {!showUsernameForm && (
                                <button
                                    onClick={() => setShowUsernameForm(true)}
                                    disabled={!!profile.username_changed}
                                    className="text-meta text-text-secondary hover:text-text-primary transition-colors duration-150 flex-shrink-0 disabled:opacity-50"
                                >
                                    Changer
                                </button>
                            )}
                        </div>
                        {profile.username_changed && !showUsernameForm && (
                            <p className="text-label text-text-tertiary">
                                Vous avez déjà changé votre pseudo.
                            </p>
                        )}

                        {/* Change username form */}
                        {showUsernameForm && (
                            <div className="space-y-3 mt-4 p-4 bg-background-secondary border border-border rounded-[12px]">
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => {
                                        setNewUsername(e.target.value);
                                        setUsernameCheckState("idle");
                                    }}
                                    onBlur={checkUsername}
                                    placeholder="Nouveau pseudo"
                                    className="w-full bg-background border border-border hover:border-[#8E6F5E] focus:border-[#8E6F5E] rounded-[10px] px-3 py-2 text-meta text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150"
                                />
                                <p className="text-label text-text-tertiary">
                                    2-32 caractères (lettres, chiffres, _, ., -)
                                </p>
                                {usernameCheckState === "invalid" && (
                                    <p className="text-label text-[#C86C6C]">Pseudo invalide</p>
                                )}
                                {usernameCheckState === "taken" && (
                                    <p className="text-label text-[#C86C6C]">Pseudo déjà pris</p>
                                )}
                                {usernameCheckState === "available" && (
                                    <p className="text-label text-text-secondary">Pseudo disponible</p>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        onClick={changeUsername}
                                        disabled={
                                            changingUsername ||
                                            !newUsername.trim() ||
                                            !USERNAME_REGEX.test(newUsername.trim()) ||
                                            newUsername.trim() === (profile.username || "") ||
                                            !!profile.username_changed
                                        }
                                        className="text-meta text-text-secondary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                                    >
                                        {changingUsername ? "..." : "Confirmer"}
                                    </button>
                                    <span className="text-[#D8D3CB]">·</span>
                                    <button
                                        onClick={() => {
                                            setShowUsernameForm(false);
                                            setNewUsername("");
                                            setUsernameCheckState("idle");
                                        }}
                                        className="text-meta text-text-secondary hover:text-text-primary transition-colors duration-150"
                                    >
                                        Annuler
                                    </button>
                                </div>
                                <div className="bg-background-tertiary border border-border rounded-[8px] p-2">
                                    <p className="text-label text-text-secondary">
                                        Vous ne pourrez changer votre pseudo qu'une seule fois.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Email (read-only) */}
                    <div className="py-4 border-b border-border-divider">
                        <p className="text-meta text-text-primary mb-1">Adresse e-mail</p>
                        <p className="text-meta text-text-secondary font-mono">{profile.email}</p>
                    </div>
                </section>

                {/* Save Button */}
                <div className="pt-4">
                    <button
                        onClick={saveProfile}
                        className="w-full py-3 bg-[#1C1C1C] hover:opacity-85 text-[#F5F3EF] text-meta font-medium transition-opacity rounded-[8px]"
                    >
                        Enregistrer les modifications
                    </button>
                </div>

                {/* Import historique */}
                <section className="mt-12">
                    <div className="border-t border-border-divider pt-8">
                        <h2 className="text-h2 text-text-tertiary mb-4">Importer ton historique</h2>
                        <p className="text-meta text-text-secondary mb-3">
                            Pseudo Last.fm — on récupère tes albums les plus écoutés (nécessite un profil public).
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={lastfmUsername}
                                onChange={(e) => setLastfmUsername(e.target.value)}
                                placeholder="Pseudo Last.fm"
                                disabled={lastfmImporting}
                                className="flex-1 bg-background border border-border rounded-[10px] px-3 py-2 text-meta text-text-primary placeholder-text-tertiary focus:outline-none focus:border-text-secondary transition-colors duration-150"
                            />
                            <button
                                onClick={handleLastfmImport}
                                disabled={lastfmImporting || !lastfmUsername.trim()}
                                className="px-4 py-2 bg-[#1C1C1C] hover:opacity-85 text-[#F5F3EF] text-meta font-medium transition-opacity rounded-[8px] disabled:opacity-50"
                            >
                                {lastfmImporting ? "Import..." : "Importer"}
                            </button>
                        </div>

                        {lastfmError && (
                            <p className="text-meta text-[#C86C6C] mt-2">{lastfmError}</p>
                        )}

                        {lastfmImporting && (
                            <p className="text-meta text-text-tertiary mt-2">
                                Import en cours — tu verras les albums apparaître dans ta liste privée &quot;Import Last.fm&quot; au fur et à mesure.
                            </p>
                        )}

                        <p className="text-meta text-text-secondary mt-6 mb-3">
                            Export RateYourMusic (CSV) — exporte ton catalogue depuis ton profil RYM (Account → Export catalog), puis importe le fichier ici.
                        </p>
                        {!rymPending && (
                            <label className={`inline-block px-4 py-2 text-meta font-medium rounded-[8px] cursor-pointer transition-opacity ${(rymImporting || rymCounting) ? "opacity-50 cursor-not-allowed" : "hover:opacity-85"} bg-[#1C1C1C] text-[#F5F3EF]`}>
                                {rymCounting ? "Lecture du fichier..." : "Choisir un fichier CSV"}
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleRymFileSelect}
                                    disabled={rymImporting || rymCounting}
                                    className="hidden"
                                />
                            </label>
                        )}

                        {rymPending && !rymImporting && (
                            <div className="p-3 border border-border rounded-[10px] bg-background-secondary space-y-2">
                                <p className="text-meta text-text-secondary">
                                    {rymPending.total} écoute{rymPending.total > 1 ? "s" : ""} détectée{rymPending.total > 1 ? "s" : ""} dans <span className="text-text-primary">{rymPending.fileName}</span>. Combien veux-tu importer ?
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        max={rymPending.maxLimit}
                                        value={rymLimitInput}
                                        onChange={(e) => setRymLimitInput(e.target.value)}
                                        className="w-24 bg-background border border-border rounded-[10px] px-3 py-2 text-meta text-text-primary focus:outline-none focus:border-text-secondary transition-colors duration-150"
                                    />
                                    <button
                                        onClick={handleRymImport}
                                        className="px-4 py-2 bg-[#1C1C1C] hover:opacity-85 text-[#F5F3EF] text-meta font-medium transition-opacity rounded-[8px]"
                                    >
                                        Lancer l'import
                                    </button>
                                    <button
                                        onClick={() => setRymPending(null)}
                                        className="text-meta text-text-tertiary hover:text-text-primary transition-colors duration-150"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}

                        {rymError && (
                            <p className="text-meta text-[#C86C6C] mt-2">{rymError}</p>
                        )}

                        {rymImporting && (
                            <p className="text-meta text-text-tertiary mt-2">
                                Import en cours — tu verras les albums apparaître dans ton journal au fur et à mesure, avec leurs notes/critiques RYM.
                            </p>
                        )}
                    </div>
                </section>

                {/* Données */}
                <section className="mt-12">
                    <div className="border-t border-border-divider pt-8">
                        <h2 className="text-h2 text-text-tertiary mb-4">Mes données</h2>
                        <button
                            onClick={handleExportData}
                            disabled={exporting}
                            className="text-meta text-text-secondary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                        >
                            {exporting ? "Génération en cours..." : "Télécharger mes données (JSON)"}
                        </button>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="mt-16">
                    <div className="border-t border-border-divider pt-8">
                        <h2 className="text-h2 text-text-tertiary mb-4">Zone dangereuse</h2>

                        {!showDeleteZone ? (
                            <button
                                onClick={() => setShowDeleteZone(true)}
                                className="text-meta text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150"
                            >
                                Supprimer mon compte
                            </button>
                        ) : (
                            <div className="p-4 border border-[#C86C6C]/30 rounded-[12px] bg-background-secondary space-y-4">
                                <p className="text-meta text-text-secondary leading-relaxed">
                                    Cette action est <span className="text-text-primary font-medium">irréversible</span>. Ton profil, ton journal, tes écoutes et toutes tes données seront supprimés définitivement.
                                </p>
                                <div>
                                    <label className="block text-label text-text-tertiary mb-2">
                                        Saisis ton pseudo <span className="text-text-primary font-mono">@{profile.username}</span> pour confirmer
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder={profile.username || ""}
                                        className="w-full bg-background border border-border hover:border-[#C86C6C] focus:border-[#C86C6C] rounded-[10px] px-3 py-2 text-meta text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150"
                                    />
                                </div>
                                <div className="flex items-center gap-3 pt-1">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={deleteConfirmText !== profile.username || deleting}
                                        className="text-meta text-[#C86C6C] hover:opacity-75 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {deleting ? "Suppression..." : "Supprimer définitivement"}
                                    </button>
                                    <span className="text-text-disabled">·</span>
                                    <button
                                        onClick={() => { setShowDeleteZone(false); setDeleteConfirmText(""); }}
                                        className="text-meta text-text-tertiary hover:text-text-primary transition-colors duration-150"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Crop Modal */}
            {showCropModal && selectedImage && (
                <AvatarCropModal
                    imageSrc={selectedImage}
                    onComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}

