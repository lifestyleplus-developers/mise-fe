# SPT-05 — Check editor (checks list · editor) · week 9

## References

- `mise-week-09.html` at the mise root: registry entry `SPT-05`, the state list that starts `default, noManagers, managerNotWired, new…`.
- Build plan: `BUILD-PLAN-WEEK-9.md` §2.2. FE Spec §3.11, API Contract §13, Model §18, Spot Checks §4 and §5, Schema `spot_check`, `spot_check_capture`, `spot_check_assertion`.
- Routes: `/spot-checks/checks` (the list), `/spot-checks/checks/new?outlet=ID` and `/spot-checks/checks/[id]` (the editor), from the Checks link under the Spot checks title. ADMIN and OWNER only (anyone else is sent to More).
- Code: `features/spot-checks/checks-screen.tsx`, `check-editor-screen.tsx`, `check-form.ts`, `check-rows.tsx`, `check-managers.tsx`, `use-spot-checks.ts`, `use-spot-check-managers.ts`.
- Two things in the editor have **no endpoint in API Contract §13** and are the mock's own, to be settled with Lamax: saving the whole editor in one call (a check with its prompts and items, in order), and reordering. §13 has `POST` for one prompt or one item at a time. The Spot-check Manager list has no endpoint or table either (Known Inconsistency #7).

## States defined by the mockup

Exactly 24, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend (password `1234`; raheem, zoya and priya are head office).

1. **default** — the outlet's checks A to Z, each with its name, "{Staff|Area} · {How often} · {time} · {n} min window" and "{p} photos · {i} check items"; a dashed notice that the prompts and checks are examples until the AI evaluation; the Spot-check Managers below. _raheem: ZamZam._
2. **noManagers** — "Nobody will be told when a check is revealed. Add a Spot-check Manager." above the list, "None" under Managers. _Remove Reshma and Arun at ZamZam._
3. ~~managerNotWired~~ — **Not reachable on the mock.** The mock has a manager endpoint. Against the real platform, which has none, Add manager and Remove answer "This can't be saved yet." under the managers; the code for it is in place.
4. **new** — New check: empty name, Staff, Daily, no time, 20 min, no prompts, no items; Save off. _New check._
5. **newFilled** — a name, a time, 3 prompts and 5 items; Save on. _Fill the form, or open "Grooming — kitchen" (state 6) and read it._
6. **edit** — "Grooming — kitchen": every field filled, "Changes apply from the next check. Past results keep what they were judged against.", Archive check at the foot. _Tap a check._
7. **itemMenu** — the menu for one item: Edit, Move up, Move down, Archive. _The ⋮ on an item._
8. **itemArchived** — the item is gone from the list and the count drops. It is archived on Save, and stays on past results. _Archive an item._
9. ~~itemFallback~~ — **Not reachable.** Fallback for a platform that cannot change a check's list ("To change this list, archive the check and create a new one."), with no ⋮ on the rows. The mock changes lists.
10. **addItem** — Add check item: the item text, "One thing a photo can show.", and a weight from 1 to 10 starting at 5. _Add check item._
11. **area** — an area check: Subject is Area (fixed), "Picked at random from the areas that can be picked." with an Areas link to SPT-06. _Food areas — hygiene._
12. **weekly** — How often: Weekly, with the days. _Dishwash — weekly (Mon, Thu), or choose Weekly._
13. **saveFailed** — "Couldn't save. Can't reach mise.", every field kept. _Name it "offline"._
14. **validation** — the platform's own words under the title, every field kept. _Weekly with no days: "Choose at least one day." A check with no prompt cannot be saved from the phone (Save stays off), so that message from the platform is not reachable._
15. **archiveConfirm** — "Archive {name}?" with "No new checks will be revealed. Past results stay in Results." _Archive check._
16. **archived** — Show archived opened: archived checks in a quieter list, each tagged Archived. _Show archived, after archiving one._
17. **empty** — "No spot checks yet." with New check. _Archive every check at an outlet._
18. **loading** — skeleton rows.
19. **loadFailed** — Retry above; the checks already loaded stay, with "Showing the last list". _Open the screen offline; pull to refresh once loaded._
20. **roleLost** — "Only head office can change spot checks.", no New check, the editor read-only. _A 403 on a write does it; the mock cannot take the role away mid-session._
21. **moduleOff** — back to Modules with "Spot checks aren't turned on for {business}." _A 404, or switch spot checks off for every outlet._
22. **long** — a 41-character check name and a 120-character item wrap. _Elegance: "Grooming — front of house, evening service"._
23. **many** — 12 checks in the list; an editor with 8 prompts and 12 items. _Elegance: the list, and "Full inspection"._
24. **clock12** — the time reads "2:00 PM" on a 12-hour phone and "14:00" on a 24-hour one. _Change the phone's clock._

## What the states pin down

- **Two screens.** The list is a screen; the editor is another, opened from a row or from New check. Back from the editor with unsaved changes asks "Discard changes?".
- **One Save.** The editor is a draft: the name, subject, schedule, window, prompts and items are all written together when Save is pressed, so a failed save leaves nothing half done and keeps every field. Save is on when there is a name, a selection time and at least one prompt; anything else the platform judges (a weekly check with no days) comes back as its own message.
- 🔒 **Prompts and items are never paired.** There is no field on either that points at the other, and the editor never asks. Each item is judged against all the photos; there are usually more items than prompts.
- **Prompts.** "What to photograph", one photo each, in order, reorderable. Archiving one removes it from the check. A check keeps at least one.
- **Items.** "What gets judged", each with a weight from 1 to 10 (heavier counts more in the score), reorderable, archivable. An archived item leaves every future check and stays on past results.
- **Subject.** Staff or Area, chosen when the check is made and fixed after. Staff are picked from the outlet's roster; areas from those marked "Can be picked" on SPT-06.
- **How often.** Daily, Weekly (with days) or Monthly (with a day of the month, a small addition to the mockup, which has none). The mockup's Hourly is **dropped**: the Schema's `spot_check` has no interval to go with it, as for attendance. Selection time is when the subject is picked.
- **Window.** 15 to 30 minutes in steps of 5: "Long enough to walk across the outlet, short enough that nobody gets prepared."
- **Changes apply from the next check.** A run already made keeps the prompts and items it was made with (Known Inconsistency #4: the Schema does not snapshot prompts, so this rests on the platform).
- **Managers.** Per outlet, not per check: who is told when any check at the outlet is revealed. Add (a search of active people, those already managing greyed "Already a Spot-check Manager here") and Remove. Removing one takes them out at once; nothing is deleted from their past runs.
- **Left out of the mockup.** The per-row "Placeholder" chip: the dashed notice at the top of the list says the same for the whole screen.
