-- One-time production data reconciliation for the 2026-2027 club season.
-- Safe to rerun after success. Run only after confirming the selected Turso
-- database and creating a current backup branch.
--
-- This intentionally does not create teams, set registration dates, activate
-- the season, or enable registration.
BEGIN IMMEDIATE;

CREATE TEMP TABLE "__tvvc_club_season_foundation_guard" (
  ok integer NOT NULL CHECK (ok = 1)
);

-- Refuse to modify an unexpected season or overwrite conflicting foundation data.
INSERT INTO "__tvvc_club_season_foundation_guard" (ok)
SELECT CASE WHEN
  EXISTS (
    SELECT 1
    FROM "club_seasons"
    WHERE "id" = '2026-2027-club'
      AND "status" = 'draft'
      AND "timezone" = 'America/Los_Angeles'
      AND "default_billing_day" = 5
      AND "first_installment_date" = '2027-01-05'
      AND "standard_installment_count" = 5
      AND "public_registration_enabled" = 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "club_pricing_tiers"
    WHERE "season_id" = '2026-2027-club'
      AND NOT (
        ("id" = 'tier-2026-2027-12u' AND "key" = '12u' AND "name" = '12U'
          AND "total_amount" = 120000 AND "deposit_amount" = 30000
          AND "installment_amount" = 18000 AND "active" = 1 AND "sort_order" = 10)
        OR
        ("id" = 'tier-2026-2027-13u-18u' AND "key" = '13u-18u' AND "name" = '13U-18U'
          AND "total_amount" = 150000 AND "deposit_amount" = 40000
          AND "installment_amount" = 22000 AND "active" = 1 AND "sort_order" = 20)
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "club_age_groups"
    WHERE "season_id" = '2026-2027-club'
      AND NOT (
        ("id" = 'age-2026-2027-12u' AND "pricing_tier_id" = 'tier-2026-2027-12u' AND "code" = '12U' AND "label" = '12U' AND "active" = 1 AND "sort_order" = 12)
        OR ("id" = 'age-2026-2027-13u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '13U' AND "label" = '13U' AND "active" = 1 AND "sort_order" = 13)
        OR ("id" = 'age-2026-2027-14u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '14U' AND "label" = '14U' AND "active" = 1 AND "sort_order" = 14)
        OR ("id" = 'age-2026-2027-15u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '15U' AND "label" = '15U' AND "active" = 1 AND "sort_order" = 15)
        OR ("id" = 'age-2026-2027-16u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '16U' AND "label" = '16U' AND "active" = 1 AND "sort_order" = 16)
        OR ("id" = 'age-2026-2027-17u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '17U' AND "label" = '17U' AND "active" = 1 AND "sort_order" = 17)
        OR ("id" = 'age-2026-2027-18u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '18U' AND "label" = '18U' AND "active" = 1 AND "sort_order" = 18)
      )
  )
  THEN 1 ELSE 0 END;

INSERT OR IGNORE INTO "club_pricing_tiers" (
  "id", "season_id", "key", "name", "total_amount", "deposit_amount",
  "installment_amount", "active", "sort_order"
) VALUES
  ('tier-2026-2027-12u', '2026-2027-club', '12u', '12U', 120000, 30000, 18000, 1, 10),
  ('tier-2026-2027-13u-18u', '2026-2027-club', '13u-18u', '13U-18U', 150000, 40000, 22000, 1, 20);

INSERT OR IGNORE INTO "club_age_groups" (
  "id", "season_id", "pricing_tier_id", "code", "label", "active", "sort_order"
) VALUES
  ('age-2026-2027-12u', '2026-2027-club', 'tier-2026-2027-12u', '12U', '12U', 1, 12),
  ('age-2026-2027-13u', '2026-2027-club', 'tier-2026-2027-13u-18u', '13U', '13U', 1, 13),
  ('age-2026-2027-14u', '2026-2027-club', 'tier-2026-2027-13u-18u', '14U', '14U', 1, 14),
  ('age-2026-2027-15u', '2026-2027-club', 'tier-2026-2027-13u-18u', '15U', '15U', 1, 15),
  ('age-2026-2027-16u', '2026-2027-club', 'tier-2026-2027-13u-18u', '16U', '16U', 1, 16),
  ('age-2026-2027-17u', '2026-2027-club', 'tier-2026-2027-13u-18u', '17U', '17U', 1, 17),
  ('age-2026-2027-18u', '2026-2027-club', 'tier-2026-2027-13u-18u', '18U', '18U', 1, 18);

-- Verify the exact expected foundation before committing.
INSERT INTO "__tvvc_club_season_foundation_guard" (ok)
SELECT CASE WHEN
  (SELECT count(*) FROM "club_pricing_tiers" WHERE "season_id" = '2026-2027-club') = 2
  AND (SELECT count(*) FROM "club_age_groups" WHERE "season_id" = '2026-2027-club') = 7
  AND (SELECT count(*) FROM "club_pricing_tiers" WHERE "season_id" = '2026-2027-club' AND "active" = 1) = 2
  AND (SELECT count(*) FROM "club_age_groups" WHERE "season_id" = '2026-2027-club' AND "active" = 1) = 7
  THEN 1 ELSE 0 END;

DROP TABLE "__tvvc_club_season_foundation_guard";
COMMIT;
