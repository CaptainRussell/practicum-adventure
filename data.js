/* =====================================================================
   PRACTICUM ADVENTURE - game content
   Everything a GM might want to tune lives in this file.
   Meter keys: mis (Mission) mor (Morale) tru (Trust) res (Resources)
   NPC slots:  A SSgt, B A1C, C SSgt, D SrA (the org chart is all enlisted, Amn to SSgt)
   Text placeholders: {A} {B} {C} {D} {CC} are swapped for drawn names.
   ===================================================================== */

/* ---------------- difficulty knobs ----------------
   Turn these down if parties are getting crushed, up if it's too easy. */
const DIFFICULTY = {
  dcPlus: 3,       // added to every check target: Normal 13 → 16, Hard 16 → 19
  injectEvery: 2,  // an inject hits after every 2nd stop (1 = after every stop)
  injectOdds: { bad: 3, mixed: 2, good: 1 }, // when an inject hits, a d6 picks the wheel:
                  //   1-3 Wheel of Failure, 4-5 Wheel of Meh, 6 Wheel of Success
  drainEvery: 2,   // the squadron's tendency (weak spot) hits after every 2nd stop
  bossHp: 26,      // Inspector General hit points
  bossAttack: 4,   // the IG hits your weakest meter this hard after each phase
  examDC: 15,      // boss: target for a cadet's Press roll (3 lower if The Witness was handled)
  intent: 20,      // Commander's Intent: priority meter 7+ at the end = +20 points, under 4 = -20
  vouch: 3,        // boss: commander vouches (⭐ 7+) = IG -3 HP; under the bus (⭐ 3-) = IG +3 HP
  adverseHeal: 4,  // boss: a meter hits 0 = Adverse Finding, IG heals this much
  witnessHp: 2,    // boss: each broken Unit member (loyalty 0) adds this much IG HP
  spotlights: 2,   // 🔦 Spotlight stops placed on the map (only for classes in the party)
  squadronShare: 0.7, // a ⚔️ mission comes from the squadron's own pool this often (else the generic core)
  restMain: 2,     // Rest Stop: the meter the team picks goes up this much...
  restOthers: 1,   // ...and every other meter goes up this much
  startLoy: 2,     // every Unit member's starting loyalty (Ally at 5)
  dangerAt: 2,    // a meter at or below this flashes DANGER on the projector and phones
  deocsStops: 2,   // a DEOCS Survey shows the exact meter values for this many stops
  crisisIgHp: 4,   // a Mission Failure crisis adds this much IG HP at the inspection
  mockInsp: 4,     // Readiness Inspection (UTM perk): the IG starts with this much less HP
};
const DC_NORMAL = 13 + DIFFICULTY.dcPlus, DC_HARD = 16 + DIFFICULTY.dcPlus;

const METERS = [
  { k: 'mis', name: 'MISSION',   label: 'Mission',   icon: '🎯', color: '#ff5d5d' },
  { k: 'mor', name: 'MORALE',    label: 'Morale',    icon: '❤️', color: '#ff7ae0' },
  { k: 'tru', name: 'TRUST',     label: 'Trust',     icon: '⭐', color: '#ffd23f' },
  { k: 'res', name: 'RESOURCES', label: 'Resources', icon: '📦', color: '#3fd8ff' },
];
const METER = Object.fromEntries(METERS.map(m => [m.k, m]));
const STATS = ['CMD', 'CHA', 'INS', 'GRIT'];
// What each stat means (shown on class select, phones, the legend and the guide)
const STAT_INFO = {
  CMD: { name: 'Command', text: 'give orders, make decisions, own the outcome' },
  CHA: { name: 'Charisma', text: 'persuade, counsel, motivate people' },
  INS: { name: 'Insight', text: 'read people, spot problems, plan ahead' },
  GRIT: { name: 'Grit', text: 'endure, execute under pressure, stretch resources' },
};

/* ---------------- classes ---------------- */
/* spec  = meters the class specializes in: +1 on checks tied to them (the specialist bonus)
   perks = two per class; the cadet picks one. Every perk is ONCE PER GAME, used from the phone
           (it glows when it can be used) and approved by the GM. Perks work in the boss fight.
   color = the class's border colour: every cadet's icon wears it, so votes show who is who
   ups   = level-up: A is a lasting upgrade, B is an immediate boost (now: meter changes) */
const CLASSES = [
  { id: 'fc', color: '#ffd23f', name: 'FLIGHT COMMANDER', icon: '👑', rank: 'Capt', rankLong: 'Captain', guards: '🎯 + tie-breaks', spec: ['mis'],
    stats: { CMD: 3, CHA: 1, INS: 1, GRIT: 2 },
    ability: null, abilityText: 'Command Token: Rock, Paper, Rank. Any tied vote is resolved by your choice.',
    perks: [ { id: 'lead', name: 'Lead From the Front', text: 'Once: after a failed check (or Tackle it), you take it on yourself: it counts as a pass, but ⭐ −1' },
             { id: 'hold', name: 'Hold the Line', text: 'Once: when a meter would drop to 0, it stops at 1 (fires on its own)' } ],
    ups:   [ { id: 'battle', name: 'Battle-Tested', text: '+1 CMD and +1 GRIT', stats: { CMD: 1, GRIT: 1 } },
             { id: 'huddle', name: 'Huddle', text: 'Right now: +1 to every meter', now: { mis: 1, mor: 1, tru: 1, res: 1 } } ] },
  { id: 'chief', color: '#ff9f43', name: 'SENIOR ENLISTED LEADER', icon: '🎖️', rank: 'SMSgt', rankLong: 'Senior Master Sergeant', guards: '⭐ + the enlisted force', spec: ['tru'],
    stats: { CMD: 2, CHA: 2, INS: 2, GRIT: 2 },
    ability: { id: 'pcs', name: 'Talent Management', text: 'Once: PCS one enlisted Unit member out. A hand-picked replacement arrives one rank higher (up to SSgt), with a new trait, at loyalty 4 and already an Ally' },
    perks: [ { id: 'beenthere', name: 'Been There', text: 'Once: cancel a Wheel of Failure result after it lands' },
             { id: 'ncopull', name: 'Senior NCO Pull', text: 'Once: one Unit member +3 loyalty' } ],
    ups:   [ { id: 'standards', name: 'Standards Bearer', text: '+1 🎯 after every check you roll' },
             { id: 'council', name: 'Enlisted Council', text: 'Right now: +1 loyalty to every Unit member and +1 🎯', now: { mis: 1 } } ] },
  { id: 'shirt', color: '#7dff6b', name: 'FIRST SERGEANT', icon: '💚', rank: 'MSgt', ins: '1stSgt', rankLong: 'Master Sergeant', guards: '❤️ + Unit loyalty', spec: ['mor'],
    stats: { CMD: 1, CHA: 3, INS: 2, GRIT: 1 },
    ability: { id: 'rally', name: 'Rally', text: 'Once: +2 ❤️ and +1 loyalty to every Unit member' },
    perks: [ { id: 'deocs', name: 'DEOCS Survey', text: `Once: run the climate survey. The exact meter values show for the next ${DIFFICULTY.deocsStops} stops, and every Unit member +1 loyalty` },
             { id: 'resiliency', name: 'Resiliency Day', text: 'Once: ❤️ +3 and every Unit member +1 loyalty, but 🎯 −1' } ],
    ups:   [ { id: 'engine', name: 'Morale Engine', text: "❤️ never drops more than 1 in one hit" },
             { id: 'wingman', name: 'Wingman Program', text: 'Right now: +2 ❤️ and +2 loyalty to the lowest-loyalty Unit member', now: { mor: 2 } } ] },
  { id: 'xo', color: '#b18cff', name: 'EXECUTIVE OFFICER', icon: '🗣️', rank: '1st Lt', rankLong: 'First Lieutenant', guards: '⭐ + the commander', spec: ['tru'],
    stats: { CMD: 1, CHA: 3, INS: 1, GRIT: 1 },
    ability: { id: 'confidant', auto: true, name: "Commander's Confidant", text: "Passive: the commander's negative perk never applies (it's crossed out from squadron select on)" },
    perks: [ { id: 'readroom', name: 'Read the Room', text: 'Once: see the exact effects of every choice on this mission' },
             { id: 'ear', name: "Commander's Ear", text: 'Once: cancel the most recent ⭐ loss' } ],
    ups:   [ { id: 'golden', name: 'Golden Child', text: 'All ⭐ losses reduced by 1 (min 1)' },
             { id: 'favor', name: "Commander's Favor", text: 'Right now: +3 ⭐', now: { tru: 3 } } ] },
  { id: 'utm', color: '#3fd8ff', name: 'UNIT TRAINING MANAGER', icon: '📚', rank: 'TSgt', rankLong: 'Technical Sergeant', guards: '🎯 + upgrade training', spec: ['mis'],
    stats: { CMD: 1, CHA: 1, INS: 2, GRIT: 3 },
    ability: { id: 'sevenlvl', name: '7-Level Upgrade', text: 'Once: +3 🎯' },
    perks: [ { id: 'mti', name: 'Prior MTI', text: 'Once: after a failed check (or Tackle it), the former Military Training Instructor takes command: it counts as a pass' },
             { id: 'readiness', name: 'Readiness Inspection', text: `Once, before the IG arrives: run a mock inspection. The IG starts with ${DIFFICULTY.mockInsp} less HP` } ],
    ups:   [ { id: 'efficiency', name: 'Efficiency Expert', text: 'All 📦 losses reduced by 1 (min 1)' },
             { id: 'drill', name: 'Budget Drill', text: 'Right now: +3 📦', now: { res: 3 } } ] },
  { id: 'plans', color: '#ff7ae0', name: 'PLANS OFFICER', icon: '🧠', rank: '2d Lt', rankLong: 'Second Lieutenant', guards: '📦', spec: ['res'],
    stats: { CMD: 1, CHA: 1, INS: 3, GRIT: 1 },
    ability: { id: 'foresight', name: 'Foresight', text: 'Once: the next inject skips the d6 and comes from the Wheel of Success' },
    perks: [ { id: 'prepo', name: 'Pre-Positioned Supplies', text: 'Once, at a BX: the next purchase costs no 📦 (you staged the gear ahead of time)' },
             { id: 'emergency', name: 'Emergency Fund', text: 'Once: +3 📦 right now' } ],
    ups:   [ { id: 'contingency', name: 'Contingency Plan', text: 'Halve the next Wheel of Failure result' },
             { id: 'cell', name: 'Planning Cell', text: 'Right now: +2 🎯 and +1 📦', now: { mis: 2, res: 1 } } ] },
];
const CLASS = Object.fromEntries(CLASSES.map(c => [c.id, c]));

/* ---------------- units ----------------
   start   starting meters: one STRONG (7), one in DANGER (2), two STEADY, so squadrons differ at a glance
   drain   the squadron's tendency: that meter drops 1 after every DIFFICULTY.drainEvery stops
   cc      the commander: a positive and a negative perk, and their intent (priority meter).
           hook = what the perk does in the engine:
             gain {k,d}       every gain to meter k changes by d
             hard {m}         every check tied to meter m uses the Hard target
             late             a ⭐ loss from bad news delivered late is doubled
             idea {eff}       adopting a subordinate's idea gives eff
             afterPass {m,eff} / afterFail {m,eff} / stars1 {eff} / stars3 {eff} / rest {eff}  effects after those events
             restLess         every Rest Stop pick gives 1 less
             depot2           the Base Exchange (BX) allows two purchases per visit
             depotTax {eff}   every BX purchase also costs eff
             noArrows         choices show no ▲▼ arrows (Read the Room still shows exact effects)
   slots   the 4 Unit members (A best hand, B newest Airman, C most experienced, D admin): all enlisted, Amn to SSgt: rank + description
   traitW  trait weights for this squadron (unlisted traits weigh 1) */
const UNITS = [
  { id: 'wk', name: '4TH AMXS', sq: '4th Aircraft Maintenance Squadron', icon: '🔧', color: '#ff9f43',
    start: { mis: 7, mor: 4, tru: 5, res: 2 }, ccRank: 'Lt Col',
    drain: { k: 'res', name: 'OPS TEMPO', text: 'Jets break faster than parts arrive' },
    cc: { intent: 'mis',
      pos: { name: 'Maintenance Pride', text: 'Every passed 🎯 check gives +1 🎯 more.', hook: { afterPass: { m: 'mis', eff: { mis: 1 } } } },
      neg: { name: 'Jets Before Rest', text: 'Every Rest Stop gives 1 less: rest is for after the jets fly.', hook: { restLess: true } } },
    slots: [ { rank: 'SSgt', pub: 'Crew chief, best wrench on the line' }, { rank: 'Amn', pub: 'Fresh out of tech school, eager' },
             { rank: 'SSgt', pub: 'Expediter, eight years on the flightline' }, { rank: 'SrA', pub: 'Supply liaison, runs parts out to the jets' } ],
    traitW: { burnout: 3, overach: 2, silent: 2 } },
  { id: 'gg', name: '56TH SFS', sq: '56th Security Forces Squadron', icon: '🛡️', color: '#3fd8ff',
    start: { mis: 7, mor: 2, tru: 5, res: 4 }, ccRank: 'Lt Col',
    drain: { k: 'mor', name: '12-HOUR SHIFTS', text: 'Nights, weekends and holidays on the gate wear people down' },
    cc: { intent: 'tru',
      pos: { name: 'Defender Ethos', text: 'A 3⭐ 🎤 encounter also gives +1 ❤️.', hook: { stars3: { mor: 1 } } },
      neg: { name: 'Inspection Ready', text: 'Every failed 🎯 check also costs ⭐ −1: the CC notices every miss.', hook: { afterFail: { m: 'mis', eff: { tru: -1 } } } } },
    slots: [ { rank: 'SrA', pub: 'Gate sentry, knows every regular by name' }, { rank: 'Amn', pub: 'Newest Defender, still learning post orders' },
             { rank: 'SSgt', pub: 'Patrol lead, runs the night shift' }, { rank: 'SrA', pub: 'Armorer, knows every weapon in the vault' } ],
    traitW: { burnout: 3, bender: 2, family: 2 } },
  { id: 'pp', name: '6TH CS', sq: '6th Communications Squadron', icon: '📡', color: '#7dff6b',
    start: { mis: 2, mor: 7, tru: 4, res: 5 }, ccRank: 'Maj',
    drain: { k: 'mis', name: 'TICKET BACKLOG', text: 'Comfy chairs, slow tickets: the queue keeps growing' },
    cc: { intent: 'mis',
      pos: { name: 'Early Adopter', text: "Adopting a subordinate's idea gives +1 ⭐ and +1 🎯.", hook: { idea: { tru: 1, mis: 1 } } },
      neg: { name: 'Death by PowerPoint', text: 'A 1⭐ 🎤 encounter also costs ⭐ −1: the CC wants polished briefs.', hook: { stars1: { tru: -1 } } } },
    slots: [ { rank: 'SrA', pub: 'The network whisperer' }, { rank: 'A1C', pub: 'Just passed Security+, wants to hack everything' },
             { rank: 'SSgt', pub: 'Help desk lead, has seen every ticket' }, { rank: 'SrA', pub: 'Cyber transport tech, pulls cable all day' } ],
    traitW: { coaster: 3, genius: 3, cynic: 2 } },
  { id: 'sr', name: '92ND LRS', sq: '92nd Logistics Readiness Squadron', icon: '🚚', color: '#ffd23f',
    start: { mis: 5, mor: 4, tru: 2, res: 7 }, ccRank: 'Lt Col',
    drain: { k: 'tru', name: 'LATE DELIVERIES', text: 'Every unit on base blames supply' },
    cc: { intent: 'tru',
      pos: { name: 'Logistician', text: 'The BX allows TWO purchases per visit.', hook: { depot2: true } },
      neg: { name: 'Tight Wallet', text: 'Every 📦 gain is reduced by 1.', hook: { gain: { k: 'res', d: -1 } } } },
    slots: [ { rank: 'SSgt', pub: 'Vehicle ops dispatcher' }, { rank: 'A1C', pub: 'Newest in the warehouse' },
             { rank: 'SSgt', pub: 'Supply lead, knows where everything is' }, { rank: 'SrA', pub: 'Unit resource tracker, owns the spend plan' } ],
    traitW: { climber: 2, gossip: 2, overach: 2 } },
  { id: 'sa', name: '7TH IS', sq: '7th Intelligence Squadron', icon: '🔍', color: '#b18cff',
    start: { mis: 7, mor: 4, tru: 2, res: 5 }, ccRank: 'Lt Col',
    drain: { k: 'mor', name: 'WINDOWLESS VAULT', text: 'No sunlight, no phones, no talking about work at home' },
    cc: { intent: 'tru',
      pos: { name: 'Quiet Professional', text: 'Every passed ⭐ check gives +1 ⭐ more.', hook: { afterPass: { m: 'tru', eff: { tru: 1 } } } },
      neg: { name: 'Compartmented', text: 'Choices show no ▲▼ arrows: you decide on the facts alone (Read the Room still works).', hook: { noArrows: true } } },
    slots: [ { rank: 'SSgt', pub: 'Senior analyst' }, { rank: 'A1C', pub: 'New linguist, three months on station' },
             { rank: 'SSgt', pub: 'Mission supervisor' }, { rank: 'SrA', pub: 'Unit security monitor' } ],
    traitW: { silent: 3, witness: 2, mentor: 2 } },
  { id: 'ch', name: '55TH FSS', sq: '55th Force Support Squadron', icon: '🍔', color: '#ff7ae0',
    start: { mis: 2, mor: 7, tru: 5, res: 4 }, ccRank: 'Maj',
    drain: { k: 'res', name: 'SHORT-STAFFED', text: 'Never enough hands at the dining facility' },
    cc: { intent: 'mis',
      pos: { name: 'People Person', text: 'Every ❤️ gain is +1.', hook: { gain: { k: 'mor', d: 1 } } },
      neg: { name: 'Budget Squeeze', text: 'Every BX purchase costs 1 extra 📦.', hook: { depotTax: { res: -1 } } } },
    slots: [ { rank: 'SSgt', pub: 'Dining facility shift lead' }, { rank: 'A1C', pub: 'Fitness center desk, first assignment' },
             { rank: 'SSgt', pub: 'Lodging shift supervisor' }, { rank: 'SrA', pub: 'Community programs coordinator' } ],
    traitW: { family: 2, gossip: 3, mentor: 2 } },
];

