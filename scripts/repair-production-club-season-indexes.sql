-- One-time production schema reconciliation for tvvc-registration.
-- Restores the ten indexes present in committed migrations but absent from
-- production. Safe to rerun after success. Run on the backup branch first.
BEGIN IMMEDIATE;

CREATE UNIQUE INDEX IF NOT EXISTS `club_age_groups_season_code_unique`
  ON `club_age_groups` (`season_id`, `code`);
CREATE INDEX IF NOT EXISTS `club_age_groups_pricing_tier_id_idx`
  ON `club_age_groups` (`pricing_tier_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `club_pricing_tiers_season_key_unique`
  ON `club_pricing_tiers` (`season_id`, `key`);
CREATE INDEX IF NOT EXISTS `club_pricing_tiers_active_idx`
  ON `club_pricing_tiers` (`active`);

CREATE INDEX IF NOT EXISTS `club_season_agreements_status_idx`
  ON `club_season_agreement_versions` (`status`);
CREATE UNIQUE INDEX IF NOT EXISTS `club_season_agreements_one_published_key_unique`
  ON `club_season_agreement_versions` (`season_id`, `key`)
  WHERE `status` = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS `club_season_payment_transactions_event_unique`
  ON `club_season_payment_transactions` (`stripe_event_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `club_season_payment_transactions_session_unique`
  ON `club_season_payment_transactions` (`stripe_checkout_session_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `club_season_payment_transactions_intent_unique`
  ON `club_season_payment_transactions` (`stripe_payment_intent_id`);
CREATE INDEX IF NOT EXISTS `club_season_payment_transactions_registration_id_idx`
  ON `club_season_payment_transactions` (`registration_id`);

COMMIT;
