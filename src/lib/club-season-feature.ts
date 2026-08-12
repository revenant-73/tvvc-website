function environmentValue(name: string): string {
  const viteEnvironment = typeof import.meta.env !== 'undefined'
    ? ({
        CLUB_SEASON_REGISTRATION_ENABLED: import.meta.env.CLUB_SEASON_REGISTRATION_ENABLED,
        CLUB_SEASON_PILOT_MODE: import.meta.env.CLUB_SEASON_PILOT_MODE,
        CLUB_SEASON_PILOT_EMAILS: import.meta.env.CLUB_SEASON_PILOT_EMAILS,
        STRIPE_SECRET_KEY: import.meta.env.STRIPE_SECRET_KEY,
      } as Record<string, string | undefined>)[name]
    : undefined;
  const nodeEnvironment = typeof process !== 'undefined'
    ? process.env[name]
    : undefined;
  return String(viteEnvironment || nodeEnvironment || '');
}

export function isClubSeasonRegistrationEnabled(): boolean {
  const value = environmentValue('CLUB_SEASON_REGISTRATION_ENABLED') || 'false';

  return String(value).toLowerCase() === 'true';
}

export function isClubSeasonBillingSimulatorAvailable(): boolean {
  return (
    !isClubSeasonRegistrationEnabled()
    && environmentValue('CLUB_SEASON_PILOT_MODE').toLowerCase() === 'true'
    && environmentValue('STRIPE_SECRET_KEY').startsWith('sk_test_')
  );
}

/**
 * A pilot account may enter while both public-access locks remain closed, but
 * only when the deployment explicitly enables pilot mode and Stripe is using
 * a test secret key. Switching Stripe to live mode automatically kills this
 * bypass even if the allowlist is accidentally left configured.
 */
export function isClubSeasonPilotAccess(email?: string | null): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;
  if (isClubSeasonRegistrationEnabled()) return false;
  if (environmentValue('CLUB_SEASON_PILOT_MODE').toLowerCase() !== 'true') return false;
  if (!environmentValue('STRIPE_SECRET_KEY').startsWith('sk_test_')) return false;

  const allowlist = environmentValue('CLUB_SEASON_PILOT_EMAILS')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(normalizedEmail);
}

export function canAccessClubSeasonRegistration(
  email: string | null | undefined,
  publicRegistrationEnabled: boolean
): boolean {
  return (
    isClubSeasonRegistrationEnabled() && publicRegistrationEnabled
  ) || (!publicRegistrationEnabled && isClubSeasonPilotAccess(email));
}

export function isClubSeasonRouteAvailable(email?: string | null): boolean {
  return isClubSeasonRegistrationEnabled() || isClubSeasonPilotAccess(email);
}
