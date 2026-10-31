# INV-01 — Item list · item edit · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `INV-01`, the state list that starts `default, admin, negative, search…`.
- Build plan: `BUILD-PLAN-WEEK-8.md` §2.6. FE Spec §3.10, API Contract §12, Model §18.
- Route: `/inventory`, from Modules → Inventory → Items. Inventory Managers (their outlets), ADMIN and OWNER (every outlet). Adding and editing items, and appointing managers, are ADMIN and OWNER.
- Code: `features/inventory/inventory-screen.tsx`, `item-sheet.tsx`, `managers-sheet.tsx`, `use-inventory-outlets.ts`, `use-inventory-managers.ts`, `format.ts`.

## States defined by the mockup

Exactly 28, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — seven items at ZamZam, A to Z, each with its balance; Reports in the header. _suresh._
2. **admin** — the outlet chip, the Inventory Managers row, Add item pinned. _raheem._
3. **negative** — Cooking oil, −2 l, with the info icon and "Below zero" (a word as well as a colour). _Any list that has it._
4. **search** — "Ch": Chicken. _Type in the search field._
5. **searchEmpty** — "No item called 'Chx'." _Search for something that is not there._
6. **empty** — "No items yet", Add item pinned. _raheem: an outlet with none, such as Central Kitchen._
7. **emptyManager** — "No items yet" and "Your administrator adds them." _suresh, after raheem appoints him at Central Kitchen._
8. **loading** — skeleton rows.
9. **loadFailed** — Retry, no rows. _Open the screen offline._
10. **loadFailedCached** — Retry, "Showing the last list", the rows kept. _Go offline after it has loaded, then pull to refresh._
11. **singleOutlet** — no outlet chip. _suresh (one outlet)._
12. **many** — 60 items, the first 25, the rest as the list scrolls. _raheem: ZamZam Grande._
13. **addSheet** — Add item: name, unit, reference price; Save disabled. _Add item._
14. **addFilled** — name, a unit and a price; Save enabled. _Fill the form._
15. **addDuplicate** — "{outlet} already has {name}." under the name (without the outlet name when there is only one outlet). _Add "Chicken" at ZamZam._
16. **addFailed** — "Couldn't save. Can't reach mise.", the form kept. _Name it "offline"._
17. **editSheet** — Edit item on an item with movements: the unit is shown fixed, "{unit} · Unit is fixed once stock is recorded." _Edit from the item page (INV-02, 2.7)._
18. **editUnitOpen** — an item with no movement: the unit chips are open. _Edit Paneer from the item page._
19. **editLocked** — the fallback: the unit fixed for every item. The sheet asks the platform for the item's first movement and keeps the unit locked until it has answered, so this is what shows while that is loading or if it fails.
20. **archiveConfirm** — "Archive {name}?" with "Its movements stay in the log and reports. It leaves this list." _Archive item in the edit sheet._
21. **archived** — "{name} archived." for six seconds. _Confirm the archive._
22. **managers** — the Inventory Managers sheet. _raheem: the Inventory Managers row._
23. **managersRemove** — "Remove {name} as Inventory Manager at {outlet}?" with "{name} can no longer record stock here. Past movements stay in the log." _Remove._
24. **managersPicker** — Add Inventory Manager: active people, those already managing greyed "Already an Inventory Manager here". _Add._
25. **managersFallback** — "Appointing is not available yet.", Add and Remove off. _Shows against the real platform, which has no endpoint for managers yet._
26. **readOnlyOwner** — Nadia, an Owner who is not an Inventory Manager: the list, Add item and Reports; recording stock is for the outlet's managers. _priya._
27. **moduleOff** — inventory switched off: back to Modules with "Inventory isn't turned on." _Not reachable on the mock, which has no switch for it; a 404 does it._
28. **long** — long and Malayalam item names wrap. _Elegance: the Malayalam item._

## What the states pin down

- **List.** An outlet's items by name, each with its balance and unit; a balance below zero says so in words. Tapping an item opens it (INV-02). Searched on the platform, 25 at a time.
- **Who sees what.** An Inventory Manager sees only their outlets. ADMIN and OWNER see every outlet, add items, edit them and appoint managers; they do not record stock unless they are also appointed managers.
- **Unit.** Exactly one of kg, g, l, ml or count. Chosen when the item is made; fixed once it has movements (409 `unit_locked`).
- **Price.** The reference price is optional, per unit, and is only a hint when stock arrives.
- **Archive.** Removes the item from the list; its movements stay in the log and reports. Names are unique among an outlet's live items.
- **Managers.** The platform has no endpoint for appointing Inventory Managers yet (Known Inconsistency #7); the sheet runs on the mock and says so against the real platform.
