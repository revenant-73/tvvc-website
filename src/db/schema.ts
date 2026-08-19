import { sqliteTable, text, integer, primaryKey, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Authentication Tables (Auth.js) ---

export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: integer('email_verified', { mode: 'timestamp_ms' }),
  image: text('image'),
  role: text('role').default('user'), // 'user', 'admin'
  stripeCustomerId: text('stripe_customer_id'),
  emergencyPhone: text('emergency_phone'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    emailIdx: index('user_email_idx').on(table.email),
  };
});

export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable('session', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verification_token',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// --- Core Site Tables ---

export const feedback = sqliteTable('feedback', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Section 1: Who are you?
  userType: text('user_type').notNull(),
  team: text('team').notNull(),
  anonymous: text('anonymous').notNull(),
  name: text('name'),
  
  // Section 2: Overall Experience
  overallRating: integer('overall_rating').notNull(),
  bestParts: text('best_parts'),
  frustratingParts: text('frustrating_parts'),
  keepDoing: text('keep_doing'),
  considerChanging: text('consider_changing'),
  
  // Section 3: Coaching & Team Environment
  coachingPositive: integer('coaching_positive').notNull(),
  coachingGrowth: integer('coaching_growth').notNull(),
  practicesUseful: integer('practices_useful').notNull(),
  encouragedProblemSolving: integer('encouraged_problem_solving').notNull(),
  coachingWell: text('coaching_well'),
  coachingImprove: text('coaching_improve'),
  teamEnvironment: text('team_environment'),
  
  // Section 4: Communication & Organization
  clubCommunication: integer('club_communication').notNull(),
  teamCommunication: integer('team_communication').notNull(),
  easyToUnderstand: integer('easy_to_understand').notNull(),
  communicationWell: text('communication_well'),
  communicationImprove: text('communication_improve'),
  confusionMoments: text('confusion_moments'),
  
  // Section 5: Cost, Value, and Club Experience
  goodValue: integer('good_value').notNull(),
  timeCommitment: integer('time_commitment').notNull(),
  tournamentSchedule: integer('tournament_schedule').notNull(),
  betterValue: text('better_value'),
  unclearLogistics: text('unclear_logistics'),
  
  // Section 6: Player Growth
  volleyballGrowth: integer('volleyball_growth').notNull(),
  personalGrowth: integer('personal_growth').notNull(),
  noticeableGrowth: text('noticeable_growth'),
  supportNeeded: text('support_needed'),
  
  // Section 7: Future Direction
  returnLikelihood: integer('return_likelihood').notNull(),
  returnIncentive: text('return_incentive'),
  additionalOpportunities: text('additional_opportunities'), // Stored as JSON string
  importantOpportunities: text('important_opportunities'),
  futureHope: text('future_hope'),
  
  // Section 8: Final Thoughts
  leadershipUnderstanding: text('leadership_understanding'),
  appreciation: text('appreciation'),
  advice: text('advice'),
  anythingElse: text('anything_else'),
  
  // Metadata & Status
  userId: text('user_id').references(() => users.id), // Link feedback to user if logged in
  metadata: text('metadata'), // JSON blob for extensible data
  starred: integer('starred', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    userIdIdx: index('feedback_user_id_idx').on(table.userId),
  };
});

// New table for more granular feedback analysis
export const feedbackAnswers = sqliteTable('feedback_answers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  feedbackId: integer('feedback_id').references(() => feedback.id),
  questionKey: text('question_key').notNull(),
  answerValue: text('answer_value').notNull(),
  category: text('category'), // e.g., 'coaching', 'communication'
}, (table) => {
  return {
    feedbackIdIdx: index('feedback_answers_feedback_id_idx').on(table.feedbackId),
  };
});

// --- Summer 2026 Registration System ---

export const events = sqliteTable('events', {
  id: text('id').primaryKey(), // e.g., 'camp-foundations-june'
  parentId: text('parent_id'), // For grouping related events (e.g., all Small Group Training blocks)
  type: text('type').notNull(), // 'camp', 'clinic', 'tournament', 'training-block'
  name: text('name').notNull(),
  description: text('description'),
  dateInfo: text('date_info').notNull(), // e.g., 'June 15–17'
  timeInfo: text('time_info'), // e.g., '8:00am–12:00pm'
  startDate: text('start_date'), // YYYY-MM-DD for sorting/scheduling
  endDate: text('end_date'), // YYYY-MM-DD
  price: integer('price').notNull(), // in cents (Stripe style)
  capacity: integer('capacity').notNull(),
  spotsFilled: integer('spots_filled').default(0),
  pendingSpots: integer('pending_spots').default(0),
  active: integer('active', { mode: 'boolean' }).default(true),
  emailDetails: text('email_details'), // Custom details for registration emails
  metadata: text('metadata'), // For any event-specific config
}, (table) => {
  return {
    parentIdIdx: index('events_parent_id_idx').on(table.parentId),
    typeIdx: index('events_type_idx').on(table.type),
    startDateIdx: index('events_start_date_idx').on(table.startDate),
  };
});

