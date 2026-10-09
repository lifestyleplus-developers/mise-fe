const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const id = IS_PREVIEW ? 'com.mise.preview' : 'com.mise.app';

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
