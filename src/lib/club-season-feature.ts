export function isClubSeasonRegistrationEnabled(): boolean {
  const value =
    (typeof import.meta.env !== 'undefined'
      ? import.meta.env.CLUB_SEASON_REGISTRATION_ENABLED
      : undefined) ||
    (typeof process !== 'undefined'
      ? process.env.CLUB_SEASON_REGISTRATION_ENABLED
      : undefined) ||
    'false';

  return String(value).toLowerCase() === 'true';
}
