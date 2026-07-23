// Overrides the Google Services Gradle plugin version Expo injects
// automatically (@expo/config-plugins' GoogleServices.js hardcodes 4.4.4,
// with no app.config.js-level option to change it — confirmed by reading
// its source, and expo-build-properties doesn't cover this plugin either,
// it's a separate injection path entirely). Runs as a plugin in its own
// right so it executes after Expo's base config resolution has already
// added the `classpath 'com.google.gms:google-services:4.4.4'` line to
// android/build.gradle, and just bumps the version string in place.
const { withProjectBuildGradle } = require('@expo/config-plugins');

const CLASSPATH = 'com.google.gms:google-services';

module.exports = function withGoogleServicesVersion(config, version) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withGoogleServicesVersion: expected a groovy android/build.gradle');
    }
    const pattern = new RegExp(`classpath '${CLASSPATH}:[^']+'`);
    if (!pattern.test(config.modResults.contents)) {
      throw new Error(
        `withGoogleServicesVersion: could not find "${CLASSPATH}" classpath line to patch — Expo's own google-services injection may have changed.`,
      );
    }
    config.modResults.contents = config.modResults.contents.replace(pattern, `classpath '${CLASSPATH}:${version}'`);
    return config;
  });
};
