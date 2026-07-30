import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeCallbackUrl } from '../src/lib/redirects.ts';
import { rejectCrossOriginRequest } from '../src/lib/request-security.ts';

test('accepts local callback paths', () => {
  assert.equal(getSafeCallbackUrl('/portal/settings'), '/portal/settings');
  assert.equal(getSafeCallbackUrl('/admin/registrations?tab=paid'), '/admin/registrations?tab=paid');
});

test('rejects external and protocol-relative callback URLs', () => {
  assert.equal(getSafeCallbackUrl('https://attacker.example'), '/portal/dashboard');
  assert.equal(getSafeCallbackUrl('//attacker.example'), '/portal/dashboard');
  assert.equal(getSafeCallbackUrl('/\\attacker.example'), '/portal/dashboard');
  assert.equal(getSafeCallbackUrl('/tryouts'), '/portal/dashboard');
  assert.equal(getSafeCallbackUrl(null), '/portal/dashboard');
});

test('allows a same-origin JSON write', () => {
  const request = new Request('https://tualatinvalleyvb.com/api/portal/update-profile', {
    method: 'POST',
    headers: {
      Origin: 'https://tualatinvalleyvb.com',
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'TVVC Parent' }),
  });

  assert.equal(rejectCrossOriginRequest(request), null);
});

test('rejects cross-origin and same-site browser writes', async () => {
  const request = new Request('https://tualatinvalleyvb.com/api/portal/update-profile', {
    method: 'POST',
    headers: {
      Origin: 'https://evil.tualatinvalleyvb.com',
      'Sec-Fetch-Site': 'same-site',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Nope' }),
  });

  const response = rejectCrossOriginRequest(request);
  assert.equal(response?.status, 403);
  assert.match((await response?.json()).error, /origin/i);
});
