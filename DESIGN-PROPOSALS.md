# Design decisions (playtest round 1)

Decided with Capt Russell on 2026-10-14. This is the build spec for round 2. Content marked
**(draft)** gets reviewed one at a time in the content walkthrough.

## Core rule changes

- **All Unit member traits are visible.** No hidden traits. Rework everything that depended on
  hiding: the Witness trait, the "Open Door" achievement (reveal 2+), mission `reveal` effects, the
  GM card "The Witness Speaks", and debrief text. (Reviewed in the trait walkthrough.)
- **No team Leadership Tokens.** Intel Briefing moves to the XO perk; Write a Memorandum moves to
  the Plans perk. Remove the token row from the HUD. Replace the "Extra Leadership Token" loot item
  and the Depot "buy back a token" trade (reviewed in the loot walkthrough).
- **"NPC" becomes "Unit member"** in every player-facing place.
- **Team name is required** before the GM can lock classes.
- **Score:** "Unused items & tokens ×5" becomes "Unused items & perks ×5".
- **Inject odds:** 2 / 2 / 2 on the d6 (1-2 Failure, 3-4 Meh, 5-6 Success).
- **Ties:** banner only (the Flight Commander breaks it out loud).

## Perks (two per class, pick one, each once per game, usable in the boss fight)

| Class | Perk A | Perk B |
|---|---|---|
| 👑 Flight Commander | **Trust Your People**: once, a teammate rolls a CMD check with your CMD | **Hold the Line**: once, a meter that would drop to 0 stops at 1 |
| 🎖️ Flight Chief | **Been There**: once, cancel a Wheel of Failure result after it lands | **Senior NCO Pull**: once, a Unit member at loyalty 0-2 jumps to 3 |
| 💚 First Sergeant | **Open Door Policy**: once, +1 loyalty to every Unit member OR +3 to one | **Resiliency Day**: once, ❤️ +3 and every Unit member +1 loyalty, 🎯 −1 |
| 🗣️ Executive Officer | **Read the Room**: once, see the exact effects of every choice on this mission | **Commander's Confidant**: once, cancel the commander's negative perk for the rest of the game |
| 📦 Resource Advisor | **Emergency Fund**: once, +3 📦 | **Year-End Money**: once, double the gains of one Rest Stop, Depot trade or Wheel of Success result |
| 🧠 Plans Officer | **Write a Memorandum**: once, reroll a failed d20 | **Wargame It**: once, a check rolls two d20s and keeps the higher |

Perk names for the XO are placeholders; rename freely.

## Class abilities

- **Flight Chief, Enlisted Bond** (game start, automatic): +1 loyalty to every enlisted Unit member
  (not the civilian) and +1 🎯.
- **First Sergeant, Rally** (game start, automatic): unchanged.
- Others unchanged.

## Level-up (first upgrade unchanged; second upgrade is now an immediate boost)

| Class | Upgrade A | Upgrade B (immediate) |
|---|---|---|
| 👑 FC | Battle-Tested: +1 CMD, +1 GRIT | **Huddle**: +1 to every meter |
| 🎖️ Chief | Standards Bearer | **Enlisted Council**: +1 loyalty to every Unit member, +1 🎯 |
| 💚 Shirt | Morale Engine | **Wingman Program**: +2 ❤️, +2 loyalty to the lowest-loyalty member |
| 🗣️ XO | Golden Child | **Commander's Favor**: +3 ⭐ |
| 📦 RA | Efficiency Expert | **Budget Drill**: +3 📦 |
| 🧠 Plans | Contingency Plan | **Planning Cell**: +2 🎯, +1 📦 |

## Stats

- **Tackle it:** every Wheel of Failure inject gets a third response, a d20 + stat check
  (stat per inject, **draft**). Pass = no loss; fail = the worse of the two normal responses.
- **Specialist +1:** when the roller's class guards the check's meter (Chief 🎯, Shirt ❤️, XO ⭐,
  RA 📦, Plans 🎯/📦, FC 🎯).
- **Stat-gated choices:** some mission choices unlock only if a cadet has the stat at +3
  (shown locked with the requirement). Which choices: **draft**, reviewed per mission.

## Spotlight stops (🔦 new map node)

- One cadet decides **alone and in silence**; only their phone gets the buttons.
- Each event is written for **one named class** (6 events, **draft**). A class that isn't in the
  party never gets its spotlight; the map only places a 🔦 node if its class is playing.
