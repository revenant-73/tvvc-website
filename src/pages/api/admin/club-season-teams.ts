import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { clubAgeGroups, clubSeasons, clubTeams } from '../../../db/schema';
import { requireAdminApiSession } from '../../../lib/admin-auth';

export const prerender = false;

const teamName = z.string()
  .trim()
  .min(1, 'Team name is required.')
  .max(80, 'Team name must be 80 characters or fewer.')
  .transform((value) => value.replace(/\s+/g, ' '));

const billingDayOverride = z.number()
  .int()
  .min(1)
  .max(31)
  .nullable()
  .optional();

const createTeamSchema = z.object({
  seasonId: z.string().trim().min(1),
  ageGroupId: z.string().trim().min(1),
  name: teamName,
  active: z.boolean().default(false),
  billingDayOverride,
}).strict();

const updateTeamSchema = z.object({
  id: z.string().trim().min(1),
  ageGroupId: z.string().trim().min(1).optional(),
  name: teamName.optional(),
  billingDayOverride,
  active: z.boolean().optional(),
}).strict().refine(
  ({ id: _id, ...updates }) => Object.values(updates).some((value) => value !== undefined),
  { message: 'At least one team field must be updated.' }
);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validationError(error: z.ZodError): Response {
  return json({
    error: error.issues[0]?.message || 'Invalid team details.',
    details: error.flatten().fieldErrors,
  }, 400);
}

function isUniqueConstraintError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (
      candidate.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (typeof candidate.message === 'string' && candidate.message.includes('UNIQUE constraint failed'))
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;

    const parsed = createTeamSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);

    const { db } = authorization;
    const { seasonId, ageGroupId, name, active, billingDayOverride: dayOverride } = parsed.data;
    const [season] = await db.select({ id: clubSeasons.id })
      .from(clubSeasons)
      .where(eq(clubSeasons.id, seasonId))
      .limit(1);
    if (!season) return json({ error: 'Club season not found.' }, 404);

    const [ageGroup] = await db.select({ id: clubAgeGroups.id })
      .from(clubAgeGroups)
      .where(and(
        eq(clubAgeGroups.id, ageGroupId),
        eq(clubAgeGroups.seasonId, seasonId),
        eq(clubAgeGroups.active, true)
      ))
      .limit(1);
    if (!ageGroup) return json({ error: 'Active age group not found for this season.' }, 400);

    const now = new Date().toISOString();
    const [team] = await db.insert(clubTeams).values({
      id: crypto.randomUUID(),
      seasonId,
      ageGroupId,
      name,
      billingDayOverride: dayOverride ?? null,
      active,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return json({ team }, 201);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return json({ error: 'A team with that name already exists in this season.' }, 409);
    }
    console.error('Create club season team error:', error);
    return json({ error: 'Unable to create the team.' }, 500);
  }
};
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;

    const parsed = updateTeamSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);

    const { db } = authorization;
    const { id, ...requestedUpdates } = parsed.data;
    const [existingTeam] = await db.select()
      .from(clubTeams)
      .where(eq(clubTeams.id, id))
      .limit(1);
    if (!existingTeam) return json({ error: 'Team not found.' }, 404);

    if (requestedUpdates.ageGroupId) {
      const [ageGroup] = await db.select({ id: clubAgeGroups.id })
        .from(clubAgeGroups)
        .where(and(
          eq(clubAgeGroups.id, requestedUpdates.ageGroupId),
          eq(clubAgeGroups.seasonId, existingTeam.seasonId),
          eq(clubAgeGroups.active, true)
        ))
        .limit(1);
      if (!ageGroup) return json({ error: 'Active age group not found for this season.' }, 400);
    }

    const updates = {
      ...(requestedUpdates.name !== undefined ? { name: requestedUpdates.name } : {}),
      ...(requestedUpdates.ageGroupId !== undefined ? { ageGroupId: requestedUpdates.ageGroupId } : {}),
      ...(requestedUpdates.billingDayOverride !== undefined
        ? { billingDayOverride: requestedUpdates.billingDayOverride }
        : {}),
      ...(requestedUpdates.active !== undefined ? { active: requestedUpdates.active } : {}),
      updatedAt: new Date().toISOString(),
    };

    const [team] = await db.update(clubTeams)
      .set(updates)
      .where(eq(clubTeams.id, id))
      .returning();

    return json({ team });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return json({ error: 'A team with that name already exists in this season.' }, 409);
    }
    console.error('Update club season team error:', error);
    return json({ error: 'Unable to update the team.' }, 500);
  }
};
