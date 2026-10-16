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
- **Before every d20 check (and every Tackle it):** the team **votes on who rolls**; phones and the projector show each cadet's bonus and odds ("needs 11+ (50%)"). You click the winner to lock it in, then that cadet taps ROLL. There are no boosts.
- **⚡ Usable now:** when a token, item, class ability or perk would help, it appears on the projector and on phones (flashing if it's urgent, e.g. a Waiver after a failed roll). Cadets tap it to ask you; approve it in the sidebar.
- You still lock in every decision. Anything a phone can do, you can also do from the console, so a cadet without a phone just tells you.
- **New run** disconnects the last party's phones. ✖ next to a name removes that cadet.
- Field guide for cadets: `guide.html`.

## Each party (~30 min)
1. **New run**. The projector shows two briefing screens, HOW TO PLAY and READING THE SCREEN. Read them out loud, then go to class select.
2. **Class select**: cadets pick classes (phone, or you type names and set classes). The Flight Commander is optional (without one, the best-CMD cadet holds the 👑 tie-break), and no two cadets can share a class. Perks are hidden. Click **Lock in the classes → reveal perks**.
3. **Perk selection**: the projector reveals each cadet's two perks. Each cadet picks one, then click **Lock perks → pick pilots**.
4. **Pick your pilot**: each cadet picks one of the 16 numbered 8-bit characters.
5. **The team votes on the squadron** on their phones, then you show the crew manifest. On the org chart screen the team **votes on their team patch** (their leaderboard name). Votes show on the projector and as 🗳️ counts on your buttons. Click the winner to lock it in. If you skip it, the top-voted patch is used. NPCs are drawn from the cadet roster, and nobody in the current party can be drawn.
6. **Open the route map**. Each stop offers 2 or 3 options; the team votes and you click the winner. Every route follows the same arc, only the details change: opener (always a ❓ and a ⚔️) → warm-up → the test (💀 Elite or 🔦 Spotlight) → 🛒 supply run → final push (💀, ⚔️ or ❓) → 🏕️ Rest Stop or 🛒 BX → the IG. Tweak the arc in `ROUTE_BEATS` / `STOP_PLANS` (`app.js`).
7. On missions, click the letter the party chooses:
   - 🎲 checks: the team votes for the roller, you lock it in, then the roller taps ROLL (or you click **Roll the d20**). All dice are digital and animate on the projector.
   - 🎤 encounters: once you rate the stars, the choice card shows the real meter changes.
   - 🎤 encounters: start the act clock, play the NPC, then rate them 1–3 stars.
8. After every other stop (stops 2, 4, 6...), the route map opens on the **🎡 inject waypoints**: the team votes for one (it also locks in the path to the next stop), then the inject hits: a cadet rolls the d6 to pick the wheel, and another spins it. Change `injectEvery` in `DIFFICULTY` (`data.js`) to adjust this. Loot drops pop up with an explanation; the team bag holds 3 items (a 4th pushes out the oldest). The route has 6 stops; after stop 3 the team picks a **⬆️ level-up waypoint** the same way. Short on time? The map panel has a "skip to the boss" button.
9. **Boss: Lt Col Cacic (IG)**. Run the Audit (every Ally deals 2 damage). Three rounds: each cadet picks **🗡️ Press** (rolls their best stat) or **🛡️ Defend** (blocks 2 of the IG's attack). Round 2 opens with the Interview: everyone rolls, and the two lowest rolls answer the questions.
10. **Results**: enter a team name and click **Save to leaderboard**, then **Power down** to start the reality debrief.
11. **Debrief**: switch between the Decoder and the Replay timeline (🔦 spotlights an event on the projector). Score the rubric sliders, then **Save grades**.

## Difficulty and squadrons
- The game runs on a harder setting by default. Check targets are 15 (normal) and 18 (hard), injects hit on 1-7, the IG has 22 HP and hits for −3, and the No-Notice Exercise target is 14.
- Every squadron starts with its own meters and has a **tendency**: one meter drops 1 after every 2nd stop. For example, Security Forces loses Morale and the Comm/Cyber squadron loses Mission. It shows on the unit roll, the crew manifest, phones, and the Field Guide.
- **Signature missions:** Security Forces can draw Gate Runner, Round in the Ceiling, and Friendly Fire. Asleep at the Wheel shows up for SF, Maintenance, and LRS. Wake Me Up Later is more likely for Comm/Cyber.
- All of these numbers are in `DIFFICULTY` at the top of `data.js`. If parties are getting crushed, lower `dcPlus` or `bossHp`.
- New scenarios (M13-M24): DUI, dorm party, fight club, paintball in the command post, asleep at the wheel, round in the ceiling, domestic violence report, missed movement, gate runner, insubordination, napping in an exercise, and a spouse's death. Five of them hide integrity traps. In the serious ones, the person in trouble is always an unnamed Airman, never a roster name.

## Crisis Events (real fail states)
- When a meter hits 0, a Crisis Event strikes as soon as the current event is resolved (your next Continue). If the team fixes the meter before then (an item, a perk), it's cancelled.
- Every crisis takes something for good: **Morale** = an Airman in the flight dies by suicide (every Unit member −1 loyalty; the screen shows the 988 / Military Crisis Line); **Trust** = the CC fires the Flight Commander, or the 👑 holder if there's no FC (no votes, rolls or perk; the 👑 passes to the cadet with the best CMD); **Mission** = a squadron-specific disaster (all items lost, IG +4 HP); **Resources** = the lowest-loyalty Unit member quits for good and all items are lost. Then the team picks a costly way to dig out.
- **A second Crisis Event (or a meter hitting 0 in the IG fight after one) = GAME OVER.**

## Hidden meters and the DEOCS Survey
- The projector and phones don't show meter numbers. Each meter reads **STRONG** (7+), **STEADY** (3-6) or **DANGER** (2 or lower, flashing red). Your console always shows the real numbers.
- A **📋 DEOCS Survey** shows the exact numbers for the next 2 stops. Three ways to get one: the First Sergeant's **DEOCS Survey** perk (it also gives every Unit member +1 loyalty), the DEOCS Survey loot item, or buying one at the BX for 1 📦.
- `dangerAt` and `deocsStops` in `DIFFICULTY` (`data.js`) set the danger threshold and how long a survey lasts.

## Shared leaderboard (one-time setup, ~10 minutes)
**Status: set up.** The game uses the Firebase project `practicum-adventure`. See **[FIREBASE-BACKEND.md](FIREBASE-BACKEND.md)** for how it works, what's stored, limits, management and troubleshooting. The steps below are kept for reference, or for setting up a new project.

Without this, the leaderboard lives only in the browser running the GM console. With it, every computer running the game sees the same high scores, and runs upload automatically.
1. Go to [console.firebase.google.com](https://console.firebase.google.com), sign in with a Google account, and click **Create a project** (any name, e.g. `practicum-adventure`). You can turn off Google Analytics.
2. In the left menu: **Build → Firestore Database → Create database**. Pick a location near you, choose **production mode**, and finish.
3. Open the **Rules** tab, replace everything with the contents of `firestore.rules` from this folder, and click **Publish**.
4. Click the ⚙️ gear → **Project settings**. Under **Your apps**, click the web icon `</>`, register an app (any nickname, no hosting needed). Copy the `projectId` and `apiKey` it shows.
5. Paste them into the top of `cloud.js`:
   ```js
   projectId: 'practicum-adventure-1a2b3',
   apiKey: 'AIza...',
   ```
6. Commit and push to GitHub. Open the game, and the leaderboard card on the GM console should say **☁️ Shared leaderboard: synced just now**.

How it behaves:
- Every finished run uploads as soon as it's saved. If the internet is down, it waits and uploads on its own later. The card shows how many runs are waiting.
- Runs already saved in a browser before setup are uploaded the first time that browser syncs.
- The board refreshes from the cloud when the console opens, after every save, and every 5 minutes while the board is on screen (it doesn't poll during missions, to stay well inside Firebase's free daily limit).
- **Test builds stay out of it:** `Play-Locally.bat` (localhost) doesn't touch the shared board. Add `?cloud=1` to the address if you want to test the sync itself.
- **Deleting entries:** the game can't delete from the shared board, on purpose. Delete a run in the Firebase console under **Firestore Database → Data → leaderboard**. It disappears from every GM console within a minute and won't be re-uploaded. With sync on, the **Clear leaderboard** button is hidden, since cleared runs would just download again.
- **Only the leaderboard is shared.** It holds team names, cadet ranks and names, scores and the game's letter grade. Your grading rubric scores and notes stay in the GM's browser, so keep exporting them.
- The API key in `cloud.js` is meant to be public. `firestore.rules` is what protects the data: anyone with the game can read the board and add runs, but every field is checked and nothing can be deleted from the game.

## Good to know
- Everything autosaves. If a window closes, reopen `index.html` and click **Resume saved run**.
- **↩️ Undo** reverses any GM click. The right sidebar can override meters, loyalty, tokens, items and achievements.
- After each day, use **Export leaderboard + grades (JSON)** as a backup. **Export grades CSV** is for the gradebook.
- All content (missions, injects, loot, names, scoring) lives in `data.js` if you want to tune it.
