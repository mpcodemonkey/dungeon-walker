const { withMainActivity } = require('@expo/config-plugins');

// react-native-health-connect requires this delegate to be registered in
// MainActivity so the permission request flow's result can be routed back
// to the library. expo-health-connect's own plugin only handles the
// AndroidManifest entries, not this — see docs/chunk-3-movement.md.
const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const CALL_LINE = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectMainActivity(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(
        'withHealthConnectMainActivity expects a Kotlin MainActivity (found: ' + config.modResults.language + ')'
      );
    }

    let contents = config.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      contents = contents.replace(/^(package .*)$/m, (packageLine) => `${packageLine}\n\n${IMPORT_LINE}`);
    }

    if (!contents.includes(CALL_LINE)) {
      contents = contents.replace(/(super\.onCreate\([^)]*\))/, (superCall) => `${superCall}\n    ${CALL_LINE}`);
    }

    config.modResults.contents = contents;
    return config;
  });
};
