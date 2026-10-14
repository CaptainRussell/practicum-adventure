/* =====================================================================
   PRACTICUM ADVENTURE - game content
   Everything a GM might want to tune lives in this file.
   Meter keys: mis (Mission) mor (Morale) tru (Trust) res (Resources)
   NPC slots:  A SSgt, B A1C, C TSgt, D Civilian
   Text placeholders: {A} {B} {C} {D} {CC} are swapped for drawn names.
   ===================================================================== */

const METERS = [
  { k: 'mis', name: 'MISSION',   label: 'Mission',   icon: '🎯', color: '#ff5d5d' },
  { k: 'mor', name: 'MORALE',    label: 'Morale',    icon: '❤️', color: '#ff7ae0' },
  { k: 'tru', name: 'TRUST',     label: 'Trust',     icon: '⭐', color: '#ffd23f' },
  { k: 'res', name: 'RESOURCES', label: 'Resources', icon: '📦', color: '#3fd8ff' },
];
const METER = Object.fromEntries(METERS.map(m => [m.k, m]));
const STATS = ['CMD', 'CHA', 'INS', 'GRIT'];

/* ---------------- classes ---------------- */
const CLASSES = [
  { id: 'fc', name: 'FLIGHT COMMANDER', icon: '👑', rank: 'Capt', rankLong: 'Captain', guards: '🎯 + the Command Token',
    stats: { CMD: 3, CHA: 1, INS: 1, GRIT: 2 },
    ability: null, abilityText: 'None. Holding the Command Token is your power.',
    perks: [ { id: 'lff', name: 'Lead From the Front', text: '+1 on all 🎯 checks (whole party)' },
             { id: 'typ', name: 'Trust Your People', text: 'Once, a teammate uses your CMD for a check' } ],
    ups:   [ { id: 'battle', name: 'Battle-Tested', text: '+1 CMD and +1 GRIT' },
             { id: 'delegator', name: 'Delegator', text: 'Delegating no longer costs ⭐ when it fails' } ] },
  { id: 'chief', name: 'FLIGHT CHIEF', icon: '🎖️', rank: 'SMSgt', rankLong: 'Senior Master Sergeant', guards: '🎯 standards + enlisted NPCs',
    stats: { CMD: 2, CHA: 2, INS: 2, GRIT: 2 },
    ability: { id: 'network', name: 'Enlisted Network', text: "Reveal one NPC's hidden trait" },
    perks: [ { id: 'beenthere', name: 'Been There', text: 'Ignore the first bad inject entirely' },
             { id: 'toughlove', name: 'Tough Love', text: '+1 star on any 🎤 encounter you lead' } ],
    ups:   [ { id: 'standards', name: 'Standards Bearer', text: '+1 🎯 after every check you roll' },
             { id: 'wind', name: 'Second Wind', text: 'Signature ability recharges' } ] },
  { id: 'shirt', name: 'FIRST SERGEANT', icon: '💚', rank: 'MSgt', rankLong: 'Master Sergeant', guards: '❤️ + NPC loyalty',
    stats: { CMD: 1, CHA: 3, INS: 2, GRIT: 1 },
    ability: { id: 'rally', name: 'Rally', text: '+2 ❤️ and +1 loyalty to every NPC' },
    perks: [ { id: 'opendoor', name: 'Open Door', text: 'All NPCs start at +1 loyalty' },
             { id: 'compass', name: 'Moral Compass', text: 'Once, ask the GM "Is this an integrity trap?"' } ],
    ups:   [ { id: 'engine', name: 'Morale Engine', text: "❤️ can't drop more than 2 in one hit" },
             { id: 'wind', name: 'Second Wind', text: 'Signature ability recharges' } ] },
  { id: 'xo', name: 'EXECUTIVE OFFICER', icon: '🗣️', rank: '1st Lt', rankLong: 'First Lieutenant', guards: '⭐',
    stats: { CMD: 1, CHA: 3, INS: 1, GRIT: 1 },
    ability: { id: 'ear', name: "Commander's Ear", text: 'Cancel the most recent ⭐ loss' },
    perks: [ { id: 'silver', name: 'Silver Tongue', text: '+2 on CHA checks you roll' },
             { id: 'inside', name: 'Inside Info', text: 'Once, ask the GM any yes/no question' } ],
    ups:   [ { id: 'golden', name: 'Golden Child', text: '+1 ⭐ at the start of the boss' },
             { id: 'wind', name: 'Second Wind', text: 'Signature ability recharges' } ] },
  { id: 'ra', name: 'RESOURCE ADVISOR', icon: '📦', rank: 'TSgt', rankLong: 'Technical Sergeant', guards: '📦',
    stats: { CMD: 1, CHA: 1, INS: 2, GRIT: 3 },
    ability: { id: 'requisition', name: 'Requisition', text: 'Convert 📦 into any other meter at 2:1' },
    perks: [ { id: 'hoarder', name: 'Hoarder', text: '📦 can never drop below 2' },
             { id: 'yearend', name: 'Year-End Money', text: '+2 📦 at every Rest Stop or Supply Depot' } ],
    ups:   [ { id: 'efficiency', name: 'Efficiency Expert', text: 'All 📦 losses reduced by 1 (min 1)' },
             { id: 'wind', name: 'Second Wind', text: 'Signature ability recharges' } ] },
  { id: 'plans', name: 'PLANS OFFICER', icon: '🧠', rank: '2d Lt', rankLong: 'Second Lieutenant', guards: '🎯 + foresight',
    stats: { CMD: 1, CHA: 1, INS: 3, GRIT: 1 },
    ability: { id: 'foresight', name: 'Foresight', text: 'See the next inject before it fires; bank or block it' },
    perks: [ { id: 'recon', name: 'Recon', text: 'All ❓ nodes on the map are revealed' },
             { id: 'eureka', name: 'Eureka', text: 'Once, invent a 5th choice (GM sets effects)' } ],
    ups:   [ { id: 'contingency', name: 'Contingency Plan', text: 'Halve the next bad inject' },
             { id: 'wind', name: 'Second Wind', text: 'Signature ability recharges' } ] },
];
const CLASS = Object.fromEntries(CLASSES.map(c => [c.id, c]));