// --- Club Season Registration Foundation ---

export const clubSeasons = sqliteTable('club_seasons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'), // draft, active, archived
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  defaultBillingDay: integer('default_billing_day').notNull().default(5),
  firstInstallmentDate: text('first_installment_date').notNull(), // YYYY-MM-DD
  standardInstallmentCount: integer('standard_installment_count').notNull().default(5),
  registrationOpensAt: text('registration_opens_at'),
  registrationClosesAt: text('registration_closes_at'),
  seasonStartDate: text('season_start_date'),
  seasonEndDate: text('season_end_date'),
  publicRegistrationEnabled: integer('public_registration_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  statusIdx: index('club_seasons_status_idx').on(table.status),
}));

export const clubPricingTiers = sqliteTable('club_pricing_tiers', {
  id: text('id').primaryKey(),
  seasonId: text('season_id')
    .notNull()
    .references(() => clubSeasons.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  totalAmount: integer('total_amount').notNull(),
  depositAmount: integer('deposit_amount').notNull(),
  installmentAmount: integer('installment_amount').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  seasonKeyUnique: uniqueIndex('club_pricing_tiers_season_key_unique')
    .on(table.seasonId, table.key),
  seasonIdIdx: index('club_pricing_tiers_season_id_idx').on(table.seasonId),
  activeIdx: index('club_pricing_tiers_active_idx').on(table.active),
}));

export const clubAgeGroups = sqliteTable('club_age_groups', {
  id: text('id').primaryKey(),
  seasonId: text('season_id')
    .notNull()
    .references(() => clubSeasons.id, { onDelete: 'cascade' }),
  pricingTierId: text('pricing_tier_id')
    .notNull()
    .references(() => clubPricingTiers.id),
  code: text('code').notNull(),
  label: text('label').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  seasonCodeUnique: uniqueIndex('club_age_groups_season_code_unique')
    .on(table.seasonId, table.code),
  seasonIdIdx: index('club_age_groups_season_id_idx').on(table.seasonId),
  pricingTierIdIdx: index('club_age_groups_pricing_tier_id_idx').on(table.pricingTierId),
  activeIdx: index('club_age_groups_active_idx').on(table.active),
}));

export const clubTeams = sqliteTable('club_teams', {
  id: text('id').primaryKey(),
  seasonId: text('season_id')
    .notNull()
    .references(() => clubSeasons.id, { onDelete: 'cascade' }),
  ageGroupId: text('age_group_id')
    .notNull()
    .references(() => clubAgeGroups.id),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  billingDayOverride: integer('billing_day_override'),
  acceptanceDeadlineOverride: text('acceptance_deadline_override'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  seasonNameUnique: uniqueIndex('club_teams_season_name_unique')
    .on(table.seasonId, table.name),
  seasonIdIdx: index('club_teams_season_id_idx').on(table.seasonId),
  ageGroupIdIdx: index('club_teams_age_group_id_idx').on(table.ageGroupId),
  activeIdx: index('club_teams_active_idx').on(table.active),
}));

export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id), // Link registration to parent account
  parentName: text('parent_name').notNull(),
  parentEmail: text('parent_email').notNull(),
  parentPhone: text('parent_phone').notNull(),
  secondaryParentName: text('secondary_parent_name'),
  secondaryParentEmail: text('secondary_parent_email'),
  secondaryParentPhone: text('secondary_parent_phone'),
  emergencyPhone: text('emergency_phone'),
  stripeSessionId: text('stripe_session_id'),
  stripeCustomerId: text('stripe_customer_id'), // Store Stripe customer ID directly on registration too
  status: text('status').default('pending'), // pending, paid, cancelled
  needsReview: integer('needs_review', { mode: 'boolean' }).default(false),
  totalAmount: integer('total_amount').notNull(),
  metadata: text('metadata'), // For storing promo codes or other info
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    parentEmailIdx: index('registrations_parent_email_idx').on(table.parentEmail),
    userIdIdx: index('registrations_user_id_idx').on(table.userId),
    stripeSessionIdIdx: index('registrations_stripe_session_id_idx').on(table.stripeSessionId),
  };
});

