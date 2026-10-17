import { readFileSync } from 'node:fs';

const wordmark = readFileSync(new URL('../assets/email-wordmark.png', import.meta.url));

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const normalizeAccountEmailLocale = (locale) => (
  String(locale || '').toLowerCase().startsWith('uk') ? 'uk' : 'en'
);

const COPY = {
  uk: {
    greeting: (name) => (name ? `Вітаємо, ${name}!` : 'Вітаємо!'),
    account: 'Ваш акаунт',
    security: 'Важливо знати',
    fallback: 'Якщо кнопка не працює, скопіюйте це посилання у браузер:',
    footer: 'Менше хаосу. Більше планів.',
    addPassword: {
      subject: 'Створіть пароль для PlanIt',
      title: 'Створіть пароль',
      intro: 'Ви запросили додавання пароля до свого акаунта PlanIt.',
      instruction: 'Підтвердьте, що ця електронна адреса належить вам, і створіть пароль за захищеним посиланням:',
      button: 'Створити пароль',
      ignore: 'Якщо ви не запитували додавання пароля, просто проігноруйте цей лист. Ваш акаунт залишиться без змін.',
    },
    resetPassword: {
      subject: 'Відновіть пароль для PlanIt',
      title: 'Відновлення пароля',
      intro: 'Ви запросили відновлення пароля до свого акаунта PlanIt.',
      instruction: 'Щоб встановити новий пароль, перейдіть за захищеним посиланням:',
      button: 'Встановити новий пароль',
      ignore: 'Якщо ви не запитували відновлення пароля, просто проігноруйте цей лист. Ваш пароль залишиться без змін.',
    },
    verifyEmail: {
      subject: 'Підтвердьте вашу пошту для PlanIt',
      title: 'Підтвердьте пошту',
      intro: 'Підтвердьте електронну адресу свого акаунта PlanIt.',
      instruction: 'Щоб підтвердити адресу та почати користуватися акаунтом, перейдіть за захищеним посиланням:',
      button: 'Підтвердити пошту',
      ignore: 'Якщо ви не створювали акаунт PlanIt, просто проігноруйте цей лист.',
    },
    verifyAndChangeEmail: {
      subject: 'Підтвердьте нову пошту для PlanIt',
      title: 'Ваша нова пошта',
      intro: 'Ви запросили зміну електронної адреси свого акаунта PlanIt на цю адресу.',
      instruction: 'Підтвердьте нову адресу за захищеним посиланням. До підтвердження адреса акаунта залишиться без змін:',
      button: 'Підтвердити нову пошту',
      ignore: 'Якщо ви не запитували зміну пошти, просто проігноруйте цей лист. Адреса акаунта залишиться без змін.',
    },
    recoverEmail: {
      subject: 'Електронну адресу акаунта PlanIt змінено',
      title: 'Пошту змінено',
      intro: 'Електронну адресу вашого акаунта PlanIt було змінено.',
      instruction: 'Якщо це зробили не ви, поверніть попередню адресу за захищеним посиланням:',
      button: 'Відновити попередню пошту',
      ignore: 'Якщо ви самі змінили адресу, жодних додаткових дій не потрібно.',
    },
  },
  en: {
    greeting: (name) => (name ? `Hello, ${name}!` : 'Hello!'),
    account: 'Your account',
    security: 'Good to know',
    fallback: 'If the button does not work, copy this link into your browser:',
    footer: 'Less chaos. More plans.',
    addPassword: {
      subject: 'Create your PlanIt password',
      title: 'Create your password',
      intro: 'You requested to add a password to your PlanIt account.',
      instruction: 'Confirm that this email address belongs to you and create your password using the secure link below:',
      button: 'Create password',
      ignore: 'If you did not request a password, you can safely ignore this email. Your account will remain unchanged.',
    },
    resetPassword: {
      subject: 'Reset your PlanIt password',
      title: 'Reset your password',
      intro: 'You requested to reset the password for your PlanIt account.',
      instruction: 'Use the secure link below to set a new password:',
      button: 'Set new password',
      ignore: 'If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.',
    },
    verifyEmail: {
      subject: 'Verify your email for PlanIt',
      title: 'Verify your email',
      intro: 'Please verify the email address for your PlanIt account.',
      instruction: 'Use the secure link below to verify your email and start using your account:',
      button: 'Verify email',
      ignore: 'If you did not create a PlanIt account, you can safely ignore this email.',
    },
    verifyAndChangeEmail: {
      subject: 'Verify your new email for PlanIt',
      title: 'Your new email',
      intro: 'You requested to change the email address of your PlanIt account to this address.',
      instruction: 'Verify the new address using the secure link below. Your account email will stay unchanged until you confirm:',
      button: 'Verify new email',
      ignore: 'If you did not request an email change, you can safely ignore this email. Your account email will remain unchanged.',
    },
    recoverEmail: {
      subject: 'Your PlanIt account email has changed',
      title: 'Your email has changed',
      intro: 'The email address of your PlanIt account has been changed.',
      instruction: 'If you did not make this change, use the secure link below to restore your previous email address:',
      button: 'Restore previous email',
      ignore: 'If you changed the address yourself, no further action is needed.',
    },
  },
};