/* ---------------- units ---------------- */
const UNITS = [
  { id: 'wk', name: 'WRENCH KINGS', sq: 'Aircraft Maintenance Squadron', icon: '🔧', color: '#ff9f43',
    start: { mis: 6, mor: 4, tru: 5, res: 5 }, ccRank: 'Lt Col', q: 'late',
    quirk: 'Hates surprises: any ⭐ loss from bad news delivered late is doubled.' },
  { id: 'gg', name: 'GATE GUARDIANS', sq: 'Security Forces Squadron', icon: '🛡️', color: '#3fd8ff',
    start: { mis: 5, mor: 4, tru: 6, res: 5 }, ccRank: 'Lt Col', q: 'hardmis',
    quirk: 'Standards first: every 🎯 check is Hard (16).' },
  { id: 'pp', name: 'PACKET PUSHERS', sq: 'Communications Squadron', icon: '📡', color: '#7dff6b',
    start: { mis: 5, mor: 5, tru: 5, res: 5 }, ccRank: 'Maj', q: 'idea',
    quirk: "Innovation fan: adopting a subordinate's idea gives +1 ⭐." },
  { id: 'sr', name: 'SUPPLY RAIDERS', sq: 'Logistics Readiness Squadron', icon: '🚚', color: '#ffd23f',
    start: { mis: 5, mor: 5, tru: 5, res: 3 }, ccRank: 'Lt Col', q: 'wallet',
    quirk: 'Tight wallet: every 📦 gain is reduced by 1.' },
  { id: 'sa', name: 'SHADOW ANALYSTS', sq: 'Intelligence Squadron', icon: '🔍', color: '#b18cff',
    start: { mis: 5, mor: 5, tru: 4, res: 6 }, ccRank: 'Lt Col', q: 'xo2',
    quirk: "Quiet professional: ⭐ starts low, but the Executive Officer's ability can be used twice." },
  { id: 'ch', name: 'CHOW HALL HEROES', sq: 'Force Support Squadron', icon: '🍔', color: '#ff7ae0',
    start: { mis: 4, mor: 6, tru: 5, res: 5 }, ccRank: 'Maj', q: 'people',
    quirk: 'People person: every ❤️ gain is +1, but every 🎯 check is Hard (16).' },
];

/* ---------------- NPCs ---------------- */
const SLOTS = [
  { s: 'A', rank: 'SSgt', pub: 'Your best technician', pool: 'lower' },
  { s: 'B', rank: 'A1C',  pub: "Three months on station, doesn't know much", pool: 'lower' },
  { s: 'C', rank: 'TSgt', pub: '16 years in, seen it all, a bit salty', pool: 'upper' },
  { s: 'D', rank: 'Civ.', pub: 'Runs the budget / admin', pool: 'upper' },
];
// Fictional fallback names. The real cadet roster is NOT stored in this public
// file: the GM pastes it into the console once (saved in that browser only).
const POOL_UPPER = ['Archer', 'Baxter', 'Caldwell', 'Dawson', 'Ellis', 'Fowler', 'Garrison', 'Hayes',
  'Irving', 'Jensen', 'Keller', 'Lawson', 'Maddox', 'Norris', 'Ortega', 'Pierce'];
const POOL_LOWER = ['Quinn', 'Reyes', 'Sawyer', 'Tate', 'Underwood', 'Vance', 'Walsh', 'Young',
  'Zimmer', 'Brooks', 'Carver', 'Dalton', 'Easton', 'Finch', 'Graves', 'Holt'];

// bp = Breaking Point effect, applied automatically when loyalty hits 0
const TRAITS = [
  { id: 'burnout',  icon: '🔥', name: 'Burning Out',        what: 'Quietly overloaded',                      reward: '+2 ❤️ when their workload is fixed',     bpText: 'Requests separation',                    bp: { mis: -2 } },
  { id: 'genius',   icon: '💡', name: 'Secret Genius',      what: 'Has a process fix nobody asked about',     reward: '+3 🎯 if the idea is adopted',           bpText: 'Takes the idea to a rival unit',         bp: { tru: -1 } },
  { id: 'family',   icon: '🏠', name: 'Family Crisis',      what: 'Performance dip from a home issue',        reward: '+2 loyalty, +1 ❤️',                      bpText: 'Emergency leave: out for 2 nodes',       bp: { out: 2 } },
  { id: 'bender',   icon: '⚠️', name: 'Rule Bender',        what: 'Cuts corners to look good',                reward: 'Prevents a later integrity trap',        bpText: 'Their shortcut becomes YOUR problem',    bp: { tru: -2 } },
  { id: 'climber',  icon: '🏆', name: 'Climber',            what: 'Wants recognition',                        reward: 'Public praise = +2 loyalty',             bpText: 'Goes over your head to the Sq CC',       bp: { tru: -2 } },
  { id: 'silent',   icon: '🤐', name: 'Silent Struggler',   what: "Won't ask for help",                       reward: '+2 🎯 once supported',                   bpText: 'Misses a critical task',                 bp: { mis: -2 } },
  { id: 'cynic',    icon: '🤨', name: 'Cynic with a Heart', what: 'Resists change, loyal if heard',           reward: 'Becomes an Ally at loyalty 4',           bpText: 'Spreads negativity',                     bp: { mor: -2 } },
  { id: 'gossip',   icon: '📢', name: 'The Gossip',         what: 'Everything said spreads',                  reward: '+1 ❤️ from good news spread',            bpText: 'Rumor mill',                             bp: { mor: -1, tru: -1 } },
  { id: 'overach',  icon: '🏃', name: 'Over-Achiever',      what: 'Volunteers for everything',                reward: '+2 🎯 when workload is shared',          bpText: 'Collapses: out for 1 node',              bp: { mor: -2, out: 1 } },
  { id: 'mentor',   icon: '🎓', name: 'Mentor-in-Waiting',  what: 'Wants to train others',                    reward: '+1 🎯 and +1 ❤️ once empowered',         bpText: 'Disengages',                             bp: { mor: -1 } },
  { id: 'coaster',  icon: '😴', name: 'The Coaster',        what: 'Bored, doing the minimum',                 reward: '+2 🎯 if given a challenge',             bpText: 'Drags others down',                      bp: { mis: -1 } },
  { id: 'witness',  icon: '🕵️', name: 'The Witness',        what: 'Knows about a problem in the unit',        reward: "Reveals the IG's weakness (Phase 3 target 10)", bpText: 'Reports it to the IG: boss HP 23', bp: { flag: 'WITNESS_IG' } },
];
const TRAIT = Object.fromEntries(TRAITS.map(t => [t.id, t]));