// Explicit, revocable view-only access to a primary parent's household.
export const householdGuardians = sqliteTable('household_guardians', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id),
  guardianEmail: text('guardian_email').notNull(),
  guardianUserId: text('guardian_user_id').references(() => users.id),
  status: text('status').notNull().default('pending'), // pending, active, revoked
  invitedAt: text('invited_at').default(sql`CURRENT_TIMESTAMP`),
  acceptedAt: text('accepted_at'),
  revokedAt: text('revoked_at'),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    ownerEmailUnique: uniqueIndex('household_guardians_owner_email_unique')
      .on(table.ownerUserId, table.guardianEmail),
    ownerUserIdIdx: index('household_guardians_owner_user_id_idx').on(table.ownerUserId),
    guardianEmailIdx: index('household_guardians_guardian_email_idx').on(table.guardianEmail),
    guardianUserIdIdx: index('household_guardians_guardian_user_id_idx').on(table.guardianUserId),
    statusIdx: index('household_guardians_status_idx').on(table.status),
  };
});

// Editable, parent-owned player records used to prefill future registrations.
export const playerProfiles = sqliteTable('player_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  parentId: text('parent_id').notNull().references(() => users.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  preferredName: text('preferred_name'),
  dateOfBirth: text('date_of_birth'),
  gender: text('gender'),
  grade: text('grade').notNull(),
  school: text('school'),
  gradYear: text('grad_year'),
  division: text('division'),
  tshirtSize: text('tshirt_size'),
  jerseySize: text('jersey_size'),
  experience: text('experience'),
  positions: text('positions'),
  medicalInfo: text('medical_info'),
  metadata: text('metadata'),
  archivedAt: text('archived_at'),
  mergedIntoProfileId: integer('merged_into_profile_id')
    .references((): AnySQLiteColumn => playerProfiles.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    parentIdIdx: index('player_profiles_parent_id_idx').on(table.parentId),
    archivedAtIdx: index('player_profiles_archived_at_idx').on(table.archivedAt),
    mergedIntoProfileIdIdx: index('player_profiles_merged_into_profile_id_idx').on(table.mergedIntoProfileId),
  };
});

// Immutable registration-time snapshots used by orders, rosters, and receipts.
export const athletes = sqliteTable('athletes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  registrationId: text('registration_id').references(() => registrations.id),
  parentId: text('parent_id').references(() => users.id), // Canonical owner at registration time
  profileId: integer('profile_id').references(() => playerProfiles.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  preferredName: text('preferred_name'),
  dateOfBirth: text('date_of_birth'),
  gender: text('gender'),
  grade: text('grade').notNull(), // Entering grade
  school: text('school'),
  gradYear: text('grad_year'),
  division: text('division'), // New field for outdoor tournaments
  tshirtSize: text('tshirt_size'), // Present in DB
  jerseySize: text('jersey_size'),
  experience: text('experience'),
  positions: text('positions'),
  medicalInfo: text('medical_info'),
  waiverAgreed: integer('waiver_agreed', { mode: 'boolean' }).default(false),
  photoReleaseAgreed: integer('photo_release_agreed', { mode: 'boolean' }).default(false),
  metadata: text('metadata'), // JSON blob for extensible data (Jersey Size, Partner Name, etc.)
}, (table) => {
  return {
    parentIdIdx: index('athletes_parent_id_idx').on(table.parentId),
    registrationIdIdx: index('athletes_registration_id_idx').on(table.registrationId),
    profileIdIdx: index('athletes_profile_id_idx').on(table.profileId),
  };
});

export const registrationItems = sqliteTable('registration_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  registrationId: text('registration_id').references(() => registrations.id),
  athleteId: integer('athlete_id').references(() => athletes.id),
  eventId: text('event_id').references(() => events.id),
}, (table) => {
  return {
    registrationIdIdx: index('registration_items_registration_id_idx').on(table.registrationId),
    athleteIdIdx: index('registration_items_athlete_id_idx').on(table.athleteId),
    eventIdIdx: index('registration_items_event_id_idx').on(table.eventId),
  };
});

