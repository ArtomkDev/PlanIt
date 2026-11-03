const getAndroidVersionCode = (version) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid app version: ${version}`);
  const [major, minor, patch] = version.split('.').map(Number);
  const code = major * 1000000 + minor * 10000 + patch;
  if (minor > 99 || patch > 9999 || !Number.isSafeInteger(code) || code < 1 || code > 2100000000) {
    throw new Error(`App version is outside the Android version-code range: ${version}`);
  }
  return code;
};

module.exports = { getAndroidVersionCode };
