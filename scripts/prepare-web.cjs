const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { WEB_APP_URL } = require('../src/config/website.cjs');

const output = path.resolve(__dirname, '../dist');
const index = path.join(output, 'index.html');
fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(
  '</head>', '<meta name="robots" content="noindex" /></head>',
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
