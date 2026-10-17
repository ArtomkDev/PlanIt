import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';

import {
  createAccountActionEmailContent,
  normalizeAccountEmailLocale,
} from '../src/accountActionEmailTemplates.js';

test('uses Ukrainian only for Ukrainian locales and English as the fallback', () => {
  assert.equal(normalizeAccountEmailLocale('uk'), 'uk');
  assert.equal(normalizeAccountEmailLocale('uk-UA'), 'uk');
  assert.equal(normalizeAccountEmailLocale('pl'), 'en');
  assert.equal(normalizeAccountEmailLocale(undefined), 'en');
});

test('creates action-specific localized add-password copy', () => {
  const uk = createAccountActionEmailContent({
    locale: 'uk',
    displayName: 'Артем',
    actionLink: 'https://example.com/add-password',
  });
  const en = createAccountActionEmailContent({
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
  const message = createAccountActionEmailContent({
    locale: 'en',
    displayName: '<script>alert(1)</script>',
    actionLink: 'https://example.com/?next="bad"&value=1',
  });

  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /&quot;bad&quot;&amp;value=1/);
});

test('creates localized reset-password copy in the same branded template', () => {
  for (const locale of ['uk', 'en']) {
    const message = createAccountActionEmailContent({
      purpose: 'resetPassword',
      locale,
      actionLink: 'https://example.com/reset-password',
    });

    assert.equal(message.subject, locale === 'uk'
      ? 'Відновіть пароль для PlanIt'
      : 'Reset your PlanIt password');
    assert.match(message.html, /<h1\b/);
    assert.match(message.html, /href="https:\/\/example.com\/reset-password"/);
    assert.match(message.text, locale === 'uk' ? /відновлення пароля/ : /reset the password/);
    assert.doesNotMatch(message.text, /додавання пароля|requested to add a password/);
  }
});

test('verification, email change, and recovery have distinct localized actions', () => {
  const subjects = {
    verifyEmail: ['Підтвердьте вашу пошту для PlanIt', 'Verify your email for PlanIt'],
    verifyAndChangeEmail: ['Підтвердьте нову пошту для PlanIt', 'Verify your new email for PlanIt'],
    recoverEmail: ['Електронну адресу акаунта PlanIt змінено', 'Your PlanIt account email has changed'],
  };
  for (const [purpose, expected] of Object.entries(subjects)) {
    for (const [index, locale] of ['uk', 'en'].entries()) {
      const message = createAccountActionEmailContent({ purpose, locale, actionLink: 'https://example.com/action' });
      assert.equal(message.subject, expected[index]);
      assert.match(message.html, /href="https:\/\/example.com\/action"/);
      assert.doesNotMatch(message.html, /undefined/);
      assert.doesNotMatch(message.text, /password reset|відновлення пароля/);
    }
  }
});

test('every account email displays the complete copyable URL without adding characters or clipping it', () => {
  const actionLink = 'https://example.com/auth/action?mode=resetPassword&oobCode=' + 'a'.repeat(1500);
  for (const purpose of ['addPassword', 'resetPassword', 'verifyEmail', 'verifyAndChangeEmail', 'recoverEmail']) {
    for (const locale of ['uk', 'en']) {
      const message = createAccountActionEmailContent({ purpose, locale, actionLink, inlineLogo: true });
      assert.match(message.html, new RegExp(`<html lang="${locale}">`));
      assert.match(message.html, /<meta name="viewport"/);
      assert.equal((message.html.match(/<h1\b/g) || []).length, 1);
      assert.match(message.html, /<img src="cid:planit-wordmark" alt="PlanIt\."/);
      assert.equal((message.html.match(/href="https:\/\/example.com\/auth\/action\?/g) || []).length, 2);
      assert.match(message.html, /mode=resetPassword&amp;oobCode=/);
      const fallback = message.html.match(/<a class="email-secondary-link" href="([^"]+)"[^>]*>([^<]+)<\/a>/);
      assert.ok(fallback, 'fallback must display the URL as text');
      assert.equal(fallback[1], fallback[2]);
      assert.equal(fallback[2].replaceAll('&amp;', '&'), actionLink);
      assert.match(message.html, /word-break:break-all;overflow-wrap:anywhere/);
      assert.ok(message.text.includes(actionLink));
      assert.doesNotMatch(message.html, /<script|@import|undefined|<wbr|&#8203;/);
      assert.ok(Buffer.byteLength(message.html) < 102_400, 'email must stay below Gmail clipping size');
    }
  }
});

test('uses the Gmail color opt-out while retaining authored dark styles and portable text fonts', () => {
  const message = createAccountActionEmailContent({ actionLink: 'https://example.com/action' });
  assert.match(message.html, /<meta name="color-scheme" content="light only">/);
  assert.match(message.html, /:root \{ color-scheme:light dark/);
  assert.match(message.html, /@media \(prefers-color-scheme:dark\)/);
  assert.match(message.html, /font-family:Arial,Helvetica,sans-serif/);
  assert.doesNotMatch(message.html, /Segoe UI|Arial Black|@font-face/);
  assert.deepEqual(message.attachments, [], 'system templates must not reference unattached CID images');
  assert.doesNotMatch(message.html, /cid:/);
});

test('packages the logo inside the email without external image or font requests', async () => {
  const message = createAccountActionEmailContent({
    purpose: 'resetPassword',
    locale: 'uk',
    inlineLogo: true,
    actionLink: 'https://example.com/action',
  });
  assert.equal(message.attachments.length, 1);
  const logo = message.attachments[0];
  assert.equal(logo.cid, 'planit-wordmark');
  assert.equal(logo.contentType, 'image/png');
  assert.equal(logo.contentDisposition, 'inline');
  assert.equal(logo.content.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.doesNotMatch(message.html, /<img[^>]+src="https?:/);

  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: 'PlanIt <planit@example.invalid>',
    to: 'person@example.invalid',
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const mime = result.message.toString();
  assert.match(mime, /Content-Type: multipart\/related/);
  assert.match(mime, /Content-ID: <planit-wordmark>/);
  assert.match(mime, /Content-Disposition: inline; filename=planit-wordmark\.png/);
});
