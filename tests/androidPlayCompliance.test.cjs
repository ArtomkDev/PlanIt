const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

test('release AAB build archives and validates its matching R8 mapping', () => {
  const buildScript = fs.readFileSync(
    path.resolve(__dirname, '../scripts/build-aab.ps1'),
    'utf8',
  );
  const compliancePlugin = fs.readFileSync(
    path.resolve(__dirname, '../plugins/withAndroidPlayCompliance.js'),
    'utf8',
  );

  assert.match(buildScript, /outputs\\mapping\\release\\mapping\.txt/);
  assert.match(buildScript, /# compiler: R8/);
  assert.match(buildScript, /R8 mapping\.txt was not generated/);
  assert.match(buildScript, /\$LASTEXITCODE -ne 0/);
  assert.match(buildScript, /\$env:CI\s*=\s*"1"/);
  assert.match(buildScript, /\$env:NODE_ENV\s*=\s*"production"/);
  assert.doesNotMatch(buildScript, /--no-interactive/);
  assert.doesNotMatch(buildScript, /credentials\\gradle\.properties/);
  assert.match(buildScript, /android\.enableMinifyInReleaseBuilds/);
  assert.match(buildScript, /android\.enableShrinkResourcesInReleaseBuilds/);
  assert.match(buildScript, /android\.r8\.optimizedResourceShrinking/);
  assert.match(buildScript, /gradlew --stop/);
  assert.match(buildScript, /--no-parallel/);
  assert.match(buildScript, /after one controlled retry/);
  assert.match(buildScript, /-Xmx4096m/);
  assert.match(buildScript, /MaxMetaspaceSize=1024m/);
  assert.match(buildScript, /Copy-Item[^\r\n]+\$mappingSource[^\r\n]+\$mappingDest/);
  assert.match(buildScript, /com\.android\.tools\.build\.obfuscation\/proguard\.map/);
  assert.match(buildScript, /System\.Security\.Cryptography\.SHA256/);
  assert.match(buildScript, /Get-Sha256 -Path \$aabDest/);
  assert.match(buildScript, /Get-Sha256 -Path \$mappingDest/);
  assert.doesNotMatch(buildScript, /Get-FileHash/);
  assert.match(buildScript, /mappingEmbeddedInBundle/);
  assert.match(buildScript, /\.release\.json/);
  assert.match(compliancePlugin, /-Xmx4096m/);
  assert.match(compliancePlugin, /MaxMetaspaceSize=1024m/);
});
