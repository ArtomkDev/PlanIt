import { pathToFileURL } from 'node:url';
import { applicationDefault } from 'firebase-admin/app';

import {
  createAccountActionEmailContent,
  normalizeAccountEmailLocale,
} from '../src/accountActionEmailTemplates.js';
import { ACCOUNT_ACTION_HANDLER_BASE_URL, SMTP_HOST, SMTP_PORT, SMTP_USER } from '../src/accountEmailConfig.js';

export const createAuthEmailTemplateConfig = (locale = 'en') => {
  const template = (purpose) => {
    const message = createAccountActionEmailContent({
      purpose,
      locale,
      actionLink: '%LINK%',
    });
    return {
      senderDisplayName: 'PlanIt',
      replyTo: SMTP_USER,
      subject: message.subject,
      body: message.html,
      bodyFormat: 'HTML',
    };
  };
  return {
    notification: {
      defaultLocale: normalizeAccountEmailLocale(locale),
      sendEmail: {
        callbackUri: ACCOUNT_ACTION_HANDLER_BASE_URL + '/auth/action',
        resetPasswordTemplate: template('resetPassword'),
        legacyResetPasswordTemplate: template('resetPassword'),
        verifyEmailTemplate: template('verifyEmail'),
        changeEmailTemplate: template('recoverEmail'),
      },
    },
  };
};

const configureAuthEmailTemplates = async () => {
  const args = process.argv.slice(2);
  const argument = (name) => args[args.indexOf(name) + 1];
  const projectId = args.includes('--project') ? argument('--project') : '';
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error('Provide --project with the Firebase project ID.');
  }
  const locale = args.includes('--locale') ? argument('--locale') : 'en';
  const config = createAuthEmailTemplateConfig(locale);
  if (!args.includes('--apply')) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const { access_token: accessToken } = await applicationDefault().getAccessToken();
  const headers = {
    Authorization: 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
  };
  const secretResponse = await fetch(
    'https://secretmanager.googleapis.com/v1/projects/' + projectId
      + '/secrets/SMTP_APP_PASSWORD/versions/latest:access',
    { headers, signal: AbortSignal.timeout(10_000) },
  );
  if (!secretResponse.ok) {
    throw new Error('Reading SMTP_APP_PASSWORD failed (HTTP ' + secretResponse.status + ').');
  }
  const secret = await secretResponse.json();
  const password = Buffer.from(secret.payload?.data || '', 'base64').toString('utf8').replace(/\s/g, '');
  if (!/^[A-Za-z0-9]{16}$/.test(password)) {
    throw new Error('SMTP_APP_PASSWORD is not a valid Gmail app password.');
  }
  config.notification.sendEmail.method = 'CUSTOM_SMTP';
  config.notification.sendEmail.smtp = {
    senderEmail: SMTP_USER,
    host: SMTP_HOST,
    port: SMTP_PORT,
    username: SMTP_USER,
    password,
    securityMode: 'SSL',
  };
  const updateMask = [
    'notification.defaultLocale',
    ...Object.keys(config.notification.sendEmail).map((field) => 'notification.sendEmail.' + field),
  ].join(',');
  const response = await fetch(
    'https://identitytoolkit.googleapis.com/admin/v2/projects/' + projectId
      + '/config?updateMask=' + encodeURIComponent(updateMask),
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error('Updating Auth email templates failed (HTTP ' + response.status + ').');
  }
  console.log('Updated branded Auth email templates and SMTP for ' + projectId + '.');
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  configureAuthEmailTemplates().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
