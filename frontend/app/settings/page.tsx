"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AvatarCropModal from "@/components/AvatarCropModal";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { uploadAvatar, deleteAvatar as deleteAvatarAction } from "@/app/actions/avatarActions";
import {
    getMyProfileSettings,
    updateProfileSettings,
    changeUsername as changeUsernameAction,
    checkUsernameAvailability,
    deleteAccount,
} from "@/app/actions/profile";
import BackButton from "@/components/BackButton";

type Profile = {
    id: string;
    display_name: string | null;
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
        display_name: "",
        username: "",
        bio: null,
        avatar_url: null,
        username_changed: null,
        email: "",
    });
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [confirmDeleteAvatar, setConfirmDeleteAvatar] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const result = await getMyProfileSettings();
                if (!result.ok) {
                    if (result.error === "not_authenticated") {
                        router.push("/auth");
                        return;
                    }
                    setStatus("Erreur au chargement du profil");
                    return;
                }

                const data = result.profile!;
                const fallbackName = data.display_name || data.email?.split("@")[0] || "User";

                setProfile({
                    id: data.id,
                    display_name: fallbackName,
                    username: data.username || "",
                    bio: data.bio,
                    avatar_url: data.avatar_url || null,
                    username_changed: data.username_changed ?? null,
                    email: data.email || "",
                });
            } catch (e: any) {
                console.error("Error loading profile:", e);
                setStatus("Erreur au chargement du profil");
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [router]);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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

        const previewUrl = URL.createObjectURL(croppedBlob);
        setAvatarPreview(previewUrl);

        setUploading(true);
        setStatus(null);
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

            setStatus("success:Avatar uploadé avec succès!");
            setAvatarPreview(null);
            URL.revokeObjectURL(previewUrl);
        } catch (e: any) {
            console.error("Avatar upload error:", e);
            setStatus(`error:${e.message}`);
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
        setStatus(null);
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

            setStatus("success:Photo de profil supprimée!");
            setConfirmDeleteAvatar(false);
        } catch (e: any) {
            console.error("Avatar delete error:", e);
            setStatus(`error:${e.message}`);
        } finally {
            setUploading(false);
        }
    };

    const saveProfile = async () => {
        setStatus(null);
        try {
            const result = await updateProfileSettings({
                display_name: profile.display_name,
                bio: profile.bio,
            });

            if (!result.ok) {
                throw new Error(result.error || "update_failed");
            }

            setStatus("success:Profil mis a jour!");
        } catch (e: any) {
            console.error("Profile update error:", e);
            setStatus(`error:${e.message}`);
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
            setStatus("error:Veuillez entrer un pseudo");
            return;
        }

        if (!USERNAME_REGEX.test(trimmed)) {
            setStatus("error:Pseudo invalide");
            setUsernameCheckState("invalid");
            return;
        }

        if (profile.username_changed) {
            setStatus("error:Vous avez deja change votre pseudo");
            return;
        }

        if (trimmed === (profile.username || "")) {
            setStatus("error:Ce pseudo est deja le votre");
            return;
        }

        setChangingUsername(true);
        setStatus(null);
        try {
            const availability = await checkUsernameAvailability(trimmed);
            if (!availability.ok) {
                throw new Error(availability.error || "username_check_failed");
            }
            if (!availability.available) {
                setUsernameCheckState("taken");
                setStatus("error:Pseudo deja pris");
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
            setStatus("success:Pseudo change avec succes!");
            setShowUsernameForm(false);
            setNewUsername("");
            setUsernameCheckState("idle");
        } catch (e: any) {
            console.error("Username change error:", e);
            setStatus(`error:${e.message}`);
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

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            router.push("/");
        } catch (e: any) {
            console.error("Logout error:", e);
            setStatus(`error:${e.message}`);
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
                setStatus(`error:${result.error || "Erreur lors de la suppression"}`);
                setDeleting(false);
                return;
            }
            await supabase.auth.signOut();
            router.push("/");
        } catch (e: any) {
            console.error("Delete account error:", e);
            setStatus(`error:${e.message}`);
            setDeleting(false);
        }
    };

    const isSuccess = status?.startsWith("success:");
    const isError = status?.startsWith("error:");
    const statusMessage = status?.replace(/^(success|error):/, "") || "";

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E6F5E] mx-auto mb-4"></div>
                    <p className="text-text-secondary text-[14px]">Chargement...</p>
                </div>
            </div>
        );
    };

    return (
        <div className="pb-24">
            <div className="max-w-page mx-auto px-6 py-12">
                <div className="mb-8">
                    <BackButton fallbackHref="/me" className="mb-6 flex items-center gap-2 text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150" />
                    <h1 className="text-h1 text-text-primary mb-1">Modifier le profil</h1>
                </div>

                {/* Status Message */}
                {status && (
                    <div className={`mb-6 p-3 border rounded-[8px] text-[14px] transition-all ${
                        isSuccess
                            ? "bg-background-secondary border-border text-text-secondary"
                            : "bg-background-secondary border-border text-[#C86C6C]"
                    }`}>
                        {statusMessage}
                    </div>
                )}

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
                                    <img
                                        src={profile.avatar_url}
                                        alt="Profile avatar"
                                        className="w-20 h-20 rounded-full object-cover bg-background-tertiary"
                                    />
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
                                    <span className="inline-flex items-center text-[14px] text-text-secondary hover:text-text-primary cursor-pointer transition-colors duration-150 disabled:opacity-50">
                                        {uploading ? "Upload..." : "Changer la photo"}
                                    </span>
                                </label>

                                {profile.avatar_url && !uploading && (
                                    confirmDeleteAvatar ? (
                                        <div className="flex items-center gap-3">
                                            <span className="text-[12px] text-text-secondary">Supprimer ?</span>
                                            <button
                                                onClick={deleteAvatar}
                                                className="text-[12px] text-[#C86C6C] hover:opacity-75 transition-opacity"
                                            >
                                                Oui
                                            </button>
                                            <span className="text-[12px] text-text-disabled">·</span>
                                            <button
                                                onClick={() => setConfirmDeleteAvatar(false)}
                                                className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDeleteAvatar(true)}
                                            className="text-[14px] text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150"
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

                    {/* Display Name */}
                    <div className="py-4 border-b border-border-divider">
                        <label className="block text-[14px] text-text-primary mb-2">Nom d'affichage</label>
                        <input
                            type="text"
                            value={profile.display_name ?? ""}
                            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                            placeholder="Votre nom"
                            className="w-full bg-background-secondary border border-border hover:border-[#8E6F5E] focus:border-[#8E6F5E] rounded-[10px] px-3 py-2 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150"
                        />
                    </div>

                    {/* Bio */}
                    <div className="py-4 border-b border-border-divider">
                        <label className="block text-[14px] text-text-primary mb-2">Bio</label>
                        <textarea
                            value={profile.bio ?? ""}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value || null })}
                            placeholder="Parlez un peu de vous..."
                            maxLength={500}
                            rows={3}
                            className="w-full bg-background-secondary border border-border hover:border-[#8E6F5E] focus:border-[#8E6F5E] rounded-[10px] px-3 py-2 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150 resize-none"
                        />
                        <p className="text-[12px] text-text-tertiary mt-1">
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
                                <p className="text-[14px] text-text-primary mb-1">Nom d'utilisateur</p>
                                <p className="text-[14px] text-text-secondary font-mono">@{profile.username || "Non défini"}</p>
                            </div>
                            {!showUsernameForm && (
                                <button
                                    onClick={() => setShowUsernameForm(true)}
                                    disabled={!!profile.username_changed}
                                    className="text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150 flex-shrink-0 disabled:opacity-50"
                                >
                                    Changer
                                </button>
                            )}
                        </div>
                        {profile.username_changed && !showUsernameForm && (
                            <p className="text-[12px] text-text-tertiary">
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
                                    className="w-full bg-background border border-border hover:border-[#8E6F5E] focus:border-[#8E6F5E] rounded-[10px] px-3 py-2 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150"
                                />
                                <p className="text-[12px] text-text-tertiary">
                                    2-32 caractères (lettres, chiffres, _, ., -)
                                </p>
                                {usernameCheckState === "invalid" && (
                                    <p className="text-[12px] text-[#C86C6C]">Pseudo invalide</p>
                                )}
                                {usernameCheckState === "taken" && (
                                    <p className="text-[12px] text-[#C86C6C]">Pseudo déjà pris</p>
                                )}
                                {usernameCheckState === "available" && (
                                    <p className="text-[12px] text-text-secondary">Pseudo disponible</p>
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
                                        className="text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                                    >
                                        {changingUsername ? "..." : "Confirmer"}
                                    </button>
                                    <span className="text-[#D8D3CB]">Â·</span>
                                    <button
                                        onClick={() => {
                                            setShowUsernameForm(false);
                                            setNewUsername("");
                                            setUsernameCheckState("idle");
                                        }}
                                        className="text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150"
                                    >
                                        Annuler
                                    </button>
                                </div>
                                <div className="bg-background-tertiary border border-border rounded-[8px] p-2">
                                    <p className="text-[12px] text-text-secondary">
                                        Vous ne pourrez changer votre pseudo qu'une seule fois.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Email (read-only) */}
                    <div className="py-4 border-b border-border-divider">
                        <p className="text-[14px] text-text-primary mb-1">Adresse e-mail</p>
                        <p className="text-[14px] text-text-secondary font-mono">{profile.email}</p>
                    </div>
                </section>

                {/* Save Button */}
                <div className="pt-4">
                    <button
                        onClick={saveProfile}
                        className="w-full py-3 bg-[#1C1C1C] hover:opacity-85 text-[#F5F3EF] text-[14px] font-medium transition-opacity rounded-[8px]"
                    >
                        Enregistrer les modifications
                    </button>
                </div>

                {/* Danger Zone */}
                <section className="mt-16">
                    <div className="border-t border-border-divider pt-8">
                        <h2 className="text-h2 text-text-tertiary mb-4">Zone dangereuse</h2>

                        {!showDeleteZone ? (
                            <button
                                onClick={() => setShowDeleteZone(true)}
                                className="text-[14px] text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150"
                            >
                                Supprimer mon compte
                            </button>
                        ) : (
                            <div className="p-4 border border-[#C86C6C]/30 rounded-[12px] bg-background-secondary space-y-4">
                                <p className="text-[14px] text-text-secondary leading-relaxed">
                                    Cette action est <span className="text-text-primary font-medium">irréversible</span>. Ton profil, ton journal, tes écoutes et toutes tes données seront supprimés définitivement.
                                </p>
                                <div>
                                    <label className="block text-[12px] text-text-tertiary mb-2">
                                        Saisis ton pseudo <span className="text-text-primary font-mono">@{profile.username}</span> pour confirmer
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder={profile.username || ""}
                                        className="w-full bg-background border border-border hover:border-[#C86C6C] focus:border-[#C86C6C] rounded-[10px] px-3 py-2 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none transition-colors duration-150"
                                    />
                                </div>
                                <div className="flex items-center gap-3 pt-1">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={deleteConfirmText !== profile.username || deleting}
                                        className="text-[14px] text-[#C86C6C] hover:opacity-75 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {deleting ? "Suppression..." : "Supprimer définitivement"}
                                    </button>
                                    <span className="text-text-disabled">·</span>
                                    <button
                                        onClick={() => { setShowDeleteZone(false); setDeleteConfirmText(""); }}
                                        className="text-[14px] text-text-tertiary hover:text-text-primary transition-colors duration-150"
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