export const createAccountActionEmailContent = ({
  purpose = 'addPassword',
  locale,
  displayName,
  actionLink,
  inlineLogo = false,
} = {}) => {
  const normalizedLocale = normalizeAccountEmailLocale(locale);
  const localizedCopy = COPY[normalizedLocale];
  const copy = { ...localizedCopy, ...localizedCopy[purpose] };
  const plainName = String(displayName || '').trim().slice(0, 120);
  const safeName = escapeHtml(plainName);
  const safeLink = escapeHtml(actionLink);

  return {
    locale: normalizedLocale,
    subject: copy.subject,
    attachments: inlineLogo ? [{
      filename: 'planit-wordmark.png',
      content: wordmark,
      cid: 'planit-wordmark',
      contentType: 'image/png',
      contentDisposition: 'inline',
    }] : [],
    text: [
      'PlanIt.',
      copy.title,
      '',
      copy.greeting(plainName),
      '',
      copy.intro,
      copy.instruction,
      actionLink,
      '',
      copy.ignore,
      '',
      copy.footer,
    ].join('\n'),
    html: `<!doctype html>
<html lang="${normalizedLocale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting" content="true">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light dark">
    <title>${copy.subject}</title>
    <style>
      :root { color-scheme:light dark;supported-color-schemes:light dark; }
      table { border-collapse:separate; }
      body, table, td, p, h1, a { font-family:Arial,Helvetica,sans-serif; }
      a:focus-visible { outline:3px solid #b92f60;outline-offset:4px; }
      @media only screen and (max-width:600px) {
        .email-shell { padding:20px 12px !important; }
        .email-header { padding:24px !important; }
        .email-content { padding:28px 24px !important; }
        .email-title { font-size:28px !important;line-height:1.15 !important; }
      }
      @media (prefers-color-scheme:dark) {
        .email-background { background-color:#09090b !important; }
        .email-card { background-color:#18181b !important;border-color:#3f3f46 !important; }
        .email-heading { color:#fafafa !important; }
        .email-copy { color:#d4d4d8 !important; }
        .email-muted { color:#a1a1aa !important; }
        .email-notice { background-color:#27272a !important; }
        .email-secondary-link { color:#82ffe6 !important; }
        .email-divider { border-color:#3f3f46 !important; }
      }
    </style>
  </head>
  <body class="email-background" style="margin:0;padding:0;width:100%;background-color:#f7f7fa;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;color:#18181b">
    <div aria-hidden="true" style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${copy.intro}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f7f7fa" class="email-background">
      <tr><td align="center" class="email-shell" style="padding:40px 16px">
        <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" class="email-card" style="max-width:600px;background-color:#ffffff;border:1px solid #dfe1e8;border-radius:24px;overflow:hidden">
          <tr><td bgcolor="#18181b" class="email-header" style="padding:28px 36px;background-color:#18181b;border-radius:23px 23px 0 0">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td height="44" style="height:44px;color:#fafafa;font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:700;line-height:44px;letter-spacing:-2px;white-space:nowrap">${inlineLogo
                  ? '<img src="cid:planit-wordmark" alt="PlanIt." width="132" height="32" style="display:block;width:132px;height:32px;border:0;color:#fafafa;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:700">'
                  : 'PlanIt<span style="color:#3ef7d2">.</span>'}</td>
                <td align="right" style="padding-left:16px;color:#d4d4d8;font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.5px;text-transform:uppercase">${copy.account}</td>
              </tr>
            </table>
          </td></tr>
          <tr><td class="email-content" style="padding:36px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed">
              <tr><td style="padding-bottom:20px">
                <table role="presentation" width="40" cellspacing="0" cellpadding="0" border="0"><tr><td height="4" bgcolor="#f45b8a" style="height:4px;line-height:4px;background-color:#f45b8a;border-radius:2px;font-size:0">&nbsp;</td></tr></table>
              </td></tr>
              <tr><td style="padding-bottom:24px"><h1 class="email-title email-heading" style="margin:0;color:#18181b;font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:700;line-height:1.12;letter-spacing:-1.2px;overflow-wrap:break-word">${copy.title}</h1></td></tr>
              <tr><td class="email-heading" style="padding-bottom:12px;color:#18181b;font-size:16px;font-weight:700;line-height:24px;overflow-wrap:anywhere;word-break:break-word">${copy.greeting(safeName)}</td></tr>
              <tr><td class="email-copy" style="padding-bottom:8px;color:#5f6470;font-size:16px;line-height:25px">${copy.intro}</td></tr>
              <tr><td class="email-copy" style="padding-bottom:28px;color:#5f6470;font-size:16px;line-height:25px">${copy.instruction}</td></tr>
              <tr><td style="padding-bottom:28px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                  <td align="center" bgcolor="#3ef7d2" style="background-color:#3ef7d2;border-radius:12px;mso-padding-alt:17px 20px">
                    <a href="${safeLink}" style="display:block;padding:17px 20px;border:1px solid #3ef7d2;border-radius:12px;color:#18181b;font-size:16px;font-weight:700;line-height:22px;text-align:center;text-decoration:none;mso-padding-alt:0">${copy.button}</a>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td class="email-notice" bgcolor="#f5f5f8" style="padding:18px 20px;background-color:#f5f5f8;border-radius:12px">
                <p class="email-heading" style="margin:0 0 6px;color:#18181b;font-size:13px;font-weight:700;line-height:20px">${copy.security}</p>
                <p class="email-copy" style="margin:0;color:#5f6470;font-size:14px;line-height:22px">${copy.ignore}</p>
              </td></tr>
              <tr><td class="email-muted" style="padding-top:24px;color:#666c78;font-size:13px;line-height:22px">${copy.fallback}</td></tr>
              <tr><td style="padding-top:8px;word-break:break-all;overflow-wrap:anywhere"><a class="email-secondary-link" href="${safeLink}" style="display:block;color:#b92f60;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;white-space:normal;text-decoration:underline">${safeLink}</a></td></tr>
            </table>
          </td></tr>
          <tr><td class="email-divider email-muted" style="padding:20px 24px;border-top:1px solid #dfe1e8;color:#666c78;font-size:12px;line-height:20px;text-align:center">PlanIt. &nbsp;&middot;&nbsp; ${copy.footer}</td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`,
  };
};