/* ---------------- NPCs ---------------- */
// Default slots; each squadron's own ranks and descriptions (UNITS[].slots) override these.
// All four are enlisted, Amn to SSgt (Talent Management can PCS any of them).
const SLOTS = [
  { s: 'A', rank: 'SSgt', pub: 'Your best technician', pool: 'lower', enlisted: true },
  { s: 'B', rank: 'A1C',  pub: "Three months on station, doesn't know much", pool: 'lower', enlisted: true },
  { s: 'C', rank: 'SSgt', pub: 'Eight years in, seen it all, a bit salty', pool: 'upper', enlisted: true },
  { s: 'D', rank: 'SrA', pub: 'Runs the unit admin and the budget', pool: 'upper', enlisted: true },
];
// Gender for each roster name: 'm' or 'f'. A civilian Unit member shows as "Mr. Warner" / "Ms. Warner"
// instead of "Civ. Warner" (a name missing here falls back to "Civ.").
const GENDER = {
  'Donahoe': 'm',
  'Luhring': 'm',
  'Hyman': 'm',
  'Figueroa-Baca': 'm',
  'Metz': 'm',
  'Plassman': 'm',
  'Alt': 'm',
  'Kingery': 'm',
  'Albert': 'm',
  'Cerfogli': 'f',
  'Chien': 'm',
  'Edwardson': 'm',
  'Salas': 'm',
  'Warner': 'f',
  'Gross': 'm',
  'Brady': 'f',
  'Estes': 'f',
  'Martinez': 'm',
  'Condon-Matzke': 'f',
  'Bendinger': 'm',
  'Hutchinson': 'm',
  'Jordan': 'm',
  'McNamara': 'm',
  'Ramsey': 'm',
  'Reed': 'm',
  'Reid': 'm',
  'Schnute': 'm',
  'Budde': 'm',
  'Fennel': 'f',
  'Moreno': 'm',
  'Mueller': 'm',
  'Sanderson': 'm',
  'Urbanowicz': 'm',
  'Utterback': 'm',
  'Dybvig': 'm',
  'Hemauer': 'f',
  'Hoang': 'f',
  'Kasparek': 'm',
  'Wenthold': 'f',
  'Bennett': 'm',
  'Call': 'm',
  'Jons': 'm',
  'Peter': 'f',
  'States': 'm',
  'Tjaden': 'm',
};
// Named characters outside your Unit. Each run draws them from roster names nobody else is using.
// In text: {X:wing} = "Col Hyman" · {X:wing.name} = "Hyman" · {X:wing.he} {X:wing.He} {X:wing.him} {X:wing.his} {X:wing.His}.
// The person in serious trouble (arrests, weapons incidents) stays an unnamed Airman: roster names are real classmates.
const EXTRAS = {
  wing:       { rank: 'Col',     pool: 'upper', generic: 'the Wing CC' },
  general:    { rank: 'Maj Gen', pool: 'upper', generic: 'a two-star general' },
  chief:      { rank: 'CMSgt',   pool: 'upper', generic: 'a Chief' },
  msgt:       { rank: 'MSgt',    pool: 'upper', generic: 'a MSgt' },
  contractor: { rank: 'Civ.',    pool: 'upper', generic: 'the contractor' },
  peer:       { rank: 'Capt',    pool: 'upper', generic: "another flight's leader" },
  transfer:   { rank: 'SrA',     pool: 'lower', generic: 'one Airman' },
  nd1:        { rank: 'A1C',     pool: 'lower', generic: 'one Airman' },
  nd2:        { rank: 'Amn',     pool: 'lower', generic: 'another' },
};
const civTitle = name => ({ m: 'Mr.', f: 'Ms.' })[GENDER[name]] || 'Civ.';
// NPC name pools (last names only). Upper = POC: Unit members C and D, the Squadron CC.
// Lower = AS200/250/500: SSgt, A1C. Edit these lists to update the roster.
const POOL_UPPER = ['Donahoe', 'Luhring', 'Hyman', 'Figueroa-Baca', 'Metz', 'Plassman', 'Alt', 'Kingery', 'Albert',
  'Cerfogli', 'Chien', 'Edwardson', 'Salas', 'Warner', 'Gross'];
const POOL_LOWER = ['Brady', 'Estes', 'Martinez', 'Condon-Matzke', 'Bendinger', 'Hutchinson', 'Jordan', 'McNamara',
  'Ramsey', 'Reed', 'Reid', 'Schnute', 'Budde', 'Fennel', 'Moreno', 'Mueller', 'Sanderson',
  'Urbanowicz', 'Utterback', 'Dybvig', 'Hemauer', 'Hoang', 'Kasparek', 'Wenthold', 'Bennett', 'Call',
  'Jons', 'Peter', 'States', 'Tjaden'];

// vet = takes years in the Air Force: never drawn for the newest Airman (slot B)
// reward = what triggers automatically (once per game per member unless it says 'while'); see traitReward() in app.js
// bp = Breaking Point effect, applied automatically when loyalty hits 0
const TRAITS = [
  { id: 'burnout',  icon: '🔥', name: 'Burning Out',        what: 'Quietly overloaded',                      reward: 'First Rest Stop: +2 loyalty and +1 ❤️',     bpText: 'Requests separation',                    bp: { mis: -2 } },
  { id: 'genius',   icon: '💡', name: 'Secret Genius',      what: 'Has a process fix nobody asked about',     reward: 'First 💡 idea you adopt: +3 🎯 and +1 loyalty',           bpText: 'Takes the idea to a rival unit',         bp: { tru: -1 } },
  { id: 'family',   icon: '🏠', name: 'Family Crisis',      what: 'Performance dip from a home issue',        reward: 'First time the First Sergeant or a Rest Stop shows them care: +2 more loyalty and +1 ❤️',                      bpText: 'Emergency leave: out for 2 nodes',       bp: { out: 2 } },
  { id: 'bender',   icon: '⚠️', name: 'Rule Bender',        what: 'Cuts corners to look good',                reward: 'While at loyalty 4+: tips you off when a choice smells like a shortcut ⚠️',        bpText: 'Their shortcut becomes YOUR problem',    bp: { tru: -2 } },
  { id: 'climber',  icon: '🏆', name: 'Climber',            what: 'Wants recognition',                        reward: 'First 3⭐ 🎤 encounter (public praise): +2 loyalty',             bpText: 'Goes over your head to the Sq CC',       bp: { tru: -2 } },
  { id: 'silent',   icon: '🤐', name: 'Silent Struggler',   what: "Won't ask for help",                       reward: 'First time they reach loyalty 4 (they finally open up): +2 🎯',                   bpText: 'Misses a critical task',                 bp: { mis: -2 } },
  { id: 'cynic', vet: true,    icon: '🤨', name: 'Cynic with a Heart', what: 'Resists change, loyal if heard',           reward: 'Becomes an Ally at loyalty 4 instead of 5',           bpText: 'Spreads negativity',                     bp: { mor: -2 } },
  { id: 'gossip',   icon: '📢', name: 'The Gossip',         what: 'Everything said spreads',                  reward: 'While at loyalty 3+: every Wheel of Success also +1 ❤️. At 1 or less: every Wheel of Failure also −1 ❤️',            bpText: 'Rumor mill',                             bp: { mor: -1, tru: -1 } },
  { id: 'overach',  icon: '🏃', name: 'Over-Achiever',      what: 'Volunteers for everything',                reward: 'First Rest Stop (rested, they deliver): +2 🎯. Volunteering them at the BX costs 2 loyalty, not 1',          bpText: 'Collapses: out for 1 node',              bp: { mor: -2, out: 1 } },
  { id: 'mentor', vet: true,   icon: '🎓', name: 'Mentor-in-Waiting',  what: 'Wants to train others',                    reward: 'Becomes an Ally: +1 🎯, +1 ❤️, and the newest Airman +2 loyalty',         bpText: 'Disengages',                             bp: { mor: -1 } },
  { id: 'coaster', vet: true,  icon: '😴', name: 'The Coaster',        what: 'Bored, doing the minimum',                 reward: 'Volunteer them for the BX Saturday detail: +1 loyalty instead of −1, and +2 🎯 more',             bpText: 'Drags others down',                      bp: { mis: -1 } },
  { id: 'witness',  icon: '🕵️', name: 'The Witness',        what: 'Knows about a problem in the unit',        reward: `At loyalty 4+ when the IG arrives, they tip you off: Press target ${DIFFICULTY.examDC - 3}`, bpText: `Reports it to the IG: boss HP ${DIFFICULTY.bossHp + 3}`, bp: { flag: 'WITNESS_IG' } },
];
const TRAIT = Object.fromEntries(TRAITS.map(t => [t.id, t]));

