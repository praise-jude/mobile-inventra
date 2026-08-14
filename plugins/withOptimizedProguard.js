// Expo's generated android/app/build.gradle hardcodes
// getDefaultProguardFile("proguard-android.txt") as R8's base ruleset —
// confirmed by reading the generated file directly, no expo-build-properties
// option covers this (its Android config type only exposes
// enableMinifyInReleaseBuilds/enableShrinkResourcesInReleaseBuilds/
// extraProguardRules, nothing for the base ruleset file itself). That base
// file carries a `-dontoptimize` directive (Android's own docs: "Support
// for getDefaultProguardFile("proguard-android.txt") has been dropped,
// because it includes -dontoptimize, which should be avoided"), which is
// exactly the "Optimization isn't enabled" finding Play Console's
// pre-launch report flags — minification/obfuscation still run, but R8's
// actual optimization passes (inlining, dead-code elimination beyond
// simple shrinking, etc.) are switched off. Swaps in
// proguard-android-optimize.txt instead, same pattern as
// withGoogleServicesVersion.js for patching a value Expo's own config
// resolution hardcodes with no app.config.js-level override.
const { withAppBuildGradle } = require('@expo/config-plugins');

const OLD_FILE = 'proguard-android.txt';
const NEW_FILE = 'proguard-android-optimize.txt';

module.exports = function withOptimizedProguard(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withOptimizedProguard: expected a groovy android/app/build.gradle');
    }
    const pattern = new RegExp(`getDefaultProguardFile\\(["']${OLD_FILE}["']\\)`);
    if (!pattern.test(config.modResults.contents)) {
      throw new Error(
        `withOptimizedProguard: could not find getDefaultProguardFile("${OLD_FILE}") to patch — Expo's own build.gradle template may have changed.`,
      );
    }
    config.modResults.contents = config.modResults.contents.replace(pattern, `getDefaultProguardFile("${NEW_FILE}")`);
    return config;
  });
};