- About 1-2 per run.

## Commander (more impact)

- Each squadron commander gets a **positive and a negative perk** (**draft**, reviewed per squadron).
- **Commander reacts:** the perks trigger visibly ("Lt Col X approves") after missions.
- **Commander's Intent:** at game start the commander names a priority meter. At the end: 7+ = +20
  points, under 4 = −20.
- **Commander encounters:** some 🎤 missions are with your commander, by name (**draft**).
- **Commander at the IG:** ⭐ 7+ = they vouch (IG −3 HP); ⭐ 3 or less = under the bus (IG +3 HP).

## Org chart

- Per-squadron slots (ranks and descriptions differ by squadron) and squadron-weighted trait pools
  (**draft**, reviewed per squadron).
- **Phone tabs: GAME / KIT / ORG.** GAME = the current event, what to tap, a compact usable-now
  strip, the result card. KIT = class, stats, perk, upgrade, team items (glow when usable).
  ORG = commander (+/− perks, intent), Unit members (rank, trait, loyalty, ally/broken).

## Boss (6-8 minutes)

- **3 telegraphed rounds** (Audit, Interview, No-Notice Exercise). Each round the IG announces its
  attack on a meter; every cadet picks one action on their phone (Press = d20 + stat for damage,
  Defend = spend 1 of another meter to cut the attack by 2, Support = +3 to a teammate, or use a
  perk/item). Interview hot-seat stars add bonus damage. A 30 s action clock the GM can start.
- **Adverse Finding:** a meter at 0 during the fight = IG +4 HP, the meter resets to 1, and every
  roll for the rest of the fight is −1.
- **Hostile witness:** each broken Unit member (loyalty 0) = IG +2 HP and one interview question is
  about them. **Allies** (loyalty 5) can each be called once to absorb an IG attack.
- Audit integrity Game Over stays.

## Supply Depot (team picks one trade)

- **Call in a favor:** a Unit member −2 loyalty → free loot spin (team picks who)
- **Volunteer them for the tasker:** a Unit member −1 loyalty → +3 🎯 (team picks who)
- **Mandatory overtime:** −2 ❤️ → +3 📦
- **Schmooze the Group CC:** −2 📦 → +2 ⭐
- **Training slot:** −2 📦 → one cadet +1 to a stat for the rest of the game
- **Off-the-books trade:** +4 📦 now; an integrity trap the IG finds in the Audit (Game Over)
- No trade

## Content walkthrough (one at a time, after the build)

1. ✅ The 6 squadrons (decided 2026-10-14, built):

   | Squadron | 👍 | 👎 | Intent | Unit roles |
   |---|---|---|---|---|
   | 🔧 Wrench Kings | Maintenance Pride: +1 🎯 on passed 🎯 checks | Ops Tempo Hawk: every Rest Stop gives 1 less | 🎯 | as drafted |
   | 🛡️ Gate Guardians | Defender Ethos: 3⭐ 🎤 also +1 ❤️ | Inspection Ready: failed 🎯 check also ⭐ −1 | ⭐ | SrA sentry · Amn newest Defender · TSgt night-shift flight sergeant · **1st Lt** deputy (no civilian) |
   | 📡 Packet Pushers | Early Adopter: idea choices +1 ⭐ +1 🎯 | Death by PowerPoint: 1⭐ 🎤 also ⭐ −1 | 🎯 | as drafted |
   | 🚚 Supply Raiders | Logistician: two Depot trades per visit | Tight Wallet: 📦 gains −1 | ⭐ | as drafted |
   | 🔍 Shadow Analysts | Quiet Professional: +1 ⭐ on passed ⭐ checks | Compartmented: no ▲▼ arrows (Read the Room still works) | ⭐ | as drafted |
   | 🍔 Chow Hall Heroes | People Person: ❤️ gains +1 | Budget Squeeze: Depot trades cost 1 extra 📦 | 🎯 | as drafted |

   Balance: every Unit member now starts at **loyalty 2** (`startLoy`), so Enlisted Bond + Rally reach 4, not instant Allies.
   Bug found while testing: commander hooks written as a bare effect (idea, stars1, stars3, depotTax) applied nothing. Fixed.
   **Squadron choice:** no more d6. The team votes for its squadron on their phones (the projector
   shows all six with meters, commander 👍/👎, intent and tendency); the FC breaks ties, the GM locks it.
