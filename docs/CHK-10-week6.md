# CHK-10 — Checklists (admin list) · week 6

## References

- `mise-week-07.html` at the mise root: registry entry `CHK-10`, state list `Lu`, component `Hu`.
- Build plan: `BUILD-PLAN-WEEK-6-7.md` §2.1.
- Route: `/checklists/admin`, from More → Administration → Checklists. ADMIN and OWNER only.

## States defined by the mockup

Exactly 17, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend.

1. **default** — the business's active checklists, by time of day. _raheem / priya (ZamZam)._
2. **schedules** — hourly, daily, weekly and monthly wording on one list. _raheem: Oil Quality Check, Pest Control Walk, Monthly Deep Clean._ The mockup's "every 2 hours" and "first to last" wording needs fields the API does not have (plan §4, question 1); hourly reads "Hourly · from {time}".
3. **archived** — the Archived filter. _raheem: Old Audit._
4. **archivedEmpty** — Archived filter with none. _anita (Porch Inn)._
5. **afterArchive** — back from CHK-06 with "{name} archived. Its history stays." Needs CHK-06; the notice store is in place.
6. **afterRestore** — back from CHK-06 Restore with "{name} restored." Same.
7. **noCounts** — no task or outlet counts in the list: the note line is left off. Shown when the API sends neither count.
8. **singleOutlet** — one outlet in the business: task count only. _kabir (Kebapci)._
9. **empty** — no checklists yet: "No checklists yet" and a pointer. New is still in the header.
10. **noArchivedFilter** — fallback for an API with no way to list archived checklists. **Not reachable**: nothing tells the app the API lacks it, and the mock supports it. The filter is always shown.
11. **loading** — four skeleton cards; the filter and New stay.
12. **errorCached** — refresh failed: banner with Retry above the cached list.
13. **errorNoCache** — failed with nothing cached: banner with Retry, no filter, no empty state.
14. **many** — 30 checklists: first 25, then more load as the list scrolls. _kabir: 28._
15. **clock24** — times follow the phone's 12 or 24-hour clock.
16. **longName** — a long Malayalam name wraps, nothing is cut off. _raheem._
17. **forbidden** — 403 (stale link): "You don't have access to this." and nothing else.

## What the states pin down

- **Order.** By opening time, then name. The list the admin screen asks for comes back in that order from the platform, so paging does not reshuffle.
- **Filter.** "Show: Active | Archived" is one control. Archived checklists come from the same list, so switching is instant.
- **New.** In the header on Active only. It opens the editor (CHK-06, new).
- **Card.** Name, schedule, then a note: "{n} tasks · runs at {n} outlets". The note drops the outlet part on Archived, on a single-outlet business, and when there are no tasks ("No tasks yet"). "Not running anywhere yet" when it has tasks and no outlet.
- **Archived rows** carry an archive icon, and the card's label says "(archived)". They open in the editor, read-only.
- **Notice.** One line, once, fades after six seconds, and is hidden while the offline banner shows. Switching the filter clears it.
- **Empty states are good news, not errors.** Active empty has a title and a line; Archived empty is one plain sentence.
- **Paging.** First 25. Scrolling near the end loads more. A short filtered list keeps loading until it fills or runs out.
- **Authored text** (checklist names) is shown as typed, never translated. All other text is in all four languages.
