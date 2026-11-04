const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { WEBSITE_URL, WEB_APP_URL } = require('../src/config/website.cjs');

const output = path.resolve(__dirname, '../dist');
const index = path.join(output, 'index.html');
const title = 'PlanIt — розклад занять і завдання';
const description = 'Плануйте навчання в браузері. Розклад занять, завдання й матеріали в одному місці. Спробуйте PlanIt без акаунта.';
const image = `${WEBSITE_URL}/uk/opengraph-image`;
const metadata = [
  '<meta name="robots" content="noindex" />',
  `<meta name="description" content="${description}" />`,
  '<meta property="og:type" content="website" />',
  '<meta property="og:site_name" content="PlanIt" />',
  '<meta property="og:locale" content="uk_UA" />',
  `<meta property="og:title" content="${title}" />`,
  `<meta property="og:description" content="${description}" />`,
  `<meta property="og:url" content="${WEB_APP_URL}/" />`,
  `<meta property="og:image" content="${image}" />`,
  '<meta property="og:image:width" content="1200" />',
  '<meta property="og:image:height" content="630" />',
  '<meta property="og:image:alt" content="PlanIt — розклад занять у вебзастосунку" />',
  '<meta name="twitter:card" content="summary_large_image" />',
  `<meta name="twitter:title" content="${title}" />`,
  `<meta name="twitter:description" content="${description}" />`,
  `<meta name="twitter:image" content="${image}" />`,
];
fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(
  '</head>', `${metadata.join('\n')}\n</head>`,
));
fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *\nAllow: /\n');

const files = {};
for (const file of fs.readdirSync(output, { recursive: true }).sort()) {
  const absolute = path.join(output, file);
  if (!fs.statSync(absolute).isFile() || file === 'release.json') continue;
  files[file.split(path.sep).join('/')] = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
}
const buildId = createHash('sha256').update(JSON.stringify(files)).digest('hex');
fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify({ buildId, origin: WEB_APP_URL, files }, null, 2) + '\n');
console.log(`Prepared production web release ${buildId.slice(0, 12)}.`);