2. ✅ The 12 traits (decided 2026-10-14, built). Rewards fire **automatically** with a card, once
   per member unless it says "while":

   | Trait | Reward trigger |
   |---|---|
   | 🔥 Burning Out | First Rest Stop: +2 loyalty, +1 ❤️ |
   | 💡 Secret Genius | First 💡 idea adopted: +3 🎯, +1 loyalty |
   | 🏠 Family Crisis | First care from the First Sergeant (Rally, Open Door, Resiliency) or the Rest Stop loyalty option: +2 more loyalty, +1 ❤️ |
   | ⚠️ Rule Bender | While at loyalty 4+: trap choices show "⚠️ smells like a shortcut" |
   | 🏆 Climber | First 3⭐ 🎤 encounter: +2 loyalty |
   | 🤐 Silent Struggler | First time at loyalty 4: +2 🎯 |
   | 🤨 Cynic with a Heart | Ally at loyalty 4 (unchanged) |
   | 📢 Gossip | While loyalty 3+: Wheel of Success also +1 ❤️; at 1 or less: Wheel of Failure also −1 ❤️ |
   | 🏃 Over-Achiever | First Rest Stop: +2 🎯; volunteering them at the Depot costs 2 loyalty |
   | 🎓 Mentor-in-Waiting | Becomes an Ally: +1 🎯 +1 ❤️, newest Airman +2 loyalty |
   | 😴 The Coaster | Volunteered for the Depot tasker: +1 loyalty instead of −1, and +2 🎯 more |
   | 🕵️ The Witness | Unchanged: loyalty 4+ at the boss = Press target −3; broken = IG +3 HP |

   Breaking points are unchanged. The org chart and the phone ORG tab show each reward (✅ once used).
3. ✅ The 6 spotlight events (decided 2026-10-14, built). Still 2 per run, silent, own stats.
   - 👑 FC "One Nomination": approved as drafted.
   - 🎖️ Chief "Out of Standards": the quiet correction is a **CMD** check.
   - 💚 Shirt "0200 Phone Call": driving out yourself now costs 🎯 −2, 📦 −1 and you're **offline next
     stop**; the wingman pickup pass also gives 🎯 +1.
   - 🗣️ XO "The Numbers": "find what's improving and **sell** it" is a **CHA** check.
   - 📦 RA "Use It or Lose It": "Split it" replaced by **splitting the buy to dodge the approval
     limit**, an integrity trap (`SPLIT_PURCHASE`).
   - 🧠 Plans "Write the Exercise": building it with {C} is an **INS** check.

   Also: the 18 cadets playing this semester are out of the NPC roster (15 upper names remain), and
   the example name in the UI is now "Snuffy".
4. Missions (in progress). Decided 2026-10-14:
   - **Squadron-first draws:** each ⚔️ mission comes from the squadron's own pool 70% of the time
     (`squadronShare`), else the generic core. About 2.8 squadron + 1.2 core missions per 4.
   - **Generic core:** 8 missions (see below).
   - **💀 Elite = the squadron's critical mission** (X1-X6), with Elite rules (+3, doubled good
     effects, loot). After it's used, Elite falls back to a harder squadron mission.
   - **Squadron pools** (approved): 4 AMXS M8 M12 M17 M25 · 56 SFS M16 M17 M18 M21 ·
     6 CS M3 M6 M23 M26 M36 · 92 LRS M8 M17 M20 M27 M28 · 7 IS M6 M29 M30 M31 · 55 FSS M32 M33 M34 M35.
     New drafts M25-M36 and X1-X6 (6 new traps: TOOL_SIGNOFF, COVERED_SPILL, FOOD_SAFETY, FALSE_PT,
     FALSE_INSPECTION, FALSE_DEPLOY).
   - Arrows stay approximate. The 15 dead "reveal" effects became +1 loyalty. Dead flags wired:
     A1C_CONFUSED → {B} −1 loyalty next stop; BABYSITTER → ⭐ gains −1 for 2 stops; DODGED → ⭐ −2 in
     the IG interview.
   - ✅ **4 AMXS pool approved** (M8, M12, M17, M25, X1). M25's sign-off is no longer a trap: 🎯 +2
     now, 50% chance of 🎯 −3 ⭐ −3 next stop. M12's push-back is now a CMD check.
   - ✅ **56 SFS pool approved** (M16, M17, M18, M21, X2). M18's shooter is now "an Airman from another
     flight" so it can't be read as {A} (a SrA in this squadron).
   - ✅ **6 CS, 92 LRS, 7 IS, 55 FSS pools approved as drafted** (M3 M6 M23 M26 M36 X3 · M8 M17 M20
     M27 M28 X4 · M6 M29 M30 M31 X5 · M32 M33 M34 M35 X6).
   - ✅ **Generic core cut to 8:** M1 0900 Deadline, M2 The Shortcut, M4 The Coaster, M7 Brief the
     Boss, M9 The Overpromise, M11 Flightline Feud, M13 DUI at 0200, M19 Through the Wall. Retired
     (`off: true`, not deleted): M5 Not My Job, M10 New Kid, M14 Dorm Party, M15 Fight Club,
     M22 "Not Gonna Happen", M24 The Worst Call.
   - **Squadron names** are now real units: 4th Aircraft Maintenance Sq (was Wrench Kings), 56th
     Security Forces Sq (Gate Guardians), 6th Communications Sq (Packet Pushers), 92nd Logistics
     Readiness Sq (Supply Raiders), 7th Intelligence Sq (Shadow Analysts), 55th Force Support Sq
     (Chow Hall Heroes).
