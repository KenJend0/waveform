export default function Loading() {
    return (
        <main className="p-6 pb-20 max-w-page mx-auto">
            <div className="max-w-md mx-auto text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8E6F5E] mx-auto mb-4" />
                <p className="text-text-secondary text-[14px]">Chargement de votre profil...</p>
            </div>
        </main>
    );
}
