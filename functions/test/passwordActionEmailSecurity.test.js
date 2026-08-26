import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(testDirectory, '../src/index.js'),
  'utf8',
);
const handlerStart = source.indexOf('export const sendAddPasswordEmail');
const handlerEnd = source.indexOf('export const revokeAppleAuthorization');
const handler = source.slice(handlerStart, handlerEnd);

test('add-password mail is restricted to an authenticated verified account', () => {
  assert.match(handler, /getVerifiedFirebaseIdentity\(request\)/);
  assert.match(handler, /getAuth\(\)\.getUser\(firebaseIdentity\.uid\)/);
  assert.match(handler, /userRecord\.emailVerified !== true/);
  assert.match(handler, /providerId === 'password'/);
});

test('generated reset link is emailed but never returned to the client', () => {
  assert.match(handler, /generatePasswordResetLink/);
  assert.match(handler, /buildPasswordActionLink\(firebaseActionLink, locale\)/);
  assert.match(handler, /sendAddPasswordMessage/);
  assert.match(handler, /response\.status\(204\)\.send\(\)/);
  assert.doesNotMatch(handler, /json\(\{[^}]*actionLink/);
});

test('generated reset link is rewritten to the branded website action handler', () => {
  assert.match(source, /PASSWORD_ACTION_HANDLER_BASE_URL = 'https:\/\/planit-hub\.firebaseapp\.com'/);
  assert.match(source, /'\/' \+ locale \+ '\/auth\/action'/);
  assert.match(source, /NESTED_ACTION_LINK_PARAMS = \['link', 'deep_link_id'\]/);
  assert.match(source, /const passwordActionUrl = findPasswordActionUrl\(generatedUrl\)/);
  assert.match(source, /for \(const requiredParam of \['mode', 'oobCode', 'apiKey'\]\)/);
  assert.doesNotMatch(handler, /sendAddPasswordMessage\(\{\s*userRecord,\s*locale,\s*actionLink: firebaseActionLink/s);
});

test('server-side cooldown guards against repeated email spam', () => {
  assert.match(handler, /claimPasswordEmailRateLimit/);
  assert.match(source, /nextAllowedAt: now \+ PASSWORD_EMAIL_COOLDOWN_MS/);
  assert.match(source, /too_many_requests/);
  assert.doesNotMatch(source, /releasePasswordEmailRateLimit/);
});