/* ---------------- missions ----------------
   choice fields:
     t     button text          show  arrows [[meter, n]] n = 1,2,-1,-2 or '?'
     mic   dialogue encounter   trap  integrity trap
     tags  'idea' (adopts a subordinate idea), 'late' (late bad news)
     kind  'fx' | 'check' | 'stars'
     eff   immediate effect (fx)         pre  effect applied on choosing
     check {stat, dc, m (meter tie), pass, fail}   stat 'LOYB' = d20 + A1C loyalty, null = plain d20
     stars [one, two, three]
     ifClass {cls:[...], then:{...choice}, else:{...choice}}
   mission fields: home ['gg', ...] = belongs to those squadrons' pools (no home = the generic core);
     critical: true = that squadron's Elite mission (drawn at 💀 Elite stops)
     off: true = retired: never drawn (delete the flag to bring it back)
   check dc is the base target; DIFFICULTY.dcPlus is added on top in the game.
   effect fields: meters, loy:{A:-1}, flag, ach, reveal:'A', next:{...} (applied at the
     start of the next node), set:{mis:3}, traitLoy:{trait,d}, traitAny:{trait, eff}, loot:true,
     offlineSelf:true (the spotlighted cadet is offline next stop); next:{p:0.5,...} = only a 50% chance
*/
const MISSIONS = [
  { id: 'M1', title: 'THE 0900 DEADLINE', sob: 'Expectations · Feedback', icon: '⏰',
    text: "The Sq CC's slides were due at 0900. It's 0930. {B} was tasked and has delivered nothing. The CC wants them by 1300.",
    choices: [
      { t: 'Do it yourselves', show: [['mis', 1], ['res', -1]], kind: 'fx',
        eff: { mis: 2, res: -2, loy: { B: -1 }, next: { loy: { B: -1 }, why: '{B} still doesn\'t know what was expected' } } },
      { t: 'Pull {B} aside first', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        note: 'Twist: {B} says "Nobody told me it was due at 0900."',
        stars: [ { mis: 1, mor: -1 }, { mis: 1, mor: 1 }, { mis: 2, mor: 2, loy: { B: 3 } } ] },
      { t: 'Hand it to {A}', show: [['mis', '?'], ['mor', -1]], kind: 'check', pre: { traitAny: { slot: 'A', traits: ['burnout', 'overach'], eff: { loy: { A: -1 } } } }, check: { stat: 'CMD', dc: 13, m: 'mis', pass: { mis: 3, mor: -2, loy: { A: -1 } }, fail: { mor: -2, mis: -1, loy: { A: -1 } } } },
      { t: 'Ask the CC to move the deadline', show: [['tru', '?']], kind: 'check',
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
        stars: [ { loy: { C: -2 } }, {}, { loy: { C: 2 }, mor: 1 } ] },
    ] },
  { id: 'M3', title: '"WE TRIED THAT IN 2019"', sob: 'Barriers to Creative Thinking', icon: '💡', home: ['pp'],
    text: 'In the morning meeting, {A} pitches a fix for the flight\'s slowest process. {C} cuts them off in front of everyone: "We tried that in 2019. Didn\'t work." The room goes quiet.',
    choices: [
      { t: 'Back {C}: stick with what works', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 1, mor: -2, loy: { A: -2 } } },
      { t: 'Facilitate: both make their case', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2 }, { mor: 3, loy: { A: 1, C: 1 } } ] },
      { t: 'Pilot it small and measure it', req: { stat: 'INS', min: 3 }, tags: ['idea'], show: [['mis', 2], ['res', -1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 3, res: -2, ach: 'ideas' }, fail: { mis: -1, res: -2, mor: 1, ach: 'ideas' } } },
      { t: 'Adopt it now, overrule {C}', tags: ['idea'], show: [['mis', 1], ['mor', '?']], kind: 'check',
        check: { stat: null, dc: 11, m: 'mis', pass: { mis: 2, mor: 1, loy: { C: -2 }, ach: 'ideas' }, fail: { mis: -2, loy: { C: -2 }, ach: 'ideas' } } },
    ] },
  { id: 'M4', title: 'THE COASTER', sob: 'Motivation', icon: '😴',
    text: '{A}, your best performer last quarter, is now doing exactly the minimum. Never late, never wrong, never extra.',
    choices: [
      { t: 'Formal counseling on standards', show: [['mis', '?'], ['mor', -1]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'mis', pass: { mis: 2, mor: -2, loy: { A: -2 } }, fail: { mor: -2, mis: -1, loy: { A: -2 } } } },
      { t: 'Ask what changed', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2, loy: { A: 1 } }, { mor: 3, loy: { A: 3 } } ] },
      { t: 'Hand them a stretch project', show: [['mis', 1], ['res', -1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, mor: 1, res: -2 }, fail: { mis: -1, res: -2 } } },
      { t: 'Leave it alone, they meet standards', show: [['res', 1], ['mis', -1]], kind: 'fx',
        eff: { res: 1, mis: -1, next: { mor: -1, why: 'Others noticed the coasting' } } },
    ] },
  { id: 'M5', title: 'NOT MY JOB', sob: 'Authority vs. Responsibility', icon: '📦', off: true,
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
  { id: 'M6', title: 'THE POST', sob: 'Character · OPSEC', icon: '📱', home: ['pp', 'sa'],
    text: '{B} posted a photo from work. In the background: a whiteboard with the flight\'s schedule and tail numbers. It already has 200 likes.',
    choices: [
      { t: 'Quietly have them delete it, no report', trap: true, show: [['mor', 1], ['tru', 1]], kind: 'fx',
        eff: { mor: 1, tru: 1, flag: 'COVERED_UP' } },
      { t: 'Report it, then counsel {B}', mic: true, show: [['tru', 1], ['mis', -1]], kind: 'stars', pre: { tru: 1, mis: -1, ach: 'hardright' },
        stars: [ { mor: -1 }, { mor: 1 }, { mor: 2 } ] },
      { t: 'Report it + flight-wide OPSEC training using it as the example', mic: true, show: [['mis', '?'], ['mor', -1]], kind: 'stars', pre: { ach: 'hardright' }, stars: [{ mor: -2, mis: -1, loy: { B: -3 } }, { mis: 2, tru: 1, mor: -2, loy: { B: -3 } }, { mis: 3, tru: 1, mor: -2, loy: { B: -3 } }] },
      { t: 'Report it + recommend formal paperwork', show: [['tru', 1], ['mor', -1]], kind: 'fx',
        eff: { tru: 1, mis: 1, mor: -2, loy: { B: -2 }, ach: 'hardright' } },
    ] },
  { id: 'M7', title: 'BRIEF THE BOSS', sob: 'Articulating Ideas Clearly', icon: '🎙️', cc: true,
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
  { id: 'M8', title: 'THE FAVOR', sob: 'Character', icon: '🤝', home: ['wk', 'sr'],
    text: 'Your old ROTC buddy runs supply in another squadron. They need you to sign for equipment you haven\'t received so they can close out the fiscal year. "I\'ll get you priority on parts all next year. Promise."',
    choices: [
      { t: "Sign it, it's just paperwork", trap: true, show: [['res', 2], ['mis', 1]], kind: 'fx',
        eff: { res: 3, mis: 1, flag: 'FALSE_RECEIPT' } },
      { t: 'Politely refuse', mic: true, show: [['res', -1], ['tru', '?']], kind: 'stars', pre: { ach: 'hardright' }, stars: [{ res: -2, tru: -1 }, { res: -2, tru: 1 }, { res: -2, tru: 2 }] },
      { t: 'Refuse and report it', show: [['tru', 2], ['mor', -1]], kind: 'fx',
        eff: { tru: 2, res: -2, mor: -1, ach: 'hardright' } },
      { t: 'Help them find a legit fix', mic: true, show: [['res', 1], ['mis', -1]], kind: 'stars', pre: { mis: -1, ach: 'hardright' },
        stars: [ { res: -1 }, { res: 1 }, { res: 2, tru: 1 } ] },
    ] },
  { id: 'M9', title: 'THE OVERPROMISE', sob: 'Authority · Trust', icon: '📅', cc: true,
    text: 'Last week a member of the leadership team promised the flight a Friday family day. Today the Sq CC cancels all family days for a short-notice exercise. The flight doesn\'t know yet.',
    choices: [
      { t: 'Fight the CC to keep the day', show: [['mor', 1], ['tru', -1]], kind: 'check',
        check: { stat: 'CHA', dc: 16, m: 'tru', pass: { mor: 3, tru: -1 }, fail: { tru: -3, mor: -1 } } },
      { t: 'Tell the flight the truth and own the promise', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, mis: 1, ach: 'buck' },
        stars: [ { mor: -2 }, { mor: -1 }, { mor: 1 } ] },
      { t: 'Give them a reward you DO control', show: [['mor', '?'], ['res', -1]], kind: 'check', check: { stat: 'INS', dc: 13, m: 'mor', pass: { mor: 2, res: -2 }, fail: { res: -2, mor: -1 } } },
      { t: 'Say nothing, hope it blows over', tags: ['late'], show: [['res', 1], ['mor', -2]], kind: 'fx',
        eff: { res: 1, mor: -3, traitAny: { trait: 'gossip', eff: { tru: -1 } } } },
    ] },
  { id: 'M10', title: 'NEW KID', sob: 'Establishing Expectations', icon: '🆕', off: true,
    text: 'A brand-new Airman reports in today. Their sponsor forgot. No desk, no computer account, no idea where to go. They\'re standing in your doorway.',
    choices: [
      { t: 'Hand them to {A} to sort out', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 1, mor: -1, loy: { A: -1 } } },
      { t: 'Welcome them + set initial expectations', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2 }, { mor: 3, flag: 'NEWKID_ALLY' } ] },
      { t: 'Chew out the sponsor in front of everyone', show: [['mis', 1], ['mor', -2]], kind: 'fx',
        eff: { mis: 1, mor: -3 } },
      { t: 'Spend money to fast-track gear and access', show: [['mis', 1], ['res', -2]], kind: 'fx',
        ifClass: { cls: ['plans'], then: { eff: { mis: 2, mor: 1, res: -2 } }, else: { eff: { mis: 2, mor: 1, res: -3 } } } },
    ] },
  { id: 'M11', title: 'FLIGHTLINE FEUD', sob: 'Feedback · Counseling', icon: '💢',
    text: '{A} and {C} get into a shouting match in front of the Airmen. Everyone is watching to see what leadership does.',
    choices: [
      { t: 'Separate them and move on', show: [['mis', 1], ['mor', -1]], kind: 'fx',
        eff: { mis: 1, mor: -1, next: { mor: -1, why: 'The feud is still unresolved' } } },
      { t: 'Mediate with both of them', req: { stat: 'CHA', min: 3 }, mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: 1 }, { mor: 2 }, { mor: 3, loy: { A: 1, C: 1 } } ] },
      { t: 'Formal paperwork for both', show: [['mis', '?'], ['tru', 1], ['mor', -2]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'mis', pass: { tru: 1, mis: 1, mor: -3, loy: { A: -1, C: -1 } }, fail: { mor: -3, mis: -1, loy: { A: -1, C: -1 } } } },
      { t: 'Hand it to the Shirt / Chief', show: [['mor', 1], ['tru', '?']], kind: 'fx',
        ifClass: { cls: ['shirt', 'chief'],
          then: { kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 2, res: -1 }, fail: { res: -1 } } },
          else: { eff: { tru: -1, why: '"Why didn\'t an officer handle it?"' } } } },
    ] },
  { id: 'M12', title: 'THE SURGE', sob: 'Motivation vs. Mission', icon: '🚨', home: ['wk'],
    text: 'Short-notice tasking: the wing needs your flight to surge all weekend. It\'s the third surge this quarter.',
    choices: [
      { t: 'Everyone works all weekend', show: [['mis', 2], ['mor', -2]], kind: 'fx',
        eff: { mis: 3, mor: -3, traitLoy: { trait: 'burnout', d: -2 } } },
      { t: 'Volunteers + rotating shifts', show: [['mis', 1], ['res', -1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, mor: -1, res: -1 }, fail: { mis: 1, mor: -1, res: -2 } } },
      { t: 'Push back: "We can deliver 70%"', req: { stat: 'CMD', min: 3 }, show: [['mor', 1], ['tru', '?']], kind: 'check',
        check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 1, mis: -1, mor: 2 }, fail: { tru: -2, mor: 1 } } },
      { t: 'Borrow people from another flight', show: [['mis', '?'], ['tru', -1]], kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mis', pass: { mis: 2, mor: 1, res: -2, tru: -1 }, fail: { tru: -1, res: -2, mis: -1 } } },
    ] },

  /* ---- from cadet feedback. The person in serious trouble is always an unnamed
     Airman, never a roster name, since NPC names are real classmates. ---- */
  { id: 'M13', title: 'DUI AT 0200', sob: 'Accountability · Care for Airmen', icon: '🚔',
    text: '0200: the city police call. A Senior Airman from your flight was arrested for DUI downtown. They never called the safe-ride program. Their supervisor, {C}, takes the call with you: "Can we keep this off the CC\'s desk? They\'re a good kid."',
    choices: [
      { t: 'Keep it quiet; {C} handles it', trap: true, show: [['mor', 1], ['tru', 1]], kind: 'fx',
        eff: { mor: 1, tru: 1, flag: 'HID_DUI' } },
      { t: 'Notify the CC and First Sergeant tonight', mic: true, show: [['tru', '?'], ['mor', -1]], kind: 'stars', pre: { ach: 'hardright' }, stars: [{ mor: -1, tru: -1, loy: { C: -1 } }, { tru: 2, mor: -1, loy: { C: -1 } }, { tru: 3, mor: -1, loy: { C: -1 } }] },
      { t: 'Report it, then counsel the Airman in the morning', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, ach: 'hardright' },
        stars: [ { mor: -2 }, { mor: 1 }, { mor: 2, loy: { C: 1 } } ] },
      { t: 'Report it + restrict the whole flight to base for a month', show: [['tru', 1], ['mor', -2]], kind: 'fx',
        eff: { tru: 1, mor: -3, loy: { C: -1, B: -1 }, ach: 'hardright', why: 'Everyone punished for one person' } },
    ] },
  { id: 'M14', title: 'DORM PARTY', sob: 'Standards · Discipline', icon: '🍺', off: true,
    text: 'Saturday night dorm walk-through. {B} (age 20) is holding a beer at a party. A Senior Airman bought the alcohol. The music stops and everyone looks at you.',
    choices: [
      { t: 'Pour it out, everyone to bed, no paperwork', show: [['mor', 1], ['tru', '?']], kind: 'fx',
        eff: { mor: 1, next: { tru: -2, why: 'Photos of the party reached the CC' } } },
      { t: 'Report both: underage drinking + supplying alcohol', show: [['tru', 2], ['mor', -1]], kind: 'fx',
        eff: { tru: 2, mor: -2, loy: { B: -2 }, ach: 'hardright' } },
      { t: 'Report it, then talk with {B} one-on-one', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, ach: 'hardright' },
        stars: [ { mor: -1, loy: { B: -1 } }, { mor: 1 }, { mor: 1, loy: { B: 3 } } ] },
      { t: 'Skip the paperwork, launch a dorm alcohol program', show: [['mor', 1], ['res', -1]], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 2, res: -2 }, fail: { res: -2, mor: -1, tru: -2, why: 'The CC asks why nobody was held accountable' } } },
    ] },
  { id: 'M15', title: 'FIGHT CLUB', sob: 'Standards · Initiative', icon: '🥊', off: true,
    text: 'A Snapchat video is going around: Senior Airmen running a "fight club" behind the dorms every Friday night. {B} shows up Monday with a black eye. Rule #1 is you don\'t talk about it. Everyone is talking about it.',
    choices: [
      { t: 'Pretend you never saw the video', trap: true, show: [['mor', 1], ['res', 1]], kind: 'fx',
        eff: { mor: 1, res: 1, flag: 'IGNORED_FIGHT' } },
      { t: 'Shut it down and report it to the CC', show: [['tru', 2], ['mor', -2]], kind: 'fx',
        eff: { tru: 2, mor: -2, mis: -1, ach: 'hardright' } },
      { t: 'Report it, then talk to {B} about the eye', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, ach: 'hardright' },
        stars: [ { mor: -1 }, { mor: 1, loy: { B: 1 } }, { mor: 2, loy: { B: 3 } } ] },
      { t: 'Report it, then start an official combatives club', show: [['mor', 2], ['res', -1]], kind: 'check', pre: { tru: 1, ach: 'hardright' },
        check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 3, res: -2 }, fail: { mor: -1, res: -2, why: 'Nobody signed up' } } },
    ] },
  { id: 'M16', title: 'FRIENDLY FIRE', sob: 'Feedback · Creative Thinking', icon: '🔫', home: ['gg'],
    text: 'During a base-defense exercise, {B} brought a personal paintball gun and "neutralized" every senior NCO in the command post. The video is hilarious. The Chiefs are not laughing. {B}: "The exercise said to engage the enemy!"',
    choices: [
      { t: 'Laugh it off: it was just an exercise', show: [['mor', 1], ['tru', -2]], kind: 'fx',
        eff: { mor: 2, tru: -3, loy: { C: -2 } } },
      { t: 'Paperwork for {B} (Letter of Reprimand)', show: [['mis', '?'], ['tru', 1], ['mor', -1]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'mis', pass: { tru: 1, mis: 1, mor: -2, loy: { B: -2 } }, fail: { mor: -2, mis: -1, loy: { B: -2 } } } },
      { t: 'Counsel {B}: right instinct, wrong way', mic: true, show: [['mor', 1], ['tru', '?']], kind: 'stars',
        stars: [ { mor: -1, tru: -1 }, { mor: 1, tru: 1 }, { mor: 2, tru: 1, loy: { B: 3 } } ] },
      { t: 'Make {B} the official enemy force next exercise', tags: ['idea'], show: [['mis', 1], ['tru', '?']], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, mor: 2, tru: -1, ach: 'ideas' }, fail: { tru: -2, mor: 1, ach: 'ideas' } } },
    ] },
  { id: 'M17', title: 'ASLEEP AT THE WHEEL', sob: 'Accountability · Fatigue', icon: '🛻', home: ['gg', 'wk', 'sr'],
    text: 'Hour 14 of a 12-hour shift. {B} fell asleep driving on the flightline and rear-ended a parked aircraft. Nobody was hurt, but the jet is grounded for repairs. {C}: "Write it up as a brake failure. That truck\'s ancient anyway."',
    choices: [
      { t: 'Write it up as a brake failure', trap: true, show: [['tru', 1], ['mor', 1]], kind: 'fx',
        eff: { tru: 1, mor: 1, flag: 'FALSE_MISHAP' } },
      { t: 'Report it and put it all on {B}: they were driving', show: [['tru', 1], ['mor', -2]], kind: 'fx',
        eff: { tru: 1, mor: -3, loy: { B: -3 }, ach: 'hardright' } },
      { t: 'Brief the CC: the crash AND the 14-hour shifts behind it', mic: true, show: [['tru', '?'], ['mis', -1]], kind: 'stars', pre: { mis: -1, ach: 'hardright' },
        stars: [ { tru: -2 }, { tru: 1 }, { tru: 2, mor: 1, ach: 'buck' } ] },
      { t: 'Report it and fix the shift schedule', show: [['mor', 1], ['mis', -1]], kind: 'check', pre: { ach: 'hardright' },
        check: { stat: 'INS', dc: 13, m: 'mor', pass: { mor: 2, mis: -1, res: -1, tru: 1 }, fail: { mis: -2, res: -1 } } },
    ] },
  { id: 'M18', title: 'ROUND IN THE CEILING', sob: 'Character · Accountability', icon: '💥', home: ['gg'],
    text: 'An Airman from another flight took an M4 back to the dorms after shift and fired a round through the ceiling while "clearing it." Nobody was hit. Strangely, the armory log says the rifle was turned in on time, and {C} signed the log.',
    choices: [
      { t: 'Fix the armory log and patch the ceiling', trap: true, show: [['tru', 1], ['mor', 1]], kind: 'fx',
        eff: { tru: 1, mor: 1, flag: 'FALSE_ARMORY' } },
      { t: 'Secure the weapon, call investigators, notify the CC', show: [['tru', 2], ['mis', -2]], kind: 'fx',
        eff: { tru: 2, mis: -2, mor: -1, ach: 'hardright' } },
      { t: 'Report it, then ask {C} how the log got signed', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, ach: 'hardright' },
        stars: [ { loy: { C: -2 }, mor: -1 }, { mis: 1 }, { mis: 1, loy: { C: 2 } } ] },
      { t: 'Report it + armory-wide accountability stand-down', show: [['tru', 1], ['res', -2]], kind: 'check', pre: { ach: 'hardright' },
        check: { stat: 'GRIT', dc: 16, m: 'mis', pass: { mis: 2, tru: 2, res: -2, mor: -1 }, fail: { res: -3, mor: -2, tru: 1 } } },
    ] },
  { id: 'M19', title: 'THROUGH THE WALL', sob: 'Care for Airmen · Duty to Report', icon: '🏠',
    text: '{C} pulls you aside: "I live next to one of our Staff Sergeants. Last night: yelling, then something breaking. This morning their spouse had a bruise on their arm. They say it was nothing. Please don\'t make this a thing; they\'re up for promotion."',
    choices: [
      { t: 'Keep it quiet to protect the promotion', trap: true, show: [['mor', 1], ['mis', 1]], kind: 'fx',
        eff: { mor: 1, mis: 1, flag: 'COVERED_DV' } },
      { t: "Stay out of it: it's their private life", show: [['res', 1], ['tru', '?']], kind: 'fx',
        eff: { res: 1, next: { tru: -3, mor: -1, why: 'The police were called the next time' } } },
      { t: 'Notify the First Sergeant and CC; bring in Family Advocacy', show: [['tru', '?'], ['mis', -1]], kind: 'check', pre: { ach: 'hardright' }, check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 2, mis: -1, loy: { C: -1 } }, fail: { mis: -1, tru: -1, loy: { C: -1 } } } },
      { t: 'Report it, then thank {C} for speaking up', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, ach: 'hardright' },
        stars: [ { loy: { C: -2 } }, { mor: 1 }, { mor: 2, loy: { C: 3 } } ] },
    ] },
  { id: 'M20', title: 'MISSED MOVEMENT', sob: 'Accountability · Decision Making', icon: '🚌', home: ['sr'],
    text: "0500, deployment day. The bus to the jet leaves at 0600 sharp. {B} isn't here and isn't answering their phone. Missing a movement is a crime under the UCMJ (Article 87). The clock is running.",
    choices: [
      { t: 'Race to the dorms to find them', req: { stat: 'GRIT', min: 3 }, show: [['mis', '?'], ['res', -1]], kind: 'check', pre: { res: -1 },
        check: { stat: 'GRIT', dc: 13, m: 'mis', pass: { mis: 1, loy: { B: 2 } }, fail: { mis: -2, tru: -1 } } },
      { t: 'Ask the CC to hold the bus 30 minutes', show: [['tru', '?'], ['mis', 1]], kind: 'check',
        check: { stat: 'CHA', dc: 16, m: 'tru', pass: { mis: 1, tru: -1 }, fail: { tru: -3, mis: -1 } } },
      { t: 'Send the backup Airman and report it', show: [['tru', '?'], ['res', -2]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 1, mis: -1, res: -2, mor: -1 }, fail: { mis: -1, mor: -1, res: -2, tru: -1 } } },
      { t: 'Call the First Sergeant for a welfare check', show: [['mor', 1], ['mis', -1]], kind: 'fx',
        eff: { mor: 1, mis: -2, loy: { B: 2 }, why: 'Turns out something really was wrong' } },
    ] },
  { id: 'M21', title: 'GATE RUNNER', sob: 'Decisions Under Pressure', icon: '🚓', home: ['gg'],
    text: 'A car fleeing city police blows through the main gate at 70 mph. {B} was alone on the gate. The car is somewhere on base now, near base housing and the youth center. Every radio in the command post is going off.',
    choices: [
      { t: 'Lock down the base; coordinate with city police', show: [['mis', '?'], ['res', -1]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'mis', pass: { mis: 2, res: -2, mor: -1, tru: 1 }, fail: { mor: -1, res: -2, mis: -1 } } },
      { t: 'Let {B} chase them alone', show: [['mis', '?']], kind: 'check',
        check: { stat: 'LOYB', dc: 14, m: 'mis', pass: { mis: 2, loy: { B: 1 } }, fail: { mis: -2, tru: -2, loy: { B: -1 }, why: 'A solo pursuit with no backup' } } },
      { t: 'Run it from the command post: calm, clear orders', mic: true, show: [['mis', '?'], ['tru', 1]], kind: 'stars',
        stars: [ { mis: -1, tru: -1 }, { mis: 1, tru: 1 }, { mis: 2, tru: 2, mor: 1 } ] },
      { t: "Let the city police handle it: it's their chase", show: [['res', 1], ['tru', -1]], kind: 'fx',
        eff: { res: 1, tru: -2, mis: -2 } },
    ] },
  { id: 'M22', title: '"NOT GONNA HAPPEN"', sob: 'Authority · Feedback', icon: '🙅', off: true,
    text: 'In front of the whole flight, {C} refuses your direct order to redo a failed inspection item: "With respect, I\'m not doing that. It\'s a waste of time." Every Airman in the room is watching to see what you do.',
    choices: [
      { t: 'Pull {C} aside right now', mic: true, show: [['mis', '?'], ['tru', 1]], kind: 'stars',
        stars: [ { tru: -1, loy: { C: -1 } }, { mis: 1, tru: 1 }, { mis: 1, tru: 1, loy: { C: 3 } } ] },
      { t: 'Dress {C} down on the spot', show: [['mis', 1], ['mor', -2]], kind: 'fx',
        eff: { mis: 1, mor: -3, loy: { C: -2 } } },
      { t: 'Let it slide this once', show: [['mor', 1], ['tru', -1]], kind: 'fx',
        eff: { mor: 1, tru: -2, next: { mis: -2, why: 'Now nobody follows orders' } } },
      { t: "Hear {C} out: maybe there's a better way", tags: ['idea'], show: [['mis', '?'], ['mor', 1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, mor: 1, loy: { C: 1 }, ach: 'ideas' }, fail: { tru: -2, mis: -1, why: 'Looked like you caved' } } },
    ] },
  { id: 'M23', title: 'WAKE ME UP LATER', sob: 'Standards · Motivation', icon: '💤', home: ['pp'],
    text: 'Middle of a wing exercise. {X:chief} knocks on a government truck\'s window and finds {B} asleep inside. {B} cracks the window: "Hey, can you wake me up later?" {X:chief} is now standing in YOUR office.',
    choices: [
      { t: 'Own it to {X:chief}, then handle {B}', mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -2 }, { tru: 1 }, { tru: 2, loy: { B: 1 }, ach: 'buck' } ] },
      { t: '"I\'ll make an example of {B}."', show: [['tru', '?'], ['mor', -2]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 1, mor: -3, loy: { B: -2 } }, fail: { mor: -3, tru: -1, loy: { B: -2 } } } },
      { t: 'Check the schedule: had they been up 20 hours?', show: [['mor', 1], ['tru', '?']], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mor', pass: { mor: 2, tru: 1, loy: { B: 1 } }, fail: { tru: -2, why: 'Sounded like excuses' } } },
      { t: 'Laugh it off with {X:chief}', show: [['mor', 1], ['tru', -2]], kind: 'fx',
        eff: { mor: 1, tru: -3 } },
    ] },
  { id: 'M24', title: 'THE WORST CALL', sob: 'Care for Airmen · Warning Signs', icon: '🕯️', off: true,
    text: 'OSI calls: an Airman in your squadron has been arrested in connection with the death of their spouse. Neighbors had reported concerns months ago. {C}: "Honestly... we all kind of knew something was off at home." Your flight is in shock.',
    choices: [
      { t: 'Say nothing and let OSI handle it', show: [['res', 1], ['mor', -2]], kind: 'fx',
        eff: { res: 1, mor: -3, next: { mor: -1, why: 'Rumors filled the silence' } } },
      { t: 'Gather the flight: facts only, bring in the chaplain and mental health', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: -1 }, { mor: 1 }, { mor: 2, tru: 1 } ] },
      { t: 'Cooperate fully with OSI; no speculating', show: [['tru', 1], ['mis', -1]], kind: 'fx',
        eff: { tru: 2, mis: -2, mor: -1 } },
      { t: 'Fix how warning signs get reported in your flight', show: [['tru', 1], ['mor', '?']], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'tru', pass: { tru: 1, mor: 1, mis: -1, loy: { C: 1 } }, fail: { mor: -2, mis: -1 } } },
    ] },
  /* ---------------- squadron pools (drafts, 2026-10-14) ---------------- */
  { id: 'M25', title: 'MISSING TOOL', sob: 'Integrity · Standards', icon: '🔧', home: ['wk'],
    text: "A torque wrench is missing from {A}'s tool kit after a launch. Everyone says it's probably somewhere in the shop. The next jet is cleared to taxi in 20 minutes.",
    choices: [
      { t: 'Ground the jet until the tool is found', show: [['mis', -2], ['tru', '?']], kind: 'check', pre: { ach: 'hardright' }, check: { stat: 'INS', dc: 13, m: 'tru', pass: { mis: -2, tru: 2 }, fail: { mis: -2, tru: -1 } } },
      { t: 'Sign it off as "lost in the shop" and launch', show: [['mis', 2], ['tru', '?']], kind: 'fx',
        eff: { mis: 2, next: { p: 0.5, mis: -3, tru: -3, why: 'The jet ingested the missing wrench' } } },
      { t: 'Everyone on a FOD walk, right now', show: [['mis', '?'], ['mor', 1]], kind: 'check', pre: { ach: 'hardright' },
        check: { stat: 'GRIT', dc: 13, m: 'mis', pass: { mis: 1, mor: 1 }, fail: { mis: -2, res: -1 } } },
      { t: 'Have {A} walk you through how the kit is controlled', mic: true, show: [['mis', 1], ['res', '?']], kind: 'stars', pre: { mis: -1, ach: 'hardright' },
        stars: [ { loy: { A: -1 } }, { mis: 1 }, { mis: 2, res: 1, loy: { A: 2 } } ] } ] },
  { id: 'M26', title: 'PHISHED', sob: 'Accountability · Reporting', icon: '🎣', home: ['pp'],
    text: '{B} clicked a phishing link on a government computer an hour ago and just told you. Nobody else knows. Cyber incident reports have a one-hour clock.',
    choices: [
      { t: 'Report it now and pull the machine', show: [['tru', '?'], ['mis', -1]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 1, mis: -1, loy: { B: -1 } }, fail: { mis: -1, tru: -1, loy: { B: -1 } } } },
      { t: 'Wait and see if anything happens', tags: ['late'], show: [['res', 1], ['tru', '?']], kind: 'fx', eff: { res: 1, next: { tru: -3, mis: -1, why: 'The breach surfaced on its own' } } },
      { t: 'Report it, then thank {B} in front of the flight for speaking up', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1 },
        stars: [ { loy: { B: -1 } }, { mor: 1 }, { mor: 2, loy: { B: 2 } } ] },
      { t: 'Trace what the link touched before you report', tags: ['late'], show: [['mis', '?'], ['tru', '?']], kind: 'check',
        check: { stat: 'INS', dc: 16, m: 'mis', pass: { mis: 2, tru: 1 }, fail: { tru: -2, mis: -1 } } } ] },
  { id: 'M27', title: 'NO LICENSE, NO FORKLIFT', sob: 'Standards · Safety', icon: '🏗️', home: ['sr'],
    text: "The cargo line is four hours behind. {B} isn't licensed on the forklift yet, but {A} says: \"Let them run it, I'll spot. Just this once.\"",
    choices: [
      { t: 'Let {B} drive with {A} spotting', show: [['mis', 2], ['tru', '?']], kind: 'check',
        check: { stat: null, dc: 11, m: 'mis', pass: { mis: 2, loy: { B: 1 } }, fail: { mis: -2, res: -2, tru: -2, why: 'A pallet went over' } } },
      { t: 'No license, no forklift: hand-carry and eat the delay', show: [['mis', -2], ['tru', 1]], kind: 'fx', eff: { mis: -2, tru: 1, mor: -1 } },
      { t: 'Borrow a licensed driver from another shift', show: [['mis', '?'], ['res', -2]], kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mis', pass: { mis: 1, res: -2, mor: -1 }, fail: { mor: -1, res: -2, mis: -1 } } },
      { t: 'Ask {A} why "just this once" keeps happening', mic: true, show: [['mor', '?'], ['mis', -1]], kind: 'stars', pre: { mis: -1 },
        stars: [ { loy: { A: -2 } }, { mor: 1 }, { mor: 2, mis: 1, loy: { A: 1 } } ] } ] },
  { id: 'M28', title: 'BLAME SUPPLY', sob: 'Articulating Ideas · Trust', icon: '🙄', home: ['sr'],
    text: "The wing missed a deadline. In the staff meeting, {X:peer}, another flight's commander, says it's because supply was late. It wasn't. Your CC is looking at you.",
    choices: [
      { t: 'Correct them on the spot, calmly, with facts', show: [['tru', '?']], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'tru', pass: { tru: 2 }, fail: { tru: -2, mor: 1 } } },
      { t: 'Let it go now; fix it with them one-on-one later', mic: true, show: [['tru', '?'], ['mor', 1]], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 2, mor: 1 } ] },
      { t: 'Quietly send your CC the delivery records', show: [['tru', '?'], ['res', -1]], kind: 'check', check: { stat: 'INS', dc: 13, m: 'tru', pass: { tru: 1, res: -1 }, fail: { res: -1, tru: -1 } } },
      { t: 'Fire back: "Maybe if you\'d submitted on time..."', show: [['mor', 1], ['tru', -2]], kind: 'fx', eff: { mor: 1, tru: -2 } } ] },
  { id: 'M29', title: 'SPILLAGE', sob: 'Integrity · Security', icon: '🧯', home: ['sa'],
    text: '{A} just realized they emailed a classified paragraph on the unclassified network an hour ago. Three people got it. {A} is pale.',
    choices: [
      { t: 'Report the spill now; security takes over', show: [['tru', 2], ['mis', -2]], kind: 'fx', eff: { tru: 2, mis: -2, res: -1, ach: 'hardright' } },
      { t: 'Have the three recipients delete it; no report', trap: true, show: [['mis', 1], ['mor', 1]], kind: 'fx', eff: { mis: 1, mor: 1, flag: 'COVERED_SPILL' } },
      { t: 'Report it, then stand by {A} through the investigation', mic: true, show: [['tru', 1], ['mor', '?']], kind: 'stars', pre: { tru: 1, mis: -1, ach: 'hardright' },
        stars: [ { loy: { A: -1 } }, { mor: 1, loy: { A: 1 } }, { mor: 2, loy: { A: 2 } } ] },
      { t: 'Report it + lock down the flight\'s email for a week', show: [['tru', '?'], ['mor', -2]], kind: 'check', pre: { ach: 'hardright' }, check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 1, mis: -1, mor: -2 }, fail: { mis: -1, mor: -2, tru: -1 } } } ] },
  { id: 'M30', title: "CAN'T SAY WHY", sob: 'Articulating Ideas · Integrity', icon: '🤫', home: ['sa'],
    text: "{CC} wants to know why your flight keeps working weekends. The real reason is a classified tasking {CC} isn't read into.",
    choices: [
      { t: 'Brief what you can and point to who can read them in', mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 2, mis: 1 } ] },
      { t: 'Give a plausible cover story', tags: ['late'], show: [['tru', 1]], kind: 'fx', eff: { tru: 1, next: { tru: -3, why: 'The CC found out the real story' } } },
      { t: 'Ask the program office to read {CC} in', show: [['tru', '?'], ['res', -1]], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'tru', pass: { tru: 2, res: -1 }, fail: { res: -1, tru: -1 } } },
      { t: 'Quietly shift the weekends onto {C}\'s section', show: [['mis', '?'], ['mor', -2]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'mis', pass: { mis: 1, mor: -2, loy: { C: -1 } }, fail: { mor: -2, mis: -1, loy: { C: -1 } } } } ] },
  { id: 'M31', title: 'THE OVERNIGHT FEED', sob: 'Care for Airmen · Warning Signs', icon: '🌙', home: ['sa'],
    text: "{B} has worked the overnight feed alone for three weeks. They've stopped going to the gym, stopped talking at lunch, and their reports are getting sloppy.",
    choices: [
      { t: 'Rotate the overnight shift across the flight', show: [['mor', '?'], ['mis', -1]], kind: 'check', check: { stat: 'GRIT', dc: 13, m: 'mor', pass: { mor: 1, mis: -1, loy: { B: 2 } }, fail: { mis: -1, mor: -1 } } },
      { t: 'Sit down with {B} and ask how they\'re really doing', mic: true, show: [['mor', '?'], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { mor: -1 }, { mor: 1, loy: { B: 1 } }, { mor: 2, mis: 1, loy: { B: 2 } } ] },
      { t: 'Write them up for the sloppy reports', show: [['mis', 1], ['mor', -2]], kind: 'fx', eff: { mis: 1, mor: -2, loy: { B: -2 } } },
      { t: 'Bring resiliency and mental health support to the whole flight', show: [['mor', '?'], ['res', -1]], kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 2, tru: 1, res: -1, loy: { B: 1 } }, fail: { res: -1, mor: -1 } } } ] },
  { id: 'M32', title: 'THE WALK-IN COOLER', sob: 'Integrity · Decision Making', icon: '🧊', home: ['ch'],
    text: "The DFAC walk-in cooler hit 50°F overnight. Breakfast for 400 Airmen starts in an hour using that food. Replacing it blows the month's budget.",
    choices: [
      { t: 'Toss it all; serve a cold breakfast', show: [['res', -2], ['tru', 1]], kind: 'fx', eff: { res: -3, mor: -1, tru: 1, ach: 'hardright' } },
      { t: "It's probably fine. Serve it.", trap: true, show: [['res', 1], ['mis', 1]], kind: 'fx', eff: { res: 1, mis: 1, flag: 'FOOD_SAFETY' } },
      { t: 'Check temps item by item; toss only what failed', show: [['res', '?'], ['mis', 1]], kind: 'check', pre: { ach: 'hardright' },
        check: { stat: 'INS', dc: 13, m: 'res', pass: { res: -1, mis: 1 }, fail: { res: -2, mor: -1 } } },
      { t: 'Call the commissary for an emergency buy', show: [['res', '?'], ['tru', 1]], kind: 'check', pre: { ach: 'hardright' },
        check: { stat: 'CHA', dc: 13, m: 'res', pass: { res: -1, mor: 1, tru: 1 }, fail: { res: -3 } } } ] },
  { id: 'M33', title: 'FOUR SECONDS', sob: 'Integrity · Standards', icon: '⏱️', home: ['ch'],
    text: '{B} is pulling a week as a fitness assessment cell augmentee. {X:msgt} is popular, up for promotion, and just failed the run by four seconds. {X:msgt.He} asks {B} to "round it." {B} comes to you.',
    choices: [
      { t: 'Back {B}: the score stands', show: [['tru', 1], ['mor', -1]], kind: 'fx', eff: { tru: 1, mor: -1, loy: { B: 1 }, ach: 'hardright' } },
      { t: "Round it. It's four seconds.", trap: true, show: [['mor', 1], ['tru', 1]], kind: 'fx', eff: { mor: 1, tru: 1, flag: 'FALSE_PT' } },
      { t: 'Talk to {X:msgt} yourself', mic: true, show: [['mor', '?'], ['tru', 1]], kind: 'stars', pre: { tru: 1, ach: 'hardright' },
        stars: [ { mor: -1 }, { mor: 1 }, { mor: 2, loy: { B: 1 } } ] },
      { t: 'Offer a supervised retest next week, by the book', show: [['mor', '?'], ['res', -1]], kind: 'check', pre: { ach: 'hardright' }, check: { stat: 'CMD', dc: 13, m: 'mor', pass: { mor: 1, tru: 1, res: -1 }, fail: { res: -1, mor: -1 } } } ] },
  { id: 'M34', title: 'DIRTY TOWELS', sob: 'Feedback · Root Cause', icon: '🛏️', home: ['ch'],
    text: "A visiting colonel's spouse complained to {X:wing}, the Wing CC, about the VIP suite. {X:wing.He} forwarded it to {CC} with one line: \"Fix this.\" {C} supervises the lodging front desk and is furious at the cleaning contractor, {X:contractor}.",
    choices: [
      { t: 'Apologize personally and comp the stay', mic: true, show: [['tru', '?'], ['res', -2]], kind: 'stars', stars: [{ res: -2, tru: -1 }, { tru: 2, res: -2 }, { tru: 3, res: -2 }] },
      { t: 'Let {C} handle it with {X:contractor}', show: [['tru', -1]], kind: 'fx', eff: { tru: -1, loy: { C: 1 } } },
      { t: 'Find the root cause first: housekeeping is down two people', show: [['mis', 2], ['tru', '?']], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, tru: 1 }, fail: { tru: -1, res: -1 } } },
      { t: 'Brief {CC} on what happened and the fix', mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 2, loy: { C: 1 } } ] } ] },
  { id: 'M35', title: 'CHRISTMAS SHIFT', sob: 'Fairness · Motivation', icon: '🎄', home: ['ch'],
    text: "Christmas Day. The DFAC has to open. Everyone with kids has asked for the day off. {A} volunteered again, after working the last three holidays.",
    choices: [
      { t: 'Let {A} take it again', show: [['mis', 1], ['mor', -1]], kind: 'fx', eff: { mis: 1, loy: { A: -1 }, traitAny: { slot: 'A', traits: ['burnout'], eff: { loy: { A: -1 } } } } },
      { t: 'Draw names out of a hat', show: [['mor', '?']], kind: 'check', check: { stat: null, dc: 13, m: 'mor', pass: { mor: 1, loy: { A: 1 } }, fail: { mor: -1 } } },
      { t: 'Work it yourselves, the leadership team', show: [['mor', '?'], ['tru', 1]], kind: 'check', check: { stat: 'GRIT', dc: 13, m: 'mor', pass: { mor: 2, tru: 1, res: -1 }, fail: { res: -1, mor: -1 } } },
      { t: 'Ask the flight to solve it together', mic: true, show: [['mor', '?']], kind: 'stars',
        stars: [ { mor: -1 }, { mor: 1 }, { mor: 3 } ] } ] },
  { id: 'M36', title: 'WHO TOUCHED MY CONFIG?', sob: 'Feedback · Accountability', icon: '🖧', home: ['pp'],
    text: "A network outage took down the wing's email for two hours. The change log shows {A} pushed a config change at 0200 without the required second check. {A} says it was urgent.",
    choices: [
      { t: 'Formal paperwork: the two-person rule is the rule', show: [['tru', '?'], ['mor', -1]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 1, mor: -1, loy: { A: -2 } }, fail: { mor: -1, tru: -1, loy: { A: -2 } } } },
      { t: 'Ask {A} what made it urgent at 0200', mic: true, show: [['mor', '?'], ['mis', 1]], kind: 'stars',
        stars: [ { loy: { A: -1 } }, { mis: 1, loy: { A: 1 } }, { mis: 2, loy: { A: 2 } } ] },
      { t: 'Fix the process: an on-call second checker at night', tags: ['idea'], show: [['mis', 2], ['res', -1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, res: -1 }, fail: { res: -2 } } },
      { t: 'Cover for {A} with the CC: "an equipment issue"', show: [['mor', 1], ['tru', '?']], kind: 'fx', eff: { mor: 1, loy: { A: 1 }, next: { tru: -2, why: 'The change log told a different story' } } } ] },

  /* ---------------- critical missions: each squadron's 💀 Elite stop ---------------- */
  { id: 'X1', title: 'JET DOWN BEFORE THE FLYOVER', sob: 'Decisions Under Pressure', icon: '✈️', home: ['wk'], critical: true,
    text: "1700: a hydraulic leak grounds a jet scheduled for tomorrow's wing flyover. Parts are two days out. {CC} promised the Wing a full formation.",
    choices: [
      { t: 'Pull the part from the hangar queen', show: [['mis', 2], ['res', -1]], kind: 'check',
        check: { stat: 'GRIT', dc: 13, m: 'mis', pass: { mis: 3, res: -1 }, fail: { mis: -2, res: -2, mor: -1 } } },
      { t: 'Tell {CC} tonight: we fly one short', mic: true, show: [['tru', '?'], ['mis', -1]], kind: 'stars', pre: { mis: -1 },
        stars: [ { tru: -2 }, { tru: 1 }, { tru: 3 } ] },
      { t: 'Sign the inspection complete to make the slot', trap: true, show: [['mis', 3]], kind: 'fx', eff: { mis: 3, flag: 'FALSE_INSPECTION' } },
      { t: 'Everyone works through the night', show: [['mis', 2], ['mor', -2]], kind: 'fx', eff: { mis: 2, mor: -3 } } ] },
  { id: 'X2', title: 'REAL WORLD, REAL WORLD', sob: 'Decisions Under Pressure', icon: '📻', home: ['gg'], critical: true,
    text: 'Mid-exercise, a real bomb threat comes in for the main gate. Half your Defenders think it is part of the scenario. The radio net is chaos.',
    choices: [
      { t: 'Call "REAL WORLD" and terminate the exercise', show: [['mis', '?'], ['tru', '?']], kind: 'check',
        check: { stat: 'CMD', dc: 13, m: 'mis', pass: { mis: 3, tru: 2 }, fail: { mis: -1, tru: -1 } } },
      { t: 'Keep the exercise running until you confirm', tags: ['late'], show: [['mis', -2], ['tru', -2]], kind: 'fx', eff: { mis: -2, tru: -2 } },
      { t: 'Run both: real-world response at the gate, exercise elsewhere', show: [['mis', '?']], kind: 'check',
        check: { stat: 'INS', dc: 16, m: 'mis', pass: { mis: 3, res: -1 }, fail: { mis: -3, mor: -2 } } },
      { t: 'Give {CC} calm, clear updates on the radio', mic: true, show: [['tru', '?'], ['mis', 1]], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1, mis: 1 }, { tru: 2, mis: 2 } ] } ] },
  { id: 'X3', title: 'RANSOMWARE AT 0400', sob: 'Decisions Under Pressure', icon: '💀', home: ['pp'], critical: true,
    text: "0400: ransomware hits the base network. Every screen shows a countdown. The wing's flying schedule lives on an infected server.",
    choices: [
      { t: 'Pull the plug on the whole network', show: [['mis', -2], ['tru', '?']], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'tru', pass: { mis: -2, tru: 2, res: -1 }, fail: { mis: -2, res: -1, tru: -1 } } },
      { t: 'Restore from backups (were they ever tested?)', show: [['mis', '?']], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 3 }, fail: { mis: -3, res: -2 } } },
      { t: 'Isolate infected servers one by one', show: [['mis', 2], ['mor', -1]], kind: 'check',
        check: { stat: 'GRIT', dc: 16, m: 'mis', pass: { mis: 2, mor: -1 }, fail: { mis: -2, mor: -2 } } },
      { t: "Brief wing leadership: what you know and don't know", mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -2 }, { tru: 1 }, { tru: 3 } ] } ] },
  { id: 'X4', title: 'NO-NOTICE DEPLOYMENT', sob: 'Readiness · Integrity', icon: '🧳', home: ['sr'], critical: true,
    text: 'Tasked: deploy 40 Airmen in 72 hours. Half the mobility bags are incomplete, and {X:nd1} and {X:nd2} show as non-deployable in the records.',
    choices: [
      { t: 'Mark everyone deployable; fix the records later', trap: true, show: [['mis', 3]], kind: 'fx', eff: { mis: 3, flag: 'FALSE_DEPLOY' } },
      { t: 'Report the real readiness number to {CC}', show: [['tru', 2], ['mis', -1]], kind: 'fx', eff: { tru: 2, mis: -1, ach: 'hardright' } },
      { t: 'Run a 24-hour processing line', show: [['mis', 2], ['res', -2]], kind: 'check', pre: { ach: 'hardright' },
        check: { stat: 'GRIT', dc: 13, m: 'mis', pass: { mis: 3, res: -2 }, fail: { mis: 1, res: -3, mor: -2 } } },
      { t: 'Borrow people from other units to fill the gaps', show: [['mis', '?'], ['tru', -1]], kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mis', pass: { mis: 2, tru: -1, res: -1 }, fail: { tru: -1, res: -1, mis: -1 } } } ] },
  { id: 'X5', title: 'THE TWO-STAR BRIEF', sob: 'Articulating Ideas · Courage', icon: '🎖️', home: ['sa'], critical: true,
    text: 'In three hours you brief {X:general}, a two-star, on a threat. {A}, your best analyst, says the assessment is wrong. {C} says there is no time to change it.',
    choices: [
      { t: 'Brief it as written', mic: true, show: [['mis', '?'], ['tru', '?']], kind: 'stars', pre: { next: { tru: -2, why: 'The assessment was wrong' } }, stars: [{ mis: -1, loy: { A: -2 } }, { mis: 1, loy: { A: -2 } }, { mis: 2, loy: { A: -2 } }] },
      { t: 'Rework it with {A} and brief it late', show: [['mis', '?'], ['tru', -1]], kind: 'check', check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, tru: -1, loy: { A: 2 } }, fail: { tru: -1, mis: -1 } }, tags: ['late'] },
      { t: 'Brief both views and your confidence level', mic: true, show: [['tru', '?'], ['mis', 1]], kind: 'stars',
        stars: [ { tru: -2 }, { tru: 1, mis: 1 }, { tru: 3, mis: 1, loy: { A: 1, C: 1 } } ] },
      { t: 'Let {C} decide; it is their product', show: [['tru', -1]], kind: 'fx', eff: { tru: -1, loy: { C: 1, A: -1 } } } ] },
  { id: 'X6', title: 'BASE-WIDE BLACKOUT', sob: 'Decisions Under Pressure · Care', icon: '🌩️', home: ['ch'], critical: true,
    text: 'A storm knocks out base power for three days. The DFAC has the only kitchen with a generator. 2,000 Airmen and families need meals, and lodging is full of stranded travelers.',
    choices: [
      { t: 'Run 24-hour meal service for everyone', show: [['mis', '?'], ['mor', -2]], kind: 'check', check: { stat: 'GRIT', dc: 13, m: 'mis', pass: { mis: 3, mor: -2, res: -2 }, fail: { mor: -2, res: -2, mis: -1 } } },
      { t: 'Feed mission-essential people only', show: [['mis', 1], ['mor', -2]], kind: 'fx', eff: { mis: 1, mor: -3, tru: -1 } },
      { t: "Partner with the chapel and spouses' club for volunteers", show: [['mor', '?'], ['mis', 1]], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 3, mis: 1 }, fail: { mor: -1, res: -1 } } },
      { t: "Brief {X:wing} on what you can and can't do", mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 3 } ] } ] },
];

