# SPT-06 — Areas list · area edit · week 9

## References

- `mise-week-09.html` at the mise root: registry entry `SPT-06`, the state list that starts `default, add, nameTaken, saveFailed…`.
- Build plan: `BUILD-PLAN-WEEK-9.md` §2.1. FE Spec §3.11, API Contract §13, Model §18, Spot Checks §5, Schema `area`.
- Route: `/spot-checks/areas`, from the Areas link under the Spot checks title. ADMIN and OWNER only (anyone else is sent to More).
- Code: `features/spot-checks/areas-screen.tsx`, `area-sheet.tsx`, `area-errors.ts`, `use-spot-check-outlets.ts`, `use-areas.ts`.
- The platform has **no endpoint for areas** in API Contract §13. The calls, the 409-style name rule and the mock's behaviour are the mock's own and move when Lamax adds them.

## States defined by the mockup

Exactly 18, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend (password `1234`; raheem, zoya and priya are head office).

1. **default** — the outlet's live areas A to Z, each with its name and a switch (Can be picked / Not picked); "Add area" in the header. _raheem: ZamZam._
2. **add** — New area: Name empty, Can be picked on; Save off until there is a name. _Add area._
3. **nameTaken** — "{outlet} already has an area called {name}." under the form, the sheet kept. _Add "Kitchen" at ZamZam. Case does not matter, and an archived area keeps its name._
4. **saveFailed** — "Couldn't save. Can't reach mise.", the sheet and the typing kept. _Name it "offline"._
5. **edit** — the area's name as the sheet title, Name filled, Can be picked, Archive area. _Tap a name._
6. **archiveConfirm** — "Archive {name}?" with "It won't be picked for new checks. Past results keep it." _Archive area, in the edit sheet._
7. **switchFailed** — the switch put back, "Couldn't save. Can't reach mise." under the row. _Elegance: switch the area called "offline"._
8. **archived** — Show archived opened: archived areas in a quieter list, each tagged Archived. _ZamZam: Show archived (Old bar)._
9. **noneEligible** — a notice: "No area can be picked. Area checks at this outlet will have no subject." _Switch every area at ZamZam off._
10. **empty** — "No areas yet. Add the parts of this outlet you want inspected." with Add area. _Archive every area at an outlet, or switch spot checks on for an outlet with none (Outlets, then Central Kitchen)._
11. **loading** — skeleton rows.
12. **loadFailed** — Retry above; the areas already loaded stay, with "Showing the last list". _Open the screen offline; pull to refresh once loaded._
13. **roleLost** — "Only head office can change areas." and no Add area, the switches off and the names not editable. _raheem: Add area, name it `revoked` and Save (or rename an area to `revoked`). The write answers 403 and the screen turns read-only._
14. **moduleOff** — back to Modules with "Spot checks aren't turned on for {business}." _A 404, or switch spot checks off for every outlet._
15. **singleOutlet** — no outlet chip, the eyebrow reads just "Spot checks". _Switch spot checks off at Elegance in Outlets: ZamZam is then the only one._
16. **long** — a 40-character name and a Malayalam name wrap. _Elegance._
17. **many** — 30 areas, 25 at a time, the rest as the list scrolls. _Elegance._
18. **archivedFallback** — a platform that cannot list archived areas: no Show archived link, even where an area was archived. _Sign in as `basic` (password 1234, an Administrator on a platform with limits): Areas at ZamZam shows no Show archived link, where raheem sees it for Old bar. The app asks for archived areas once, is refused (400), and stops asking for the rest of the session._

## What the states pin down

- **List.** An outlet's live areas by name, 25 at a time. The name opens the edit sheet; the switch sits beside it and says what it does in words, since a switch alone says nothing about which way is on. Archived areas are not in the list until asked for.
- **Eligible is a switch, not a form.** It saves on the tap. If the save fails it goes back to where it was and the line under the row says so; nothing else on the screen changes.
- **Names are unique per outlet** (Schema `unique(outlet_id, name)`, archived ones included), compared without regard to case. The message names the outlet; in a single-outlet business the outlet is still named, as the mockup does.
- **Archive.** The area leaves the list and is no longer picked for new checks; past results keep it. Archiving also switches it off. An archived area cannot be edited, and there is no way to bring one back on this screen.
- **Who.** ADMIN and OWNER add, edit, switch and archive. A Spot-check Manager never sees this screen. A 403 on a write makes it read-only (`roleLost`).
- **Outlets.** Head office sees an outlet chip when more than one outlet has spot checks on. The eyebrow is "Spot checks · {outlet}".
- **No pool statement yet.** Whether the check can be limited to kitchen staff (staff eligibility) is not part of this screen: the Schema has none (Known Inconsistency #9).
