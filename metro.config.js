const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;
const path = require('path');

const projectRoot = __dirname;

const escapeForRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

const localOnlyFolders = [
  '.agents',
  '.codex',
  '.codex-build-check',
  '.codex-build-check-web',
  '.codex-doc-review',
  '.codex-verify-export',
  '.expo',
  '.firebase',
  '.git',
  '.idx',
  'android',
  'builds',
  'credentials',
  'dist',
  'graphify-out',
  'web-build',
];

const localOnlyBlockList = localOnlyFolders.map((folder) => {
  const folderPath = escapeForRegex(path.join(projectRoot, folder));
  return new RegExp(`${folderPath}\\\\.*`);
});

const config = getDefaultConfig(projectRoot);
config.resolver.blockList = exclusionList(localOnlyBlockList);

module.exports = config;
