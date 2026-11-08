const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { getAndroidVersionCode } = require('../src/config/appVersion.cjs');

const {
  patchAppBuildGradle,
  patchProjectBuildGradle,
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

test('the root compiler uses the configured Kotlin version before native library plugins load', () => {
  const source = `buildscript { dependencies { classpath('org.jetbrains.kotlin:kotlin-gradle-plugin') } }`;
  const patched = patchProjectBuildGradle(source);
  assert.match(patched, /kotlin-gradle-plugin:\$\{findProperty\('android.kotlinVersion'\)\}/);
  assert.equal(patchProjectBuildGradle(patched), patched);
  assert.throws(() => patchProjectBuildGradle('buildscript {}'), /root Kotlin Gradle plugin dependency/);
});

test('release manifest blocks permissions PlanIt does not use', () => {
  const appConfig = fs.readFileSync(path.resolve(__dirname, '../app.config.js'), 'utf8');
  const blocked = appConfig.match(/blockedPermissions:\s*\[([^\]]*)\]/)?.[1] || '';
  assert.match(blocked, /"android\.permission\.RECORD_AUDIO"/);
  assert.match(blocked, /"android\.permission\.SYSTEM_ALERT_WINDOW"/);

  const attachmentService = fs.readFileSync(
    path.resolve(__dirname, '../src/services/attachmentService.js'),
    'utf8',
  );
  const mediaTypes = [...attachmentService.matchAll(/mediaTypes:\s*(\[[^\]]*\])/g)].map(match => match[1]);
  assert.ok(mediaTypes.length > 0);
  for (const types of mediaTypes) assert.equal(types, '["images"]');
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
  assert.match(buildScript, /Set ANDROID_HOME to an installed Android SDK before building/);
  assert.ok(buildScript.indexOf('$env:ANDROID_HOME =') < buildScript.indexOf('& npx expo prebuild'));
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

test('development APK validation rejects release and plain debug builds before installation', { skip: process.platform !== 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'planit-dev-apk-test-'));
  const fixture = path.join(directory, 'app.apk');
  fs.writeFileSync(fixture, 'manifest inspection fixture');
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  try {
    const command = `
      $ErrorActionPreference = 'Stop'
      $devTokens = $null
      $devErrors = $null
      $devAst = [System.Management.Automation.Language.Parser]::ParseFile(${quote(path.resolve(__dirname, '../scripts/build-dev.ps1'))}, [ref]$devTokens, [ref]$devErrors)
      if ($devErrors.Count) { throw $devErrors[0] }
      $devGuard = $devAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-DevelopmentApk' }, $true)
      . ([scriptblock]::Create($devGuard.Extent.Text))
      function Invoke-TestAapt {
        param($operation, $kind, $apk, $resource)
        $global:LASTEXITCODE = 0
        if ($script:devScenario -eq 'tool-failed') { $global:LASTEXITCODE = 1; return }
        if ($kind -eq 'badging') {
          "package: name='com.artomk.planit' versionName='0.1.81'"
          if ($script:devScenario -ne 'release') { 'application-debuggable' }
        } elseif ($script:devScenario -ne 'plain-debug') {
          'expo.modules.devlauncher.launcher.DevLauncherActivity'
        }
      }
      $devResults = foreach ($devCase in @('valid', 'release', 'plain-debug', 'tool-failed')) {
        $script:devScenario = $devCase
        try {
          $devPackage = Assert-DevelopmentApk -Path ${quote(fixture)} -AaptPath 'Invoke-TestAapt'
          [pscustomobject]@{ scenario = $devCase; accepted = $true; package = $devPackage }
        } catch {
          [pscustomobject]@{ scenario = $devCase; accepted = $false; error = $_.Exception.Message }
        }
      }
      ConvertTo-Json -InputObject @($devResults) -Compress
    `;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr);
    const cases = JSON.parse(result.stdout);
    assert.deepEqual(cases.map(({ scenario, accepted }) => [scenario, accepted]), [
      ['valid', true], ['release', false], ['plain-debug', false], ['tool-failed', false],
    ]);
    assert.equal(cases[0].package, 'com.artomk.planit');
    assert.match(cases[1].error, /non-debuggable/);
    assert.match(cases[2].error, /without Expo Dev Client/);
    assert.match(cases[3].error, /Unable to inspect/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Android version codes remain increasing after patch 99 and across minor and major releases', () => {
  const versions = ['0.1.81', '0.1.99', '0.1.100', '0.1.9999', '0.2.0', '0.99.9999', '1.0.0'];
  const codes = versions.map(getAndroidVersionCode);
  assert.ok(codes[0] > 181);
  for (let index = 1; index < codes.length; index++) assert.ok(codes[index] > codes[index - 1]);
  for (const version of ['0.0.0', '0.100.0', '0.1.10000', '999999.0.0', '1.2', '1.2.3-beta']) {
    assert.throws(() => getAndroidVersionCode(version));
  }
});