// An offer is the authorization boundary for the shared club-season link.
// The URL is shared; eligibility is not. Each row anchors an offer to the
// immutable athlete snapshot created by a paid tryout registration.
export const clubSeasonOffers = sqliteTable('club_season_offers', {
  id: text('id').primaryKey(),
  seasonId: text('season_id')
    .notNull()
    .references(() => clubSeasons.id, { onDelete: 'cascade' }),
  teamId: text('team_id')
    .notNull()
    .references(() => clubTeams.id),
  sourceRegistrationId: text('source_registration_id')
    .notNull()
    .references(() => registrations.id),
  sourceAthleteId: integer('source_athlete_id')
    .notNull()
    .references(() => athletes.id),
  sourceProfileId: integer('source_profile_id')
    .references(() => playerProfiles.id),
  recipientEmail: text('recipient_email').notNull(),
  recipientUserId: text('recipient_user_id').references(() => users.id),
  status: text('status').notNull().default('offered'),
  acceptanceDeadline: text('acceptance_deadline'), // YYYY-MM-DD, inclusive in club time
  declineReason: text('decline_reason'),
  declineDetails: text('decline_details'),
  // Remains null while an administrator prepares/reviews a draft. It is set
  // only by the later release workflow when the family can actually see it.
  offeredAt: text('offered_at'),
  viewedAt: text('viewed_at'),
  respondedAt: text('responded_at'),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  seasonAthleteUnique: uniqueIndex('club_season_offers_season_athlete_unique')
    .on(table.seasonId, table.sourceAthleteId),
  seasonIdIdx: index('club_season_offers_season_id_idx').on(table.seasonId),
  teamIdIdx: index('club_season_offers_team_id_idx').on(table.teamId),
  sourceRegistrationIdIdx: index('club_season_offers_source_registration_id_idx')
    .on(table.sourceRegistrationId),
  recipientEmailIdx: index('club_season_offers_recipient_email_idx').on(table.recipientEmail),
  recipientUserIdIdx: index('club_season_offers_recipient_user_id_idx').on(table.recipientUserId),
  statusIdx: index('club_season_offers_status_idx').on(table.status),
}));

// Invitation releases and delivery attempts are append-only operational
// evidence. A release batch freezes the exact family-facing terms; delivery
// attempts record notification outcomes without rewriting the offer itself.
export const clubSeasonInvitationBatches = sqliteTable('club_season_invitation_batches', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => clubSeasons.id),
  teamId: text('team_id').references(() => clubTeams.id),
  wave: text('wave').notNull(),
  kind: text('kind').notNull(), // release, test
  status: text('status').notNull().default('prepared'),
  subject: text('subject').notNull(),
  templateFingerprint: text('template_fingerprint').notNull(),
  requestIdempotencyKey: text('request_idempotency_key').notNull(),
  requestFingerprint: text('request_fingerprint').notNull(),
  adminUserId: text('admin_user_id').notNull().references(() => users.id),
  auditReason: text('audit_reason').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  releasedAt: text('released_at'),
  completedAt: text('completed_at'),
}, (table) => ({
  requestKeyUnique: uniqueIndex('club_season_invitation_batches_request_key_unique').on(table.requestIdempotencyKey),
  seasonWaveIdx: index('club_season_invitation_batches_season_wave_idx').on(table.seasonId, table.wave),
  teamIdIdx: index('club_season_invitation_batches_team_id_idx').on(table.teamId),
  statusIdx: index('club_season_invitation_batches_status_idx').on(table.status),
  createdAtIdx: index('club_season_invitation_batches_created_at_idx').on(table.createdAt),
}));

export const clubSeasonInvitationBatchItems = sqliteTable('club_season_invitation_batch_items', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => clubSeasonInvitationBatches.id),
  offerId: text('offer_id').notNull().references(() => clubSeasonOffers.id),
  recipientEmail: text('recipient_email').notNull(),
  parentName: text('parent_name').notNull(),
  playerName: text('player_name').notNull(),
  teamName: text('team_name').notNull(),
  acceptanceDeadline: text('acceptance_deadline').notNull(),
  totalAmount: integer('total_amount').notNull(),
  depositAmount: integer('deposit_amount').notNull(),
  installmentAmount: integer('installment_amount').notNull(),
  installmentCount: integer('installment_count').notNull(),
  scheduleSnapshot: text('schedule_snapshot').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  batchOfferUnique: uniqueIndex('club_season_invitation_items_batch_offer_unique').on(table.batchId, table.offerId),
  batchIdIdx: index('club_season_invitation_items_batch_id_idx').on(table.batchId),
  offerIdIdx: index('club_season_invitation_items_offer_id_idx').on(table.offerId),
  recipientIdx: index('club_season_invitation_items_recipient_idx').on(table.recipientEmail),
}));

