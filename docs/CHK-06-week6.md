# CHK-06 — Checklist editor, schedule · week 6

## References

- `mise-week-07.html` at the mise root: registry entry `CHK-06`, state list `jd`, component `Xd`.
- Build plan: `BUILD-PLAN-WEEK-6-7.md` §2.2.
- Routes: `/checklists/new` (new) and `/checklists/[id]` (edit). ADMIN and OWNER only. Entered from CHK-10.

## States defined by the mockup

43, in mockup order. **R** = reachable on the mock backend (how). **—** = not reachable, and why.

1. **new** — empty form, Daily, nothing chosen. **R** — CHK-10 → New.
2. **newFilled** — a filled Daily form. **R**.
3. **required** — Save tapped with nothing filled: "Required" under name, opening time and window. **R**.
4. **zeroWindow** — a window under the platform's 5-minute minimum, 0 included: "The window must be at least 5 minutes." **R** — pick 0 and 0.
5. **default** — edit, assigned (Opening cash balance). **R** — raheem.
6. **changed** — edit with a change: Save enabled. **R**.
7. **saving** — spinner on Save, fields locked. **R**.
8. **saved** — "Saved." **R**.
9. **saveFailed** — "Couldn't save. Can't reach mise." Save is the retry. **R** — name the checklist `offline`.
10. **clock24** — times follow a 24-hour phone. **R** — phone setting.
11. **midnight** — closes the next day. **R** — Closing cash balance opens at 22:00 and stays open 2 h, so it closes at midnight; make the window longer for a clearer case.
12. **weekly** — a weekly checklist. **R** — create one, or switch an existing checklist to Weekly.
13. **weeklyNoDay** — Weekly with no day chosen: "Pick at least one day." **R**.
14. **overlap** — Weekly, Monday and Tuesday, 1 d 2 h. **R**.
15. **overlapSwitch** — Opening cash balance (3 h) switched to Hourly: the window is longer than the gap. **R**.
16. **conflict** — the platform's 409 overlap. Handled, same message. **—** the device check catches every case first, so the mock never sends one.
17. **monthly** — a monthly checklist that runs nowhere yet. **R** — create one.
18. **monthly31** — day 31, with "In shorter months it runs on the last day." **R**.
19. **hourly** — Hourly, every hour, with its first and last run and "{n} runs a day". **R** — switch any checklist to Hourly.
20. **hourly2** — every 2 hours. **R** — create or switch a checklist to Hourly and set Every to 2 hours.
21. **hourlyCleared** — "Every" changed so the last run is no longer a run: it is cleared and chosen again. **R** — on an hourly checklist set to every 2 hours from 11:00 to 21:00, change Every to 3 hours.
22. **hourlyLate** — a first run so late that none fits after it: "No later run today" and "Choose an earlier first run." **R** — set the first run to 11:00 PM.
23. **timePicker** — opening-time picker. **R**.
24. **timePicker24** — the same on a 24-hour phone. **R**.
25. **durationPicker** — "Open for" picker. **R**.
26. **lastRunPicker** — the times it can end on, every interval after the first run. **R**.
27. **dayPicker** — day of the month, 1 to 31. **R**.
28. **archiveConfirm** — "Are you sure you want to archive {name}?" **R**.
29. **archiveConfirmNowhere** — a checklist that runs at no outlet. **R** — create one and archive it before starting it anywhere.
30. **archiveFailed** — "Couldn't archive. It is still active." **—** only when the network really fails; the mock has no trigger.
31. **archived** — back on CHK-10 with "{name} archived." **R**.
32. **archivedView** — read-only, "Archived.", Restore. **R** — archive a checklist, then open it from the Archived filter.
33. **restoreFailed** — "Couldn't restore." **—** as 30.
34. **restored** — back on CHK-10 with "{name} restored." **R**.
35. **discard** — Back with unsaved changes: "Discard changes?" **R**.
36. **forbidden** — "Only head office can change this checklist." **—** only on a real 403; the frame already sends non-admins away.
37. **gone** — "This checklist is no longer available." **R** — open an id that does not exist.
38. **loading** — skeleton card under the name. **R**.
39. **loadFailed** — "Can't reach mise." with Retry. **R**.
40. **singleOutlet** — no Outlets row. **—** the mock now has one business with several outlets, so the one-outlet case cannot be seen.
41. **teamRow** — single-outlet business, running: a Team row. **—** same.
42. **teamRowNone** — same, no manager yet. **—** same.
43. **longName** — a long Malayalam name wraps in the header and the field. **R** — raheem.

## What the states pin down

- **Required fields say so only after Save is tapped.** Window of 0 and overlap say so at once. "Pick a day" shows after Save, or once the days have been touched and left empty.
- **Save.** New: "Save and add tasks", then straight on to the tasks screen. Edit: "Save", enabled only when something changed.
- **The window is checked on the device** against the gap to the next run, with the gap in words ("the closest chosen days are 1 day apart"). The platform's 409 is the final answer.
- **Under "Open for"**: when it closes ("Closes 12:30 AM (next day)", "Closes 1 day later, 11:00 AM").
- **Below the card**: one line saying what the schedule means, once it is complete and sound.
- **"Edits apply to new runs. Runs already scheduled (up to 24 hours ahead) stay as they are."** shows on an edit that runs somewhere. This is the mockup's wording of the plan's "Edits apply from tomorrow".
- **Rows to the rest of the checklist**: Tasks (CHK-09), Outlets (CHK-07, hidden in a single-outlet business), Team (CHK-08, single-outlet and running only).
- **Archive** is a red outline button at the bottom. It asks first, says how many outlets stop running, and returns to CHK-10 with a notice. Its outlets and their people are not touched, so **Restore** puts it back exactly as it was. An archived checklist is read-only with Restore pinned at the bottom.
- **Leaving with changes asks "Discard changes?"** by any route: Back, the Android key, the swipe. Switching frequency and back is not a change.
- **Authored text** (the name) is shown as typed; everything else is in all four languages.

## Hourly checklists

- **Every** 1, 2 or 3 hours, from the **First run** to the **Last run**, each day. The last run is one of the runs: a whole number of intervals after the first. Changing the first run or the interval clears a last run that no longer fits.
- A window may be as long as the gap to the next run and no longer: every 2 hours allows up to 2 hours. A window must also be at least 5 minutes.
- The checklist list says "Every 2 hours · 11:00 AM to 9:00 PM".

## Not built, and why

- **Focus moving to the first invalid field** after Save. Errors show, but focus does not jump.
