# INV-02 — Item page: set actual, add, remove · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `INV-02`, the state list that starts `default, setActual, setActualBelow…`.
- Build plan: `old-files/BUILD-PLAN-WEEK-8.md` §2.7. FE Spec §3.10, §6, §11; API Contract §12; Model §18.
- Route: `/inventory/[id]?outlet=ID`, from the item list. Anyone who can open Inventory reads it; recording is the Inventory Manager's at that outlet; Edit item is ADMIN and OWNER.
- Code: `features/inventory/item-screen.tsx`, `movement-sheet.tsx`, `movement-row.tsx`, `movement-text.ts`, `item-sheet.tsx` (the Edit sheet, built in 2.6), `use-inventory-movements.ts` (the retry queue).

## States defined by the mockup

Exactly 28, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — Chicken at 30 kg: Set actual first, Add and Remove beside each other, four movements. _suresh, Chicken._
2. **setActual** — the count sheet, empty field. _Set actual._
3. **setActualBelow** — typed 4: "Balance 30 kg → 4 kg · 26 kg out". _Type 4._
4. **setActualAbove** — typed 36: "Balance 30 kg → 36 kg · 6 kg arrived unrecorded", shown as information, not an error. _Type 36._
5. **setActualZero** — typed 0: "· 30 kg out". Zero is allowed for a count. _Type 0._
6. **openingCount** — an item with nothing recorded: the button and the sheet say "Opening count", and the line reads "Starting balance 0 kg → 40 kg". _Paneer._
7. **add** — the Add sheet: quantity and an optional price. _Add._
8. **addPrice** — a unit price typed. _Type 220 in the price._
9. **addHint** — the reference price as a grey hint in the price field, never filled in. _Chicken: 220._
10. **remove** — "Remove · Taken out". _Remove._
11. **removeAbove** — more than the balance: "Balance will be −2 kg. Set actual to fix it." It is allowed; the balance can go below zero. _Remove 32 from Chicken._
12. **negative** — a balance below zero: "Below zero" and "Balance is below zero. Set actual to fix it." _Cooking oil, −2 l._
13. **wholeNumbers** — "Whole numbers only." for grams, millilitres and counts, and the field accepts no decimal point there. _Eggs or Turmeric._
14. **zero** — an Add or Remove of 0: "Enter more than 0." and Save stays off. _Add, type 0._
15. **saved** — a new top row and the new balance. _Save._
16. **pending** — the entry reads "Waiting to send" and the balance does not change; "1 waiting to send" above. _Go offline and save, or give the note "offline"._
17. **pendingTwo** — two waiting: "2 waiting to send". _Save twice offline._
18. **notRecorded** — a queued entry the platform refused: "Not recorded · The server didn't accept it. Record it again if it is still needed." _Give the note "fault"._
19. **readOnlyOwner** — the balance and movements, no buttons, "You can see stock here. Recording is for this outlet's Inventory Managers." _priya._
20. **edit** — Edit item over the page. _priya or raheem: Edit item in the header._
21. **notYours** — a save answered 403: "You can't record stock at this outlet." and the buttons go. _Remove suresh as manager from raheem's phone, then save._
22. **gone** — "This item is no longer available." and Back. _Archive the item (Edit item, Archive) from another phone; or open one that has been._
23. **empty** — "No movements yet." with the Opening count button. _Paneer._
24. **loading** — a skeleton card and rows.
25. **loadFailed** — Retry inline. _Go offline and pull to refresh._
26. **many** — ten movements, then "See all movements" (the log, INV-03). _Record a dozen._
27. **long** — a long name and a Malayalam note wrap. _The Malayalam item at Elegance; a note of any length._
28. **clock24** — times follow the phone's 12 or 24-hour clock.

## What the states pin down

- **Set actual is the primary action.** Staff record what is left, not what was used; usage is worked out and never typed. A count below the balance books the difference out; above it, stock that arrived unrecorded.
- **The first movement is an "Opening count".** It starts the balance from 0.
- **Not optimistic.** The balance does not change until the platform answers; a held entry says "Waiting to send", and one the platform refused says "Not recorded". A failed send is never shown as failed.
- **Never edited, never deleted.** "Made a mistake? Record a new count. Entries can't be changed."
- **Whole units.** Kilograms and litres take two decimals; grams, millilitres and counts are whole. More and Less step by 1, or 100 for grams and millilitres.
- **Recording is the manager's.** ADMIN and OWNER read and edit the item; they record only if appointed manager.