/* ---------------- missions ----------------
   choice fields:
     t     button text          show  arrows [[meter, n]] n = 1,2,-1,-2 or '?'
     lock  needs Command Token   mic   dialogue encounter   trap  integrity trap
     tags  'idea' (adopts a subordinate idea), 'late' (late bad news)
     kind  'fx' | 'check' | 'stars'
     eff   immediate effect (fx)         pre  effect applied on choosing
     check {stat, dc, m (meter tie), pass, fail}   stat 'LOYB' = d20 + A1C loyalty, null = plain d20
     stars [one, two, three]
     ifClass {cls:[...], then:{...choice}, else:{...choice}}
   effect fields: meters, loy:{A:-1}, flag, ach, reveal:'A', next:{...} (applied at the
     start of the next node), set:{mis:3}, traitLoy:{trait,d}, traitAny:{trait, eff}, loot:true
*/
const MISSIONS = [
  { id: 'M1', title: 'THE 0900 DEADLINE', sob: 'Expectations · Feedback', icon: '⏰',
    text: "The Sq CC's slides were due at 0900. It's 0930. {B} was tasked and has delivered nothing. The CC wants them by 1300.",
    choices: [
      { t: 'Do it yourselves', show: [['mis', 1], ['res', -1]], kind: 'fx',
        eff: { mis: 2, res: -2, loy: { B: -1 }, flag: 'A1C_CONFUSED' } },
      { t: 'Pull {B} aside first', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        note: 'Twist: {B} says "Nobody told me it was due at 0900."',
        stars: [ { mis: 1, mor: -1 }, { mis: 1, mor: 1 }, { mis: 2, mor: 2, loy: { B: 2 }, reveal: 'B' } ] },
      { t: 'Hand it to {A}', show: [['mis', 2], ['mor', -1]], kind: 'fx',
        eff: { mis: 3, mor: -2, loy: { A: -1 }, traitAny: { slot: 'A', traits: ['burnout', 'overach'], eff: { loy: { A: -1 } } } } },
      { t: 'Ask the CC to move the deadline', lock: true, show: [['tru', '?']], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'tru', pass: { tru: 1, res: 1, mis: -1 }, fail: { tru: -2 } } },
    ] },
  { id: 'M2', title: 'THE SHORTCUT', sob: 'Character · Integrity', icon: '📋',
    text: 'Inspection is tomorrow. The flight\'s training records are 80% done. {C}: "Just mark them complete. They\'ll finish this week. Everybody does it."',
    choices: [
      { t: 'Mark them complete', trap: true, show: [['mis', 2], ['tru', 1]], kind: 'fx',
        eff: { mis: 3, tru: 2, flag: 'FALSIFIED_RECORDS' } },
      { t: 'Report the real number to the CC', show: [['tru', -1], ['mor', 1]], kind: 'fx',
        eff: { tru: -1, mis: -1, mor: 1, flag: 'HONEST_BROKER', ach: 'hardright' } },
      { t: 'All-hands push tonight to finish', show: [['mis', 1], ['mor', -2]], kind: 'check',
        check: { stat: 'GRIT', dc: 16, m: 'mis', pass: { mis: 2, mor: -2, res: -1, ach: 'hardright' }, fail: { mis: 1, mor: -3, res: -2, ach: 'hardright' } } },
      { t: 'Confront {C} about the suggestion', mic: true, show: [['mor', '?'], ['mis', 1]], kind: 'stars', pre: { mis: 1, ach: 'hardright' },
        stars: [ { loy: { C: -2 } }, {}, { loy: { C: 1 }, reveal: 'C', mor: 1 } ] },
    ] },
  { id: 'M3', title: '"WE TRIED THAT IN 2019"', sob: 'Barriers to Creative Thinking', icon: '💡',
    text: 'In the morning meeting, {A} pitches a fix for the flight\'s slowest process. {C} cuts them off in front of everyone: "We tried that in 2019. Didn\'t work." The room goes quiet.',
    choices: [
      { t: 'Back {C}: stick with what works', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 1, mor: -2, loy: { A: -2 } } },
      { t: 'Facilitate: both make their case', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2 }, { mor: 3, loy: { A: 1, C: 1 } } ] },
      { t: 'Pilot it small and measure it', tags: ['idea'], show: [['mis', 2], ['res', -1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 3, res: -2, ach: 'ideas' }, fail: { mis: -1, res: -2, mor: 1, ach: 'ideas' } } },
      { t: 'Adopt it now, overrule {C}', lock: true, tags: ['idea'], show: [['mis', 1], ['mor', '?']], kind: 'check',
        check: { stat: null, dc: 11, m: 'mis', pass: { mis: 2, mor: 1, loy: { C: -2 }, ach: 'ideas' }, fail: { mis: -2, loy: { C: -2 }, ach: 'ideas' } } },
    ] },
  { id: 'M4', title: 'THE COASTER', sob: 'Motivation', icon: '😴',
    text: '{A}, your best performer last quarter, is now doing exactly the minimum. Never late, never wrong, never extra.',
    choices: [
      { t: 'Formal counseling on standards', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 2, mor: -2, loy: { A: -2 } } },
      { t: 'Ask what changed', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2, reveal: 'A' }, { mor: 3, reveal: 'A', loy: { A: 2 } } ] },
      { t: 'Hand them a stretch project', show: [['mis', 1], ['res', -1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, mor: 1, res: -2 }, fail: { mis: -1, res: -2 } } },
      { t: 'Leave it alone, they meet standards', show: [['res', 1], ['mis', -1]], kind: 'fx',
        eff: { res: 1, mis: -1, next: { mor: -1, why: 'Others noticed the coasting' } } },
    ] },
  { id: 'M5', title: 'NOT MY JOB', sob: 'Authority vs. Responsibility', icon: '📦',
    text: 'A critical parts order fell through the cracks between your flight and the flight next door. The Sq CC walks in: "Whose is this?"',
    choices: [
      { t: '"It was the other flight\'s tasking."', show: [['tru', -1], ['res', 1]], kind: 'fx',
        eff: { tru: -2, res: 1, flag: 'DODGED' } },
      { t: '"It\'s ours. We\'ll fix it."', show: [['tru', 2], ['res', -1]], kind: 'fx',
        eff: { tru: 2, res: -2, mis: -1, ach: 'buck' } },
      { t: 'Delegate the fix to {B}', show: [['mis', 1], ['res', -1]], kind: 'check', pre: { res: -1 },
        check: { stat: 'LOYB', dc: 12, m: 'mis', pass: { mis: 2 }, fail: { mis: -1, tru: -2, why: 'Responsibility stays with the leader' } } },
      { t: '60-second brief to the CC with a fix plan', mic: true, show: [['tru', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { tru: 1 }, { tru: 2 }, { tru: 3 } ] },
    ] },
  { id: 'M6', title: 'THE POST', sob: 'Character · OPSEC', icon: '📱',
    text: '{B} posted a photo from work. In the background: a whiteboard with the flight\'s schedule and tail numbers. It already has 200 likes.',
    choices: [
      { t: 'Quietly have them delete it, no report', trap: true, show: [['mor', 1], ['tru', 1]], kind: 'fx',
        eff: { mor: 1, tru: 1, flag: 'COVERED_UP' } },
      { t: 'Report it, then counsel {B}', mic: true, show: [['tru', 1], ['mis', -1]], kind: 'stars', pre: { tru: 1, mis: -1, ach: 'hardright' },
        stars: [ { mor: -1 }, { mor: 1 }, { mor: 2 } ] },
      { t: 'Report it + flight-wide OPSEC training using it as the example', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 2, tru: 1, mor: -2, loy: { B: -3 }, ach: 'hardright' } },
      { t: 'Report it + recommend formal paperwork', lock: true, show: [['tru', 1], ['mor', -1]], kind: 'fx',
        eff: { tru: 1, mis: 1, mor: -2, loy: { B: -2 }, ach: 'hardright' } },
    ] },
  { id: 'M7', title: 'BRIEF THE BOSS', sob: 'Articulating Ideas Clearly', icon: '🎙️',
    text: 'The Sq CC stops you in the hallway: "Why is your flight two days behind on the readiness report? You\'ve got 60 seconds."',
    choices: [
      { t: 'Brief it right now, cold', mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 3 } ] },
      { t: '"Give me 10 minutes," then brief', mic: true, show: [['tru', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ {}, { tru: 2 }, { tru: 3 } ] },
      { t: 'Send a written summary through the XO', show: [['tru', 1], ['mis', -1]], kind: 'fx',
        ifClass: { cls: ['xo'], then: { eff: { tru: 2, mis: -1 } }, else: { eff: { tru: 1, mis: -1 } } } },
      { t: '"We\'re on it, sir/ma\'am."', tags: ['late'], show: [['res', 1], ['tru', -1]], kind: 'fx',
        eff: { res: 1, tru: -1, flag: 'VAGUE_ANSWER' } },
    ] },
  { id: 'M8', title: 'THE FAVOR', sob: 'Character', icon: '🤝',
    text: 'Your old ROTC buddy runs supply in another squadron. They need you to sign for equipment you haven\'t received so they can close out the fiscal year. "I\'ll get you priority on parts all next year. Promise."',
    choices: [
      { t: "Sign it, it's just paperwork", trap: true, show: [['res', 2], ['mis', 1]], kind: 'fx',
        eff: { res: 3, mis: 1, flag: 'FALSE_RECEIPT' } },
      { t: 'Politely refuse', show: [['res', -1], ['tru', 1]], kind: 'fx',
        eff: { res: -2, tru: 1, ach: 'hardright' } },
      { t: 'Refuse and report it', show: [['tru', 2], ['mor', -1]], kind: 'fx',
        eff: { tru: 2, res: -2, mor: -1, ach: 'hardright' } },
      { t: 'Help them find a legit fix', mic: true, show: [['res', 1], ['mis', -1]], kind: 'stars', pre: { mis: -1, ach: 'hardright' },
        stars: [ { res: -1 }, { res: 1 }, { res: 2, tru: 1 } ] },
    ] },
  { id: 'M9', title: 'THE OVERPROMISE', sob: 'Authority · Trust', icon: '📅',
    text: 'Last week a member of the leadership team promised the flight a Friday family day. Today the Sq CC cancels all family days for a short-notice exercise. The flight doesn\'t know yet.',
    choices: [
      { t: 'Fight the CC to keep the day', lock: true, show: [['mor', 1], ['tru', -1]], kind: 'check',
        check: { stat: 'CHA', dc: 16, m: 'tru', pass: { mor: 3, tru: -1 }, fail: { tru: -3, mor: -1 } } },
      { t: 'Tell the flight the truth and own the promise', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, mis: 1, ach: 'buck' },
        stars: [ { mor: -2 }, { mor: -1 }, { mor: 1 } ] },
      { t: 'Give them a reward you DO control', show: [['mor', 1], ['res', -1]], kind: 'fx',
        eff: { mor: 2, res: -2 } },
      { t: 'Say nothing, hope it blows over', tags: ['late'], show: [['res', 1], ['mor', -2]], kind: 'fx',
        eff: { res: 1, mor: -3, traitAny: { trait: 'gossip', eff: { tru: -1 } } } },
    ] },
  { id: 'M10', title: 'NEW KID', sob: 'Establishing Expectations', icon: '🆕',
    text: 'A brand-new Airman reports in today. Their sponsor forgot. No desk, no computer account, no idea where to go. They\'re standing in your doorway.',
    choices: [
      { t: 'Hand them to {A} to sort out', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 1, mor: -1, loy: { A: -1 } } },
      { t: 'Welcome them + set initial expectations', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2 }, { mor: 3, flag: 'NEWKID_ALLY' } ] },
      { t: 'Chew out the sponsor in front of everyone', show: [['mis', 1], ['mor', -2]], kind: 'fx',
        eff: { mis: 1, mor: -3 } },
      { t: 'Spend money to fast-track gear and access', show: [['mis', 1], ['res', -2]], kind: 'fx',
        ifClass: { cls: ['ra'], then: { eff: { mis: 2, mor: 1, res: -2 } }, else: { eff: { mis: 2, mor: 1, res: -3 } } } },
    ] },
  { id: 'M11', title: 'FLIGHTLINE FEUD', sob: 'Feedback · Counseling', icon: '💢',
    text: '{A} and {C} get into a shouting match in front of the Airmen. Everyone is watching to see what leadership does.',
    choices: [
      { t: 'Separate them and move on', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 1, mor: -1, next: { mor: -1, why: 'The feud is still unresolved' } } },
      { t: 'Mediate with both of them', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2 }, { mor: 3, loy: { A: 1, C: 1 } } ] },
      { t: 'Formal paperwork for both', lock: true, show: [['tru', 1], ['mor', -2]], kind: 'fx',
        eff: { tru: 1, mis: 1, mor: -3, loy: { A: -1, C: -1 } } },
      { t: 'Hand it to the Shirt / Chief', show: [['mor', 1], ['tru', '?']], kind: 'fx',
        ifClass: { cls: ['shirt', 'chief'],
          then: { kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 2, res: -1 }, fail: { res: -1 } } },
          else: { eff: { tru: -1, why: '"Why didn\'t an officer handle it?"' } } } },
    ] },
  { id: 'M12', title: 'THE SURGE', sob: 'Motivation vs. Mission', icon: '🚨',
    text: 'Short-notice tasking: the wing needs your flight to surge all weekend. It\'s the third surge this quarter.',
    choices: [
      { t: 'Everyone works all weekend', show: [['mis', 2], ['mor', -2]], kind: 'fx',
        eff: { mis: 3, mor: -3, traitLoy: { trait: 'burnout', d: -2 } } },
      { t: 'Volunteers + rotating shifts', show: [['mis', 1], ['res', -1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, mor: -1, res: -1 }, fail: { mis: 1, mor: -1, res: -2 } } },
      { t: 'Push back: "We can deliver 70%"', lock: true, show: [['mor', 1], ['tru', '?']], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'tru', pass: { tru: 1, mis: -1, mor: 2 }, fail: { tru: -2, mor: 1 } } },
      { t: 'Borrow people from another flight', show: [['mis', 1], ['tru', -1]], kind: 'fx',
        eff: { mis: 2, mor: 1, res: -2, tru: -1 } },
    ] },
];