5. ✅ Injects (decided 2026-10-14, built). Now 20: 8 Failure, 6 Meh, 6 Success.
   - **No repeats in a run:** an inject that happens leaves the pool (the wheel shows fewer slices;
     Foresight only forecasts unused ones). A wheel refills only if it's completely used up.
   - **Tackle it** fails with its own result per inject (never the reprisal option). Stats: NETWORK
     DOWN INS · EMERGENCY LEAVE GRIT · EXERCISE RECALL CMD · BUDGET CUT GRIT · PRIORITIES CHANGED CMD ·
     RUMOR MILL INS · WEATHER GRIT · IG COMPLAINT INS.
   - **Emergency Leave:** the member always goes (2 stops). Tackling covers the gap: pass = no loss and
     the member +1 loyalty; fail = 🎯 −2.
   - **Quick Favor:** accepting sends {A} away for 1 stop (⭐ +1, {A} +1 loyalty).
   - **The Idea Worked / Great Family Day** now have choices. **New:** Short-Notice VIP Tour and
     Mandatory Fun Day (Meh), Below the Zone and Contractor Finishes Early (Success).
6. ✅ Loot and fumbles (decided 2026-10-14, built).
   - **Loot pool per run = 4 generic + the squadron's 4.** Even odds (no rarity); an item leaves the
     pool once it drops (no repeats). Items now declare a `use` type, so new items need no code.
   - Generic: ☕ Bottomless Coffee (+2 check) · 🪙 Commander's Coin (+3 any meter) · 🔄 Do-Over ·
     🔋 Second Wind (recharge an ability OR a perk; replaces Ability Recharge + Lessons Learned).
   - 4 AMXS: 📋 Battle Rhythm (pick Meh or Success instead of the d6) · 🔧 Torque Wrench (+3 check) ·
     🧰 Cannibalized Part (+3 📦) · 🎖️ Crew Chief Patch Ceremony (+2 ❤️, {A} +1 loyalty)
   - 56 SFS: 🦺 Body Armor (cancel a Failure result) · 🐕 MWD Team (+3 check) · 🏅 Defender of the
     Quarter (one member +3 loyalty) · 🍕 Mid-Shift Pizza (+2 ❤️)
   - 6 CS: 🧱 Firewall (cancel) · 📟 Help Desk Hero (+1 star) · 🤖 Automation Script (pick the
     wheel) · 🖥️ Spare Server (+3 🎯)
   - 92 LRS: 📦 Pallet of Spares (+3 📦) · 🚚 Priority Shipping (pick the wheel) · 📇 Vendor Contact
     (cancel) · 🏗️ Forklift Certified (+3 check)
   - 7 IS: 🔎 Current Intel (exact effects) · 🗂️ Source Network (+3 check) · 📊 Perfect Slide Deck
     (+2 ⭐) · 🔐 SCIF Access (cancel)
   - 55 FSS: 🍕 Pizza Fund (+2 ❤️) · 🎟️ Event Tickets (everyone +1 loyalty) · 🏨 Lodging Upgrade
     (+2 ⭐) · ⭐ Five-Star Comment Card (+1 star)
   - Retired: The Open Door, Chief's Rolodex, Sticky Note (their effects live on in themed items).
   - **Fumbles all bite now:** Reply All ⭐ −1 · Muted on Teams 🎯 −1 · Coffee on the Keyboard 📦 −1 ·
     Wrong Name ❤️ −1 and a random member −1 loyalty · Forgot Your CAC = the roller is offline next
     stop · Saved by the Chief = free, and +1 ❤️ if the party has a Flight Chief.

