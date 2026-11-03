const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const escapeForRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
// Metro's watcher normalizes Windows paths before matching exclusions.
const projectPathPattern = projectRoot.split(path.sep).map(escapeForRegex).join('[/\\\\]');

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
  return new RegExp(`^${projectPathPattern}[/\\\\]${escapeForRegex(folder)}(?:[/\\\\].*)?$`);
});
const nativeDependencyBuilds = new RegExp(
  `^${projectPathPattern}[/\\\\]node_modules[/\\\\].*[/\\\\]android[/\\\\](?:build|\\.cxx|\\.gradle)(?:[/\\\\].*)?$`
);

const config = getDefaultConfig(projectRoot);
config.resolver.blockList = [config.resolver.blockList, ...localOnlyBlockList, nativeDependencyBuilds].flat();
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