/* ---------------- crisis events (a meter hit 0) ---------------- */
const CRISES = {
  mis: { title: 'MISSION FAILURE', icon: '💥', text: 'The wing noticed your flight missed a major deliverable.',
    choices: [
      { t: '"All hands, fix it now"', kind: 'fx', eff: { set: { mis: 3 }, mor: -2 } },
      { t: 'Brief the CC on the recovery plan', mic: true, kind: 'stars', pre: { set: { mis: 2 } }, stars: [ { tru: -2 }, { tru: -1 }, {} ] } ] },
  mor: { title: 'MUTINY.EXE', icon: '😡', text: 'An anonymous climate survey is brutal, and one Airman requests a transfer.',
    choices: [
      { t: 'Town hall: listen, no excuses', mic: true, kind: 'stars', pre: { set: { mor: 2 }, res: -1 }, stars: [ { mor: 1 }, { mor: 2 }, { mor: 3 } ] },
      { t: 'Pizza and a down day', kind: 'fx', eff: { set: { mor: 3 }, mis: -2, res: -1 } } ] },
  tru: { title: "YOU'RE ON NOTICE", icon: '😠', text: 'The CC calls you in: "I\'m not confident in this flight."',
    choices: [
      { t: 'Own it and present a plan', mic: true, kind: 'stars', pre: { set: { tru: 2 }, ach: 'buck' }, stars: [ { tru: 1 }, { tru: 2 }, { tru: 3 } ] },
      { t: 'Accept a CC babysitter', kind: 'fx', eff: { set: { tru: 3 }, flag: 'BABYSITTER' } } ] },
  res: { title: 'OUT OF GAS', icon: '⛽', text: "The budget is gone, your people are maxed out, and there's no time left.",
    choices: [
      { t: 'Beg the group for help', kind: 'fx', eff: { set: { res: 3 }, tru: -2 } },
      { t: 'Cut a program', kind: 'fx', eff: { set: { res: 3 }, mis: -1, mor: -1 } } ] },
};