/* ---------------- crisis events (a meter hit 0) ----------------
   A meter at 0 is a casualty, not a reset. The moment the current event is resolved, the crisis
   strikes: its loss is permanent (applied in the engine, see crisisLoss in app.js), then the team
   picks how to dig out. Every recovery costs something. A SECOND crisis = GAME OVER.
   loss   what the crisis takes from the team (shown on screen)
   death  per-squadron text for Mission Failure (what was destroyed / who was hurt) */
const CRISES = {
  mis: { title: 'MISSION FAILURE', icon: '💥', loss: `Every team item is lost in the fallout, and the IG already has the report: +${DIFFICULTY.crisisIgHp} IG HP at the inspection.`,
    death: {
      wk: 'A jet your flight released with an open write-up lost an engine on takeoff. The crew ejected; one is in the ICU. The aircraft is gone.',
      gg: 'A gate runner got onto the flightline through a post your flight left short-handed. A Defender was badly hurt stopping them.',
      pp: 'The base network went down during a real-world alert. The recall never went out, and the wing missed its response window.',
      sr: 'A fuel truck your flight kept running past its maintenance date caught fire on the ramp. A driver was burned and two trucks are gone.',
      sa: 'A threat report your flight sat on reached the deployed unit a day late. They drove into the area it warned about. People were hurt.',
      ch: 'The youth center your flight kept short-staffed ran a field trip with half the supervision it needed. A child was seriously hurt.',
    },
    choices: [
      { t: '"All hands, fix it now": nobody goes home', kind: 'fx', eff: { set: { mis: 3 }, mor: -3 } },
      { t: 'Brief the Wing CC yourself: what happened and the recovery plan', mic: true, kind: 'stars', pre: { set: { mis: 2 } }, stars: [ { tru: -3 }, { tru: -2 }, { tru: -1 } ] } ] },
  mor: { title: 'LOST AN AIRMAN', icon: '🕯️', loss: 'Every Unit member −1 loyalty. The flight will never be the same.', help: true,
    death: 'An Airman in your flight died by suicide. The warning signs were there: Morale hit zero, and nobody acted in time.',
    choices: [
      { t: 'Stand down for a day: chaplain, mental health and leadership walk the shop', kind: 'fx', eff: { set: { mor: 3 }, mis: -2, res: -2 } },
      { t: 'Hold a town hall: say it plainly, listen, and point everyone to help', mic: true, kind: 'stars', pre: { set: { mor: 2 } }, stars: [ { tru: -2, mis: -1 }, { mis: -1 }, { mor: 1 } ] } ] },
  tru: { title: 'RELIEVED OF COMMAND', icon: '🪓', loss: "The Flight Commander (or, with no FC, whoever holds the 👑) is FIRED: no votes, rolls, perk or 👑 for the rest of the game. The tie-break passes to the next cadet.",
    death: '{CC} calls you in: "I no longer have confidence in your flight commander." The Flight Commander is relieved, effective now.',
    choices: [
      { t: 'The acting lead briefs {CC} on a turnaround plan', mic: true, kind: 'stars', pre: { set: { tru: 2 } }, stars: [ { tru: -1, mor: -2 }, { mor: -2 }, { tru: 1, mor: -1 } ] },
      { t: 'Accept a babysitter from group (for 2 stops, every ⭐ gain is 1 less)', kind: 'fx', eff: { set: { tru: 3 }, mor: -2, flag: 'BABYSITTER' } } ] },
  res: { title: 'OUT OF GAS', icon: '⛽', loss: 'Your lowest-loyalty Unit member quits the unit for good, and every team item is gone.',
    death: 'The money and the people ran out at the same time. Shifts went uncovered, and someone finally walked out.',
    choices: [
      { t: 'Beg group for money and bodies', mic: true, kind: 'stars', stars: [ { set: { res: 2 }, tru: -3 }, { set: { res: 3 }, tru: -2 }, { set: { res: 3 }, tru: -1 } ] },
      { t: 'Cut a program and the people who run it', kind: 'fx', eff: { set: { res: 3 }, mis: -2, mor: -2 } } ] },
};
const CRISIS_HELP = 'If you or someone you know is struggling: call or text 988, then press 1 (Military / Veterans Crisis Line). You can also talk to a chaplain or Military OneSource (800-342-9647).';

