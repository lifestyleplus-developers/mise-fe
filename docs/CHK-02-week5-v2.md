# CHK-02-v2 — Run execution · answering (week 5)

## References

- `week-5.html` at the mise root
- `docs/screens/CHK-02-week5.md` in the source of that file (from its own `spec:` field)

## Any prompts you need the mockup's creators to have answered

(The bundle embeds these prompts to its own user — recorded verbatim, personified:

- "Home at 07:10 IST. Pick a person above (priya = Team Member, answers; raheem = Checklist Manager on Kitchen Opening and Fridge Temperatures, watches) and tap a run. Answer Yes; tap No and write why; type a reading (try -15 on the freezer); tap Change, then Keep. 'No signal' makes new answers wait to send; 'signal back' sends them. 'Take photo' opens the camera flow (CHK-03)."

## States defined by the bundle (`jl`)

Exactly 29 in-file reference states, in bundle order:

1. **default** — Answering: Priya on Fridge Temperatures, 3 of 6: answers with Change, two reading fields, Take photo, countdown
2. **notStarted** — Nothing answered: Priya on Store Opening, 0 of 8: six Yes/No rows, a reading field, Take photo
3. **readingTyping** — Reading, keyboard up: −15 typed in the freezer field; the bar stays in view
4. **commentSheet** — Comment sheet: No on 'Floor is clean and dry', Save disabled, bar in view
5. **commentSheetTyping** — Comment sheet with text: Save enabled
6. **commentSheetLong** — Comment sheet, long title: the three-line Malayalam task; the sheet scrolls, Save / Cancel stay
7. **commentSheetReading** — Comment sheet for a reading: −15 °C, out of range
8. **changing** — Changing an answer: 'Change' tapped on Anjali's No; the two buttons and Keep
9. **changedKeptComment** — Changed to Yes: the old comment stays under it, editable
10. **notANumber** — Input error: '4..5' in the display chiller field: "Enter a number"
11. **rowError** — The server's message under a field (validation_error)
12. **logOnly** — A reading with no bounds: 'Recorded', neither tick nor flag
13. **pendingFirst** — First answer, no signal: Store Opening, 1 of 8, 1 waiting; the bar is its waiting part only
14. **pendingEdit** — An edit, no signal: still 3 of 6; bar solid 2 + waiting 1
15. **pendingEditWatching** — The same moment for Raheem (Checklist Manager): he still sees Anjali's Yes
16. **pendingNo** — A No with its comment, no signal: counts once
17. **pending** — 5 answers waiting to send on Kitchen Opening
18. **photoUploading** — Photo row: uploading
19. **photoTaken** — Photo row: taken: thumbnail, Retake, Add comment
20. **photoPending** — Photo row: upload failed, waiting to send
21. **finalMinutes** — Last 10 minutes: 10:51, '9 min left', the warning look
22. **finalSeconds** — Under one minute: '40 s left'
23. **countdownLong** — Countdown at its longest beside '12 of 12 answered · Complete' (Kitchen Opening): wraps
24. **complete** — All answered, first time: the line 'You can change answers until 10:30.'
25. **sheetWhileRefetch** — Anjali answers another task while the comment sheet is open: the sheet keeps its position (scroll unaffected by refetch)
26. **watching** — Watching: Raheem (Checklist Manager): the countdown, no control of any kind
27. **watchingFinal** — Watching in the last 10 minutes: Raheem sees the same warning look
28. **watchingPhoto** — Watching a complete run: Raheem can open the photo
29. **camera** — Take photo tapped: the camera (CHK-03 owns its own states)

Note: `priya = Team Member, answers`, `raheem = Checklist Manager, watches` — those are the roles; the mockup's other-persona flavor text (Anjali, Kiran) stands in for whoever is actually answering on a demo, not for different code paths.

## What the states pin down (the implementation contract)

- **No comment sheet**: a bottom sheet, Save disabled when empty, keyboard stay-in-view, title does not wrap in two strings, sheet scrolls for long titles; when the read/typed task content is refetched behind it, the sheet stays open in place. Reading failures route through a same sheet (`commentSheetReading`).
- **Server's message under a field** on a write that already got a 500/4xx from the platform; the row stays otherwise untouched.
- **Waiting segments**: a pending-write cap of the same run shows as a bar segment lighter than the real one; pending No-with-comment counts once.
- **Photo row**: taken (thumbnail, Retake, Add comment) → uploading → pending.
- **Countdown**: prominent number; **at 10 minutes it takes the warning look**; under a minute it says "XX s left".
- **Complete line** when every task is answered: "You can change answers until {time}."
- **Watch mode**: countdown still shows; no control rendered of any kind — but photo opening is permitted.
- **Change→Keep flow**: "Change" swaps answer; "Keep" re-tabs to what was there before; "Changed to Yes: the old comment stays under it, editable".
