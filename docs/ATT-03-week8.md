# ATT-03 — Staff roster · staff edit · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `ATT-03`, the state list that starts `default, search, searchEmpty, add…`.
- Build plan: `BUILD-PLAN-WEEK-8.md` §2.2. FE Spec §3.9 (attendance), API Contract §11, Model §18.
- Route: `/attendance/roster`, from Modules → Attendance → Roster. The Attendance Manager (own outlets) and ADMIN / OWNER.
- Code: `features/attendance/roster-screen.tsx`, `staff-sheets.tsx`, `use-roster.ts`, `use-attendance-outlets.ts`.

## States defined by the mockup

Exactly 23, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — twelve people at ZamZam, Add staff pinned under the list. _raheem._
2. **search** — typed "Jo": Joseph. _Type in the search field._
3. **searchEmpty** — "No one called 'Sam' at ZamZam." _Search for a name that is not there._
4. **add** — the Add staff sheet, name field first. _Add staff._
5. **addFilled** — a name typed, Save enabled. _Type a name._
6. **added** — "{name} added. {name} will appear from the next session." _Save the new person._
7. **edit** — a person's sheet: name, code, Works at, Archive. _Tap Lakshmi._
8. **editTwoOutlets** — Joseph, on at ZamZam and Elegance. _Tap Joseph._
9. **deactivateConfirm** — "Take {name} off {outlet}'s list?" with "Past attendance stays as recorded." _Switch an outlet off, then Save._
10. **archiveConfirm** — "Archive {name}?" _Archive in the sheet. Administrators only._
11. **showArchived** — Show archived and Show deactivated add Ravi and Farid, with a word each. _Turn both on._
12. **saving** — a spinner in Save, the form locked. _Save; it lasts about a second on the mock._
13. **saveFailed** — "Couldn't save. Can't reach mise.", the form kept, Save again. _Name the person "offline"._
14. **serverError** — the platform's own message above the fields. _Give a code another person already has (IN-014)._
15. **roleLost** — a save answered 403: "You can't change the staff list for this outlet." above the fields, the sheet kept. The app then asks for the list again; if that is refused too, the screen shows "You can't see this outlet's attendance." and nothing else. _As meera, rename Joseph (he also works at Elegance, which she does not manage): the first case. Remove her as manager of Morning from raheem's phone and pull to refresh: the second._
16. **empty** — "No staff at {outlet} yet." _Switch attendance on for an outlet in Outlets, then open Roster there._
17. **loading** — skeleton rows.
18. **loadFailed** — Retry above the list. _Search "fault"._
19. **manager** — Meera: her one outlet, no outlet chip, no Archive. _meera._
20. ~~readOnly~~ — **Not reachable.** A fallback for an API that lets a manager read but not write; the platform lets managers edit their outlets' people, and a refused write is state 15. Not built.
21. **singleOutlet** — no outlet chip and no Works at. _meera (one outlet). Not reachable for an administrator: the mock has three outlets with attendance._
22. **moduleOff** — attendance switched off while the screen is open: back to Modules with "Attendance isn't turned on for {outlet}." _Turn the outlet's attendance off in Outlets, then pull to refresh._
23. **long** — a 41-character name and Malayalam script wrap. _Elegance (long name), ZamZam (Malayalam name)._

## What the states pin down

- **List.** People active at the chosen outlet and not archived, by name. Each row: avatar, name, code (if any), and a word with an icon: Active, Not active here, Archived. Archived rows are not tappable.
- **Show deactivated** adds people taken off this outlet; **Show archived** adds archived people who were on it. Both are off by default. The platform's outlet filter lists only people active there, so with Show deactivated on the app asks for the whole roster and keeps the rows with a place at this outlet, loading every page.
- **Search** is by name or code, on the platform.
- **Add staff** is pinned under the list, hidden when the list is refused. Name is required, code is optional ("Your own reference, if you use one") and unique in the business. Works at lists the outlets this person may manage, with the current outlet on; it is left out when there is only one.
- **Edit** saves the name and code, then each outlet that was switched. Taking someone off an outlet asks first; the record stays. Archive removes the person from every roster; it is for administrators only, not managers.
- **A new person** appears from the next session. Open sessions keep the roster they opened with.
- **Errors.** A 400 shows the platform's message above the fields. A 403 on a save keeps the sheet and shows why, because it can be about one person (someone who also works where the manager does not); the list is re-read to find out whether the whole role has gone. A 404 means the module is off: back to Modules with a notice. Anything else is "Couldn't save".
- **No score, no counts.** Roster is people only.
