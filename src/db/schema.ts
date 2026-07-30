import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
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
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    parentIdIdx: index('player_profiles_parent_id_idx').on(table.parentId),
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