**Content walkthrough complete.**


## Round 3: full-game playtest feedback (built)

| # | Feedback | What changed |
|---|---|---|
| 1 | "+2 +1" on the roller picker | Every roller list shows ONE number (stat + specialist), with ★ when it includes the +1 specialist. |
| 2 | Memo and Wargame feel the same | Wargame It replaced by **Branch Plan**: once, on the route map, move to ANY stop in the next column. |
| 3 | 20 character icons | 4 new icons (beard, mohawk, goggles, bandana). |
| 4 | Squadron vote too wordy on phones | Phones list only the full squadron name. Projector cards now carry the commander's likes/dislikes text and tendency. |
| 5 | Org chart cluttered | Phone ORG: commander one-liner + each member's trait and loyalty. Projector: commander panel with 4 labeled tiles (Intent, Rewards, Punishes, Tendency). |
| 6 | Perk popup | Every perk and ability shows a popup on the projector and phones explaining what it did, until the GM clicks ✅ Continue. |
| 7 | Route crossovers | Two lanes that cross at only 2 random junctions. One lane leans risky, one leans safe. |
| 8 | Command Token | Lock choices removed. The token only breaks ties ("Rock, Paper, Rank"). The GM can't pass it; the delegation penalty is gone. Roller defaults to the best bonus; anyone can tap 🙋 I'LL ROLL. |
| 9 | Rally / Enlisted Bond | No longer automatic: once per game, at the cadet's discretion. |
| 10 | Loot | d4 of 3 or 4 = loot. |
| 11 | Spotlight | The route shows only "SPOTLIGHT". On arrival a wheel picks a cadet who hasn't been spotlighted; they get their class's scenario. |
| 12 | Your Unit | Commander added at the top; members ordered by rank. |
| 13 | Meeting and voting | A cadet pulled into a meeting can't vote on the next route or anything during their offline stop. |
| 14 | Dice | The die spins instead of wobbling. |
| 15 | Golden Child | Now: all ⭐ losses reduced by 1 (min 1), mirroring Efficiency Expert. |
| 16 | Morale Engine | ❤️ never drops more than 1 in one hit. |
| 17 | Unknown stops | Rolled when the cadet presses the button, not at map generation. |
| 18 | Random-event hype | Dice with outcome tables (inject d6, Unknown d6, loot d4) show every outcome first, sweep a highlight across them, then roll and light the winner. The table also shows on the turn banner and the roller's phone before they press. |
| 19 | Too easy | dcPlus 3 (Normal 16, Hard 19), inject d6 1-3 Failure / 4-5 Meh / 6 Success, IG HP 26, IG attack 4, Press target 15. |
| 20 | Objectives | 7 consolidated to 5 (Authority & Responsibility, Motivation, Character, Creative Thinking, Expectations & Feedback). "Why are we doing this?" slide opens the briefing; the debrief opens on an Objectives view listing every event that tested each one. |
| 21 | Show Cadet | Each rubric row has 📱 Show cadet: sends that cadet's score and notes to their phone only (not the projector, for privacy). |

