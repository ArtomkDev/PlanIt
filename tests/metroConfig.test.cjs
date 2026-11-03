const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const { blockList } = require('../metro.config.js').resolver;
const isBlocked = filename => blockList.some(pattern => pattern.test(filename));
const pathVariants = relative => {
  const absolute = path.resolve(root, relative);
  return [absolute, absolute.replaceAll('\\', '/'), absolute.replaceAll('/', '\\')];
};

test('Metro excludes local output directories with native and watcher-normalized separators', () => {
  for (const folder of ['.agents', '.codex', '.expo', '.firebase', '.git', '.idx', 'android', 'builds', 'credentials', 'dist', 'graphify-out', 'web-build']) {
    for (const relative of [folder, `${folder}/generated/file.js`]) {
      for (const filename of pathVariants(relative)) assert.equal(isBlocked(filename), true, filename);
    }
  }
});

test('Metro excludes generated Android dependency output that changes during native builds', () => {
  for (const dependency of ['react-native-reanimated', '@expo/example', 'outer/node_modules/inner']) {
    for (const directory of ['build', '.cxx', '.gradle']) {
      for (const relative of [`node_modules/${dependency}/android/${directory}`, `node_modules/${dependency}/android/${directory}/generated/file.js`]) {
        for (const filename of pathVariants(relative)) assert.equal(isBlocked(filename), true, filename);
      }
    }
  }
});

test('Metro keeps application code, dependency sources and similarly named directories visible', () => {
  for (const relative of [
    'index.js',
    'src/pages/Settings/components/LegalDocumentScreen.jsx',
    'src/config/development/collegeSchedule.js',
    'src/components/android/Example.jsx',
    'node_modules/expo/package.json',
    'node_modules/expo-dev-client/index.js',
    'node_modules/react-native-reanimated/src/index.ts',
    'node_modules/react-native-reanimated/android/build.gradle',
    'node_modules/react-native-reanimated/android/src/main/Example.java',
    'android-backup/index.js',
    'builds-source/index.js',
  ]) {
    for (const filename of pathVariants(relative)) assert.equal(isBlocked(filename), false, filename);
  }
});
