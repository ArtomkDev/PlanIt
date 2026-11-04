const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { load } = require('@expo/env');
const { WEBSITE_URL, WEB_APP_URL } = require('../src/config/website.cjs');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function checkConfig() {
  process.env.NODE_ENV ||= 'production';
  load(root, { silent: true });
  assert.equal(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, 'planit-hub', 'Use the existing production Firebase project.');
  assert.equal(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, new URL(WEB_APP_URL).host, 'Serve the popup OAuth callback from the app origin.');
  for (const key of ['API_KEY', 'APP_ID', 'STORAGE_BUCKET']) {
    assert.ok(process.env[`EXPO_PUBLIC_FIREBASE_${key}`], `Missing public Firebase ${key}.`);
  }
  const config = readJson('firebase.json');
  assert.equal(config.hosting.target, 'app');
  assert.equal(config.hosting.public, 'dist');
  assert.deepEqual(readJson('.firebaserc').targets['planit-hub'].hosting.app, ['planit-demo']);
  return config.hosting;
}

async function checkExport(origin) {
  const hosting = checkConfig();
  const output = path.join(root, 'dist');
  const release = readJson('dist/release.json');
  assert.equal(release.origin, WEB_APP_URL);
  assert.equal(release.buildId, digest(JSON.stringify(release.files)));
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex"/);
  const head = html.split('</head>')[0];
  assert.match(head, /<meta property="og:title" content="[^"]+"/);
  assert.match(head, /<meta property="og:description" content="[^"]+"/);
  const socialImage = head.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(socialImage, 'Missing social preview image in the HTML head.');
  assert.equal(new URL(socialImage).origin, WEBSITE_URL);
  assert.match(head, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(fs.readFileSync(path.join(output, 'robots.txt'), 'utf8'), /Allow: \/\s*$/);
  const actualFiles = fs.readdirSync(output, { recursive: true })
    .filter(file => fs.statSync(path.join(output, file)).isFile())
    .map(file => file.split(path.sep).join('/')).sort();
  assert.deepEqual(actualFiles, [...Object.keys(release.files), 'release.json'].sort(), 'Rebuild after changing export files.');
  const secrets = Object.entries(process.env).filter(([key, value]) =>
    !key.startsWith('EXPO_PUBLIC_') && /SECRET|PASSWORD|PRIVATE_KEY|TOKEN|KEYSTORE/i.test(key) && value.length >= 8,
  );
  for (const file of Object.keys(release.files)) {
    assert.ok(!/(^|\/)\.|\.map$|\.(pem|key|jks|keystore)$/i.test(file), `Unexpected private or debug file: ${file}`);
    const bytes = fs.readFileSync(path.join(output, file));
    assert.equal(digest(bytes), release.files[file], `Stale build file: ${file}`);
    const text = bytes.toString('utf8');
    assert.ok(!/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text), `Private key in ${file}`);
    for (const [key, value] of secrets) assert.ok(!text.includes(value), `Private environment value ${key} in ${file}`);
    if (file.startsWith('_expo/static/') || file.startsWith('assets/')) {
      assert.match(file, /[.-][a-f0-9]{32}[.@-]/, `Immutable asset must be content hashed: ${file}`);
    }
  }
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)) {
    assert.ok(release.files[asset.slice(1)], `Missing HTML asset: ${asset}`);
  }
  if (origin) {
    const get = async (pathname, status = 200) => {
      const response = await fetch(new URL(pathname, origin), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, status, `${pathname}: HTTP status`);
      return response;
    };
    const published = await (await get('/release.json')).json();
    assert.equal(published.buildId, release.buildId, 'Published release differs from local build.');
    const preview = await fetch(socialImage, { signal: AbortSignal.timeout(30000) });
    assert.equal(preview.status, 200, 'Social preview image must be publicly accessible.');
    assert.match(preview.headers.get('content-type'), /^image\/png\b/);
    await preview.body.cancel();
    for (const route of ['/', '/auth', '/password-reset', '/settings/about', '/share/DEPLOYTEST123']) {
      const response = await get(route);
      assert.match(response.headers.get('cache-control'), /no-cache/);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      assert.equal(digest(Buffer.from(await response.arrayBuffer())), release.files['index.html'], `${route}: SPA shell`);
    }
    for (const file of Object.keys(release.files)) {
      const response = await get('/' + file);
      if (file.endsWith('.js')) assert.match(response.headers.get('content-type'), /javascript/);
      if (file.startsWith('assets/') || file.startsWith('_expo/static/')) {
        assert.match(response.headers.get('cache-control'), /immutable/);
      } else assert.match(response.headers.get('cache-control'), /no-cache/);
      assert.equal(digest(Buffer.from(await response.arrayBuffer())), release.files[file], `Published asset differs: ${file}`);
    }
    for (const missing of ['/assets/missing.png', '/assets/missing', '/_expo/static/js/web/missing.js', '/missing.css', '/missing.woff2']) {
      await get(missing, 404);
    }
    if (new URL(origin).protocol === 'https:') {
      const helper = await get('/__/auth/iframe.js');
      assert.match(helper.headers.get('content-type'), /javascript/);
      const firebase = await (await get('/__/firebase/init.json')).json();
      assert.equal(firebase.projectId, 'planit-hub');
    }
  }
  assert.ok(hosting.headers.some(rule => rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex')));
  console.log(`Verified web release ${release.buildId.slice(0, 12)}${origin ? ` at ${origin}` : ''}: ${Object.keys(release.files).length} files, routing, indexing, caching and private-value checks.`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  Promise.resolve(args.includes('--config') ? checkConfig() : checkExport(urlIndex >= 0 ? args[urlIndex + 1] : undefined))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { checkConfig };
