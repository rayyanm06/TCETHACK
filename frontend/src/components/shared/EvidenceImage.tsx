import React, { useState, useEffect } from 'react';
import { resolveMediaUrl, formatEvidenceRole } from '../../lib/media.ts';
import { Camera, AlertCircle, RefreshCw, Maximize2, X, ZoomIn } from 'lucide-react';

interface EvidenceImageProps {
  src?: string | null;
  alt: string;
  roleBadge?: 'PRIMARY' | 'SUPPORTING' | 'CLOSURE' | 'SPECIALIST' | string;
  caption?: string;
  className?: string;
  imageClassName?: string;
  allowLightbox?: boolean;
  aspectRatio?: 'video' | 'square' | 'wide' | 'auto';
  objectFit?: 'cover' | 'contain';
  onClick?: () => void;
}

export const EvidenceImage: React.FC<EvidenceImageProps> = ({
  src,
  alt,
  roleBadge,
  caption,
  className = '',
  imageClassName = '',
  allowLightbox = true,
  aspectRatio = 'auto',
  objectFit = 'cover',
  onClick,
}) => {
  const resolvedUrl = resolveMediaUrl(src);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [resolvedUrl, retryCount]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    if (allowLightbox && resolvedUrl && !error) {
      e.stopPropagation();
      setLightboxOpen(true);
    }
  };

  const getAspectClass = () => {
    switch (aspectRatio) {
      case 'video':
        return 'aspect-video';
      case 'wide':
        return 'aspect-[16/10]';
      case 'square':
        return 'aspect-square';
      default:
        return '';
    }
  };

  const getBadgeStyle = () => {
    switch (roleBadge?.toUpperCase()) {
      case 'PRIMARY':
        return 'bg-moss text-surface';
      case 'SUPPORTING':
        return 'bg-lagoon text-surface';
      case 'CLOSURE':
        return 'bg-moss-700 text-surface';
      case 'SPECIALIST':
        return 'bg-plum text-surface';
      default:
        return 'bg-ink/80 text-surface';
    }
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded bg-surface-2 border border-line ${getAspectClass()} ${className}`}
        onClick={handleImageClick}
      >
        {/* Loading Skeleton */}
        {loading && resolvedUrl && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2 animate-pulse z-10">
            <Camera className="w-5 h-5 text-ink-3/40 animate-bounce" />
          </div>
        )}

        {/* Missing / Error State */}
        {(!resolvedUrl || error) && (
          <div className="w-full h-full min-h-[96px] flex flex-col items-center justify-center p-3 text-center bg-surface-2 text-ink-3 space-y-1.5">
            <AlertCircle className="w-5 h-5 text-ink-3/60 stroke-[1.5]" />
            <p className="text-[11px] font-medium text-ink-3 leading-tight">
              {!resolvedUrl ? 'No photograph attached' : 'Evidence image unavailable'}
            </p>
            {resolvedUrl && (
              <button
                type="button"
                onClick={handleRetry}
                className="mt-1 px-2 py-0.5 text-[10px] font-semibold text-moss bg-surface border border-line rounded hover:bg-surface-2 flex items-center gap-1 shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* Real Decoded Image */}
        {resolvedUrl && !error && (
          <img
            key={`${resolvedUrl}-${retryCount}`}
            src={resolvedUrl}
            alt={alt}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            className={`w-full h-full ${
              objectFit === 'contain' ? 'object-contain' : 'object-cover'
            } ${allowLightbox ? 'cursor-pointer' : ''} ${imageClassName}`}
          />
        )}

        {/* Role Badge Overlay */}
        {roleBadge && !error && resolvedUrl && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none">
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm ${getBadgeStyle()}`}
            >
              {formatEvidenceRole(roleBadge)}
            </span>
          </div>
        )}

        {/* Lightbox Trigger Hint */}
        {allowLightbox && resolvedUrl && !error && !loading && (
          <div className="absolute bottom-2 right-2 opacity-0 hover:opacity-100 transition-opacity bg-ink/70 text-surface p-1 rounded backdrop-blur-xs pointer-events-none">
            <ZoomIn className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Optional Caption */}
        {caption && (
          <div className="p-1.5 bg-surface text-[10px] text-ink-3 border-t border-line truncate">
            {caption}
          </div>
        )}
      </div>

      {/* Lightbox Modal (Full view without destructive cropping) */}
      {lightboxOpen && resolvedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-50 bg-ink/90 flex flex-col items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-60">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full bg-surface/20 text-surface hover:bg-surface/40 transition"
              title="Close full view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="max-w-4xl max-h-[85vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolvedUrl}
              alt={alt}
              className="max-h-[75vh] max-w-full object-contain rounded shadow-2xl border border-surface/20"
            />
            <div className="mt-3 text-center text-surface text-xs space-y-0.5">
              <p className="font-semibold">{alt}</p>
              {roleBadge && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-moss-300">
                  {formatEvidenceRole(roleBadge)}
                </span>
              )}
              {caption && <p className="text-[11px] text-surface/80">{caption}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
