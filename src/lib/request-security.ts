/**
 * Astro's built-in origin check does not cover application/json requests.
 * Portal APIs use cookie-backed sessions, so validate browser write requests
 * explicitly before reading or mutating user data.
 */
export function rejectCrossOriginRequest(request: Request): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  if (origin && origin !== requestUrl.origin) {
    return new Response(JSON.stringify({ error: 'Invalid request origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return new Response(JSON.stringify({ error: 'Cross-site requests are not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}
