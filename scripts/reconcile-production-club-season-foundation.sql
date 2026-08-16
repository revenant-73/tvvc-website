-- One-time production data reconciliation for the 2026-2027 club season.
-- Safe to rerun after success. Run only after confirming the selected Turso
-- database and creating a current backup branch.
--
-- This creates the approved inactive team catalog. It intentionally does not
-- set registration dates, activate the season, or enable registration.
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
        ("id" = 'tier-2026-2027-12u' AND "key" = '12u' AND "name" IN ('12U', '10U-12U')
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
        ("id" = 'age-2026-2027-10u' AND "pricing_tier_id" = 'tier-2026-2027-12u' AND "code" = '10U' AND "label" = '10U' AND "active" = 1 AND "sort_order" = 10)
        OR ("id" = 'age-2026-2027-11u' AND "pricing_tier_id" = 'tier-2026-2027-12u' AND "code" = '11U' AND "label" = '11U' AND "active" = 1 AND "sort_order" = 11)
        OR ("id" = 'age-2026-2027-12u' AND "pricing_tier_id" = 'tier-2026-2027-12u' AND "code" = '12U' AND "label" = '12U' AND "active" = 1 AND "sort_order" = 12)
        OR ("id" = 'age-2026-2027-13u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '13U' AND "label" = '13U' AND "active" = 1 AND "sort_order" = 13)
        OR ("id" = 'age-2026-2027-14u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '14U' AND "label" = '14U' AND "active" = 1 AND "sort_order" = 14)
        OR ("id" = 'age-2026-2027-15u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '15U' AND "label" = '15U' AND "active" = 1 AND "sort_order" = 15)
        OR ("id" = 'age-2026-2027-16u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '16U' AND "label" = '16U' AND "active" = 1 AND "sort_order" = 16)
        OR ("id" = 'age-2026-2027-17u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '17U' AND "label" = '17U' AND "active" = 1 AND "sort_order" = 17)
        OR ("id" = 'age-2026-2027-18u' AND "pricing_tier_id" = 'tier-2026-2027-13u-18u' AND "code" = '18U' AND "label" = '18U' AND "active" = 1 AND "sort_order" = 18)
      )
  )
  THEN 1 ELSE 0 END;

-- Expand the lower-age tier label without changing its stable key or ID.
UPDATE "club_pricing_tiers"
SET "name" = '10U-12U'
WHERE "id" = 'tier-2026-2027-12u'
  AND "season_id" = '2026-2027-club'
  AND "name" = '12U';

INSERT OR IGNORE INTO "club_pricing_tiers" (
  "id", "season_id", "key", "name", "total_amount", "deposit_amount",
  "installment_amount", "active", "sort_order"
) VALUES
  ('tier-2026-2027-12u', '2026-2027-club', '12u', '10U-12U', 120000, 30000, 18000, 1, 10),
  ('tier-2026-2027-13u-18u', '2026-2027-club', '13u-18u', '13U-18U', 150000, 40000, 22000, 1, 20);

INSERT OR IGNORE INTO "club_age_groups" (
  "id", "season_id", "pricing_tier_id", "code", "label", "active", "sort_order"
) VALUES
  ('age-2026-2027-10u', '2026-2027-club', 'tier-2026-2027-12u', '10U', '10U', 1, 10),
  ('age-2026-2027-11u', '2026-2027-club', 'tier-2026-2027-12u', '11U', '11U', 1, 11),
  ('age-2026-2027-12u', '2026-2027-club', 'tier-2026-2027-12u', '12U', '12U', 1, 12),
  ('age-2026-2027-13u', '2026-2027-club', 'tier-2026-2027-13u-18u', '13U', '13U', 1, 13),
  ('age-2026-2027-14u', '2026-2027-club', 'tier-2026-2027-13u-18u', '14U', '14U', 1, 14),
  ('age-2026-2027-15u', '2026-2027-club', 'tier-2026-2027-13u-18u', '15U', '15U', 1, 15),
  ('age-2026-2027-16u', '2026-2027-club', 'tier-2026-2027-13u-18u', '16U', '16U', 1, 16),
  ('age-2026-2027-17u', '2026-2027-club', 'tier-2026-2027-13u-18u', '17U', '17U', 1, 17),
  ('age-2026-2027-18u', '2026-2027-club', 'tier-2026-2027-13u-18u', '18U', '18U', 1, 18);

INSERT OR IGNORE INTO "club_teams" (
  "id", "season_id", "age_group_id", "name", "active"
) VALUES
  ('team-2026-2027-10u-teal', '2026-2027-club', 'age-2026-2027-10u', '10 Teal', 0),
  ('team-2026-2027-10u-coral', '2026-2027-club', 'age-2026-2027-10u', '10 Coral', 0),
  ('team-2026-2027-10u-black', '2026-2027-club', 'age-2026-2027-10u', '10 Black', 0),
  ('team-2026-2027-10u-white', '2026-2027-club', 'age-2026-2027-10u', '10 White', 0),
  ('team-2026-2027-11u-teal', '2026-2027-club', 'age-2026-2027-11u', '11 Teal', 0),
  ('team-2026-2027-11u-coral', '2026-2027-club', 'age-2026-2027-11u', '11 Coral', 0),
  ('team-2026-2027-11u-black', '2026-2027-club', 'age-2026-2027-11u', '11 Black', 0),
  ('team-2026-2027-11u-white', '2026-2027-club', 'age-2026-2027-11u', '11 White', 0),
  ('team-2026-2027-12u-teal', '2026-2027-club', 'age-2026-2027-12u', '12 Teal', 0),
  ('team-2026-2027-12u-coral', '2026-2027-club', 'age-2026-2027-12u', '12 Coral', 0),
  ('team-2026-2027-12u-black', '2026-2027-club', 'age-2026-2027-12u', '12 Black', 0),
  ('team-2026-2027-12u-white', '2026-2027-club', 'age-2026-2027-12u', '12 White', 0),
  ('team-2026-2027-13u-teal', '2026-2027-club', 'age-2026-2027-13u', '13 Teal', 0),
  ('team-2026-2027-13u-coral', '2026-2027-club', 'age-2026-2027-13u', '13 Coral', 0),
  ('team-2026-2027-13u-black', '2026-2027-club', 'age-2026-2027-13u', '13 Black', 0),
  ('team-2026-2027-13u-white', '2026-2027-club', 'age-2026-2027-13u', '13 White', 0),
  ('team-2026-2027-14u-teal', '2026-2027-club', 'age-2026-2027-14u', '14 Teal', 0),
  ('team-2026-2027-14u-coral', '2026-2027-club', 'age-2026-2027-14u', '14 Coral', 0),
  ('team-2026-2027-14u-black', '2026-2027-club', 'age-2026-2027-14u', '14 Black', 0),
  ('team-2026-2027-14u-white', '2026-2027-club', 'age-2026-2027-14u', '14 White', 0),
  ('team-2026-2027-15u-teal', '2026-2027-club', 'age-2026-2027-15u', '15 Teal', 0),
  ('team-2026-2027-15u-coral', '2026-2027-club', 'age-2026-2027-15u', '15 Coral', 0),
  ('team-2026-2027-15u-black', '2026-2027-club', 'age-2026-2027-15u', '15 Black', 0),
  ('team-2026-2027-15u-white', '2026-2027-club', 'age-2026-2027-15u', '15 White', 0),
  ('team-2026-2027-16u-teal', '2026-2027-club', 'age-2026-2027-16u', '16 Teal', 0),
  ('team-2026-2027-16u-coral', '2026-2027-club', 'age-2026-2027-16u', '16 Coral', 0),
  ('team-2026-2027-16u-black', '2026-2027-club', 'age-2026-2027-16u', '16 Black', 0),
  ('team-2026-2027-16u-white', '2026-2027-club', 'age-2026-2027-16u', '16 White', 0),
  ('team-2026-2027-17u-teal', '2026-2027-club', 'age-2026-2027-17u', '17 Teal', 0),
  ('team-2026-2027-17u-coral', '2026-2027-club', 'age-2026-2027-17u', '17 Coral', 0),
  ('team-2026-2027-17u-black', '2026-2027-club', 'age-2026-2027-17u', '17 Black', 0),
  ('team-2026-2027-17u-white', '2026-2027-club', 'age-2026-2027-17u', '17 White', 0),
  ('team-2026-2027-18u-teal', '2026-2027-club', 'age-2026-2027-18u', '18 Teal', 0),
  ('team-2026-2027-18u-coral', '2026-2027-club', 'age-2026-2027-18u', '18 Coral', 0),
  ('team-2026-2027-18u-black', '2026-2027-club', 'age-2026-2027-18u', '18 Black', 0),
  ('team-2026-2027-18u-white', '2026-2027-club', 'age-2026-2027-18u', '18 White', 0);

-- Verify the exact expected foundation before committing.
INSERT INTO "__tvvc_club_season_foundation_guard" (ok)
SELECT CASE WHEN
  (SELECT count(*) FROM "club_pricing_tiers" WHERE "season_id" = '2026-2027-club') = 2
  AND (SELECT count(*) FROM "club_age_groups" WHERE "season_id" = '2026-2027-club') = 9
  AND (SELECT count(*) FROM "club_pricing_tiers" WHERE "season_id" = '2026-2027-club' AND "active" = 1) = 2
  AND (SELECT count(*) FROM "club_age_groups" WHERE "season_id" = '2026-2027-club' AND "active" = 1) = 9
  AND (SELECT count(*) FROM "club_teams"
       WHERE "season_id" = '2026-2027-club'
         AND "id" LIKE 'team-2026-2027-%'
         AND "name" IN (
           '10 Teal', '10 Coral', '10 Black', '10 White',
           '11 Teal', '11 Coral', '11 Black', '11 White',
           '12 Teal', '12 Coral', '12 Black', '12 White',
           '13 Teal', '13 Coral', '13 Black', '13 White',
           '14 Teal', '14 Coral', '14 Black', '14 White',
           '15 Teal', '15 Coral', '15 Black', '15 White',
           '16 Teal', '16 Coral', '16 Black', '16 White',
           '17 Teal', '17 Coral', '17 Black', '17 White',
           '18 Teal', '18 Coral', '18 Black', '18 White'
         )
         AND "age_group_id" = 'age-2026-2027-' || lower(substr("name", 1, instr("name", ' ') - 1)) || 'u'
         AND "id" = 'team-2026-2027-' || lower(substr("name", 1, instr("name", ' ') - 1)) || 'u-' || lower(substr("name", instr("name", ' ') + 1))
         AND "active" = 0
         AND "billing_day_override" IS NULL
         AND "acceptance_deadline_override" IS NULL) = 36
  THEN 1 ELSE 0 END;

DROP TABLE "__tvvc_club_season_foundation_guard";
COMMIT;