### Round 3 follow-ups
- Character icons come before class select; 10 male / 10 female icons, and the pick sets the cadet's gender.
- Class colours on every cadet icon; the Flight Commander's vote carries a 👑. The required FC card pulses on class select.
- Civilians show as Mr./Ms. (GENDER map in data.js covers all 45 roster names).
- Named outsiders (EXTRAS in data.js): Wing CC, a visiting two-star, a Chief, the popular MSgt, the lodging contractor, a peer flight commander, and three Airmen are drawn per run from unused roster names. People in serious trouble (arrests, weapons incidents, the DUI) stay unnamed, because roster names are real classmates.
- Route: each stop has 1-3 nodes, joined by random branching/merging paths that never cross.
- Tie votes: no banner on the projector; a small muted line on the GM console (phones keep their one-line note).
- Foresight no longer blocks or names an inject: the next inject skips the d6 and comes from the Wheel of Success.
- More checks and acting: 37 plain choices became stat checks or 🎤 act-it-outs (plus one Crisis Event choice). Every scenario now has at most ONE plain choice (integrity traps stay plain on purpose). Totals: 69 checks (CMD 20, INS 20, CHA 15, GRIT 10, 3 pure luck), 46 act-it-outs, 45 plain, 14 traps. Converted choices: pass = the old effect; fail = gains lost and the main meter −1; 3★ = the old effect +1. Achievements, flags and delayed fallout happen on choosing, pass or fail.
- Route length 6/5/4 (GM picks during setup; level-up after stop 3, or 2 on a 4-stop route) with a GM-only route preview and 🎲 Reroll until the map opens.
- Leaderboard saves every finished run automatically and lists the cadets; Update fixes the team name on the same entry.
- Cosmetic customization: uniform (OCPs / Blues / Flight suit / PTs) and hair color on the icon screen; a team patch from 4 squadron-themed options (e.g. ✈️ for 4th AMXS, 🍕 for 55th FSS) picked on the org chart, shown on the HUD, phones and leaderboard.

## Round 4: challenge review (simulated with sim.js, 400 runs per team type)
- Bug fixed: when a 4th item dropped into a full bag, the "drop the oldest" code could empty the whole bag.
- Score now rewards proactive play: no points for unused items/perks (was +5 each); Allies ×10 (was ×5);
  inspection +60 / +35 / +10 / −15 (was +50 / +30 / +10 / 0); achievements weighted by effort
  (Balanced and Flawless 25, Open Door and Servant 15, most others 10, Nobody Left Behind 5, Critical Hit and Murphy Survivor 0).
- Grade cutoffs S 310 / A 265 / B 200 / C 140 (were 260 / 220 / 170 / 120); rechecked over 750 runs per team type across 4, 5 and 6 stops (route length barely moves scores).
- Result: passive team (never uses tools) B+ 6% (was 33%), never A/S. Proactive bot B+ 46%, A+ 17%, S 4% (was 69% / 30% / 10%).
  The bot picks scenario choices at random, so teams that also decide well land above it.

## Round 5: phone review
- Bugs: boss Defend could spend a meter's last point (→ Adverse Finding), now needs 2+; 🗳️ looked like the 📦 Resources icon on phones, votes now use ✋.
- Phone = controller, projector = details: 2-line header (stats in KIT), class select is a short list where your pick expands,
  missions show title + options (situation is tap-to-read), map shows options with "then → next stops", rolls are one compact card,
  injects show name + options, boss fits one screen with % hit on each Press.
- Added: "✋ 3/4 voted" counter on every vote; phones buzz whenever it is your turn (any roll/spin, not only d20 checks);
  tackle-it options show who rolls and the odds.
