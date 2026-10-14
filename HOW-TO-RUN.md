# Practicum Adventure: GM quick start

## Setup (once per practicum day)
1. Open the GM console: your GitHub Pages address (or `index.html` from the folder) in Chrome or Edge. First time on a laptop: paste the private roster into **NPC roster** on the title screen.
2. This is your **GM console** (laptop screen).
3. Click **Open player screen**. Drag the new window to the projector and press **F11**.
4. Click once on the player screen ("CLICK TO START") so the sound can play.

## Phones (optional, Kahoot-style)
- The console opens a room automatically (sidebar: **📱 Phones · room ABCD**). Cadets scan the QR code on the projector, or go to `join.html` and type the room code and their last name.
- Phones fill the party slots in join order. From their phone, cadets pick their class, perk, pilot and level-up upgrade, **vote** on choices (votes show on the projector and next to each choice on your console), **tap to roll** when they're the roller, pick their stat for the boss exercise, and **ask** you to use their ability or a Leadership Token. Those requests appear in the sidebar with Approve / Dismiss.
- You still lock in every decision. Anything a phone can do, you can also do from the console, so a cadet without a phone just tells you.
- **New run** disconnects the last party's phones. ✖ next to a name removes that cadet.
- Field guide for cadets: `guide.html`.

## Each party (~30 min)
1. **New run**. The projector shows two briefing screens, HOW TO PLAY and READING THE SCREEN. Read them out loud, then go to class select.
2. **Class select**: cadets pick classes (phone, or you type names and set classes). A Flight Commander is required, and no two cadets can share a class. Perks are hidden. Click **Lock in the classes → reveal perks**.
3. **Perk selection**: the projector reveals each cadet's two perks. Each cadet picks one, then click **Lock perks → pick pilots**.
4. **Pick your pilot**: each cadet picks one of the 16 numbered 8-bit characters.
5. **Roll the d6 for the unit**, then show the crew manifest. NPCs are drawn from the cadet roster, and nobody in the current party can be drawn.
6. **Open the route map**. Click the glowing stop to move on.
7. On missions, click the letter the party chooses:
   - 🎲 checks: pick who rolls, then click **Roll the d20**. All dice are digital and animate on the projector.
   - 🎤 encounters: start the act clock, play the NPC, then rate them 1–3 stars.
8. After every stop, roll the d10 inject check (and spin Murphy's wheel if it hits). The route has 6 stops; after stop 3 the party levels up. Short on time? The map panel has a "skip to the boss" button.
9. **Boss: Lt Col Cacic (IG)**. Run the Audit. Then the Interview: everyone rolls, and the two lowest rolls answer the questions. Then the No-Notice Exercise: each cadet picks a stat, and everyone rolls.
10. **Results**: enter a team name and click **Save to leaderboard**, then **Power down** to start the reality debrief.
11. **Debrief**: switch between the Decoder and the Replay timeline (🔦 spotlights an event on the projector). Score the rubric sliders, then **Save grades**.

## Good to know
- Everything autosaves. If a window closes, reopen `index.html` and click **Resume saved run**.
- **↩️ Undo** reverses any GM click. The right sidebar can override meters, loyalty, tokens, items and achievements.
- After each day, use **Export leaderboard + grades (JSON)** as a backup. **Export grades CSV** is for the gradebook.
- All content (missions, injects, loot, names, scoring) lives in `data.js` if you want to tune it.
