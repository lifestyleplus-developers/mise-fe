# INV-04 — Stock reports · week 8

## References

- `mise-week-08.html` at the mise root: registry entry `INV-04`, the state list that starts `default, negative, summary, summaryDay…`.
- Build plan: `BUILD-PLAN-WEEK-8.md` §2.9. FE Spec §3.10, API Contract §12, Model §18.
- Route: `/inventory/reports`, from the item list's Reports button or Modules → Inventory → Reports. Inventory Managers (their outlets), ADMIN and OWNER.
- Code: `features/inventory/reports-screen.tsx`, `use-inventory-reports.ts`, and the shared `date-range-sheet.tsx`, `outlet-picker.tsx`.
- The three report shapes are not in the API Contract yet; they follow the mockup and move when Lifestyle's endpoints land.

## States defined by the mockup

Exactly 20, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — Stock on hand: the outlet's items A to Z, each with its balance, and "As of {time}". _suresh._
2. **negative** — Cooking oil, −2 l, with the info icon and "Below zero". _Stock on hand or Summary._
3. **summary** — Opening, In, Out and Closing for each item over the last seven days, Out in heavier weight, with "In includes stock that arrived unrecorded, such as an opening count." _The Summary tab._
4. **summaryDay** — Summary for Today. _The dates chip, Today._
5. **summaryMonth** — Summary for the last 30 days. _The dates chip, Last 30 days._
6. **summaryCustom** — Summary for chosen dates. _Choose dates._
7. **summaryEmpty** — "No movements between {a} and {b}." _Choose 1 to 7 September, or Today before anything is recorded._
8. **spend** — Total spend and a row per item, in ₹. _The Spend tab._
9. **spendNone** — ₹0 and no rows: only deliveries with a price are counted. _Spend for Today._
10. **rangeSheet** — Today, Last 7 days, Last 30 days, Choose dates. _The dates chip._
11. **admin** — several outlets: the outlet chip. _raheem or priya._
12. **loading** — skeleton rows.
13. **loadFailed** — Retry above; the figures already loaded stay, with "Showing the last figures". _Go offline and pull to refresh._
14. **badRange** — "To can't be before From." Choose dates keeps Done off until the range is sound, so the app cannot send one; the message shows if the platform ever refuses a range.
15. **empty** — "No items yet." _An outlet with no items._
16. **singleOutlet** — no outlet chip. _suresh (one outlet)._
17. **noLog** — the fallback with no Movement log row. The log exists in this build, so the row is always there.
18. **long** — long names wrap; the four figures go two by two on a narrow phone and four across on a wide one.
19. **readOnlyOwner** — the same reports for an Owner who is not a manager. _priya._
20. **clock24** — "As of 14:20" follows the phone's 12 or 24-hour clock.

## What the states pin down

- **Three reports, one tab bar.** Stock on hand needs no dates. Summary and Spend take the date range, starting on the last seven days, and print it under the chip.
- **Out is the heavy figure.** Usage is worked out from counts, never typed. "In" includes stock that arrived unrecorded, such as an opening count.
- **Spend is only what has a price.** A delivery with no unit price is not counted and nothing says it was free.
- **Only the report on screen is asked for.** Changing tab or range asks again.
- **Movement log** is one tap away, for the same outlet.
- **No wastage.** There is no reason field, so wastage cannot be reported (API Contract §12).
