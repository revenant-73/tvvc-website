import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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
  
  starred: integer('starred', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- Summer 2026 Registration System ---

export const events = sqliteTable('events', {
  id: text('id').primaryKey(), // e.g., 'camp-foundations-june'
  type: text('type').notNull(), // 'camp' or 'clinic'
  name: text('name').notNull(),
  description: text('description'),
  dateInfo: text('date_info').notNull(), // e.g., 'June 15–17'
  timeInfo: text('time_info'), // e.g., '8:00am–12:00pm'
  price: integer('price').notNull(), // in cents (Stripe style)
  capacity: integer('capacity').notNull(),
  spotsFilled: integer('spots_filled').default(0),
  active: integer('active', { mode: 'boolean' }).default(true),
});

export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(),
  parentName: text('parent_name').notNull(),
  parentEmail: text('parent_email').notNull(),
  parentPhone: text('parent_phone').notNull(),
  stripeSessionId: text('stripe_session_id'),
  status: text('status').default('pending'), // pending, paid, cancelled
  totalAmount: integer('total_amount').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const athletes = sqliteTable('athletes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  registrationId: text('registration_id').references(() => registrations.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  grade: text('grade').notNull(), // Entering grade
  division: text('division'), // New field for outdoor tournaments
  tshirtSize: text('tshirt_size'), // Present in DB
  medicalInfo: text('medical_info'),
  waiverAgreed: integer('waiver_agreed', { mode: 'boolean' }).default(false),
  photoReleaseAgreed: integer('photo_release_agreed', { mode: 'boolean' }).default(false),
});

export const registrationItems = sqliteTable('registration_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  registrationId: text('registration_id').references(() => registrations.id),
  athleteId: integer('athlete_id').references(() => athletes.id),
  eventId: text('event_id').references(() => events.id),
});
