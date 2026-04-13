import Image from "next/image";
import Link from "next/link";
import { type ForYouAlbum } from "@/app/actions/explore";

export default function PourToiSection({ albums }: { albums: ForYouAlbum[] }) {
    if (albums.length === 0) return null;

    const gridClassName = albums.length === 3
        ? "grid-cols-1 lg:grid-cols-[repeat(3,minmax(0,15rem))]"
        : "grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,15rem))]";

    return (
        <section>
            <h2 className="text-h2 text-text-primary mb-5">Pour toi</h2>
            <div className={`grid gap-3 lg:gap-4 ${gridClassName}`}>
                {albums.map((album, idx) => (
                    <Link
                        key={album.album_id}
                        href={`/albums/${album.album_id}`}
                        className={`group flex items-center gap-3 hover:opacity-75 transition-opacity duration-150 ${
                            albums.length !== 3 && albums.length % 2 !== 0 && idx === albums.length - 1 ? "col-span-2 lg:col-span-1" : ""
                        }`}
                    >
                        <div className="w-12 h-12 rounded-[6px] overflow-hidden bg-background-secondary flex-shrink-0 relative">
                            {album.cover_url ? (
                                <Image
                                    src={album.cover_url}
                                    alt={album.title}
                                    fill
                                    className="object-cover"
                                    sizes="48px"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-full h-full bg-background-tertiary" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13px] text-text-primary font-medium leading-snug line-clamp-2">
                                {album.title}
                            </p>
                            <p className="text-[11px] text-text-secondary truncate mt-0.5">
                                {album.artist}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