export const clubSeasonInvitationDeliveryAttempts = sqliteTable('club_season_invitation_delivery_attempts', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => clubSeasonInvitationBatches.id),
  batchItemId: text('batch_item_id').references(() => clubSeasonInvitationBatchItems.id),
  attemptNumber: integer('attempt_number').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  status: text('status').notNull().default('pending'),
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  adminUserId: text('admin_user_id').notNull().references(() => users.id),
  attemptedAt: text('attempted_at').notNull(),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  itemAttemptUnique: uniqueIndex('club_season_invitation_attempts_item_number_unique').on(table.batchItemId, table.attemptNumber),
  idempotencyKeyUnique: uniqueIndex('club_season_invitation_attempts_idempotency_unique').on(table.idempotencyKey),
  batchStatusIdx: index('club_season_invitation_attempts_batch_status_idx').on(table.batchId, table.status),
  itemIdIdx: index('club_season_invitation_attempts_item_id_idx').on(table.batchItemId),
  attemptedAtIdx: index('club_season_invitation_attempts_attempted_at_idx').on(table.attemptedAt),
}));

// Family-entered information is saved separately from offer eligibility so
// later agreement and payment records can remain immutable and auditable.
export const clubSeasonRegistrations = sqliteTable('club_season_registrations', {
  id: text('id').primaryKey(),
  offerId: text('offer_id')
    .notNull()
    .references(() => clubSeasonOffers.id),
  seasonId: text('season_id')
    .notNull()
    .references(() => clubSeasons.id),
  teamId: text('team_id')
    .notNull()
    .references(() => clubTeams.id),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  playerProfileId: integer('player_profile_id').references(() => playerProfiles.id),
  status: text('status').notNull().default('draft'),
  currentStep: integer('current_step').notNull().default(1),
  draftData: text('draft_data'),
  draftSchemaVersion: integer('draft_schema_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  startedAt: text('started_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSavedAt: text('last_saved_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  submittedAt: text('submitted_at'),
  acceptedAt: text('accepted_at'),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  offerIdUnique: uniqueIndex('club_season_registrations_offer_id_unique').on(table.offerId),
  seasonIdIdx: index('club_season_registrations_season_id_idx').on(table.seasonId),
  teamIdIdx: index('club_season_registrations_team_id_idx').on(table.teamId),
  ownerUserIdIdx: index('club_season_registrations_owner_user_id_idx').on(table.ownerUserId),
  statusIdx: index('club_season_registrations_status_idx').on(table.status),
}));

// Agreement wording is versioned so a future policy edit never changes the
// text a family actually reviewed. Only published versions appear in a draft.
export const clubSeasonAgreementVersions = sqliteTable('club_season_agreement_versions', {
  id: text('id').primaryKey(),
  seasonId: text('season_id')
    .notNull()
    .references(() => clubSeasons.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  body: text('body').notNull(),
  contentHash: text('content_hash').notNull(),
  responseType: text('response_type').notNull().default('acknowledgement'),
  allowedResponses: text('allowed_responses'), // JSON array for choice agreements
  status: text('status').notNull().default('draft'), // draft, published, retired
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  effectiveAt: text('effective_at'),
  publishedAt: text('published_at'),
  retiredAt: text('retired_at'),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  seasonKeyVersionUnique: uniqueIndex('club_season_agreements_season_key_version_unique')
    .on(table.seasonId, table.key, table.version),
  seasonIdIdx: index('club_season_agreements_season_id_idx').on(table.seasonId),
  statusIdx: index('club_season_agreements_status_idx').on(table.status),
}));

// Each acceptance stores both the agreement reference and an immutable text
// snapshot. This is evidence, not editable registration-form state.
export const clubSeasonAgreementAcceptances = sqliteTable('club_season_agreement_acceptances', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id')
    .notNull()
    .references(() => clubSeasonRegistrations.id),
  agreementVersionId: text('agreement_version_id')
    .notNull()
    .references(() => clubSeasonAgreementVersions.id),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  agreementKeySnapshot: text('agreement_key_snapshot').notNull(),
  agreementTitleSnapshot: text('agreement_title_snapshot').notNull(),
  agreementBodySnapshot: text('agreement_body_snapshot').notNull(),
  agreementContentHash: text('agreement_content_hash').notNull(),
  response: text('response').notNull(),
  acceptedName: text('accepted_name').notNull(),
  acceptedEmail: text('accepted_email').notNull(),
  requestIpHash: text('request_ip_hash'),
  userAgent: text('user_agent'),
  contextSnapshot: text('context_snapshot').notNull(),
  acceptedAt: text('accepted_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  registrationVersionUnique: uniqueIndex('club_season_acceptances_registration_version_unique')
    .on(table.registrationId, table.agreementVersionId),
  registrationIdIdx: index('club_season_acceptances_registration_id_idx')
    .on(table.registrationId),
  ownerUserIdIdx: index('club_season_acceptances_owner_user_id_idx').on(table.ownerUserId),
}));

