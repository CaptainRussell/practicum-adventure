# Playtest: one person as GM + 4 cadets

Everything runs in one browser on this laptop. You need internet for the PeerJS broker
(the same as practicum day).

## Setup (2 minutes)

1. Serve the folder (phones need `http://`, not `file://`). `serve.py` is `python -m http.server`
   with caching turned off, so code edits show up on a normal reload:
   ```
   python serve.py
   ```
2. In Chrome or Edge, open **http://localhost:8000/test.html** (the test bench).
3. Click **1 · Open GM console**. It opens `index.html` in its own tab and creates the room.
   Put the GM tab and the bench side by side (Win + ← / Win + →) or on two monitors.
4. On the bench click **2 · Connect phones**. The phones join P1 to P4 in order, about 1.5 s
   apart. You can do this on the GM title screen or after **Start a new run**; title-screen joins
   keep their seats into the first run.
5. Click the projector once to unlock sound.

Bench controls: **⤢** enlarges one phone, **pop out** opens that phone in its own tab (each
keeps its identity), **Rejoin all** after any New run, view buttons hide the projector or
phones. The notes box autosaves; **download .md** exports it.

Simulated phones are `join.html?cid=pN&name=…&auto=1`. The `cid` parameter gives each tab
its own identity. Without it every tab in one browser shares `localStorage.sq_cid` and would
be the same cadet. Real phones never pass it, so practicum-day behavior is unchanged.

## Suggested run plan

Do **two runs**. Run 1: play every cadet's turn from their phone and touch the GM console
only when you have to. That shows whether cadets can actually drive the game. Run 2: play
the GM hard (cards, overrides, Undo, item approvals, a Waiver) and deliberately pick an
integrity trap to see the Game Over path.

| Phase | Do this as the cadets | Do this as the GM | Watch for |
|---|---|---|---|
| Join | Scan the full-screen QR (or let the bench join) | Start the briefing | Join count on the console |
| Intro | Read the two briefing screens on the projector | Next ➡ pilots | Can a cadet tell what to do from the projector alone? |
| Pilots | Each phone picks an avatar | Continue | Taken avatars disabled? |
| Position select | Each phone picks a different position (try a run with no Flight Commander) | Lock positions | Duplicate blocked? 👑 goes down the chain of command? |
| Perks | Each phone picks a perk | Lock perks | Perks only revealed now? |
| Kit check | Look over ability, perk and items | Continue | ONCE / PASSIVE badges read clearly? |
| Squadron / patch | Vote on the squadron, then the team patch | Click the winners, show the org chart | Squadron Warning on the pick screen; 👎 crossed out with an XO |
| Map (×5-7) | All vote; split the vote once | Click the winner | Vote avatars on the projector; 🗳️ counts on the console |
| Mission | Vote on a choice, vote for the roller; roller taps ROLL | Choose the voted letter, lock the roller | Odds text matches the result; phone arrows match the projector |
| 🎤 encounter | Act it out | Rate stars | Phones show "act it out" |
| Loot / fumble | Spotlight and elite loot goes straight to a loot wheel; basic scenarios do not drop loot; fumbles use their wheel | Continue | Guaranteed event loot and assigned turns feel fair |
| Inject | Assigned cadet rolls the d6, another spins the wheel; vote on the response | Apply winner | Wheel result matches the applied effect |
| Requests | From MY KIT: ask for ability, a perk, an item | Approve / Dismiss in the sidebar | Each request does what it says |
| Level up (after stop 3, or 4 on 7 stops) | Each phone picks an upgrade | Confirm | |
| Boss | Audit, then 3 rounds: each picks Press or Defend; Interview in round 2 | Rate interview stars, resolve | Allies deal Audit damage |
| Results / debrief | | Save leaderboard, power down, score rubric, export CSV | Leaderboard and CSV contents |

Rough timing target from HOW-TO-RUN: ~30 min per party. Note your actual time per stop.

## Evaluation checklist

**Clarity:** Could a cadet who missed the briefing play from their phone alone? Are 🔒 / 🎤 /
arrows understood without the legend? Is it always obvious whose turn it is?

**Pacing:** Minutes per stop. Dead time on phones (cadets with nothing to tap). Overlays on the
projector that hold the game up.

**Balance (DIFFICULTY in data.js):** Did any meter hit 0? How many checks passed vs failed?
Final grade. The defaults are the *hard* setting (DC 15/18, injects on 1–7, IG 22 HP).

**Learning objectives:** Do the trap choices read as tempting but recognizable? Do the debrief
questions connect to what actually happened in the run?

**GM load:** How many clicks per stop? Anything you had to hunt for?

## Things the code review flagged

**Fixed (2026-10-14), worth a re-check during the run:**

1. **Boss Phase 3 target on the projector.** It was hard-coded to 13 (10 with The Witness); the
   real target is `DIFFICULTY.examDC` = 14 (11). `player.js` now reads `examDC()`, so the
   projector, console and phones agree.
2. **Title-screen joins got kicked by Start a new run.** `startRun()` now keeps the phones and
   seats when the previous screen was the title. A New run from any later phase (the next party)
   still disconnects everyone, as before.
3. **Phones controlled the wrong cadet after a removed row.** `lockParty()` now moves each phone
   to its cadet's new row when empty rows are dropped. Re-check: 4 phones join, ✖ P2, give the
   other three positions, lock. Each remaining phone should show its own name.

**Fixed since:** choice arrows are computed from each choice's real effects (`choiceShow` in
`app.js`) on the projector, the console and phones; the old hand-written arrows are gone.

**Still open:**

4. **Minor:** offline (📵 in a meeting) cadets can still vote on mission choices from their
   phone (the button is disabled on the phone, but the GM does not re-check it); boss P3 lets the
   GM tick "Ally auto-pass" for more cadets than there are allies; the GM console's Waiver button
   shows after a *passed* roll too.

Data check (`data.js`): 24 missions, 8 with traps, every trap sets a flag in `TRAP_FLAGS`, every
flag and achievement the code reads exists. No dangling references found.