/* ---------------- Murphy wheel ---------------- */
const MURPHY = [
  { type: 'bad',   name: 'NETWORK DOWN',            eff: { res: -2 } },
  { type: 'bad',   name: 'EMERGENCY LEAVE',          eff: { mis: -1 }, special: 'leave', text: 'A random NPC is out for 2 nodes.' },
  { type: 'bad',   name: 'EXERCISE RECALL AT 0400',  eff: { mor: -2 } },
  { type: 'bad',   name: 'BUDGET CUT',               eff: { res: -3 } },
  { type: 'bad',   name: 'PRIORITIES CHANGED',       eff: { mis: -2 }, text: 'The CC wants something else now.' },
  { type: 'bad',   name: 'RUMOR MILL',               eff: { mor: -1, tru: -1 } },
  { type: 'bad',   name: 'WEATHER GROUNDS EVERYTHING', eff: { mis: -1, res: -1 } },
  { type: 'bad',   name: 'IG COMPLAINT FILED',       eff: { tru: -2 }, text: 'Unfounded. Still a headache.' },
  { type: 'mixed', name: 'PULLED INTO A MEETING',    eff: {}, special: 'meeting', text: "One random cadet is offline next node: they can't speak or roll." },
  { type: 'mixed', name: "THE CC'S PET PROJECT",     eff: { tru: 2, res: -2 } },
  { type: 'mixed', name: 'QUICK FAVOR',              eff: {}, special: 'favor', text: 'Another unit wants to borrow your best person. Party decides.',
    options: [ { t: 'Accept', eff: { tru: 1, mis: -1 } }, { t: 'Decline', eff: { mis: 1, tru: -1 } } ] },
  { type: 'mixed', name: 'SURPRISE TASKER',          eff: { mis: 2, mor: -2 }, text: 'Due tomorrow.' },
  { type: 'good',  name: 'YEAR-END MONEY',           eff: { res: 3 } },
  { type: 'good',  name: 'WING CC SHOUT-OUT',        eff: { tru: 2 } },
  { type: 'good',  name: 'THE IDEA WORKED',          eff: { mis: 2 } },
  { type: 'good',  name: 'GREAT FAMILY DAY',         eff: { mor: 2 } },
];
const INJECT_CHANCE = 0.6;