/* ---------------- injects (Wheels of Failure / Meh / Success) ---------------- */
// Most injects come with a choice: the team votes on HOW to respond (options).
// tackle (Wheel of Failure only): a d20 + stat check instead. Pass = no loss; fail = tackle.fail.
const MURPHY = [
  { type: 'bad',   name: 'NETWORK DOWN', eff: {}, text: 'No email, no systems, all day.',
    tackle: { stat: 'INS', dc: 13, m: 'mis', fail: { mis: -1, mor: -1, res: -1, why: 'The workaround only half worked' } },
    options: [ { t: 'Wait for the comm squadron', eff: { res: -2 } }, { t: 'Go old-school: paper and runners', eff: { mis: -1, mor: -1 } } ] },
  { type: 'bad',   name: 'EMERGENCY LEAVE', eff: {}, special: 'leave', text: 'A family emergency: a random Unit member is out for 2 stops. They go no matter what; the question is how you cover.',
    tackle: { stat: 'GRIT', dc: 13, m: 'mis', fail: { mis: -2, why: 'The gap showed' } },
    options: [ { t: 'Approve it on the spot', eff: { mis: -2, mor: 1 } }, { t: 'Ask if it can wait a day', eff: { mis: -1, mor: -2, tru: -1 } } ] },
  { type: 'bad',   name: 'EXERCISE RECALL AT 0400', eff: {}, text: 'The phone tree lights up before dawn.',
    tackle: { stat: 'CMD', dc: 13, m: 'mor', fail: { mor: -1, tru: -1, res: -1, why: 'The recall was a mess' } },
    options: [ { t: 'Everyone shows up, no exceptions', eff: { mor: -2, mis: 1 } }, { t: 'Recall the essentials only', eff: { mor: -1, tru: -1 } } ] },
  { type: 'bad',   name: 'BUDGET CUT', eff: {}, text: 'Group just took 30% of your budget.',
    tackle: { stat: 'GRIT', dc: 13, m: 'res', fail: { res: -2, mis: -1, why: 'Not enough savings found' } },
    options: [ { t: 'Absorb it', eff: { res: -3 } }, { t: 'Cancel training to cover it', eff: { res: -1, mis: -2 } } ] },
  { type: 'bad',   name: 'PRIORITIES CHANGED', eff: {}, text: 'The CC wants something else now.',
    tackle: { stat: 'CMD', dc: 13, m: 'mis', fail: { mis: -1, mor: -1, res: -1, why: 'The re-plan came apart' } },
    options: [ { t: 'Drop everything and pivot', eff: { mis: -1, mor: -2 } }, { t: 'Push back with the CC', eff: { mis: -2, tru: -1 } } ] },
  { type: 'bad',   name: 'RUMOR MILL', eff: {}, text: '"I heard the whole flight is getting deployed."',
    tackle: { stat: 'INS', dc: 13, m: 'mor', fail: { mor: -1, res: -1, why: "You couldn't pin down the source" } },
    options: [ { t: 'Address it at roll call', eff: { res: -1, mor: -1 } }, { t: 'Ignore it', eff: { mor: -2, tru: -1 } } ] },
  { type: 'bad',   name: 'WEATHER GROUNDS EVERYTHING', eff: {}, text: 'Three days of storms.',
    tackle: { stat: 'GRIT', dc: 13, m: 'mis', fail: { mis: -1, res: -1, mor: -1, why: 'The weather won' } },
    options: [ { t: 'Wait it out', eff: { mis: -2 } }, { t: 'Pay overtime to catch up', eff: { res: -2, mor: -1 } } ] },
  { type: 'bad',   name: 'IG COMPLAINT FILED', eff: {}, text: 'Unfounded. Still a headache.',
    tackle: { stat: 'INS', dc: 13, m: 'tru', fail: { tru: -1, res: -2, why: 'The records were a mess' } },
    options: [ { t: 'Cooperate fully', eff: { tru: -1, res: -2 } }, { t: 'Find out who filed it', eff: { tru: -3, mor: -1, why: 'That looks like reprisal' } } ] },
  { type: 'mixed', name: 'PULLED INTO A MEETING',    eff: {}, special: 'meeting', text: "One random cadet is offline next stop: they can't speak or roll." },
  { type: 'mixed', name: "THE CC'S PET PROJECT", eff: {}, text: 'The CC wants volunteers for their new initiative.',
    options: [ { t: 'Take it on', eff: { tru: 2, res: -2 } }, { t: 'Politely decline', eff: { tru: -1, res: 1 } } ] },
  { type: 'mixed', name: 'QUICK FAVOR',              eff: {}, special: 'favor', text: 'Another unit wants to borrow your best hand ({A}) for a few days.',
    options: [ { t: 'Accept: {A} is out 1 stop', eff: { tru: 1, loy: { A: 1 } } }, { t: 'Decline', eff: { mis: 1, tru: -1 } } ] },
  { type: 'mixed', name: 'SURPRISE TASKER', eff: {}, text: 'Due tomorrow.',
    options: [ { t: 'All hands tonight', eff: { mis: 2, mor: -2 } }, { t: 'Ask for an extension', eff: { tru: -1, mis: -1 } } ] },
  { type: 'mixed', name: 'SHORT-NOTICE VIP TOUR', eff: {}, text: '{X:general} tours your work area tomorrow morning.',
    options: [ { t: 'Polish everything overnight', eff: { tru: 2, mor: -2 } }, { t: 'Show the real work, warts and all', eff: { tru: 1, mor: 1, mis: -1 } } ] },
  { type: 'mixed', name: 'MANDATORY FUN DAY', eff: {}, text: 'Wing-wide sports day. On a workday.',
    options: [ { t: 'Everyone goes', eff: { mor: 2, mis: -2 } }, { t: 'Send a small team; keep the shop running', eff: { mis: 1, mor: -1, tru: -1 } } ] },
  { type: 'good',  name: 'YEAR-END MONEY', eff: {}, text: 'Use it or lose it!',
    options: [ { t: 'Bank it', eff: { res: 3 } }, { t: 'Spend it on the troops', eff: { res: 1, mor: 2 } } ] },
  { type: 'good',  name: 'WING CC SHOUT-OUT', eff: {}, text: '{X:wing}, the Wing CC, praises your flight in the staff meeting.',
    options: [ { t: 'Take the credit', eff: { tru: 2, mor: -1 } }, { t: 'Credit your Airmen by name', eff: { tru: 1, mor: 2 } } ] },
  { type: 'good',  name: 'THE IDEA WORKED', eff: {}, text: "Last month's process fix just cut the backlog in half.",
    options: [ { t: 'Scale it up across the flight', eff: { mis: 3, res: -1 } }, { t: 'Credit {A}, who thought of it', eff: { mis: 1, mor: 1, loy: { A: 2 } } } ] },
  { type: 'good',  name: 'GREAT FAMILY DAY', eff: {}, text: 'Perfect weather for the squadron picnic.',
    options: [ { t: 'Leadership cooks', eff: { mor: 3, res: -1 } }, { t: 'Invite the CC', eff: { mor: 1, tru: 2 } } ] },
  { type: 'good',  name: 'BELOW THE ZONE', eff: {}, text: '{A} was just selected for early promotion.',
    options: [ { t: 'Celebrate it at roll call', eff: { mor: 2, loy: { A: 1 } } }, { t: "Make {A} the flight's new trainer", eff: { mis: 2, loy: { A: 2 } } } ] },
  { type: 'good',  name: 'CONTRACTOR FINISHES EARLY', eff: {}, text: 'The building renovation wrapped up two weeks ahead of schedule.',
    options: [ { t: 'Move in now', eff: { mis: 2, mor: 1 } }, { t: 'Return the unused contract money', eff: { res: 2, tru: 1 } } ] },
];
// After every other stop (DIFFICULTY.injectEvery) a d6 picks which wheel spins (DIFFICULTY.injectOdds); the wheel only holds that type.
const INJECT_WHEELS = {
  bad:   { name: 'WHEEL OF FAILURE', icon: '💥', color: '#ff5d5d' },
  mixed: { name: 'WHEEL OF MEH',     icon: '🤷', color: '#ffd23f' },
  good:  { name: 'WHEEL OF SUCCESS', icon: '🍀', color: '#7dff6b' },
};
const INJECT_ORDER = ['bad', 'mixed', 'good']; // d6 faces, low to high
function injectTypeFor(d6) { let n = d6; for (const t of INJECT_ORDER) { n -= DIFFICULTY.injectOdds[t]; if (n <= 0) return t; } return 'good'; }
function injectRange(t) { let lo = 1; for (const k of INJECT_ORDER) { const hi = lo + DIFFICULTY.injectOdds[k] - 1; if (k === t) return lo === hi ? `${lo}` : `${lo}-${hi}`; lo = hi + 1; } return ''; }

