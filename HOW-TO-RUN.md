# Practicum Adventure: GM quick start

## Setup (once per practicum day)
1. Open the GM console: your GitHub Pages address (or `index.html` from the folder) in Chrome or Edge. The NPC roster is built in (edit the name lists in `data.js` to change it).
2. This is your **GM console** (laptop screen).
3. Click **Open player screen**. Drag the new window to the projector and press **F11**.
4. Click once on the player screen ("CLICK TO START") so the sound can play.

## Test it locally on your own computer
1. Double-click **`Play-Locally.bat`** in this folder. A small window opens (leave it open) and the GM console opens in your browser at `http://localhost:8765/`.
2. Click **Open player screen** as usual to get the projector view.
3. To play the cadets yourself, open **`http://localhost:8765/test.html`** in another window. The room code fills in automatically. Pick how many cadets, click **Open phones**, and you get that many phone screens side by side, each a separate cadet.
   - Don't use plain `join.html` in several tabs: every tab in the same browser shares one saved identity, so they all join as the same cadet.
   - If an old test phone is still holding a seat, use the console's disconnect-every-phone button, or click **New run** while a game is in progress.
4. Close the small server window when you're done. Edits to the game files show up on a normal browser refresh.
- Phones need an internet connection for the PeerJS room (the same as the live version).
- Real phones can't reach `localhost`: this build is for testing on one computer. For real phones, use the GitHub Pages version.

