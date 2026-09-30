/**
 * CivicClean Unified Media URL Resolver
 * Ensures evidence images resolve to the correct media/backend origin
 * regardless of whether stored as relative /uploads paths, Cloudinary URLs, or temporary previews.
 */

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Preserve absolute HTTP/HTTPS URLs (e.g. Cloudinary, external CDN)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Preserve local temporary preview URLs (blob: or data:) for live preview only
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Normalize relative paths: strip accidental /api/ prefix
  let cleanPath = trimmed;
  if (cleanPath.startsWith('/api/uploads')) {
    cleanPath = cleanPath.replace('/api/uploads', '/uploads');
  } else if (cleanPath.startsWith('api/uploads')) {
    cleanPath = cleanPath.replace('api/uploads', '/uploads');
  }

  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }

  // Derive media/backend origin from configured VITE_API_BASE_URL
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

  let backendOrigin = '';
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      const parsed = new URL(apiBase);
      backendOrigin = parsed.origin;
    } catch {
      backendOrigin = apiBase.replace(/\/api\/?$/, '');
    }
  } else {
    // Relative API path (/api), resolve against current origin or default port 4000 in dev
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      backendOrigin = 'http://localhost:4000';
    } else if (typeof window !== 'undefined') {
      backendOrigin = window.location.origin;
    }
  }

  return `${backendOrigin}${cleanPath}`;
}

export function formatEvidenceRole(role?: string | null): string {
  switch (role?.toUpperCase()) {
    case 'PRIMARY':
      return 'Primary Evidence';
    case 'SUPPORTING':
      return 'Supporting Photo';
    case 'CLOSURE':
      return 'Clearance Record';
    case 'SPECIALIST':
      return 'Specialist Transfer';
    default:
      return 'Field Evidence';
  }
}
