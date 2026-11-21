const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

// A build made by EAS sets APP_VARIANT. Without the platform's address it would
// run on the built-in mock, so stop the build here instead of shipping that.
if (process.env.APP_VARIANT && !process.env.EXPO_PUBLIC_API_BASE_URL) {
  throw new Error(
    `EXPO_PUBLIC_API_BASE_URL is not set for the "${process.env.APP_VARIANT}" build. Set it in that profile's env in eas.json.`,
  );
}

const id = IS_PREVIEW
  ? 'com.lifestyleplus.mise.preview'
  : 'com.lifestyleplus.mise';

module.exports = ({ config }) => ({
  ...config,
  name: IS_PREVIEW ? 'Mise (Preview)' : 'Mise',
  ios: {
    ...config.ios,
    bundleIdentifier: id,
    buildNumber: '1',
    infoPlist: {
      ...config.ios?.infoPlist,
      NSCameraUsageDescription:
        'Mise uses the camera to capture photos for checklist tasks.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    ...config.android,
    package: id,
    permissions: ['CAMERA'],
  },
});
