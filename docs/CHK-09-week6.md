# CHK-09 — Checklist editor, tasks · week 6

## References

- `mise-week-07.html` at the mise root: registry entry `CHK-09`, state list `gd`, component `Od`.
- Build plan: `BUILD-PLAN-WEEK-6-7.md` §2.3.
- Route: `/checklists/[id]/tasks`, from the Tasks row of CHK-06. ADMIN and OWNER only.

## States defined by the mockup

34, in mockup order. **R** = reachable on the mock backend (how). **—** = not reachable, and why.

1. **default** — Kitchen Opening: 12 tasks. **R** — raheem.
2. **empty** — a new checklist: "No tasks yet." and Add task. **R** — Monthly Deep Clean.
3. **singleOutlet** — one-outlet business, not running: Start running. **R** — kabir: add a task to any checklist (they all start empty).
4. **singleOutletEmpty** — same, no tasks: Start running disabled, "Add at least one task first." **R** — kabir, any checklist before a task is added.
5. **menu** — a row's menu: Move up, Move down, Remove. **R**.
6. **dragging** — a row held and moved. **R** — hold the grip.
7. **lastTask** — the last task of a running checklist: Remove disabled, "A checklist needs at least one task." **R** — a checklist that runs somewhere, with tasks removed until one is left (no fixture has exactly one).
8. **removeConfirm** — "Remove this task?" **R**.
9. **removeFailed** — "Couldn't save. Can't reach mise." **R** — a task whose text is `offline`.
10. **reorderFailed** — "Couldn't save the new order…" with Try again; the list returns to the saved order. **R** — a list holding a task named `offline`.
11. **sheetNew** — New task: choose a type. **R**.
12. **sheetNoType** — Add tapped with no type: "Choose a type." **R**.
13. **sheetYesNo** — Yes / No: statement field and hint. **R**.
14. **sheetReading** — Reading, 4 or below: "Fails if above 4 °C." **R**.
15. **sheetLogOnly** — Reading with no range: "No range: this reading is only logged and can't fail…" **R**.
16. **sheetOneBound** — Reading with a lowest only: "Fails if below …" **R**.
17. **sheetBoundsError** — lowest 7, highest 7: "The lowest must be below the highest." **R**.
18. **sheetBadNumber** — a limit that is not a number: "Enter a number, like 4 or −18." **R**.
19. **sheetNegative** — −18 or below, with the ± button. **R**.
20. **sheetPhoto** — Photo: "What the photo must show", no note. **R**.
21. **sheetWeight** — Weight opened, at 9. **R**.
22. **sheetRequired** — Add tapped with the text empty: "Required". **R**.
23. **sheetEdit** — Edit task: type fixed, "can't be changed". **R** — tap a row.
24. **sheetSaving** — spinner on the button, fields locked. **R**.
25. **sheetSaveFailed** — "Couldn't save. Can't reach mise." in the sheet. **R** — a task text of `offline`.
26. **sheetServerError** — "Couldn't save this text. Check it and try again." **R** — a task text of `rejected`.
27. **sheetDiscard** — Cancel with changes: "Discard changes?" **R**.
28. **forbidden** — "Only head office can change this checklist." **—** only on a real 403; the frame already sends non-admins away.
29. **gone** — "This checklist is no longer available." **R** — open an id that does not exist.
30. **loading** — skeleton rows. **R**.
31. **loadFailed** — "Can't reach mise." with Retry. **R** — offline.
32. **longText** — long and Malayalam task text wraps. **R** — add a long task.
33. **many** — 30 tasks. **R** — Delivery Receiving.
34. **startRunning** — after Start running, on to the team screen. **R** — it opens CHK-08, still a placeholder until step 6.

## What the states pin down

- **A row** is the text, then an icon and a line: type, unit, range ("4 or below", "−18 to 4", "no range: only logged") and the weight when it is not the standard 5.
- **Order.** Drag the grip, or open the row's menu for Move up and Move down. A drag does not scroll the page, so long moves use the menu. A failed save puts the list back and offers Try again.
- **Add and Start running.** A running checklist, or a business with several outlets, has Add task pinned at the bottom. A one-outlet business that is not running has Start running pinned instead, with Add task under the list. Start running needs at least one task.
- **The sheet.** Type first (Yes / No, Reading, Photo), then its text, then what that type needs. Where a task can fail there is a switch, **Ask for a comment when this fails**, off unless the author turns it on; a row that has it on says "asks why". It can be changed later. A photo task, or a reading with no limit, has no switch. A reading takes either limit, or none: then it is only logged and can only be missed. A new reading is in °C and the author is not asked for a unit; an existing reading keeps its own. Weight sits behind a row, 1 to 10, standard 5.
- **The type is fixed** once a task exists. To change it, add a new task and remove this one.
- **Out-of-range readings are valid answers.** The limits say what fails; the sheet states it in a sentence as the limits are typed.
- **Edits apply to new runs**, said on the screen and in the remove confirm when the checklist runs somewhere. Past runs keep a removed task.
- **Authored text** (task text) is shown as typed; everything else is in all four languages.

## Not built, and why

- **Auto-scroll while dragging.** Moving a row off the screen needs the menu.
