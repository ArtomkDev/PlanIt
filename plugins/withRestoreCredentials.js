const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withFinalizedMod,
  withMainApplication,
} = require('@expo/config-plugins');

const CREDENTIALS_VERSION = '1.6.0';
const DEPENDENCIES = [
  `implementation "androidx.credentials:credentials:${CREDENTIALS_VERSION}"`,
  `implementation "androidx.credentials:credentials-play-services-auth:${CREDENTIALS_VERSION}"`,
];
const SOURCE_FILES = ['RestoreCredentialsModule.java', 'RestoreCredentialsPackage.java'];

const withRestoreCredentials = (config) => {
  const packageName = config.android?.package;
  if (!packageName) throw new Error('android.package is required for Restore Credentials');

  config = withAppBuildGradle(config, (gradleConfig) => {
    for (const dependency of DEPENDENCIES) {
      if (!gradleConfig.modResults.contents.includes(dependency)) {
        gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
          /dependencies\s*\{/,
          `dependencies {\n    ${dependency}`,
        );
      }
    }
    return gradleConfig;
  });

  config = withMainApplication(config, (mainApplicationConfig) => {
    let source = mainApplicationConfig.modResults.contents;
    const importLine = `import ${packageName}.restorecredentials.RestoreCredentialsPackage`;
    if (!source.includes(importLine)) {
      source = source.replace(/(package\s+[^\r\n]+\r?\n)/, `$1\n${importLine}\n`);
    }
    if (!source.includes('add(RestoreCredentialsPackage())')) {
      source = source.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        '$1\n              add(RestoreCredentialsPackage())',
      );
    }
    if (!source.includes('add(RestoreCredentialsPackage())')) {
      throw new Error('Unable to register RestoreCredentialsPackage in MainApplication');
    }
    mainApplicationConfig.modResults.contents = source;
    return mainApplicationConfig;
  });

  return withFinalizedMod(config, ['android', (finalizedConfig) => {
    const sourceDir = path.join(
      finalizedConfig.modRequest.platformProjectRoot,
      'app', 'src', 'main', 'java',
      ...packageName.split('.'),
      'restorecredentials',
    );
    fs.mkdirSync(sourceDir, { recursive: true });
    for (const file of SOURCE_FILES) {
      const source = fs.readFileSync(path.join(__dirname, 'restore-credentials', file), 'utf8')
        .replaceAll('__PACKAGE__', packageName);
      fs.writeFileSync(path.join(sourceDir, file), source);
    }
    return finalizedConfig;
  }]);
};

module.exports = withRestoreCredentials;
