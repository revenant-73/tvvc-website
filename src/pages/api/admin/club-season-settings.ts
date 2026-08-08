import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminApiSession } from '../../../lib/admin-auth';
import {
  createAgreementDraftSchema,
  createClubSeasonAgreementDraft,
  publishAgreementSchema,
  publishClubSeasonAgreement,
  updateAgreementDraftSchema,
  updateClubSeasonAgreementDraft,
  updateClubSeasonRegistrationWindow,
  updateRegistrationWindowSchema,
} from '../../../lib/club-season-settings';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validationError(error: z.ZodError) {
  return json({
    error: error.issues[0]?.message || 'Invalid season setting.',
    details: error.flatten().fieldErrors,
  }, 400);
}

function serviceError(error: unknown) {
  if (error instanceof SyntaxError) return json({ error: 'Request body must be valid JSON.' }, 400);
  const code = error instanceof Error ? error.message : '';
  const errors: Record<string, [string, number]> = {
    SEASON_NOT_FOUND: ['Club season not found.', 404],
    INVALID_REGISTRATION_WINDOW: ['Registration must close after it opens.', 400],
    AGREEMENT_KEY_NOT_SUPPORTED: ['That agreement type is not supported.', 400],
    AGREEMENT_DRAFT_EXISTS: ['This agreement already has an editable draft.', 409],
    AGREEMENT_DRAFT_NOT_FOUND: ['The editable agreement draft was not found.', 404],
    PUBLISH_CONFIRMATION_MISMATCH: ['Type the exact publication phrase shown before publishing.', 400],
    AGREEMENT_CONTENT_HASH_MISMATCH: ['The agreement content failed its integrity check. Create a new draft before publishing.', 409],
  };
  const mapped = errors[code];
  if (mapped) return json({ error: mapped[0] }, mapped[1]);
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (
      candidate.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (typeof candidate.message === 'string' && candidate.message.includes('UNIQUE constraint failed'))
    ) {
      return json({ error: 'This agreement changed in another request. Reload and try again.' }, 409);
    }
    current = candidate.cause;
  }
  console.error('Club season settings error:', error);
  return json({ error: 'Unable to update club season settings.' }, 500);
}

export const POST: APIRoute = async ({ request }) => {
  const authorization = await requireAdminApiSession(request);
  if (!authorization.authorized) return authorization.response;
  try {
    const payload = await request.json();
    if (payload?.action === 'create_agreement_draft') {
      const parsed = createAgreementDraftSchema.safeParse(payload);
      if (!parsed.success) return validationError(parsed.error);
      const agreement = await createClubSeasonAgreementDraft(authorization.db, {
        ...parsed.data,
        adminUserId: authorization.user.id,
      });
      return json({ ok: true, agreement }, 201);
    }
    if (payload?.action === 'publish_agreement') {
      const parsed = publishAgreementSchema.safeParse(payload);
      if (!parsed.success) return validationError(parsed.error);
      const agreement = await publishClubSeasonAgreement(authorization.db, {
        ...parsed.data,
        adminUserId: authorization.user.id,
      });
      return json({ ok: true, agreement });
    }
    return json({ error: 'Unsupported season setting action.' }, 400);
  } catch (error) {
    return serviceError(error);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const authorization = await requireAdminApiSession(request);
  if (!authorization.authorized) return authorization.response;
  try {
    const payload = await request.json();
    if (payload?.action === 'update_registration_window') {
      const parsed = updateRegistrationWindowSchema.safeParse(payload);
      if (!parsed.success) return validationError(parsed.error);
      const season = await updateClubSeasonRegistrationWindow(authorization.db, {
        ...parsed.data,
        adminUserId: authorization.user.id,
      });
      return json({ ok: true, season });
    }
    if (payload?.action === 'update_agreement_draft') {
      const parsed = updateAgreementDraftSchema.safeParse(payload);
      if (!parsed.success) return validationError(parsed.error);
      const agreement = await updateClubSeasonAgreementDraft(authorization.db, {
        ...parsed.data,
        adminUserId: authorization.user.id,
      });
      return json({ ok: true, agreement });
    }
    return json({ error: 'Unsupported season setting action.' }, 400);
  } catch (error) {
    return serviceError(error);
  }
};
