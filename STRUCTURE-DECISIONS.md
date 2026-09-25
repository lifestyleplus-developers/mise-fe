# mise-fe — Structural decisions

**Status: not finalized.** Recorded so we don't re-litigate them, not because they're locked. Flag anything here that should change.

| # | Decision | Choice | Notes |
| :-- | :-- | :-- | :-- |
| 1 | Routing | **Expo Router** | File-based routes in `app/`. |
| 2 | Folder structure | **Feature-based (Option B)** | `app/` for routes only; `features/<name>/` for feature-specific components, hooks and API calls; `shared/` for the base API client, constants, stores, and i18n. |
| 3 | Server state | **TanStack Query** | |
| 3 | Persisted local state | **Zustand** (+ AsyncStorage) | |
| 3 | Retry queue | **TanStack Query's built-in mutation queue** (`MutationCache`, `networkMode`, `resumePausedMutations`, `persistQueryClient`) | One fewer tool — configuration of the same library used for server state, rather than a second system. |
| 4 | API types | **Codegen from Lamax's OpenAPI schema, once it exists** | Nothing to decide today — the schema doesn't exist until Lamax's backend is live, so hand-write types against the API Contract's JSON examples until then. Optional: pre-pick a tool for later — `openapi-typescript` + `openapi-fetch` (lightweight), Orval (can generate TanStack Query hooks directly), or `swagger-typescript-api`. |
| 5 | Mocking the backend | **JSON fixtures in-repo, matching the API Contract's exact shapes** | Reverted from MSW: MSW's own docs call React Native support "potentially incomplete," and there are two open, unresolved GitHub issues — #2592 (MSW fails to intercept requests in the RN runtime at all) and #2367 (`TransformStream` missing in RN) — neither of which is Expo-specific, so `EXPO_PUBLIC_USE_RN_FETCH=1` wouldn't fix them. The API layer reads from fixtures for now; hooks and screens call the API layer and never know the difference. Swap happens inside the API layer only, later. Needs: simulated latency/errors (so loading/error states get built now, not skipped), and mutations that affect subsequent reads within a session. |
| 6 | Lint / format | **`expo lint` + Prettier** | Expo's default linter, paired with Prettier for formatting. |
| 7 | Shared constants file (roles, error codes, answer types) | **Not a separate decision — just do it** | Downgraded from "decide" to "do in five minutes whenever the first screen needs one." |
| 8 | Environment config | **Dummy value for now** | `API_BASE_URL` set to a placeholder until a real dev backend exists. Mechanism (`app.json` `extra` + `expo-constants`, `.env`, or EAS environment variables) still to be picked whenever a real value is needed. |

## Deferred

- **Testing setup** (Jest + React Native Testing Library, or similar) — explicitly deferred, not forgotten. Decide when the app has enough built to be worth testing.
