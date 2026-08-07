export default async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CLUB_SEASON_CRON_SECRET;
  if (!siteUrl || !secret) {
    console.error('Club-season billing trigger is missing URL or CLUB_SEASON_CRON_SECRET.');
    return new Response(null, { status: 500 });
  }

  const response = await fetch(`${siteUrl}/.netlify/functions/club-season-billing-worker`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!response.ok) throw new Error(`Club-season billing worker returned ${response.status}.`);
  return new Response(null, { status: 202 });
};

export const config = { schedule: '0 16 * * *' };