## Phones (optional, Kahoot-style)
- The console opens a room automatically (sidebar: **📱 Phones · room ABCD**). Cadets scan the QR code on the projector, or go to `join.html` and type the room code and their last name.
- Phones fill the party slots in join order. From their phone, cadets pick their class, perk, pilot and level-up upgrade, **vote** on choices (votes show on the projector and next to each choice on your console), **tap to roll** when they're the roller, pick their stat for the boss exercise, and **ask** you to use their ability or a Leadership Token. Those requests appear in the sidebar with Approve / Dismiss.
- **Cadet turns:** every random event (squadron roll, inject check, Murphy's wheel, unknown-stop d6, loot d4 and loot wheel, fumble wheel, hot-seat roll) is handed to a cadet, rotating through the team. That cadet gets a big ROLL / SPIN button on their phone, and the projector shows "YOUR TURN, CAPT HELLE." Your console shows a yellow "Waiting on…" bar with a **Press it for them** button.
- **Votes:** the team votes on their phones for the route (top or bottom path), Rest Stop and Base Exchange (BX) options, mission choices, and **how to respond to injects** (most Murphy results have two responses). Votes show as avatars on the projector and 🗳️ counts on your buttons; you click the winner.
- **Before every d20 check:** the 👑 holder picks the roller on their phone. Anyone can **💪 boost** (spend 1 📦/❤️/⭐ for +2, max 2 per roll, paid when it's rolled). Every check rolls the die (there is no "play it safe" option). The projector and your console show the odds ("need 11+ (50%)").
- **⚡ Usable now:** when a token, item, class ability or perk would help, it appears on the projector and on phones (flashing if it's urgent, e.g. a Waiver after a failed roll). Cadets tap it to ask you; approve it in the sidebar.
- You still lock in every decision. Anything a phone can do, you can also do from the console, so a cadet without a phone just tells you.
- **New run** disconnects the last party's phones. ✖ next to a name removes that cadet.
- Field guide for cadets: `guide.html`.

## Each party (~30 min)
1. **New run**. The projector shows two briefing screens, HOW TO PLAY and READING THE SCREEN. Read them out loud, then go to class select.
2. **Class select**: cadets pick classes (phone, or you type names and set classes). A Flight Commander is required, and no two cadets can share a class. Perks are hidden. Click **Lock in the classes → reveal perks**.
3. **Perk selection**: the projector reveals each cadet's two perks. Each cadet picks one, then click **Lock perks → pick pilots**.
4. **Pick your pilot**: each cadet picks one of the 16 numbered 8-bit characters.
5. **The team votes on the squadron** on their phones, then you show the crew manifest. On the org chart screen the team **votes on their team patch** (their leaderboard name). Votes show on the projector and as 🗳️ counts on your buttons. Click the winner to lock it in. If you skip it, the top-voted patch is used. NPCs are drawn from the cadet roster, and nobody in the current party can be drawn.
6. **Open the route map**. Each stop has two options (top and bottom path); the team votes and you click the winner.
7. On missions, click the letter the party chooses:
   - 🎲 checks: the 👑 holder picks who rolls, the team decides on boosts or playing it safe, then the roller taps ROLL (or you click **Roll the d20**). All dice are digital and animate on the projector.
   - 🎤 encounters: start the act clock, play the NPC, then rate them 1–3 stars.
8. After every other stop (stops 2, 4, 6...), an inject hits: a cadet rolls the d6 to pick the wheel, and another spins it. Change `injectEvery` in `DIFFICULTY` (`data.js`) to adjust this. Loot drops pop up with an explanation; the team bag holds 3 items (a 4th pushes out the oldest). The route has 6 stops; after stop 3 the party levels up. Short on time? The map panel has a "skip to the boss" button.
9. **Boss: Lt Col Cacic (IG)**. Run the Audit. Then the Interview: everyone rolls, and the two lowest rolls answer the questions. Then the No-Notice Exercise: each cadet picks a stat and rolls their own d20 on their phone; it resolves when the last one rolls.
10. **Results**: enter a team name and click **Save to leaderboard**, then **Power down** to start the reality debrief.
11. **Debrief**: switch between the Decoder and the Replay timeline (🔦 spotlights an event on the projector). Score the rubric sliders, then **Save grades**.

## Difficulty and squadrons
- The game runs on a harder setting by default. Check targets are 15 (normal) and 18 (hard), injects hit on 1-7, the IG has 22 HP and hits for −3, and the No-Notice Exercise target is 14.
- Every squadron starts with its own meters and has a **tendency**: one meter drops 1 after every 2nd stop. For example, Security Forces loses Morale and the Comm/Cyber squadron loses Mission. It shows on the unit roll, the crew manifest, phones, and the Field Guide.
- **Signature missions:** Security Forces can draw Gate Runner, Round in the Ceiling, and Friendly Fire. Asleep at the Wheel shows up for SF, Maintenance, and LRS. Wake Me Up Later is more likely for Comm/Cyber.
- All of these numbers are in `DIFFICULTY` at the top of `data.js`. If parties are getting crushed, lower `dcPlus` or `bossHp`.
- New scenarios (M13-M24): DUI, dorm party, fight club, paintball in the command post, asleep at the wheel, round in the ceiling, domestic violence report, missed movement, gate runner, insubordination, napping in an exercise, and a spouse's death. Five of them hide integrity traps. In the serious ones, the person in trouble is always an unnamed Airman, never a roster name.

## Hidden meters and the DEOCS Survey
- The projector and phones don't show meter numbers. Each meter reads **STRONG** (7+), **STEADY** (4-6) or **DANGER** (3 or lower, flashing red). Your console always shows the real numbers.
- A **📋 DEOCS Survey** shows the exact numbers for the next 2 stops. Three ways to get one: the First Sergeant's **DEOCS Survey** perk (it also gives every Unit member +1 loyalty), the DEOCS Survey loot item, or buying one at the BX for 1 📦.
- `dangerAt` and `deocsStops` in `DIFFICULTY` (`data.js`) set the danger threshold and how long a survey lasts.

## Good to know
- Everything autosaves. If a window closes, reopen `index.html` and click **Resume saved run**.
- **↩️ Undo** reverses any GM click. The right sidebar can override meters, loyalty, tokens, items and achievements.
- After each day, use **Export leaderboard + grades (JSON)** as a backup. **Export grades CSV** is for the gradebook.
- All content (missions, injects, loot, names, scoring) lives in `data.js` if you want to tune it.
