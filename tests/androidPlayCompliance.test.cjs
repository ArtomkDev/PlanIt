const assert = require('node:assert/strict');
const test = require('node:test');

const {
  patchAppBuildGradle,
} = require('../plugins/withAndroidPlayCompliance');

const template = `apply plugin: "com.android.application"

android {
    buildTypes {
        release {
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
}
`;

test('production hardening Gradle transform is complete and idempotent', () => {
  const once = patchAppBuildGradle(template);
  const twice = patchAppBuildGradle(once);

  assert.equal(twice, once);
  assert.match(once, /proguard-android-optimize\.txt/);
  assert.doesNotMatch(once, /getDefaultProguardFile\("proguard-android\.txt"\)/);
  assert.match(once, /com\.google\.android\.material:material:1\.14\.0/);
  assert.match(once, /play-services-code-scanner/);
  assert.match(once, /com\.google\.mlkit/);
  assert.equal(
    once.match(/com\.google\.android\.material:material:1\.14\.0/g).length,
    1,
  );
});

test('production hardening fails loudly for an unsupported Gradle template', () => {
  assert.throws(
    () => patchAppBuildGradle('apply plugin: "com.android.application"\n'),
    /Unable to find dependencies block/,
  );
});
