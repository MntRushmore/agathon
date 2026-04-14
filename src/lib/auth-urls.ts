const DEFAULT_SITE_URL = 'http://localhost:3000';

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getSiteUrl(fallbackOrigin?: string): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : fallbackOrigin) ||
    DEFAULT_SITE_URL;

  return trimTrailingSlash(configuredUrl);
}

export function getLoginTokenUrl(params?: Record<string, string | undefined>): string {
  const url = new URL('/logintoken', `${getSiteUrl()}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}
