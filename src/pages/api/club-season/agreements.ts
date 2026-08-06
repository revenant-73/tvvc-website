import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/db';
import {
  clubSeasonAgreementAcceptances,
  clubSeasonRegistrations,
} from '../../../db/schema';
import {
  getPublishedClubSeasonAgreements,
  getOwnedClubSeasonOffers,
  getVerifiedClubSeasonUser,
} from '../../../lib/club-season-access';
import {
  acceptClubSeasonAgreementsSchema,
  parseClubSeasonDraftData,
  validateCompletedClubSeasonDraft,
} from '../../../lib/club-season-draft';
import { isClubSeasonRegistrationEnabled } from '../../../lib/club-season-feature';
import { getClubDate } from '../../../lib/event-eligibility';
import { rejectCrossOriginRequest } from '../../../lib/request-security';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requestIpHash(request: Request): Promise<string | null> {
  // Netlify overwrites this header at the trusted edge. Do not use a generic
  // X-Forwarded-For value here because a client can supply one directly.
  const forwarded = request.headers.get('x-nf-client-connection-ip')?.trim() || '';
  const secret = import.meta.env.AUTH_SECRET || process.env.AUTH_SECRET || '';
  if (!forwarded || !secret) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(forwarded));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request }) => {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;
  if (!isClubSeasonRegistrationEnabled()) return json({ error: 'Not found.' }, 404);
  if (!db) return json({ error: 'Database configuration missing.' }, 500);

  try {
    const parsed = acceptClubSeasonAgreementsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message || 'Invalid agreement response.' }, 400);
    }

    const user = await getVerifiedClubSeasonUser(request);
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const ownedOffers = await getOwnedClubSeasonOffers(request);
    const item = ownedOffers.find(({ offer }) => offer.id === parsed.data.offerId);
    if (!item || item.draft?.ownerUserId !== user.id) {
      return json({ error: 'Registration draft not found.' }, 404);
    }
    if (!item.season.publicRegistrationEnabled) {
      return json({ error: 'Season registration is not currently available.' }, 403);
    }
    if (item.offer.acceptanceDeadline && item.offer.acceptanceDeadline < getClubDate()) {
      return json({ error: 'This offer has expired. Please contact TVVC.' }, 410);
    }
    if (item.offer.status !== 'registration_started') {
      return json({ error: 'This offer is not available for registration.' }, 409);
    }
    if (item.draft.status === 'awaiting_payment') {
      return json({ status: 'awaiting_payment', version: item.draft.version });
    }
    if (item.draft.status !== 'draft') {
      return json({ error: 'This registration cannot accept agreements.' }, 409);
    }
    if (item.draft.draftSchemaVersion !== 1) {
      return json({ error: 'This registration draft requires an update before continuing.' }, 409);
    }
    if (item.draft.version !== parsed.data.version) {
      return json({ error: 'Your registration changed. Reload before accepting the agreements.' }, 409);
    }

    const draftData = parseClubSeasonDraftData(item.draft.draftData);
    if (!draftData) return json({ error: 'Complete and save the registration form first.' }, 422);
    const missingFields = validateCompletedClubSeasonDraft(draftData);
    if (missingFields.length) {
      return json({ error: 'Complete the required registration fields.', missingFields }, 422);
    }

    const agreements = await getPublishedClubSeasonAgreements(item.season.id);
    if (!agreements.length) {
      return json({ error: 'Registration agreements are not configured.' }, 503);
    }

    const responseById = new Map(
      parsed.data.responses.map((response) => [response.agreementVersionId, response.response])
    );
    if (responseById.size !== parsed.data.responses.length) {
      return json({ error: 'Each agreement may be answered only once.' }, 422);
    }
    const selectedIds = new Set(responseById.keys());
    const knownIds = new Set(agreements.map((agreement) => agreement.id));
    const missingRequired = agreements.filter((agreement) => agreement.required && !selectedIds.has(agreement.id));
    const unknownIds = parsed.data.responses
      .map((response) => response.agreementVersionId)
      .filter((id) => !knownIds.has(id));
    if (missingRequired.length || unknownIds.length) {
      return json({ error: 'Review and accept every required agreement currently shown.' }, 422);
    }

    const acceptedAgreements = agreements.filter((agreement) => selectedIds.has(agreement.id));
    for (const agreement of acceptedAgreements) {
      const response = responseById.get(agreement.id) || '';
      if (agreement.responseType === 'acknowledgement' && response !== 'accepted') {
        return json({ error: `Accept “${agreement.title}” before continuing.` }, 422);
      }
      if (agreement.responseType === 'choice') {
        let allowedResponses: string[] = [];
        try {
          const parsedResponses = JSON.parse(agreement.allowedResponses || '[]');
          if (Array.isArray(parsedResponses)) {
            allowedResponses = parsedResponses.filter((value): value is string => typeof value === 'string');
          }
        } catch {
          return json({ error: 'An agreement choice is not configured correctly.' }, 503);
        }
        if (!allowedResponses.includes(response)) {
          return json({ error: `Choose a valid response for “${agreement.title}”.` }, 422);
        }
      }
    }

    const acceptedAt = new Date().toISOString();
    const ipHash = await requestIpHash(request);
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
    const contextSnapshot = JSON.stringify({
      season: { id: item.season.id, name: item.season.name },
      team: { id: item.team.id, name: item.team.name, ageGroup: item.ageGroup.label },
      pricing: {
        tierId: item.pricingTier.id,
        tierName: item.pricingTier.name,
        totalAmount: item.pricingTier.totalAmount,
        depositAmount: item.pricingTier.depositAmount,
        installmentAmount: item.pricingTier.installmentAmount,
      },
      offerId: item.offer.id,
      sourceAthleteId: item.offer.sourceAthleteId,
    });
    const acceptanceRows = await Promise.all(acceptedAgreements.map(async (agreement) => {
      const calculatedHash = await sha256([
        agreement.key,
        String(agreement.version),
        agreement.title,
        agreement.body,
      ].join('\n'));
      if (calculatedHash !== agreement.contentHash) {
        throw new Error('AGREEMENT_CONTENT_HASH_MISMATCH');
      }

      return {
        id: crypto.randomUUID(),
        registrationId: item.draft!.id,
        agreementVersionId: agreement.id,
        ownerUserId: user.id,
        agreementKeySnapshot: agreement.key,
        agreementTitleSnapshot: agreement.title,
        agreementBodySnapshot: agreement.body,
        agreementContentHash: agreement.contentHash,
        response: responseById.get(agreement.id)!,
        acceptedName: parsed.data.acceptedName,
        acceptedEmail: user.email.trim().toLowerCase(),
        requestIpHash: ipHash,
        userAgent,
        contextSnapshot,
        acceptedAt,
        createdAt: acceptedAt,
      };
    }));

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(clubSeasonRegistrations).set({
        status: 'awaiting_payment',
        currentStep: 4,
        version: parsed.data.version + 1,
        submittedAt: acceptedAt,
        lastSavedAt: acceptedAt,
        updatedAt: acceptedAt,
      }).where(and(
        eq(clubSeasonRegistrations.id, item.draft!.id),
        eq(clubSeasonRegistrations.ownerUserId, user.id),
        eq(clubSeasonRegistrations.status, 'draft'),
        eq(clubSeasonRegistrations.version, parsed.data.version)
      )).returning({
        id: clubSeasonRegistrations.id,
        status: clubSeasonRegistrations.status,
        currentStep: clubSeasonRegistrations.currentStep,
        version: clubSeasonRegistrations.version,
      });

      if (!updated) throw new Error('REGISTRATION_VERSION_CONFLICT');
      await tx.insert(clubSeasonAgreementAcceptances).values(acceptanceRows);
      return updated;
    });

    return json({ status: 'awaiting_payment', draft: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'REGISTRATION_VERSION_CONFLICT') {
      return json({ error: 'Your registration changed. Reload before accepting the agreements.' }, 409);
    }
    if (error instanceof Error && error.message === 'AGREEMENT_CONTENT_HASH_MISMATCH') {
      console.error('Published club season agreement content hash mismatch.');
      return json({ error: 'Registration agreement configuration is invalid.' }, 503);
    }
    console.error('Accept club season agreements error:', error);
    return json({ error: 'Unable to record the registration agreements.' }, 500);
  }
};
