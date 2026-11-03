const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const config = require('../firebase.json');
// npx exposes its temporary dependency on PATH, outside the project's modules.
const cli = require.resolve('firebase-tools/lib/bin/firebase.js', {
  paths: (process.env.PATH || '').split(path.delimiter).map(directory => path.dirname(directory)),
});
const temporaryRoot = fs.realpathSync(os.tmpdir());
const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'planit-rules-'));

try {
  fs.writeFileSync(path.join(temporary, 'firebase.json'), JSON.stringify({
    firestore: { rules: path.join(root, config.firestore.rules) },
    storage: { rules: path.join(root, config.storage.rules) },
    emulators: config.emulators,
  }));
  fs.writeFileSync(path.join(temporary, 'run-tests.cjs'), `
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, ['--test', ${JSON.stringify(path.join(root, 'tests/firebaseRules.integration.cjs'))}], { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  `);
  const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--only', 'firestore,storage',
    '--project', 'demo-planit-release', '--config', path.join(temporary, 'firebase.json'), 'node run-tests.cjs'], {
    cwd: temporary,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  const cleanupPath = fs.realpathSync(temporary);
  if (path.dirname(cleanupPath) !== temporaryRoot) throw new Error('Unexpected emulator output directory.');
  fs.rmSync(cleanupPath, { recursive: true, force: true });
}