// A registration has one logical payment plan. Later accommodations create a
// new immutable version instead of rewriting the schedule a family accepted.
export const clubSeasonPaymentPlans = sqliteTable('club_season_payment_plans', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id')
    .notNull()
    .references(() => clubSeasonRegistrations.id),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  status: text('status').notNull().default('pending_checkout'),
  financialStatus: text('financial_status').notNull().default('not_started'),
  currentVersion: integer('current_version').notNull().default(1),
  stripeCustomerId: text('stripe_customer_id'),
  stripePaymentMethodId: text('stripe_payment_method_id'),
  needsReview: integer('needs_review', { mode: 'boolean' }).notNull().default(false),
  activatedAt: text('activated_at'),
  completedAt: text('completed_at'),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  registrationIdUnique: uniqueIndex('club_season_payment_plans_registration_id_unique')
    .on(table.registrationId),
  ownerUserIdIdx: index('club_season_payment_plans_owner_user_id_idx').on(table.ownerUserId),
  statusIdx: index('club_season_payment_plans_status_idx').on(table.status),
}));

export const clubSeasonPaymentPlanVersions = sqliteTable('club_season_payment_plan_versions', {
  id: text('id').primaryKey(),
  paymentPlanId: text('payment_plan_id')
    .notNull()
    .references(() => clubSeasonPaymentPlans.id),
  version: integer('version').notNull(),
  paymentOption: text('payment_option').notNull(), // pay_in_full, standard_plan, custom_plan
  status: text('status').notNull().default('pending_checkout'),
  totalAmount: integer('total_amount').notNull(),
  dueNowAmount: integer('due_now_amount').notNull(),
  currency: text('currency').notNull().default('usd'),
  billingDay: integer('billing_day'),
  scheduleSnapshot: text('schedule_snapshot').notNull(),
  termsFingerprint: text('terms_fingerprint').notNull(),
  authorizationText: text('authorization_text'),
  authorizationContentHash: text('authorization_content_hash'),
  authorizedName: text('authorized_name'),
  authorizedEmail: text('authorized_email'),
  requestIpHash: text('request_ip_hash'),
  userAgent: text('user_agent'),
  authorizedAt: text('authorized_at'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  stripeCheckoutExpiresAt: text('stripe_checkout_expires_at'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  planVersionUnique: uniqueIndex('club_season_payment_plan_versions_plan_version_unique')
    .on(table.paymentPlanId, table.version),
  stripeSessionUnique: uniqueIndex('club_season_payment_plan_versions_stripe_session_unique')
    .on(table.stripeCheckoutSessionId),
  paymentPlanIdIdx: index('club_season_payment_plan_versions_plan_id_idx')
    .on(table.paymentPlanId),
  statusIdx: index('club_season_payment_plan_versions_status_idx').on(table.status),
}));

export const clubSeasonPaymentInstallments = sqliteTable('club_season_payment_installments', {
  id: text('id').primaryKey(),
  paymentPlanVersionId: text('payment_plan_version_id')
    .notNull()
    .references(() => clubSeasonPaymentPlanVersions.id),
  sequence: integer('sequence').notNull(),
  type: text('type').notNull(), // full_payment, deposit, installment
  dueDate: text('due_date').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('scheduled'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  attemptCount: integer('attempt_count').notNull().default(0),
  nextAttemptDate: text('next_attempt_date'),
  lastAttemptedAt: text('last_attempted_at'),
  lastFailureCode: text('last_failure_code'),
  lastFailureMessage: text('last_failure_message'),
  paidAt: text('paid_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  versionSequenceUnique: uniqueIndex('club_season_installments_version_sequence_unique')
    .on(table.paymentPlanVersionId, table.sequence),
  stripeIntentUnique: uniqueIndex('club_season_installments_stripe_intent_unique')
    .on(table.stripePaymentIntentId),
  paymentPlanVersionIdIdx: index('club_season_installments_plan_version_id_idx')
    .on(table.paymentPlanVersionId),
  statusIdx: index('club_season_installments_status_idx').on(table.status),
  dueDateIdx: index('club_season_installments_due_date_idx').on(table.dueDate),
}));

export const clubSeasonPaymentTransactions = sqliteTable('club_season_payment_transactions', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id')
    .notNull()
    .references(() => clubSeasonRegistrations.id),
  paymentPlanVersionId: text('payment_plan_version_id')
    .notNull()
    .references(() => clubSeasonPaymentPlanVersions.id),
  installmentId: text('installment_id')
    .notNull()
    .references(() => clubSeasonPaymentInstallments.id),
  stripeEventId: text('stripe_event_id').notNull(),
  source: text('source').notNull().default('checkout'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),
  stripeChargeId: text('stripe_charge_id'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(),
  processedAt: text('processed_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  stripeEventUnique: uniqueIndex('club_season_payment_transactions_event_unique')
    .on(table.stripeEventId),
  stripeSessionUnique: uniqueIndex('club_season_payment_transactions_session_unique')
    .on(table.stripeCheckoutSessionId),
  stripeIntentUnique: uniqueIndex('club_season_payment_transactions_intent_unique')
    .on(table.stripePaymentIntentId),
  registrationIdIdx: index('club_season_payment_transactions_registration_id_idx')
    .on(table.registrationId),
}));

export const clubSeasonPaymentAttempts = sqliteTable('club_season_payment_attempts', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id')
    .notNull()
    .references(() => clubSeasonRegistrations.id),
  paymentPlanVersionId: text('payment_plan_version_id')
    .notNull()
    .references(() => clubSeasonPaymentPlanVersions.id),
  installmentId: text('installment_id')
    .notNull()
    .references(() => clubSeasonPaymentInstallments.id),
  attemptNumber: integer('attempt_number').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('pending'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  attemptedAt: text('attempted_at').notNull(),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  installmentAttemptUnique: uniqueIndex('club_season_payment_attempts_installment_attempt_unique')
    .on(table.installmentId, table.attemptNumber),
  idempotencyKeyUnique: uniqueIndex('club_season_payment_attempts_idempotency_unique')
    .on(table.idempotencyKey),
  stripeIntentIdx: index('club_season_payment_attempts_stripe_intent_idx')
    .on(table.stripePaymentIntentId),
  statusIdx: index('club_season_payment_attempts_status_idx').on(table.status),
}));

// An administrator proposes a replacement for only the unpaid portion of an
// active plan. The old and proposed versions remain linked for a complete
// audit trail; activation requires a separate parent authorization record.
export const clubSeasonPaymentPlanRevisions = sqliteTable('club_season_payment_plan_revisions', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id').notNull().references(() => clubSeasonRegistrations.id),
  paymentPlanId: text('payment_plan_id').notNull().references(() => clubSeasonPaymentPlans.id),
  fromVersionId: text('from_version_id').notNull().references(() => clubSeasonPaymentPlanVersions.id),
  proposedVersionId: text('proposed_version_id').notNull().references(() => clubSeasonPaymentPlanVersions.id),
  status: text('status').notNull().default('pending_authorization'),
  reason: text('reason').notNull(),
  adminNote: text('admin_note'),
  proposedByUserId: text('proposed_by_user_id').notNull().references(() => users.id),
  proposedAt: text('proposed_at').notNull(),
  reviewedAt: text('reviewed_at'),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  proposedVersionUnique: uniqueIndex('club_season_plan_revisions_proposed_version_unique').on(table.proposedVersionId),
  onePendingPerPlan: uniqueIndex('club_season_plan_revisions_one_pending')
    .on(table.paymentPlanId)
    .where(sql`${table.status} = 'pending_authorization'`),
  paymentPlanIdIdx: index('club_season_plan_revisions_plan_id_idx').on(table.paymentPlanId),
  registrationIdIdx: index('club_season_plan_revisions_registration_id_idx').on(table.registrationId),
  statusIdx: index('club_season_plan_revisions_status_idx').on(table.status),
}));

