# INV-03 — Movement log · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `INV-03`, the state list that starts `default, item, itemSheet, rangeSheet…`.
- Build plan: `BUILD-PLAN-WEEK-8.md` §2.8. FE Spec §3.10, API Contract §12, Model §18.
- Route: `/inventory/log`, from Modules → Inventory → Movement log, or "See all movements" on an item (`?item=ID&outlet=ID`). Inventory Managers (their outlets), ADMIN and OWNER.
- Code: `features/inventory/log-screen.tsx`, `item-filter-sheet.tsx`, `movement-row.tsx`, and the shared `date-range-sheet.tsx`.

## States defined by the mockup

Exactly 18, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — every item at the outlet, the last seven days, under a heading for each day, newest first. _suresh._
2. **item** — one item: the chip shows its name; rows carry no item name. _An item's page, See all movements._
3. **itemSheet** — a searchable list of the outlet's items, "All items" first. _The item chip._
4. **rangeSheet** — Today, Last 7 days, Last 30 days, Choose dates. _The dates chip._
5. **rangeCustom** — the From / To fields. _Choose dates._
6. **empty** — "No movements between {a} and {b}." _Choose 1 to 7 September._
7. **openingCount** — an item's first count reads "Opening count". _Turmeric._
8. **arrived** — a count above the balance: "{q} arrived unrecorded", shown as information. _Set actual higher than the balance, on an item's page._
9. **pending** — entries on their way at the top, "Waiting to send", and "{n} waiting to send" above. _Go offline and save on an item's page, then open the log._
10. **loading** — skeleton rows.
11. **loadFailed** — Retry above; rows already loaded stay. _Go offline and pull to refresh._
12. **paging** — a skeleton row at the foot while more load, 25 at a time. _Scroll a long list._
13. **badRange** — "To can't be before From." Choose dates keeps Done off until the range is sound, so the app cannot send one; the message shows if the platform ever refuses a range.
14. **itemOnly** — the fallback: no "All items", one item at a time, the first item to start. This is what runs against the real platform, whose ledger is per item (API Contract §12).
15. **many** — 60 movements at ZamZam Grande over 30 days, 25 and then more. _raheem: Grande, Last 30 days._
16. **long** — a long name and a Malayalam note wrap. _The Malayalam item at Elegance; a long note._
17. **readOnlyOwner** — the same list for an Owner who is not a manager. _priya._
18. **clock24** — times follow the phone's 12 or 24-hour clock.

## What the states pin down

- **Chronological and attributed.** Each row: what, how much, what a count worked out to, who and when. Grouped by the day it was recorded (Today, Yesterday, then "Sat 17 Oct").
- **Filters.** The outlet (when there is more than one), the item, and the dates. Last 7 days is the default; the chips show a non-default choice.
- **Entries on their way** sit at the top of Today with "Waiting to send"; one the platform refused shows "Not recorded".
- **Opening count.** A count that began from nothing is read as the item's opening one. It is judged from the row alone, so an item restocked from zero reads the same.
- **Entries are never changed.** "Made a mistake? Record a new count. Entries can't be changed."
