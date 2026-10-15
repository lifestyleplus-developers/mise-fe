# Deployment (Preview Build → TestFlight)

Preview build only. The `preview` profile in `eas.json` auto-increments the build number and uses `APP_VARIANT=preview`.

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

## Notes

- Track build progress at https://expo.dev under the project's Builds tab.
- The first submit may ask you to sign in to your Apple account.
- Production builds are not covered here.
