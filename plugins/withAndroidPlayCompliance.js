const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withFinalizedMod,
  withGradleProperties,
} = require('@expo/config-plugins');

const MATERIAL_VERSION = '1.14.0';
const OPTIMIZED_RESOURCE_SHRINKING = 'android.r8.optimizedResourceShrinking';
const DEPENDENCY_BLOCK_START = '// @generated begin planit-play-compliance';
const DEPENDENCY_BLOCK_END = '// @generated end planit-play-compliance';

const RELEASE_DEPENDENCY_RULES = `${DEPENDENCY_BLOCK_START}
// expo-dev-client is useful in debug builds, but its QR scanner is not part of
// the production app. Excluding the scanner only from release keeps ML Kit's
// portrait-only delegate activity and unused scanner code out of the Play AAB.
configurations.configureEach { configuration ->
    if (configuration.name.toLowerCase().contains("release")) {
        configuration.exclude group: "com.google.android.gms", module: "play-services-code-scanner"
        configuration.exclude group: "com.google.mlkit", module: "barcode-scanning"
    }
}
${DEPENDENCY_BLOCK_END}`;

const MATERIAL_DEPENDENCY =
  `implementation("com.google.android.material:material:${MATERIAL_VERSION}")`;
const RELEASE_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
  <application>
    <!-- expo-dev-launcher's barcode module is debug-only in PlanIt. -->
    <meta-data
        android:name="com.google.mlkit.vision.DEPENDENCIES"
        tools:node="remove" />
  </application>
</manifest>
`;

const upsertGradleProperty = (properties, key, value) => {
  const existing = properties.find(
    (property) => property.type === 'property' && property.key === key,
  );
  if (existing) {
    existing.value = value;
    return;
  }
  properties.push({ type: 'property', key, value });
};

const removeGeneratedBlock = (source) => {
  const start = source.indexOf(DEPENDENCY_BLOCK_START);
  if (start === -1) return source;
  const end = source.indexOf(DEPENDENCY_BLOCK_END, start);
  if (end === -1) {
    throw new Error('Incomplete PlanIt Play compliance block in app/build.gradle');
  }
  return `${source.slice(0, start)}${source.slice(end + DEPENDENCY_BLOCK_END.length)}`;
};

const patchAppBuildGradle = (source) => {
  let patched = removeGeneratedBlock(source)
    .trimStart()
    .replace(
      new RegExp(`\\s*implementation\\(["']com\\.google\\.android\\.material:material:[^"']+["']\\)`, 'g'),
      '',
    )
    .replace(
      /getDefaultProguardFile\(["']proguard-android\.txt["']\)/g,
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    )
    .trimEnd();

  const dependenciesMatch = /dependencies\s*\{/.exec(patched);
  if (!dependenciesMatch) {
    throw new Error('Unable to find dependencies block in app/build.gradle');
  }
  const insertionPoint = dependenciesMatch.index + dependenciesMatch[0].length;
  patched = `${patched.slice(0, insertionPoint)}\n    ${MATERIAL_DEPENDENCY}${patched.slice(insertionPoint)}`;

  return `${RELEASE_DEPENDENCY_RULES}\n\n${patched}\n`;
};

const withAndroidPlayCompliance = (config) => {
  config = withAndroidManifest(config, (manifestConfig) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      manifestConfig.modResults,
    );
    delete mainActivity.$['android:screenOrientation'];
    return manifestConfig;
  });

  config = withGradleProperties(config, (gradleConfig) => {
    upsertGradleProperty(
      gradleConfig.modResults,
      OPTIMIZED_RESOURCE_SHRINKING,
      'true',
    );
    return gradleConfig;
  });

  config = withAppBuildGradle(config, (buildGradleConfig) => {
    if (buildGradleConfig.modResults.language !== 'groovy') {
      throw new Error('PlanIt Play compliance plugin expects Groovy app/build.gradle');
    }
    buildGradleConfig.modResults.contents = patchAppBuildGradle(
      buildGradleConfig.modResults.contents,
    );
    return buildGradleConfig;
  });

  config = withFinalizedMod(config, ['android', (finalizedConfig) => {
    const releaseManifestPath = path.join(
      finalizedConfig.modRequest.platformProjectRoot,
      'app',
      'src',
      'release',
      'AndroidManifest.xml',
    );
    fs.mkdirSync(path.dirname(releaseManifestPath), { recursive: true });
    fs.writeFileSync(releaseManifestPath, RELEASE_MANIFEST);
    return finalizedConfig;
  }]);

  return config;
};

module.exports = withAndroidPlayCompliance;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
