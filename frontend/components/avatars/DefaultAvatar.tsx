import { getAvatarIndex } from "@/lib/getAvatarIndex";
import * as Avatars from "./avatars";

const AVATAR_COMPONENTS = [
  Avatars.Avatar01,
  Avatars.Avatar02,
  Avatars.Avatar03,
  Avatars.Avatar04,
  Avatars.Avatar05,
  Avatars.Avatar06,
  Avatars.Avatar07,
  Avatars.Avatar08,
  Avatars.Avatar09,
  Avatars.Avatar10,
  Avatars.Avatar11,
  Avatars.Avatar12,
];

interface UserAvatarProps {
  userId: string;
  src?: string | null;
  size?: number;
  className?: string;
}

/**
 * Avatar utilisateur — affiche la vraie photo (src) si disponible, sinon SVG déterministe.
 * Size in pixels (default: 18)
 */
export function UserAvatar({ userId, src, size = 18, className = "" }: UserAvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const index = getAvatarIndex(userId);
  const Component = AVATAR_COMPONENTS[index];

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center opacity-60 ${className}`}
      style={{ width: size, height: size }}
    >
      {Component && <Component />}
    </div>
  );
}

export function DefaultAvatars() {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-6">
      {AVATAR_COMPONENTS.map((Component, index) => (
        <div key={index} className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 bg-background rounded-[10px] p-3 flex items-center justify-center">
            <Component />
          </div>
          <span className="text-label text-text-tertiary">avatar-{String(index + 1).padStart(2, "0")}</span>
        </div>
      ))}
    </div>
  );
}

