export function getSafeCallbackUrl(
  requestedUrl: string | null,
  fallback = '/portal/dashboard'
): string {
  if (!requestedUrl?.startsWith('/')) {
    return fallback;
  }

  try {
    const baseUrl = new URL('https://tvvc.invalid');
    const callbackUrl = new URL(requestedUrl, baseUrl);
    const allowedPath = /^\/(?:portal|admin|season-registration)(?:\/|$)/.test(callbackUrl.pathname);

    if (callbackUrl.origin !== baseUrl.origin || !allowedPath) {
      return fallback;
    }

    return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
  } catch {
    return fallback;
  }
}
