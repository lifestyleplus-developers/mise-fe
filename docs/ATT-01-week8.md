# ATT-01 — Marking · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `ATT-01`, the state list that starts `default, search, searchEmpty, changes…`.
- Build plan: `old-files/BUILD-PLAN-WEEK-8.md` §2.4. FE Spec §3.9, §6, §11; API Contract §11; Model §18.
- Route: `/attendance`, from Modules → Attendance → Marking (Attendance Managers), or a notification: `/attendance?session=ID`.
- Code: `features/attendance/marking-screen.tsx` (which session), `marking-session.tsx` (the roster), `note-sheet.tsx`, `next-opening.ts`, and the shared `mark-row.tsx`, `status-badge.tsx`, `use-mark-person.ts`.

## Reading the demo

The mock opens Morning (ZamZam) 20 minutes before the app started and closes it 40 minutes after, and Elegance's Morning 10 minutes before and 50 after. Early shift has already closed today, Evening opens at 4:00 PM, and Central Kitchen's roll call at 6:00 AM. Restart the app to open the windows again.

## States defined by the mockup

Exactly 27, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — Morning with eight present, four to mark, "Saved as you go". _meera, within 40 minutes of starting the app._
2. **search** — typed "Jo": Joseph. _Type in the search field._
3. **searchEmpty** — "No one called 'Sam' on this session." _Search for a name that is not there._
4. **changes** — a row with corrections: the latest two, then "Show all (n)". _Mark one person Present, Not present, Present, Not present._
5. **note** — the note sheet on a marked person, empty. _The note button beside Present and Not present._
6. ~~noteUnmarked~~ — **Not reachable.** The platform takes a note with a mark (`status` is required), so the button is not offered until someone is marked. This is the mockup's own fallback, state 8.
7. **noteSaved** — a saved note is read-only, with who wrote it and when, and "A saved note can't be changed, so that nothing is overwritten". _Save a note, open it again._
8. **noteFallback** — the note button only after a mark. _An unmarked row has no note button._
9. **markAll** — "Mark {n} people present?" with "They are not marked yet. You can change any mark until {time}." _Mark the rest present._
10. **pending** — "Waiting to send" on the row, and "{n} waiting to send" above. _Turn the phone offline and mark._
11. **rowFailed** — "Couldn't record this. Tap to try again." _Save a note reading "fault"._
12. **lateWrite** — "Not recorded: the window closed at {time}. {name} will show as not marked." _Mark while offline, wait for the window to close, go online._
13. **closed** — rows as text with a word each ("Not marked"), "Closed at {time}. This record can't be changed." _Leave the screen open until the window closes._
14. **viewOnly** — "Viewing only. Marking is for Attendance Managers." _raheem: History, tap a session that is open now._
15. **picker** — two open sessions listed by name, outlet and closing time. _In Configurations appoint meera to Elegance's Morning, then open Marking._
16. **empty** — "No session open." with "Next: {name}, {time} {day}." _After every window has closed._
17. **emptyFallback** — the same, the time worked out on the phone. The platform has no "next session" to ask for, so this is the only form built.
18. **noConfig** — "No attendance sessions set up for {outlet}." with a Configurations button for an administrator. _Only when every configuration is archived._
19. **noRoster** — "No one was on the roster when this session opened." _A configuration at an outlet with no staff._
20. **loading** — skeleton rows.
21. **loadFailed** — Retry above the list, the cached rows kept. _Go offline and pull to refresh._
22. **roleLost** — a mark answered 403: "You can't mark this session." and the rows turn to text. _Remove meera as manager of Morning from raheem's phone, then mark._
23. **moduleOff** — attendance switched off: back to Modules with "Attendance isn't turned on for {outlet}." _Turn the outlet's attendance off in Outlets, then pull to refresh._
24. **singleOutlet** — the eyebrow reads "Marking" rather than an outlet name. _meera (one outlet)._
25. **many** — 120 people, the first 25 drawn, "Show more" adds 25. _Create a configuration at Central Kitchen whose window is open now, and appoint meera._
26. **long** — a 41-character name and Malayalam script wrap. _Elegance (long name), ZamZam (Malayalam name)._
27. **clock24** — times follow the phone's 12 or 24-hour clock.

## What the states pin down

- **Which session.** A notification names one (`?session=`); otherwise the one open session, or a list when several are open. With a list, "Open now" in the header returns to it.
- **Header.** "Closes 9:00 AM" (or "Closed at …"), then counts: present, not present, waiting to send, and not marked yet (open) or not marked (closed). The counts follow each mark at once.
- **Marking.** Present and Not present per person, saved as you go: the row changes at once and the write goes in the background. A mark can be changed until the window closes; each change is kept and shown on the row.
- **Not recorded.** A write the platform refused because the window had closed is rolled back and explained on its row; anyone nobody marked reads "Not marked", never "Not present".
- **Closed.** Rows turn to text, nothing can change.
- **Who may mark.** Only a manager of that configuration. An administrator reads, and marks only if appointed. The platform's 403 is final.
- **No score.** Attendance does not feed compliance.