/* ---------------- GM cards ---------------- */
const GM_CARDS = [
  { id: 'curveball', name: 'THE CURVEBALL',     text: 'Force a Murphy Wheel spin right now' },
  { id: 'loaded',    name: 'LOADED DICE',       text: 'Raise or lower the next check target by 3' },
  { id: 'clock',     name: "CLOCK'S TICKING",   text: 'Next decision gets a 15-second shot clock' },
  { id: 'witness',   name: 'THE WITNESS SPEAKS', text: "Publicly reveal one NPC's hidden trait" },
  { id: 'gift',      name: 'GIFT FROM ABOVE',   text: 'Grant a free loot spin' },
  { id: 'silent',    name: 'SILENT RUNNING',    text: "Token holder can't speak for the next choice" },
  { id: 'twist',     name: 'PLOT TWIST',        text: 'Secretly swap the effects of two choices on this mission' },
  { id: 'second',    name: 'SECOND CHANCE',     text: 'Undo the last action' },
];

/* ---------------- loot ---------------- */
const LOOT = [
  { id: 'coffee', rar: 'common',    icon: '☕', name: 'Bottomless Coffee',      text: '+2 on one check' },
  { id: 'sticky', rar: 'common',    icon: '📝', name: 'Sticky Note of Clarity', text: 'Turn one 🎤 1⭐ into 2⭐ (+1 star)' },
  { id: 'pizza',  rar: 'common',    icon: '🍕', name: 'Pizza Fund',             text: '+2 ❤️' },
  { id: 'rhythm', rar: 'common',    icon: '📋', name: 'Battle Rhythm',          text: 'Next inject trigger is auto ALL CLEAR' },
  { id: 'rolodex', rar: 'rare',     icon: '📇', name: "Chief's Rolodex",        text: 'Cancel one bad inject after it is spun' },
  { id: 'deck',   rar: 'rare',      icon: '📊', name: 'Perfect Slide Deck',     text: '+2 ⭐' },
  { id: 'recharge', rar: 'rare',    icon: '🔋', name: 'Ability Recharge',       text: 'Recharge any used signature ability' },
  { id: 'token',  rar: 'rare',      icon: '🎫', name: 'Extra Leadership Token', text: 'Restore one used Leadership Token' },
  { id: 'coin',   rar: 'epic',      icon: '🪙', name: "Commander's Coin",       text: '+3 to any one meter' },
  { id: 'doover', rar: 'epic',      icon: '🔄', name: 'Do-Over',                text: 'Undo the decision you just made' },
  { id: 'door',   rar: 'legendary', icon: '🚪', name: 'The Open Door',          text: 'Every NPC goes to loyalty 5' },
];
const RARITY = { common: { w: 50, color: '#cfd8e3' }, rare: { w: 35, color: '#3fa9ff' }, epic: { w: 13, color: '#c36bff' }, legendary: { w: 2, color: '#ffd23f' } };

/* ---------------- fumble wheel (natural 1) ---------------- */
const FUMBLES = [
  { name: 'REPLY ALL',            text: 'You emailed the whole wing by accident.', eff: { tru: -1 } },
  { name: 'MUTED ON TEAMS',       text: 'The entire meeting. Nobody heard a word.', eff: { mis: -1 } },
  { name: 'COFFEE ON THE KEYBOARD', text: 'RIP keyboard.', eff: { res: -1 } },
  { name: 'WRONG NAME',           text: 'You called the Airman by the wrong name.', eff: { mor: -1 } },
  { name: 'FORGOT YOUR CAC',      text: 'Left it in the computer. Again.', eff: {} },
  { name: 'SAVED BY THE CHIEF',   text: 'No penalty. The Chief will never let you forget it.', eff: {} },
];