/* ---------------- GM cards ---------------- */
const GM_CARDS = [
  { id: 'curveball', name: 'THE CURVEBALL',     text: 'Force an extra inject right now' },
  { id: 'loaded',    name: 'LOADED DICE',       text: 'Raise or lower the next check target by 3' },
  { id: 'clock',     name: "CLOCK'S TICKING",   text: 'Next decision gets a 15-second shot clock' },
  { id: 'complaint', name: 'OPEN DOOR COMPLAINT', text: 'One Unit member loses 2 loyalty (you pick who)' },
  { id: 'gift',      name: 'GIFT FROM ABOVE',   text: 'Grant a free loot spin' },
  { id: 'silent',    name: 'SILENT RUNNING',    text: "The Flight Commander can't speak for the next choice" },
  { id: 'twist',     name: 'PLOT TWIST',        text: 'Secretly swap the effects of two choices on this mission' },
  { id: 'second',    name: 'SECOND CHANCE',     text: 'Undo the last action' },
];

/* ---------------- loot ----------------
   Each run's loot pool = the 4 generic items + the squadron's own 4 (home). Every item in the pool is
   equally likely, and an item leaves the pool once it drops (no repeats in a run).
   use.type: check {n}  = +n on the next d20 check (armed before the roll)
             star       = +1 star on a 🎤 encounter (armed before the rating)
             meter {eff}= applied right away (can include loy)
             anyMeter {n} = +n to a meter the team picks
             loyAll {d} = every Unit member +d loyalty · loyOne {d} = one Unit member the team picks
             cancel     = cancel a Wheel of Failure result after it lands
             wheel      = skip the inject d6 and pick the wheel (Meh or Success)
             intel      = see the exact effects of every choice on this mission
             recharge   = recharge a used class ability or perk
             branch     = on the route map, the next stop can be ANY stop in the next column
             undo       = undo the decision you just made */
const LOOT = [
  // generic: any squadron
  { id: 'coffee',   icon: '☕', name: 'Bottomless Coffee', text: '+2 on one check', use: { type: 'check', n: 2 } },
  { id: 'coin',     icon: '🪙', name: "Commander's Coin", text: '+3 to any one meter', use: { type: 'anyMeter', n: 3 } },
  { id: 'doover',   icon: '🔄', name: 'Do-Over', text: 'Undo the decision you just made', use: { type: 'undo' } },
  { id: 'wind',     icon: '🔋', name: 'Second Wind', text: 'Recharge a used ability or perk', use: { type: 'recharge' } },
  { id: 'deocs',    icon: '📋', name: 'DEOCS Survey', text: `See the exact meter values for the next ${DIFFICULTY.deocsStops} stops`, use: { type: 'deocs' } },
  { id: 'branch',   icon: '🌿', name: 'Branch Plan', text: 'On the route map, move to ANY stop in the next column, even off your path', use: { type: 'branch' } },
  // 4th AMXS
  { id: 'rhythm',   icon: '📋', name: 'Battle Rhythm', home: ['wk'], text: 'Skip the inject d6: pick the Wheel of Meh or Success', use: { type: 'wheel' } },
  { id: 'torque',   icon: '🔧', name: 'Calibrated Torque Wrench', home: ['wk'], text: '+3 on one check', use: { type: 'check', n: 3 } },
  { id: 'cannibal', icon: '🧰', name: 'Cannibalized Part', home: ['wk'], text: '+3 📦', use: { type: 'meter', eff: { res: 3 } } },
  { id: 'patch',    icon: '🎖️', name: 'Crew Chief Patch Ceremony', home: ['wk'], text: '+2 ❤️ and {A} +1 loyalty', use: { type: 'meter', eff: { mor: 2, loy: { A: 1 } } } },
  // 56th SFS
  { id: 'armor',    icon: '🦺', name: 'Body Armor', home: ['gg'], text: 'Cancel a Wheel of Failure result', use: { type: 'cancel' } },
  { id: 'mwd',      icon: '🐕', name: 'Military Working Dog Team', home: ['gg'], text: '+3 on one check', use: { type: 'check', n: 3 } },
  { id: 'dotq',     icon: '🏅', name: 'Defender of the Quarter', home: ['gg'], text: 'One Unit member +3 loyalty', use: { type: 'loyOne', d: 3 } },
  { id: 'midshift', icon: '🍕', name: 'Mid-Shift Pizza', home: ['gg'], text: '+2 ❤️', use: { type: 'meter', eff: { mor: 2 } } },
  // 6th CS
  { id: 'firewall', icon: '🧱', name: 'Firewall', home: ['pp'], text: 'Cancel a Wheel of Failure result', use: { type: 'cancel' } },
  { id: 'helpdesk', icon: '📟', name: 'Help Desk Hero', home: ['pp'], text: '+1 star on a 🎤 encounter', use: { type: 'star' } },
  { id: 'script',   icon: '🤖', name: 'Automation Script', home: ['pp'], text: 'Skip the inject d6: pick the Wheel of Meh or Success', use: { type: 'wheel' } },
  { id: 'server',   icon: '🖥️', name: 'Spare Server', home: ['pp'], text: '+3 🎯', use: { type: 'meter', eff: { mis: 3 } } },
  // 92nd LRS
  { id: 'pallet',   icon: '📦', name: 'Pallet of Spares', home: ['sr'], text: '+3 📦', use: { type: 'meter', eff: { res: 3 } } },
  { id: 'priority', icon: '🚚', name: 'Priority Shipping', home: ['sr'], text: 'Skip the inject d6: pick the Wheel of Meh or Success', use: { type: 'wheel' } },
  { id: 'vendor',   icon: '📇', name: 'Vendor Contact', home: ['sr'], text: 'Cancel a Wheel of Failure result', use: { type: 'cancel' } },
  { id: 'forklift', icon: '🏗️', name: 'Forklift Certified', home: ['sr'], text: '+3 on one check', use: { type: 'check', n: 3 } },
  // 7th IS
  { id: 'currint',  icon: '🔎', name: 'Current Intel', home: ['sa'], text: 'See the exact effects of every choice on this mission', use: { type: 'intel' } },
  { id: 'source',   icon: '🗂️', name: 'Source Network', home: ['sa'], text: '+3 on one check', use: { type: 'check', n: 3 } },
  { id: 'deck',     icon: '📊', name: 'Perfect Slide Deck', home: ['sa'], text: '+2 ⭐', use: { type: 'meter', eff: { tru: 2 } } },
  { id: 'scif',     icon: '🔐', name: 'SCIF Access', home: ['sa'], text: 'Cancel a Wheel of Failure result', use: { type: 'cancel' } },
  // 55th FSS
  { id: 'pizza',    icon: '🍕', name: 'Pizza Fund', home: ['ch'], text: '+2 ❤️', use: { type: 'meter', eff: { mor: 2 } } },
  { id: 'tickets',  icon: '🎟️', name: 'Event Tickets', home: ['ch'], text: 'Every Unit member +1 loyalty', use: { type: 'loyAll', d: 1 } },
  { id: 'lodging',  icon: '🏨', name: 'Lodging Upgrade', home: ['ch'], text: '+2 ⭐', use: { type: 'meter', eff: { tru: 2 } } },
  { id: 'fivestar', icon: '⭐', name: 'Five-Star Comment Card', home: ['ch'], text: '+1 star on a 🎤 encounter', use: { type: 'star' } },
];
const lootColor = l => (l.home ? UNITS.find(u => u.id === l.home[0]).color : '#ffd23f');

/* ---------------- fumble wheel (natural 1) ---------------- */
// special: wrongname = a random Unit member −1 loyalty · cac = the roller is offline next stop
//          chief = +1 ❤️ if the party has a Senior Enlisted Leader (they told the story at roll call)
const FUMBLES = [
  { name: 'REPLY ALL',              text: 'You emailed the whole wing by accident.', eff: { tru: -1 } },
  { name: 'MUTED ON TEAMS',         text: 'The entire meeting. Nobody heard a word.', eff: { mis: -1 } },
  { name: 'COFFEE ON THE KEYBOARD', text: 'RIP keyboard, and the budget for a new one.', eff: { res: -1 } },
  { name: 'WRONG NAME',             text: 'You called an Airman by the wrong name. In front of everyone.', eff: { mor: -1 }, special: 'wrongname' },
  { name: 'FORGOT YOUR CAC',        text: 'Left it in the computer. Again. Locked out until you get a new one: offline next stop.', eff: {}, special: 'cac' },
  { name: 'SAVED BY THE CHIEF',     text: 'The Chief caught it before anyone noticed. No harm done.', eff: {}, special: 'chief' },
];

