const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;
const path = require('path');

const projectRoot = __dirname;

const escapeForRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

const localOnlyFolders = [
  '.agents',
  '.codex',
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
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolution = context.resolveRequest(context, moduleName, platform);
  const files = resolution.type === 'sourceFile' ? [resolution.filePath]
    : resolution.type === 'assetFiles' ? resolution.filePaths : [];
  if (context.dev !== true && files.some(file => {
    const relative = path.relative(path.join(projectRoot, 'src'), file);
    return !relative.startsWith('..') && relative.split(path.sep).includes('development');
  })) {
    throw new Error('Development modules must be removed before release dependency resolution.');
  }
  return resolution;
};

module.exports = config;
