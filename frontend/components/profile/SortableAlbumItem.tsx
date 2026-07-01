"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { CoverImage } from "@/components/album/CoverImage";

type Album = {
  id: string;
  title: string;
  artist_name: string;
  cover_url?: string;
  position: number;
};

type Props = {
  album: Album;
  onRemove: (albumId: string) => void;
};

export default function SortableAlbumItem({ album, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: album.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-background-secondary rounded-[10px] transition-opacity duration-150 ${
        isDragging ? "opacity-50 bg-background-tertiary" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-background-tertiary rounded-[8px] transition-colors duration-150"
      >
        <GripVertical size={20} className="text-text-secondary" />
      </button>

      <div className="flex-shrink-0 font-medium text-[#8E6F5E] w-8 text-center">
        #{album.position}
      </div>

      {album.cover_url && (
        <div className="flex-shrink-0 w-12 h-12 rounded-[8px] overflow-hidden relative">
          <CoverImage src={album.cover_url} alt={album.title} fill className="object-cover" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-meta font-medium truncate">{album.title}</p>
        <p className="text-label text-text-secondary truncate">{album.artist_name}</p>
      </div>

      <button
        onClick={() => onRemove(album.id)}
        className="flex-shrink-0 p-1 hover:bg-[#C86C6C]/20 hover:text-[#C86C6C] rounded-[8px] transition-colors duration-150"
      >
        <X size={20} />
      </button>
    </div>
  );
}