export const clubSeasonPaymentPlanAuthorizations = sqliteTable('club_season_payment_plan_authorizations', {
  id: text('id').primaryKey(),
  paymentPlanVersionId: text('payment_plan_version_id').notNull().references(() => clubSeasonPaymentPlanVersions.id),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id),
  authorizationText: text('authorization_text').notNull(),
  authorizationContentHash: text('authorization_content_hash').notNull(),
  authorizedName: text('authorized_name').notNull(),
  authorizedEmail: text('authorized_email').notNull(),
  requestIpHash: text('request_ip_hash'),
  userAgent: text('user_agent'),
  authorizedAt: text('authorized_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  versionUnique: uniqueIndex('club_season_plan_authorizations_version_unique').on(table.paymentPlanVersionId),
  ownerUserIdIdx: index('club_season_plan_authorizations_owner_id_idx').on(table.ownerUserId),
}));

export const clubSeasonAdminAuditLog = sqliteTable('club_season_admin_audit_log', {
  id: text('id').primaryKey(),
  adminUserId: text('admin_user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  reason: text('reason'),
  beforeSnapshot: text('before_snapshot'),
  afterSnapshot: text('after_snapshot'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  adminUserIdIdx: index('club_season_admin_audit_admin_id_idx').on(table.adminUserId),
  entityIdx: index('club_season_admin_audit_entity_idx').on(table.entityType, table.entityId),
  createdAtIdx: index('club_season_admin_audit_created_at_idx').on(table.createdAt),
}));

// Human-verified launch evidence is append-only and separate from deployment
// switches. Recording a check never enables parent access or changes keys.
export const clubSeasonLaunchEvidence = sqliteTable('club_season_launch_evidence', {
  id: text('id').primaryKey(),
  seasonId: text('season_id').notNull().references(() => clubSeasons.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // resend_domain, stripe_live_review, controlled_pilot
  evidenceReference: text('evidence_reference').notNull(),
  checksSnapshot: text('checks_snapshot'),
  recordedByUserId: text('recorded_by_user_id').notNull().references(() => users.id),
  recordedAt: text('recorded_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  seasonTypeUnique: uniqueIndex('club_season_launch_evidence_season_type_unique').on(table.seasonId, table.type),
  seasonIdIdx: index('club_season_launch_evidence_season_id_idx').on(table.seasonId),
  recordedByIdx: index('club_season_launch_evidence_recorded_by_idx').on(table.recordedByUserId),
}));

// Manual financial activity is append-only. Corrections create an explicit
// counter-entry so cash, credits, write-offs, and refunds remain auditable.
export const clubSeasonFinancialAdjustments = sqliteTable('club_season_financial_adjustments', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id').notNull().references(() => clubSeasonRegistrations.id),
  paymentPlanId: text('payment_plan_id').notNull().references(() => clubSeasonPaymentPlans.id),
  transactionId: text('transaction_id').references(() => clubSeasonPaymentTransactions.id),
  type: text('type').notNull(), // offline_payment, credit, write_off, stripe_refund, reversal
  amount: integer('amount').notNull(),
  balanceEffect: integer('balance_effect').notNull(), // signed cents; negative lowers amount due
  effectiveDate: text('effective_date').notNull(),
  reason: text('reason').notNull(),
  note: text('note'),
  stripeRefundId: text('stripe_refund_id'),
  reversesAdjustmentId: text('reverses_adjustment_id').references((): AnySQLiteColumn => clubSeasonFinancialAdjustments.id),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  registrationIdIdx: index('club_season_adjustments_registration_id_idx').on(table.registrationId),
  paymentPlanIdIdx: index('club_season_adjustments_plan_id_idx').on(table.paymentPlanId),
  transactionIdIdx: index('club_season_adjustments_transaction_id_idx').on(table.transactionId),
  stripeRefundUnique: uniqueIndex('club_season_adjustments_stripe_refund_unique').on(table.stripeRefundId),
  reversalUnique: uniqueIndex('club_season_adjustments_reversal_unique').on(table.reversesAdjustmentId),
  createdAtIdx: index('club_season_adjustments_created_at_idx').on(table.createdAt),
}));

export const clubSeasonEmailDeliveries = sqliteTable('club_season_email_deliveries', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id')
    .notNull()
    .references(() => clubSeasonRegistrations.id),
  installmentId: text('installment_id')
    .references(() => clubSeasonPaymentInstallments.id),
  type: text('type').notNull(),
  recipient: text('recipient').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  status: text('status').notNull().default('pending'),
  providerMessageId: text('provider_message_id'),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastError: text('last_error'),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  idempotencyKeyUnique: uniqueIndex('club_season_email_deliveries_idempotency_unique')
    .on(table.idempotencyKey),
  registrationIdIdx: index('club_season_email_deliveries_registration_id_idx')
    .on(table.registrationId),
  installmentIdIdx: index('club_season_email_deliveries_installment_id_idx')
    .on(table.installmentId),
  statusIdx: index('club_season_email_deliveries_status_idx').on(table.status),
}));

