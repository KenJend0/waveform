"use client";

import { useState } from "react";
import { toggleSaveList, type UserList } from "@/app/actions/lists";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/ui/Toast";
import { toastErrorMessage } from "@/lib/toastErrors";

export function useListSave(list: UserList) {
    const { user: authUser } = useAuth();
    const [saved, setSaved] = useState(!!list.is_saved);
    const [saveLoading, setSaveLoading] = useState(false);
    const isOwnList = authUser?.id === list.user_id;
    const canSave = list.is_public && !isOwnList;

    async function toggleSave(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (!authUser) {
            showToast("Connecte-toi pour sauvegarder une liste", "error");
            return;
        }
        if (saveLoading) return;
        setSaveLoading(true);
        setSaved((v) => !v);
        try {
            await toggleSaveList(list.id);
        } catch (err) {
            setSaved((v) => !v);
            showToast(toastErrorMessage(err, "Impossible de sauvegarder cette liste"), "error");
        } finally {
            setSaveLoading(false);
        }
    }

    return { saved, isOwnList, canSave, toggleSave };
}