/* ---------------- unknown node ---------------- */
const MYSTERY = [
  { id: 'crisis', name: 'SCENARIO',      icon: '⚔️', color: '#ff5d5d' },
  { id: 'elite',  name: 'ELITE SCENARIO', icon: '💀', color: '#c36bff' },
  { id: 'loot',   name: 'FREE LOOT',     icon: '🎁', color: '#ffd23f' },
  { id: 'bad',    name: 'BAD INJECT',    icon: '💥', color: '#ff9f43' },
  { id: 'good',   name: 'GOOD INJECT',   icon: '🍀', color: '#7dff6b' },
  { id: 'wing',   name: 'WING CC VISIT', icon: '🦅', color: '#3fd8ff' },
];
const WING_VISIT = { title: 'WING CC VISIT', icon: '🦅', sob: 'Articulating Ideas Clearly',
  text: '{X:wing}, the Wing Commander, drops in unannounced: "Tell me about your flight. What are you proud of, and what keeps you up at night?"',
  choices: [ { t: 'Give {X:wing} the 60-second tour', mic: true, kind: 'stars', stars: [ { tru: -1 }, { tru: 1, mor: 1 }, { tru: 3, mor: 1 } ] } ] };

/* ---------------- spotlight stops (🔦) ----------------
   When the party reaches a 🔦 stop, a wheel picks a cadet who hasn't been spotlighted yet,
   and they get their class's scenario. They decide ALONE and in silence: only their phone gets the buttons, and their
   checks use their own stat. A class not in the party never gets its spotlight.
   Same choice format as missions. */
const SPOTLIGHTS = [
  { id: 'SP_fc', cls: 'fc', title: 'ONE NOMINATION', icon: '🏅', sob: 'Spotlight · Recognition',
    text: 'Airman of the Quarter is due tomorrow and the flight gets ONE nomination in the Airman category. {D} carried the section\'s workload all quarter; {B}, three months on station, finished their CDCs early and logged 60 volunteer hours. The flight is watching.',
    choices: [
      { t: 'Nominate {D}: the numbers speak', show: [['mis', 1], ['mor', '?']], kind: 'fx', eff: { mis: 1, loy: { D: 2, B: -1 } } },
      { t: 'Nominate {B}: initiative is the mission', show: [['mor', '?'], ['mis', '?']], kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 1, loy: { B: 2, D: -1 } }, fail: { mor: -1, loy: { D: -1 } } } },
      { t: 'Write both packages and let the CC pick', show: [['tru', '?'], ['res', -1]], kind: 'check', pre: { res: -1 },
        check: { stat: 'CMD', dc: 13, m: 'tru', pass: { tru: 2, loy: { D: 1, B: 1 } }, fail: { tru: -1 } } },
      { t: 'Tell them both in person why, before it posts', mic: true, show: [['mor', '?']], kind: 'stars',
        stars: [ { loy: { D: -1, B: -1 } }, { mor: 1 }, { mor: 2, loy: { D: 1, B: 1 } } ] } ] },
  { id: 'SP_chief', cls: 'chief', title: 'OUT OF STANDARDS', icon: '🎖️', sob: 'Spotlight · Standards',
    text: "Outside wing HQ you see {B}: hands in pockets, uniform a mess, on the phone, just as the Wing CC, {X:wing}, pulls up. Everyone nearby is watching what the Chief does.",
    choices: [
      { t: 'Quiet on-the-spot correction, then move on', show: [['mis', 1], ['mor', '?']], kind: 'check',
        check: { stat: 'CMD', dc: 13, m: 'mor', pass: { mis: 1, loy: { B: 1 } }, fail: { loy: { B: -1 } } } },
      { t: 'Loud public correction: everyone learns', show: [['mis', '?'], ['mor', -1]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'mis', pass: { mis: 1, mor: -1, loy: { B: -2 } }, fail: { mor: -1, mis: -1, loy: { B: -2 } } } },
      { t: "Pretend you didn't see it", show: [['tru', -1]], kind: 'fx', eff: { tru: -2, mis: -1 } },
      { t: 'Later: sit down with {B} and their supervisor {A}', mic: true, show: [['mor', 1], ['res', -1]], kind: 'stars', pre: { res: -1 },
        stars: [ { loy: { B: -1 } }, { mor: 1, loy: { B: 1 } }, { mor: 1, mis: 1, loy: { B: 2, A: 1 } } ] } ] },
  { id: 'SP_shirt', cls: 'shirt', title: '0200 PHONE CALL', icon: '📞', sob: 'Spotlight · Care for Airmen',
    text: 'Your phone rings at 0200. {B} slid into a ditch two hours away: not hurt, car stuck, phone at 10%, and due on shift at 0700. They called YOU.',
    choices: [
      { t: "Drive out yourself (you'll be wrecked tomorrow)", show: [['mor', 2], ['mis', -2]], kind: 'fx', eff: { mor: 2, mis: -2, res: -1, loy: { B: 2 }, offlineSelf: true } },
      { t: "Wake {B}'s wingman and coordinate a pickup", show: [['mor', 1], ['mis', '?']], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'mor', pass: { mor: 1, mis: 1, loy: { B: 1 } }, fail: { mor: -1, mis: -1 } } },
      { t: 'Talk them through calling a tow; see them at 0700', show: [['mis', '?'], ['mor', -1]], kind: 'check', check: { stat: 'CHA', dc: 13, m: 'mis', pass: { mis: 1, loy: { B: -1 } }, fail: { mis: -1, loy: { B: -1 } } } },
      { t: 'Excuse them from shift; sort it out in the morning', show: [['mor', '?'], ['mis', -1]], kind: 'check', check: { stat: 'CMD', dc: 13, m: 'mor', pass: { mor: 1, mis: -1, loy: { B: 1 } }, fail: { mis: -1, mor: -1 } } } ] },
  { id: 'SP_xo', cls: 'xo', title: 'THE NUMBERS', icon: '📈', sob: 'Spotlight · Integrity',
    text: '{CC} calls you in alone: "The wing brief is in an hour and our readiness chart looks weak. You built it. Can it look better?" You know "better" means counting things that don\'t count.',
    choices: [
      { t: 'Tweak the chart. It\'s what the boss wants.', trap: true, show: [['tru', 2]], kind: 'fx', eff: { tru: 2, flag: 'INFLATED_METRIC' } },
      { t: 'Show the real numbers and the plan to fix them', mic: true, show: [['tru', '?']], kind: 'stars', pre: { ach: 'hardright' },
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 2, mis: 1 } ] },
      { t: "Find what's genuinely improving and sell it", show: [['tru', '?']], kind: 'check',
        check: { stat: 'CHA', dc: 13, m: 'tru', pass: { tru: 2 }, fail: { tru: -1 } } },
      { t: 'Ask {C} to brief it instead', show: [['tru', -1]], kind: 'fx', eff: { tru: -1, loy: { C: -1 } } } ] },
  { id: 'SP_utm', cls: 'utm', title: 'PENCIL WHIP', icon: '📚', sob: 'Spotlight · Integrity',
    text: "The wing's training inspection is Friday. {B} is three tasks short on their 5-level upgrade, and their supervisor {C} asks you to just sign the tasks off in the training system: \"They can do it. We'll train it next month.\"",
    choices: [
      { t: 'Sign them off. {B} really can do the work.', trap: true, show: [['mis', 2]], kind: 'fx', eff: { mis: 2, flag: 'PENCIL_WHIP' } },
      { t: 'Run a hands-on training blitz this week', show: [['mis', '?'], ['mor', -1]], kind: 'check',
        check: { stat: 'GRIT', dc: 13, m: 'mis', pass: { mis: 2, mor: -1, loy: { B: 1 } }, fail: { mor: -1, mis: -1 } } },
      { t: 'Brief {CC} on the gap and a get-well date', mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 2, mis: 1 } ] },
      { t: 'Make {C} the trainer and put the plan in writing', show: [['mis', 1], ['res', -1]], kind: 'check', pre: { res: -1 },
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 1, loy: { B: 1, C: 1 } }, fail: { loy: { C: -1 } } } } ] },
  { id: 'SP_plans', cls: 'plans', title: 'WRITE THE EXERCISE', icon: '🗂️', sob: 'Spotlight · Planning',
    text: "Wing asked YOU to write next week's readiness exercise. You know exactly where your own flight is weakest. Nobody would know if you went easy.",
    choices: [
      { t: 'Write it to hit your own weak spot hard', show: [['mis', '?'], ['mor', -1]], kind: 'check', check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 1, mor: -1, next: { mis: 2, why: 'Exercise lessons learned' } }, fail: { mor: -1, mis: -1 } } },
      { t: 'Write an easy one: the flight needs a win', show: [['mor', 1], ['tru', '?']], kind: 'fx', eff: { mor: 1, tru: -1 } },
      { t: "Build it with {C} and the people who'll run it", show: [['mis', 1], ['mor', 1]], kind: 'check',
        check: { stat: 'INS', dc: 13, m: 'mis', pass: { mis: 2, mor: 1, loy: { C: 1 } }, fail: { res: -1 } } },
      { t: 'Brief the CC on the weak spot before the exercise', mic: true, show: [['tru', '?']], kind: 'stars',
        stars: [ { tru: -1 }, { tru: 1 }, { tru: 2, mis: 1 } ] } ] },
];

/* ---------------- node types ---------------- */
const NODE_TYPES = {
  crisis:  { icon: '⚔️', name: 'SCENARIO',     color: '#ff5d5d' },
  elite:   { icon: '💀', name: 'ELITE',        color: '#c36bff' },
  rest:    { icon: '🏕️', name: 'REST STOP',    color: '#7dff6b' },
  depot:   { icon: '🛒', name: 'BASE EXCHANGE (BX)', color: '#3fd8ff' },
  unknown: { icon: '❓', name: 'UNKNOWN',      color: '#ffd23f' },
  spot:    { icon: '🔦', name: 'SPOTLIGHT',    color: '#3fd8ff' },
  boss:    { icon: '👹', name: 'INSPECTOR GENERAL', color: '#ff2e63' },
};

/* ---------------- boss ---------------- */
const BOSS = { name: 'LT COL CACIC', title: 'THE INSPECTOR GENERAL', hp: DIFFICULTY.bossHp };
// Three rounds. Each round the IG telegraphs an attack on the lowest of its target meters
// (DIFFICULTY.bossAttack); round 2 starts with the hot-seat interview.
const BOSS_ROUNDS = [
  { name: 'THE AUDIT',          icon: '📋', atk: 'RECORDS REVIEW',  targets: ['tru', 'res'] },
  { name: 'THE INTERVIEW',      icon: '🎤', atk: 'HARD QUESTIONS',  targets: ['mor', 'tru'] },
  { name: 'NO-NOTICE EXERCISE', icon: '🚨', atk: 'EXERCISE INJECT', targets: ['mis', 'mor'] },
];
const BOSS_QUESTIONS = [
  'Walk me through how your Airmen know what is expected of them.',
  'Tell me about the last time you gave someone hard feedback.',
  "Who's responsible when a task you delegated fails?",
  'How do you know your people are motivated, and not just compliant?',
  "What's an idea from a junior Airman you actually implemented?",
  'Tell me about a time you had to choose between the mission and doing the right thing.',
];
const TRAP_FLAGS = ['FALSIFIED_RECORDS', 'COVERED_UP', 'FALSE_RECEIPT', 'HID_DUI', 'IGNORED_FIGHT', 'FALSE_MISHAP', 'FALSE_ARMORY', 'COVERED_DV', 'INFLATED_METRIC', 'OFF_BOOKS', 'SPLIT_PURCHASE',
  'COVERED_SPILL', 'FOOD_SAFETY', 'FALSE_PT', 'FALSE_INSPECTION', 'FALSE_DEPLOY', 'PENCIL_WHIP'];
const FLAG_TEXT = {
  FALSIFIED_RECORDS: 'Falsified training records (M2)',
  COVERED_UP: 'Covered up an OPSEC incident (M6)',
  FALSE_RECEIPT: 'Signed a false receipt (M8)',
  HID_DUI: 'Hid a DUI arrest from the commander (M13)',
  IGNORED_FIGHT: 'Ignored a known fight club with injuries (M15)',
  FALSE_MISHAP: 'Falsified a vehicle mishap report (M17)',
  FALSE_ARMORY: 'Altered an armory log after a weapons incident (M18)',
  COVERED_DV: 'Covered up a domestic violence report (M19)',
  INFLATED_METRIC: 'Inflated the readiness chart for the wing brief (XO spotlight)',
  OFF_BOOKS: 'Put a BX shopping run on the unit GPC card with no paperwork',
  SPLIT_PURCHASE: 'Split a purchase to dodge the approval limit (RA spotlight)',
  PENCIL_WHIP: 'Signed off upgrade training tasks that were never trained (UTM spotlight)',
  COVERED_SPILL: 'Hid a classified spillage (M29)',
  FOOD_SAFETY: 'Served food from a failed cooler (M32)',
  FALSE_PT: 'Altered a fitness test score (M33)',
  FALSE_INSPECTION: 'Signed off an inspection that was never done (Maintenance critical)',
  FALSE_DEPLOY: 'Falsified deployment readiness records (LRS critical)',
};

/* ---------------- achievements ----------------
   pts = what each is worth in the score. Luck (a natural 20) and surviving failure (Crisis Events)
   are still celebrated but score 0: points go to things a team did on purpose. */
const ACHIEVEMENTS = [
  { id: 'buck',      icon: '🫡', pts: 10, name: 'Buck Stops Here',            text: 'Took ownership instead of passing blame' },
  { id: 'hardright', icon: '⚖️', pts: 10, name: 'Hard Right Over Easy Wrong', text: 'Refused an integrity trap' },
  { id: 'clearcomms', icon: '📣', pts: 10, name: 'Clear Comms',               text: 'Earned 3⭐ on a 🎤 encounter' },
  { id: 'opendoor',  icon: '🚪', pts: 15, name: 'Open Door',                  text: 'Had 2+ Unit members as Allies at once' },
  { id: 'ideas',     icon: '💡', pts: 10, name: 'Ideas Welcome',              text: "Adopted or piloted a subordinate's idea" },
  { id: 'balanced',  icon: '⚖️', pts: 25, name: 'Balanced Leader',            text: 'Finished with every meter at 5+' },
  { id: 'crit',      icon: '🎲', pts: 0, name: 'Critical Hit',               text: 'Rolled a natural 20' },
  { id: 'nobody',    icon: '🤝', pts: 5, name: 'Nobody Left Behind',         text: 'No Unit member ever dropped to loyalty 0', hidden: true },
  { id: 'flawless',  icon: '💎', pts: 25, name: 'Flawless Inspection',        text: 'Beat the IG without an IG attack dropping a meter below 3', hidden: true },
  { id: 'servant',   icon: '🙌', pts: 15, name: 'Servant Leader',             text: 'Every 🎤 encounter earned 2⭐+', hidden: true },
];
const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/* ---------------- grades ----------------
   Tuned with sim.js (800 simulated runs): a team that never uses its tools reaches B about 4% of
   the time; a team that boosts, uses items/perks/abilities and plays the IG well reaches B about
   half the time, A about 15%, S about 3%. Good decisions on top of that push teams higher. */
const GRADES = [
  { g: 'S', min: 310, title: 'LEGENDARY LEADERSHIP', strat: '"My #1 of 25 Lieutenants! Promote ahead of peers, send to SOS in residence!"', color: '#ffd23f' },
  { g: 'A', min: 265, title: 'ELITE FLIGHT',         strat: '"#3 of 25. Top 10% officer; ready for squadron-level responsibility now."', color: '#7dff6b' },
  { g: 'B', min: 200, title: 'MISSION READY',        strat: '"#8 of 25. Top third; give this officer more responsibility."', color: '#3fd8ff' },
  { g: 'C', min: 140, title: 'STILL LEVELING UP',    strat: '"#14 of 25. Solid officer; continue to develop."', color: '#cfd8e3' },
  { g: 'D', min: -999, title: 'NEEDS A RESPAWN',     strat: '"Bottom third. Meets standards." (we all know what that means)', color: '#ff9f43' },
];
const GAME_OVER_TEXT = 'RELIEVED OF COMMAND FOR CAUSE (FAILURE TO MAINTAIN CONFIDENCE OF LEADERSHIP)';

