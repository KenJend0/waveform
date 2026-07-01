'use client';

import { useState } from 'react';
import Image from 'next/image';

type CoverImageProps = {
  /** Primary URL — CoverArt Archive release-group URL (browser follows 307 redirect) */
  src: string;
  /** Fallback URL — tried if primary returns 404/error (e.g. release-specific URL) */
  fallback?: string;
  /** Rendered when both primary and fallback fail */
  placeholder: React.ReactNode;
  alt: string;
  /** Required when fill is not set */
  width?: number;
  /** Required when fill is not set */
  height?: number;
  className?: string;
  /** Use CSS fill layout (parent must be position:relative) */
  fill?: boolean;
  loading?: 'lazy' | 'eager';
};

/**
 * Image component with a two-stage fallback chain for MusicBrainz covers.
 *
 * Stage 1: src (release-group CoverArt Archive URL)
 * Stage 2: fallback (release-specific CoverArt Archive URL) — only if provided
 * Stage 3: placeholder node (icon, text, etc.)
 *
 * Using key={src} forces a fresh Image instance when the source changes,
 * which is necessary to reset the error state and trigger a new load.
 */
export function CoverImage({
  src,
  fallback,
  placeholder,
  alt,
  width,
  height,
  className,
  fill,
  loading,
}: CoverImageProps) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);

  if (failed) return <>{placeholder}</>;

  const handleError = () => {
    if (current === src && fallback) {
      setCurrent(fallback);
    } else {
      setFailed(true);
    }
  };

  if (fill) {
    return (
      <Image
        key={current}
        src={current}
        alt={alt}
        fill
        className={className}
        loading={loading}
        onError={handleError}
        unoptimized
      />
    );
  }

  return (
    <Image
      key={current}
      src={current}
      alt={alt}
      width={width ?? 0}
      height={height ?? 0}
      className={className}
      loading={loading}
      onError={handleError}
      unoptimized
    />
  );
}
