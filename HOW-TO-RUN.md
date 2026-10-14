# Practicum Adventure: GM quick start

## Setup (once per practicum day)
1. Open the GM console: your GitHub Pages address (or `index.html` from the folder) in Chrome or Edge. The NPC roster is built in (edit the name lists in `data.js` to change it).
2. This is your **GM console** (laptop screen).
3. Click **Open player screen**. Drag the new window to the projector and press **F11**.
4. Click once on the player screen ("CLICK TO START") so the sound can play.

## Phones (optional, Kahoot-style)
- The console opens a room automatically (sidebar: **📱 Phones · room ABCD**). Cadets scan the QR code on the projector, or go to `join.html` and type the room code and their last name.
- Phones fill the party slots in join order. From their phone, cadets pick their class, perk, pilot and level-up upgrade, **vote** on choices (votes show on the projector and next to each choice on your console), **tap to roll** when they're the roller, pick their stat for the boss exercise, and **ask** you to use their ability or a Leadership Token. Those requests appear in the sidebar with Approve / Dismiss.
- **Cadet turns:** every random event (squadron roll, inject check, Murphy's wheel, unknown-stop d6, loot d4 and loot wheel, fumble wheel, hot-seat roll) is handed to a cadet, rotating through the team. That cadet gets a big ROLL / SPIN button on their phone, and the projector shows "YOUR TURN, CAPT HELLE." Your console shows a yellow "Waiting on…" bar with a **Press it for them** button.
- **Votes:** the team votes on their phones for the route (top or bottom path), Rest Stop and Supply Depot options, and mission choices. Votes show as avatars on the projector and 🗳️ counts on your buttons; you click the winner.
- **⚡ Usable now:** when a token, item, class ability or perk would help, it appears on the projector and on phones (flashing if it's urgent, e.g. a Waiver after a failed roll). Cadets tap it to ask you; approve it in the sidebar.
- You still lock in every decision. Anything a phone can do, you can also do from the console, so a cadet without a phone just tells you.
- **New run** disconnects the last party's phones. ✖ next to a name removes that cadet.
- Field guide for cadets: `guide.html`.

## Each party (~30 min)
1. **New run**. The projector shows two briefing screens, HOW TO PLAY and READING THE SCREEN. Read them out loud, then go to class select.
2. **Class select**: cadets pick classes (phone, or you type names and set classes). A Flight Commander is required, and no two cadets can share a class. Perks are hidden. Click **Lock in the classes → reveal perks**.
3. **Perk selection**: the projector reveals each cadet's two perks. Each cadet picks one, then click **Lock perks → pick pilots**.
4. **Pick your pilot**: each cadet picks one of the 16 numbered 8-bit characters.
5. **The Flight Commander rolls the d6 for the unit** on their phone, then you show the crew manifest. NPCs are drawn from the cadet roster, and nobody in the current party can be drawn.
6. **Open the route map**. Each stop has two options (top and bottom path); the team votes and you click the winner.
7. On missions, click the letter the party chooses:
   - 🎲 checks: pick who rolls, then click **Roll the d20**. All dice are digital and animate on the projector.
   - 🎤 encounters: start the act clock, play the NPC, then rate them 1–3 stars.
8. After every stop, a cadet rolls the d10 inject check (and another spins Murphy's wheel if it hits). Loot drops pop up with an explanation; the team bag holds 3 items (a 4th pushes out the oldest). The route has 6 stops; after stop 3 the party levels up. Short on time? The map panel has a "skip to the boss" button.
9. **Boss: Lt Col Cacic (IG)**. Run the Audit. Then the Interview: everyone rolls, and the two lowest rolls answer the questions. Then the No-Notice Exercise: each cadet picks a stat and rolls their own d20 on their phone; it resolves when the last one rolls.
10. **Results**: enter a team name and click **Save to leaderboard**, then **Power down** to start the reality debrief.
11. **Debrief**: switch between the Decoder and the Replay timeline (🔦 spotlights an event on the projector). Score the rubric sliders, then **Save grades**.

## Good to know
- Everything autosaves. If a window closes, reopen `index.html` and click **Resume saved run**.
- **↩️ Undo** reverses any GM click. The right sidebar can override meters, loyalty, tokens, items and achievements.
- After each day, use **Export leaderboard + grades (JSON)** as a backup. **Export grades CSV** is for the gradebook.
- All content (missions, injects, loot, names, scoring) lives in `data.js` if you want to tune it.
