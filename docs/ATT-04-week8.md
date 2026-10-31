# ATT-04 — Attendance configuration · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `ATT-04`, the state list that starts `default, noName, empty, new…`.
- Build plan: `BUILD-PLAN-WEEK-8.md` §2.3. FE Spec §3.9, API Contract §11 (and §5 for the schedule rules), Model §18.
- Routes: `/attendance/configs` (the list), `/attendance/configs/new?outlet=ID` and `/attendance/configs/[id]` (the editor). ADMIN and OWNER only; a manager only reads the sessions of their own configurations, elsewhere.
- Code: `features/attendance/configs-screen.tsx`, `config-editor-screen.tsx`, `config-managers.tsx`, `config-form.ts`, `config-errors.ts`, `config-text.ts`. The schedule fields are the checklist editor's, with no Hourly.

## States defined by the mockup

Exactly 28, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — Early shift, Morning (Meera), Evening (no manager yet) at ZamZam. _raheem._
2. ~~noName~~ — **Not reachable.** A fallback for a configuration sent without a name; the platform requires one. The list and heading do fall back to the schedule ("Daily · 8:00 AM") if one ever arrives.
3. **empty** — "No attendance sessions set up for {outlet}." _Switch attendance on for Icefruits in Outlets, then open Configurations there._
4. **new** — an empty editor, Save disabled until the name, opening time and window are chosen. _Add configuration._
5. **newFilled** — Evening 4:00 PM, 1 h, Save enabled. _Fill the form._
6. **edit** — Morning with Meera under Attendance Managers. _Tap Morning._
7. ~~hourly~~ — **Dropped.** The platform refuses Hourly for attendance (400 on `recurrence`); the editor offers Daily, Weekly and Monthly. A second session in a day is a second configuration.
8. **pickTime** — the time picker, in the phone's 12 or 24-hour clock. _Opens at._
9. **pickWindow** — the window picker, hours and minutes. _Open for._
10. **pickWindowZero** — at 0 h 00 min. The shared picker accepts it and the form then says "The window must be at least 5 minutes." instead of disabling Done, as the checklist editor does. _Differs from the mockup._
11. **overlap** — a 25-hour daily window: "The window must close before the next run opens (the day)." shown at once, and again if the platform answers 409. _Open for 25 h._
12. **appoint** — the people list; those already managing are greyed "Manager here". _Add Attendance Manager._
13. **appointing** — a spinner on the chosen row while it saves.
14. **appointed** — "{name} is now an Attendance Manager for {cfg}." _Pick someone._
15. **removeConfirm** — "Remove {name} as Attendance Manager for {cfg}?" _The × beside a manager._
16. **removeLast** — the same dialog, warning "Nobody will be able to mark {cfg}." _Remove the only manager._
17. ~~noRemove~~ — **Not reachable.** A fallback for an API with no way to remove a manager; the platform has one.
18. **saving** — a spinner in Save, the form locked. _Save._
19. **saveFailed** — "Couldn't save. Can't reach mise.", the form kept. _Name it "offline"._
20. **serverError** — the platform's message above the fields. _Name it like another session at the outlet ("Morning")._
21. **roleLost** — a save answered 403: "Only Owners and Administrators can change attendance sessions.", the editor read-only, no Save. _Save after being demoted._
22. **discard** — Back with changes asks "Discard changes?". _Edit, then Back._
23. **loading** — skeleton cards (list) or a skeleton form (editor).
24. **loadFailed** — Retry above the list. _Go offline and pull to refresh._
25. **singleOutlet** — no outlet chip. _Not reachable: the mock has three outlets with attendance._
26. **moduleOff** — attendance switched off while open: back to Modules with "Attendance isn't turned on for {outlet}." _Turn the outlet's attendance off in Outlets, then pull to refresh._
27. **forbidden** — a 403 on the list: "Only Owners and Administrators can change attendance sessions." The entry is absent for a manager, and the route sends her to More. _The banner needs a 403 from the platform._
28. **long** — a 41-character name wraps. _Name one "Weekend Brunch Service Opening Team Count"._

## What the states pin down

- **List.** One card per configuration at the chosen outlet: name, "Daily · 8:00 AM · open for 1 h" (Weekly shows the days, Monthly the day), then its managers or "No Attendance Manager yet". The outlet chip is left out with one outlet. Add configuration is pinned under the list.
- **Editor.** Name, Method (one option, kept as a selector), how often, the days or day of the month, opens at, open for, and when it closes. "Changes apply to sessions not yet created." shows on an existing one.
- **New.** Saving goes straight on to appointing a manager ("Save and add a manager"): nobody can mark it without one.
- **Rules the app mirrors.** Name required; window at least 5 minutes; Weekly needs a day; the window cannot run into the next period. The platform's 400 and 409 answers are final.
- **Managers.** Appointing and removing are saved at once, not with Save. A removed manager can be appointed again; past marks keep their name.
- **Leaving.** Back with unsaved changes asks first; a saved one does not.