- Danger warnings: any meter at 2 or less shows one red line (projector side panel / IG screen, and phones) naming the risk (Crisis Event, or Adverse Finding in the IG fight) and the tools that could help right now.
- Objective chips: every mission/spotlight shows the practicum objectives it tests (e.g. 🦅 CHARACTER) on its card and on the result card ("THIS TESTED").
- Route rhythm (Slay the Spire style): Crisis/Unknown are the bread and butter; stops 1-2 are Crisis/Unknown only; Elites (max 2 per map, never forced, never two in a row on a path) and early breaks (max 1 before the last stop) are rare; the last stop is always a Rest Stop / Supply Depot to prepare for the IG; every run has at least one Rest Stop AND one Supply Depot, never in the first two stops. Grade spread rechecked: unchanged.
- Node rename: the default stop is a ⚔️ SCENARIO (Elite = 💀 ELITE SCENARIO); "Crisis Event" now only means the event that fires when a meter hits 0.
- Scenarios can repeat at a stop; only 1-2 ❓ Unknowns per run. Route lengths are now 7 / 6 / 5 stops (level-up after stop 4 on a 7-stop run, otherwise after stop 3). Grade spread rechecked at all three lengths: on target.
- Honest arrows: choice arrows are now computed from the real effects (choiceShow in app.js), so every meter an outcome can change is listed: ▲/▼ when the change is fixed, ❔ when it depends on the roll / acting / class. 69 of 177 authored arrow lists had been missing a meter. Delayed fallout (next:) stays a surprise by design.
- Danger: only the projector's top HUD band pulses (softly); the extra "in DANGER" boxes on the projector and phones are gone, and phone bands no longer flash.
- Route waypoints: before an inject or the level-up, the projector zooms out to the route map ("🎡 INJECT AHEAD" / "⬆️ LEVEL UP") with that waypoint lit; buttons wait for it (HOP_MS).
- Clarity: Tackle-it shows as rows (who rolls + needs N+ (%), ✅ PASS, ❌ FAIL with meter chips) on the projector, phones and the tackle screen; meter tags never split from their numbers anywhere.
- Flight Commander perk: Trust Your People replaced by **Lead From the Front**: once, after a failed scenario check or Tackle it, the FC takes it on: it counts as a pass (same die), ⭐ −1.
- Phones: picking a character icon jumps the screen to the uniform / hair options.
- XO perk Commander's Confidant is now passive: when the org chart is first shown, the commander's negative perk is cancelled for the whole game, with a popup that names it (crossed out on the org chart).
- GM cards removed.
- "Usable now" is off the projector: phones keep "You can use now". The projector only shows moment-specific choices (cancel a Wheel of Failure result, reroll / take over a failed roll, skip the inject die, undo, Commander's Ear) as "⚡ DECIDE NOW: USE IT OR PASS", also inside the result card.
- Phone class select is a plain list (✅ on your pick, no expanding details). After the perk is picked: "🎒 SEE YOUR KIT" prompt + glowing KIT tab; the KIT tab shows "⬅ BACK TO THE GAME" on that first visit.
- Tie votes: no banner on phones either; the 👑 on the Flight Commander's vote is the cue (the GM console keeps its small tie line).
- Kit tutorial: the prompts no longer have their own buttons; they point (👇) at the real 🎒 KIT and 🎮 GAME tabs, which glow, so cadets learn the tab bar.
- Class select (projector): each perk in its own box (A / B, with once/passive tag); class stats moved to a small footnote row; stat legend removed; cards tightened to fit 720p.

## Round 6: projector layout review (size follows impact)
- Titles say the action; "vote on your phone" is a small subtitle (squadron vote, route map, inject response).
- Sidebar fits 720p: team items are one line each (details on phones); Unit members in a compact 2-column grid.
- Roll: one big line, "CAPT ABLE ROLLS CMD +4 · NEEDS 12+ (45%)"; boost tip small.
- Result card: SUCCESS / FAILED is the headline; "rolled · total vs target" is small.
- Inject response: compact header, options in one row (A · B · Tackle it).
- IG fight: battle log smaller, last 5 lines. Results: "Commander's Intent (⭐ 5)".
- Why slide: the objectives banner moved above the cards (the join QR covered it).
- Squadron vote: starting meters shown as bands (no numbers). All starts fall in STEADY, so each card reads 'STARTS STEADY: 🎯 ▲ ❤️ ▼ ⭐ ▲ 📦 ▼' (▲ = 5-6, – = 4, ▼ = 3); a meter outside STEADY would show its band word.
- Squadron starting meters rebalanced: each squadron has one STRONG (7), one DANGER (2) and two STEADY meters (4th AMXS 🎯 strong / 📦 danger; 56th SFS 🎯 / ❤️; 6th CS ❤️ / 🎯; 92nd LRS 📦 / ⭐; 7th IS 🎯 / ⭐; 55th FSS ❤️ / 🎯). The vote cards show the band words only. Grade spread rechecked: unchanged (passive B+ 6%, proactive S 4%).
- Class cards: specialty moved to the card footer as just the meter tag(s) (no explanation text); stats stay small in the bottom-right corner; rank shown in full under the name.
- Class card footer: 'FOCUS' label beside the meter tag (was SPECIALTY, stacked), stats strip enlarged.
- Class select: perks are no longer shown or mentioned (projector and phone); they appear only at perk selection. Class cards use larger type: rank, ability, FOCUS meter, stats.
- Rank insignia (inline SVG, rankSvg in app.js): officer bars / oak leaves / eagle / stars and enlisted chevrons, shown beside names on class select, the org chart (commander, flight, Unit), the projector sidebar and the phone header. Civilians get none.
- Briefing is 4 pages: Why · How to play · Job 1 (keep the meters high) · Job 2 (no integrity violations) on its own screen with an alarm sound: 💀, 'ONE VIOLATION = GAME OVER', lie / cover it up / fudge a record / skip the paperwork.