/* ---------------- unknown node ---------------- */
const MYSTERY = [
  { id: 'crisis', name: 'CRISIS' },
  { id: 'elite',  name: 'ELITE CRISIS' },
  { id: 'loot',   name: 'FREE LOOT' },
  { id: 'bad',    name: 'BAD INJECT' },
  { id: 'good',   name: 'GOOD INJECT' },
  { id: 'wing',   name: 'WING CC VISIT' },
];
const WING_VISIT = { title: 'WING CC VISIT', icon: '🦅', sob: 'Articulating Ideas Clearly',
  text: 'The Wing Commander drops in unannounced: "Tell me about your flight. What are you proud of, and what keeps you up at night?"',
  choices: [ { t: 'Give the Wing CC the 60-second tour', mic: true, kind: 'stars', stars: [ { tru: -1 }, { tru: 1, mor: 1 }, { tru: 3, mor: 1 } ] } ] };

/* ---------------- node types ---------------- */
const NODE_TYPES = {
  crisis:  { icon: '⚔️', name: 'CRISIS',       color: '#ff5d5d' },
  elite:   { icon: '💀', name: 'ELITE CRISIS', color: '#c36bff' },
  rest:    { icon: '🏕️', name: 'REST STOP',    color: '#7dff6b' },
  depot:   { icon: '🛒', name: 'SUPPLY DEPOT', color: '#3fd8ff' },
  unknown: { icon: '❓', name: 'UNKNOWN',      color: '#ffd23f' },
  boss:    { icon: '👹', name: 'INSPECTOR GENERAL', color: '#ff2e63' },
};

/* ---------------- boss ---------------- */
const BOSS = { name: 'LT COL CACIC', title: 'THE INSPECTOR GENERAL', hp: 20 };
const BOSS_QUESTIONS = [
  'Walk me through how your Airmen know what is expected of them.',
  'Tell me about the last time you gave someone hard feedback.',
  "Who's responsible when a task you delegated fails?",
  'How do you know your people are motivated, and not just compliant?',
  "What's an idea from a junior Airman you actually implemented?",
  'Tell me about a time you had to choose between the mission and doing the right thing.',
];
const TRAP_FLAGS = ['FALSIFIED_RECORDS', 'COVERED_UP', 'FALSE_RECEIPT'];
const FLAG_TEXT = {
  FALSIFIED_RECORDS: 'Falsified training records (M2)',
  COVERED_UP: 'Covered up an OPSEC incident (M6)',
  FALSE_RECEIPT: 'Signed a false receipt (M8)',
};

/* ---------------- achievements ---------------- */
const ACHIEVEMENTS = [
  { id: 'buck',      icon: '🫡', name: 'Buck Stops Here',            text: 'Took ownership instead of passing blame' },
  { id: 'hardright', icon: '⚖️', name: 'Hard Right Over Easy Wrong', text: 'Refused an integrity trap' },
  { id: 'clearcomms', icon: '📣', name: 'Clear Comms',               text: 'Earned 3⭐ on a 🎤 encounter' },
  { id: 'opendoor',  icon: '🚪', name: 'Open Door',                  text: 'Revealed 2+ NPC hidden traits' },
  { id: 'ideas',     icon: '💡', name: 'Ideas Welcome',              text: "Adopted or piloted a subordinate's idea" },
  { id: 'murphy',    icon: '🌪️', name: 'Murphy Survivor',            text: 'Survived 2+ Crisis Events' },
  { id: 'balanced',  icon: '⚖️', name: 'Balanced Leader',            text: 'Finished with every meter at 5+' },
  { id: 'crit',      icon: '🎲', name: 'Critical Hit',               text: 'Rolled a natural 20' },
  { id: 'nobody',    icon: '🤝', name: 'Nobody Left Behind',         text: 'No NPC ever dropped to loyalty 0', hidden: true },
  { id: 'flawless',  icon: '💎', name: 'Flawless Inspection',        text: 'Beat the IG without a boss attack dropping a meter below 3', hidden: true },
  { id: 'servant',   icon: '🙌', name: 'Servant Leader',             text: 'Every 🎤 encounter earned 2⭐+', hidden: true },
  { id: 'delegated', icon: '👑', name: 'Delegated & Owned It',       text: 'Delegated, it failed, and the delegator owned it (GM awards)', hidden: true },
];
const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/* ---------------- grades ---------------- */
const GRADES = [
  { g: 'S', min: 260, title: 'LEGENDARY LEADERSHIP', strat: '"My #1 of 25 Lieutenants! Promote ahead of peers, send to SOS in residence!"', color: '#ffd23f' },
  { g: 'A', min: 220, title: 'ELITE FLIGHT',         strat: '"#3 of 25. Top 10% officer; ready for squadron-level responsibility now."', color: '#7dff6b' },
  { g: 'B', min: 170, title: 'MISSION READY',        strat: '"#8 of 25. Top third; give this officer more responsibility."', color: '#3fd8ff' },
  { g: 'C', min: 120, title: 'STILL LEVELING UP',    strat: '"#14 of 25. Solid officer; continue to develop."', color: '#cfd8e3' },
  { g: 'D', min: -999, title: 'NEEDS A RESPAWN',     strat: '"Bottom third. Meets standards." (we all know what that means)', color: '#ff9f43' },
];
const GAME_OVER_TEXT = 'RELIEVED OF COMMAND FOR CAUSE (FAILURE TO MAINTAIN CONFIDENCE OF LEADERSHIP)';

