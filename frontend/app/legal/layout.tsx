import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
    title: {
        default: "Légal — Waveform",
        template: "%s — Waveform",
    },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
    return <LegalPageShell>{children}</LegalPageShell>;
}
