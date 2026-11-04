# SPT-03 — Results and review · week 9

## References

- `mise-week-09.html` at the mise root: registry entry `SPT-03`, the state list that starts `default, run, override, noteMissing…`.
- Build plan: `BUILD-PLAN-WEEK-9.md` §2.4. FE Spec §3.11, API Contract §13, Model §18, Spot Checks §3 and §6, Schema `spot_check_result`.
- Routes: `/spot-checks/results` (the list, grouped by run) and `/spot-checks/results/[runId]` (one run's results, and the override sheet).
- Code: `features/spot-checks/results-screen.tsx` (the list), `run-results-screen.tsx` (one run), `override-sheet.tsx`, `results-errors.ts`, and the shared parts from step 1.3 (`outcome-badge.tsx`, `result-row.tsx`, `photo-tile.tsx`, `spot-outcome.ts`).
- **Built on mock data only**, as the build plan's ground rules say. `useOverrideSpotCheckResult` (step 1.2) and `mockOverrideSpotCheckResult` already existed; this step is the screens that call them.

## States defined by the mockup

Exactly 26, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend (password `1234`). Run ids are the mock's own fixtures (`shared/mocks/mock-db.ts`).

1. **default** — the list: a run per card (check name, subject, "Closed at {time}", and its tally), review items pinned first, then newest. _reshma or any head office sign-in, at `/spot-checks/results`._
2. **run** — one run's results: the header, the completion line, one row per assertion with its outcome, and the photographs. _Tap any row in the list._
3. **override** — the sheet: the assertion text as the title, Passed / Failed / Needs review, and a note. _Tap a result row whose outcome is not still being assessed._
4. **noteMissing** — Save stays off until there is a note, with "A note is required." under the field. _Open Override and leave the note empty._
5. **overrideFailed** — "Couldn't save. Can't reach mise.", the note kept. _Override with a note of `fault` (a 500) or `offline` (the mock's own network trigger)._
6. **overrideRefused** — "You can't change this result.", the note kept. _Override with a note of exactly `refused` (the mock's 403 trigger), or sign in as someone who is neither head office nor the run's own manager._
7. **overridden** — the badge keeps the assessment's own answer; "Overridden: Passed, by Reshma · 3:10 PM" and the note sit under it. _Run 8 ("name tag is visible"), already overridden in the fixtures._
8. **overriddenNoTime** — the same, with no time: "Overridden: Passed, by Arun". _Run 9, as arun — the fixtures give this one override no `overridden_at`._
9. ~~afterCloseFallback~~ — **Not reachable.** Fallback for a platform that refuses an override once a run is closed. The mock allows it at any time after assessment (`mockOverrideSpotCheckResult` only checks `ready_at`, not the window).
10. **partial** — "2 of 3 photos · assessed on these", and a dashed "Not taken" tile for the one not sent. _Run 5 (Imran, two of the check's three prompts)._
11. **replaced** — the retaken photograph and the one it replaced, each with its own time; the earlier one quieter. _Run 10 (Lakshmi), prompt 2 was retaken in the fixtures._
12. **assessing** — the outcome badge spins; "Being assessed" instead of a result. _Run 6, read in the first two minutes of a mock session (it closed just before the app started and its `ready_at` is two minutes out)._
13. **notDone** — "Not done. The window closed before any photo was taken.", no result rows. _Run 7 (Dev), nothing was sent._
14. **purged** — the photograph's tile reads "Photo removed under the photo retention policy" instead of the picture. _Run 12 (Joseph), revealed 40 days ago — past the 30-day retention window._
15. **filtered** — the chip row narrows the list to one outcome. _Pick Failed, Passed or Needs review above the list._
16. **filterEmpty** — "No results match this filter.", with Clear filter. _Pick a filter with nothing open under it (e.g. Needs review, once every review item at the outlet has been overridden)._
17. **ownOnly** — "Results aren't shown for a check assigned to someone else.", no badges, no tally. _Run 11 (Arun's run), as reshma — she can read the outlet but the outcomes are his._
18. ~~noIssueLink~~ — **Not reachable on the mock.** The mockup's fallback for a failed result with nothing to link to. The mock sets `issue_id` for every run that settles with a live failure, so the link always has somewhere to go here; it is the real platform, with Known Inconsistency #6 unresolved, that would need this.
19. **empty** — "No spot checks have closed yet." _Not reachable with the current fixtures: both spot-check outlets seed closed runs from the moment the mock session starts. Would show for an outlet switched on today with nothing closed yet._
20. **loading** — skeleton rows.
21. **loadFailed** — Retry above; what already loaded stays, with "Showing the last list" under it. _Open the screen offline; pull to refresh once loaded._
22. **moduleOff** — back to Modules with "Spot checks aren't turned on for {business}." _A 404, or switch spot checks off for every outlet._
23. **owner** — the same screen, read and overridden the same way. _priya._
24. **long** — a check name that wraps. _arun, outlet 5 (Elegance): any of runs 60–71, "Grooming — front of house"._
25. **many** — about 40 closed runs at one outlet, paged 25 at a time. _reshma or any head office sign-in, outlet 3 (ZamZam): runs 4–12 plus the 30 generated runs (20–49)._
26. **clock12** — "Closed at 2:30 PM", and every time following the phone's 12 or 24-hour clock. _Change the phone's clock._

## What the states pin down

- 🔒 **Three outcomes, not two.** A low-confidence result is Needs review, never Failed, and stays that way until someone overrides it. `outcome-badge.tsx` gives it its own colour, not red.
- **An override never replaces the original.** The assessment's own outcome is the badge on the row; the override is a second line under it, with who made it and when (dropped if the platform gives no time). `PATCH /spot-check-results/{id}` always carries both forward.
- **The note is required, both ways.** The sheet's Save stays off with nothing typed, and the platform's own 400 (`override_note_required`) is kept as the final answer if it is ever reached some other way.
- **Who can override.** Head office and the run's own manager; everyone else who can read the run sees no result rows at all (`ownOnly`), so there is nothing to tap.
- **The subject's own capture state carries over read-only.** A photograph still shows as sent, replaced or purged exactly as the capture screen (SPT-01) would show it; there is no Retake or Retry here.
- **Filtering is by outcome only**, and is the platform's own filter (`GET /spot-check-runs?state=closed&outcome=`), not a client-side narrowing of an already-fetched page.
- **"Issue raised" is a mock-only link** (Known Inconsistency #6: the Schema has no table tying an incident to a spot-check run). It opens the Issues tab, which is itself a Week 10 placeholder; nothing here is wired to a real issue.
