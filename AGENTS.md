## Running the app

Package manager is pnpm (see `.npmrc` and `packageManager` in `package.json`).

```bash
pnpm install       # install dependencies
pnpm start         # start the dev server (then choose a platform, or scan the QR code in Expo Go)
pnpm android       # start and open on Android
pnpm ios           # start and open on iOS
pnpm web           # start and open in a browser
pnpm lint          # expo lint
pnpm format        # prettier --write .
```

## Architecture

**Don't scaffold ahead of a real need.** Several items below have a tool chosen but nothing built yet — build them alongside the first screen that actually needs them (Login is the natural first candidate: it touches server state, the retry queue, mocking, constants, and env config all at once), not speculatively ahead of one.

- **Routing:** Expo Router. File-based routes in `app/` — routes only, no other code lives there. _(Done.)_
- **Folder structure:** Feature-based. `app/` for routes; `features/<name>/` for feature-specific components, hooks and API calls; `shared/` for cross-cutting code (API client, constants, stores, i18n). _(Done — `features/` and `shared/` exist, empty until something needs them.)_
- **Server state:** TanStack Query. Not wired yet. Leave `networkMode` on its default (`'online'`) — that already gives offline-safe pause/resume behavior for both queries and mutations, no custom retry loop needed.
- **Persisted local state:** Zustand + AsyncStorage. Not used yet — create a store only when something concrete needs persisting (e.g. a session), not speculatively.
- **Retry queue:** Not a separate system — it's TanStack Query's own `MutationCache` / `networkMode` / `resumePausedMutations` / `persistQueryClient`, configured on the same client as "Server state" above. A persisted/paused mutation can't carry its original function reference across an app restart (functions don't serialize), so register `queryClient.setMutationDefaults(mutationKey, { mutationFn })` for each mutation at the point it's defined.
- **API types:** No codegen yet — Lamax's OpenAPI schema doesn't exist until their backend (`mise-be`) is live. Hand-write types against the API Contract's JSON examples until then. Candidates for later, none chosen: `openapi-typescript` + `openapi-fetch` (lightweight), Orval (generates TanStack Query hooks directly), `swagger-typescript-api`.
- **Mocking the backend:** JSON fixtures in-repo matching the API Contract's exact shapes — not MSW. MSW's own docs call React Native support "potentially incomplete," and issues #2592 (fails to intercept in the RN runtime at all) and #2367 (`TransformStream` missing) are open and unresolved on the RN runtime itself, unrelated to Expo's `fetch`. The API layer reads from fixtures now and swaps internally once real endpoints exist — hooks and screens never change. Fixtures need simulated latency/errors (so loading/error states actually get exercised) and mutations that affect subsequent reads within a session.
- **Lint / format:** `expo lint` + Prettier (`singleQuote: true`). _(Done — see `eslint.config.js`, `.prettierrc.json`, `.prettierignore`.)_
- **Shared constants:** Role codes, error codes, and answer types belong in `shared/constants/`, typed — not copy-pasted string literals across screens. Create this the moment the first screen needs one of these, not before.
- **Environment config:** `API_BASE_URL` is a placeholder until a real dev backend exists. Mechanism not yet chosen — `app.json`'s `extra` field + `expo-constants`, `.env`, or EAS environment variables — decide when a real value is actually needed.
- **Testing:** Deferred, not forgotten. Not set up yet. Jest + React Native Testing Library are the likely candidates when it's time.