/* ---------------- intro screens (shown before class select) ---------------- */
const INTRO_STEPS = [
  ['🧑‍✈️', 'You are a leadership team', 'Your party runs a flight in a randomly rolled squadron. You win or lose TOGETHER against the scenario (and the GM).'],
  ['🗺️', 'Follow the route', 'Travel 6 stops on the route map, then face the final boss: the Inspector General.'],
  ['🔀', 'Make choices', 'Every choice helps some meters and hurts others. You can never max them all, so balance them.'],
  ['🎲', 'Roll the dice', 'Risky choices need a d20 roll plus your class stat. A natural 20 is a crit; a natural 1 is a fumble.'],
  ['🎤', 'Act it out', 'Some choices make you play the scene. The GM plays the NPC and rates you 1-3 stars.'],
  ['🌪️', 'Murphy strikes', 'Random injects hit after every stop, some good and some bad. Roll with the punches.'],
];
const INTRO_WIN = 'WIN: keep all 4 meters balanced (your WEAKEST meter counts most), beat the IG, earn achievements. Top 3 teams on the leaderboard earn extra credit.';
const INTRO_LOSE = 'LOSE: one integrity violation = instant GAME OVER. No respawns.';
const LEGEND = [
  ['🎯', 'MISSION', 'Is the job getting done?'],
  ['❤️', 'MORALE', 'Are your people motivated and heard?'],
  ['⭐', 'TRUST', 'Does your commander have confidence in you?'],
  ['📦', 'RESOURCES', 'Budget, people-hours, time, supplies'],
  ['<span class="up">▲</span> / <span class="dn">▼</span>', 'ARROWS', 'Green raises a meter, red lowers it. Doubled arrows are bigger swings.'],
  ['❔', 'DEPENDS', 'The result depends on your roll or your performance'],
  ['🔒', 'LOCKED', 'Only the Command Token holder can make this call'],
  ['🎤', 'ACT IT OUT', 'Dialogue encounter: the GM rates you 1-3 stars'],
  ['👑', 'COMMAND TOKEN', 'Starts with the Flight Commander. Authority can be delegated; responsibility cannot.'],
  ['⏸️ 🔎 📝', 'LEADERSHIP TOKENS', 'One use each: Tactical Pause (30s timeout), Intel Briefing (see exact effects), Submit a Waiver (reroll)'],
  ['🟩🟩🟩', 'LOYALTY', 'Each NPC has 0-5 loyalty. At 5 they become an Ally; at 0 they hit a Breaking Point.'],
  ['⚔️ 💀 🏕️ 🛒 ❓', 'MAP STOPS', 'Crisis · Elite Crisis (harder, bigger rewards) · Rest Stop · Supply Depot · Unknown'],
];

/* ---------------- player avatars (cadets pick one) ----------------
   Drawn on a 12x12 grid. skin / hair colour / hair style / accessory / uniform */
const AVATARS = [
  { skin: '#f1c27d', hair: '#2b1d0e', style: 'short',  acc: 'none',    shirt: '#3d5a80' },
  { skin: '#e0ac69', hair: '#111',    style: 'buzz',   acc: 'shades',  shirt: '#556b2f' },
  { skin: '#c68642', hair: '#111',    style: 'bun',    acc: 'none',    shirt: '#3d5a80' },
  { skin: '#8d5524', hair: '#111',    style: 'buzz',   acc: 'headset', shirt: '#2f4f9f' },
  { skin: '#ffdbac', hair: '#d4a017', style: 'long',   acc: 'none',    shirt: '#5b5b5b' },
  { skin: '#f1c27d', hair: '#a0522d', style: 'short',  acc: 'glasses', shirt: '#2f4f9f' },
  { skin: '#e0ac69', hair: '#5a3a1a', style: 'none',   acc: 'helmet',  shirt: '#556b2f' },
  { skin: '#c68642', hair: '#2b1d0e', style: 'long',   acc: 'glasses', shirt: '#7a2b2b' },
  { skin: '#ffdbac', hair: '#a0522d', style: 'none',   acc: 'beret',   shirt: '#2f4f9f' },
  { skin: '#8d5524', hair: '#111',    style: 'puff',   acc: 'none',    shirt: '#3d5a80' },
  { skin: '#f1c27d', hair: '#111',    style: 'none',   acc: 'cap',     shirt: '#556b2f' },
  { skin: '#d4a373', hair: '#5a3a1a', style: 'short',  acc: 'mustache', shirt: '#5b5b5b' },
  { skin: '#e0ac69', hair: '#d4a017', style: 'bun',    acc: 'shades',  shirt: '#7a2b2b' },
  { skin: '#c68642', hair: '#111',    style: 'none',   acc: 'pilot',   shirt: '#2f4f9f' },
  { skin: '#ffdbac', hair: '#7a4a2a', style: 'long',   acc: 'headset', shirt: '#556b2f' },
  { skin: '#8d5524', hair: '#2b1d0e', style: 'short',  acc: 'robot',   shirt: '#5b5b5b' },
];

/* ---------------- debrief ---------------- */
const DECODER = [
  ['🎯 MISSION meter', "Your unit's ability to execute; the reason the unit exists"],
  ['❤️ MORALE meter', "Your people's motivation; the thing that makes MISSION possible tomorrow"],
  ['⭐ TRUST meter', 'Your credibility with your commander; it buys you freedom to lead'],
  ['📦 RESOURCES meter', 'Money, people-hours, and time; always less than you need'],
  ['💀 Integrity (one hit)', 'Integrity First. In real life there is no respawn.'],
  ['👑 Command Token', 'Authority can be delegated. Responsibility cannot.'],
  ['NPC hidden traits', "Every Airman has a story you don't know until you ask"],
  ['🎤 Dialogue Encounters', 'Feedback, counseling, and briefings: the actual job of a leader'],
  ['Murphy Wheel', "Real life. You don't control it; you control your response."],
  ['The Inspector General', 'UEI / IG inspections, and every commander who will ask "How do you know?"'],
  ['Lowest-meter scoring', "Leadership is balance: you're judged by your weakest area"],
];
const DEBRIEF_ALWAYS = [
  'How did you decide who would be Flight Commander? Did the token ever move, and should it have?',
  'Which class did you wish you had? What does that tell you about building a team?',
  "Name one thing from today you'll actually do as a 2d Lt.",
];
