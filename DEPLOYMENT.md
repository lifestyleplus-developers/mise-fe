# Deployment (Preview Build → TestFlight / Android APK)

Preview build only. The `preview` profile in `eas.json` auto-increments the build number (iOS) / version code (Android) and uses `APP_VARIANT=preview`. On Android it produces an installable `.apk` (`android.buildType: "apk"`), not an `.aab`.

## One-time setup

```bash
pnpm install
npm i -g eas-cli
eas login
```

## Release steps

1. Make sure your changes are committed and the checks pass:

   ```bash
   pnpm do
   ```

2. (Only for a new version number) bump `version` in `app.json`. Skip this for a new build of the same version, since the build number auto-increments.

3. Build the iOS preview:

   ```bash
   eas build --platform ios --profile preview
   ```

4. Submit it to App Store Connect / TestFlight:

   ```bash
   eas submit --platform ios --profile preview --latest
   ```

   Or do both in one command:

   ```bash
   eas build --platform ios --profile preview --auto-submit
   ```

5. Wait for Apple to finish processing (about 5–15 minutes). The build then appears in App Store Connect → TestFlight.

6. In TestFlight, add the build to your tester group (answer the export compliance question if asked).

## Android (APK)

The same `preview` profile builds Android. No store submission is involved: you download the APK and install it directly.

1. Build the APK:

   ```bash
   eas build --platform android --profile preview
   ```

   To build both platforms at once, use `--platform all`.

2. The first Android build asks whether to generate a keystore. Answer yes and let EAS manage it. It is stored on Expo's servers and reused by every later build, so every update installs over the previous one. Don't let it be regenerated: a new keystore means testers must uninstall first.

3. When the build finishes (about 10–20 minutes), the CLI prints a link and a QR code. The same APK is under the project's Builds tab at https://expo.dev. Open the link on the phone, or download it and share the file.

4. Install on the device:
   - On the phone, open the build link and download the APK, then tap it to install. Android will ask you to allow installs from that source (browser or file manager) the first time.
   - Or from a computer with the phone connected over USB (USB debugging on): `adb install path/to/app.apk`.

The preview app installs as **Mise (Preview)** with package `com.lifestyleplus.mise.preview` (set in `app.config.js`), so it sits beside a production install rather than replacing it.

To get a direct download link without opening the Expo dashboard, run `eas build:list --platform android --limit 1`.

## Which server the build talks to

The address of the platform is `EXPO_PUBLIC_API_BASE_URL`, set in each profile's `env` in `eas.json` (currently the Railway backend, ending in `/api/v1`). It has to be there: `mise-fe/.env` is gitignored, so EAS cloud builds never see it, and a build without the variable silently runs on the app's built-in mock. The value is a public address, so it is safe to commit. Never put a secret in an `EXPO_PUBLIC_` variable.

When there are separate test and live servers, give each profile its own address.

The build talks to the real platform, so only what is wired works. Home is empty, and the Run screen, answering and photo tasks fail until the runs and uploads endpoints land (see `API-INTEGRATION.md` §2). Testers sign in with the accounts on that server, not the mock's.

## Notes

- Track build progress at https://expo.dev under the project's Builds tab.
- The first submit may ask you to sign in to your Apple account.
- Android has no submit step here. The APK is only for direct installs, and the Play Store would need an `.aab` production build, which is not covered.
- Production builds are not covered here.
