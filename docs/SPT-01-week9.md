# SPT-01 — Capture flow · week 9

## References

- `mise-week-09.html` at the mise root: registry entry `SPT-01`, the state list that starts `default, final, camera, preview…`.
- Build plan: `BUILD-PLAN-WEEK-9.md` §2.3. FE Spec §3.11, §6, §7, API Contract §13, Model §18, Spot Checks §3 and §4, Schema `spot_check_run`, `spot_check_photo`.
- Routes: `/spot-checks` (the entry for everyone), `/spot-checks/capture/[runId]` (one run, opened from the list when two are revealed), and the `?run=ID` deep link for a "check revealed" notification.
- Code: `features/spot-checks/capture-screen.tsx`, `run-page.tsx`, `capture-view.ts`, `use-capture-flow.ts`, `capture-sheet.tsx`, `use-unsent-photos.ts`, and the shared parts from step 1.3 (`countdown-ring.tsx`, `prompt-row.tsx`, `prompt-state.ts`, `use-spot-photo-upload.ts`).
- **The camera is in the app** (`expo-camera`, decided and built after the first version, which used the phone's own camera). A live view with the prompt, `Photo n` and the time left over the picture, the torch on the left, the shutter in the middle and Cancel on the right (`capture-camera.tsx`). The preview, the first-use card, camera off, camera would not start and no picture are the app's own. Expo Go includes `expo-camera`; a standalone EAS build has to be remade after it was added. Use photo moves straight on to the next prompt without closing the screen.

## States defined by the mockup

Exactly 35, in mockup order. "Reach it with" names the sign-in that shows the state on the mock backend (password `1234`). Times are measured from when the mock session began; run 1 is open for its first 15 minutes.

1. **default** — Revealed: the subject as the title, the check name under it, the countdown ring, the prompts with prompt 1 already sent, and Take photo for the next. _reshma, at the start: Lakshmi, Grooming — kitchen._
2. **final** — the last 5 minutes: the ring turns heavy and a "5 min left" chip appears. _reshma, 10 minutes after the start._
3. **camera** — the live camera: the band over the picture (`Photo n`, the prompt, the time left), the torch on the left, the shutter in the middle and Cancel on the right. _Take photo, on a phone with a camera, in Expo Go or a build made after `expo-camera` was added._
4. **preview** — "Photo preview": the picture just taken, the band (prompt and time left), Retake and Use photo. _Take photo._
5. **firstUse** — "mise needs the camera to take the photos for this spot check.", Continue and Not now, before the phone has been asked. _The first Take photo on a phone that has never been asked._
6. **cameraOff** — "Camera access is off", "Turn it on in your phone's settings.", Open settings. _Refuse the camera, or turn it off in the phone's settings._
7. **cameraFailed** — "Camera couldn't start.", Try again; after a second failure "Camera still couldn't start. Close other apps that use the camera and try again." _A phone or emulator with no camera._
8. **saveFailed** — "Couldn't save the photo. Free up space and try again.", then "Still couldn't save…" on a second failure. _The camera gives back no picture._
9. **torchOn** — the torch button shows "Torch on" with a stronger border and the torch lights. _On the live camera (3), tap Torch off._
10. **twoRevealed** — two checks revealed at once: a card for each (name, "Closes {time}"), the one closing first at the top; tapping one opens it, and Back returns to the list. _reshma, 3 to 15 minutes after the start (run 2 reveals at 3 minutes), or arun at the start._
11. **uploading** — a prompt shows "Uploading" while the photograph goes. _Use photo (brief)._
12. **pending** — "Waiting to send", and "1 photo waiting to send" above the list: the picture is in storage and the send is queued. _arun, at the start: open "Slow send test" (Elegance), take photo 1. Its prompt is `slow`, so the send takes 8 seconds to be answered and shows "Waiting to send" for that long. Turn the signal off in that time and it stays queued until it returns._
13. **uploadFailed** — the upload of the picture itself fails: the prompt shows the failed state with Retry. _arun, at the start: open "Upload test" (Elegance), take photo 1. Its prompt is `upload`, so the first upload of that run is refused. Tap Retry and it goes through._
14. **noUploadUrl** — no signal to get an upload location: the photograph is kept on the phone, "Waiting to send" with Send now. _Take a photo with the phone offline; it sends when the signal returns, or on Send now._
15. **retaken** — Retake on a sent prompt: the new photograph with its time and the replaced one, quieter, with its own. _Retake a prompt that shows Sent._
16. **allSent** — every prompt taken: no Take photo, "All photos taken. Results will appear in Results." _Take them all._
17. **closedDone** — the window has closed: "Closed at {time}" and "Done. Results will appear in Results.", the countdown gone, no camera. _Take every photo, then let the window close._
18. **closedNone** — "Not done. The window closed before any photo was taken." _Let a window close with nothing taken. There is no retry._
19. **closedPartial** — "{n} of {total} photos · assessed on these". _Let it close with some taken._
20. **lateRefused** — a photograph sent after the close: "Window closed. This photo was not recorded. It will show as missed." on its prompt. _Take a photo offline (14), let the window close, go back online._
21. **partialFallback** — a platform that records a partial capture as not done: "Closed · Not done. 2 of 3 photos were taken." instead of "assessed on these". _Sign in as `basic`, open its run "Grooming — kitchen", take photos 1 and 2, leave 3 and wait for the window to close (about 19 minutes; reload to restart the clock). In Results, the earlier two-of-three run (Imran) shows the same line, with no outcomes._
22. **retakeFallback** — a platform that keeps only the latest photograph: the prompt shows the new photograph with its time and no "Replaced" line. _Sign in as `basic`, open its run "Grooming — kitchen", take photo 1, then Retake it. In Results, the retaken run (Lakshmi, run 10) shows one photograph on prompt 2._
23. **scheduled** — before the reveal: "{check name} · scheduled" in a dashed card, with **no subject and no time**. _reshma, after the first two checks close (about 18 minutes in) and before the third reveals (at 60)._
24. **empty** — "No spot check right now." _arun at 20 minutes in (nothing is open or scheduled for him), or anyone once the day's checks are done._
25. **noChecks** — "No spot checks are set up at this outlet yet." with a Checks link. _Head office, after archiving every check (SPT-05)._
26. **viewOnly** — "Viewing only. Only a Spot-check Manager can take these photos.", the countdown and prompts, no Take photo, no Retake. _raheem, zoya or priya while a check is open._
27. **area** — an area check: the area's name as the title, two prompts. _reshma: Cold room (Food areas — hygiene), after it reveals at 3 minutes._
28. **loading** — skeleton rows.
29. **loadFailed** — Retry above; the prompts already loaded stay. _Open the screen offline; pull to refresh once loaded._
30. **roleLost** — "You can't take photos for this check.", no Take photo. _arun, at the start: open "Role lost test" (Elegance) and take photo 1. Its prompt is `revoked`, so the send answers 403 and the screen turns read-only._
31. **moduleOff** — back to Modules with "Spot checks aren't turned on for {business}." _A 404, or switch spot checks off for every outlet._
32. **signOutQueued** — signing out with a photograph not yet sent asks first: "A photo hasn't been sent. 1 photo hasn't been sent yet. If you sign out now it will be lost." Stay signed in / Sign out anyway. _Take a photo offline (14), then Settings → Sign out._
33. **long** — a 41-character check name, a 120-character prompt. _arun, at the start: Grooming — front of house, evening service._
34. **many** — 8 prompts. _arun, at the start: Full inspection._
35. **clock12** — "Closed at 2:30 PM" and every time follow the phone's 12 or 24-hour clock. _Change the phone's clock._

## What the states pin down

- 🔒 **The subject is not readable before the reveal.** A scheduled check is a card with its name and nothing else: no subject, no time, no prompts. The mock sends none of it, and nothing on the screen reads it from anywhere else.
- **Everyone lands here.** One revealed check is shown at once; two are a list, the one closing first on top; none is the scheduled card, or "No spot check right now.". Results, Checks and Areas are links under the title (Checks and Areas for head office only).
- **The countdown is the feature.** The ring, the words and, from 5 minutes, the heavy ring. It always says what running out means: recorded as not done, and it cannot be redone. There is no retry endpoint.
- **Taking a photograph.** Take photo opens the camera for the first prompt not yet taken; Use photo sends it and moves on to the next prompt (not after a Retake). Live capture only; the gallery is never offered (FE Spec §7).
- **A photograph is never lost quietly.** It is kept on the phone until it is in storage, queued until the platform has it, and shown at every step as a word with an icon. Nothing is shown as failed while it is only waiting (FE Spec §6). Signing out with any unsent photograph says so first.
- **A retake keeps both.** The new photograph and the one it replaced each show who took it and when.
- **After the close** the countdown goes, the camera goes, and the card says how it ended: done, not done, or "{n} of {total} photos · assessed on these". A photograph still waiting when the window closes is refused by the platform and reads "It will show as missed".
- **Who can take photographs.** Only the manager the check was revealed to. Head office sees the same screen read-only. Another manager who opens the run by link is also read-only.
- **Placeholder prompts.** A line above the prompts says they are examples until the AI evaluation, as on SPT-05.
