import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { createAuthEmailTemplateConfig } from '../scripts/configure-auth-email-templates.js';
import { createAccountActionEmailContent, normalizeAccountEmailLocale } from '../src/accountActionEmailTemplates.js';
import * as accountEmailConfig from '../src/accountEmailConfig.js';

test('system email templates cover legacy sends and address recovery with branded HTML', () => {
  const config = createAuthEmailTemplateConfig('uk-UA');
  assert.deepEqual(Object.keys(config), ['notification']);
  assert.equal(config.notification.defaultLocale, 'uk');
  const { sendEmail } = config.notification;
  assert.equal(sendEmail.callbackUri, 'https://planit-hub.firebaseapp.com/auth/action');
  assert.equal(sendEmail.smtp, undefined);
  for (const field of ['resetPasswordTemplate', 'legacyResetPasswordTemplate', 'verifyEmailTemplate', 'changeEmailTemplate']) {
    const template = sendEmail[field];
    assert.equal(template.senderDisplayName, 'PlanIt');
    assert.equal(template.bodyFormat, 'HTML');
    assert.match(template.body, /href="%LINK%"/);
    assert.match(template.body, /PlanIt<span[^>]*>\.<\/span>/);
  }
  assert.match(sendEmail.changeEmailTemplate.subject, /адресу.*змінено/);
  assert.match(sendEmail.changeEmailTemplate.body, /Відновити попередню пошту/);
  assert.doesNotMatch(sendEmail.changeEmailTemplate.body, /Підтвердити нову пошту/);
});

const loadConfigurationScript = ({ apply = false, secretStatus = 200 } = {}) => {
  const requests = [];
  const output = [];
  let credentialRequests = 0;
  const source = fs.readFileSync(new URL('../scripts/configure-auth-email-templates.js', import.meta.url), 'utf8');
  const executable = source.slice(0, source.indexOf('if (process.argv[1]'))
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace(/^export /gm, '');
  const context = vm.createContext({
    URL, Buffer, AbortSignal,
    createAccountActionEmailContent, normalizeAccountEmailLocale,
    ...accountEmailConfig,
    process: { argv: ['node', 'configure-script', '--project', 'planit-test', ...(apply ? ['--apply'] : [])] },
    console: { log: (value) => output.push(value) },
    applicationDefault: () => ({
      getAccessToken: async () => { credentialRequests += 1; return { access_token: 'private-access-token' }; },
    }),
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.includes('secretmanager.googleapis.com')) return {
        ok: secretStatus === 200,
        status: secretStatus,
        json: async () => ({ payload: { data: Buffer.from('abcdefghijklmnop').toString('base64') } }),
      };
      return { ok: true };
    },
  });
  vm.runInContext(executable + '\nglobalThis.run = configureAuthEmailTemplates;', context);
  return { run: context.run, requests, output, credentialRequests: () => credentialRequests };
};

test('template preview makes no authenticated or remote requests', async () => {
  const script = loadConfigurationScript();
  await script.run();
  assert.equal(script.credentialRequests(), 0);
  assert.equal(script.requests.length, 0);
  assert.equal(JSON.parse(script.output[0]).notification.sendEmail.smtp, undefined);
});

test('applying templates reads the existing secret and patches only notification fields', async () => {
  const script = loadConfigurationScript({ apply: true });
  await script.run();
  assert.equal(script.requests.length, 2);
  const request = script.requests[1];
  assert.equal(request.options.method, 'PATCH');
  const mask = new URL(request.url).searchParams.get('updateMask').split(',');
  assert.ok(mask.every((field) => field.startsWith('notification.')));
  assert.ok(mask.includes('notification.sendEmail.changeEmailTemplate'));
  const body = JSON.parse(request.options.body);
  assert.deepEqual(Object.keys(body), ['notification']);
  assert.equal(body.notification.sendEmail.smtp.password, 'abcdefghijklmnop');
  assert.doesNotMatch(script.output.join('\n'), /abcdefghijklmnop|private-access-token/);
});

test('configuration stops before any update when secret access is denied', async () => {
  const script = loadConfigurationScript({ apply: true, secretStatus: 403 });
  await assert.rejects(script.run(), /Reading SMTP_APP_PASSWORD failed/);
  assert.equal(script.requests.length, 1);
});
