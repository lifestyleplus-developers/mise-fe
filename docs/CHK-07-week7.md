# CHK-07 — Assignment, pick outlets · week 7

## References

- `mise-week-07.html` at the mise root: registry entry `CHK-07`, state list `tf`, component `ff`.
- Build plan: `BUILD-PLAN-WEEK-6-7.md` §2.4.
- Route: `/checklists/[id]/outlets`, from the Outlets row of CHK-06. ADMIN and OWNER only. Hidden in a one-outlet business, which starts a checklist from CHK-09 instead.

## States defined by the mockup

24, in mockup order. **R** = reachable on the mock backend (how). **—** = not reachable, and why.

1. **default** — Kitchen Opening: some outlets running, one not. **R** — raheem. Central Kitchen is the one not running.
2. **fresh** — runs nowhere yet, with the hint "Tick where this checklist should run." **R** — Monthly Deep Clean, after adding a task.
3. **staged** — Central Kitchen ticked: "Will start", button "Apply to 1 outlet". **R**.
4. **bothStaged** — one to start, one to stop: "Apply changes". **R**.
5. **stopStaged** — an outlet unticked: "Will stop", button "Apply". **R**.
6. **stopConfirm** — "Stop {name} at {outlet}?" **R**.
7. **stopConfirmMany** — "Stop {name} at {n} outlets?" **R** — untick two.
8. **discard** — Back with ticks staged: "Discard changes?" **R**.
9. **applying** — spinner on the button and on the staged rows, ticks locked. **R**.
10. **applied** — "{name} now runs at {n} outlets." **R**.
11. **pickManager** — "Checklist Manager · {outlet}": the people list. **R** — Name a manager on a running outlet with none.
12. **managerNamed** — the row now reads "Running · {name}". **R**.
13. **pickManagerFailed** — "Couldn't save. Can't reach mise." in the picker. **—** only when the network really fails; the mock has no trigger.
14. **stopped** — an outlet stopped by Apply: "Stopped". **R**.
15. **reticked** — a stopped outlet ticked and applied again: "Running · {manager} · from before". **R** — stop ZamZam on Kitchen Opening, Apply, tick it again, Apply.
16. **archived** — an archived outlet still carrying it: ticked, read-only, "Outlet archived". **R** — archive an outlet that runs a checklist, then open the checklist.
17. **archivedFallback** — the platform stops a checklist when its outlet is archived: "Stopped · outlet archived". **—** the mock does not stop it. The screen shows it if the platform does.
18. **noTasks** — no tasks yet: Apply disabled, "Add at least one task first." and Go to Tasks. **R** — Monthly Deep Clean.
19. **applyFailed** — "Couldn't save. Can't reach mise.", ticks kept, rows read "Not applied". **—** only on a real failure.
20. **partFailed** — "Couldn't apply to {n}. Can't reach mise." **—** only on a real failure; starts go in one request and each stop in its own, so a stop can fail alone.
21. **forbidden** — "Only head office can change where this checklist runs." **—** only on a real 403; the frame already sends non-admins away.
22. **loading** — skeleton rows. **R**.
23. **loadFailed** — "Can't reach mise." with Retry. **R** — offline.
24. **long** — a long outlet name wraps; two managers read "Running · Raheem, Zoya". **R** — add an outlet with a long name; name a second manager from Team.

## What the states pin down

- **Each row** is a tick, the outlet's name and a line saying where it stands: Not running, Will start, Will stop, Running · {managers or "No manager yet"}, Stopped, Not applied, or Outlet archived.
- **Ticking a running outlet** marks it to stop; ticking one that is not running marks it to start. Tapping again takes the change back. Nothing happens until Apply.
- **Apply** says what it will do: "Apply to 1 outlet", "Apply to {n} outlets", "Apply changes" when starts and stops are mixed, "Apply" for stops alone. It is disabled with nothing staged, and while the checklist has no tasks.
- **Stopping always asks first.** History stays; no further runs are created there.
- **Stopped is not gone.** A stopped outlet keeps its people. Starting it again brings them back, marked "from before" so they can be checked.
- **Outlets that start get no manager automatically.** A running outlet with none shows **Name a manager**; one with a manager shows **Team**, which opens CHK-08.
- **Part of Apply can fail.** What went through is applied; what did not stays ticked and reads "Not applied".
- **"Runs start within a day."** sits under the list: new runs are created on the platform's six-hourly pass.
- **Authored text** (outlet names, people's names) is shown as typed; everything else is in all four languages.

## Not built, and why

- **A trigger for the failure states** (13, 19, 20, 21) on the mock: the platform's calls cannot be made to fail from a name, as an outlet cannot be named `offline`.
- **Single-outlet variant** ("Start running"). It lives on CHK-09, which creates the assignment and opens the team screen.
