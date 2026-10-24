# CHK-08 — Assignment, membership · week 7

## References

- `mise-week-07.html` at the mise root: registry entry `CHK-08`, state list `id`, component `hd`.
- Build plan: `BUILD-PLAN-WEEK-6-7.md` §2.5.
- Route: `/assignments/[id]/members`, with the checklist and outlet names as parameters. Entered from the Team button on a Checklists card, the Team button on CHK-07, and the Team row on CHK-06. Not admin-only: a Checklist Manager reaches it for their own assignments.

## States defined by the mockup

28, in mockup order. **R** = reachable on the mock backend (how). **—** = not reachable, and why.

1. **default** — a Checklist Manager sees the managers list read-only and can change Team Members. **R** — nadia, Team on Kitchen Opening.
2. **admin** — an Administrator changes both lists. **R** — raheem or priya, from CHK-07 or CHK-06.
3. **noManager** — "No Checklist Manager yet. Issues here will have no manager." **R** — raheem, Kitchen Closing at ZamZam.
4. **emptyTeam** — both lists empty. **R** — start a checklist at Central Kitchen on CHK-07, then open Team.
5. **picker** — Add Team Member: the people list. **R**.
6. **pickerSearch** — the list narrowed by what is typed. **R**.
7. **pickerEmpty** — "No one called {name}. Ask head office to create an account for {name}." **R**.
8. **pickerManager** — Add Checklist Manager: Team Members greyed, "Team Member here". **R** — raheem.
9. **adding** — the chosen person's row spins while the others wait. **R**.
10. **added** — "{name} added." **R**.
11. **removeConfirm** — "Remove {name} from {where}?" **R**.
12. **removeLast** — removing the last Team Member warns that runs will be missed. **R** — Kitchen Closing: Suresh is the only active one.
13. **removeLastManager** — warns that issues will have no manager. **R** — raheem, Kitchen Opening at ZamZam: Nadia.
14. **inactive** — an inactive person stays on the list, marked "Inactive". **R** — Kitchen Closing: Anil.
15. **singleOutlet** — one-outlet business: the checklist's name alone, no outlet line. **R** — kabir, after Start running on CHK-09.
16. **stopRunning** — "Stop {name}?" then "{name} stopped." **R** — kabir.
17. **reticked** — people who came back with a restarted outlet are marked "From before: check they're still right." **R** — on CHK-07 stop ZamZam on Kitchen Opening, Apply, tick it again, Apply, then tap Team. The note lasts for that visit.
18. **pastMembers** — a list of people taken off, with when and by whom. **R** — remove someone, then tap Past members.
19. **saveFailed** — "Couldn't save. Can't reach mise." in the picker; the same tap retries. **—** only on a real network failure.
20. **conflict** — "{name} is already on this team." **—** only when two people add the same person at once.
21. **notYours** — "You're no longer on {name}." and the lists are hidden. **—** only when taken off the checklist while it is open, or arriving by a link.
22. **forbiddenManager** — "You can only change Team Members on checklists you manage." **—** the screen hides the managers' controls from a Checklist Manager, so only a race shows it.
23. **gone** — "This checklist is no longer available." with Back. **—** only when archived while open.
24. **roleLost** — "Only head office can change this team." **—** only when an Administrator loses the role while open.
25. **serverError** — "That person can't be added to this checklist." **—** the picker greys out inactive people, so the platform's refusal is not reached.
26. **loading** — skeleton rows with avatars. **R**.
27. **loadFailed** — "Can't reach mise." with Retry. **R** — offline.
28. **long** — long and Malayalam names, a long outlet name. **R** — add the Malayalam-named person (ananthu) to a team; add an outlet with a long name.

## What the states pin down

- **Two lists**: "Checklist Managers · n" and "Team Members · n". Each row is an avatar, the name, an "Inactive" mark when it applies, and Remove.
- **Who may change what.** An Administrator or Owner changes both lists. A Checklist Manager changes Team Members only: the managers' Remove buttons and the Add Checklist Manager button are not drawn. The platform enforces it too.
- **Add Team Member** is pinned at the bottom; **Add Checklist Manager** sits under the managers (Administrators only).
- **The people list** has everyone in the business, searchable. Anyone already on the team is greyed out and says why: "Already on the team", "Already a Checklist Manager", "Team Member here", "Checklist Manager here", or "Inactive". Nobody holds both roles on one checklist.
- **Removing asks first**, reminds that past answers keep the name, and warns when it empties a list.
- **A one-outlet business** shows the checklist's name alone and has Stop running at the bottom.
- **When the screen can no longer be used** (taken off, archived, role lost) the lists go and a message says why.
- **Authored text** (checklist, outlet and people's names) is shown as typed; everything else is in all four languages.

## Past members and removals

- **Nobody is deleted.** Taking someone off records when and by whom. Past members lists them, latest first: "Sana · removed 2 Oct by Raheem".
- **Coming back.** Adding the same person again reuses their row, in either role.
- **Who may read a team.** An Administrator, an Owner, or that assignment's own Checklist Manager. An implementer works the checklist and gets "not your assignment".

## Not built, and why

- **A trigger for the failure states** on the mock (19 to 25): they need a race, or a failing network. The classifier is tested and the screen handles each.
