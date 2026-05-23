"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
        // ChunkLoadError = JS chunks invalidated after a deployment → force reload
        if (
            error.name === 'ChunkLoadError' ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Failed to fetch dynamically imported module')
        ) {
            window.location.reload();
        }
    }, [error]);

    return (
        <html lang="fr">
            <body style={{ backgroundColor: "#F5F3EF", fontFamily: "sans-serif", margin: 0 }}>
                <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
                    <h1 style={{ fontSize: "22px", fontWeight: 500, color: "#1C1C1C", margin: "0 0 8px" }}>
                        Une erreur critique est survenue
                    </h1>
                    <p style={{ fontSize: "14px", color: "#6B6B6B", maxWidth: "280px", margin: "0 0 32px" }}>
                        L'application a rencontré un problème inattendu.
                    </p>
                    <button
                        onClick={reset}
                        style={{ padding: "10px 24px", backgroundColor: "#1C1C1C", color: "#F5F3EF", fontSize: "14px", fontWeight: 500, borderRadius: "8px", border: "none", cursor: "pointer" }}
                    >
                        Réessayer
                    </button>
                </main>
            </body>
        </html>
    );
}
