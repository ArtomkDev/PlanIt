import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAddPasswordEmailContent,
  normalizePasswordEmailLocale,
} from '../src/passwordActionEmailTemplates.js';

test('uses Ukrainian only for Ukrainian locales and English as the fallback', () => {
  assert.equal(normalizePasswordEmailLocale('uk'), 'uk');
  assert.equal(normalizePasswordEmailLocale('uk-UA'), 'uk');
  assert.equal(normalizePasswordEmailLocale('pl'), 'en');
  assert.equal(normalizePasswordEmailLocale(undefined), 'en');
});

test('creates action-specific localized add-password copy', () => {
  const uk = createAddPasswordEmailContent({
    locale: 'uk',
    displayName: 'Артем',
    actionLink: 'https://example.com/add-password',
  });
  const en = createAddPasswordEmailContent({
    locale: 'de',
    actionLink: 'https://example.com/add-password',
  });

  assert.equal(uk.subject, 'Створіть пароль для PlanIt');
  assert.match(uk.text, /додавання пароля/);
  assert.doesNotMatch(uk.text, /скинути пароль/i);
  assert.equal(en.subject, 'Create your PlanIt password');
  assert.match(en.text, /requested to add a password/);
});

test('escapes display names and links before inserting them into HTML', () => {
  const message = createAddPasswordEmailContent({
    locale: 'en',
    displayName: '<script>alert(1)</script>',
    actionLink: 'https://example.com/?next="bad"&value=1',
  });

  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /&quot;bad&quot;&amp;value=1/);
});
