-- One-time production date configuration for the 2026-2027 club season.
-- Safe to rerun after success. Run only after confirming the selected Turso
-- database and creating a current backup branch.
--
-- Approved values:
-- - Invitation window: Nov 8, 2026 at 6:00 PM through Nov 30 at 11:59 PM Pacific
-- - Season bounds: Dec 1, 2026 through May 31, 2027
-- - Standard offer response: three calendar days, applied when offers are created
--
-- This does not activate the season or enable registration.
BEGIN IMMEDIATE;

CREATE TEMP TABLE "__tvvc_club_season_date_guard" (
  ok integer NOT NULL CHECK (ok = 1)
);

CREATE TEMP TABLE "__tvvc_club_season_date_context" (
  admin_user_id text NOT NULL,
  before_start_date text,
  before_end_date text
);

INSERT INTO "__tvvc_club_season_date_context" (
  admin_user_id, before_start_date, before_end_date
)
SELECT audit.admin_user_id, season.season_start_date, season.season_end_date
FROM "club_seasons" season
JOIN (
  SELECT admin_user_id
  FROM "club_season_admin_audit_log"
  WHERE action = 'registration_window_updated'
    AND entity_type = 'club_season'
    AND entity_id = '2026-2027-club'
  ORDER BY created_at DESC, id DESC
  LIMIT 1
) audit
WHERE season.id = '2026-2027-club';

-- Refuse unexpected season state, invitation timestamps, or conflicting dates.
INSERT INTO "__tvvc_club_season_date_guard" (ok)
SELECT CASE WHEN
  (SELECT count(*) FROM "__tvvc_club_season_date_context") = 1
  AND EXISTS (
    SELECT 1
    FROM "club_seasons"
    WHERE id = '2026-2027-club'
      AND status = 'draft'
      AND registration_opens_at = '2026-11-09T02:00:00.000Z'
      AND registration_closes_at = '2026-12-01T07:59:00.000Z'
      AND public_registration_enabled = 0
      AND (season_start_date IS NULL OR season_start_date = '2026-12-01')
      AND (season_end_date IS NULL OR season_end_date = '2027-05-31')
  )
  THEN 1 ELSE 0 END;

UPDATE "club_seasons"
SET season_start_date = '2026-12-01',
    season_end_date = '2027-05-31',
    updated_at = CURRENT_TIMESTAMP
WHERE id = '2026-2027-club';

INSERT INTO "club_season_admin_audit_log" (
  id, admin_user_id, action, entity_type, entity_id, reason,
  before_snapshot, after_snapshot, created_at
)
SELECT
  lower(hex(randomblob(16))),
  context.admin_user_id,
  'season_dates_configured',
  'club_season',
  '2026-2027-club',
  'Approved 2026-2027 season dates and three-calendar-day standard offer response period.',
  json_object(
    'seasonStartDate', context.before_start_date,
    'seasonEndDate', context.before_end_date
  ),
  json_object(
    'seasonStartDate', '2026-12-01',
    'seasonEndDate', '2027-05-31',
    'standardOfferResponseDays', 3
  ),
  CURRENT_TIMESTAMP
FROM "__tvvc_club_season_date_context" context
WHERE NOT EXISTS (
  SELECT 1
  FROM "club_season_admin_audit_log"
  WHERE action = 'season_dates_configured'
    AND entity_type = 'club_season'
    AND entity_id = '2026-2027-club'
    AND json_extract(after_snapshot, '$.seasonStartDate') = '2026-12-01'
    AND json_extract(after_snapshot, '$.seasonEndDate') = '2027-05-31'
    AND json_extract(after_snapshot, '$.standardOfferResponseDays') = 3
);

INSERT INTO "__tvvc_club_season_date_guard" (ok)
SELECT CASE WHEN
  EXISTS (
    SELECT 1 FROM "club_seasons"
    WHERE id = '2026-2027-club'
      AND season_start_date = '2026-12-01'
      AND season_end_date = '2027-05-31'
      AND status = 'draft'
      AND public_registration_enabled = 0
  )
  AND (
    SELECT count(*)
    FROM "club_season_admin_audit_log"
    WHERE action = 'season_dates_configured'
      AND entity_type = 'club_season'
      AND entity_id = '2026-2027-club'
      AND json_extract(after_snapshot, '$.seasonStartDate') = '2026-12-01'
      AND json_extract(after_snapshot, '$.seasonEndDate') = '2027-05-31'
      AND json_extract(after_snapshot, '$.standardOfferResponseDays') = 3
  ) = 1
  THEN 1 ELSE 0 END;

DROP TABLE "__tvvc_club_season_date_context";
DROP TABLE "__tvvc_club_season_date_guard";
COMMIT;
