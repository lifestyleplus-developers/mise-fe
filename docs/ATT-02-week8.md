# ATT-02 — Session history · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `ATT-02`, the state list that starts `default, range30, pickDates…`.
- Build plan: `BUILD-PLAN-WEEK-8.md` §2.5. FE Spec §3.9, API Contract §11, Model §18.
- Routes: `/attendance/history` (the list) and `/attendance/history/[id]` (one past session), from Modules → Attendance → History. Attendance Managers (their own sessions), ADMIN and OWNER (every outlet).
- Code: `features/attendance/history-screen.tsx`, `history-session-screen.tsx`, and the shared `date-range-sheet.tsx`, `mark-row.tsx`, `status-badge.tsx`.

## States defined by the mockup

Exactly 21, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — the last seven days: any session open now first, then past ones, newest first, each with "{n} present", "{n} not present", "{n} not marked". _meera or raheem._
2. **range30** — Last 30 days chosen. _The dates chip, Last 30 days._
3. **pickDates** — the From / To sheet. _The dates chip, Choose dates._
4. **emptyRange** — "No sessions between {a} and {b}." with a Last 30 days button. _raheem: filter to Elegance, choose 1 to 7 September (Elegance has a week of history)._
5. **admin** — both outlets, all configurations, the outlet chip. _raheem._
6. **session** — a past session: hours, "Closed at …", counts, search, status chips, the rows. _Tap a past session._
7. **search** — typed "Jo": Joseph. _Search inside a session._
8. **searchEmpty** — "No one called 'Sam' on this session." _Search for a name that is not there._
9. **filtered** — the Not marked chip: only those nobody marked. _A session from Early shift or Kitchen roll call, chip Not marked._
10. **changes** — one row with its corrections, "Show all (n)" past two. _The seed gives a row at most one correction, so the "Show all" step is only reachable in Marking (ATT-01): the row is the same component._
11. **closedDay** — "0 present · {n} not marked" for a session nobody marked. _Kitchen roll call today, or Evening after it closes._
12. **archivedPerson** — someone since archived or taken off, still on an old session. _raheem: a custom range in September, ZamZam, search "Ravi"._
13. ~~noUnmarked~~ — **Not reachable.** A fallback for an API with a single "not present"; the platform tells "a manager said absent" from "nobody marked" (`not_present` and `not_marked`), so the chips and counts keep them apart.
14. **loading** — skeleton cards.
15. **loadFailed** — Retry above the list, the cards already loaded kept. _Go offline and pull to refresh._
16. **roleLost** — a 403: "You can't see this outlet's attendance." and Back. _Remove meera as manager while the screen is open, then pull to refresh._
17. **moduleOff** — attendance switched off: back to Modules with "Attendance isn't turned on for {outlet}." _Turn the outlet's attendance off in Outlets, then pull to refresh._
18. **singleOutlet** — no outlet chip. _meera (one outlet)._
19. **many** — 215 sessions at ZamZam over a year, 25 at a time, "Show more". _A custom range of the past year._
20. **long** — a 41-character name and Malayalam script wrap. _Name a configuration "Weekend Brunch Service Opening Team Count"._
21. **clock24** — times follow the phone's 12 or 24-hour clock.

## What the states pin down

- **Range.** Last 7 days, Last 30 days, or chosen dates (From and To, "To can't be before From"). It starts on the last seven days.
- **Open now.** A session still open sits above the past ones with "Open now" and when it closes. It opens Marking, where an administrator gets the view-only page ("Viewing only. Marking is for Attendance Managers.").
- **Outlet chip.** "All outlets" until one is chosen; left out with one outlet.
- **Past session.** Counts, search by name or code, and a status chip: All, Present, Not present, Not marked. "Not marked" (nobody checked) and "Not present" (a manager said absent) are kept apart everywhere. Every correction shows on its row.
- **No score, no percentage.** Attendance does not feed compliance.
- **Corrections** are kept; nothing here can be changed.
