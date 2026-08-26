const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const normalizePasswordEmailLocale = (locale) => (
  String(locale || '').toLowerCase().startsWith('uk') ? 'uk' : 'en'
);

const COPY = {
  uk: {
    subject: 'Створіть пароль для PlanIt',
    greeting: (name) => (name ? `Вітаємо, ${name}!` : 'Вітаємо!'),
    intro: 'Ви запросили додавання пароля до свого акаунта PlanIt.',
    instruction: 'Підтвердьте, що ця електронна адреса належить вам, і створіть пароль за захищеним посиланням:',
    button: 'Створити пароль',
    ignore: 'Якщо ви не запитували додавання пароля, просто проігноруйте цей лист. Ваш акаунт залишиться без змін.',
    fallback: 'Якщо кнопка не відкривається, скопіюйте це посилання у браузер:',
  },
  en: {
    subject: 'Create your PlanIt password',
    greeting: (name) => (name ? `Hello, ${name}!` : 'Hello!'),
    intro: 'You requested to add a password to your PlanIt account.',
    instruction: 'Confirm that this email address belongs to you and create your password using the secure link below:',
    button: 'Create password',
    ignore: 'If you did not request a password, you can safely ignore this email. Your account will remain unchanged.',
    fallback: 'If the button does not open, copy this link into your browser:',
  },
};

export const createAddPasswordEmailContent = ({
  locale,
  displayName,
  actionLink,
} = {}) => {
  const normalizedLocale = normalizePasswordEmailLocale(locale);
  const copy = COPY[normalizedLocale];
  const safeName = escapeHtml(String(displayName || '').trim().slice(0, 120));
  const safeLink = escapeHtml(actionLink);
  const plainName = String(displayName || '').trim().slice(0, 120);

  return {
    locale: normalizedLocale,
    subject: copy.subject,
    text: [
      copy.greeting(plainName),
      '',
      copy.intro,
      copy.instruction,
      actionLink,
      '',
      copy.ignore,
      '',
      'PlanIt',
    ].join('\n'),
    html: `<!doctype html>
<html lang="${normalizedLocale}">
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#171923">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(20,30,55,.08)">
          <tr><td style="font-size:26px;font-weight:700;color:#2563eb;padding-bottom:24px">PlanIt</td></tr>
          <tr><td style="font-size:20px;font-weight:700;padding-bottom:12px">${copy.greeting(safeName)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;padding-bottom:8px">${copy.intro}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px">${copy.instruction}</td></tr>
          <tr><td align="center" style="padding-bottom:24px">
            <a href="${safeLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">${copy.button}</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.55;color:#5f6675;padding-bottom:18px">${copy.ignore}</td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#7b8190">${copy.fallback}<br><a href="${safeLink}" style="color:#2563eb;word-break:break-all">${safeLink}</a></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
};