/* ---------------- intro screens (shown before class select) ---------------- */
const INTRO_STEPS = [
  ['🧑‍✈️', 'You are a leadership team', 'Your party runs a flight in a squadron you choose. You win or lose TOGETHER against the scenario (and the GM).'],
  ['🗺️', 'Follow the route', 'Travel the stops on the route map (5 to 7, set by the GM), then face the final boss: the Inspector General.'],
  ['🔀', 'Make choices', 'Every choice helps some meters and hurts others. You can never max them all, so balance them.'],
  ['🎲', 'Roll the dice', 'Risky choices need a d20 roll plus your stat. The team votes on who rolls.'],
  ['🎤', 'Act it out', 'Some choices make you play the scene. A wheel picks who talks; the GM plays the other side and rates you 1-3 stars.'],
  ['🎡', 'Injects every other stop', 'After every other stop a d6 picks the Wheel of Failure, Meh or Success. Your squadron also has a weak spot that keeps draining. You vote on how to respond.'],
];
const INTRO_WIN = 'WIN: keep all 4 meters balanced (your WEAKEST meter counts most), beat the IG, earn achievements. Top 3 teams on the leaderboard earn extra credit.';
const INTRO_LOSE = 'LOSE: one integrity violation = instant GAME OVER. A meter at zero = a Crisis Event (a lost Airman, a fired leader, a failed mission). A second Crisis Event = GAME OVER. No respawns.';
// READING THE SCREEN (intro page 3): only the two things that matter most
const INTRO_METERS = {
  mis: 'Is the job getting done?',
  mor: 'Are your people motivated and heard?',
  tru: 'Does your commander have confidence in you?',
  res: 'Budget, people-hours, time, supplies',
};
const INTRO_FOG = `You won't see exact numbers. Each meter shows STRONG, STEADY or DANGER. At ${DIFFICULTY.dangerAt} or lower it flashes red: fix it fast. Run a 📋 DEOCS Survey (First Sergeant perk, or an item) to see the real numbers.`;
const INTRO_INTEGRITY = 'Lie, cover up, fudge a record or skip the paperwork, and the IG finds out. One integrity violation = GAME OVER.';
// Full legend: the Field Guide (guide.html)
const LEGEND = [
  ['🎯', 'MISSION', 'Is the job getting done?'],
  ['❤️', 'MORALE', 'Are your people motivated and heard?'],
  ['⭐', 'TRUST', 'Does your commander have confidence in you?'],
  ['📦', 'RESOURCES', 'Budget, people-hours, time, supplies'],
  ['🟢 🟡 🔴', 'HIDDEN METERS', `Meters show STRONG (7+), STEADY (${DIFFICULTY.dangerAt + 1}-6) or DANGER (${DIFFICULTY.dangerAt} or lower, flashing red). A 📋 DEOCS Survey shows the exact numbers for ${DIFFICULTY.deocsStops} stops.`],
  ['<span class="up">▲</span> <span class="dn">▼</span> ❔', 'ARROWS', 'Green raises a meter, red lowers it. Doubled = bigger swing. ❔ = depends on your roll or performance'],
  ['🎤', 'ACT IT OUT', 'Dialogue encounter: the GM rates you 1-3 stars'],
  ['👑', 'COMMAND TOKEN', 'Rock, Paper, Rank: the Flight Commander resolves any tied vote. That is all it does.'],
  ['🎁', 'PERKS', 'Each cadet has one perk, usable once. It glows gold on your phone when it can help: tap it to ask the GM.'],
  ['🔦', 'SPOTLIGHT', 'A wheel picks one cadet (never the same one twice) to decide alone. Everyone else stays silent.'],
  ['🟩🟩🟩', 'LOYALTY', 'Each Unit member has 0-5 loyalty. At 5 they become an Ally; at 0 they hit a Breaking Point. Everyone\'s trait is visible on the org chart.'],
  ['⚔️ 💀 🏕️ 🛒 ❓', 'MAP STOPS', 'Scenario · Elite (harder, bigger rewards) · Rest Stop · Base Exchange (BX) · Unknown'],
  ['🎡', 'INJECT CHECKPOINT', 'The 🎡 waypoints between stops. The team picks which waypoint to take (it also locks in the path to the next stop); then a d6 picks the Wheel of Failure, Meh or Success and someone spins it.'],
  ['🚨', 'CRISIS EVENT', 'A meter hits 0: the crisis strikes right away and takes something for good (an Airman, your Flight Commander, your gear). A second Crisis Event = GAME OVER.'],
  ['CMD CHA<br>INS GRIT', 'YOUR STATS', 'Added to your d20 rolls. CMD Command (orders, decisions) · CHA Charisma (persuade, counsel) · INS Insight (read people, plan) · GRIT Grit (endure, execute)'],
  ['📱🎲', 'YOUR TURN', 'Random events rotate through the team: when it\'s your turn, a ROLL / SPIN button appears on your phone'],
];

/* ---------------- player avatars (cadets pick one) ----------------
   Drawn on a 12x12 grid. g = gender ('m' / 'f', 10 each: picking an icon also sets the cadet's gender)
   skin / hair colour / hair style / accessory / uniform */
const AVATARS = [
  { g: 'm', skin: '#f1c27d', hair: '#2b1d0e', style: 'short',  acc: 'none',    shirt: '#3d5a80' },
  { g: 'm', skin: '#e0ac69', hair: '#111',    style: 'buzz',   acc: 'shades',  shirt: '#556b2f' },
  { g: 'f', skin: '#c68642', hair: '#111',    style: 'bun',    acc: 'none',    shirt: '#3d5a80' },
  { g: 'm', skin: '#8d5524', hair: '#111',    style: 'buzz',   acc: 'headset', shirt: '#2f4f9f' },
  { g: 'f', skin: '#ffdbac', hair: '#d4a017', style: 'long',   acc: 'none',    shirt: '#5b5b5b' },
  { g: 'm', skin: '#f1c27d', hair: '#a0522d', style: 'short',  acc: 'glasses', shirt: '#2f4f9f' },
  { g: 'f', skin: '#e0ac69', hair: '#5a3a1a', style: 'long',   acc: 'helmet',  shirt: '#556b2f' },
  { g: 'f', skin: '#c68642', hair: '#2b1d0e', style: 'long',   acc: 'glasses', shirt: '#7a2b2b' },
  { g: 'f', skin: '#ffdbac', hair: '#a0522d', style: 'long',   acc: 'beret',   shirt: '#2f4f9f' },
  { g: 'f', skin: '#8d5524', hair: '#111',    style: 'puff',   acc: 'none',    shirt: '#3d5a80' },
  { g: 'm', skin: '#f1c27d', hair: '#111',    style: 'none',   acc: 'cap',     shirt: '#556b2f' },
  { g: 'm', skin: '#d4a373', hair: '#5a3a1a', style: 'short',  acc: 'mustache', shirt: '#5b5b5b' },
  { g: 'f', skin: '#e0ac69', hair: '#d4a017', style: 'bun',    acc: 'shades',  shirt: '#7a2b2b' },
  { g: 'm', skin: '#c68642', hair: '#111',    style: 'none',   acc: 'pilot',   shirt: '#2f4f9f' },
  { g: 'f', skin: '#ffdbac', hair: '#7a4a2a', style: 'long',   acc: 'headset', shirt: '#556b2f' },
  { g: 'm', skin: '#8d5524', hair: '#2b1d0e', style: 'short',  acc: 'robot',   shirt: '#5b5b5b' },
  { g: 'm', skin: '#d4a373', hair: '#2b1d0e', style: 'short',  acc: 'beard',   shirt: '#3d5a80' },
  { g: 'm', skin: '#ffdbac', hair: '#c0392b', style: 'mohawk', acc: 'none',    shirt: '#556b2f' },
  { g: 'f', skin: '#8d5524', hair: '#111',    style: 'long',   acc: 'goggles', shirt: '#2f4f9f' },
  { g: 'f', skin: '#f1c27d', hair: '#5a3a1a', style: 'long',   acc: 'bandana', shirt: '#7a2b2b' },
];
// the icon groups on the pick screen (each icon's index stays its number)
const AV_GROUPS = [['m', '♂ MALE'], ['f', '♀ FEMALE']].map(([g, label]) => ({ g, label, idx: AVATARS.map((a, k) => a.g === g ? k : -1).filter(k => k >= 0) }));
// the number shown on each icon: its position on the pick screen (1-10 male, 11-20 female)
const avNum = k => AV_GROUPS.flatMap(G => G.idx).indexOf(k) + 1;

/* ---------------- look (cosmetic only: no effect on the game) ----------------
   Picked on the icon screen after the icon. '' = the icon's own look. */
const UNIFORMS = [
  { id: '',       name: 'Default' },
  { id: 'ocp',    name: 'OCPs' },
  { id: 'blues',  name: 'Blues' },
  { id: 'flight', name: 'Flight suit' },
  { id: 'pt',     name: 'PTs' },
];
const HAIR_COLORS = [
  { id: '',       name: 'Default' },
  { id: 'black',  name: 'Black',      c: '#111111' },
  { id: 'dark',   name: 'Dark brown', c: '#2b1d0e' },
  { id: 'brown',  name: 'Brown',      c: '#5a3a1a' },
  { id: 'auburn', name: 'Auburn',     c: '#a0522d' },
  { id: 'blonde', name: 'Blonde',     c: '#d4a017' },
  { id: 'red',    name: 'Red',        c: '#c0392b' },
  { id: 'gray',   name: 'Gray',       c: '#9a9a9a' },
];
// Team patch = the team's name. The team picks one of its squadron's six on the org chart screen
// (shown on the HUD, phones and leaderboard). A patch already on the leaderboard can't be picked again.
const PATCHES = {
  wk: [ { id: 'jet', icon: '✈️', name: 'Jet Jockeys' }, { id: 'wrench', icon: '🔧', name: 'Knuckle Busters' }, { id: 'gear', icon: '⚙️', name: 'Gear Grinders' },
        { id: 'flame', icon: '🔥', name: 'Afterburners' }, { id: 'tools', icon: '🛠️', name: 'Wrench Wizards' }, { id: 'hawk', icon: '🦅', name: 'Flightline Hawks' } ],
  gg: [ { id: 'shield', icon: '🛡️', name: 'Shield Wall' }, { id: 'wolf', icon: '🐺', name: 'Night Wolves' }, { id: 'k9', icon: '🐕', name: 'Dog Pound' },
        { id: 'gate', icon: '🚧', name: 'Gatekeepers' }, { id: 'siren', icon: '🚨', name: 'Siren Squad' }, { id: 'watch', icon: '🔦', name: 'Night Watch' } ],
  pp: [ { id: 'bolt', icon: '⚡', name: 'Bolt Brigade' }, { id: 'sat', icon: '🛰️', name: 'Uplink Crew' }, { id: 'tower', icon: '📡', name: 'Static Kings' },
        { id: 'lock', icon: '🔐', name: 'Firewall Crew' }, { id: 'disk', icon: '💾', name: 'Byte Club' }, { id: 'desk', icon: '🖥️', name: 'Help Desk Heroes' } ],
  sr: [ { id: 'truck', icon: '🚚', name: 'Road Warriors' }, { id: 'pallet', icon: '📦', name: 'Pallet Pushers' }, { id: 'globe', icon: '🌐', name: 'Global Reach' },
        { id: 'fuel', icon: '⛽', name: 'Fuel Dogs' }, { id: 'crane', icon: '🏗️', name: 'Forklift Mafia' }, { id: 'compass', icon: '🧭', name: 'Pathfinders' } ],
  sa: [ { id: 'eye', icon: '👁️', name: 'All-Seeing Eye' }, { id: 'owl', icon: '🦉', name: 'Night Owls' }, { id: 'map', icon: '🗺️', name: 'Recon Raiders' },
        { id: 'knight', icon: '♞', name: 'Dark Knights' }, { id: 'spy', icon: '🕵️', name: 'Gumshoes' }, { id: 'scope', icon: '🔭', name: 'Star Gazers' } ],
  ch: [ { id: 'pizza', icon: '🍕', name: 'Pizza Gang' }, { id: 'burger', icon: '🍔', name: 'Chow Hall Crew' }, { id: 'fit', icon: '🏋️', name: 'Gym Rats' },
        { id: 'key', icon: '🗝️', name: 'Key Masters' }, { id: 'coffee', icon: '☕', name: 'Coffee Cartel' }, { id: 'bowl', icon: '🎳', name: 'Strike Force' } ],
};

/* ---------------- practicum objectives ----------------
   The seven course objectives, consolidated into five. Shown on the "Why are we doing this?"
   slide before the game and again in the Reality Debrief, with every event that tested each one.
   Missions and spotlights are tagged by their subtitle (sob) through OBJ_KEYS; a mission can
   set obj: ['auth', ...] to override. */
const OBJECTIVES = [
  { id: 'auth',   icon: '⚖️', short: 'AUTHORITY', name: 'AUTHORITY & RESPONSIBILITY', text: 'Understand leadership authority and responsibility: what you can hand off, and what you always own.' },
  { id: 'mot',    icon: '🔥', short: 'MOTIVATION', name: 'MOTIVATION', text: 'Understand how motivation drives individual performance.' },
  { id: 'char',   icon: '🦅', short: 'CHARACTER', name: 'CHARACTER', text: 'Confront the character demanded of an American Airman.' },
  { id: 'create', icon: '💡', short: 'CREATIVITY', name: 'CREATIVE THINKING', text: 'Infer the right leadership solution to remove barriers to creative thinking.' },
  { id: 'comm',   icon: '📣', short: 'FEEDBACK', name: 'EXPECTATIONS & FEEDBACK', text: 'Articulate ideas clearly, establish expectations, and give your subordinates effective feedback.' },
];
const OBJECTIVE = Object.fromEntries(OBJECTIVES.map(o => [o.id, o]));
const OBJ_KEYS = [
  [/authority|accountab|responsib|decision|readiness/i, 'auth'],
  [/motivat|care|fatigue|fairness|warning|recognition/i, 'mot'],
  [/character|integrity|standards|opsec|security|stewardship|courage|report|safety/i, 'char'],
  [/creative|root cause|idea|planning/i, 'create'],
  [/feedback|expectation|articulat|counsel|brief/i, 'comm'],
];
function objOf(m) { if (!m) return []; if (m.obj) return m.obj; return OBJ_KEYS.filter(([re]) => re.test(m.sob || '')).map(([, id]) => id); }
// Display order for "Your Unit": commander at the top, the most junior Airman at the bottom
const RANK_ORDER = ['Col', 'Lt Col', 'Maj', 'Capt', '1st Lt', '2d Lt', 'Civ.', 'Mr.', 'Ms.', 'CMSgt', 'SMSgt', 'MSgt', 'TSgt', 'SSgt', 'SrA', 'A1C', 'Amn', 'AB'];
const rankIdx = r => { const i = RANK_ORDER.indexOf(r); return i < 0 ? 99 : i; };

/* ---------------- debrief ---------------- */
const DECODER = [
  ['🎯 MISSION meter', "Your unit's ability to execute; the reason the unit exists"],
  ['❤️ MORALE meter', "Your people's motivation; the thing that makes MISSION possible tomorrow"],
  ['⭐ TRUST meter', 'Your credibility with your commander; it buys you freedom to lead'],
  ['📦 RESOURCES meter', 'Money, people-hours, and time; always less than you need'],
  ['💀 Integrity (one hit)', 'Integrity First. In real life there is no respawn.'],
  ['👑 Command Token', 'Rank can settle a tie, but a leader who decides by rank alone stops hearing the team.'],
  ['Unit member traits', 'Every Airman has a story. Knowing it is step one; leading to it is the job.'],
  ['🎤 Dialogue Encounters', 'Feedback, counseling, and briefings: the actual job of a leader'],
  ['Inject wheels', "Real life. You don't control it; you control your response."],
  ["Commander's perks and intent", 'Every boss has things they reward and things that set them off, and a priority they will judge you on. Learn them early.'],
  ['Squadron tendency', 'Every unit has a chronic weak spot (SF morale, cyber backlog...). Leaders plan around it instead of being surprised by it.'],
  ['🚨 Crisis Events', 'A meter at zero is not a setback, it is a casualty: a lost Airman, a fired leader, a failed mission. Leaders watch the meters so it never gets there.'],
  ['The Inspector General', 'UEI / IG inspections, and every commander who will ask "How do you know?"'],
  ['Lowest-meter scoring', "Leadership is balance: you're judged by your weakest area"],
];
const DEBRIEF_ALWAYS = [
  'When a vote tied, how did the Flight Commander break it? Did they explain the call, or just make it?',
  'Which position did you wish you had? What does that tell you about building a team?',
  "Name one thing from today you'll actually do as a 2d Lt.",
];
