"use client";
import { useState, useCallback } from "react";
import Cropper, { Point, Area } from "react-easy-crop";

interface AvatarCropModalProps {
    imageSrc: string;
    onComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

export default function AvatarCropModal({ imageSrc, onComplete, onCancel }: AvatarCropModalProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createCroppedImage = async () => {
        if (!croppedAreaPixels) return;

        const image = new Image();
        image.src = imageSrc;
        await new Promise((resolve) => {
            image.onload = resolve;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // DÃ©finir la taille du canvas circulaire
        const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height);
        canvas.width = size;
        canvas.height = size;

        // CrÃ©er un cercle pour le masque
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();

        // Dessiner l'image croppÃ©e
        ctx.drawImage(
            image,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            size,
            size
        );

        // Convertir en blob
        canvas.toBlob((blob) => {
            if (blob) {
                onComplete(blob);
            }
        }, "image/jpeg", 0.95);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1C1C]/20">
            <div className="bg-background rounded-[12px] p-6 max-w-lg w-full mx-4 border border-border">
                <h2 className="text-body font-medium font-sans text-text-primary mb-4">Rogner l'avatar</h2>
                
                <div className="relative h-80 mb-4 bg-background-secondary rounded-[10px] border border-border">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-[12px] text-text-secondary mb-2">Zoom</label>
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={createCroppedImage}
                        className="flex-1 px-4 py-2 bg-[#1C1C1C] hover:opacity-85 text-[#F5F3EF] text-[14px] font-medium transition-opacity duration-150 rounded-[8px]"
                    >
                        Valider
                    </button>
                </div>
            </div>
        </div>
    );
}

