/* =====================================================================
   PRACTICUM ADVENTURE - engine + GM console
   The GM window owns the game state (S). Every change is pushed to the
   player window (projector) by postMessage, with BroadcastChannel as a
   fallback, together with a list of one-shot effects (wheels, sounds,
   floating deltas) for the player screen to animate.
   ===================================================================== */

/* ---------------- shared helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const rnd = n => Math.floor(Math.random() * n);
const pickOne = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const IS_PLAYER = location.hash.replace('#', '') === 'player';
const IS_BOSS_PRACTICE = /[?&]practice=boss(?:&|$)/.test(location.search || '');
const RUN_STORAGE_KEY = IS_BOSS_PRACTICE ? 'sq_boss_practice_run' : 'sq_run';
const WHEEL_MS = 6200;
const sign = n => (n > 0 ? '+' : '') + n;

/* ---------------- 8-bit sound ---------------- */
const SFX = (() => {
  let ctx = null, muted = false;
  const ac = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  function tone(f, d, t = 0, type = 'square', v = 0.07) {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, c.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + d);
    o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + d + 0.03);
  }
  const seq = (notes, step = 0.09, type, v) => notes.forEach((f, i) => f && tone(f, step * 0.95, i * step, type, v));
  const lib = {
    tick: () => tone(1100, 0.025, 0, 'square', 0.03),
    click: () => tone(620, 0.06),
    good: () => seq([523, 659, 784, 1047], 0.08),
    bad: () => seq([392, 330, 262, 196], 0.12, 'sawtooth', 0.06),
    crit: () => seq([523, 659, 784, 1047, 1319, 1568, 2093], 0.06),
    fumble: () => seq([300, 250, 200, 150, 100], 0.13, 'sawtooth', 0.07),
    alarm: () => { for (let i = 0; i < 4; i++) { tone(880, 0.18, i * 0.4, 'square', 0.06); tone(660, 0.18, i * 0.4 + 0.2, 'square', 0.06); } },
    level: () => seq([392, 523, 659, 784, 0, 659, 784, 1047], 0.09),
    loot: () => seq([784, 988, 1175, 1568], 0.07, 'triangle', 0.1),
    ach: () => seq([659, 784, 1047, 1319], 0.07, 'triangle', 0.1),
    boss: () => seq([110, 0, 110, 0, 98, 0, 87, 82, 73, 0, 65], 0.18, 'sawtooth', 0.08),
    over: () => seq([392, 370, 349, 330, 311, 294, 277, 262], 0.2, 'triangle', 0.1),
    start: () => seq([262, 330, 392, 523, 392, 523, 659], 0.08),
    stars: () => seq([1047, 1319, 1568], 0.14, 'triangle', 0.1),
    hit: () => seq([200, 150, 100], 0.06, 'square', 0.09),
  };
  return {
    play(n) { if (muted) return; try { lib[n] && lib[n](); } catch (e) { } },
    unlock() { try { ac(); } catch (e) { } },
    get muted() { return muted; }, set muted(v) { muted = !!v; },
  };
})();

/* ---------------- pixel avatars (8x8, seeded by name) ---------------- */
const _av = {};
function inspectorPortrait() { return 'inspector-general.svg'; }
function igIcon(px = 24) { return `<img class="ig-icon" src="${inspectorPortrait()}" style="width:${px}px;height:${px}px" alt="Inspector General">`; }
function igText(text) { return esc(text).replaceAll('👹', igIcon()); }
function avatar(name) {
  name = name || '?';
  if (_av[name]) return _av[name];
  let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const x = c.getContext('2d');
  const hue = h % 360;
  x.fillStyle = `hsl(${hue},45%,20%)`; x.fillRect(0, 0, 8, 8);
  x.fillStyle = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d4a373'][h % 6]; x.fillRect(1, 2, 6, 5);
  x.fillStyle = ['#2b1d0e', '#5a3a1a', '#a0522d', '#d4a017', '#111', '#7a4a2a'][(h >> 4) % 6];
  x.fillRect(1, 1, 6, 1); if (h & 2) { x.fillRect(1, 2, 1, 2); x.fillRect(6, 2, 1, 2); } if (h & 8) x.fillRect(2, 0, 4, 1);
  x.fillStyle = '#000'; x.fillRect(2, 4, 1, 1); x.fillRect(5, 4, 1, 1);
  x.fillStyle = '#7a2b2b'; x.fillRect(3, 6, 2, 1);
  x.fillStyle = ['#2f4f9f', '#556b2f', '#3d5a80', '#5b5b5b'][(h >> 7) % 4]; x.fillRect(0, 7, 8, 1);
  return (_av[name] = c.toDataURL());
}

/* preset avatars the cadets pick from (12x12) */
const _pav = {};
function presetAvatar(i, uni, hair) {
  const key = `${i}|${uni || ''}|${hair || ''}`;
  if (_pav[key]) return _pav[key];
  const a = { ...(AVATARS[i] || AVATARS[0]) }, hc = HAIR_COLORS.find(h => h.id === hair);
  if (hc && hc.c) a.hair = hc.c;
  const c = document.createElement('canvas'); c.width = c.height = 12;
  const x = c.getContext('2d'), R = (col, px, py, w, h) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  R(`hsl(${i * 47 % 360},40%,22%)`, 0, 0, 12, 12);
  const u = UNIFORM_COLORS[uni];
  switch (uni) { // uniform (cosmetic)
    case 'ocp': R(u.cream524, 1, 10, 10, 2); R(u.tan525, 2, 10, 2, 1); R(u.paleGreen526, 4, 10, 2, 1); R(u.olive527, 3, 11, 2, 1); R(u.darkGreen528, 7, 10, 2, 1); R(u.brown529, 6, 11, 2, 1); R(u.darkBrown530, 9, 11, 2, 1); break;
    case 'blues': R(u.shirt, 1, 10, 10, 2); R(u.blue, 5, 10, 2, 2); R(u.blue, 1, 10, 2, 1); R(u.blue, 9, 10, 2, 1); R(u.silver, 3, 10, 1, 1); break;
    case 'flight': R(u.sage, 1, 10, 10, 2); R(u.seam, 5, 10, 1, 2); R(u.patch, 7, 10, 2, 1); break;
    case 'pt': R(u.heatherGray, 1, 10, 10, 2); R(u.heatherLight, 2, 10, 1, 1); R(u.heatherLight, 4, 11, 1, 1); R(u.heatherLight, 6, 10, 1, 1); R(u.heatherLight, 9, 11, 1, 1); R(u.navy, 7, 10, 1, 1); break;
    default: R(a.shirt, 1, 10, 10, 2); R('#ffd23f', 3, 10, 1, 1);           // the icon's own uniform + rank
  }
  R(a.skin, 3, 3, 6, 7); R(a.skin, 2, 5, 1, 2); R(a.skin, 9, 5, 1, 2);   // head + ears
  if (a.style === 'short') { R(a.hair, 3, 2, 6, 2); R(a.hair, 2, 3, 1, 2); R(a.hair, 9, 3, 1, 2); }
  if (a.style === 'buzz') R(a.hair, 3, 2, 6, 1);
  if (a.style === 'long') { R(a.hair, 3, 2, 6, 2); R(a.hair, 2, 3, 1, 6); R(a.hair, 9, 3, 1, 6); }
  if (a.style === 'bun') { R(a.hair, 3, 2, 6, 2); R(a.hair, 5, 0, 2, 2); }
  if (a.style === 'puff') { R(a.hair, 2, 0, 8, 3); R(a.hair, 1, 1, 1, 3); R(a.hair, 10, 1, 1, 3); }
  if (a.style === 'mohawk') { R(a.hair, 5, 0, 2, 4); R(a.hair, 3, 3, 6, 0); }
  R('#000', 4, 6, 1, 1); R('#000', 7, 6, 1, 1); R('#7a2b2b', 5, 8, 2, 1); // eyes + mouth
  switch (a.acc) {
    case 'shades': R('#000', 3, 5, 6, 2); R('#3fd8ff', 4, 5, 1, 1); R('#3fd8ff', 7, 5, 1, 1); break;
    case 'glasses': R('#ddd', 3, 5, 2, 2); R('#ddd', 7, 5, 2, 2); R(a.skin, 4, 6, 0, 0); R('#000', 4, 6, 1, 1); R('#000', 7, 6, 1, 1); break;
    case 'headset': R('#222', 2, 2, 8, 1); R('#222', 1, 4, 2, 3); R('#222', 9, 4, 2, 3); R('#222', 3, 8, 2, 1); break;
    case 'helmet': R('#4a5d23', 2, 1, 8, 3); R('#4a5d23', 1, 3, 10, 1); break;
    case 'beret': R('#2b6cb0', 2, 1, 8, 2); R('#2b6cb0', 8, 3, 2, 1); R('#ffd23f', 3, 2, 1, 1); break;
    case 'cap': R('#2f4f9f', 3, 1, 6, 2); R('#2f4f9f', 2, 3, 9, 1); R('#ffd23f', 5, 1, 2, 1); break;
    case 'mustache': R('#3a2a1a', 4, 7, 4, 1); break;
    case 'pilot': R('#6b4423', 2, 1, 8, 3); R('#9ad', 3, 4, 2, 1); R('#9ad', 7, 4, 2, 1); break;
    case 'beard': R(a.hair, 3, 8, 6, 2); R(a.hair, 2, 6, 1, 3); R(a.hair, 9, 6, 1, 3); R('#7a2b2b', 5, 8, 2, 1); break;
    case 'goggles': R('#333', 2, 4, 8, 3); R('#7fe7ff', 3, 5, 2, 1); R('#7fe7ff', 7, 5, 2, 1); break;
    case 'bandana': R('#c0392b', 2, 1, 8, 3); R('#fff', 4, 2, 1, 1); R('#fff', 7, 2, 1, 1); R('#c0392b', 10, 3, 1, 2); break;
    case 'robot': R('#9aa4b1', 3, 3, 6, 7); R('#ff2e63', 4, 6, 1, 1); R('#ff2e63', 7, 6, 1, 1); R('#9aa4b1', 5, 0, 2, 3); R('#555', 4, 8, 4, 1); break;
  }
  return (_pav[key] = c.toDataURL());
}
// a cadet's class colour (their icon's border) · the FC's vote also gets a 👑 (Rock, Paper, Rank)
const clsColor = p => (p && CLASS[p.cls] && CLASS[p.cls].color) || '#8f8fc8';
/* Air Force rank insignia: the official public-domain SVGs from Wikimedia Commons, in insignia/
   (US-O1..O8_insignia.svg, E2..E9a_USAF_*.svg). AB and civilians get none. h = height in px.
   The aspect ratios are stored so the image takes its width before it loads (no layout jump). */
const INSIGNIA = { // rank: [file, width / height]
  '2d Lt': ['2dLt', 0.4], '1st Lt': ['1stLt', 0.4], 'Capt': ['Capt', 1.069], 'Maj': ['Maj', 0.953], 'Lt Col': ['LtCol', 0.953],
  'Col': ['Col', 2.0], 'Brig Gen': ['BrigGen', 1.067], 'Maj Gen': ['MajGen', 2.148],
  Amn: ['Amn', 2.182], A1C: ['A1C', 1.727], SrA: ['SrA', 1.429], SSgt: ['SSgt', 1.218], TSgt: ['TSgt', 1.063],
  MSgt: ['MSgt', 0.735], SMSgt: ['SMSgt', 0.661], CMSgt: ['CMSgt', 0.597],
  '1stSgt': ['MSgt1stSgt', 0.735, 'MSgt (First Sergeant)'], // E7b_USAF_1STSGT1.svg: MSgt chevrons with the diamond
};
// load them all up front, so names don't show up without their insignia mid-game
Object.values(INSIGNIA).forEach(([f]) => { new Image().src = `insignia/${f}.svg`; });
function rankSvg(rank, h = 24) {
  const r = INSIGNIA[rank]; if (!r) return '';
  const label = r[2] || rank;
  // a background image, not an <img>, so the avatar rules (".pcard img" etc.) never stretch it
  return `<span class="rkins" role="img" aria-label="${esc(label)}" title="${esc(label)}" style="--h:${h}px;aspect-ratio:${r[1]};background-image:url(insignia/${r[0]}.svg)"></span>`;
}
// a cadet's / Unit member's rank insignia (nothing for civilians)
// a class can wear a special insignia for its rank (ins: the First Sergeant's diamond)
const rankOf = p => (p && p.cls && CLASS[p.cls] ? CLASS[p.cls].ins || CLASS[p.cls].rank : p && p.rank) || '';
function insignia(rankOrPerson, h) { return rankSvg(typeof rankOrPerson === 'string' ? rankOrPerson : rankOf(rankOrPerson), h); }
function sceneIcon(scene, size = 24) { return scene.iconRank ? insignia(scene.iconRank, size) : scene.badge ? ccBadge(size) : scene.icon || ''; }
// A class's badge: its rank insignia (replaces the old class emoji). h = height in px.
function clsIcon(clsId, h) { const c = CLASS[clsId]; return c ? `<span class="clsins">${rankSvg(c.ins || c.rank, h)}</span>` : ''; }
// An NPC / commander's insignia from a "Lt Col Name" label (nothing for civilians)
function npcIns(label, h) { const r = RANK_ORDER.slice().sort((a, b) => b.length - a.length).find(x => String(label || '').startsWith(x + ' ')); return r ? rankSvg(r, h) : ''; }
// The chain of command for tied votes: Flight Commander, then the SEL, XO, Plans Officer, First Sergeant, UTM.
const CHAIN = ['fc', 'chief', 'xo', 'plans', 'shirt', 'utm'];
// the next cadet in the chain who isn't fired (skip = a seat to pass over), or -1
function nextInChain(S, skip) { const ok = (S.party || []).map((p, i) => i).filter(i => i !== skip && !S.party[i].fired && S.party[i].cls);
  return ok.sort((a, b) => (CHAIN.indexOf(S.party[a].cls) + 1 || 99) - (CHAIN.indexOf(S.party[b].cls) + 1 || 99))[0] ?? -1; }
// Command Token gives the Flight Commander passive tie-breaking authority when selected; otherwise the GM decides.
function crownIdx(S) {
  if (!S || !S.party) return -1;
  const fc = S.party.findIndex(c => c.cls === 'fc' && !c.fired);
  if (fc >= 0 && S.party[fc].perk === 'commandtoken') return fc;
  return -1;
}
// A cadet who can't act: in a meeting this stop, or relieved of command for good
function isOut(S, i) { return i === S.offline || !!(S.party[i] && S.party[i].fired); }
// The team's patch, as a small tag ("🔧 KNUCKLE BUSTERS"); '' before it's picked
function teamTag(S) { const p = patchOf(S); return p ? `${p.icon} ${p.name.toUpperCase()}` : ''; }
function avatarOf(p) { return p && p.av != null ? presetAvatar(p.av, p.uni, p.hair) : avatar(p ? p.name : '?'); }
// the team's patch (picked on its own screen, from its squadron's list)
function patchOf(S) { const list = (S && S.unit && PATCHES[S.unit]) || []; return list.find(p => p.id === S.patch) || null; }
// patches already on the leaderboard ("wk:jet") can't be picked by another team
function usedPatches() { return loadBoard().map(r => r.patchKey).filter(Boolean); }
function patchFree(S, id) { return (PATCHES[S.unit] || []).some(p => p.id === id) && !usedPatches().includes(`${S.unit}:${id}`); }
// picking a patch also names the team
function setPatch(id) {
  const p = (PATCHES[S.unit] || []).find(x => x.id === id); S.patch = id; S.callsign = p ? p.name.toUpperCase() : '';
  S.flags = S.flags || {};
  if (!S.flags.patchSurveyGranted) {
    S.items = S.items || []; if (!S.items.includes('deocs')) grantTeamItem('deocs', false);
    S.flags.patchSurveyGranted = true;
    log('Team patch benefit', 'The team received a DEOCS Survey item');
  }
}

/* ---------------- wheel canvas ---------------- */
function drawWheel(cv, slices, rot) {
  const x = cv.getContext('2d'), W = cv.width, r = W / 2 - 10, n = slices.length, a = 2 * Math.PI / n;
  x.clearRect(0, 0, W, W);
  x.save(); x.translate(W / 2, W / 2); x.rotate(rot);
  slices.forEach((s, i) => {
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, r, i * a, (i + 1) * a); x.closePath();
    x.fillStyle = s.color; x.fill(); x.lineWidth = 5; x.strokeStyle = '#000'; x.stroke();
    x.save(); x.rotate(i * a + a / 2); x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillStyle = s.ink || '#000';
    const fs = n > 12 ? 13 : n > 8 ? 15 : 19;
    x.font = `${fs}px "Press Start 2P", monospace`;
    let label = s.label; const maxW = r - 70;
    while (x.measureText(label).width > maxW && label.length > 3) label = label.slice(0, -1);
    x.fillText(label, r - 18, 1);
    x.restore();
  });
  x.restore();
  x.beginPath(); x.arc(W / 2, W / 2, 34, 0, Math.PI * 2); x.fillStyle = '#000'; x.fill();
  x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke();
}
function wheelTarget(n, idx) { const a = 2 * Math.PI / n; return -Math.PI / 2 - (idx + 0.5) * a; }

/* ---------------- text helpers ---------------- */
// A cadet's in-game name: the rank that goes with their class + their name ("Capt Snuffy").
function rankName(p) {
  if (!p) return '';
  const c = p.cls && CLASS[p.cls];
  return c && p.name ? `${c.rank} ${p.name}` : (p.name || '');
}
function npcOf(S, s) { return (S.npcs || []).find(n => n.slot === s); }
function npcLabel(S, s) { const n = npcOf(S, s); return n ? `${n.rank} ${n.name}` : `[${s}]`; }
function commanderRank(state = S) {
  return UNITS.find(u => u.id === state?.unit)?.ccRank || Object.keys(INSIGNIA).sort((a,b) => b.length-a.length).find(rank => state?.cc?.startsWith(rank+' ')) || 'Lt Col';
}
function commanderSurname(state = S) { return String(state?.cc || '').slice(commanderRank(state).length + 1); }
function fill(S, t) {
  return String(t || '').replace(/\{([ABCD])\}/g, (_, s) => npcLabel(S, s)).replace(/\{CC\}/g, S.cc || 'the CC')
    .replace(/\{X:(\w+)(?:\.(\w+))?\}/g, (_, k, f) => extraText(S, k, f));
}
// a named character outside the Unit ({X:key} in the content; see EXTRAS in data.js)
function extraText(S, k, f) {
  const e = S && S.extras && S.extras[k], d = EXTRAS[k] || { generic: 'someone' };
  if (!e) return f ? ({ he: 'they', He: 'They', him: 'them', his: 'their', His: 'Their' })[f] || d.generic : d.generic;
  const g = GENDER[e.name];
  const pro = { he: ['he', 'she'], He: ['He', 'She'], him: ['him', 'her'], his: ['his', 'her'], His: ['His', 'Her'] }[f];
  if (pro) return g ? pro[g === 'f' ? 1 : 0] : ({ he: 'they', He: 'They', him: 'them', his: 'their', His: 'Their' })[f];
  return f === 'name' ? e.name : `${e.rank} ${e.name}`;
}
// A meter icon as a coloured, labelled tag: "❤️ Morale" in the meter's colour.
function meterTag(k, amt) { const m = METER[k], tag = `<span class="mtag" style="--c:${m.color}">${m.icon} ${m.label}</span>`; return amt == null ? tag : `<span class="mtn">${tag} ${amt}</span>`; }
// a meter's icon in a fixed-size emoji box, so 🎯 ❤️ ⭐ 📦 all render the same size whatever the meter's state
function meterIcon(m) { return `<span class="micon">${m.icon}</span>`; }
// Labels every bare meter icon in a piece of (already escaped) HTML. Skips ⭐ used
// as a star rating ("3⭐", "⭐⭐⭐") so ratings never read as "Trust".
const METER_ICON_RE = /(?:([+−-]\d+) )?(?<![\d⭐])(🎯|❤️|⭐|📦)(?!⭐)(?: ([+−-]\d+)(?![\d]))?/gu;
function mt(html) {
  return String(html ?? '').replace(METER_ICON_RE, (all, pre, ic, post) => { const m = METERS.find(x => x.icon === ic); if (!m) return all;
    return pre || post ? `<span class="mtn">${pre ? pre + ' ' : ''}${meterTag(m.k)}${post ? ' ' + post : ''}</span>` : meterTag(m.k); });
}
/* Single use vs passive: the "Once:" / "Passive:" lead-in of an ability or perk becomes a badge.
   useSplit('Once, at a BX: the next…') → { kind: 'once', text: 'At a BX: the next…' } */
function useSplit(text) {
  const t = String(text || ''), m = /^(Once|Passive)(?:,\s*([^:]+))?:\s*/i.exec(t);
  if (!m) return { kind: null, text: t };
  const rest = t.slice(m[0].length), q = m[2];
  return { kind: m[1].toLowerCase(), text: q ? `${q[0].toUpperCase()}${q.slice(1)}: ${rest}` : rest };
}
function useBadge(kind) {
  return { once: '<span class="use once" title="Single use: once per game"><i>1×</i> ONCE</span>', passive: '<span class="use passive" title="Passive: always on, nothing to press"><i>∞</i> PASSIVE</span>',
    used: '<span class="use used">USED</span>', active: '<span class="use active">✓ ACTIVE</span>' }[kind] || '';
}
// Render an ability or perk with its passive/once-use badge.
function useHtml(text, kind) { const u = useSplit(text); return `${useBadge(kind || u.kind)} ${mt(esc(u.text))}`; }
/* What a choice can do to each meter, computed from its real effects so nothing is hidden:
   the same change in every outcome → that many ▲/▼ (up to 3); a change that depends on the roll or
   the acting (or differs by class) → ❔. Delayed fallout (next:) is still a surprise by design. */
function choiceShow(ch) {
  ch = encounterChoice(S, ch);
  const outs = [], npcs = (S && S.npcs) || [];
  // an effect's loyalty changes per Unit member: loy {A: 1}, traitLoy, and traitAny when that member has the trait
  const loyOf = (e, o) => {
    if (!e) return;
    for (const s in e.loy || {}) o['L:' + s] = (o['L:' + s] || 0) + e.loy[s];
    if (e.traitLoy) npcs.filter(n => n.trait === e.traitLoy.trait).forEach(n => { o['L:' + n.slot] = (o['L:' + n.slot] || 0) + e.traitLoy.d; });
    if (e.traitAny) { const t = e.traitAny, list = t.slot ? npcs.filter(n => n.slot === t.slot) : npcs, traits = t.traits || [t.trait];
      if (list.some(n => traits.includes(n.trait))) { METERS.forEach(m => { if (t.eff[m.k]) o[m.k] = (o[m.k] || 0) + t.eff[m.k]; }); loyOf(t.eff, o); } }
  };
  const add = (pre, e) => { const o = {}; METERS.forEach(m => { o[m.k] = ((pre || {})[m.k] || 0) + ((e || {})[m.k] || 0); if ((e && e.set && e.set[m.k] != null) || (pre && pre.set && pre.set[m.k] != null)) o[m.k] = 'set'; });
    const tx = {}; loyOf(pre, tx); loyOf(e, tx); for (const k in tx) o[k] = (typeof o[k] === 'number' ? o[k] : 0) + tx[k]; outs.push(o); };
  const one = c => {
    if (c.kind === 'check' && c.check) { add(c.pre, c.check.pass); add(c.pre, c.check.fail); }
    else if (c.kind === 'stars' && c.stars) c.stars.forEach(st => add(c.pre, st));
    else add(c.pre, c.eff);
  };
  if (ch.ifClass) { one({ ...ch, ...normal(ch.ifClass.then), pre: ch.pre }); one({ ...ch, ...normal(ch.ifClass.else), pre: ch.pre }); } else one(ch);
  const one1 = (k, label) => {
    const vals = outs.map(o => o[k]); if (vals.every(v => !v)) return null;
    const r = vals.every(v => v === vals[0]) && vals[0] !== 'set' ? Math.max(-3, Math.min(3, vals[0])) : '?';
    return label ? [k, r, label] : [k, r];
  };
  const slots = [...new Set(outs.flatMap(o => Object.keys(o).filter(k => k.startsWith('L:'))))].sort();
  return METERS.map(m => one1(m.k)).concat(slots.map(k => { const n = npcs.find(x => x.slot === k.slice(2)); return n && !n.gone ? one1(k, `${n.rank} ${n.name}`) : null; })).filter(Boolean);
}
// returns HTML: labelled meter + green up-arrows / red down-arrows
function arrows(show) {
  return (show || []).map(([k, n, who]) => `<span class="arw">${k.startsWith('L:') ? `<span class="mtag loytag">🤝 ${esc(who || k.slice(2))}</span>` : meterTag(k)}${n === '?' ? '❔' : `<span class="${n > 0 ? 'up' : 'dn'}">${(n > 0 ? '▲' : '▼').repeat(Math.abs(n))}</span>`}</span>`).join(' ');
}
/* Power-ups that are worth using RIGHT NOW (tokens, items, class abilities, perks).
   Shown on the projector and on phones so cadets notice "we could use X here".
   who: party slot that owns it, or null for team stuff. req: what a phone sends. */
function usableNow(S) {
  const out = []; if (!S || !S.party) return out;
  const c = S.cur, ph = S.phase, inj = S.inject, Bs = S.boss, items = S.items || [], pend = S.pending || {};
  const has = id => items.includes(id);
  const mission = ph === 'node' && c && !['rest', 'depot', 'unknown'].includes(c.type);
  const add = (who, req, icon, label, hint, hot) => out.push({ who, req, icon, label, hint, hot: !!hot });
  // team items: when each kind of item helps (see LOOT use types in data.js)
  const anytime = ['map', 'node', 'inject', 'boss'].includes(ph);
  items.forEach(id => {
    const l = LOOT.find(x => x.id === id); if (!l) return;
    const u = l.use, req = 'item:' + id, hint = fill(S, l.text);
    if (u.type === 'check' && !pend.check && ((mission && c.step === 'roll') || (ph === 'inject' && inj && inj.stage === 'tackle') || (ph === 'boss' && Bs?.stage === 'act'))) add(null, req, l.icon, l.name, `+${u.n} on this roll`, true);
    if (u.type === 'star' && ((mission && c.step === 'stars') || (ph === 'boss' && Bs?.stage === 'hotseat' && Bs.p2.who && !Bs.p2.done)) && !pend.star) add(null, req, l.icon, l.name, '+1 star on this encounter', true);
    if (u.type === 'undo' && mission && c.step === 'done' && c.choice != null) add(null, req, l.icon, l.name, 'Undo that decision and choose again');
    if (u.type === 'wheel' && ph === 'inject' && inj && inj.stage === 'trigger' && !inj.foresight) add(null, req, l.icon, l.name, 'Skip the d6: pick Meh or Success', true);
    if (u.type === 'cancel' && ph === 'inject' && inj && inj.stage === 'done' && inj.idx != null && MURPHY[inj.idx].type === 'bad' && !inj.cancelled) add(null, req, l.icon, l.name, 'Cancel this Wheel of Failure result!', true);
    if (u.type === 'intel' && mission && c.step === 'brief' && !c.intel) add(null, req, l.icon, l.name, 'See the exact effects of every choice');
    if (u.type === 'deocs' && anytime && !deocsOn(S)) add(null, req, l.icon, l.name, `See the exact meters for ${DIFFICULTY.deocsStops} stops`, METERS.some(m => S.meters[m.k] <= DIFFICULTY.dangerAt));
    if (u.type === 'meter' && anytime && effectCanChange(S, u.eff)) add(null, req, l.icon, l.name, hint, METERS.some(m => (u.eff[m.k] || 0) > 0 && S.meters[m.k] <= 2));
    if (u.type === 'anyMeter' && anytime && METERS.some(m => S.meters[m.k] < 10)) add(null, req, l.icon, l.name, `+${u.n} to any meter`, METERS.some(m => S.meters[m.k] <= 2));
    if ((u.type === 'loyAll' || u.type === 'loyOne') && anytime && (S.npcs || []).some(n => !n.gone && n.loy < 5)) add(null, req, l.icon, l.name, hint, (S.npcs || []).some(n => !n.gone && n.loy <= 1));
    if (u.type === 'branch' && branchUseful(S)) add(null, req, l.icon, l.name, branchUseful(S));
    if (u.type === 'recharge' && anytime && S.party.some(p => !p.fired && ((p.used && CLASS[p.cls] && CLASS[p.cls].ability && !CLASS[p.cls].ability.auto) || (p.perk && !['readiness', 'lean'].includes(p.perk) && (S.flags || {})['perkUsed_' + p.perk])))) add(null, req, l.icon, l.name, 'Recharge a used ability or perk');
  });
  const inGame = ['map', 'node', 'inject', 'boss'].includes(ph);
  if (!inGame) return out;
  S.party.forEach((p, i) => {
    const cl = CLASS[p.cls]; if (!cl || p.fired) return;
    const ab = cl.ability;
    const w = perkWhen(S, p, i);
    if (w) { const pk = cl.perks.find(k => k.id === p.perk) || {}; add(i, 'perk:' + p.perk, pk.icon || '🎁', pk.name || p.perk, w.hint, w.hot); }
  });
  // "moment" = only useful right now (cancel this result, skip this die...):
  // the projector asks the team to decide; everything else lives on phones as "You can use now"
  out.forEach(u => {
    const it = u.req.startsWith('item:') && LOOT.find(l => l.id === u.req.slice(5));
    u.moment = (it && ['cancel', 'wheel', 'undo'].includes(it.use.type)) || ['perk:commandtoken', 'perk:mti', 'perk:ear'].includes(u.req);
  });
  return out;
}
function effectCanChange(S, e) {
  return METERS.some(m => (e[m.k] > 0 && S.meters[m.k] < 10) || (e[m.k] < 0 && S.meters[m.k] > 0)) ||
    Object.entries(e.loy || {}).some(([slot, d]) => { const n = npcOf(S, slot); return n && !n.gone && ((d > 0 && n.loy < 5) || (d < 0 && n.loy > 0)); });
}
// When each perk can be used (null = not now). Perks are once per game; passive perks never show here.
function perkWhen(S, p, i) {
  if (!p.perk || p.fired || (S.flags || {})['perkUsed_' + p.perk]) return null;
  const c = S.cur, ph = S.phase, inj = S.inject, Bs = S.boss, pend = S.pending || {};
  const mission = ph === 'node' && c && !['rest', 'depot', 'unknown'].includes(c.type);
  const anytime = ['map', 'node', 'inject', 'boss'].includes(ph);
  const npcs = S.npcs || [];
  switch (p.perk) {
    case 'foresight': return ph === 'inject' && inj?.stage === 'trigger' && !inj.foresight && !spinning() ? { hint: 'Guarantee the Wheel of Success on this inject roll', hot: true } : null;
    case 'rally': {
      const nodes = rallyRouteNodes(S);
      return ph === 'map' && !S.routeRally && nodes.some(([t, i]) => nodes.some(([ot, oi]) => t === ot && i !== oi && S.map.tiers[t][i].type !== S.map.tiers[ot][oi].type))
        ? { hint: 'Swap the encounter types of two reachable stops in the next column' } : null;
    }
    case 'sevenlvl': return anytime && S.meters.mis < 10 ? { hint: '+3 🎯', hot: S.meters.mis <= 3 } : null;
    case 'pcs': return anytime && pcsCandidates(S).length ? { hint: 'Replace one enlisted Unit member with a higher-ranking Ally' } : null;
    case 'ncopull': return anytime && npcs.some(n => !n.gone && n.loy < 5) ? { hint: 'One Unit member +3 loyalty', hot: npcs.some(n => !n.gone && n.loy <= 1) } : null;
    case 'deocs': return anytime && !deocsOn(S) ? { hint: `See the exact meters for ${DIFFICULTY.deocsStops} stops, everyone +1 loyalty`, hot: METERS.some(m => S.meters[m.k] <= DIFFICULTY.dangerAt) } : null;
    case 'resiliency': return anytime && S.meters.mor <= 7 ? { hint: '❤️ +3, everyone +1 loyalty, 🎯 −1' } : null;
    case 'readroom': return mission && c.step === 'brief' && !c.intel && c.type !== 'crisisEvent' ? { hint: 'See the exact effects of every choice' } : null;
    case 'ear': return S.lastTruLoss > 0 ? { hint: `Cancel the last ⭐ loss (−${S.lastTruLoss})`, hot: true } : null;
    case 'emergency': return anytime && S.meters.res <= 7 ? { hint: '+3 📦 right now', hot: S.meters.res <= 2 } : null;
    case 'mti': return leadTarget(S) ? { hint: 'Take command: that failed roll counts as a pass', hot: true } : null;
  }
  return null;
}
// Branch Plan (loot item): usable on the route map until the next destination is locked. Returns the hint or ''.
function branchUseful(S) {
  if (S.phase !== 'map' || !S.map || !S.pos || S.branch || S.pos.tier < 0 || S.pos.tier >= S.map.tiers.length - 1) return '';
  if (S.wp && S.wp.queue.length && S.wp.dest != null) return '';
  return 'Vote for any stop in the next column, even if it is off your path';
}
// Talent Management (SEL): the enlisted Unit members who can be PCSed out
const pcsCandidates = S => (S.npcs || []).filter(n => n.enlisted && !n.gone && !n.handpicked);
const RANK_UP = { AB: 'Amn', Amn: 'A1C', A1C: 'SrA', SrA: 'SSgt', SSgt: 'SSgt' }; // the org chart tops out at SSgt
const PCS_TRAITS = ['mentor', 'genius', 'overach', 'cynic', 'climber']; // a hand-picked Airman comes with an upside
// what Prior MTI would turn into a pass right now (a failed scenario check or Tackle it)
function leadTarget(S) { const t = memoTarget(S); return t === 'boss' ? null : t; }
function memoTarget(S) {
  const c = S.cur, inj = S.inject, Bs = S.boss;
  if (S.phase === 'node' && c && c.step === 'done' && c.rollRes && !c.rollRes.pass && !c.rollRes.safe && c.preRoll) return 'mission';
  if (S.phase === 'inject' && inj && inj.stage === 'done' && inj.tackleFail && inj.preTackle && !inj.cancelled) return 'tackle';
  if (S.phase === 'boss' && Bs && Bs.stage === 'resolved' && (Bs.lastFails || []).length) return 'boss';
  return null;
}

// escapes text, colours +N green and -N red, and labels meter icons
function effHtml(t) {
  return mt(esc(t).replace(/([+−-]\d+)/g, m => `<span class="${m[0] === '+' ? 'up' : 'dn'}">${m}</span>`))
    .replace(/(<span class="mtag"[^>]*>[^<]*<\/span>)\s*(<span class="(?:up|dn)">[^<]*<\/span>)/g, '<span class="nw">$1$2</span>');
}
// just the meter changes as tidy chips ("❤️ Morale −1  📦 Resources −1"), no flavour text
function effChips(e) {
  const out = METERS.filter(m => e && e[m.k]).map(m => `<span class="nw">${meterTag(m.k)}<span class="${e[m.k] > 0 ? 'up' : 'dn'}">${sign(e[m.k])}</span></span>`);
  return out.join(' ') || 'no change';
}
// Tackle it, spelled out: who would roll, what they need, and what pass / fail do
function pendingCheckBonus(S) { const item = LOOT.find(l => l.id === (S.pending || {}).check); return item && item.use.type === 'check' ? item.use.n : 0; }
function tackleInfo(m, roller) {
  const t = m.tackle, r = roller != null ? roller : bestRoller(t.stat, t.m), b = rollBonus(r, t.stat, t.m) + leanBonus(S) + pendingCheckBonus(S), dc = t.dc + DIFFICULTY.dcPlus + squadCheckDcPenalty(t), need = Math.min(20, Math.max(2, dc - b));
  return { stat: t.stat, who: cadetName(r), bonus: b, dc, need, pct: (21 - need) * 5, fail: effChips(t.fail || {}) };
}
function tackleRows(m, roller) {
  const k = tackleInfo(m, roller);
  return `<div class="tkrow">🎲 ${esc(k.who)} rolls ${k.stat} ${sign(k.bonus)}: needs <b>${k.need}+</b> (${k.pct}%)</div>
    <div class="tkrow tkok">✅ PASS: no loss</div><div class="tkrow tkbad">❌ FAIL: ${k.fail}</div>`;
}
function effText(S, e) { return effList(S, e).join(', ') || 'no change'; }
// one effect per line ("🎯 Mission +3" / "🤝 SrA Condon-Matzke +1"); fitLines() shrinks a line that's too long
function effLines(S, e) { const l = effList(S, e); return `<div class="effls">${(l.length ? l : ['no change']).map(x => `<div class="effl"><span class="effi">${/^🤝 .+ [+−-]\d+$/.test(x) ? `<span class="mtag loytag">${esc(x.replace(/ [+−-]\d+$/, ''))}</span><span class="${/ \+\d+$/.test(x) ? 'up' : 'dn'}">${x.match(/[+−-]\d+$/)[0]}</span>` : effHtml(x)}</span></div>`).join('')}</div>`; }
function fitLines(root) {
  (root || document).querySelectorAll('.effl').forEach(el => {
    const inner = el.firstElementChild || el, wide = () => inner.offsetWidth > el.clientWidth + 1;
    el.style.fontSize = ''; el.classList.remove('wrap'); let k = 1;
    while (wide() && k > 0.6) { k -= 0.05; el.style.fontSize = `${k}em`; }
    if (wide()) el.classList.add('wrap'); // still too long at the smallest size: let it wrap
  });
  // .fitw: a one-word label (e.g. "!DANGER!" on a squadron card) shrinks until it fits its box
  (root || document).querySelectorAll('.fitw').forEach(el => {
    el.style.fontSize = ''; let k = 1;
    while (el.scrollWidth > el.clientWidth + 1 && k > 0.5) { k -= 0.05; el.style.fontSize = `${k}em`; }
  });
}
function effList(S, e) {
  if (!e) return [];
  const out = [];
  if (e.set) for (const k in e.set) out.push(`${METER[k].icon} set to ${e.set[k]}`);
  for (const m of METERS) if (e[m.k]) {
    const blockedAtCap = e[m.k] > 0 && S.meters[m.k] >= 10;
    out.push(blockedAtCap ? `${m.icon}+0 (Max ${m.name})` : `${m.icon}${sign(e[m.k])}`);
  }
  if (e.loy) for (const s in e.loy) out.push(`🤝 ${npcLabel(S, s)} ${sign(e.loy[s])}`);
  if (e.traitLoy) out.push(`${TRAIT[e.traitLoy.trait].name} Unit members loyalty ${sign(e.traitLoy.d)}`);
  if (e.traitAny) out.push(`if ${e.traitAny.slot ? npcLabel(S, e.traitAny.slot) + ' is ' : 'any NPC is '}${(e.traitAny.traits || [e.traitAny.trait]).map(t => TRAIT[t].name).join('/')}: ${effText(S, e.traitAny.eff)}`);
  if (e.reveal) out.push(`reveals ${npcLabel(S, e.reveal)}'s trait`);
  if (e.next) out.push(`next node${e.next.p != null ? ` (${Math.round(e.next.p * 100)}% chance)` : ''}: ${effText(S, e.next)}`);
  if (e.offlineSelf) out.push('you are offline next stop');
  if (e.flag) out.push(`flag ${e.flag}`);
  if (e.ach) out.push(`🏅 ${ACH[e.ach].name}`);
  if (e.why) out.push(`(${e.why})`);
  return out;
}
function statLabel(st) { return st === 'LOYB' ? 'd20 + A1C loyalty' : st ? st : 'plain d20'; }
function specText(S, ch) {
  ch = encounterChoice(S, ch);
  const parts = [];
  if (ch.pre) parts.push(`On choosing: ${effText(S, ch.pre)}`);
  if (ch.kind === 'fx') parts.push(effText(S, ch.eff));
  if (ch.kind === 'check') parts.push(`${statLabel(ch.check.stat)} ${checkDC(ch.check)}+ · PASS: ${effText(S, ch.check.pass)} · FAIL: ${effText(S, ch.check.fail)}`);
  if (ch.kind === 'stars') parts.push(ch.stars.map((e, i) => `${i + 1}★ ${effText(S, e)}`).join(' · '));
  return parts.join(' · ');
}
function normal(sub) { return { ...sub, kind: sub.kind || 'fx' }; }

/* ---------------- scoring ---------------- */
function bossDefeatScore(state) {
  const b = state.boss;
  if (!b || b.hp !== 0 || b.stage !== 'done' || state.gameOver) return null;
  // Support cannot bypass the Audit. Old saves derive the phase from the round.
  const phase = Math.max(3, Math.min(6, b.defeatedPhase ?? ((b.round || 0) + 3)));
  const multiplier = 7 - phase;
  return { phase, multiplier, points: 30 * multiplier };
}
function displayScoreParts(parts = []) {
  // Also clean up completed runs saved before the conditional victory row.
  return parts.filter(([name, points]) => !(name.startsWith('Defeated the IG') && points === 0));
}
function computeScore(S) {
  const vals = METERS.map(m => S.meters[m.k]);
  const sum = vals.reduce((a, b) => a + b, 0), low = Math.min(...vals);
  const allies = (S.npcs || []).filter(n => isAlly(n)).length;
  const parts = [
    ['Meters total ×3', sum * 3],
    ['Lowest meter ×10 (balance)', low * 10],
  ];
  if (S.intent) {
    const v = S.meters[S.intent], pts = v >= 7 ? DIFFICULTY.intent : v < 4 ? -DIFFICULTY.intent : 0;
    parts.push([`Commander's Intent (${METER[S.intent].icon} ${v})`, pts]);
  }
  // no points for hoarding: unused items and perks score nothing (use your tools)
  const defeat = bossDefeatScore(S);
  parts.push(['Inspection result', S.bossBonus || 0]);
  if (defeat) parts.push([`Defeated the IG · Phase ${defeat.phase} · 30 ×${defeat.multiplier}`, defeat.points]);
  parts.push(['🎤 stars ×5', (S.starsTotal || 0) * 5],
    ['Achievements', (S.ach || []).reduce((a, id) => a + ((ACH[id] && ACH[id].pts) ?? 10), 0)], ['Unit Allies ×10', allies * 10]);
  return { parts, total: parts.reduce((a, p) => a + p[1], 0) };
}
function gradeFor(S, total) {
  if (S.gameOver) return { g: 'F', title: 'GAME OVER', strat: GAME_OVER_TEXT, color: '#ff3b5c' };
  return GRADES.find(g => total >= g.min);
}
// A Unit member's loyalty as a word, like the meter bands
function loyBand(loy, ally, broken) {
  if (broken || loy <= 0) return { word: 'BROKEN', cls: 'danger' };
  if (ally) return { word: 'ALLY', cls: 'strong' };
  return loy <= 2 ? { word: 'WARY', cls: 'wary' } : { word: 'STEADY', cls: 'steady' };
}
function loyBandHtml(loy, ally, broken) { const b = loyBand(loy, ally, broken); return `<span class="lband ${b.cls}">${b.word}</span>`; }
function isAlly(n) { return !n.gone && (n.loy >= 5 || ((n.handpicked || (n.trait === 'cynic' && n.revealed)) && n.loy >= 4)); } // hand-picked (Talent Management) and Cynic: Ally at 4

/* ---------------- leaderboard storage ---------------- */
function loadBoard() { try { return JSON.parse(localStorage.getItem('sq_leaderboard') || '[]'); } catch (e) { return []; } }
function saveBoard(b) { try { localStorage.setItem('sq_leaderboard', JSON.stringify(b)); } catch (e) { } }
function sortBoard(b) { return b.slice().sort((x, y) => (x.gameOver - y.gameOver) || (y.score - x.score) || (y.low - x.low) || (y.stars - x.stars)); }
function normalizedRosterName(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function rosterNameIsPlayer(name, state = S) {
  const surname = normalizedRosterName(name), parts = surname.split(' ');
  return (state?.party || []).some(p => {
    const player = normalizedRosterName(p.name), words = player.split(' ');
    return (` ${player} `).includes(` ${surname} `)
      || player.replaceAll(' ','').endsWith(surname.replaceAll(' ',''))
      || (parts.length > 1 && parts.some(part => part.length >= 4 && words.includes(part)));
  });
}
function getRoster(state = S) {
  const option = ROSTER_OPTIONS.find(r => r.id === state?.rosterChoice) || ROSTER_OPTIONS[0];
  const names = [...new Set(option.names)].filter(name => !rosterNameIsPlayer(name, state));
  return { names, option };
}
function rosterPin(option, size = 44) {
  return `<img class="roster-rank-pin" src="${option.insignia}" alt="${esc(option.rank)}" style="width:${size}px;height:${size}px;object-fit:contain;flex:none">`;
}
function gmRoster() {
  return `<div class="gcard"><h2>Choose the game’s names</h2><p class="note">One roster supplies the commander, unit members, and other named characters. Player names are excluded. Lock the team’s choice below.</p>${ROSTER_OPTIONS.map((r,i) => `<div class="gchoice"><div class="row">${rosterPin(r,36)}<b>${i+1}. ${esc(r.name)}</b>${B('pickRoster','Select'+voteTag(r.id),{arg:r.id,cls:'go'})}</div><p class="note">${esc(r.names.join(' · '))}</p></div>`).join('')}</div>`;
}
function prepareFssPreview() {
  const names = shuffle(getRoster().names);
  S.fssNameOrder = names;
  S.fssDeployedName = names[3] || 'Unavailable'; // fourth NPC slot
  S.fssDeployedRank = (UNITS.find(u => u.id === 'ch').slots[3] || SLOTS[3]).rank;
}
function loadGrades() { try { return JSON.parse(localStorage.getItem('sq_grades') || '[]'); } catch (e) { return []; } }

/* =====================================================================
   GM ENGINE
   ===================================================================== */
let S = null;
let hist = [];
let FX = [];
let playerWin = null;
let projectorSeenAt = 0;
let fxSeq = 0;
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(IS_BOSS_PRACTICE ? 'practicum-boss-practice' : 'practicum-adventure') : null;

function newState() {
  return {
    phase: 'title', practice: IS_BOSS_PRACTICE, introPage: 0, party: [0, 1, 2, 3].map(() => ({ name: '', cls: '', perk: '', up: '', used: 0, av: null })),
    positionOrder: shuffle(CLASS_PICK_ORDER.map(c => c.id)), unitOrder: shuffle(UNITS.map(u => u.id)),
    rosterChoice: null, rosterNext: null, introExampleName: pickOne(getRoster().names),
    tokenHolder: 0, unit: null, npcs: [], cc: '', meters: { mis: 5, mor: 5, tru: 5, res: 5 },
    commStopsRemaining: 2, fssNameOrder: null, fssDeployedName: '', fssDeployedRank: 'SrA', mapSeed: null, mapRoll: 0,
    items: [], itemAward: null, flags: {}, ach: [], starsTotal: 0, intent: null, traitDone: {}, usedInjects: [], lossReductions: [],
    micCount: 0, micLow: false, crises: 0, crisisQueue: [], pendingNext: [], usedMissions: [],
    map: null, pos: { tier: -1, idx: null }, cur: null, inject: null, boss: null,
    gmCards: [], gmUsed: [], dcMod: 0, banner: null, timer: null, // gmCards: GM cards were removed
    log: [], offline: null, offlineNext: null, reveals: 0, lastTruLoss: 0,
    leveled: false, wp: null, gameOver: false, gameOverReasons: [], bossBonus: 0, callsign: '',
    saved: false, debrief: { view: 'objectives', spot: null }, stops: routeStops(), grades: {}, showBoard: false, muted: false,
    pending: { check: null, star: null, prepo: false }, usedLoot: [], routeRally: null,
    spinUntil: 0, gmNext: null, nodeCount: 0, final: null, wheel: null,
  };
}

// Selection order is randomized once per run and shared by every game screen.
const positionPickOrder = state => (state && state.positionOrder || CLASS_PICK_ORDER.map(c => c.id)).map(id => CLASS[id]).filter(Boolean);
const unitPickOrder = state => (state && state.unitOrder || UNITS.map(u => u.id)).map(id => UNITS.find(u => u.id === id)).filter(Boolean);

/* ---- sync ---- */
// The title screen is never saved, so opening the console can't overwrite the run you want to resume.
function save() { if (S.phase === 'title') return; try { localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(S)); } catch (e) { } }
// Which "screen" the game is on. When it changes, any running countdown ends,
// so a timer never carries over onto the next event.
function screenKey() {
  const c = S.cur, i = S.inject, b = S.boss;
  return [S.phase, S.introPage, S.nodeCount, c && c.type, c && c.step, c && c.mid,
    i && i.stage, i && i.forced, b && b.stage, b && b.round].join('|');
}
function push(quiet) {
  const key = screenKey();
  if (key !== S.screenKey) { if (S.screenKey !== undefined) S.timer = null; S.screenKey = key; }
  save();
  const fx = FX.map(f => ({ ...f, id: Date.now() + '-' + (++fxSeq) }));
  FX = [];
  const join = typeof roomCode === 'function' ? { code: roomCode(), url: joinUrl(), live: NET.status === 'live', full: typeof seatsFull === 'function' && seatsFull() } : null;
  const msg = { type: 'state', stateId: `${Date.now()}-${++fxSeq}`, S: shownState(), fx, board: sortBoard(loadBoard()), join };
  try { if (playerWin && !playerWin.closed) playerWin.postMessage(msg, '*'); } catch (e) { }
  try { bc && bc.postMessage(msg); } catch (e) { }
  if (typeof netBroadcast === 'function') netBroadcast();
  if (!quiet) renderGM();
}
// when a wheel/die animation finishes: unlock the GM buttons and show everyone the real result
function afterSpin() { if (spinning()) return; push(true); renderGM(); }
/* No spoilers: the engine applies a result the moment a wheel or die starts (new loot, meter
   changes, the next screen). While it spins, the projector and phones get the state from just
   before that click (the last undo snapshot) and see the outcome only once it lands. */
let VEIL = null, veilFor = 0;
function shownState() {
  if (!S || !spinning()) { VEIL = null; return S; }
  if (S.spinUntil !== veilFor) { veilFor = S.spinUntil; try { VEIL = hist.length ? JSON.parse(hist[hist.length - 1]) : null; } catch (e) { VEIL = null; } }
  return VEIL ? { ...VEIL, spinUntil: S.spinUntil, gmNext: S.gmNext, muted: S.muted, clients: S.clients } : S;
}
function snap() { hist.push(JSON.stringify(S)); if (hist.length > 60) hist.shift(); }
function emit(k, data = {}) {
  if (['dice', 'multiDice', 'roll', 'bossCombat', 'bossIntegrity'].includes(k) && S.gmNext) {
    const q = S.gmNext;
    const animationId = `dice-${Date.now()}-${++fxSeq}`;
    q.animations = q.animations || q.steps.map(() => null);
    q.animations[q.steps.length - 1] = animationId;
    data = { ...data, animationId };
  }
  const effect = { k, ...data }; FX.push(effect); return effect;
}
function sfx(n) { emit('sfx', { n }); }
function toast(icon, title, text) { emit('toast', { icon, title, text }); }
function log(t, d = '') { S.log.push({ n: S.nodeCount, t, d }); }
function dicePlaybackPending(q = S.gmNext) {
  const id = q?.animations?.[0];
  const projectorLive = (playerWin && !playerWin.closed) || Date.now() - projectorSeenAt < 10000;
  return !!(id && !(q.completed || []).includes(id) && Date.now() < q.playbackDeadline && projectorLive);
}
function spinning() { return Date.now() < S.spinUntil || dicePlaybackPending(); }
function updateGMNextReady(q) {
  if (S.gmNext !== q) return;
  if (q.after === 'bossResponse') {
    const id = q.animations?.[0];
    if ((id && (q.completed || []).includes(id)) || (q.clockReady && !dicePlaybackPending(q))) {
      if (S.boss?.hp <= 0) { finishBossTeamAction(q); push(true); renderGM(); return; }
      if (!q.responseDelayStarted) {
        q.responseDelayStarted = true;
        setTimeout(() => {
          if (S.gmNext !== q) return;
          finishBossTeamAction(q); push(true); renderGM();
        }, 1100);
      }
      q.ready = false; push(true); renderGM(); return;
    }
    q.ready = false; push(true); renderGM(); return;
  }
  q.ready = !!q.clockReady && !dicePlaybackPending(q);
  push(true); renderGM();
}
function armGMNext(q) {
  q.clockReady = false;
  q.playbackDeadline = Date.now() + q.steps[0] + 25000;
  setTimeout(() => { if (S.gmNext !== q) return; q.clockReady = true; updateGMNextReady(q); }, q.steps[0] + 80);
  // A closed/reloaded projector must not leave the console permanently locked.
  setTimeout(() => updateGMNextReady(q), q.steps[0] + 25100);
}
function acknowledgeDice(animationId) {
  const b = S.boss;
  if (S.phase === 'boss' && b?.stage === 'hotseat' && b.p2.rollIds?.includes(animationId)) {
    const i = b.p2.rollIds.indexOf(animationId);
    if (b.p2.settled[i]) return;
    b.p2.settled[i] = true;
    bossHotSeatResult(); push(true); renderGM(); return;
  }
  const q = S.gmNext;
  if (!q?.animations?.includes(animationId)) return;
  q.completed = q.completed || [];
  if (q.completed.includes(animationId)) return;
  q.completed.push(animationId);
  updateGMNextReady(q);
}
function queueGMNext(ms, after = null) {
  const q = S.gmNext || (S.gmNext = { steps: [], ready: false });
  q.steps.push(ms);
  if (q.animations) q.animations.push(null);
  if (after) q.after = after;
  if (q.steps.length === 1) {
    S.spinUntil = Math.max(S.spinUntil, Date.now() + ms);
    armGMNext(q);
  }
}
function spinWheel(title, slices, idx, hold) {
  queueGMNext(WHEEL_MS + (hold ? 2600 : 1500));
  S.spinUntil = Math.max(S.spinUntil, Date.now() + WHEEL_MS);
  S.wheel = { title, slices, idx };
  emit('wheel', { title, slices, idx, hold: !!hold });
  setTimeout(afterSpin, WHEEL_MS + 60);
}

/* ---- digital dice: the GM rolls, the projector animates the die ---- */
// A die with a table (lo, hi, label) first shows every possible outcome and sweeps across
// them (HYPE_MS) so the room knows what's at stake, then rolls and lights up the winner.
const DICE_MS = 2800, HYPE_MS = 6000;
function showDie(sides, v, title, result, table, goal) {
  const ms = table ? HYPE_MS + 1800 : DICE_MS + 1300;
  queueGMNext(ms);
  S.spinUntil = Math.max(S.spinUntil, Date.now() + ms);
  emit('dice', { sides, v, title, result, roller: S.lastActor, table: table || null, goal: goal || null });
  setTimeout(afterSpin, ms + 60);
}
function rollDie(sides, title, describe, table) {
  const v = 1 + rnd(sides);
  showDie(sides, v, title, describe ? describe(v) : '', table);
  return v;
}
// Plans Officer baseline: all BX costs are waived while the officer is active.
function stagedSupplyHolder(state = S) { return (state.party || []).find(p => !p.fired && CLASS[p.cls]?.ability?.id === 'prepo'); }
function enlistedForceMultiplierOn(S) { return (S.party || []).some(p => !p.fired && CLASS[p.cls] && CLASS[p.cls].ability && CLASS[p.cls].ability.id === 'enlistedfm'); }
function wheelFor(d6) { return S.inject?.foresight ? 'good' : injectTypeFor(d6); }
function injectTable() { return INJECT_ORDER.map(t => { const [lo, hi] = injectRange(t).split('-').map(Number), w = S.inject?.foresight ? 'good' : t; return { lo, hi: hi || lo, label: INJECT_WHEELS[w].name + (S.inject?.foresight ? ' (Foresight)' : ''), icon: INJECT_WHEELS[w].icon, color: INJECT_WHEELS[w].color }; }); }
const MYSTERY_TABLE = () => MYSTERY.map((m, i) => ({ lo: i + 1, hi: i + 1, label: m.name, icon: sceneIcon(m,32), color: m.color }));
// the table for whatever random event is waiting on a cadet's button (shown before they press it)
function actorTable(S) {
  const k = S.actor && S.actor.kind;
  return k === 'trigger' ? injectTable() : k === 'mystery' ? MYSTERY_TABLE() : null;
}
// A popup that explains a perk or ability the moment it is used; stays up until the GM continues
// A popup that stays up until the GM presses Continue. A second one waits its turn instead of replacing the first.
// The commander's badge (insignia/CommanderInsignia.svg) on a small silver disc so the black wreath shows on dark screens
function ccBadge(px) { return `<span class="ccbadge" style="width:${px}px;height:${px}px" title="Squadron Commander"></span>`; }
function notice(icon, title, text, label, cls) { // label: the small line above the title (default: perk / ability)
  const n = { icon, title, text, at: Date.now(), label: label || null, cls: cls || null };
  if (S.notice) (S.noticeQ = S.noticeQ || []).push(n); else S.notice = n;
  return n;
}
// Danger: a meter at 2 or less is one bad hit from a Crisis Event (or an Adverse Finding in the IG fight).
// Shown as one line on the projector and phones, with the tools that could help right now.
function dangerInfo(S) {
  if (!S || !['map', 'node', 'inject', 'boss'].includes(S.phase) || !S.meters) return null;
  const low = METERS.filter(m => S.meters[m.k] <= DIFFICULTY.dangerAt); if (!low.length) return null;
  const what = S.phase === 'boss' ? 'Adverse Finding' : 'Crisis Event', open = deocsOn(S);
  const tools = usableNow(S).filter(u => low.some(m => (u.hint || '').includes(m.icon)) || u.hint === '+3 to any meter').map(u => `${u.icon} ${u.label}`);
  const end = S.crises ? ' (a second one = GAME OVER)' : '';
  return { text: low.map(m => S.meters[m.k] === 0 ? `${m.label} ${open ? '0' : 'has bottomed out'}: ${what} incoming${end}` : `${m.label} ${open ? S.meters[m.k] : 'is in DANGER'}: a bad hit could mean a ${what}${end}`).join(' · '), tools: [...new Set(tools)] };
}
// Hidden meters: the projector and phones show a band, not the number, unless a DEOCS Survey is running
// (or the game is over). S.deocsUntil = the last stop (S.nodeCount) the survey covers.
function deocsOn(S) { return !!S && (['results', 'debrief'].includes(S.phase) || (S.deocsUntil != null && (S.nodeCount || 0) <= S.deocsUntil)); }
function deocsLeft(S) { return S && S.deocsUntil != null ? Math.max(0, S.deocsUntil - (S.nodeCount || 0)) : 0; }
function meterBand(v) { return v <= DIFFICULTY.dangerAt ? { word: '!DANGER!', cls: 'danger' } : v >= 7 ? { word: 'STRONG', cls: 'strong' } : { word: 'STEADY', cls: 'steady' }; }
function runDeocs() {
  S.deocsUntil = Math.max(S.deocsUntil != null ? S.deocsUntil : -1, (S.nodeCount || 0) + DIFFICULTY.deocsStops);
  log('DEOCS Survey', `Exact meters visible through stop ${S.deocsUntil}`);
}
// chips naming the practicum objectives an event tests (e.g. ⚖️ AUTHORITY)
function objChips(m) { return objOf(m).map(id => `<span class="objchip"><i>${OBJECTIVE[id].icon}</i> ${OBJECTIVE[id].short}</span>`).join(''); }
// Which practicum objectives each event tested (shown in the Reality Debrief)
function logObj(m, ch) {
  const ids = objOf(m); if (!ids.length) return;
  S.objLog = (S.objLog || []).concat({ n: S.nodeCount, title: m.title, icon: m.icon, choice: ch ? fill(S, ch) : '', obj: ids });
}

/* ---- queries ---- */
const party = () => S.party.filter(p => p.name.trim());
const hasPerk = p => S.party.some(c => c.name && !c.fired && c.perk === p);
const hasUp = u => S.party.some(c => c.name && !c.fired && c.up === u);
const hasClass = id => S.party.some(c => c.name && !c.fired && c.cls === id);
// the cadet whose ability is Commander's Confidant (the XO), or -1
function confidantIdx(S) { return (S.party || []).findIndex(p => !p.fired && CLASS[p.cls] && CLASS[p.cls].ability && CLASS[p.cls].ability.id === 'confidant'); }
const unitObj = () => (S.unit ? UNITS.find(u => u.id === S.unit) : null);
const npc = s => S.npcs.find(n => n.slot === s);
const fcIdx = () => S.party.findIndex(c => c.cls === 'fc' && !c.fired);
const cadetName = i => (S.party[i] ? rankName(S.party[i]) : '?');
function curMission() {
  const c = S.cur; if (!c) return null;
  if (c.type === 'spot') {
    const scene = c.sid ? SPOTLIGHTS.find(x => x.id === c.sid) : MISSIONS.find(x => x.id === c.mid);
    return c.nominationScene || (scene?.id === 'SP_fc' ? nominationScene(S, scene) : scene);
  }
  if (c.type === 'crisisEvent') { const C = CRISES[c.meter]; return { title: C.title, icon: C.icon, sob: 'CRISIS EVENT', text: c.death || '', loss: c.lost || C.loss, help: !!C.help, choices: C.choices }; }
  if (c.wing) return WING_VISIT;
  return MISSIONS.find(m => m.id === c.mid);
}

// Don't draw a scene that names a Unit member who has permanently left the squadron.
function nominationScene(state, scene) {
  const present = (state.npcs || []).filter(n => !n.gone && !n.deceased && !n.out);
  const juniors = present.filter(n => ['AB','Amn','A1C','SrA'].includes(n.rank));
  const ncos = present.filter(n => ['SSgt','TSgt'].includes(n.rank));
  const candidates = juniors.length >= 2 ? juniors : ncos.length >= 2 ? ncos : null;
  if (!candidates) return null;
  const first = candidates.find(n => n.slot === 'D') || candidates[0];
  const second = candidates.find(n => n !== first && n.slot === 'B') || candidates.find(n => n !== first);
  const slots = { D: first.slot, B: second.slot }, nco = candidates === ncos;
  // Remap both the dialogue and the loyalty effects to the actual nominees.
  const remap = value => {
    if (typeof value === 'string') {
      const text = value.replace(/\{([DB])\}/g, (_, slot) => `{${slots[slot]}}`);
      return nco ? text.replace(/Airman of the Quarter/g, 'NCO of the Quarter').replace(/AIRMAN OF THE QUARTER/g, 'NCO OF THE QUARTER').replace(/junior enlisted category/g, 'NCO category') : text;
    }
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [slots[key] || key, remap(item)]));
    return value;
  };
  return remap(scene);
}
function rosterFitsScene(scene) {
  if (scene.id === 'SP_fc') { scene = nominationScene(S, scene); if (!scene) return false; }
  const text = [scene.text, ...(scene.choices || []).map(c => c.t)].join(' ');
  return [...text.matchAll(/\{([ABCD])\}/g)].every(([, slot]) => !npcOf(S, slot)?.gone);
}

/* ---- effects ---- */
function meterLossPreview(k, amount, state = S) {
  const id = { mor: 'engine', tru: 'golden', mis: 'proficiency', res: 'contingency' }[k];
  const owner = state.party.find(p => p.name && !p.fired && p.up === id);
  const upgrade = owner && CLASS[owner.cls]?.ups.find(u => u.id === id);
  const loss = upgrade && amount > 1 ? amount - 1 : amount;
  return { loss, reduction: loss < amount ? { name: upgrade.name, meter: k, from: amount, to: loss } : null };
}
function lossReductionText(r) { return `🛡️ ${r.name}: ${METER[r.meter].icon} ${METER[r.meter].label} loss ${r.from} → ${r.to}`; }
function applyEff(e, opt = {}) {
  if (!e) return;
  const d = [];
  const maxed = [];
  if (e.set) for (const k in e.set) { const old = S.meters[k]; S.meters[k] = e.set[k]; if (old !== e.set[k]) d.push([k, e.set[k] - old]); }
  for (const m of METERS) {
    let v = e[m.k]; if (!v) continue; const k = m.k;
    if (v > 0) {
      if (opt.double) v *= 2;
      ccHook('gain').forEach(h => { if (h.k === k) v = Math.max(0, v + h.d); });
      if (k === 'tru' && S.babysit > 0) v = Math.max(0, v - 1); // the CC's babysitter takes the credit
    } else {
      const reduced = meterLossPreview(k, -v);
      if (reduced.reduction) {
        (S.lossReductions = S.lossReductions || []).push(reduced.reduction);
        log('Loss reduced', lossReductionText(reduced.reduction));
      }
      v = -reduced.loss;
      if (k === 'tru' && opt.late) ccHook('late').forEach(h => { v *= 2; ccReact(h, 'Bad news delivered late: ⭐ loss doubled'); });
    }
    const old = S.meters[k];
    let nv = Math.max(0, Math.min(10, old + v));
    S.meters[k] = nv;
    if (nv !== old) d.push([k, nv - old]);
    else if (v > 0 && old >= 10) {
      maxed.push(k);
      const target = S.phase === 'inject' && S.inject ? S.inject : S.phase === 'node' && S.cur ? S.cur : null;
      if (target) target.maxedGains = [...new Set([...(target.maxedGains || []), k])];
    }
    if (k === 'tru' && nv < old) S.lastTruLoss = old - nv;
  }
  if (e.loy) for (const s in e.loy) changeLoy(s, e.loy[s]);
  if (e.traitLoy) S.npcs.filter(n => n.trait === e.traitLoy.trait).forEach(n => changeLoy(n.slot, e.traitLoy.d));
  if (e.traitAny) {
    const t = e.traitAny, list = t.slot ? [npc(t.slot)] : S.npcs, traits = t.traits || [t.trait];
    if (list.some(n => n && traits.includes(n.trait))) applyEff(t.eff, opt);
  }
  if (e.reveal) reveal(e.reveal);
  if (e.flag) S.flags[e.flag] = true;
  if (e.flag === 'BABYSITTER') S.babysit = 2;
  if (e.ach) award(e.ach);
  if (e.next) S.pendingNext.push(e.next);
  if (e.offlineSelf && S.cur && S.cur.slot != null) { S.offlineNext = S.cur.slot; log('Offline', `${cadetName(S.cur.slot)} is offline next stop`); }
  if (d.length || maxed.length) {
    if (d.length) emit('deltas', { d });
    const changes = d.map(([k, v]) => METER[k].icon + sign(v));
    changes.push(...maxed.map(k => `${METER[k].icon}+0 (Max ${METER[k].name})`));
    log('Meters', changes.join(' ') + (e.why ? ` (${e.why})` : ''));
  }
  checkZero();
}
// Trait rewards fire automatically (once per member unless noted) with a card everyone sees
function traitReward(n, text, eff, loy) {
  if (!n || n.broken || (S.traitDone || {})[n.slot]) return;
  S.traitDone = { ...(S.traitDone || {}), [n.slot]: true };
  const t = TRAIT[n.trait];
  notice(t.icon, `${n.rank} ${n.name}`.toUpperCase() + ` · ${t.name.toUpperCase()}`, text, 'UNIT MEMBER · TRAIT REWARD'); sfx('loot');
  log('Trait', `${n.rank} ${n.name} (${t.name}): ${text}`);
  if (loy) changeLoy(n.slot, loy);
  if (eff) applyEff({ ...eff, why: t.name });
}
// What the org chart says about a Unit member's trait: who they are; the reward only once it's earned
// (Ally, or it already fired) and the breaking point only once they hit it. (The GM console shows everything.)
function traitInfo(n, ally, done) {
  const t = TRAIT[n.trait]; if (!t) return [];
  return [['what', t.what], (ally || done) && ['reward', `🎁 ${t.reward}`], n.broken && ['bp', `💔 ${t.bpText}`]].filter(Boolean);
}
const withTrait = id => (S.npcs || []).filter(n => n.trait === id && !n.broken && !n.gone);
// Family Crisis: the first time the First Sergeant or a Rest Stop shows them care
function traitCare() { withTrait('family').forEach(n => traitReward(n, 'Someone noticed what was going on at home. They won\'t forget it.', { mor: 1 }, 2)); }
// Rule Bender at loyalty 4+: integrity-trap choices get a tell
function benderTell(S) { return (S.npcs || []).some(n => n.trait === 'bender' && !n.broken && n.loy >= 4); }

// The commander's perks: each squadron's cc.pos / cc.neg hook (the XO's Commander's Confidant switches off neg)
function ccHook(type) {
  const u = unitObj(); if (!u || !u.cc) return [];
  return ['pos', 'neg'].filter(side => !(side === 'neg' && S.flags.ccNegOff) && u.cc[side].hook[type] !== undefined)
    .map(side => ({ ...(typeof u.cc[side].hook[type] === 'object' ? u.cc[side].hook[type] : {}), side, name: u.cc[side].name }));
}
// Compartmented (Intel commander): no ▲▼ arrows for the cadets unless Read the Room revealed the effects
function arrowsHidden(S) { return !!(S.cur && !S.cur.intel && ccHook('noArrows').length); }
function ccReact(h, text) {
  toast(h.side === 'pos' ? '👍' : '👎', `${S.cc.toUpperCase()} ${h.side === 'pos' ? 'APPROVES' : 'DISAPPROVES'}: ${h.name.toUpperCase()}`, text);
  log('Commander', `${h.name}: ${text}`);
}
// A hook's effect is either { m, eff } (afterPass/afterFail) or the effect itself (idea, stars1, stars3, rest, depotTax)
function ccApply(type, text, filter) {
  ccHook(type).forEach(h => {
    if (filter && !filter(h)) return;
    const eff = h.eff || Object.fromEntries(Object.entries(h).filter(([k]) => !['side', 'name', 'm'].includes(k)));
    applyEff({ ...eff, why: h.name }); ccReact(h, `${text}: ${effText(S, eff)}`);
  });
}
function changeLoy(s, v) {
  const n = npc(s); if (!n || !v || n.gone) return;
  S.flags = S.flags || {};
  const old = n.loy, wasAlly = isAlly(n);
  let next = Math.max(0, Math.min(5, n.loy + v));
  const openDoor = (S.party || []).some(p => !p.fired && CLASS[p.cls] && CLASS[p.cls].ability && CLASS[p.cls].ability.id === 'openDoor');
  const savedByFirstShirt = openDoor && !S.flags.openDoorUsed && old > 0 && next === 0 && !n.broken;
  if (savedByFirstShirt) { next = 2; S.flags.openDoorUsed = true; }
  n.loy = next;
  if (n.loy !== old) emit('loyDelta', { who: `${n.rank} ${n.name}`, v: n.loy - old });
  if (savedByFirstShirt) {
    const msg = `${n.rank} ${n.name} was about to hit a Breaking Point. The First Sergeant's Open Door Policy brought them back to 2 loyalty.`;
    notice('🚪', 'OPEN DOOR POLICY', msg); log('Ability', msg);
  }
  if (n.loy === 0 && old > 0 && !n.broken) breaking(n);
  if (!wasAlly && isAlly(n)) {
    const t = TRAIT[n.trait];
    const allyDmg = enlistedForceMultiplierOn(S) ? 3 : 2;
    notice('🤝', `NEW ALLY: ${n.rank} ${n.name}`.toUpperCase(), `${t ? `${t.icon} ${t.name}: ${t.reward}. ` : ''}In the IG fight, every Ally deals ${allyDmg} damage during Support${allyDmg === 3 ? ' (Enlisted Force Multiplier)' : ''}.`, 'UNIT MEMBER · LOYALTY MAXED'); sfx('loot');
    if (S.npcs.filter(isAlly).length >= 2) award('opendoor');
    if (n.trait === 'mentor') { traitReward(n, 'Empowered to train others, they take the newest Airman under their wing.', { mis: 1, mor: 1 }); if (n.slot !== 'B') changeLoy('B', 2); }
  }
  if (n.trait === 'silent' && old < 4 && n.loy >= 4) traitReward(n, 'They finally asked for help, and the work shows it.', { mis: 2 });
}
function breaking(n) {
  const t = TRAIT[n.trait];
  n.broken = true; S.flags.npcZero = true;
  if (!n.revealed) { n.revealed = true; S.reveals++; }
  notice('💔', `BREAKING POINT: ${n.rank} ${n.name}`.toUpperCase(), `${t.icon} ${t.name}: ${t.bpText}. A broken Unit member also adds ${DIFFICULTY.witnessHp} HP to the IG.`, 'UNIT MEMBER · LOYALTY 0', 'bad');
  sfx('bad');
  log('Breaking point', `${n.rank} ${n.name}: ${t.bpText}`);
  const { out, flag, ...m } = t.bp;
  if (out) n.out = out;
  if (flag) S.flags[flag] = true;
  applyEff(m);
}
function reveal(s) { // every trait is visible now; kept so older mission effects still work
  const n = npc(s); if (n) n.revealed = true;
}
function award(id) {
  if (S.ach.includes(id)) return;
  S.ach.push(id);
  emit('ach', { aid: id }); log('Achievement', ACH[id].name); // not 'id': push() stamps every fx with its own id
}
function checkZero() {
  // Hold the Line is a selected passive: automatically save the first meter that reaches zero.
  const holder = (S.party || []).find(p => p.cls === 'fc' && !p.fired && p.perk === 'hold');
  const saved = METERS.find(m => S.meters[m.k] === 0);
  if (holder && !S.flags['perkUsed_hold'] && saved && !S.gameOver) {
    S.meters[saved.k] = 3;
    S.flags['perkUsed_hold'] = true;
    S.crisisQueue = (S.crisisQueue || []).filter(k => k !== saved.k);
    emit('deltas', { d: [[saved.k, 3]] });
    notice('🛡️', 'HOLD THE LINE', `${cadetName(S.party.indexOf(holder))} automatically restores ${saved.label} to 3. That Crisis Event is prevented.`);
    log('Hold the Line', `${saved.label} restored to 3; Crisis Event prevented`);
  }
  // in the boss fight there is no next stop: a meter at 0 is an Adverse Finding (it counts as a crisis)
  if (S.phase === 'boss' && S.boss) {
    const Bs = S.boss;
    for (const m of METERS) if (S.meters[m.k] === 0) {
      if (S.crises >= 1) { crisisGameOver(m.k); return; } // a second crisis is the end, even mid-inspection
      S.crises++;
      S.meters[m.k] = 1; Bs.hp += DIFFICULTY.adverseHeal; Bs.adverse = true;
      bossLog(`🚨 ADVERSE FINDING: ${m.name} hit 0. IG +${DIFFICULTY.adverseHeal} HP; attack rolls −1 for the rest of the fight. Another one = GAME OVER.`);
      notice('🚨', 'ADVERSE FINDING', `${m.name} hit zero and resets to 1. IG +${DIFFICULTY.adverseHeal} HP; attack rolls −1. Another meter at zero = GAME OVER.`, 'INSPECTION EFFECT', 'bad');
      sfx('alarm'); log('Adverse finding', m.name);
    }
    return;
  }
  if (S.phase === 'results' || S.gameOver) return;
  for (const m of METERS) {
    if (S.meters[m.k] === 0 && !S.crisisQueue.includes(m.k)) {
      S.crisisQueue.push(m.k);
      emit('big', { cls: 'bad', title: S.crises ? 'SECOND CRISIS: GAME OVER INCOMING' : 'CRISIS INCOMING', icon: '🚨',
        text: S.crises ? `${m.name} hit zero. Your flight already had one Crisis Event. Unless something brings ${m.label} back up before this is resolved, it's over.`
          : `${m.name} hit zero! A Crisis Event strikes the moment this is resolved, and it will cost you something you can't get back.` });
      sfx('alarm');
      log('Crisis queued', m.name + ' hit 0');
    }
  }
}
/* ---- crisis events: a meter at 0 is a casualty ----
   The crisis strikes as soon as the current event is resolved (the GM's Continue). Its loss is permanent,
   then the team picks how to dig out. A second crisis is GAME OVER. resume = what to do afterwards. */
function crisisNow(resume) {
  S.crisisQueue = (S.crisisQueue || []).filter(k => S.meters[k] === 0); // fixed in time (an item, a perk)? no crisis
  if (!S.crisisQueue.length || S.gameOver) return false;
  const k = S.crisisQueue.shift();
  S.resume = resume || 'advance';
  if (S.crises >= 1) { crisisGameOver(k); return true; }
  S.crises++;
  S.phase = 'node'; S.inject = null; S.actor = null; S.votes = {}; S.banner = null; S.wheel = null;
  const C = CRISES[k], lost = crisisLoss(k);
  let death = fill(S, typeof C.death === 'object' ? C.death[S.unit] || Object.values(C.death)[0] : C.death);
  if (k === 'mor') {
    const member = S.npcs.find(n => n.deceased);
    if (member) death = `${member.rank} ${member.name}, one of the people in your unit, died by suicide. The flight is grieving.`;
  }
  // no Flight Commander in the party: the CC relieves whoever was leading (the 👑 holder crisisLoss just fired)
  if (k === 'tru' && fcIdx() < 0) { const f = S.party.findIndex(c => c.fired); death = fill(S, `{CC} calls you in: "I no longer have confidence in your flight's leadership."${f >= 0 ? ` ${cadetName(f)}, the acting lead, is relieved, effective now.` : ''}`); }
  snapBase();
  S.cur = { type: 'crisisEvent', meter: k, step: 'brief', choice: null, intel: false, death, lost };
  emit('flash'); sfx('alarm');
  emit('big', { cls: 'bad', icon: C.icon, title: `CRISIS EVENT: ${C.title}`, text: death });
  log('CRISIS EVENT', `${C.title}: ${death} ${lost}`);
  return true;
}
// What a crisis takes for good. Returns the text shown on the crisis screen.
function crisisLoss(k) {
  if (k === 'mis') {
    S.flags.MISSION_FAIL = true;
    const eligible = S.party.map((p, i) => ({ p, i, bonus: statOf(i, 'CMD') + (isSpec(i, 'mis') ? 1 : 0) })).filter(c => c.p.name && c.p.cls && !c.p.fired);
    if (!eligible.length) return 'No active cadet remains to dismiss.';
    const lowest = Math.min(...eligible.map(c => c.bonus));
    const tied = eligible.filter(c => c.bonus === lowest);
    const chosen = pickOne(tied);
    fireCadet(chosen.i, 'mis');
    return `${S.cc || 'The commander'} fires ${cadetName(chosen.i)}: lowest CMD + Mission specialty bonus (${sign(lowest)})${tied.length > 1 ? '; randomly selected among tied cadets' : ''}. No votes, rolls, abilities, perks or upgrades for the rest of the game.`;
  }
  if (k === 'mor') {
    S.flags.LOST_AIRMAN = true;
    const eligible = S.npcs.filter(n => !n.gone);
    const priority = eligible.filter(n => ['burnout', 'silent'].includes(n.trait));
    const member = (priority.length ? priority : eligible).sort((a, b) => a.loy - b.loy)[0];
    if (member) { member.deceased = true; member.gone = true; member.out = 999; }
    S.npcs.filter(n => !n.gone).forEach(n => changeLoy(n.slot, -1));
    return member ? `${member.rank} ${member.name} is permanently lost. Every remaining Unit member −1 loyalty.` : CRISES.mor.loss;
  }
  if (k === 'tru') {
    // the Flight Commander, or the 👑 holder when the party has no FC; only one cadet is ever fired
    const f = S.party.some(c => c.fired) ? -1 : fcIdx() >= 0 ? fcIdx() : nextInChain(S);
    if (f < 0) return 'Nobody is relieved this time: there is no one left to fire.';
    fireCadet(f, 'tru');
    S.crown = -1; S.tokenHolder = -1;
    return `${cadetName(f)} is FIRED: no votes, rolls or perk for the rest of the game. Captain Russell decides tied votes.`;
  }
  if (k === 'res') {
    S.items = [];
    const n = S.npcs.filter(x => !x.gone).sort((a, b) => a.loy - b.loy)[0];
    if (n) { n.gone = true; n.out = 999; return `${n.rank} ${n.name} quit the unit for good, and every team item is gone.`; }
    return CRISES.res.loss;
  }
  return '';
}
function fireCadet(index, cause) {
  S.party[index].fired = true;
  S.party[index].firedCause = cause;
  if (S.tokenHolder === index) S.tokenHolder = -1;
  if (S.crown === index) S.crown = -1;
  delete (S.votes || {})[index];
  S.requests = (S.requests || []).filter(r => r.slot !== index);
}
function crisisGameOver(k) {
  const C = CRISES[k];
  gameOver([`SECOND CRISIS EVENT: ${C.title} (${METER[k].label} hit zero again). The Group Commander relieves the entire flight leadership team.`], 'crisis');
}
// After a crisis is resolved: pick up where the game was
function crisisResume() {
  const r = S.resume; S.resume = null;
  if (r === 'node') return afterNode();
  if (r && r.k === 'inject') return r.fromNode ? afterNode(true) : advance();
  if (r && r.k === 'enter') { const node = S.map.tiers[r.t][r.i]; return enterNode(node.type, node); }
  return advance();
}

/* ---- rolls ---- */
function statOf(i, stat) {
  const c = S.party[i]; if (!c || !c.cls || c.fired) return 0;
  const up = CLASS[c.cls].ups.find(u => u.id === c.up);
  return (CLASS[c.cls].stats[stat] || 0) + ((up && up.stats && up.stats[stat]) || 0) + ((c.train || {})[stat] || 0);
}
// What a cadet adds to a check, as one number: stat + 1 if the check is their specialty
const isSpec = (i, m) => { const p = S.party[i], cl = p && !p.fired && CLASS[p.cls]; return !!(cl && (cl.spec || []).includes(m)); };
function squadD20Penalty() { return S.unit === 'wk' ? -1 : 0; }
function rollBonus(i, stat, m) { return (stat && stat !== 'LOYB' ? statOf(i, stat) + (isSpec(i, m) ? 1 : 0) : 0) + squadD20Penalty(); }
// The default roller: whoever adds the most (anyone can volunteer instead)
function bestRoller(stat, m) {
  let best = -99, bi = 0;
  S.party.forEach((_, i) => { if (isOut(S, i)) return; const v = rollBonus(i, stat, m); if (v > best) { best = v; bi = i; } });
  return bi;
}
// Lean on Experience (FC base ability, passive): +2 on every d20 check while the FC is in the party
function leanBonus(S) { return (S.party || []).some(p => !p.fired && CLASS[p.cls] && CLASS[p.cls].ability && CLASS[p.cls].ability.id === 'lean') ? 2 : 0; }
function rollCalc(check, roller, d20, o = {}) {
  const parts = []; let total = d20;
  if (check.stat === 'LOYB') { const n = npc('B'); parts.push([`${n.rank} ${n.name} loyalty`, n.loy]); total += n.loy; }
  else if (check.stat) {
    let sv = statOf(roller, check.stat), lbl = `${cadetName(roller)} ${check.stat}`;
    parts.push([lbl, sv]); total += sv;
    const cl = S.party[roller] && !S.party[roller].fired && CLASS[S.party[roller].cls];
    if (cl && (cl.spec || []).includes(check.m)) { parts.push(['Specialist', 1]); total += 1; }
  }
  const mv = S.meters[check.m];
  if (mv >= 8) { parts.push([`${METER[check.m].icon} high`, 2]); total += 2; }
  else if (mv <= 2) { parts.push([`${METER[check.m].icon} low`, -2]); total -= 2; }
  if (leanBonus(S)) { parts.push(['📖 Lean on Experience', leanBonus(S)]); total += leanBonus(S); }
  if (S.unit === 'wk') { parts.push(['🔧 Flightline penalty', -1]); total -= 1; }
  const bonusItem = o.bonusItem && LOOT.find(l => l.id === o.bonusItem);
  if (bonusItem) { parts.push([`${bonusItem.icon} ${bonusItem.name}`, bonusItem.use.n]); total += bonusItem.use.n; }
  const dc = checkDC(check);
  const nat = o.safe ? 0 : d20 === 20 ? 20 : d20 === 1 ? 1 : 0; // playing it safe: no crits, no fumbles
  const pass = nat === 20 || (nat !== 1 && total >= dc);
  return { total, parts, dc, pass, nat, d20, safe: !!o.safe };
}
// The target number for a check: base + difficulty, squadron quirks, commander effects, Loaded Dice.
function checkDC(check) {
  let dc = check.dc + DIFFICULTY.dcPlus;
  if (ccHook('hard').some(h => h.m === check.m)) dc = Math.max(dc, DC_HARD);
  return dc + squadCheckDcPenalty(check) + (S.dcMod || 0);
}
function squadCheckDcPenalty(check) {
  let n = 0;
  return n;
}
// "d20 +5 · need 10+ (55%)" or, playing it safe, "safe 8 +5 = 13 vs 15: FAIL"
function rollOdds(p, safe) {
  if (safe) { const t = DIFFICULTY.safeRoll + p.total; return `safe ${DIFFICULTY.safeRoll} ${sign(p.total)} = ${t} vs ${p.dc}: ${t >= p.dc ? 'PASS' : 'FAIL'}`; }
  const need = Math.min(20, Math.max(2, p.dc - p.total));
  return `d20 ${sign(p.total)} vs ${p.dc} · GOAL DIE ${need}+ (${(21 - need) * 5}%)`;
}
// One cadet's odds as the roller (shown in the roller vote): stat bonus, need, specialist
function rollerOdds(S, i) {
  const c = S.cur, ch = c.spec.check, p = rollCalc(ch, i, 0, { bonusItem: S.pending.check });
  return { stat: ch.stat, bonus: p.total, spec: isSpec(i, ch.m), need: Math.min(20, Math.max(2, p.dc - p.total)) };
}
function tackleOdds(S, m, i) { const k = tackleInfo(m, i); return { stat: k.stat, bonus: k.bonus, spec: isSpec(i, m.tackle.m), need: k.need }; }
function rollPreview() {
  const c = S.cur, r = c.roller ?? bestRoller(c.spec.check.stat, c.spec.check.m);
  return rollCalc(c.spec.check, r, 0, { bonusItem: S.pending.check, safe: c.safe });
}

/* ---- map ---- */
// 7, 6 or 5 stops (the GM picks before the map opens), then the IG. Slay the Spire style, but every
// stop has a ROLE (a beat), so every run follows the same arc and only the details change:
//   opener (❓ or ⚔️) → warm-up → the test (💀 or 🔦) → supply → final push (💀, ⚔️ or ❓) → one 🏕️ Rest Stop → IG.
// Each beat lists the nodes it always offers (fixed) and what fills the rest (fill: weights).
// Scenarios can repeat at a stop; other types can't. Paths branch and merge at random (never crossing).
const ROUTE_BEATS = {
  open:   { name: 'Opener',     fixed: ['unknown', 'crisis'], fill: [['crisis', 100]],                             width: [2, 3] },
  warm:   { name: 'Warm-up',    fixed: ['crisis'],          fill: [['crisis', 45], ['unknown', 25], ['spot', 30]], width: [2, 3] },
  test:   { name: 'The test',   fixed: ['elite', 'spot'],   fill: [],                                              width: [2, 2] },
  supply: { name: 'Supply run', fixed: ['depot'],           fill: [['crisis', 60], ['unknown', 40]],               width: [2, 3] },
  push:   { name: 'Mid push',   fixed: ['crisis'],          fill: [['unknown', 40], ['spot', 30], ['crisis', 30]], width: [2, 3] },
  final:  { name: 'Final push', fixed: ['elite', 'crisis', 'unknown'], fill: [],                                   width: [3, 3] },
  prep:   { name: 'Prep',       fixed: ['rest'],            fill: [],                                              width: [1, 1] }, // always one Rest Stop before the IG
};
// Route length: the GM picks 7, 6 or 5 stops (remembered in this browser). Shorter routes drop middle
// beats but always keep the opener, the test, the final push and the Rest Stop.
const STOP_PLANS = {
  7: ['open', 'warm', 'test', 'supply', 'push', 'final', 'prep'],
  6: ['open', 'warm', 'test', 'supply', 'final', 'prep'],
  5: ['open', 'warm', 'test', 'final', 'prep'],
};
const MAP_RULES = { unknowns: [2, 3] }; // [min, max] ❓ per map (the opener and the final push always have one)
const routeStops = () => { const n = +((S && S.stops) || localStorage.getItem('sq_stops') || 6); return STOP_PLANS[n] ? n : 6; };
const levelAfter = () => (S.map && S.map.levelAfter) || 3;
function rollMap(random = Math.random) {
  const weighted = bag => {
    let r = random() * bag.reduce((a, b) => a + b[1], 0);
    for (const [k, w] of bag) { if ((r -= w) < 0) return k; }
    return bag[0][0];
  };
  // 🔦 spotlights: at most DIFFICULTY.spotlights per map (never more than there are cadets). WHO is in the
  // spotlight is rolled on arrival. The test's spotlight is handed out first; one past the cap becomes a Scenario.
  let spots = Math.min(DIFFICULTY.spotlights, S.party.length);
  const n = routeStops(), plan = STOP_PLANS[n], tiers = plan.map(() => null);
  const order = plan.map((_, t) => t).sort((a, b) => (plan[b] === 'test') - (plan[a] === 'test'));
  for (const t of order) {
    const beat = ROUTE_BEATS[plan[t]], [lo, hi] = beat.width, w = lo + Math.floor(random() * (hi - lo + 1));
    const types = beat.fixed.slice(0, w);
    let pool = beat.fill.filter(x => x[0] === 'crisis' || !types.includes(x[0]));
    while (types.length < w && pool.length) { const k = weighted(pool); types.push(k); if (k !== 'crisis') pool = pool.filter(x => x[0] !== k); }
    const row = types.map(type => {
      if (type === 'spot') { if (spots > 0) spots--; else type = 'crisis'; }
      return { type, done: false };
    });
    for (let i = row.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [row[i], row[j]] = [row[j], row[i]]; }
    tiers[t] = row;
  }
  // links: a random "staircase" walk between neighbouring stops, so paths branch and merge
  // but never cross, and every node has a way in and a way out
  const links = tiers.map((row, t) => {
    const next = tiers[t + 1]; if (!next) return row.map(() => []);
    const out = row.map(() => []); let i = 0, j = 0; out[0].push(0);
    while (i < row.length - 1 || j < next.length - 1) {
      const canI = i < row.length - 1, canJ = j < next.length - 1, r = random();
      if (canI && canJ && r < 0.45) { i++; j++; }
      else if (canI && (!canJ || r < 0.72)) i++;
      else j++;
      if (!out[i].includes(j)) out[i].push(j);
    }
    return out;
  });
  return { tiers, links, beats: plan, levelAfter: n >= 7 ? 4 : 3 };
}
// The beats fix the arc; this only keeps the ❓ count in range.
function mapOk(m) {
  const unk = m.tiers.flat().filter(x => x.type === 'unknown').length;
  return unk >= MAP_RULES.unknowns[0] && unk <= MAP_RULES.unknowns[1];
}
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function genMap(seed = (Math.random() * 0xFFFFFFFF) >>> 0) {
  const random = seededRandom(seed);
  let m;
  for (let i = 0; i < 300; i++) { m = rollMap(random); if (mapOk(m)) break; }
  if (S.unit === 'gg') {
    const candidates = m.tiers.flatMap((tier, t) => tier.map((node, i) => node.type === 'crisis' ? [t, i] : null).filter(Boolean));
    for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    candidates.slice(0, 2).forEach(([t, i]) => { m.tiers[t][i].type = 'elite'; });
  }
  m.seed = seed >>> 0;
  return m;
}
const lastTier = () => (S.map ? S.map.tiers.length - 1 : 0);
function available() {
  if (!S.map) return [];
  if (S.pos.tier === -1) return S.map.tiers[0].map((_, i) => [0, i]);
  if (S.pos.tier >= lastTier()) return [];
  if (S.wp && S.wp.queue.length) return []; // a checkpoint (inject / level up) comes first: pick its waypoint
  if (S.branch) return S.map.tiers[S.pos.tier + 1].map((_, i) => [S.pos.tier + 1, i]); // Branch Plan
  if (S.wp && S.wp.dest != null) return S.wp.dest === 'boss' ? [] : [[S.pos.tier + 1, S.wp.dest]]; // the waypoint locked in the path
  return S.map.links[S.pos.tier][S.pos.idx].map(i => [S.pos.tier + 1, i]);
}
// The First Sergeant can trade encounter types between two stops the flight can actually reach next.
function rallyRouteNodes(state = S) {
  if (!state.map || !state.pos || state.pos.tier >= lastTier()) return [];
  const tier = state.pos.tier + 1;
  let coords;
  if (state.wp && state.wp.queue.length && state.wp.dest == null) {
    const indices = state.branch ? state.map.tiers[tier].map((_, i) => i) : state.map.links[state.pos.tier][state.pos.idx];
    coords = indices.map(i => [tier, i]);
  } else coords = available().filter(([t]) => t === tier);
  return coords.filter(([t, i]) => state.map.tiers[t][i] && !state.map.tiers[t][i].visited);
}

/* Checkpoints (🎡 inject, ⬆️ level up) sit between stops. After a stop with checkpoints the route map opens and
   the team picks a waypoint, one on every path out of their stop, like any other node. Picking it runs the
   checkpoint AND locks in that path to the next stop. S.wp = { k: map column, queue: kinds still ahead,
   done: kinds finished, cur: kind running now, dest: next-column index (or 'boss') }. */
function checksAfter(m, k) { return [injectAfter(k) && 'inject', k === ((m && m.levelAfter) || 3) - 1 && 'level'].filter(Boolean); }
const CHECKPOINT = { inject: { icon: '🎡', name: 'INJECT CHECKPOINT', short: 'INJECT', color: '#ff9f43' }, level: { icon: '⬆️', name: 'LEVEL UP', short: 'LEVEL UP', color: '#7dff6b' } };
function wpOptions() {
  const w = S.wp; if (!w || !w.queue.length || S.phase !== 'map' || !S.map) return [];
  const kind = w.queue[0], t = S.pos.tier;
  const dests = w.dest != null ? [w.dest] : t >= lastTier() ? ['boss'] : S.branch ? S.map.tiers[t + 1].map((_, j) => j) : S.map.links[t][S.pos.idx];
  return dests.map(j => ({ key: `w:${kind}:${j}`, kind, j, then: j === 'boss' ? NODE_TYPES.boss : NODE_TYPES[S.map.tiers[t + 1][j].type] }));
}
// 'next' (ahead), 'live' (running now) or 'past' for the checkpoint `kind` after map column k
function checkMark(S, k, kind) {
  if (kind === 'level' && S.leveled) return 'past';
  if (!S.pos || S.pos.tier < k) return 'next';
  if (S.pos.tier > k) return 'past';
  const w = S.wp;
  if (!w || w.k !== k) { const nd = S.map && S.map.tiers[k][S.pos.idx]; return nd && nd.done ? 'past' : 'next'; }
  return w.done.includes(kind) ? 'past' : w.cur === kind ? 'live' : 'next';
}
function takeWaypoint(key) {
  const o = wpOptions().find(x => x.key === String(key)); if (!o) return false;
  const w = S.wp; w.dest = o.j; w.queue.shift(); w.cur = o.kind; S.votes = {};
  log('Waypoint', `${CHECKPOINT[o.kind].name} (toward ${o.then.name})`);
  if (o.kind === 'inject') { S.phase = 'inject'; snapBase(); S.inject = { stage: 'trigger' }; setActor('trigger', nextActor()); sfx('alarm'); }
  else { S.phase = 'levelup'; sfx('level'); emit('flash', { color: 'gold' }); }
}

/* ---- cadet "actors": whoever presses the button for each random event ----
   Each random event is handed to a cadet (rotating through the party) so they
   tap it on their phone. The GM console can always press it for them. */
const ACTOR_LABEL = {
  tackle: 'Roll the d20: tackle the inject',
  trigger: 'Roll the d6: which inject wheel', murphy: 'Spin the inject wheel',
  speaker: 'Spin the wheel: who does the talking',
  mystery: 'Roll the d6: unknown territory', loot: 'Spin the loot wheel', lootd4: 'Spin the loot wheel',
  fumble: 'Spin the fumble wheel', hotseat: 'Roll for the hot seat (everyone)',
};
function nextActor() {
  const n = S.party.length; S.turn = S.turn || 0;
  for (let j = 0; j < n; j++) { const i = (S.turn + j) % n; if (!isOut(S, i)) { S.turn = i + 1; return i; } }
  return 0;
}
function setActor(kind, slot) { S.actor = { kind, slot, label: ACTOR_LABEL[kind] }; }
// clears the pending button and remembers who pressed it (for the die's title)
function doneActor(kind) { if (S.actor && S.actor.kind === kind) { S.lastActor = S.actor.slot; S.actor = null; } }
const byWho = () => (S.lastActor != null && S.party[S.lastActor] ? ` · ${cadetName(S.lastActor)}` : '');
// After a mission/stop is resolved, hand out the next pending random step in order.
function assignPending() {
  const c = S.cur;
  if (!c || c.step !== 'done') return;
  // Older saved runs used a d4 chance before the loot wheel. Preserve only loot
  // that was actually earned under the current result.
  if (c.lootRoll) { c.lootRoll = false; c.lootEarned = !!c.lootEarned; }
  if (c.fumblePending) return setActor('fumble', c.rollRes ? c.rollRes.roller : nextActor());
  if (c.lootEarned) return setActor('loot', nextActor());
  S.actor = null;
}
// what the cadet's button does, by kind
const ACTOR_RUN = {
  trigger: () => spinTrigger(), murphy: () => spinMurphy(), mystery: () => ACT.spinMystery(),
  lootd4: () => { doneActor('lootd4'); if (S.cur) { S.cur.lootRoll = false; S.cur.lootEarned = true; } spinLoot(); }, // legacy saved runs
  loot: () => spinLoot(), fumble: () => spinFumble(), hotseat: () => bossHotSeat(),
  speaker: () => spinSpeaker(), tackle: () => resolveTackle(),
};

/* ---- party votes (map, rest stop, supply depot, mission choices) ---- */
function votersFor(key) { const v = S.votes || {}; return Object.keys(v).filter(s => String(v[s]) === String(key)).map(Number); }
function restOptions() {
  const less = ccHook('restLess').length > 0;
  const mainGain = (isPreIGRest() ? Math.ceil(DIFFICULTY.restMain / 2) : DIFFICULTY.restMain) - (less ? 1 : 0);
  const o = METERS.map(m => ({ key: m.k, label: `+${mainGain} ${m.icon}` }));
  const halfUnit = Math.ceil(S.npcs.filter(n => !n.gone).length / 2);
  o.push({ key: 'loy', label: isPreIGRest() ? `🤝 +1 loyalty to the ${halfUnit} lowest-loyalty Unit members` : '🤝 +1 loyalty to every Unit member' });
  if (!isPreIGRest()) S.party.forEach((p, i) => { const ab = CLASS[p.cls] && CLASS[p.cls].ability; if (!p.fired && ab && !ab.auto && p.used) o.push({ key: 'rc' + i, label: `🔋 Recharge ${rankName(p)}'s ${ab.name}` }); });
  return o;
}
function isPreIGRest(state = S) {
  return !!(state && state.unit === 'sr' && state.cur && state.cur.type === 'rest' && state.map && state.pos && state.pos.tier === state.map.tiers.length - 1);
}
function depotOptions() {
  // Pre-Positioned Supplies (Plans perk): all BX purchases are free
  const prepo = stagedSupplyHolder();
  const bxCost = n => prepo ? 'FREE · 🗃️ PRE-POSITIONED SUPPLIES' : `−${n} 📦`;
  const bxShort = n => !prepo && !S.pending.prepo && S.meters.res < n;
  const noUnitHelp = !S.npcs.some(n => !n.gone && n.out <= 0);
  return [
    { key: 'pizza', label: `🍕 Pizza for the whole flight: ${bxCost(2)} → +3 ❤️`, dis: bxShort(2) },
    { key: 'coffee', label: `☕ Coffee run for the Group CC's staff meeting: ${bxCost(2)} → +2 ⭐`, dis: bxShort(2) },
    { key: 'train', label: `📚 Study guides from the BX bookstore: ${bxCost(2)} → one cadet +1 to a stat for the rest of the game`, dis: bxShort(2) },
    { key: 'deocs', label: `📋 Run a DEOCS Survey: ${bxCost(1)} → exact meter values for ${DIFFICULTY.deocsStops} stops`, dis: bxShort(1) || deocsOn(S) },
    { key: 'favor', label: '🎁 A Unit member picks something up for you: −2 loyalty → free loot spin', dis: noUnitHelp },
    { key: 'tasker', label: '🎯 Volunteer someone for the BX Saturday detail: a Unit member −1 loyalty → +3 🎯', dis: noUnitHelp },
    { key: 'overtime', label: '⏰ Skip the lunch run, mandatory overtime: −2 ❤️ → +3 📦', dis: S.meters.mor < 2 },
    { key: 'offbooks', label: '💳 Put the shopping on the unit GPC card, skip the paperwork: +4 📦' },
    { key: 'skip', label: 'Just browsing (no purchase)' },
  ];
}
// What the team votes on at a Rest Stop / Supply Depot right now (the depot's "who pays?" step votes on Unit members)
function stopOptions() {
  const c = S.cur; if (!c) return [];
  if (c.step === 'choose') return c.type === 'rest' ? restOptions() : depotOptions();
  if (c.step === 'who') return S.npcs.map(n => ({ key: 'who:' + n.slot, label: `${n.rank} ${n.name} (loyalty ${n.loy})${c.trade === 'favor' ? ': −2 loyalty' : ': −1 loyalty'}`, dis: n.gone || n.out > 0 }));
  return [];
}
// Is a team vote open right now? (Old votes linger in S.votes after the GM locks a choice.)
function votingOpen(S) {
  const c = S.cur, i = S.inject;
  if (S.phase === 'roster' || S.phase === 'map' || (S.phase === 'unit' && !S.unitRolled) || (S.phase === 'patch' && !S.patch)) return true;
  if (S.phase === 'boss' && S.boss && S.boss.stage === 'act') return true;
  if (S.phase === 'node' && c && (((c.step === 'choose' || c.step === 'who') && (c.type === 'rest' || c.type === 'depot')) || (c.step === 'brief' && c.type !== 'unknown' && c.type !== 'spot'))) return true;
  if (rollerVoteOpen(S)) return true;
  return S.phase === 'inject' && !!i && i.stage === 'result' && i.idx != null && !!MURPHY[i.idx].options;
}
/* Who rolls: on every team d20 check (a scenario check or a Tackle it), the team votes for the roller
   ("r0".."r3"), seeing everyone's bonus; the GM locks in the winner and only then can they roll.
   Spotlights and A1C-loyalty checks have a fixed roller, so there's no vote. */
function rollerVoteOpen(S) {
  const c = S.cur, i = S.inject;
  if (S.phase === 'node' && c && c.step === 'roll' && !c.rollerLocked) return true;
  return S.phase === 'inject' && !!i && i.stage === 'tackle' && !i.rollerLocked;
}
// The tied top options (as strings) when two or more share the most votes, else null.
function voteTie(S) {
  if (!votingOpen(S)) return null;
  const n = {};
  Object.values(S.votes || {}).forEach(k => { k = String(k); n[k] = (n[k] || 0) + 1; });
  const counts = Object.values(n); if (counts.length < 2) return null;
  const top = Math.max(...counts), keys = Object.keys(n).filter(k => n[k] === top);
  return keys.length > 1 ? keys : null;
}
function voteKey(S) {
  const c = S.cur, i = S.inject, b = S.boss;
  return JSON.stringify([S.phase, S.nodeCount, S.pos && S.pos.tier, S.pos && S.pos.idx, c && c.type, c && c.step,
    i && i.stage, b && b.stage, b && b.round, Object.entries(S.votes || {}).sort(([a], [b]) => a.localeCompare(b))]);
}
function tieText(S) {
  const f = S.party[crownIdx(S)];
  return f ? `⚖️ TIE VOTE · ROCK, PAPER, RANK: 👑 ${rankName(f).toUpperCase()} DECIDES` : '⚖️ TIE VOTE · Captain Russell decides';
}

/* ---- result card: what changed since the event started ---- */
function resultSnapshot() { return { m: { ...S.meters }, loy: Object.fromEntries((S.npcs || []).map(n => [n.slot, n.loy])), items: (S.items || []).slice(), lossIndex: (S.lossReductions || []).length }; }
function snapBase() { S.base = resultSnapshot(); S.usedItems = []; }
function resultSummary(S) {
  const b = (S.phase === 'inject' && S.inject && S.inject.resultBase) || (S.phase === 'node' && S.cur && S.cur.resultBase) || S.base;
  if (!b) return { meters: [], loy: [], gained: [], lost: [], reductions: [] };
  const items = S.items || [];
  return {
    meters: METERS.map(m => [m.k, S.meters[m.k] - b.m[m.k]]).filter(x => x[1]),
    loy: (S.npcs || []).map(n => [`${n.rank} ${n.name}`, n.loy - (b.loy[n.slot] ?? n.loy)]).filter(x => x[1]),
    gained: items.filter(id => !b.items.includes(id)), lost: b.items.filter(id => !items.includes(id) && !(S.usedItems || []).includes(id)),
    reductions: (S.lossReductions || []).slice(b.lossIndex || 0),
  };
}

// Squadron penalties target distinct checks, encounter frequency, ticket pressure,
// boss durability, or Unit availability without changing meter values directly.
function squadPenaltyText(id, state = S) {
  const deployed = state && (state.unit === 'ch' ? (state.npcs || []).find(n => n.slot === 'D') : id === 'ch' && state.fssDeployedName ? { rank: state.fssDeployedRank || 'SrA', name: state.fssDeployedName } : null);
  return ({
    wk: '⚙️ Flightline Reliability: −1 on every d20 check.',
    gg: '💀 Heightened Threat Environment: 100% more Elite encounters.',
    pp: `🎟️ Ticket System: −1 Resources every 2 stops.${state && state.unit === 'pp' && ['unit', 'patch', 'manifest', 'mapRoll', 'map', 'node', 'inject', 'levelup'].includes(state.phase) ? ` Next loss in ${state.commStopsRemaining ?? 2} stop${(state.commStopsRemaining ?? 2) === 1 ? '' : 's'}.` : ''}`,
    sr: '🕒 Time Crunch: Pre-IG Rest Stop −50% effectiveness.',
            sa: '📋 Inspection Scrutiny: the Inspector General starts with +15% more Health Points.',
    ch: `🧑‍🤝‍🧑 Short Staff: ${deployed ? `${deployed.rank} ${deployed.name} is deployed and will not return before the inspection.` : 'one Unit member is deployed and will not return before the inspection.'}`,
  })[id] || '';
}
function resultChips(S) {
  const r = resultSummary(S), meters = effChips(Object.fromEntries(r.meters));
  const c = (S.phase === 'inject' && S.inject) || (S.phase === 'node' && S.cur);
  const maxed = (c && c.maxedGains || []).map(k => `<span class="nw">${meterTag(k)}<span class="up">+0 (Max ${esc(METER[k].name)})</span></span>`);
  const loy = r.loy.map(([who, d]) => `<span class="nw"><span class="mtag loytag">🤝 ${esc(who)}</span><span class="${d > 0 ? 'up' : 'dn'}">${sign(d)}</span></span>`);
  return [meters !== 'no change' ? meters : '', ...maxed, ...loy, ...r.reductions.map(r => `<span class="loss-reduction">${esc(lossReductionText(r))}</span>`)].filter(Boolean).join(' ') || 'no change';
}
// The card stays up from the moment an event resolves until the GM clicks Continue.
function resultReady(S) {
  if (S.actor || spinning()) return false;
  const c = S.cur, i = S.inject;
  if (S.phase === 'node' && c && c.step === 'done') return true;
  return S.phase === 'inject' && !!i && i.stage === 'done';
}
function resultHeadline(S) {
  const c = S.cur, i = S.inject;
  if (S.phase === 'inject' && i) return `${INJECT_WHEELS[MURPHY[i.idx].type].icon} ${MURPHY[i.idx].name}${i.note ? ' · ' + fill(S, i.note) : ''}`;
  if (!c) return '';
  if (c.rollRes) { const r = c.rollRes; return `🎲 ${r.d20} → ${r.total} vs ${r.dc}: ${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED'}`; }
  if (c.stars) return `🎤 ${cadetName(c.lead)} · ${c.stars} of 3 ⭐`;
  if (c.result) return c.result;
  return 'DECISION LOCKED IN';
}

/* ---- wheels that pick a cadet ---- */
const WHEEL_COLORS = ['#3fd8ff', '#ff7ae0', '#ffd23f', '#7dff6b', '#ff9f43', '#b18cff'];
function cadetSlices(idxs) { return idxs.map((i, j) => ({ label: rankName(S.party[i]).toUpperCase(), color: WHEEL_COLORS[j % WHEEL_COLORS.length] })); }
// 🎤 encounters: a cadet spins to pick who does the talking
function spinSpeaker() {
  const c = S.cur; if (!c || c.step !== 'stars' || c.lead != null) return;
  doneActor('speaker');
  const pool = S.party.map((_, i) => i).filter(i => !isOut(S, i)), k = rnd(pool.length);
  c.lead = pool[k];
  spinWheel(`WHO DOES THE TALKING?${byWho()}`, cadetSlices(pool), k);
  log('🎤 Speaker', cadetName(c.lead));
}

/* ---- flow ---- */
function startRun() {
  if (mapRollTimer) { clearInterval(mapRollTimer); mapRollTimer = null; }
  const prev = S, keepBoard = S && S.muted;
  S = newState(); S.muted = !!keepBoard; hist = [];
  S.phase = 'join'; S.introPage = 0; // a full-screen QR first, then the briefing
  // cadets who scanned the QR on the title screen keep their seats for this first run
  if (prev && prev.phase === 'title' && prev.clients) { S.clients = prev.clients; S.blocked = prev.blocked; S.party = prev.party; }
  else if (typeof netStop === 'function') netStop(); // last party's phones drop off; the new party joins fresh
}
function lockParty() {
  const p = party();
  if (p.length < 2) return 'Enter at least 2 cadets.';
  if (p.some(c => !c.cls)) return 'Every cadet needs a position.';
  const cls = p.map(c => c.cls);
  if (new Set(cls).size !== cls.length) return 'No duplicate positions.';
  // empty rows are dropped, so move each phone to its cadet's new row (or to spectator)
  const keep = S.party.map((c, i) => i).filter(i => S.party[i].name.trim());
  for (const k in S.clients || {}) { const c = S.clients[k]; if (c.slot != null) { const n = keep.indexOf(c.slot); c.slot = n >= 0 ? n : null; } }
  S.party = p.map(c => ({ ...c, perk: '' }));
  // Without a Flight Commander who chose Command Token, the GM decides tied votes.
  S.crown = null;
  S.tokenHolder = crownIdx(S);
  S.phase = 'perks';
  log('Positions locked', p.map(c => `${c.name} (${CLASS[c.cls].name})`).join('; '));
  return '';
}
function lockPerks() {
  if (S.party.some(c => !c.perk)) return 'Every cadet needs a perk.';
  prepareFssPreview(); S.commStopsRemaining = 2; S.phase = 'unit'; S.votes = {};
  log('Perks locked', S.party.map(c => `${c.name}: ${perkOf(c).name}`).join('; '));
  return '';
}
function perkOf(c) { return CLASS[c.cls].perks.find(p => p.id === c.perk) || { name: '-', icon: '🎁' }; }
function upOf(c) { return CLASS[c.cls].ups.find(p => p.id === c.up) || { name: '-' }; }
// The team votes for its squadron (the 👑 breaks ties); the GM locks it in.
function pickUnit(id) {
  if (S.unitRolled) return;
  const u = UNITS.find(x => x.id === id); if (!u) return false;
  S.votes = {};
  emit('big', { cls: 'good', icon: u.icon, title: u.name, text: `${u.sq}: welcome to your squadron.` }); sfx('level');
  S.unit = u.id;
  S.meters = { ...u.start };
  S.commStopsRemaining = 2;
  S.intent = u.cc.intent;
  const R = getRoster();
  const names = u.id === 'ch' && Array.isArray(S.fssNameOrder) ? S.fssNameOrder.filter(n => !rosterNameIsPlayer(n)).slice() : shuffle(R.names);
  // traits: weighted by squadron (u.traitW), no repeats
  const pool = TRAITS.map(t => [t.id, (u.traitW || {})[t.id] || 1]), traits = [];
  // slot B (the newest Airman) can't draw a trait that takes years in (vet), so B draws first
  const order = SLOTS.map((_, i) => i).sort((a, b) => (SLOTS[b].s === 'B') - (SLOTS[a].s === 'B'));
  for (const i of order) {
    const ok = pool.map((x, j) => j).filter(j => !(SLOTS[i].s === 'B' && TRAIT[pool[j][0]].vet));
    let r = Math.random() * ok.reduce((a, j) => a + pool[j][1], 0), k = 0;
    while ((r -= pool[ok[k]][1]) >= 0 && k < ok.length - 1) k++;
    traits[i] = pool.splice(ok[k], 1)[0][0];
  }
  S.npcs = SLOTS.map((sl, i) => {
    const own = (u.slots || [])[i] || sl;
    const name = names.shift();
    return { slot: sl.s, rank: own.rank === 'Civ.' ? civTitle(name) : own.rank, pub: own.pub, enlisted: sl.enlisted, name,
      trait: traits[i], revealed: true, loy: TRAIT[traits[i]].loy0 ?? DIFFICULTY.startLoy, out: 0, broken: false };
  });
  if (u.id === 'ch') { const deployed = S.npcs.find(n => n.slot === 'D'); if (deployed) { deployed.out = 999; deployed.gone = true; } }
  S.cc = `${u.ccRank} ${names.shift()}`;
  // named characters outside the Unit (Wing CC, a visiting general...), from names nobody is using
  S.extras = {};
  for (const k in EXTRAS) {
    const x = EXTRAS[k], name = names.length > 2 ? names.shift() : null;
    if (name) S.extras[k] = { rank: x.rank === 'Civ.' ? civTitle(name) : x.rank, name };
  }
  log('Squadron chosen', `${u.name} (${u.sq}); Sq CC ${S.cc}`);
  if (confidantIdx(S) >= 0) S.flags.ccNegOff = true; // the XO's Commander's Confidant: the 👎 never applies
  S.unitRolled = true; // stay on the 'unit' screen until the GM reveals the org chart, so the die isn't spoiled
}
function chooseNode(t, i) {
  S.pos = { tier: t, idx: i };
  const node = S.map.tiers[t][i];
  node.visited = true;
  S.nodeCount++;
  if (S.unit === 'pp') {
    S.commStopsRemaining = Math.max(0, (S.commStopsRemaining ?? 2) - 1);
    if (S.commStopsRemaining === 0) {
      S.commStopsRemaining = 2;
      applyEff({ res: -1, why: '6th CS Ticket System' });
      log('🎟️ Ticket System', '−1 📦 · next loss in 2 stops');
      toast('🎟️', 'TICKET SYSTEM', '−1 Resources · next loss in 2 stops');
    }
  }
  S.offline = S.offlineNext; S.offlineNext = null; S.branch = false; S.wp = null;
  if (S.babysit > 0) S.babysit--;
  if (S.offline != null) S.banner = { text: `📵 ${cadetName(S.offline)} IS IN A MEETING: CAN'T SPEAK OR ROLL THIS NODE`, cls: 'blue' };
  log(`Node ${S.nodeCount}: ${NODE_TYPES[node.type].name}`);
  if (S.pendingNext.length) { const pend = S.pendingNext; S.pendingNext = []; pend.forEach(e => {
    if (e.p != null && Math.random() >= e.p) { log('Dodged it', e.why || 'A delayed risk did not happen'); return; }
    if (e.why) toast('⏰', 'IT CAUGHT UP WITH YOU', e.why);
    applyEff(e);
  }); }
  if (crisisNow({ k: 'enter', t, i })) return;
  enterNode(node.type, node);
}
// Use unused squadron scenarios first. Generic scenarios are a backup when none remain playable.
// Elite stops prioritize the squadron's critical scenario; regular stops save it when possible.
function drawMission(elite) {
  const fresh = m => !m.off && !S.usedMissions.includes(m.id) && rosterFitsScene(m), mine = m => (m.home || []).includes(S.unit);
  const crit = MISSIONS.filter(m => m.critical && mine(m) && fresh(m));
  if (elite && crit.length) return pickOne(crit);
  const own = MISSIONS.filter(m => !m.critical && mine(m) && fresh(m)), core = MISSIONS.filter(m => !m.critical && !m.home && fresh(m));
  const bag = [own, crit, core].find(b => b.length) || MISSIONS.filter(m => !m.off && (mine(m) || !m.home) && rosterFitsScene(m));
  return pickOne(bag);
}
function enterNode(type, node) {
  S.phase = 'node'; S.votes = {}; snapBase();
  if (type === 'crisis' || type === 'elite') {
    const m = drawMission(type === 'elite');
    S.usedMissions.push(m.id);
    S.cur = { type, mid: m.id, step: 'brief', choice: null, intel: false, swap: null };
    log(`${type === 'elite' ? 'ELITE ' : ''}Mission ${m.id}`, m.title);
    sfx(type === 'elite' ? 'boss' : 'start');
  } else if (type === 'spot') {
    // a wheel picks a cadet who hasn't been in the spotlight yet; they get their class's scenario
    const all = S.party.map((_, i) => i).filter(i => !isOut(S, i)), done = S.spotlit || [];
    const eligible = all.filter(i => SPOTLIGHTS.some(x => x.cls === S.party[i].cls && rosterFitsScene(x)));
    const fresh = eligible.filter(i => !done.includes(i)), cand = fresh.length ? fresh : eligible.length ? eligible : all;
    const k = rnd(cand.length), slot = cand[k], sp = SPOTLIGHTS.find(x => x.cls === S.party[slot].cls && rosterFitsScene(x));
    S.spotlit = done.concat(slot);
    spinWheel('🔦 WHO IS IN THE SPOTLIGHT?', cadetSlices(cand), k, true);
    if (sp) S.cur = { type, sid: sp.id, nominationScene: sp.id === 'SP_fc' ? nominationScene(S, sp) : null, slot, step: 'brief', choice: null, intel: false, swap: null };
    else { const m = drawMission(false); S.usedMissions.push(m.id); S.cur = { type, mid: m.id, slot, step: 'brief', choice: null, intel: false, swap: null }; }
    S.banner = { text: `🔦 SPOTLIGHT: ${cadetName(slot).toUpperCase()} DECIDES ALONE. EVERYONE ELSE: SILENT.`, cls: 'blue' };
    log('Spotlight', `${curMission().title} (${cadetName(slot)})`); sfx('start');
  } else if (type === 'rest' || type === 'depot') {
    S.cur = { type, step: 'choose' };
    const prepoHolder = type === 'depot' && stagedSupplyHolder();
    if (prepoHolder) notice('🗃️', 'PRE-POSITIONED SUPPLIES', `${rankName(prepoHolder)}'s passive ability waives every 📦 cost at this BX. The options marked FREE are free because supplies were staged in advance.`, 'PASSIVE ABILITY');
    if (type === 'rest') {
      withTrait('burnout').forEach(n => traitReward(n, 'Finally, a breather. They come back a different person.', { mor: 1 }, 2));
      withTrait('overach').forEach(n => traitReward(n, 'Rested, they go back to delivering.', { mis: 2 }));
    }
    ccApply('rest', type === 'rest' ? 'Rest Stop' : 'Base Exchange');
    sfx('good');
  } else if (type === 'unknown') {
    S.cur = { type, step: 'spin', mystery: null }; // rolled when the cadet presses the button
    setActor('mystery', nextActor());
  }
}
function choose(i) {
  const m = curMission(), c = S.cur;
  c.resultBase = resultSnapshot();
  c.preChoice = JSON.stringify(S);
  let effIdx = i;
  if (c.swap && c.swap.includes(i)) effIdx = c.swap[0] === i ? c.swap[1] : c.swap[0];
  const base = m.choices[i], src = m.choices[effIdx];
  const spec = encounterChoice(S, { ...src, tags: base.tags });
  const actOutEncounter = isActOutEncounter(S, m);
  c.actOutEncounter = actOutEncounter;
  c.choice = i; c.spec = spec;
  if (c.type !== 'spot') S.banner = null;
  sfx('click');
  log(`Choice ${'ABCD'[i]}`, fill(S, base.t) + (effIdx !== i ? ' (PLOT TWIST: effects swapped)' : ''));
  logObj(m, base.t);
  const opt = { late: (spec.tags || []).includes('late') };
  applyEff(spec.pre, opt);
  if ((spec.tags || []).includes('idea')) {
    ccApply('idea', "You adopted a subordinate's idea");
    withTrait('genius').forEach(n => traitReward(n, 'Their process fix finally gets a hearing, and it works.', { mis: 3 }, 1));
  }
  if (spec.kind === 'fx') { applyEff(spec.eff, opt); finishStep(); }
  else if (spec.kind === 'check') {
    c.step = 'roll'; c.safe = false; S.votes = {};
    const fixed = c.type === 'spot' || spec.check.stat === 'LOYB' || !spec.check.stat; // no vote when the roller is fixed (or nobody adds anything)
    c.roller = c.type === 'spot' ? c.slot : fixed ? nextActor() : null; c.rollerLocked = fixed;
  }
  else if (spec.kind === 'stars') {
    c.step = 'stars';
    if (c.type === 'spot') c.lead = c.slot; // the spotlighted cadet does the talking
    else if (spec.speaker === 'crown' && crownIdx(S) >= 0) c.lead = crownIdx(S); // the choice names who talks (the acting lead holds the 👑): no wheel
    else { c.lead = null; setActor('speaker', nextActor()); } // a cadet spins for the speaker
  }
}
function spotlightChoiceStars(spec) {
  if (spec.kind === 'stars') return { ...spec, mic: true };
  const source = spec.kind === 'check' ? spec.check.pass : (spec.eff || {});
  const weak = spec.kind === 'check' ? (spec.check.fail || {}) : {};
  const fail = { ...weak };
  if (spec.kind !== 'check') {
    for (const m of METERS) if ((source[m.k] || 0) < 0) fail[m.k] = source[m.k];
    if (source.loy) {
      fail.loy = Object.fromEntries(Object.entries(source.loy).filter(([, v]) => v < 0));
      if (!Object.keys(fail.loy).length) delete fail.loy;
    }
    if (source.flag) fail.flag = source.flag;
    if (source.next) fail.next = source.next;
    if (source.offlineSelf) fail.offlineSelf = true;
  }
  if (!METERS.some(m => fail[m.k] < 0) && !Object.values(fail.loy || {}).some(v => v < 0)) fail.tru = (fail.tru || 0) - 1;
  const middle = spec.kind === 'check' ? { ...spec.check.pass } : { ...source };
  const strong = { ...middle, ...(middle.loy ? { loy: { ...middle.loy } } : {}) };
  const bonusMeter = METERS.find(m => (strong[m.k] || 0) > 0)?.k || 'tru';
  strong[bonusMeter] = (strong[bonusMeter] || 0) + 1;
  // Integrity traps remain traps regardless of how well the response is acted out.
  if (spec.trap && source.flag) { fail.flag = source.flag; middle.flag = source.flag; strong.flag = source.flag; }
  return { ...spec, kind: 'stars', mic: true, stars: [fail, middle, strong] };
}
function choiceRollCheck(spec) {
  if (spec.kind === 'check') return { ...spec, mic: false };
  const isStars = spec.kind === 'stars';
  const pass = isStars ? spec.stars[2] : (spec.eff || {});
  let fail;
  if (isStars) fail = spec.stars[0];
  else {
    fail = {};
    for (const m of METERS) if ((spec.eff || {})[m.k] < 0) fail[m.k] = spec.eff[m.k];
    if (spec.eff && spec.eff.loy) {
      fail.loy = Object.fromEntries(Object.entries(spec.eff.loy).filter(([, v]) => v < 0));
      if (!Object.keys(fail.loy).length) delete fail.loy;
    }
    if (spec.eff && spec.eff.next) fail.next = spec.eff.next;
    if (spec.eff && spec.eff.flag) fail.flag = spec.eff.flag;
    if (!METERS.some(m => fail[m.k] < 0)) fail.mis = -1;
  }
  const stat = spec.eliteStat || (isStars || spec.mic ? 'CHA' : (spec.tags || []).includes('idea') ? 'INS' : spec.trap ? 'CMD' : 'GRIT');
  const meter = spec.eliteMeter || (isStars ? 'tru' : METERS.find(m => (pass[m.k] || 0) > 0)?.k || 'mis');
  return { ...spec, mic: false, kind: 'check', check: { stat, dc: 13, m: meter, pass, fail } };
}
// Resolve the same class branch and encounter rules for previews and execution.
function encounterChoice(state, choice) {
  let ch = choice;
  while (ch && ch.ifClass) {
    const hasBranchClass = ch.ifClass.cls.some(id => (state && state.party || []).some(p => p.cls === id && !p.fired));
    ch = { ...ch, ...normal(ch.ifClass[hasBranchClass ? 'then' : 'else']), ifClass: null };
  }
  if (state && state.cur) {
    if (state.cur.type === 'elite') ch = choiceRollCheck(ch);
    else if (isActOutEncounter(state, curMission())) ch = spotlightChoiceStars(ch);
    else if (ch.kind === 'check' && ch.mic) ch = { ...ch, mic: false };
  }
  return ch;
}
function choiceCheckSpec(state, choice) {
  const ch = encounterChoice(state, choice);
  return ch && ch.kind === 'check' ? ch : null;
}
function choiceCheckLabel(state, choice) {
  const ch = choiceCheckSpec(state, choice);
  if (!ch) return '';
  const check = ch.check;
  return `${statLabel(check.stat)} ${checkDC(check)}+`;
}
function isActOutEncounter(state, mission) {
  if (!state || !state.cur || state.cur.type === 'elite') return false;
  return state.cur.type === 'spot' || !!(mission && mission.choices && mission.choices.some(ch => ch.mic || ch.kind === 'stars'));
}
function eventRecapHtml(S) {
  const c = S && S.cur;
  if (!c || c.step !== 'done' || c.choice == null || (!c.rollRes && !c.stars)) return '';
  const m = curMission(), choice = m && m.choices[c.choice];
  if (!m || !choice) return '';
  let outcome;
  if (c.rollRes) {
    const r = c.rollRes, check = c.spec && c.spec.check;
    const tested = check && check.stat ? statLabel(check.stat) : 'roll';
    if (r.nat === 20) outcome = `Critical success: the ${tested} check beat the target exceptionally. The chosen response worked, and its success effects apply.`;
    else if (r.nat === 1) outcome = `Critical failure: the ${tested} check missed the target. The chosen response fell short, its failure effects apply, and the fumble consequence is waiting.`;
    else if (r.pass) outcome = `Success: the ${tested} check met the target. The chosen response worked, and its success effects apply.`;
    else outcome = `Failure: the ${tested} check missed the target. The chosen response fell short, and its failure effects apply.`;
  } else if (c.stars === 1) outcome = 'Weak response: the message did not land clearly, so the one-star effects apply.';
  else if (c.stars === 2) outcome = 'Mixed response: the main point came through, but important context or follow-through was missing.';
  else outcome = 'Strong response: the team handled the exchange clearly and effectively, so the three-star effects apply.';
  return `<div class="event-recap"><b>SCENARIO</b><div>${esc(fill(S, m.text))}</div><b>TEAM RESPONSE</b><div>${esc(fill(S, choice.t))}</div><b>WHAT HAPPENED</b><div>${esc(outcome)}</div></div>`;
}
function finishStep() {
  const c = S.cur; c.step = 'done';
  if (c.type === 'spot') {
    c.lootMessage = c.lootEarned ? '' : 'They did not perform well enough for loot (3 stars required).';
  }
  if (c.type === 'elite' && c.rollRes) {
    c.lootEarned = !!c.rollRes.pass;
    c.lootMessage = c.lootEarned ? '' : 'They did not perform well enough for loot (the check failed).';
  }
  if (c.type === 'elite' && c.stars) {
    c.lootMessage = c.lootEarned ? '' : 'They did not perform well enough for loot (3 stars required).';
  }
  assignPending();
}
function resolveRoll(roller, o) {
  const c = S.cur, spec = c.spec;
  c.preRoll = JSON.stringify(S);
  const safe = false; // "play it safe" was removed: every check rolls the die
  const lead = !!(o && o.lead); // Prior MTI keeps the die as rolled and forces a pass (no new roll on screen)
  let d20 = lead ? o.d20 : 1 + rnd(20);
  if (!lead) { queueGMNext(6200); S.spinUntil = Math.max(S.spinUntil, Date.now() + 4800); setTimeout(afterSpin, 4860); }
  const bonusItem = S.pending.check; if (bonusItem) { removeItem(bonusItem); S.pending.check = null; }
  const r = rollCalc(spec.check, roller, d20, { ...o, bonusItem, safe });
  r.roller = roller;
  if (o && o.lead) { r.pass = true; r.nat = 0; r.lead = true; }
  c.rollRes = r;
  S.dcMod = 0;
  const who = spec.check.stat === 'LOYB' ? npcLabel(S, 'B') : cadetName(roller);
  if (!lead) emit('roll', { r, who, npcSlot: spec.check.stat === 'LOYB' ? 'B' : null });
  log(`Roll: ${who}`, `${safe ? 'PLAYED IT SAFE (' + d20 + ')' : 'd20 ' + d20} → ${r.total} vs ${r.dc}: ${r.pass ? 'PASS' : 'FAIL'}${r.nat === 20 ? ' (CRIT)' : r.nat === 1 ? ' (FUMBLE)' : ''}`);
  const opt = { double: r.nat === 20, late: (spec.tags || []).includes('late') };
  applyEff(r.pass ? spec.check.pass : spec.check.fail, opt);
  if (r.pass) ccApply('afterPass', 'Passed check', h => h.m === spec.check.m);
  else ccApply('afterFail', 'Failed check', h => !h.m || h.m === spec.check.m);
  if (r.nat === 20) award('crit');
  if (c.type === 'elite' && r.pass) c.lootEarned = true;
  else if (c.type === 'elite') c.lootMessage = 'They did not perform well enough for loot (the check failed).';
  if (c.type === 'elite' && r.pass) c.lootMessage = '';
  if (r.nat === 20 && !['elite', 'spot'].includes(c.type)) c.lootEarned = true;
  if (r.nat === 1) c.fumblePending = true;
  if (r.pass && S.party[roller] && S.party[roller].up === 'standards') applyEff({ tru: 1, why: 'Standards Bearer' });
  finishStep();
}
function rateStars(n, lead) {
  const c = S.cur, spec = c.spec;
  let st = n, bonus = [];
  const starItem = S.pending.star && LOOT.find(l => l.id === S.pending.star);
  if (starItem && st < 3) { st++; bonus.push(`${starItem.icon} ${starItem.name}`); removeItem(starItem.id); }
  if (starItem) S.pending.star = null;
  c.stars = st; c.lead = lead; c.starBonus = bonus;
  if (['spot', 'elite'].includes(c.type)) {
    c.lootEarned = st === 3;
    c.lootMessage = c.lootEarned ? '' : 'They did not perform well enough for loot (3 stars required).';
  }
  S.starsTotal += st; S.micCount++; if (st < 2) S.micLow = true;
  if (st === 3) award('clearcomms');
  emit('stars', { n: st, who: cadetName(lead) }); sfx('stars');
  log(`🎤 ${cadetName(lead)} led the encounter`, `${st}★${bonus.length ? ' (' + bonus.join(', ') + ')' : ''}`);
  applyEff(spec.stars[st - 1]);
  if (st === 3) { ccApply('stars3', '3⭐ encounter'); withTrait('climber').forEach(n => traitReward(n, 'Public praise. They noticed, and so did everyone else.', null, 2)); }
  if (st === 1) ccApply('stars1', '1⭐ encounter');
  finishStep();
}
function removeItem(id) { const i = S.items.indexOf(id); if (i >= 0) { S.items.splice(i, 1); S.usedItems = (S.usedItems || []).concat(id); } }
// Does an inject hit after map column k (0-based)? Each column is one stop, so column k is stop k+1.
// The route maps draw a 🎡 checkpoint after these columns.
function injectAfter(k) { return (k + 1) % (DIFFICULTY.injectEvery || 1) === 0; }
function afterNode(skipTrigger) {
  const c = S.cur;
  if (c && c.type === 'crisisEvent') { S.cur = null; S.banner = null; if (crisisNow(S.resume)) return; return crisisResume(); }
  S.npcs.forEach(n => { if (n.out > 0 && !n.gone) n.out--; });
  S.offline = null; S.banner = null;
  const k = S.map && S.pos.tier >= 0 ? S.pos.tier : S.nodeCount - 1;
  if (S.map && S.pos.tier >= 0) S.map.tiers[S.pos.tier][S.pos.idx].done = true;
  S.cur = null;
  // checkpoints after this stop: the team picks their waypoint on the route map (an Unknown's inject already counted)
  const queue = checksAfter(S.map, k).filter(x => !(x === 'inject' && skipTrigger) && !(x === 'level' && S.leveled));
  if (!injectAfter(k)) log('Inject', 'Quiet stop: no inject');
  S.wp = queue.length && S.map ? { k, queue, done: skipTrigger && injectAfter(k) ? ['inject'] : [], cur: null, dest: null } : null;
  return advance();
}
function advance() {
  S.inject = null; S.cur = null; S.actor = null; S.votes = {};
  if (crisisNow('advance')) return;
  if (S.wp && S.wp.cur) { S.wp.done.push(S.wp.cur); S.wp.cur = null; }
  if (S.map && S.pos.tier >= lastTier() && !(S.wp && S.wp.queue.length)) { S.phase = 'map'; S.bossReady = true; return; }
  S.phase = 'map';
}

/* ---- injects ---- */
// Every other stop (DIFFICULTY.injectEvery) ends with an inject: a cadet rolls a d6 to pick the wheel (DIFFICULTY.injectOdds),
// then another spins that wheel, which only holds injects of that type.
function spinTrigger() {
  const inj = S.inject;
  if (!inj || inj.stage !== 'trigger') return;
  doneActor('trigger');
  const d = rollDie(6, `WHICH WHEEL? · d6${byWho()}`, n => `➜ ${INJECT_WHEELS[wheelFor(n)].name}${wheelFor(n) !== injectTypeFor(n) ? ' (🔮 Foresight)' : ''}`, injectTable());
  inj.filter = wheelFor(d); inj.stage = 'murphy';
  setActor('murphy', nextActor());
  log('Inject wheel', INJECT_WHEELS[inj.filter].name + (inj.foresight ? ' (Foresight: guaranteed Success)' : ''));
}
// The inject pool for a wheel: injects already used this run are removed, so nothing repeats.
// (Only if a whole wheel is used up does it refill.)
function injectPool(type, keep) {
  const all = MURPHY.map((m, i) => i).filter(i => !type || MURPHY[i].type === type);
  const fresh = all.filter(i => i === keep || !(S.usedInjects || []).includes(i));
  return fresh.length ? fresh : all;
}
function spinMurphy() {
  const inj = S.inject;
  if (!inj || inj.stage !== 'murphy') return;
  doneActor('murphy');
  let idx;
  idx = pickOne(injectPool(inj.filter));
  const pool = injectPool(inj.filter, idx); // the wheel only shows what's still in the pool
  S.usedInjects = (S.usedInjects || []).concat(idx);
  inj.idx = idx; inj.stage = 'result'; S.votes = {}; // the team votes on how to respond
  spinWheel(`${inj.filter ? INJECT_WHEELS[inj.filter].name : 'INJECT'}${byWho()}`,
    pool.map(i => ({ label: MURPHY[i].name, color: INJECT_WHEELS[MURPHY[i].type].color, ink: '#000' })), pool.indexOf(idx), true);
  log('Inject', MURPHY[idx].name + (inj.blocked ? ' (BLOCKED by Foresight)' : ''));
}
function applyInject(choice) {
  const inj = S.inject, m = MURPHY[inj.idx];
  if (m.tackle && m.options && choice === m.options.length && !inj.blocked) { // Tackle it: a d20 + stat check
    inj.stage = 'tackle'; inj.roller = null; inj.rollerLocked = false; S.votes = {}; // the team votes on who rolls
    log('Inject', `${m.name}: tackling it (${m.tackle.stat})`);
    return;
  }
  inj.resultBase = resultSnapshot();
  inj.preApply = JSON.stringify(S);
  let note = '';
  if (inj.blocked) note = 'Blocked by Foresight. No effect.';
  else {
    let eff = m.options ? m.options[choice].eff : { ...m.eff };
    applyEff(eff);
    withTrait('gossip').forEach(n => { // the rumor mill amplifies whatever just happened
      if (m.type === 'good' && n.loy >= 3) { applyEff({ mor: 1, why: `${n.name} spread the good news` }); toast('📢', 'GOOD NEWS TRAVELS', `${n.rank} ${n.name} spread it: +1 ❤️`); }
      if (m.type === 'bad' && n.loy <= 1) { applyEff({ mor: -1, why: `${n.name} spread the bad news` }); toast('📢', 'RUMOR MILL', `${n.rank} ${n.name} made it worse: −1 ❤️`); }
    });
    if (m.special === 'leave') {
      const present = S.npcs.filter(n => !n.gone && n.out <= 0);
      if (present.length) { const k = rnd(present.length), n = present[k];
        spinWheel('WHO GOES ON LEAVE?', present.map((x, j) => ({ label: `${x.rank} ${x.name}`.toUpperCase(), color: WHEEL_COLORS[j % WHEEL_COLORS.length] })), k);
        n.out = 2; note += `${n.rank} ${n.name} is out for 2 stops.`; }
    }
    if (m.special === 'meeting') {
      const all = S.party.map((_, i) => i).filter(i => !S.party[i].fired), k = rnd(all.length);
      spinWheel('WHO GETS PULLED INTO A MEETING?', cadetSlices(all), k);
      S.offlineNext = all[k]; note += `${cadetName(all[k])} is offline next stop.`;
    }
    if (m.special === 'favor' && choice === 0 && npc('A')) { npc('A').out = 1; note += `${npcLabel(S, 'A')} is out for the next stop. `; } // out ticks down after each stop (Emergency Leave uses 2)
    if (m.options) note += `Party chose: ${fill(S, m.options[choice].t)}.`;
  }
  inj.note = note; inj.stage = 'done';
  emit('injectResult', { idx: inj.idx, note });
  sfx(m.type === 'good' ? 'good' : m.type === 'bad' ? 'bad' : 'click');
  log('Inject', `${m.name}${note ? ' · ' + note : ''}`);
}
const effSum = e => METERS.reduce((a, m) => a + (e[m.k] || 0), 0);
// Tackle it: the roller (picked by the 👑 holder) rolls d20 + stat. Pass = no loss; fail = the worse response.
function resolveTackle(o = {}) {
  const inj = S.inject; if (!inj || inj.stage !== 'tackle') return;
  inj.resultBase = resultSnapshot();
  inj.preTackle = JSON.stringify(S); // Prior MTI restores this and force a pass
  doneActor('tackle');
  const m = MURPHY[inj.idx], t = m.tackle, i = inj.roller;
  const bonusItem = S.pending.check, itemBonus = pendingCheckBonus(S), itemName = bonusItem ? LOOT.find(l => l.id === bonusItem).name : '';
  if (bonusItem) { removeItem(bonusItem); S.pending.check = null; }
  let d20 = o.lead ? o.d20 : 1 + rnd(20);
  inj.tackleD20 = d20;
  // Emergency Leave: the member goes no matter what; tackling it means covering the gap
  let leaver = null;
  if (m.special === 'leave') {
    if (o.lead && o.leaver) leaver = npc(o.leaver); // Prior MTI: same person, no new spin
    else { const present = S.npcs.filter(n => !n.gone && n.out <= 0), k = rnd(present.length); leaver = present[k] || null;
      if (leaver) spinWheel('WHO GOES ON LEAVE?', present.map((x, j) => ({ label: `${x.rank} ${x.name}`.toUpperCase(), color: WHEEL_COLORS[j % WHEEL_COLORS.length] })), k); }
    if (leaver) { leaver.out = 2; inj.leaver = leaver.slot; }
  }
  const cl = CLASS[S.party[i].cls], spec = isSpec(i, t.m) ? 1 : 0;
  const flightPenalty = squadD20Penalty(), sv = statOf(i, t.stat), lean = leanBonus(S), total = d20 + sv + spec + lean + itemBonus + flightPenalty, dc = t.dc + DIFFICULTY.dcPlus + squadCheckDcPenalty(t);
  const pass = !!o.lead || d20 === 20 || (d20 !== 1 && total >= dc);
  if (!o.lead) showDie(20, d20, `TACKLE IT · ${cadetName(i)} · ${t.stat}`, `${d20} + ${sv} ${t.stat}${spec ? ' + 1 specialist' : ''}${lean ? ` + ${lean} experience` : ''}${itemBonus ? ` + ${itemBonus} ${itemName}` : ''}${flightPenalty ? ' −1 flightline' : ''} = ${total} vs ${dc} → ${pass ? 'TACKLED!' : 'FAILED'}`, null, Math.min(20, Math.max(2, dc - (sv + spec + lean + itemBonus + flightPenalty))));
  inj.preApply = inj.preTackle;
  const gone = leaver ? ` ${leaver.rank} ${leaver.name} is on leave for 2 stops.` : '';
  if (pass) { inj.note = `${cadetName(i)} tackled it (${t.stat}): no loss.${gone}`; if (leaver) changeLoy(leaver.slot, 1); }
  else {
    applyEff(t.fail || m.options.slice().sort((a, b) => effSum(a.eff) - effSum(b.eff))[0].eff); inj.tackleFail = true;
    inj.note = `${cadetName(i)} couldn't tackle it: ${(t.fail && t.fail.why) || 'the worse outcome'}.${gone}`;
  }
  inj.stage = 'done';
  emit('injectResult', { idx: inj.idx, note: inj.note }); sfx(pass ? 'good' : 'bad');
  log('Inject', `${m.name} · ${inj.note}`);
}
function closeInject() {
  const forced = S.inject && S.inject.forced, fromNode = S.inject && S.inject.fromNode;
  S.wheel = null;
  if (!forced && crisisNow({ k: 'inject', fromNode })) return;
  if (forced) { S.inject = null; return; }
  if (fromNode) { S.inject = null; return afterNode(true); }
  advance();
}

/* ---- loot / fumble ---- */
// Every inventory grant uses the same capacity rule and persistent award card.
function grantTeamItem(id, announce = true) {
  const item = LOOT.find(l => l.id === id); if (!item) return false;
  S.items = S.items || [];
  S.items.push(id);
  const dropped = S.items.length > 3 ? S.items.shift() : null;
  if (dropped) { const old = LOOT.find(l => l.id === dropped); log('Inventory full', `Dropped ${old.icon} ${old.name}`); }
  const award = { id, count: S.items.length, dropped };
  if (announce) { S.itemAward = { ...award, returnPhase: S.phase }; S.phase = 'itemAward'; S.actor = null; }
  return award;
}
// The run's random loot pool excludes the free introductory DEOCS Survey.
// Even odds; an item leaves the pool once it drops.
function lootPool(keep) {
  const all = LOOT.filter(l => l.id !== 'deocs' && (!l.home || l.home.includes(S.unit))).map(l => l.id);
  const fresh = all.filter(id => id === keep || !(S.usedLoot || []).includes(id));
  return fresh.length ? fresh : all;
}
function spinLoot() {
  const id = pickOne(lootPool()), pool = lootPool(id), item = LOOT.find(l => l.id === id);
  S.usedLoot = (S.usedLoot || []).concat(id);
  doneActor('loot'); doneActor('lootd4');
  spinWheel(`LOOT DROP!${byWho()}`, pool.map(x => { const l = LOOT.find(y => y.id === x); return { label: l.name, color: lootColor(l) }; }), pool.indexOf(id));
  emit('sfxLater', { n: 'loot' });
  log('Loot', `${item.icon} ${item.name}`);
  if (S.cur) { S.cur.lootEarned = false; S.cur.lootRoll = false; assignPending(); }
  grantTeamItem(item.id);
  return item;
}
function applyFumble(f, roller) {
  applyEff(f.eff);
  if (f.special === 'wrongname') { const present = S.npcs.filter(n => !n.gone); if (present.length) { const n = pickOne(present); changeLoy(n.slot, -1); toast('😬', 'WRONG NAME', `${n.rank} ${n.name} noticed. Loyalty −1`); } }
  if (f.special === 'cac' && roller != null && S.phase !== 'boss') { S.offlineNext = roller; toast('💳', 'LOCKED OUT', `${cadetName(roller)} is offline next stop`); }
  if (f.special === 'chief' && hasClass('chief')) applyEff({ mor: 1, why: 'The SEL told the story at roll call' });
  log('Fumble', `${f.name}: ${f.text}`);
}
function spinFumble() {
  doneActor('fumble');
  const idx = rnd(FUMBLES.length), f = FUMBLES[idx];
  spinWheel(`FUMBLE!${byWho()}`, FUMBLES.map((x, i) => ({ label: x.name, color: i % 2 ? '#ff9f43' : '#ff5d5d' })), idx);
  applyFumble(f, S.cur && S.cur.rollRes ? S.cur.rollRes.roller : null);
  if (S.cur) { S.cur.fumblePending = false; S.cur.fumble = idx; assignPending(); }
}

/* ---- boss ---- */
const BOSS_PRACTICE_PRESETS = {
  balanced: 'Balanced · one Ally, steady commander',
  supported: 'Strong support · two Allies, commander helps',
  fullSupport: 'Full support · four enlisted Allies + commander',
  pressure: 'Under pressure · low meters, commander reports',
  integrity: 'Integrity failure · practice the Audit'
};
function startBossPractice() {
  if (!IS_BOSS_PRACTICE) return false;
  const previous = S, config = previous?.practiceConfig || { unit: 'pp', preset: 'balanced', exact: true };
  const clients = previous?.clients || {}, muted = !!previous?.muted;
  if (mapRollTimer) { clearInterval(mapRollTimer); mapRollTimer = null; }
  S = newState(); S.practiceConfig = { ...config }; S.muted = muted; S.clients = clients;
  S.blocked = previous?.blocked || {};
  const roles = [ ['fc', 'hold', 'battle'], ['chief', 'ncopull', 'standards'], ['shirt', 'resiliency', 'engine'], ['utm', 'sevenlvl', 'proficiency'] ];
  S.party = roles.map(([cls, perk, up], i) => ({ name: Object.values(clients).find(c => c.slot === i)?.name || ['Able', 'Baker', 'Charlie', 'Dog'][i], cls, perk, up, used: 0, av: i, kitOk: true }));
  pickUnit(UNITS.some(u => u.id === config.unit) ? config.unit : 'pp');
  S.patch = PATCHES[S.unit][0].id; S.callsign = 'BOSS PRACTICE';
  S.nodeCount = S.stops; S.leveled = true;
  S.meters = config.preset === 'pressure' ? { mis: 4, mor: 4, tru: 4, res: 4 } : { mis: 6, mor: 6, tru: 6, res: 5 };
  if (['supported', 'fullSupport'].includes(config.preset)) S.meters[S.intent] = 7;
  if (config.preset === 'pressure') S.meters[S.intent] = 3;
  S.npcs.forEach(n => { n.loy = 3; n.broken = false; n.handpicked = false; });
  // This practice fixture includes all four supporters, even for 55th FSS.
  if (config.preset === 'fullSupport') S.npcs.forEach(n => { n.gone = false; n.out = 0; });
  const present = S.npcs.filter(n => !n.gone);
  present.slice(0, config.preset === 'fullSupport' ? 4 : config.preset === 'supported' ? 2 : config.preset === 'balanced' ? 1 : 0).forEach(n => { n.loy = 5; });
  if (config.preset === 'integrity') S.flags.HID_DUI = true;
  S.items = ['coin', 'wind', 'deocs'];
  if (config.exact) S.deocsUntil = S.nodeCount + DIFFICULTY.deocsStops;
  S.notice = null; S.noticeQ = []; S.log = []; S.requests = [];
  hist = []; FX = []; VEIL = null; veilFor = 0; emit('resetFx');
  startBoss();
  log('Practice', BOSS_PRACTICE_PRESETS[config.preset] || 'Balanced');
}
function gmBossPracticeControls() {
  const config = S.practiceConfig;
  return `<div class="gcard practice-controls"><div class="row"><b>🧪 BOSS PRACTICE</b><span class="note">Separate save and phone room · no leaderboard or grades</span></div>
    <div class="row"><label>Squadron <select data-inp="practiceUnit">${UNITS.map(u => `<option value="${u.id}" ${config.unit === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
    <label>Preset <select data-inp="practicePreset">${Object.entries(BOSS_PRACTICE_PRESETS).map(([id, text]) => `<option value="${id}" ${config.preset === id ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>
    <label><input type="checkbox" data-inp="practiceExact" ${config.exact ? 'checked' : ''}> Exact meters</label>${B('newRun', '🔁 Apply setup / restart boss', { cls: 'pri' })}
    <a class="b sm" href="bench.html?practice=boss" target="practicumPracticeBench">Projector + practice phones</a></div>
    <details><summary>Practice team and controls</summary><p class="note">Flight Commander, Senior Enlisted Leader, First Sergeant and UTM, with level-up upgrades. All items and perks reset on restart. Connect phones to vote, or select Attack/Defend from the GM controls. Undo remains available.</p></details></div>`;
}
/* ---- boss: opening modifiers, support, audit, then three telegraphed rounds ----
   Each round: intent -> team action -> team result -> IG turn -> recap.
   The team shares one action. Block lasts through the pending IG attack only. */
function startBoss() {
  S.phase = 'boss'; S.cur = null; S.banner = null; S.actor = null; S.votes = {}; S.bossReady = false;
  const broken = S.npcs.filter(n => !n.gone && (n.broken || n.loy === 0));
  const squadHp = S.unit === 'sa' ? Math.ceil(DIFFICULTY.bossHp * 0.15) : 0;
  // Keep the original balance calculation, but resolve each modifier visibly before Support.
  const hasReadiness = S.party.some(p => !p.fired && CLASS[p.cls] && CLASS[p.cls].ability && CLASS[p.cls].ability.id === 'readiness');
  const nonSquadRaw = DIFFICULTY.bossHp + (S.flags.WITNESS_IG ? 3 : 0) + broken.length * DIFFICULTY.witnessHp;
  const mock = hasReadiness ? Math.round(nonSquadRaw * DIFFICULTY.mockInspPct / 100) : 0;
  const hp = DIFFICULTY.bossHp;
  const opening = [];
  if (S.flags.WITNESS_IG) opening.push({ icon: '🕵️', name: 'The Witness', amount: 3, why: 'The Witness reported the flight to the IG.' });
  broken.forEach(n => opening.push({ icon: '🗣️', name: `${n.rank} ${n.name}`, amount: DIFFICULTY.witnessHp, why: 'A broken unit member becomes a hostile witness.' }));
  if (squadHp) opening.push({ icon: '📋', name: 'Inspection Scrutiny', amount: squadHp, percent: 15, why: '7th IS: +15% of the IG’s base HP, rounded up.' });
  if (mock) {
    const position = S.party.find(p => !p.fired && CLASS[p.cls]?.ability?.id === 'readiness');
    opening.push({ icon: '🔍', name: 'Readiness Inspection', amount: -mock, cadet: S.party.indexOf(position),
      why: `Mock inspections clear ${mock} HP of findings (${DIFFICULTY.mockInspPct}% of base HP${nonSquadRaw > hp ? ' plus hostile-witness bonuses' : ''}, rounded).` });
  }
  const enlistedForceMultiplier = enlistedForceMultiplierOn(S);
  const allyDamage = enlistedForceMultiplier ? 3 : 2; // +50% from the normal 2 damage per Ally.
  const vouches = S.npcs.filter(isAlly).map(n => ({ slot: n.slot, name: `${n.rank} ${n.name}`, kind: 'ally', damage: allyDamage,
    why: `${n.rank} ${n.name} is an Ally (${allyDamage} damage${enlistedForceMultiplier ? ' · Enlisted Force Multiplier +50%' : ''})` }));
  const intentValue = S.meters[S.intent];
  if (intentValue >= 7) vouches.push({ kind: 'cc', name: S.cc, damage: DIFFICULTY.vouch, why: `${S.cc} vouches for the flight: ${METER[S.intent].label} is strong (${DIFFICULTY.vouch} damage)` });
  else if (intentValue <= 3) vouches.push({ kind: 'cc', name: S.cc, heal: DIFFICULTY.vouch, why: `${S.cc} throws the flight under the bus: ${METER[S.intent].label} is low (IG gains ${DIFFICULTY.vouch} HP)` });
  S.boss = { hp, max: hp, round: 0, stage: 'opening', opening, openingIdx: 0, openingCurrent: null, log: [], atk: null, attackedMeters: [], votes: {}, allyUsed: {}, adverse: false,
    vouches, vouchIdx: 0, vouchCurrent: null, supporters: vouches.filter(v => v.kind === 'ally' || (v.kind === 'cc' && v.damage)),
    weak: S.npcs.some(n => !n.gone && n.trait === 'witness' && n.loy >= 4), wargame: null, lastFails: [], res: [],
    p2: { who: null, q: [], stars: [0, 0], rolls: null, done: false } };
  const Bs = S.boss;
  bossLog(`👹 ${BOSS.name} arrives: ${hp} base HP. Opening modifiers resolve before Support.`);
  if (enlistedForceMultiplier && vouches.some(v => v.kind === 'ally')) bossLog('🎖️ Enlisted Force Multiplier: each Ally deals 3 damage during the inspection (+50%).');
  if (Bs.weak) bossLog(`🕵️ The Witness tipped you off: Attack target ${examDC(Bs)}.`);
  bossLog('🤝 SUPPORT ATTACK: allies and the commander respond before The Audit.');
  if (!vouches.length) bossLog('No allies or commander actions are available.');
  sfx('boss');
  log('BOSS', `${BOSS.name}, ${BOSS.title} (HP ${Bs.hp})`);
}
function bossVouchNext() {
  const Bs = S.boss; if (!Bs || Bs.stage !== 'vouch') return false;
  // Support damage never skips the integrity audit, even if it brings HP to zero.
  if (Bs.vouchCurrent && Bs.vouchIdx >= Bs.vouches.length) { Bs.stage = 'intro'; sfx('start'); return; }
  const v = Bs.vouches[Bs.vouchIdx++]; if (!v) { Bs.stage = 'intro'; sfx('start'); return; }
  Bs.vouchCurrent = v;
  const hpBefore = Bs.hp;
  if (v.damage) { bossDmg(v.damage, v.why); v.actualDamage = hpBefore - Bs.hp;
    bossCombatFx({ side: 'team', actor: v.name, narration: bossSupportNarration(v), portrait: bossPortrait(v.slot ? S.npcs.find(n => n.slot === v.slot) : { name: S.cc }), label: 'SUPPORT ATTACK', damage: v.actualDamage, hpBefore, hpAfter: Bs.hp }); }
  else if (v.heal) { Bs.hp += v.heal; bossLog(`👎 ${v.why}`);
    bossCombatFx({ side: 'boost', actor: v.name, portrait: bossPortrait({ name: S.cc }), narration: bossSupportNarration(v), label: 'THROWN UNDER THE BUS', heal: v.heal, hpBefore, hpAfter: Bs.hp }); }
  Bs.vouchKO = Bs.hp <= 0;
}
function bossLog(t) { S.boss.log.push(t); }
function bossAttackCopy(Bs) {
  if (Bs.stage === 'resolved') {
    return Bs.attackDamage
      ? `✅ Round ${Bs.round} attack landed: ${Bs.atk.name} · ${METER[Bs.atk.k].label} −${Bs.attackDamage} applied. No further meter damage this round.`
      : `🛡️ Round ${Bs.round} attack resolved: the team fully blocked ${Bs.atk.name}. No meter damage this round.`;
  }
  return `⚠️ Incoming this round: ${Bs.atk.name} targets ${METER[Bs.atk.k].label}: ${Bs.atk.n} incoming before Block and loss reducers.`;
}
function bossDmg(n, why) {
  const actual = Math.min(S.boss.hp, n);
  S.boss.hp = Math.max(0, S.boss.hp - n);
  bossLog(`💥 IG loses ${actual} HP: ${why}`);
}
function bossPortrait(p) {
  return p ? { seed: p.rank ? p.name + p.rank : p.name, av: p.av, uni: p.uni, hair: p.hair } : null;
}
function bossTeamPortraits() {
  return S.party.filter(p => p.name && !p.fired).map(p => ({ name: rankName(p), portrait: bossPortrait(p) }));
}
function bossSupportLineup(state = S) {
  const b = state.boss;
  if (!b || b.stage !== 'vouch') return [];
  const current = b.vouchCurrent ? b.vouchIdx - 1 : b.vouchIdx;
  return (b.vouches || []).map((v, i) => ({ ...v, index: i })).filter(v => v.damage).map(v => ({
    name: v.name, kind: v.kind, active: v.index === current, done: v.index < current,
    portrait: bossPortrait(v.slot ? state.npcs.find(n => n.slot === v.slot) : { name: state.cc })
  }));
}
function bossSupportNarration(v) {
  if (v.kind === 'ally') return `🤝 ${v.name} is an Ally and deals ${v.damage} total damage to the IG${v.damage > 2 ? `: 2 base + ${v.damage - 2} from 📣 Enlisted Force Multiplier (+50%)` : ''}.${v.actualDamage != null && v.actualDamage < v.damage ? ` Only ${v.actualDamage} HP remained.` : ''}`;
  return v.heal ? `👎 Low commander intent: ${v.name} blames the flight. The IG gains ${v.heal} HP.` : `👍 High commander intent: ${v.name} vouches for the flight and deals ${v.actualDamage ?? v.damage} damage to the IG.`;
}
function bossOpeningNarration(e) {
  return e.amount < 0 ? `🔍 ${rankName(S.party[e.cadet])} uses Readiness Inspection: ${DIFFICULTY.mockInspPct}% HP reduction, dealing ${e.actualDamage ?? -e.amount} damage to the IG.` : `${e.icon} ${e.name}: ${e.why} IG gains ${e.amount} HP.`;
}
function bossReadinessChargeMs(data) {
  return data.integrityPass && data.chargeMeters?.length ? data.chargeMeters.length * 1100 + 450 : 0;
}
function bossCombatFx(data) {
  const defeatTime = !data.miss && data.side === 'team' && data.hpBefore > 0 && data.hpAfter <= 0 ? 2500 : 0;
  queueGMNext((data.integrityPass ? 7200 : 2600) + defeatTime + bossReadinessChargeMs(data) + (data.recovering ? 1400 : 0));
  return emit('bossCombat', { ...data, stage: S.boss.stage, round: S.boss.round, supportLineup: bossSupportLineup(S), max: S.boss.max, patch: patchOf(S), metersAfter: { ...S.meters } });
}
const examDC = Bs => DIFFICULTY.examDC - (Bs && Bs.weak ? 3 : 0);
// Opening audit: integrity first (any trap = Game Over), then readiness
function bossAudit() {
  const Bs = S.boss, hpBefore = Bs.hp, before = { ...S.meters }, lossIndex = (S.lossReductions || []).length;
  const traps = TRAP_FLAGS.filter(f => S.flags[f]);
  bossLog('📋 THE AUDIT: the clipboard scans your run...');
  if (traps.length) {
    Bs.stage = 'integrityStrike'; Bs.integrityReasons = traps.map(f => FLAG_TEXT[f]);
    bossLog('🚨 Integrity violation: the IG launches a decisive finding against the flight.');
    queueGMNext(4500, 'integrity');
    emit('bossIntegrity', { patch: patchOf(S), reasons: Bs.integrityReasons });
    return true;
  }
  bossLog('✅ No integrity findings.');
  const honest = S.flags.HONEST_BROKER ? 2 : 0;
  if (honest) { applyEff({ tru: 2, why: 'Honest Broker' }); bossDmg(2, 'You reported the real numbers (Honest Broker)'); }
  const strong = METERS.filter(m => S.meters[m.k] >= 5).length;
  const readiness = Math.min(8, strong * 2);
  if (readiness) bossDmg(readiness, `${strong} meters at 5+ (readiness)`);
  else bossLog('No meters at 5+. The audit finds nothing to praise.');
  Bs.auditResult = { damage: hpBefore - Bs.hp, honest, readiness, strong, changes: bossMeterChanges(before), reductions: (S.lossReductions || []).slice(lossIndex) };
  bossCombatFx({ side: 'team', integrityPass: true, chargeMeters: METERS.filter(m => S.meters[m.k] >= 5).map(m => m.k), attackers: bossTeamPortraits(), actor: honest ? 'Flight readiness · Honest Broker' : 'Flight readiness', narration: `✅ Integrity passed. ${strong} meters at 5+${honest ? ' and Honest Broker' : ''} deal ${hpBefore - Bs.hp} damage to the IG.`, label: 'CLEAN FLIGHT · INTEGRITY PASSED', damage: hpBefore - Bs.hp, hpBefore, hpAfter: Bs.hp });
  Bs.stage = 'auditResult';
  return false;
}
function bossMeterChanges(before) { return METERS.map(m => [m.k, S.meters[m.k] - before[m.k]]).filter(([, d]) => d); }
function bossStageLabel(Bs) {
  return { opening: 'OPENING EFFECTS', vouch: 'SUPPORT ATTACK', intro: 'THE AUDIT', integrityStrike: 'INTEGRITY VIOLATION', auditResult: 'AUDIT RESULT', intent: 'IG INTENT', hotseat: 'THE HOT SEAT', interviewResult: 'INTERVIEW RESULT', act: 'YOUR TURN', playerResult: 'TEAM ACTION RESULT', enemy: 'IG TURN', resolved: 'ROUND COMPLETE', done: 'INSPECTION COMPLETE' }[Bs.stage] || 'INSPECTION';
}
function bossAttackPreview(state = S) {
  const candidates = state.party.map((p, i) => ({ i, stat: bestStat(i) })).filter(x => !isOut(state, x.i))
    .sort((a, b) => statOf(b.i, b.stat) - statOf(a.i, a.stat) || a.i - b.i);
  if (!candidates.length) return null;
  const { i, stat } = candidates[0];
  const parts = [[stat, statOf(i, stat)]];
  if (leanBonus(state)) parts.push(['Lean on Experience', leanBonus(state)]);
  if (state.unit === 'wk') parts.push(['Flightline Reliability', -1]);
  if (state.boss.adverse) parts.push(['Adverse Finding', -1]);
  const item = LOOT.find(l => l.id === state.pending?.check && state.items.includes(l.id) && l.use.type === 'check');
  if (item) parts.push([item.name, item.use.n]);
  const bonus = parts.reduce((sum, [, n]) => sum + n, 0);
  const target = examDC(state.boss), need = Math.max(2, Math.min(20, target - bonus));
  return { i, name: rankName(state.party[i]), stat, bonus, parts, item: item?.id || null, target, need, chance: (21 - need) * 5 };
}
function bossRecap(Bs) {
  const changes = list => (list || []).map(([k, d]) => `${METER[k].icon} ${METER[k].label} ${sign(d)}`);
  if (Bs.stage === 'auditResult') {
    const a = Bs.auditResult || {};
    return ['✅ Integrity check passed', `Readiness: ${a.strong || 0} meters at 5+ → ${a.readiness || 0} damage`, ...(a.honest ? [`Honest Broker → ${a.honest} damage`] : []), `IG loses ${a.damage || 0} HP`, ...(a.reductions || []).map(lossReductionText), ...changes(a.changes)];
  }
  if (Bs.stage === 'interviewResult') return [`${Bs.p2.stars[0]} / 3 stars`, `IG loses ${Bs.interviewDamage || 0} HP`, ...(Bs.interviewItem ? [`${Bs.interviewItem}: rating +1 (maximum 3 stars)`] : []), ...(Bs.interviewBonus ? ['Welcomed Airman: +1 damage'] : []), ...(Bs.interviewReductions || []).map(lossReductionText), ...changes(Bs.interviewChanges)];
  const t = Bs.turnResult;
  const team = t ? [t.action === 'defend' ? `🛡️ Team gained ${t.block} Block${Bs.stage === 'resolved' ? ' · now expired' : ' for this round'}` : `🗡️ IG loses ${t.damage} HP`, ...(t.roll ? [`${t.roll.name || 'Attacker'}: ${t.roll.d} ${sign(t.roll.bonus)} = ${t.roll.d + t.roll.bonus} vs ${t.roll.target} · ${t.roll.d === 20 ? 'CRITICAL HIT' : t.roll.pass ? 'HIT' : 'MISS'}`] : []), ...(t.item ? [`${t.item} consumed for this roll`] : []), ...(t.reward ? [t.reward] : []), ...(t.fumble ? [`🤦 ${t.fumble}`] : []), ...(t.reductions || []).map(lossReductionText), ...changes(t.changes)] : [];
  if (Bs.stage === 'resolved') return [...team, `👹 ${Bs.atk.name}: ${Bs.attackBlocked ?? 0} blocked · ${Bs.attackDamage ?? 0} ${METER[Bs.atk.k].label} damage`, ...(Bs.enemyReductions || []).map(lossReductionText), ...changes(Bs.enemyChanges), ...(Bs.enemyHeal ? [`🚨 Adverse Finding: ${METER[Bs.atk.k].label} resets to 1; IG +${Bs.enemyHeal} HP`] : [])];
  return team;
}
function bossRound(r) {
  const Bs = S.boss, Rd = BOSS_ROUNDS[r - 1];
  Bs.round = r; Bs.votes = {}; Bs.teamAction = null; Bs.wargame = null; Bs.lastFails = []; Bs.res = [];
  Bs.block = 0; Bs.turnResult = null; Bs.attackDamage = null; Bs.attackBlocked = 0; Bs.enemyChanges = []; Bs.enemyReductions = []; Bs.enemyHeal = 0;
  // The IG favors low meters, but switches to a fresh target whenever one is
  // available so the same weakness is not hit repeatedly across rounds.
  const attacked = Bs.attackedMeters || [];
  const fresh = Rd.targets.filter(k => !attacked.includes(k));
  const k = (fresh.length ? fresh : Rd.targets).slice().sort((a, b) => S.meters[a] - S.meters[b])[0];
  Bs.attackedMeters = attacked.concat(k);
  Bs.atk = { k, n: DIFFICULTY.bossAttack, name: Rd.atk };
  bossLog(`${Rd.icon} ROUND ${r}: ${Rd.name}. The IG telegraphs ${Rd.atk}: ${METER[k].icon} −${Bs.atk.n} at the end of the round${fresh.length && attacked.length ? ' (switching to a meter it has not attacked yet)' : ''}.`);
  Bs.stage = 'intent';
  sfx('alarm');
}
function bossBeginTurn() {
  const Bs = S.boss;
  if (Bs.round !== 2 || Bs.p2.done) { Bs.stage = 'act'; return; }
  const before = { ...S.meters }, lossIndex = (S.lossReductions || []).length;
  Bs.stage = 'hotseat'; S.actor = null;
  const question = BOSS_QUESTIONS[S.unit] || 'What is your squadron responsible for, and how do you know the flight is ready?';
  Bs.p2 = { who: null, q: [question], stars: [0], rolls: S.party.map(() => null), settled: S.party.map(() => false), rollIds: S.party.map(() => null), done: false };
  if (S.flags.VAGUE_ANSWER) { applyEff({ tru: -2, why: '"You said you were on it."' }); bossLog('😬 Vague Answer: Trust −2'); }
  if (S.flags.DODGED && S.phase === 'boss') { applyEff({ tru: -2, why: '"Whose tasking was it, really?"' }); bossLog('😬 Dodged responsibility: Trust −2'); }
  Bs.interviewConsequences = [...(S.flags.VAGUE_ANSWER ? ['Vague Answer: earlier promises are challenged'] : []), ...(S.flags.DODGED ? ['Dodged responsibility: the IG follows up'] : []), ...(S.lossReductions || []).slice(lossIndex).map(lossReductionText), ...bossMeterChanges(before).map(([k, d]) => `${METER[k].icon} ${METER[k].label} ${sign(d)}`)];
}
// Round 2: every active cadet rolls a d20; the lowest roll faces the squadron-specific hot-seat question.
function bossHotSeat(i) {
  const Bs = S.boss;
  if (S.phase !== 'boss' || !Bs || Bs.stage !== 'hotseat' || Bs.p2.who || !Number.isInteger(i) || !S.party[i]?.name || S.party[i].fired || Bs.p2.rolls?.[i] != null) return false;
  const p = Bs.p2;
  p.rolls ||= S.party.map(() => null); p.settled ||= S.party.map(() => false); p.rollIds ||= S.party.map(() => null);
  const animationId = `hotseat-${Date.now()}-${++fxSeq}`;
  p.rolls[i] = 1 + rnd(20); p.rollIds[i] = animationId;
  emit('hotSeatDie', { i, name: rankName(S.party[i]), v: p.rolls[i], animationId });
  // A missing projector or interrupted animation cannot strand an already rolled die.
  setTimeout(() => { if (S.boss?.p2 === p) acknowledgeDice(animationId); }, 22000);
}
function bossHotSeatResult() {
  const b = S.boss, p = b.p2;
  const eligible = S.party.map((x, i) => i).filter(i => S.party[i].name && !S.party[i].fired);
  if (p.who || !eligible.length || !eligible.every(i => p.rolls[i] != null && p.settled[i])) return;
  const low = Math.min(...eligible.map(i => p.rolls[i]));
  const tied = eligible.filter(i => p.rolls[i] === low), lowest = tied[rnd(tied.length)];
  p.who = [lowest]; p.tied = tied.length > 1;
  bossLog(`🎲 Hot seat: ${cadetName(lowest)} rolled ${low}${p.tied ? ' (lowest-roll tie, randomly selected)' : ' (lowest)'} and faces the interview.`);
  sfx('alarm');
}
function bossStarsDone() {
  const Bs = S.boss; if (!Bs || Bs.stage !== 'hotseat' || !Bs.p2.who || Bs.p2.done || ![1, 2, 3].includes(Bs.p2.stars[0])) return false;
  const st = Bs.p2.stars, hpBefore = Bs.hp, before = { ...S.meters }, lossIndex = (S.lossReductions || []).length;
  const starItem = S.items.includes(S.pending.star) && LOOT.find(l => l.id === S.pending.star && l.use.type === 'star');
  Bs.interviewItem = null;
  if (starItem && st[0] < 3) { st[0]++; Bs.interviewItem = starItem.name; removeItem(starItem.id); }
  S.pending.star = null;
  const total = st[0];
  S.starsTotal += total; S.micCount++; if (total < 2) S.micLow = true;
  if (total === 3) { award('clearcomms'); ccApply('stars3', '3⭐ IG interview'); withTrait('climber').forEach(n => traitReward(n, 'Public praise. They noticed, and so did everyone else.', null, 2)); }
  if (total === 1) ccApply('stars1', '1⭐ IG interview');
  if (S.phase !== 'boss') return;
  Bs.interviewChanges = bossMeterChanges(before); Bs.interviewReductions = (S.lossReductions || []).slice(lossIndex);
  bossDmg(total, `Interview answer (${st[0]}★)`);
  if (S.flags.NEWKID_ALLY) bossDmg(1, 'The new Airman you welcomed vouches for you');
  Bs.p2.done = true; Bs.interviewDamage = hpBefore - Bs.hp; Bs.interviewBonus = !!S.flags.NEWKID_ALLY; Bs.stage = 'interviewResult';
  bossCombatFx({ side: 'team', reuseHotSeat: true, actor: cadetName(Bs.p2.who[0]), narration: `🎤 ${cadetName(Bs.p2.who[0])} earns ${total} stars for their answer${Bs.interviewBonus ? ' · 🤝 the welcomed Airman adds support' : ''}, dealing ${Bs.interviewDamage} damage to the IG.`, portrait: bossPortrait(S.party[Bs.p2.who[0]]), label: `HOT SEAT · ${total} STARS`, damage: Bs.interviewDamage, hpBefore, hpAfter: Bs.hp });
  S.objLog = (S.objLog || []).concat({ n: S.nodeCount, title: 'THE IG INTERVIEW', icon: '🎤', choice: `${cadetName(Bs.p2.who[0])}: ${st[0]}★`, obj: ['speak'] });
}
// Each cadet votes for one shared squadron action.
function bossActOk(i, a) {
  const Bs = S.boss; if (!Bs || Bs.stage !== 'act' || !a || isOut(S, i) || !S.party[i]) return false;
  return (a.type === 'press' && !!bossAttackPreview(S)) || a.type === 'defend';
}
// The squad's shared attack uses the best available cadet and their best stat.
function bestStat(i) { return STATS.slice().sort((a, b) => statOf(i, b) - statOf(i, a))[0]; }
function bossActText(a) {
  if (!a) return '⏳ choosing...';
  if (a === 'press' || a.type === 'press') return '🗡️ Team attack';
  if (a === 'defend' || a.type === 'defend') return '🛡️ Team defend';
  return '';
}
function bossResolve() {
  const Bs = S.boss; if (!Bs || Bs.stage !== 'act') return false;
  const teamVotes = Bs.votes || {}, votes = Object.values(teamVotes).filter(Boolean), count = { press: votes.filter(v => v === 'press').length, defend: votes.filter(v => v === 'defend').length };
  let action = Bs.teamAction;
  if (!['press', 'defend'].includes(action)) {
    if (!votes.length) return false;
    else if (count.press === count.defend) {
      const authority = crownIdx(S);
      if (authority >= 0 && teamVotes[authority]) action = teamVotes[authority];
      else {
        const gmPick = prompt(authority >= 0 ? `The boss vote is tied. Ask ${rankName(S.party[authority])} to choose ATTACK or DEFEND (Command Token):` : 'The boss vote is tied. As GM, choose ATTACK or DEFEND:', 'ATTACK');
        if (!gmPick || !['ATTACK', 'DEFEND'].includes(gmPick.trim().toUpperCase())) return false;
        action = gmPick.trim().toLowerCase() === 'defend' ? 'defend' : 'press';
      }
    } else action = count.press > count.defend ? 'press' : 'defend';
  }
  const attack = bossAttackPreview(S);
  if (action === 'press' && !attack) return false;
  Bs.teamAction = action; bossLog(`🤝 The team chooses ${action === 'press' ? 'ATTACK' : 'DEFEND'} (${count.press} attack, ${count.defend} defend votes).`);
  const dc = examDC(Bs);
  const hpBefore = Bs.hp, before = { ...S.meters }, lossIndex = (S.lossReductions || []).length;
  let fumble = '', itemUsed = '', reward = '', rollFx = null;
  Bs.block = action === 'defend' ? 2 : 0;
  if (action === 'press') {
    if (attack) {
      const { i, stat, bonus: attackBonus } = attack, d = 1 + rnd(20), sv = statOf(i, stat), bonus = attackBonus - sv, total = d + attackBonus;
      if (attack.item) { itemUsed = LOOT.find(l => l.id === attack.item).name; removeItem(attack.item); S.pending.check = null; }
      const pass = d === 20 || (d !== 1 && total >= dc);
      Bs.res = [{ i, name: cadetName(i), d, bonus: attackBonus, stat, pass }];
      queueGMNext(6000);
      rollFx = emit('multiDice', { title: `ROUND ${Bs.round} · TEAM ATTACK · GOAL DIE: ${attack.need}+`, rows: [{ name: cadetName(i), av: S.party[i].av, uni: S.party[i].uni, hair: S.party[i].hair, v: d, hi: pass, goal: attack.need, tag: d === 20 ? 'CRIT! 4 DMG' : d === 1 ? 'FUMBLE' : `${d} ${sign(attackBonus)} = ${total} · ${pass ? 'HIT' : 'MISS'}` }] });
      S.spinUntil = Date.now() + 4200; setTimeout(afterSpin, 4260);
      if (d === 20) { bossDmg(4, `${cadetName(i)} critical hit (${stat})`); award('crit'); }
      else if (pass) bossDmg(2, `${cadetName(i)} hits (${d} ${sign(attackBonus)} = ${total} vs ${dc}; ${attack.parts.map(([name, n]) => name + ' ' + sign(n)).join(', ')})`);
      else { bossLog(`❌ ${cadetName(i)}: ${total} vs ${dc} (miss)`); if (d === 1) { const f = pickOne(FUMBLES); fumble = `${f.name}: ${f.special === 'cac' ? 'The check fails; no offline penalty because the route is complete.' : f.text}`; applyFumble(f, null); bossLog(`🤦 Natural 1: ${f.name} (${f.text})`); } }
      if (pass && S.party[i].up === 'standards') { applyEff({ tru: 1, why: 'Standards Bearer' }); reward = 'Standards Bearer: Trust +1 (up to 10)'; }
    }
  }
  if (S.phase !== 'boss') return;
  const roll = Bs.res[0];
  Bs.turnResult = { action, damage: Math.max(0, hpBefore - Bs.hp), block: Bs.block, fumble, item: itemUsed, reward,
    roll: roll ? { ...roll, target: dc } : null, changes: bossMeterChanges(before), reductions: (S.lossReductions || []).slice(lossIndex) };
  if (rollFx) rollFx.combat = { side: 'team', attackers: bossTeamPortraits(), actor: attack.name, label: roll?.pass ? 'TEAM ATTACK' : 'TEAM ATTACK · MISS', damage: Bs.turnResult.damage, miss: !roll?.pass, hpBefore, hpAfter: Bs.hp, max: Bs.max, patch: patchOf(S), metersAfter: { ...S.meters } };
  else if (action === 'defend') bossCombatFx({ side: 'defend', actor: 'Your flight', label: 'DEFEND', block: Bs.block, hpBefore, hpAfter: Bs.hp });
  if (rollFx) rollFx.combat.narration = roll.pass ? `🎲 ${attack.name} ${roll.d === 20 ? 'rolls a natural 20 — critical hit' : 'passes the attack roll'}, dealing ${Bs.turnResult.damage} damage to the IG.` : `🎲 ${attack.name} misses the attack roll. The IG takes no damage.`;
  Bs.stage = 'playerResult'; Bs.votes = {};
  if (S.gmNext) S.gmNext.after = 'bossResponse';
}
function finishBossTeamAction(q) {
  if (S.gmNext !== q || S.phase !== 'boss' || S.boss?.stage !== 'playerResult') return false;
  S.gmNext = null; S.spinUntil = 0; emit('gmNext');
  if (S.boss.hp <= 0) return endBoss();
  S.boss.stage = 'enemy';
  return bossEnemyAttack();
}
function bossEnemyAttack() {
  const Bs = S.boss; if (!Bs || Bs.stage !== 'enemy') return false;
  if (Bs.hp <= 0) return endBoss();
  const before = { ...S.meters }, hpBefore = Bs.hp, lossIndex = (S.lossReductions || []).length;
  const block = Math.min(Bs.atk.n, Bs.block || 0), n = Math.max(0, Bs.atk.n - block);
  Bs.attackDamage = meterLossPreview(Bs.atk.k, n).loss; Bs.attackBlocked = block;
  const hitMeterAfter = Math.max(0, before[Bs.atk.k] - Bs.attackDamage), holdUsedBefore = !!S.flags.perkUsed_hold;
  const holder = S.party.find(p => p.cls === 'fc' && !p.fired && p.perk === 'hold');
  const recovering = n > 0 && hitMeterAfter === 0 && ((!holdUsedBefore && holder) || S.crises < 1);
  const combat = bossCombatFx({ side: 'ig', actor: BOSS.name, label: Bs.atk.name, damage: Bs.attackDamage, blocked: block, meter: Bs.atk.k, metersBefore: before, meterBefore: before[Bs.atk.k], meterAfter: hitMeterAfter, hitMeterAfter, recovering: !!recovering, hpBefore, hpAfter: Bs.hp });
  if (n) {
    applyEff({ [Bs.atk.k]: -n, why: Bs.atk.name });
    bossLog(`🗡️ ${Bs.atk.name}: ${METER[Bs.atk.k].icon} −${Bs.attackDamage}${block ? ` (${block} blocked)` : ''}`);
    if (S.meters[Bs.atk.k] < 3) S.flags.bossDrop = true;
  } else bossLog(`🛡️ The team blocked ${Bs.atk.name} completely.`);
  combat.metersAfter = { ...S.meters }; combat.meterAfter = S.meters[Bs.atk.k]; combat.hpAfter = Bs.hp;
  if (combat.meterAfter > hitMeterAfter) {
    const held = !holdUsedBefore && S.flags.perkUsed_hold;
    combat.recovery = { name: held ? 'Hold the Line' : 'Adverse Finding', from: hitMeterAfter, to: combat.meterAfter,
      text: held ? `🛡️ ${rankName(holder)} · Hold the Line restores ${METER[Bs.atk.k].label} from 0 to 3. Crisis prevented.`
        : `🚨 Adverse Finding: ${METER[Bs.atk.k].label} hit 0 and resets to 1. IG gains ${DIFFICULTY.adverseHeal} HP.` };
  }
  combat.reductions = (S.lossReductions || []).slice(lossIndex);
  if (S.phase !== 'boss') return;
  Bs.enemyReductions = (S.lossReductions || []).slice(lossIndex);
  Bs.enemyChanges = bossMeterChanges(before); Bs.enemyHeal = Math.max(0, Bs.hp - hpBefore);
  Bs.block = 0; Bs.stage = 'resolved';
  log('Boss round', `${Bs.round}: IG at ${Bs.hp} HP`);
}
function bossNext() {
  const Bs = S.boss; if (!Bs) return false;
  if (Bs.stage === 'opening') {
    const effect = Bs.opening[Bs.openingIdx++];
    if (!effect) { Bs.stage = 'vouch'; return bossVouchNext(); }
    Bs.openingCurrent = effect;
    if (effect.amount < 0) {
      const before = Bs.hp;
      bossDmg(-effect.amount, `${rankName(S.party[effect.cadet])} · ${effect.name}`);
      effect.actualDamage = before - Bs.hp;
      bossCombatFx({ side: 'team', actor: rankName(S.party[effect.cadet]), projectile: '📋', narration: bossOpeningNarration(effect), portrait: bossPortrait(S.party[effect.cadet]), label: effect.name, damage: effect.actualDamage, hpBefore: before, hpAfter: Bs.hp });
    } else {
      const before = Bs.hp;
      Bs.hp += effect.amount;
      bossLog(`${effect.icon} ${effect.name}: IG +${effect.amount} HP. ${effect.why}`);
      bossCombatFx({ side: 'boost', actor: effect.name, boostIcon: effect.name === 'Inspection Scrutiny' ? '👁️' : effect.icon, narration: bossOpeningNarration(effect), label: 'BONUS HP', heal: effect.amount, percent: effect.percent, hpBefore: before, hpAfter: Bs.hp });
    }
    return;
  }
  if (Bs.stage === 'intro') { bossAudit(); return; }
  if (Bs.stage === 'auditResult') return Bs.hp <= 0 ? endBoss() : bossRound(1);
  if (Bs.stage === 'intent') return bossBeginTurn();
  if (Bs.stage === 'interviewResult') { if (Bs.hp <= 0) return endBoss(); Bs.stage = 'act'; return; }
  if (Bs.stage === 'playerResult') { if (Bs.hp <= 0) return endBoss(); Bs.stage = 'enemy'; return; }
  if (Bs.stage === 'enemy') return bossEnemyAttack();
  if (Bs.stage === 'resolved') return Bs.round < BOSS_ROUNDS.length ? bossRound(Bs.round + 1) : endBoss();
  return false;
}
function endBoss() {
  const Bs = S.boss, hp = Bs.hp;
  if (hp <= 0) Bs.defeatedPhase = Math.max(3, Math.min(6, (Bs.round || 0) + 3));
  const res = hp <= 0 ? ['🏆 OUTSTANDING', 60] : hp <= 5 ? ['🥇 EXCELLENT', 35] : hp <= 10 ? ['✅ SATISFACTORY', 10] : ['⚠️ MARGINAL', -15];
  Bs.result = res[0]; S.bossBonus = res[1]; Bs.stage = 'done';
  bossLog(`INSPECTION RESULT: ${res[0]} (${sign(res[1])})`);
  const defeat = bossDefeatScore(S);
  if (defeat) bossLog(`🏆 Phase ${defeat.phase} victory: 30 ×${defeat.multiplier} = ${defeat.points} defeat points.`);
  if (hp <= 0 && !S.flags.bossDrop) award('flawless');
  // The result stays on the battle board until the GM advances.
  sfx(hp <= 5 ? 'level' : 'bad');
  log('Inspection', res[0]);
}
function finishGame() {
  if (!S.gameOver) {
    if (METERS.every(m => S.meters[m.k] >= 5)) award('balanced');
    if (!S.flags.npcZero) award('nobody');
    if (S.micCount > 0 && !S.micLow) award('servant');
  }
  const sc = computeScore(S);
  S.final = { ...sc, grade: gradeFor(S, sc.total), at: Date.now() };
  S.phase = 'results';
  saveToBoard();
  emit('results'); // the projector builds up the grade reveal itself
}
function gameOver(reasons, kind = 'integrity', cinematic = false) {
  S.gameOver = true; S.gameOverReasons = reasons; S.gameOverKind = kind;
  S.cur = null; S.inject = null; S.actor = null; S.notice = null; S.noticeQ = [];
  if (S.boss) bossLog(`🚨 ${kind === 'crisis' ? 'SECOND CRISIS' : 'INTEGRITY FINDING'}: ` + reasons.join('; '));
  log('GAME OVER', reasons.join('; '));
  if (!cinematic) emit('gameOver', { reasons, kind }); sfx('over');
  const sc = computeScore(S);
  S.final = { ...sc, grade: gradeFor(S, sc.total), at: Date.now() };
  S.phase = 'results';
  saveToBoard();
}
// Every finished run goes on the leaderboard automatically (Game Overs show as 💀). Saving again
// (e.g. after fixing the team name) updates the same entry instead of adding a second one.
function saveToBoard() {
  if (S.practice || IS_BOSS_PRACTICE) return false;
  const u = UNITS.find(x => x.id === S.unit);
  S.boardDate = S.boardDate || new Date().toISOString();
  const b = loadBoard().filter(r => r.date !== S.boardDate);
  b.push({
    callsign: (S.callsign || 'NO PATCH').toUpperCase().slice(0, 18), unit: u ? u.name : '', grade: S.final.grade.g,
    score: S.final.total, low: Math.min(...METERS.map(m => S.meters[m.k])), stars: S.starsTotal, ach: S.ach.length,
    gameOver: S.gameOver, cadets: S.party.map(c => rankName(c)).join(', '), date: S.boardDate, patch: (patchOf(S) || {}).icon || '', patchKey: S.patch ? `${S.unit}:${S.patch}` : '',
  });
  saveBoard(b); S.saved = true;
  if (typeof saveTeamReport === 'function') saveTeamReport(S);
  if (typeof cloudQueue === 'function') cloudQueue(S.boardDate); // shared leaderboard (cloud.js)
  log('Leaderboard', `Saved as ${S.callsign}`);
}

/* ---- abilities, items, GM cards ---- */
function abilityLimit(c) { return 1; }
// Talent Management: the Unit member in that slot PCSes out and a hand-picked replacement takes the slot:
// one rank higher (SSgt at most), a fresh name, a trait with an upside nobody in the unit has, loyalty 4 and an Ally right away.
function pcsReplace(old) {
  const pool = getRoster().names;
  const commanderName = String(S.cc || '').slice((unitObj()?.ccRank || 'Lt Col').length + 1);
  const used = new Set([...S.npcs.map(n => n.name), commanderName, ...Object.values(S.extras || {}).map(x => x.name), ...(S.pcsNames || [])].map(normalizedRosterName));
  const name = shuffle(pool.filter(n => !used.has(normalizedRosterName(n)) && !rosterNameIsPlayer(n)))[0];
  if (!name) return null;
  const have = S.npcs.map(n => n.trait), fits = t => !have.includes(t) && !(old.slot === 'B' && TRAIT[t].vet);
  const trait = shuffle(PCS_TRAITS.filter(fits))[0] || shuffle(TRAITS.map(t => t.id).filter(fits))[0] || old.trait;
  S.pcsNames = (S.pcsNames || []).concat(old.name); // the old member's name stays out of the roster
  const nu = { slot: old.slot, rank: RANK_UP[old.rank] || old.rank, pub: 'Hand-picked by the Senior Enlisted Leader', enlisted: true, name,
    trait, revealed: true, loy: 4, out: 0, broken: false, handpicked: true };
  S.npcs[S.npcs.indexOf(old)] = nu;
  if (S.traitDone) delete S.traitDone[old.slot];
  log('Talent Management', `${old.rank} ${old.name} PCSed out; ${nu.rank} ${nu.name} arrives`);
  return nu;
}
// Use cadet i's active perk (from a phone request or the console).
function usePerk(i) {
  const p = S.party[i], id = p && p.perk, pk = p && perkOf(p);
  if (!id || !perkWhen(S, p, i)) { alert(`${pk ? pk.name : 'That perk'} can't be used right now.`); return false; }
  const name = cadetName(i), c = S.cur, inj = S.inject;
  let what = '', replacementReveal = null;
  switch (id) {
    case 'rally':
      S.routeRally = { tier: S.pos.tier + 1, candidates: rallyRouteNodes(S).map(([t, n]) => `${t},${n}`), first: null };
      what = 'The First Sergeant can reassign the next route: choose two reachable stops in the next column to swap their encounter types.'; break;
    case 'sevenlvl': applyEff({ mis: 3, why: '7-Level Upgrade' }); what = 'The UTM pushes the flight through 7-level upgrade training: 🎯 +3.'; break;
    case 'pcs': {
      const opts = pcsCandidates(S); if (!opts.length) return false;
      const s = opts.length === 1 ? opts[0].slot : (prompt(`Talent Management: who PCSes out? ${opts.map(n => `${n.slot} = ${n.rank} ${n.name} (loyalty ${n.loy})`).join(', ')}`, opts[0].slot) || '').trim().toUpperCase();
      const old = opts.find(n => n.slot === s); if (!old) return false;
      const nu = pcsReplace(old); if (!nu) return false;
      replacementReveal = { ...nu, previous: `${old.rank} ${old.name}` };
      what = `${old.rank} ${old.name} PCSes out. The SEL hand-picked the replacement: ${nu.rank} ${nu.name} (${TRAIT[nu.trait].icon} ${TRAIT[nu.trait].name}), loyalty ${nu.loy} and already an Ally.`; break;
    }
    case 'ncopull': {
      const ok = S.npcs.filter(n => !n.gone && n.loy < 5);
      const s = ok.length === 1 ? ok[0].slot : (prompt(`Senior NCO Pull: which Unit member gets +3 loyalty? ${ok.map(n => `${n.slot} = ${n.rank} ${n.name} (${n.loy})`).join(', ')}`, ok[0].slot) || '').trim().toUpperCase();
      const n = ok.find(x => x.slot === s); if (!n) return false;
      changeLoy(n.slot, 3); traitCare(); what = `${n.rank} ${n.name} gets the Senior NCO's attention: +3 loyalty (now ${n.loy}).`; break;
    }
    case 'deocs': runDeocs(); S.npcs.forEach(n => changeLoy(n.slot, 1)); traitCare(); what = `The climate survey is in: the exact meter values are on screen for the next ${DIFFICULTY.deocsStops} stops, and every Unit member feels heard (+1 loyalty).`; break;
    case 'resiliency': applyEff({ mor: 3, mis: -1, why: 'Resiliency Day' }); S.npcs.forEach(n => changeLoy(n.slot, 1)); traitCare(); what = 'A day off the line: ❤️ +3 and every Unit member +1 loyalty, but 🎯 −1.'; break;
    case 'readroom': c.intel = true; what = 'The exact effects of every choice on this mission are now on screen.'; break;
    case 'ear': what = `A quiet word with the commander: the last ⭐ loss is cancelled (⭐ +${S.lastTruLoss}).`; applyEff({ tru: S.lastTruLoss, why: "Commander's Ear" }); S.lastTruLoss = 0; break;
    case 'emergency': applyEff({ res: 3, why: 'Emergency Fund' }); what = '+3 📦 right now.'; break;
    case 'mti': { // Prior MTI (UTM): the failed roll counts as a pass. No reroll on screen:
      // only the net change to the meters (failed result → passed result, plus the ⭐ −1) is shown.
      const t = leadTarget(S), flags = { ...S.flags }, before = { ...S.meters }, fx0 = FX.length;
      if (t === 'mission') { const d = c.rollRes.d20, roller = c.rollRes.roller; S = JSON.parse(c.preRoll); S.flags = flags; resolveRoll(roller, { lead: true, d20: d }); }
      else if (t === 'tackle') { const d = inj.tackleD20, lv = inj.leaver; S = JSON.parse(inj.preTackle); S.flags = flags; resolveTackle({ lead: true, d20: d, leaver: lv }); }
      else return false;
      FX = FX.slice(0, fx0).concat(FX.slice(fx0).filter(f => !['deltas', 'roll', 'dice', 'injectResult', 'wheel'].includes(f.k)));
      const d = METERS.map(m => [m.k, S.meters[m.k] - before[m.k]]).filter(x => x[1]);
      if (d.length) emit('deltas', { d });
      if (S.base) S.base.m = { ...before }; // the result card now shows just what Prior MTI changed
      what = `${name} switches to Military Training Instructor mode and takes command. The failed roll now counts as a PASS.`;
      break;
    }
    case 'foresight': inj.foresight = true; what = 'Foresight is ready. This inject d6 roll is guaranteed to select the Wheel of Success.'; break;
  }
  S.flags['perkUsed_' + id] = true;
  S.requests = (S.requests || []).filter(r => !(r.slot === i && r.kind === 'perk:' + id));
  const perkNotice = notice(pk.icon || '🎁', `${name.toUpperCase()}: ${pk.name.toUpperCase()}`, what);
  if (replacementReveal) perkNotice.replacement = replacementReveal;
  sfx('loot'); log('Perk', `${name}: ${pk.name}`);
}
function useAbility(i) {
  const c = S.party[i], ab = c && !c.fired && CLASS[c.cls] && CLASS[c.cls].ability;
  if (!ab || !usableNow(S).some(u => u.who === i && u.req === 'ability')) return false;
  let what = '';
  c.used++;
  S.requests = (S.requests || []).filter(r => !(r.slot === i && r.kind === 'ability'));
  notice(clsIcon(c.cls, 80), `${rankName(c).toUpperCase()}: ${ab.name.toUpperCase()}`, what); sfx('loot');
  log('Ability', `${c.name}: ${ab.name}`);
  return true;
}
// Use team item k. Armed items (check, star) wait for the roll / rating; the rest apply now.
function useItem(k) {
  const id = S.items[k], it = LOOT.find(l => l.id === id); if (!it) return;
  const u = it.use, c = S.cur, inj = S.inject;
  switch (u.type) {
    case 'check': S.pending.check = S.pending.check === id ? null : id; return;
    case 'star': S.pending.star = S.pending.star === id ? null : id; return;
    case 'meter': applyEff({ ...u.eff, why: it.name }); break;
    case 'anyMeter': { const m = (prompt(`${it.name}: +${u.n} to which meter? mis / mor / tru / res`, 'mor') || '').trim(); if (!METER[m]) return; applyEff({ [m]: u.n, why: it.name }); break; }
    case 'loyAll': S.npcs.forEach(n => changeLoy(n.slot, u.d)); break;
    case 'loyOne': { const choices = S.npcs.filter(n => !n.gone && n.loy < 5); if (!choices.length) return alert('No active Unit member can gain loyalty.'); const s = (prompt(`${it.name}: which Unit member? ${choices.map(n => `${n.slot} = ${n.rank} ${n.name} (${n.loy})`).join(', ')}`, choices[0].slot) || '').trim().toUpperCase(); if (!choices.some(n => n.slot === s)) return; changeLoy(s, u.d); break; }
    case 'intel': if (!c || c.step !== 'brief') return alert(`${it.name} works while a mission brief is up.`); c.intel = true; break;
    case 'deocs': runDeocs(); toast('📋', 'DEOCS SURVEY RESULTS', `Exact meter values for the next ${DIFFICULTY.deocsStops} stops`); break;
    case 'branch': if (!branchUseful(S)) return alert(`${it.name} works on the route map before the next destination is locked.`); S.branch = true; toast(it.icon, it.name.toUpperCase(), 'Vote for ANY stop in the next column'); break;
    case 'wheel': {
      if (!inj || inj.stage !== 'trigger') return alert(`${it.name} works before the inject d6 is rolled.`);
      if (inj.foresight) return alert('Foresight already guarantees the Wheel of Success. Save this item.');
      const w = (prompt(`${it.name}: which wheel? M = Wheel of Meh, S = Wheel of Success`, 'S') || '').trim().toUpperCase();
      if (!['M', 'S'].includes(w)) return;
      inj.filter = w === 'S' ? 'good' : 'mixed'; inj.stage = 'murphy'; setActor('murphy', nextActor());
      log('Inject wheel', `${it.name}: picked ${INJECT_WHEELS[inj.filter].name}`); break;
    }
    case 'recharge': {
      const opts = [];
      S.party.forEach((p, i) => {
        if (p.fired) return;
        const ab = CLASS[p.cls] && CLASS[p.cls].ability;
        if (ab && !ab.auto && p.used) opts.push([`${i + 1}A`, `${p.name}'s ${ab.name}`, () => { p.used = 0; }]);
        if (p.perk && S.flags['perkUsed_' + p.perk]) opts.push([`${i + 1}P`, `${p.name}'s perk ${perkOf(p).name}`, () => { delete S.flags['perkUsed_' + p.perk]; }]);
      });
      if (!opts.length) return alert('Nothing to recharge yet.');
      const pick = (prompt(`${it.name}: recharge which? ${opts.map(o => `${o[0]} = ${o[1]}`).join(', ')}`, opts[0][0]) || '').trim().toUpperCase();
      const o = opts.find(x => x[0] === pick); if (!o) return; o[2](); break;
    }
    case 'undo': {
      if (!c || !c.preChoice) return alert(`Use ${it.name} right after a decision (before continuing).`);
      const items = S.items.slice(); items.splice(k, 1);
      S = JSON.parse(c.preChoice); S.items = items;
      S.usedItems = (S.usedItems || []).concat(id);
      toast(it.icon, it.name.toUpperCase(), 'Choose again'); sfx('loot'); log('Item', it.name); return;
    }
    case 'cancel': {
      if (!inj || inj.stage !== 'done' || !inj.preApply) return alert(`Use ${it.name} right after a Wheel of Failure result lands.`);
      const pre = JSON.parse(inj.preApply), items = S.items.filter((x, j) => j !== k), flags = { ...S.flags };
      S = pre; S.items = items; S.flags = flags; S.actor = null; S.inject.stage = 'done'; S.inject.note = `Cancelled by the ${it.name}.`; S.inject.cancelled = true;
      S.usedItems = (S.usedItems || []).concat(id);
      toast(it.icon, it.name.toUpperCase(), 'Inject cancelled'); log('Item', `${it.name} cancelled the inject`); return;
    }
    default: return;
  }
  S.items.splice(k, 1); S.usedItems = (S.usedItems || []).concat(id);
  toast(it.icon, 'ITEM USED', it.name); sfx('loot'); log('Item', it.name);
}
function playCard(id) {
  const used = () => { S.gmUsed.push(id); log('GM card', GM_CARDS.find(c => c.id === id).name); };
  switch (id) {
    case 'curveball': S.inject = { stage: 'trigger', forced: true }; setActor('trigger', nextActor()); break;
    case 'loaded': { const v = parseInt(prompt('Loaded Dice: +3 (harder) or -3 (easier)?', '3'), 10); if (![3, -3].includes(v)) return; S.dcMod = v; break; }
    case 'clock': S.timer = { end: Date.now() + 15000, label: 'SHOT CLOCK' }; break;
    case 'complaint': { const s = (prompt('Open Door Complaint: which Unit member loses 2 loyalty? A/B/C/D', 'A') || '').trim().toUpperCase(); if (!npc(s)) return; changeLoy(s, -2); emit('big', { cls: 'bad', title: 'OPEN DOOR COMPLAINT', icon: '📨', text: `${npcLabel(S, s)} went to the commander about you. Loyalty −2.` }); break; }
    case 'gift': spinLoot(); break;
    case 'silent': S.banner = { text: `🤐 SILENT RUNNING: ${cadetName(S.tokenHolder).toUpperCase()} CAN'T SPEAK FOR THIS CHOICE`, cls: 'gold' }; break;
    case 'twist': {
      if (!S.cur || S.cur.step !== 'brief' || S.cur.type === 'crisisEvent') return alert('Play Plot Twist while a mission brief is up.');
      const m = curMission(); const v = (prompt('Swap the effects of which two choices? e.g. AC (integrity traps cannot be swapped)', 'AB') || '').toUpperCase();
      const a = 'ABCD'.indexOf(v[0]), b = 'ABCD'.indexOf(v[1]);
      if (a < 0 || b < 0 || a === b || !m.choices[a] || !m.choices[b] || m.choices[a].trap || m.choices[b].trap) return alert('Pick two different, non-trap choices.');
      S.cur.swap = [a, b]; break;
    }
    case 'second': {
      hist.pop(); // the snapshot taken for this very click
      if (!hist.length) return alert('Nothing to undo yet.');
      const keepUsed = S.gmUsed.concat(id); S = JSON.parse(hist.pop()); S.gmUsed = keepUsed; log('GM card', 'Second Chance'); return;
    }
  }
  used(); sfx('click');
}

/* =====================================================================
   GM UI
   ===================================================================== */
const ACT = {};
function act(name, fn) { ACT[name] = fn; }
function run(name, arg, el) {
  const fn = ACT[name]; if (!fn) return;
  if (S.gmNext && name !== 'gmNext' && name !== 'undo' && !(IS_BOSS_PRACTICE && name === 'newRun')) return;
  if (S.phase === 'itemAward' && !['gmNext', 'itemAwardOk', 'openPlayer', 'mute', 'board', 'undo', 'newRun'].includes(name)) return;
  snap();
  const r = fn(arg, el);
  if (r === false) { hist.pop(); renderGM(); return; }
  push();
}

// Progression is identified by action, so changing a button's wording cannot move it down the page.
const GM_PROGRESS_ACTIONS = new Set([
  'gmNext', 'noticeOk', 'newRun', 'startBriefing', 'beginBriefing', 'introNext', 'avDone',
  'toParty', 'lockParty', 'lockPerks', 'showKit', 'kitDone', 'toPatch', 'showItems', 'showManifest', 'toMap', 'itemAwardOk',
  'spinMystery', 'mysteryGo', 'resolveRoll', 'fumble', 'loot', 'nodeDone',
  'spinTrigger', 'spinMurphy', 'closeInject', 'confirmLevel',
  'bossVouchNext', 'bossNext', 'hotSeat', 'bossStarsDone', 'bossResolve', 'finish', 'toDebrief',
]);
const B = (act, label, o = {}) => `<button class="b ${o.cls || ''}" data-act="${act}" ${o.progress || GM_PROGRESS_ACTIONS.has(act) ? 'data-progress="true"' : ''} ${o.arg != null ? `data-arg="${esc(o.arg)}"` : ''} ${o.dis ? 'disabled' : ''} title="${esc(o.title || '')}">${label}</button>`;

function mountGMProgress(main, progress) {
  const buttons = [...main.querySelectorAll('button[data-progress]')];
  const active = buttons.find(b => b.dataset.act === 'gmNext') || buttons.find(b => b.dataset.act === 'noticeOk') || buttons[0];
  const scene = main.querySelector('[data-progress-panel]');
  if (scene && (!active || scene.contains(active))) {
    // Keep the selection controls and their roll/rating action together.
    buttons.filter(button => !scene.contains(button)).forEach(button => button.remove());
    progress.classList.add('gmprogress-scene'); progress.append(scene); return;
  }
  if (scene && active) scene.remove(); // dismiss a held result before showing execution controls
  if (!active) { progress.hidden = true; return; }
  const label = document.createElement('span');
  label.className = 'gmprogress-label';
  label.textContent = 'PROGRESS';
  buttons.filter(button => button !== active).forEach(button => button.remove());
  // Move the actual button: retain its action, argument, and disabled state.
  progress.append(label, active);
}

function renderGM() {
  if (IS_PLAYER || !S) return;
  const app = $('#app');
  const focusId = document.activeElement && document.activeElement.id;
  const u = S.unit ? UNITS.find(x => x.id === S.unit) : null;
  app.innerHTML = `
  <div class="gmw">
    <div class="gmtop">
      <h1>🕹️ PRACTICUM ADVENTURE · GM</h1>
      <span class="ph">PHASE: ${esc(S.phase.toUpperCase())}${u ? ' · ' + esc(u.name) : ''}${S.nodeCount ? ' · NODE ' + S.nodeCount : ''}</span>
      ${B('openPlayer', playerWin && !playerWin.closed ? '🖥️ Player screen open' : '🖥️ Open player screen', { cls: playerWin && !playerWin.closed ? '' : 'pri' })}
      ${B('mute', S.muted ? '🔇 Sound off' : '🔊 Sound on')}
      ${B('board', S.showBoard ? '🏆 Hide leaderboard' : '🏆 Show leaderboard', { cls: S.showBoard ? 'on' : '' })}
      ${B('undo', '↩️ Undo', { dis: !hist.length })}
      ${IS_BOSS_PRACTICE ? '' : B('newRun', '🆕 New run', { cls: 'red' })}
    </div>
    ${IS_BOSS_PRACTICE ? gmBossPracticeControls() : ''}
    <div id="gmProgress" class="gmprogress" aria-label="Game progression"></div>
    <div id="gmMain">${S.gmNext ? `<div class="gcard" style="border-color:var(--gold)"><div class="row"><b style="flex:1">${S.gmNext.after === 'bossResponse' ? 'Resolving team action · the IG responds automatically if it survives.' : '🎲 Result is on the projector. Click Next to dismiss it and continue.'}</b>${B('gmNext', '➡️ Next', { cls: 'pri', dis: !S.gmNext.ready })}</div></div>` : ''}${S.notice ? `<div class="gcard" style="border-color:var(--gold)"><div class="row"><b style="flex:1">${S.notice.icon} Popup on the projector and phones: ${esc(S.notice.title)}${(S.noticeQ || []).length ? ` <span class="pill">+${S.noticeQ.length} more</span>` : ''}</b>${B('noticeOk', '✅ Continue', { cls: 'pri sm' })}</div><div class="note">${esc(S.notice.text)}</div></div>` : ''}${S.phase === 'boss' ? '' : gmActorCard()}${voteTie(S) ? `<div class="note" style="margin:0 0 6px">${esc(tieText(S))}</div>` : ''}${gmMain()}</div>
    <div id="gmSide">${typeof gmPhonesCard === 'function' ? gmPhonesCard() : ''}${['title', 'join', 'welcome', 'intro', 'party', 'perks', 'kit', 'avatars', 'roster'].includes(S.phase) ? gmSideLite() : gmSide()}</div>
  </div>`;
  // Keep exactly one actionable progression control at the top of the GM view.
  // In particular, a queued projector result must be dismissed before the underlying
  // node action is available; showing both actions made the latter look like a dead button.
  mountGMProgress(document.getElementById('gmMain'), document.getElementById('gmProgress'));
  if (focusId && document.getElementById(focusId)) { const el = document.getElementById(focusId); el.focus(); if (el.setSelectionRange && el.type === 'text') { const l = el.value.length; el.setSelectionRange(l, l); } }
}

// "Cadet X is up to roll" banner, with a button to press it for them
function gmActorCard() {
  if (!S.actor) return '';
  return `<div class="gcard" style="border-color:var(--gold)"><div class="row"><b style="flex:1">🎲 Waiting on <span style="color:var(--gold)">${esc(cadetName(S.actor.slot))}</span> to ${esc(S.actor.label.toLowerCase())} on their phone</b>
    ${spinning() ? '<span class="note">rolling…</span>' : B('actorGo', 'Press it for them', { cls: 'sm' })}</div></div>`;
}
const voteTag = key => { const w = votersFor(key), n = w.length; return n ? ` <span class="pill y">✋ ${n}${w.some(s => s === crownIdx(S)) ? ' 👑' : ''}</span>` : ''; };

function gmMain() {
  if (S.inject && S.inject.forced) return gmInject();
  switch (S.phase) {
    case 'title': return gmTitle();
    case 'party': return gmParty();
    case 'perks': return gmPerks();
    case 'kit': return gmKit();
    case 'unit': return `<div class="gcard"><h2>Pick the squadron</h2><p class="note">The team votes on their phones (✋; the 👑 breaks ties). Click the winner: it draws the Unit members (excluding anyone in this party) and deals traits. Squadron order is randomized each run.</p>
      ${S.unitRolled ? `<div class="warnline" style="margin:12px 0"><b>SQUADRON PENALTY</b> · ${esc(squadPenaltyText(S.unit, S))}</div>${B('toPatch', '🎖️ Next: pick the team patch', { cls: 'pri' })}` : `${S.fssDeployedName ? `<div class="note">If 55th FSS is selected, ${esc(S.fssDeployedRank)} ${esc(S.fssDeployedName)} is already identified as the deployed member.</div>` : ''}<div class="row">${unitPickOrder(S).map(u => B('pickUnit', `${u.icon} ${u.name}${voteTag(u.id)}`, { arg: u.id, cls: 'go' })).join('')}</div>`}</div>`;
    case 'join': return gmJoin();
    case 'welcome': return `<div class="gcard"><h2>Practicum Adventure</h2><p>Click CLICK TO START on the projector to enable sound and begin the briefing.</p>${B('beginBriefing', 'Next: start the briefing ➡️', { cls: 'pri' })}</div>`;
    case 'intro': return gmIntro();
    case 'avatars': return gmAvatars();
    case 'roster': return gmRoster();
    case 'patch': return gmPatch();
    case 'itemsBriefing': return `<div class="gcard"><h2>📋 DEOCS Survey</h2><p>The team received a DEOCS Survey item. It reveals exact meter values for ${DIFFICULTY.deocsStops} stops.</p><p class="note">${esc(INTRO_ITEMS)}</p>${B('showKit', 'Next: check your kit ➡️', { cls: 'pri' })}</div>`;
    case 'itemAward': {
      const award = S.itemAward, item = LOOT.find(l => l.id === award?.id), dropped = LOOT.find(l => l.id === award?.dropped);
      return `<div class="gcard"><h2>${item?.icon || '🎒'} ${esc(item?.name || 'Team item')}</h2><p>Added to the team’s items (${award?.count || S.items.length}/3).</p><p>${mt(esc(fill(S, item?.text || '')))}</p>${dropped ? `<p class="warnline">Bag full: dropped ${dropped.icon} ${esc(dropped.name)}.</p>` : ''}${B('itemAwardOk', 'Next: return to the game ➡️', { cls: 'pri' })}</div>`;
    }
    case 'manifest': return gmManifest();
    case 'map': return gmMap();
    case 'node': return gmNode();
    case 'inject': return gmInject();
    case 'levelup': return gmLevel();
    case 'boss': return gmBoss();
    case 'results': return gmResults();
    case 'debrief': return gmDebrief();
  }
  return '';
}

function gmTitle() {
  let saved = null; try { saved = JSON.parse(localStorage.getItem(RUN_STORAGE_KEY) || 'null'); } catch (e) { }
  const b = sortBoard(loadBoard());
  const shared = typeof cloudOn === 'function' && cloudOn(); // shared leaderboard: clearing it here would just re-download it
  const rosterCard = `<div class="gcard"><h3>Game name rosters</h3><p class="note">After customizing their characters, the team votes for one roster. Player names are excluded from NPC assignments.</p>${ROSTER_OPTIONS.map(r => `<div class="row">${rosterPin(r,28)}<b>${esc(r.name)}</b><span class="note">${r.names.length} unique surnames</span></div>`).join('')}</div>`;
  return `<div class="gcard"><h2>Welcome, Game Master</h2>
    <p>1. Click <b>Open player screen</b> and drag that window onto the projector (press F11 there for full screen). The full-screen QR appears first; CLICK TO START on the next screen enables sound.<br>
    2. Start a new run for each party. The console autosaves, so a closed tab can be resumed.</p>
    ${stopsPicker()}
    <div class="row">${B('newRun', '▶️ Start a new run', { cls: 'pri' })}<a class="b" href="bench.html?practice=boss" target="practicumPracticeBench">🧪 Boss Practice</a>
    ${saved && saved.phase && saved.phase !== 'title' ? B('resume', `⏯️ Resume saved run (${esc(saved.phase)}${saved.callsign ? ', ' + esc(saved.callsign) : ''})`) : ''}</div></div>
    ${typeof teamReportsCard === 'function' ? teamReportsCard() : ''}
    <div class="gcard"><h3>Leaderboard (${b.length} runs)</h3>${boardTable(b)}
    <div class="row">${B('exportBoard', '💾 Export leaderboard + grades (JSON)')} <label class="b">📂 Import JSON<input type="file" id="importFile" accept=".json" class="hide"></label>
    ${B('exportCSV', '📊 Export grades CSV')} ${shared ? '' : B('clearBoard', '🗑️ Clear leaderboard', { cls: 'red' })}</div>
    <p class="note">${typeof cloudStatus === 'function' ? cloudStatus() + '<br>' : ''}Top 3 non-Game-Over runs earn extra credit. ${shared ? 'Grades stay in this browser only: export them after each practicum day. To delete a leaderboard entry, use the Firebase console.' : 'Data lives in this browser; export a backup after each practicum day.'}</p></div>${rosterCard}`;
}
function boardTable(b) {
  if (!b.length) return '<p class="note">No runs yet.</p>';
  let rank = 0;
  return `<table class="g"><tr><th>#</th><th>Team</th><th>Unit</th><th>Grade</th><th>Score</th><th>Cadets</th></tr>${b.map(r => `<tr><td>${r.gameOver ? '💀' : ++rank}</td><td>${esc(r.callsign)}</td><td>${esc(r.unit)}</td><td>${esc(r.grade)}</td><td>${r.score}</td><td class="note">${esc(r.cadets)}</td></tr>`).join('')}</table>`;
}

function gmParty() {
  const taken = S.party.map(c => c.cls);
  return `<div class="gcard"><h2>Character select</h2>
  <p class="note">Cadets pick their positions (by phone or out loud). A Flight Commander who selects the passive Command Token perk decides every tied vote; otherwise, the GM decides. There are no duplicate positions. Leave row 4 blank for a 3-person party. Perks stay hidden until the positions are locked.</p>
  ${S.party.map((c, i) => `<div class="gchoice"><div class="row">
    <b>P${i + 1}</b>${c.av != null ? `<img src="${avatarOf(c)}" style="width:28px;height:28px;image-rendering:pixelated">` : ''}<input type="text" id="pname${i}" placeholder="Cadet name (or they join by phone)" value="${esc(c.name)}" data-inp="pname" data-arg="${i}">
    ${Object.values(S.clients || {}).some(k => k.slot === i) ? '<span class="pill y">📱 phone</span>' : ''}
    ${c.name ? B('kick', '✖', { arg: i, cls: 'sm', title: 'Remove this cadet (and their phone)' }) : ''}
    <select data-inp="pcls" data-arg="${i}"><option value="">- position -</option>${positionPickOrder(S).map(k => `<option value="${k.id}" ${c.cls === k.id ? 'selected' : ''} ${c.cls !== k.id && taken.includes(k.id) ? 'disabled' : ''}>${k.rank} · ${k.name}</option>`).join('')}</select>
    </div></div>`).join('')}
  <div class="warnline" id="partyWarn">${esc(S.partyWarn || '')}</div>
  <div class="row">${B('lockParty', '🔒 Lock in the positions → reveal perks', { cls: 'pri' })}</div></div>`;
}
function gmPerks() {
  return `<div class="gcard"><h2>🎁 Perk selection</h2>
  <p class="note">The projector now reveals each cadet's two perks. They pick one (by phone or out loud).</p>
  ${S.party.map((c, i) => `<div class="gchoice"><b>${clsIcon(c.cls, 18)} ${esc(rankName(c))}</b> <span class="note">${CLASS[c.cls].name}</span>
    <div class="row">${CLASS[c.cls].perks.map(p => `<label class="b ${c.perk === p.id ? 'on' : ''}"><input type="radio" class="hide" name="perk${i}" data-inp="pperk" data-arg="${i}" value="${p.id}" ${c.perk === p.id ? 'checked' : ''}>${p.icon} ${esc(p.name)}: <span class="note">${esc(p.text)}</span></label>`).join('')}</div></div>`).join('')}
  <div class="warnline">${esc(S.partyWarn || '')}</div>
  <div class="row">${B('backToClasses', '⬅️ Back to positions')} ${B('lockPerks', '✅ Lock perks → choose the squadron', { cls: 'pri', dis: S.party.some(c => !c.perk) })}</div></div>`;
}

// Kit check: every cadet opens the 🎒 KIT tab on their phone (class, stats, ability, perk), then comes back to 🎮 GAME
function gmKit() {
  const done = S.party.filter(c => c.kitOk).length;
  return `<div class="gcard"><h2>🎒 Check your kit</h2>
  <p class="note">Every cadet opens the 🎒 KIT tab on their phone to review their position, stats, ability, perk and team items, including the DEOCS Survey. Then tap 🎮 GAME to come back (it marks them ✅ here). Cadets without a phone: read their kit to them from the projector.</p>
  ${S.party.map(c => `<div class="row">${c.kitOk ? '✅' : '⏳'} ${clsIcon(c.cls, 18)} <b>${esc(rankName(c))}</b> <span class="note">${esc(CLASS[c.cls].name)} · ${perkOf(c).icon} ${esc(perkOf(c).name)}</span></div>`).join('')}
  <div class="row">${B('kitDone', `${done === S.party.length ? '✅' : '➡️'} Next: org chart (${done}/${S.party.length} checked)`, { cls: 'pri' })}</div></div>`;
}
act('showKit', () => { if (S.phase !== 'itemsBriefing') return false; S.phase = 'kit'; S.party.forEach(c => { c.kitOk = false; }); S.votes = {}; sfx('start'); });
act('kitDone', () => { if (S.phase !== 'kit') return false; ACT.showManifest(); });
// Route length picker (title screen and briefing): fewer stops for a short class period
function stopsPicker() {
  const n = routeStops();
  return `<div class="row"><b>🗺️ Route length:</b> ${[7, 6, 5].map(k => B('setStops', `${k} stops${k === 7 ? ' (long)' : ''}`, { arg: k, cls: n === k ? 'on sm' : 'sm' })).join(' ')}
    <span class="note">Fewer stops = a shorter game. Set it before the route map opens.</span></div>`;
}
// GM-only route preview during setup: length, a small drawing of this run's route, and a reroll button
function routeCard() {
  if (S.mapLocked || S.phase === 'title' || !S.map) return '';
  return `<div class="gcard"><h3>🗺️ Route preview (only you see this)</h3>${stopsPicker()}${miniMap(S.map)}
    <div class="row">${B('rerollMap', '🎲 Reroll route', { cls: 'sm' })} <span class="note">${S.map.tiers.map(t => t.length).join('-')} options per stop · level up after stop ${S.map.levelAfter || 3}. ❓ and 🔦 are decided on arrival.</span></div></div>`;
}
function miniMap(m) {
  const n = m.tiers.length, W = 560, H = 190, x0 = 22, x1 = W - 26, gap = 58, step = (x1 - x0) / (n + 1);
  const pt = (k, i) => k < 0 ? [x0, H / 2] : k >= n ? [x1, H / 2] : [x0 + step * (k + 1), H / 2 + (i - (m.tiers[k].length - 1) / 2) * gap];
  let g = '';
  const ln = (a, b) => { g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#5a5aa8" stroke-width="2" stroke-dasharray="5 4"/>`; };
  m.tiers[0].forEach((_, i) => ln(pt(-1), pt(0, i)));
  m.tiers.forEach((row, k) => row.forEach((_, i) => (k < n - 1 ? m.links[k][i] : [null]).forEach(j => ln(pt(k, i), j == null ? pt(n) : pt(k + 1, j)))));
  // checkpoints between stops: 🎡 inject, then ⬆️ level up
  m.tiers.forEach((_, k) => {
    const cs = [injectAfter(k) && ['🎡', '#ff9f43'], k === (m.levelAfter || 3) - 1 && ['⬆️', '#7dff6b']].filter(Boolean);
    cs.forEach(([ic, col], ci) => { const x = pt(k, 0)[0] + (pt(k + 1, 0)[0] - pt(k, 0)[0]) * (ci + 1) / (cs.length + 1);
      g += `<line x1="${x}" y1="24" x2="${x}" y2="${H - 6}" stroke="${col}" stroke-width="1.5" stroke-dasharray="3 4" opacity=".7"/><text x="${x}" y="18" font-size="13" text-anchor="middle">${ic}</text>`; }); });
  m.tiers.forEach((row, k) => row.forEach((nd, i) => { const [x, y] = pt(k, i), nt = NODE_TYPES[nd.type];
    g += `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" fill="#1b1b4a" stroke="${nt.color}" stroke-width="2"/><text x="${x}" y="${y + 6}" font-size="16" text-anchor="middle">${nt.icon}</text>${['elite', 'spot'].includes(nd.type) ? `<text x="${x + 13}" y="${y + 17}" font-size="11" text-anchor="middle" aria-label="Loot reward opportunity">🎁</text>` : ''}`; }));
  g += `<text x="${x0}" y="${H / 2 + 6}" font-size="20" text-anchor="middle">${patchOf(S)?.icon || '🎖️'}</text><image href="${inspectorPortrait()}" x="${x1 - 15}" y="${H / 2 - 15}" width="30" height="30" style="image-rendering:pixelated"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:560px;background:#0b0b1e;border:1px solid #333;margin:6px 0">${g}</svg>`;
}
// Join screen: the projector is one big QR code so every cadet can scan it before the briefing starts
function gmJoin() {
  const n = Object.keys(S.clients || {}).length;
  return `<div class="gcard"><h2>📱 Join screen</h2>
    <p class="note">The projector shows the join QR code full screen. Wait until every cadet has scanned it and joined, then continue to the Practicum Adventure title screen. CLICK TO START begins the briefing. Cadets can still join later (until positions are picked); the QR stays in the corner.</p>
    <p><b>${n}</b> phone${n === 1 ? '' : 's'} joined${n ? `: ${Object.values(S.clients).map(c => esc(c.name)).join(', ')}` : ''}</p>
    <div class="row">${B('startBriefing', 'Next: Practicum Adventure ➡️', { cls: 'pri' })}</div></div>`;
}
act('startBriefing', () => { S.phase = 'welcome'; sfx('click'); });
act('beginBriefing', () => { if (S.phase !== 'welcome') return false; S.phase = 'intro'; S.introPage = 0; sfx('start'); });
function gmIntro() {
  const pg = S.introPage;
  const txt = ['The projector shows Tested Samples of Behavior: Leadership (Week 1 Day 2), Motivation (Week 2 Day 1), Creative Thinking (Week 3 Day 1), Public Speaking (Week 4 Day 1), and Clear Expectations (Week 7 Day 1). The debrief connects these samples to events from the run.',
    'The projector introduces the three Air Force Core Values as your jobs: Integrity First, Service Before Self, and Excellence In All We Do. The next three slides explain each job.',
    'JOB 1: Integrity First. One integrity violation (lie, cover up, fudge a record, skip the paperwork) = GAME OVER. Pause here and let it land.',
    'JOB 2: Service Before Self. Loyalty runs from 0–5. At 0: Breaking Point. At 5: Ally support against the Inspector General. The example member has 3/5 loyalty.',
    'JOB 3: Excellence In All We Do. Meters run from 0 to 10. ' + INTRO_METER_SCALE + '. Exact values are usually hidden until a DEOCS Survey.'][pg];
  return `<div class="gcard"><h2>Game briefing (${pg + 1}/${INTRO_PAGE_COUNT})</h2>
    <p class="note">${txt}</p>
    <div class="row">${B('introPrev', '⬅️ Back', { dis: pg === 0 })} ${pg < INTRO_PAGE_COUNT - 1 ? B('introNext', ['Next: pick character icons ➡️', 'Next: Job 1 (integrity) ➡️', 'Next: Job 2 (loyalty) ➡️', 'Next: Job 3 (meters) ➡️'][pg], { cls: 'pri' }) : B('toParty', '▶️ Go to position select', { cls: 'pri' })}</div></div>`;
}
function gmAvatars() {
  const taken = S.party.map(p => p.av);
  const named = S.party.filter(p => p.name.trim());
  return `<div class="gcard"><h2>Pick your character icon</h2><p class="note">Phones join and pick here (this is the first pick, before positions). The icon also sets the cadet's gender (10 male, 10 female). For anyone without a phone, type their name and click an icon. Leave a row blank for a 3-person party.</p>
    ${S.party.map((p, i) => `<div class="gchoice"><div class="row"><b>P${i + 1}</b><input type="text" id="pname${i}" placeholder="Cadet name (or they join by phone)" value="${esc(p.name)}" data-inp="pname" data-arg="${i}">
      ${Object.values(S.clients || {}).some(k => k.slot === i) ? '<span class="pill y">📱 phone</span>' : ''} ${p.name ? B('kick', '✖', { arg: i, cls: 'sm', title: 'Remove this cadet (and their phone)' }) : ''}
      ${p.av != null ? `<img src="${avatarOf(p)}" style="width:28px;height:28px;image-rendering:pixelated">
        <select data-inp="puni" data-arg="${i}">${UNIFORMS.map(u => `<option value="${u.id}" ${(p.uni || '') === u.id ? 'selected' : ''}>👕 ${u.name}</option>`).join('')}</select>
        <select data-inp="phair" data-arg="${i}">${HAIR_COLORS.map(h => `<option value="${h.id}" ${(p.hair || '') === h.id ? 'selected' : ''}>💇 ${h.name}</option>`).join('')}</select>` : ''}</div>
      ${AV_GROUPS.map(G => `<div class="row"><span class="note" style="width:80px">${G.label}</span>${G.idx.map(k => `<button class="b sm ${p.av === k ? 'on' : ''}" data-act="setAv" data-arg="${i},${k}" ${p.av !== k && taken.includes(k) ? 'disabled' : ''} title="#${avNum(k)}"><img src="${presetAvatar(k)}" style="width:28px;height:28px;image-rendering:pixelated;display:block"></button>`).join('')}</div>`).join('')}</div>`).join('')}
    ${B('avDone', S.introPage === INTRO_PAGE_COUNT - 1 ? '✅ Done: go to position select' : 'Next: your three jobs ➡️', { cls: 'pri', dis: named.length < 2 || named.some(p => p.av == null) })}</div>`;
}

function gmManifest() {
  const u = UNITS.find(x => x.id === S.unit);
  return `<div class="gcard"><h2>${u.icon} ${u.name}: ${u.sq}</h2>
  <p><b>Sq CC:</b> ${esc(S.cc)} · <b>Intent:</b> ${METER[u.cc.intent].icon} ${METER[u.cc.intent].label} (7+ at the end = +${DIFFICULTY.intent}, under 4 = −${DIFFICULTY.intent})<br>
  👍 <b>${esc(u.cc.pos.name)}</b>: ${esc(u.cc.pos.text)}<br><span style="${confidantIdx(S) >= 0 ? 'opacity:.45;text-decoration:line-through' : ''}">👎 <b>${esc(u.cc.neg.name)}</b>: ${esc(u.cc.neg.text)}</span>${confidantIdx(S) >= 0 ? ' <span class="note">(cancelled by the XO)</span>' : ''}<br>
  <b>Squadron penalty:</b> ${esc(squadPenaltyText(S.unit))}</p>
  <table class="g"><tr><th>Slot</th><th>Unit member</th><th>Role</th><th>Trait (visible to everyone)</th></tr>
  ${S.npcs.map(n => { const t = TRAIT[n.trait]; return `<tr><td>${n.slot}</td><td>${insignia(n.rank, 18)}${esc(n.rank + ' ' + n.name)}</td><td class="note">${esc(n.pub)}</td><td>${t.icon} <b>${t.name}</b>: ${esc(t.what)}<br><span class="note">Reward: ${esc(t.reward)} · Breaking point: ${esc(t.bpText)}</span></td></tr>`; }).join('')}</table>
  <p class="note">${esc(TEAM_SCOPE)}</p>
  <p class="note">The projector shows the org chart. Give the party ~45 seconds to read it, then roll the route. The map seed will be revealed as the route cycles.</p>
  <p><b>Team patch:</b> ${S.patch ? `${(patchOf(S) || {}).icon} ${esc(S.callsign)}` : 'none'}</p>
  ${B('toMap', S.manifestRollPending ? 'Revealing after popup…' : Date.now() < (S.manifestRollUntil || 0) ? '🎲 Revealing your unit…' : '🎲 Roll map generation', { cls: 'pri', dis: !!S.manifestRollPending || Date.now() < (S.manifestRollUntil || 0) })}</div>`;
}
// Team patch = team name: its own screen between the squadron reveal and the org chart
function gmPatch() {
  return `<div class="gcard"><h2>🎖️ Team patch</h2>
  <p class="note">The patch is the team's name on the leaderboard. Choosing one also gives the team a 📋 DEOCS Survey item. The team votes on their phones (✋; the 👑 breaks ties). Click the winner to lock it in. Patches already on the leaderboard are taken. If nobody locks one in, the top vote (or the first free patch) is used.</p>
  <div class="row">${S.patch ? `<span class="pill y">${(patchOf(S) || {}).icon} ${esc(S.callsign)} locked in</span> ${B('unsetPatch', 'Change (reopen the vote)', { cls: 'sm' })}`
    : (PATCHES[S.unit] || []).map(p => B('setPatch', `${p.icon} ${esc(p.name)}${patchFree(S, p.id) ? voteTag(p.id) : ' (taken)'}`, { arg: p.id, cls: 'go sm', dis: !patchFree(S, p.id) })).join(' ')}</div>
  <div class="row">${B('showItems', 'Next: DEOCS Survey ➡️', { cls: 'pri' })}</div></div>`;
}

function gmMap() {
  const av = available();
  return `<div class="gcard"><h2>Route map: next stop</h2>
  <p class="note">${S.routeRally ? `🙌 ROUTE REASSIGNMENT: ${S.routeRally.first ? 'Choose a second stop to swap encounter types.' : 'Choose two reachable stops in the next column to swap encounter types.'}` : `${S.map.tiers.length} stops, then the IG. Paths branch and merge; the party can only move along the lines. The party votes on their phones (✋); click the winner. Level up after stop ${levelAfter()}. ❓ and 🔦 are rolled when the party arrives.${S.branch ? ' <b>🌿 Branch Plan active: any stop in the next column.</b>' : ''}`}</p>
  ${S.map.tiers.map((tier, t) => `<div class="row"><b style="width:60px">Stop ${t + 1}</b>${tier.map((nd, i) => {
    const open = av.some(([a, b]) => a === t && b === i);
    const nt = NODE_TYPES[nd.type];
    const key = `${t},${i}`, firstKey = S.routeRally && S.routeRally.first, firstNode = firstKey ? S.map.tiers[+firstKey.split(',')[0]][+firstKey.split(',')[1]] : null;
    const pick = S.routeRally && S.routeRally.tier === t && S.routeRally.candidates.includes(key) && (!firstNode || firstKey === key || nd.type !== firstNode.type);
    if (pick) return B('rallySwapNode', `${nt.icon} ${nt.name}${S.routeRally.first === key ? ' · FIRST PICK' : ' · SELECT'}`, { arg: key, cls: S.routeRally.first === key ? 'on' : 'go sm' });
    return B('node', `${nt.icon} ${nt.name}${['elite', 'spot'].includes(nd.type) ? ' 🎁' : ''}${nd.visited ? ' ✔' : ''}${open ? voteTag(key) : ''}`, { arg: key, dis: !open || !!S.routeRally, cls: open ? 'go' : nd.visited ? 'on' : '' });
  }).join('')}</div>`).join('')}
  ${wpOptions().length ? `<div class="row"><b>${CHECKPOINT[wpOptions()[0].kind].icon} Checkpoint first:</b> ${wpOptions().map(o => B('waypoint', `${CHECKPOINT[o.kind].icon} ${CHECKPOINT[o.kind].short} → ${o.then.icon} ${o.then.name}${voteTag(o.key)}`, { arg: o.key, cls: 'go', dis: !!S.routeRally })).join('')}<span class="note">Picking a waypoint runs it and locks in the path to that next stop.</span></div>` : ''}
  <div class="row"><b style="width:60px">Boss</b>${S.bossReady ? `${B('bossStart', `${igIcon()} ${BOSS.name} · begin inspection${voteTag('boss')}`, { cls: 'go', dis: !!S.routeRally })}<span class="note">The team votes on phones; click to enter when ready.</span>` : `<span class="pill">${igIcon()} ${BOSS.name}</span>`}</div>
  ${S.pos.tier >= 0 && S.pos.tier < lastTier() ? `<div class="row">${B('collapse', `⏩ Running late: skip the remaining ${lastTier() - S.pos.tier} stop(s), go to the boss`, { dis: !!S.routeRally })}</div>` : ''}</div>`;
}

function gmChoiceList(m, c) {
  const votes = S.votes || {};
  const actOutEncounter = isActOutEncounter(S, m);
  return m.choices.map((ch, i) => {
    const picked = c.choice === i;
    const voters = Object.keys(votes).filter(s => votes[s] === i).map(s => cadetName(+s));
    const sw = c.swap && c.swap.includes(i) ? ' <span class="pill y">PLOT TWIST swapped</span>' : '';
    return `<div class="gchoice" style="${picked ? 'border-color:var(--gold)' : ''}"><div class="h">
      <b>${'ABCD'[i]}</b><span class="t">${esc(fill(S, ch.t))} ${actOutEncounter ? '🎤' : (c.type === 'elite' || ch.kind === 'check' || ch.check) ? '🎲' : ''} ${ch.trap ? '<span class="trap">💀 TRAP</span>' : ''}${sw}</span>
      <span>${arrows(choiceShow(ch))}</span>
      ${voters.length ? `<span class="pill y" title="${esc(voters.join(', '))}">📱 ${voters.length} vote${voters.length > 1 ? 's' : ''}</span>` : ''}
      ${c.step === 'brief' ? B('choose', 'Choose', { arg: i, cls: 'go' }) : ''}</div>
      <div class="eff">${esc(specText(S, ch))}</div>${ch.note ? `<div class="note">${esc(fill(S, ch.note))}</div>` : ''}</div>`;
  }).join('');
}

function gmNode() {
  const c = S.cur;
  if (isFreeLoot(c)) return `<div class="gcard"><h2>🎁 Free Loot</h2>${gmDonePanel()}</div>`;
  if (c.type === 'rest' || c.type === 'depot') {
    const rest = c.type === 'rest';
    let body;
    if (c.step === 'choose') body = `<div class="row">${(rest ? restOptions() : depotOptions()).map(o => B(rest ? 'restPick' : 'depotPick', o.label + voteTag(o.key), { arg: o.key, dis: o.dis, cls: o.key === 'offbooks' ? 'red' : '' })).join('')}</div>
      ${!rest ? '<p class="note">The GPC card option is an integrity trap: the IG finds it in the Audit (Game Over). Don\'t warn them.</p>' : ''}`;
    else if (c.step === 'who') body = `<p>${c.trade === 'favor' ? 'A Unit member grabs you something (−2 loyalty, loot spin)' : 'Volunteer for the BX Saturday detail (−1 loyalty, +3 🎯)'}: the team picks who pays (they vote on phones).</p>
      <div class="row">${stopOptions().map(o => B('depotWho', o.label + voteTag(o.key), { arg: o.key.slice(4), dis: o.dis })).join('')} ${B('depotBack', '⬅️ Back', { cls: 'sm' })}</div>`;
    else if (c.step === 'train') body = `<p>Study guides (−2 📦): pick an active cadet and the stat they train.</p>
      ${S.party.map((p, i) => `<div class="row"><b style="width:140px">${esc(cadetName(i))}${p.fired ? ' (inactive)' : ''}</b>${STATS.map(st => B('depotTrain', `${st} ${sign(statOf(i, st))} → ${sign(statOf(i, st) + 1)}`, { arg: `${i},${st}`, cls: 'sm', dis: p.fired })).join('')}</div>`).join('')}
      ${B('depotBack', '⬅️ Back', { cls: 'sm' })}`;
    else body = gmDonePanel();
    return `<div class="gcard"><h2>${rest ? '🏕️ Rest Stop' : '🛒 Base Exchange (BX)'}</h2><p class="note">The party votes on their phones (✋); click the winning option.</p>${body}</div>`;
  }
  if (c.type === 'unknown') {
    const my = c.mystery != null ? MYSTERY[c.mystery] : null;
    return `<div class="gcard"><h2>❓ Unknown node</h2>
    ${c.step === 'spin' ? `<p class="note">Nothing is decided yet: the d6 picks the outcome when the cadet presses it. ${MYSTERY.map((m, i) => `${i + 1} ${m.name}`).join(' · ')}</p>${B('spinMystery', '🎲 Roll the d6', { cls: 'pri' })}`
        : spinning() ? '<p class="note">Spinning...</p>' : `<p class="bigres">${sceneIcon(my,32)} ${my.name}</p>${B('mysteryGo', 'Continue ➡️', { cls: 'pri' })}`}</div>`;
  }
  const m = curMission();
  const isCE = c.type === 'crisisEvent';
  let body = '';
  if (c.step === 'brief') body = `<div class="row">${B('timer', '⏱️ 30s decision clock', { arg: 30 })}</div>`;
  else if (c.step === 'roll') body = gmRollPanel();
  else if (c.step === 'stars') body = gmStarsPanel();
  else if (c.step === 'done') body = gmDonePanel();
  return `<div class="gcard"><h2>${sceneIcon(m,24)} ${c.type === 'elite' ? '💀 ELITE: ' : isCE ? '🚨 ' : c.type === 'spot' ? '🔦 ' : ''}${esc(m.title)}</h2>
    <div class="note">${esc(m.sob)} ${c.type === 'elite' ? '· ELITE: every choice requires a d20 check; a successful check earns loot' : ''}</div>
    ${c.type === 'spot' ? `<p class="warnline">🔦 Spotlight on ${esc(cadetName(c.slot))}: they must act out their chosen response for a 1–3 star rating. Only their phone can vote or roll; everyone else stays silent. 3 stars earns loot.</p>` : ''}
    ${m.cc ? `<p class="warnline">${ccBadge(18)} Commander encounter: you play ${esc(S.cc)}.</p>` : ''}
    <p style="font-size:15px">${esc(fill(S, m.text))}</p>${isCE ? `<p class="warnline">💀 Lost for good: ${esc(m.loss || '')} · A second crisis = GAME OVER.</p>` : ''}
    ${S.banner && c.type !== 'spot' ? `<p class="warnline">${esc(S.banner.text)} ${B('clearBanner', 'clear', { cls: 'sm' })}</p>` : ''}
    ${S.offline != null ? `<p class="warnline">📵 ${esc(cadetName(S.offline))} is offline this node.</p>` : ''}
    ${gmChoiceList(m, c)}${body}</div>`;
}

function gmRollPanel() {
  const c = S.cur, ch = c.spec.check, r = c.roller;
  const preview = rollPreview();
  const isLoy = ch.stat === 'LOYB';
  return `<div class="gchoice" data-progress-panel="check" style="border-color:var(--accent)"><b>🎲 CHECK: ${esc(statLabel(ch.stat))} vs ${preview.dc}</b> <span class="pill y">${rollOdds(preview, c.safe)}</span>
    <div class="row">${isLoy ? `<span class="note">${esc(npcLabel(S, 'B'))} rolls (a cadet rolls the die for them)</span>` : c.type === 'spot' ? `<span class="note">🔦 ${esc(cadetName(c.slot))} rolls (spotlight)</span>` : `${c.rollerLocked ? 'Roller locked:' : '🗳️ The team votes for the roller; click the winner to lock it in:'} ${S.party.map((p, i) => B('roller', `${esc(p.name)} (${ch.stat ? ch.stat + ' ' + sign(rollBonus(i, ch.stat, ch.m)) + (isSpec(i, ch.m) ? ' ★' : '') : '+0'})${c.rollerLocked ? '' : voteTag('r' + i)}`, { arg: i, cls: c.rollerLocked && r === i ? 'on' : 'go', dis: isOut(S, i) })).join('')} <span class="note">★ = includes +1 specialist</span>`}</div>
    <div class="note">Modifiers (besides the die): ${preview.parts.map(p => `${esc(p[0])} ${sign(p[1])}`).join(', ') || 'none'}</div>
    <div class="row">
      ${S.items.map((id, k) => { const l = LOOT.find(x => x.id === id); return l.use.type === 'check' ? B('item', `${l.icon} ${esc(l.name)} +${l.use.n} ${S.pending.check === id ? '(ON)' : ''}`, { arg: k, cls: S.pending.check === id ? 'on' : '' }) : ''; }).join('')}
      ${S.dcMod ? `<span class="pill y">Loaded Dice ${sign(S.dcMod)}</span>` : ''}
    </div>
    <div class="row">${B('resolveRoll', '🎲 Roll the d20', { cls: 'pri', dis: !c.rollerLocked })} <span class="note">${c.rollerLocked ? 'The roller taps ROLL on their phone (or press it for them).' : 'Lock in a roller first.'}</span></div></div>`;
}
function gmStarsPanel() {
  const c = S.cur, lead = c.lead ?? S.tokenHolder;
  const choice = curMission()?.choices[c.choice];
  return `<div class="gchoice" data-progress-panel="actOut" style="border-color:var(--gold)"><b>🎤 ${c.type === 'spot' ? 'SPOTLIGHT SCENE' : 'ACT IT OUT'}</b>
    <p class="note"><b>You play:</b> ${esc(fill(S, choice?.roleplay || 'the other side'))}. Respond in character; let the cadet explain their decision, handle pushback, and listen. Rate the conversation, not a narrated action.</p>
    ${choice ? `<p><b>Scene:</b> ${esc(fill(S, choice.t))}</p>` : ''}
    <div class="row">${B('timer', '⏱️ 30s act clock', { arg: 30 })} ${B('timer', '⏱️ 60s', { arg: 60 })}</div>
    <div class="row">Who's talking? ${c.lead == null ? '<span class="pill y">waiting for the speaker wheel</span>' : ''} ${S.party.map((p, i) => B('lead', esc(p.name), { arg: i, cls: lead === i ? 'on' : '', dis: isOut(S, i) })).join('')}</div>
    ${S.items.some(id => LOOT.find(x => x.id === id).use.type === 'star') ? `<div class="row">${S.items.map((id, k) => { const l = LOOT.find(x => x.id === id); return l.use.type === 'star' ? B('item', `${l.icon} ${esc(l.name)} +1 star ${S.pending.star === id ? '(ON)' : ''}`, { arg: k, cls: S.pending.star === id ? 'on' : '' }) : ''; }).join('')}</div>` : ''}
    <div class="row">Rate: ${B('stars', '⭐ 1 star', { arg: 1 })} ${B('stars', '⭐⭐ 2 stars', { arg: 2 })} ${B('stars', '⭐⭐⭐ 3 stars', { arg: 3, cls: 'pri' })}</div>
    <div class="note">1★ vague, blames, or gets it wrong · 2★ clear but one-sided · 3★ specific, respectful, sets expectations and listens</div></div>`;
}
function gmDonePanel() {
  const c = S.cur;
  let res = '';
  if (c.rollRes) { const r = c.rollRes; res = `🎲 ${r.d20} → ${r.total} vs ${r.dc}: <b class="${r.pass ? 'ok' : 'bad'}">${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE' : r.pass ? 'PASS' : 'FAIL'}</b>`; }
  if (c.stars) res = `🎤 ${'⭐'.repeat(c.stars)}${c.starBonus && c.starBonus.length ? ` <span class="note">(${esc(c.starBonus.join(', '))})</span>` : ''}`;
  if (c.result) res = esc(c.result);
  const pending = c.fumblePending || c.lootRoll || c.lootEarned;
  return `<div class="gchoice" style="border-color:var(--good)"><div class="bigres">${res || 'Effects applied.'}</div>
    ${eventRecapHtml(S)}
    ${resultSummary(S).reductions.map(r => `<div class="note loss-reduction">${esc(lossReductionText(r))}</div>`).join('')}
    ${c.lootMessage ? `<div class="note" style="color:var(--bad)">${esc(c.lootMessage)}</div>` : ''}
    <div class="row">
      ${gmPerkButton('mti')}
      ${c.fumblePending ? B('fumble', '🤦 Spin the Fumble wheel', { cls: 'red' }) : ''}
      ${(c.lootEarned || c.lootRoll) && !c.fumblePending ? B('loot', '🎁 Spin for loot!', { cls: 'pri' }) : ''}
      ${typeof depotAgainOk === 'function' && depotAgainOk() ? B('depotAgain', '🛒 Logistician: make a second trade', { cls: 'go' }) : ''}
      ${spinning() ? '<span class="note">Spinning...</span>' : (!pending ? B('nodeDone', 'Continue ➡️', { cls: 'pri' }) : '')}
    </div>${pending && !spinning() ? '<div class="note">These are the cadets\' buttons (see the yellow banner above); press here only to do it for them.</div>' : ''}</div>`;
}

function gmInject() {
  const inj = S.inject;
  if (!inj) return '';
  const m = inj.idx != null ? MURPHY[inj.idx] : null;
  let body = '';
  if (inj.stage === 'trigger') body = `<p class="note">${inj.foresight ? '🔮 Foresight: Wheel of Success guaranteed.' : `d6 picks the wheel: ${INJECT_ORDER.map(t => `${injectRange(t)} ${INJECT_WHEELS[t].name}`).join(' · ')}.`}</p>${gmPerkButton('foresight')}${B('spinTrigger', '🎲 Roll the d6', { cls: 'pri' })}`;
  else if (spinning()) body = '<p class="note">Spinning on the projector...</p>';
  else if (inj.stage === 'clear') body = `<p class="bigres ok">ALL CLEAR</p>${B('closeInject', 'Continue ➡️', { cls: 'pri' })}`;
  else if (inj.stage === 'murphy') body = `<p class="bigres">${INJECT_WHEELS[inj.filter].icon} ${INJECT_WHEELS[inj.filter].name}</p>${B('spinMurphy', '🎡 Spin the wheel', { cls: 'pri' })}`;
  else if (inj.stage === 'result') body = `<p class="bigres">${esc(m.name)} <span class="pill">${m.type}</span></p><p>${esc(fill(S, m.text || ''))} ${m.options ? '' : effText(S, m.eff)}</p>
      ${inj.blocked ? '<p class="ok">Blocked by Foresight.</p>' : ''}
      ${m.options ? `<p class="note">The team votes on their phones (✋) for how to respond; click the winner.</p><div class="row">${m.options.map((o, i) => B('applyInject', `${esc(fill(S, o.t))}: ${effText(S, o.eff)}${voteTag(i)}`, { arg: i, cls: 'go' })).join('')}
        ${m.tackle && !inj.blocked ? B('applyInject', `💪 Tackle it: d20 + ${m.tackle.stat} vs ${m.tackle.dc + DIFFICULTY.dcPlus}${voteTag(m.options.length)}`, { arg: m.options.length, cls: 'go' }) : ''}</div>` : B('applyInject', 'Apply', { arg: 0, cls: 'pri' })}`;
  else if (inj.stage === 'tackle') { const t = m.tackle, r = inj.roller;
    body = `<div class="gchoice" data-progress-panel="tackle" style="border-color:var(--accent)"><p class="bigres">💪 TACKLE IT: ${esc(m.name)}</p><p class="note">d20 + ${t.stat} vs ${t.dc + DIFFICULTY.dcPlus}. Pass = no loss; fail = ${effText(S, t.fail || {})}. The team votes on who rolls; once you lock it in, the roller taps ROLL.</p>
      <div class="row">${inj.rollerLocked ? 'Roller locked:' : '🗳️ The team votes; click the winner to lock it in:'} ${S.party.map((p, i) => B('tackleRoller', `${esc(p.name)} (${t.stat} ${sign(rollBonus(i, t.stat, t.m) + pendingCheckBonus(S))}${isSpec(i, t.m) ? ' ★' : ''})${inj.rollerLocked ? '' : voteTag('r' + i)}`, { arg: i, cls: inj.rollerLocked && r === i ? 'on' : 'go', dis: isOut(S, i) })).join('')}</div>
      <div class="row">${S.items.map((id, k) => { const l = LOOT.find(x => x.id === id); return l.use.type === 'check' ? B('item', `${l.icon} ${esc(l.name)} +${l.use.n} ${S.pending.check === id ? '(ON)' : ''}`, { arg: k, cls: S.pending.check === id ? 'on' : '' }) : ''; }).join('')}</div>
      </div>`; }
  else if (inj.stage === 'done') body = `<p class="bigres">${esc(m ? m.name : '')}</p><p>${esc(fill(S, inj.note || ''))}</p>
      <div class="row">${m && m.type === 'bad' && !inj.cancelled ? S.items.map((id, k) => { const l = LOOT.find(x => x.id === id); return l.use.type === 'cancel' ? B('item', `${l.icon} Use ${esc(l.name)} (cancel it)`, { arg: k }) : ''; }).join('') : ''} ${gmPerkButton('mti')}
      ${B('closeInject', 'Continue ➡️', { cls: 'pri' })}</div>`;
  return `<div class="gcard"><h2>${inj.forced ? '🃏 Curveball: ' : ''}Injects</h2>${body}</div>`;
}

function gmLevel() {
  return `<div class="gcard"><h2>⬆️ LEVEL UP!</h2><p class="note">Each cadet picks one upgrade.</p>
  ${S.party.map((p, i) => `<div class="gchoice"><b>${clsIcon(p.cls, 18)} ${esc(p.name)}${p.fired ? ' 🪓 FIRED' : ''}</b> <span class="note">${CLASS[p.cls].name}</span>
    ${p.fired ? '<p class="note">Relieved: no upgrade or passive effects.</p>' : `<div class="row">${CLASS[p.cls].ups.map(u => `<label class="b ${p.up === u.id ? 'on' : ''}"><input type="radio" class="hide" name="up${i}" data-inp="pup" data-arg="${i}" value="${u.id}" ${p.up === u.id ? 'checked' : ''}>${esc(u.name)}: <span class="note">${esc(u.text)}</span></label>`).join('')}</div>`}</div>`).join('')}
  ${B('confirmLevel', '✅ Confirm upgrades', { cls: 'pri', dis: S.party.some(p => !p.fired && !p.up) })}</div>`;
}

function gmBoss() {
  const Bs = S.boss, preview = bossAttackPreview(S);
  const forecast = Bs.atk ? meterLossPreview(Bs.atk.k, Math.max(0, Bs.atk.n - (Bs.block || 0))) : null;
  const recap = () => `<div class="gchoice">${bossRecap(Bs).map(line => `<div>${igText(line)}</div>`).join('')}</div>`;
  const next = label => B('bossNext', label, { cls: 'pri' });
  const itemButtons = type => `<div class="row">${S.items.map((id, k) => { const l = LOOT.find(x => x.id === id); return l?.use.type === type ? B('item', `${l.icon} ${esc(l.name)} +${l.use.n || 1}${type === 'star' ? ' star' : ' roll'} ${S.pending[type] === id ? '(ON)' : ''}`, { arg: k, cls: S.pending[type] === id ? 'on' : '' }) : ''; }).join('')}</div>`;
  const consequences = Bs.interviewConsequences?.length ? `<div class="gchoice">${Bs.interviewConsequences.map(line => `<div>${igText(line)}</div>`).join('')}</div>` : '';
  let body = '';
  if (Bs.stage === 'opening') {
    const effect = Bs.openingCurrent;
    const upcoming = Bs.opening[Bs.openingIdx];
    body = `<p>Base HP: ${Bs.max}. Bonus HP stays above that maximum; passive reductions deal damage.</p>${effect ? `<div class="gchoice"><b>${esc(effect.name)}</b><p>${esc(effect.why)}</p><b>${effect.amount < 0 ? `💥 ${esc(rankName(S.party[effect.cadet]))} deals ${effect.actualDamage} damage` : `IG +${effect.amount} bonus HP`}</b></div>` : '<p>The IG arrives at base HP. Resolve each opening effect before Support.</p>'}${next(upcoming ? `${upcoming.icon} Apply ${esc(upcoming.name)}` : '🤝 Begin Support')}`;
  } else if (Bs.stage === 'vouch') {
    const v = Bs.vouchCurrent || (Bs.vouches || [])[Bs.vouchIdx];
    body = `<p>${Bs.vouchCurrent ? 'Resolved support action:' : 'Next support action:'}</p>${v ? `<div class="gchoice"><b>${esc(v.name)}</b><p>${esc(v.why)}</p></div>` : '<p>No support actions available.</p>'}
      ${B('bossVouchNext', Bs.vouchIdx >= Bs.vouches.length ? '📋 Continue to The Audit' : Bs.vouchCurrent ? '🤝 Next support action' : '🤝 Resolve support action', { cls: 'pri' })}`;
  } else if (Bs.stage === 'intro') body = `<p>Check integrity, then apply readiness damage. Read the result before round 1.</p>${next('📋 Run The Audit')}`;
  else if (Bs.stage === 'auditResult') body = `${recap()}${next(Bs.hp <= 0 ? '🏁 Complete inspection' : '➡️ Show round 1 intent')}`;
  else if (Bs.stage === 'intent') body = `<p>${esc(bossAttackCopy(Bs))}</p>${next(Bs.round === 2 ? '🎤 Begin the Hot Seat' : '▶️ Begin team turn')}`;
  else if (Bs.stage === 'integrityStrike') body = '<p>The IG’s integrity finding defeats the flight. Continue after the attack finishes.</p>';
  else if (Bs.stage === 'hotseat' && !Bs.p2.who) body = `${consequences}<p>Each cadet presses their own roll button. The lowest settled roll faces the question. Ties are selected randomly.</p>${S.party.map((p, i) => p.name && !p.fired ? `<div>${esc(rankName(p))}: ${Bs.p2.settled?.[i] ? Bs.p2.rolls[i] : Bs.p2.rolls?.[i] != null ? 'Rolling…' : B('hotSeat', '🎲 Roll (GM fallback)', { arg: i })}</div>` : '').join('')}`;
  else if (Bs.stage === 'hotseat') body = `${consequences}${itemButtons('star')}${S.pending.star ? '<p class="note">Armed item adds 1 star, maximum 3. Consumed only if it improves the rating.</p>' : ''}${Bs.p2.who.map((w, j) => `<div class="gchoice"><b>${esc(cadetName(w))}</b><p>${esc(Bs.p2.q[j])}</p><div class="row">${B('timer', '⏱️ 20s', { arg: 20 })}${[1, 2, 3].map(n => B('bossStar', '⭐'.repeat(n), { arg: `${j},${n}`, cls: Bs.p2.stars[j] === n ? 'on' : '' })).join('')}</div></div>`).join('')}${B('bossStarsDone', '🎤 Resolve the answer', { cls: 'pri', dis: Bs.p2.stars.some(n => !n) })}`;
  else if (Bs.stage === 'interviewResult') body = `${recap()}${next(Bs.hp <= 0 ? '🏁 Complete inspection' : '▶️ Begin team turn')}`;
  else if (Bs.stage === 'act') {
    const counts = Object.values(Bs.votes || {}), press = counts.filter(v => v === 'press').length, defend = counts.filter(v => v === 'defend').length;
    body = `<p>${esc(bossAttackCopy(Bs))}</p>${itemButtons('check')}<div class="row">
      ${B('bossAction', `🗡️ Attack · ${press} votes`, { arg: 'press', cls: Bs.teamAction === 'press' ? 'on' : 'go', dis: !preview })}
      ${B('bossAction', `🛡️ Defend · ${defend} votes`, { arg: 'defend', cls: Bs.teamAction === 'defend' ? 'on' : 'go' })}</div>
      <p class="note">${preview ? `${esc(preview.name)}: d20 ${sign(preview.bonus)} vs ${preview.target}; needs ${preview.need}+ (${preview.chance}%). ${preview.parts.map(([name, n]) => esc(name) + ' ' + sign(n)).join(' · ')}. Hit 2 damage, critical 4.` : 'No cadet available to attack.'} Defend gives 2 Block for this round.</p>
      <div class="row">${B('timer', '⏱️ 30s discussion', { arg: 30 })}${B('bossResolve', Bs.teamAction ? `Resolve ${Bs.teamAction === 'press' ? 'ATTACK' : 'DEFEND'}` : 'Resolve team vote', { cls: 'pri', dis: !Bs.teamAction && !counts.length })}</div>`;
  } else if (Bs.stage === 'playerResult') body = `${recap()}<p>The IG has not attacked yet.</p>${next(Bs.hp <= 0 ? '🏁 Complete inspection · IG attack cancelled' : `${igIcon()} Begin IG turn`)}`;
  else if (Bs.stage === 'enemy') body = `<p>${esc(Bs.atk.name)}: ${Bs.atk.n} incoming − ${Math.min(Bs.atk.n, Bs.block || 0)} Block${forecast.reduction ? ` − ${forecast.reduction.from - forecast.reduction.to} ${esc(forecast.reduction.name)}` : ''} = <b>${forecast.loss} damage to ${esc(METER[Bs.atk.k].label)}</b>.</p>${next(`${igIcon()} Resolve IG attack`)}`;
  else if (Bs.stage === 'resolved') body = `${recap()}${next(Bs.round < BOSS_ROUNDS.length ? `➡️ Round ${Bs.round + 1}: show intent` : '🏁 Complete inspection')}`;
  else if (Bs.stage === 'done') { const defeat = bossDefeatScore(S); body = `<p class="bigres">${esc(Bs.result)}</p>${defeat ? `<p>🏆 Phase ${defeat.phase} victory · 30 ×${defeat.multiplier} = <b>+${defeat.points} points</b></p>` : ''}${B('finish', '🏁 Show final results', { cls: 'pri' })}`; }
  return `<div class="gcard"><h2>${igIcon(32)} ${esc(BOSS.name)} · HP <span class="${Bs.hp > Bs.max ? 'over-base' : ''}">${Bs.hp}</span>/${Bs.max}</h2>
    <div class="gchoice" data-progress-panel="boss"><b>${Bs.round ? `ROUND ${Bs.round} / 3 · ` : ''}${bossStageLabel(Bs)}</b>${body}</div>
    <details><summary>Inspection history</summary><div class="log">${Bs.log.map(line => `<div>${igText(line)}</div>`).join('')}</div></details></div>`;
}
// A "use this perk" button for whoever has it, only when it can be used right now
function gmPerkButton(id) {
  const i = S.party.findIndex(p => p.perk === id); if (i < 0 || !perkWhen(S, S.party[i], i)) return '';
  return B('perkUse', `${perkOf(S.party[i]).icon} ${esc(cadetName(i))}: ${esc(perkOf(S.party[i]).name)}`, { arg: i, cls: 'go' });
}

function gmResults() {
  const f = { ...S.final, parts: displayScoreParts(S.final.parts) };
  return `<div class="gcard"><h2>${S.gameOver ? '💀 GAME OVER' : 'Final results'}</h2>
    <div class="row">${B('printTeam', '🖨️ Team results / print', {cls:'pri'})}</div>
    <p class="bigres" style="color:${f.grade.color}">Grade ${f.grade.g} · ${f.total} pts</p>
    ${S.gameOver ? `<p class="bad">${esc(S.gameOverReasons.join('; '))}</p>` : ''}
    <table class="g">${f.parts.map(p => `<tr><td>${esc(p[0])}</td><td>${p[1]}</td></tr>`).join('')}</table>
    <p class="note">${S.practice ? '🧪 Practice only · scores are not saved.' : S.saved ? `✅ Saved to the leaderboard automatically as ${(patchOf(S) || {}).icon || ''} ${esc(S.callsign)}.` : B('saveBoard', '🏆 Save to leaderboard', { cls: 'pri' })}</p>
    <div class="row">${B('board', S.showBoard ? 'Hide leaderboard on projector' : 'Show leaderboard on projector')} ${B('toDebrief', '🔌 Power down: reality debrief', { cls: 'go' })}</div></div>`;
}

const objEvents = (S, id) => (S.objLog || []).filter(e => objEventIds(e).includes(id));
function suggestions() {
  const q = [], L = S.log.map(l => l.t + ' ' + l.d).join(' | ');
  if (S.gameOver || S.flags.HONEST_BROKER || S.ach.includes('hardright')) q.push('What made the integrity shortcut tempting? What would it cost you in real life?');
  if ((S.npcs || []).some(n => n.broken)) q.push("Everyone's trait was on the org chart, and someone still hit their breaking point. What did you see coming, and why didn't you act on it?");
  if (S.micLow) q.push('One encounter earned only 1 star. Redo that line now: what would you say to that Airman?');
  if (S.meters.mis >= 7 && S.meters.mor <= 4) q.push('You won the mission and lost the people. When is that the right call?');
  if (S.crises) q.push('You hit a Crisis Event. Which earlier decision set that up, and when could you still have stopped it?');
  if (S.flags.LOST_AIRMAN) q.push("Your flight lost an Airman. What warning signs do real units miss, and what is a leader's duty when they see one?");
  if (S.party.some(p => p.fired)) q.push('A member of your leadership team was dismissed. What does a commander need to see to keep confidence in a leader?');
  if (S.usedMissions.includes('M3')) q.push('What barrier to creative thinking showed up in "We tried that in 2019," and what removes it?');
  const used = id => S.usedMissions.includes(id);
  if (used('M19') || used('M24')) q.push('Which warning signs showed up before it became a crisis? Who had a duty to report them, and what made it hard?');
  if (used('M13') || used('M14') || used('M15')) q.push('Where is the line between taking care of an Airman and covering for them?');
  if (used('M22')) q.push('How do you correct insubordination in public without losing the room, or the Airman?');
  if (used('M17') || used('M23')) q.push('Was that a discipline problem or a leadership problem (schedules, fatigue)? How do you tell the difference?');
  const u = unitObj();
  if (u) q.push(`Your squadron penalty was: ${squadPenaltyText(S.unit)} How did your team adapt, and what is the real-world version in a ${u.sq}?`);
  return q.concat(DEBRIEF_ALWAYS);
}
/* ---- practicum rubric ----
   Every cadet starts at the full 20 (Reflection 8 · Engagement 6 · Concepts 6) and the GM marks down from there.
   Concepts is pre-filled from what the team did, with light deductions (−1 each, −2 at most), and the notes
   start with the team's review, so the GM has feedback to read out and edit. */
const RUBRIC = [['ref', 'Reflection', 8], ['eng', 'Engagement', 6], ['con', 'Concepts', 6]];
const RUBRIC_MAX = RUBRIC.reduce((a, r) => a + r[2], 0);
function teamReview(S) {
  const g = S.final && S.final.grade, traps = TRAP_FLAGS.filter(f => (S.flags || {})[f]);
  const crises = (S.log || []).filter(l => l.t === 'CRISIS EVENT').map(l => l.d.split(':')[0]);
  const allies = (S.npcs || []).filter(isAlly).length, low = Math.min(...METERS.map(m => S.meters[m.k]));
  const lines = [], ded = [];
  lines.push(g ? `Team result: ${g.g}${S.gameOver ? '' : ` (${S.final.total} pts)`}` : 'Team result: not finished');
  if (traps.length) { lines.push(`⚠️ Integrity: ${traps.map(f => FLAG_TEXT[f]).join('; ')}.`); ded.push('an integrity violation'); }
  else lines.push('✅ Integrity: no violations. The team held the line every time it was tested.');
  if (crises.length || (S.gameOver && S.gameOverKind === 'crisis')) {
    lines.push(`🚨 Crisis Event${crises.length > 1 ? 's' : ''}: ${crises.length ? crises.join(', ') : 'a second meter hit zero'}. A meter was allowed to hit zero${S.gameOver && S.gameOverKind === 'crisis' ? ', and a second one ended the game' : ''}.`);
    ded.push('a Crisis Event (a meter hit zero)');
  }
  if (g && g.g === 'D') ded.push('a D on the game');
  const good = [allies && `${allies} Unit All${allies === 1 ? 'y' : 'ies'}`, S.starsTotal && `${S.starsTotal} 🎤 stars`,
    !S.gameOver && low >= 5 && 'every meter finished 5 or higher', !S.gameOver && S.intent && S.meters[S.intent] >= 7 && "met the commander's intent"].filter(Boolean);
  if (good.length) lines.push(`Strengths: ${good.join(' · ')}.`);
  const off = Math.min(2, ded.length), con = 6 - off;
  lines.push(`Concepts ${con}/6${off ? ` (−${off}: ${ded.slice(0, 2).join('; ')})` : ': full marks'}.`);
  return { con, lines };
}
function defaultGrade() { const r = teamReview(S); return { ref: 8, eng: 6, con: r.con, notes: r.lines.join('\n') }; }
function gmDebrief() {
  const dv = S.debrief;
  return `<div class="gcard"><h2>🔌 Reality debrief</h2>
    <div class="row">${B('printTeam', '🖨️ Team results / print', {cls:'pri'})}</div>
    <div class="row">${B('dview', '🎯 Samples of Behavior', { arg: 'objectives', cls: dv.view === 'objectives' ? 'on' : '' })} ${B('dview', '📖 Decoder', { arg: 'decoder', cls: dv.view === 'decoder' ? 'on' : '' })} ${B('dview', '🕒 Replay timeline', { arg: 'timeline', cls: dv.view === 'timeline' ? 'on' : '' })}</div>
    ${dv.view === 'timeline' ? `<p class="note">Click an event to spotlight it on the projector.</p><div class="log" style="max-height:260px">${S.log.map((l, i) => `<div><button class="b sm ${dv.spot === i ? 'on' : ''}" data-act="spot" data-arg="${i}">🔦</button> N${l.n} · <b>${esc(l.t)}</b> ${esc(l.d)}</div>`).join('')}</div>` : ''}
    ${dv.view === 'objectives' ? `<p class="note">The projector shows the five samples of behavior and every event in this run that tested each one. Use it as the wrap-up.</p>${OBJECTIVES.map(o => { const ev = objEvents(S, o.id); return `<div class="gchoice"><b>${o.icon} ${esc(o.name)}</b> <span class="note">${ev.length} event${ev.length === 1 ? '' : 's'}</span>${ev.map(e => `<div class="note">Stop ${e.n} · ${esc(e.title)}${e.choice ? `: "${esc(e.choice)}"` : ''}</div>`).join('')}</div>`; }).join('')}` : ''}
    <h3 style="margin-top:12px">Suggested questions</h3><ol>${suggestions().map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
    <div class="gcard"><h3>Practicum rubric (GM only) · ${RUBRIC.map(r => `${r[1]} ${r[2]}`).join(' · ')} = /${RUBRIC_MAX}</h3>
    <p class="note">Everyone starts at ${RUBRIC_MAX}/${RUBRIC_MAX}; mark down from there. Concepts is pre-filled from the run (light deductions, −2 at most) and each cadet's notes start with the team review below. Edit anything.</p>
    <div class="gchoice">${teamReview(S).lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>
    ${S.party.map((p, i) => { const g = S.grades[i] || defaultGrade(); return `<div class="gchoice"><b>${esc(p.name)}</b> <span class="note">${CLASS[p.cls].name}</span> · <b>${(+g.ref) + (+g.eng) + (+g.con)}/${RUBRIC_MAX}</b>
      ${RUBRIC.map(([k, lbl, mx]) => `<div class="slider">${lbl}<input type="range" min="0" max="${mx}" value="${g[k]}" data-inp="grade" data-arg="${i},${k}"><b>${g[k]}</b></div>`).join('')}
      <textarea placeholder="Notes (the cadet sees these when you show them)" data-inp="gnote" data-arg="${i}">${esc(g.notes)}</textarea>
      <div class="row">${B('showGrade', g.shown ? '🙈 Hide from cadet' : '📱 Show cadet', { arg: i, cls: g.shown ? 'on sm' : 'sm go', title: 'Sends this score and your notes to this cadet\'s phone only' })}${g.shown ? '<span class="note">On their phone now. Edits update it live.</span>' : ''}</div></div>`; }).join('')}
    <div class="row">${S.practice ? '<span class="note">Practice grades are not saved.</span>' : `${B('saveGrades', S.gradesSaved ? '✅ Grades saved' : '💾 Save grades')} ${B('exportCSV', '📊 Export all grades CSV')}`}  ${B('newRun', '▶️ Next party: new run', { cls: 'pri' })}</div></div>`;
}

function gmSideLite() {
  return `${routeCard()}
  <div class="gcard"><h3>Quick reference</h3><p class="note">Checks: d20 + stat (+2 if the tied meter is 8+, −2 if 2 or less). Normal ${DC_NORMAL}, Hard ${DC_HARD}. Nat 20 = crit (double good + loot). Nat 1 = fumble.<br>
    Harder settings (DIFFICULTY in data.js): an inject after every ${DIFFICULTY.injectEvery === 1 ? '' : DIFFICULTY.injectEvery === 2 ? 'other ' : DIFFICULTY.injectEvery + 'th '}stop (d6: ${INJECT_ORDER.map(t => injectRange(t) + ' ' + t).join(', ')}), IG HP ${DIFFICULTY.bossHp}, IG hits −${DIFFICULTY.bossAttack}. Each squadron has a distinct gameplay penalty shown during selection and at the point it applies.<br>Score = meters×3 + lowest meter×10 + intent ±20 + inspection (+60 to −15) + IG defeated +30 + stars×5 + achievements (0-25 each) + allies×10. Unused items/perks score nothing.</p></div>`;
}
function gmSide() {
  return `${routeCard()}
  <div class="gcard"><h3>Meters (manual override)</h3><div class="gmeters">${METERS.map(m => `<div class="mt">${m.icon}<span>${m.name}</span>${B('meter', '−', { arg: m.k + ',-1', cls: 'sm' })}<b>${S.meters[m.k]}</b>${B('meter', '+', { arg: m.k + ',1', cls: 'sm' })}</div>`).join('')}</div>
    <div class="note">${deocsOn(S) ? `📋 DEOCS Survey running: players see exact numbers (${deocsLeft(S)} more stop${deocsLeft(S) === 1 ? '' : 's'})` : `Players see STRONG / STEADY / DANGER (≤${DIFFICULTY.dangerAt}), not numbers.`}</div>
    ${S.crisisQueue.length ? `<p class="warnline">Crisis queued: ${S.crisisQueue.map(k => METER[k].name).join(', ')}</p>` : ''}</div>
  <div class="gcard"><h3>Party & abilities</h3><p class="note">👑 A Flight Commander who selected passive Command Token decides every tied vote. Otherwise, the GM decides ties.</p>
    ${S.party.map((p, i) => { const ab = CLASS[p.cls].ability; return `<div class="row"><b>${clsIcon(p.cls, 18)} ${esc(p.name)}${i === crownIdx(S) ? ' 👑' : ''}${p.fired ? ' 🪓 FIRED' : ''}</b>
      ${ab ? B('ability', `${esc(ab.name)} ${p.fired ? '(inactive)' : ab.auto ? '(passive)' : p.used >= abilityLimit(p) ? '(used)' : ''}`, { arg: i, cls: 'sm', dis: p.fired || ab.auto || p.used >= abilityLimit(p), title: ab.text }) : ''}
      <span class="note">${esc(perkOf(p).name)}${p.up ? ' · ' + esc(upOf(p).name) : ''}</span></div>`; }).join('')}</div>
  <div class="gcard"><h3>🎁 Perks</h3>${S.party.map((p, i) => { const pk = perkOf(p), used = S.flags['perkUsed_' + p.perk], w = perkWhen(S, p, i);
      return `<div class="row"><b>${clsIcon(p.cls, 18)} ${esc(p.name)}${p.fired ? ' 🪓 FIRED' : ''}</b> ${pk.icon} ${esc(pk.name)} ${p.fired ? '<span class="pill">inactive</span>' : used ? '<span class="pill">used</span>' : useSplit(pk.text).kind === 'passive' ? '<span class="pill">passive</span>' : w ? B('perkUse', 'use now', { arg: i, cls: 'sm go', title: w.hint }) : '<span class="note">not now</span>'}
        ${used ? B('perkReset', '↺', { arg: i, cls: 'sm', title: 'Manual fix: mark unused' }) : ''}</div>`; }).join('')}</div>
  ${S.unit ? (() => { const u = unitObj(); return `<div class="gcard"><h3>${npcIns(S.cc, 18)} ${esc(S.cc)}</h3><div class="note">Intent: ${METER[u.cc.intent].icon} ${METER[u.cc.intent].label} (now ${S.meters[u.cc.intent]})</div>
    <div>👍 <b>${esc(u.cc.pos.name)}</b> <span class="note">${esc(u.cc.pos.text)}</span></div><div style="${S.flags.ccNegOff ? 'opacity:.4;text-decoration:line-through' : ''}">👎 <b>${esc(u.cc.neg.name)}</b> <span class="note">${esc(u.cc.neg.text)}</span></div></div>`; })() : ''}
  <div class="gcard"><h3>NPCs</h3>${S.npcs.map(n => { const t = TRAIT[n.trait]; return `<div class="row"><b>${n.slot}</b> ${insignia(n.rank, 18)}${esc(n.rank + ' ' + n.name)}${n.deceased ? ' <span class="pill">🕯️ DECEASED</span>' : n.gone ? ' <span class="pill">GONE</span>' : ''}
      ${B('loy', '−', { arg: n.slot + ',-1', cls: 'sm' })}<b>${n.loy}</b>${B('loy', '+', { arg: n.slot + ',1', cls: 'sm' })} ${loyBandHtml(n.loy, isAlly(n), n.broken)}
      <span class="${n.revealed ? 'warnline' : 'note'}">${t.icon} ${t.name}${n.revealed ? '' : ' (hidden)'}</span>
      ${n.revealed ? '' : B('reveal', 'reveal', { arg: n.slot, cls: 'sm' })}${isAlly(n) ? ' <span class="pill y">ALLY</span>' : ''}${n.out ? ` <span class="pill">out ${n.out}</span>` : ''}${n.broken ? ' <span class="pill">broken</span>' : ''}</div>`; }).join('')}</div>
  <div class="gcard"><h3>Inventory (${S.items.length}/3)</h3>${S.items.length ? S.items.map((id, k) => { const it = LOOT.find(l => l.id === id); return `<div class="row">${it.icon} <b>${esc(it.name)}</b> <span class="note">${esc(it.text)}</span> ${B('item', 'use', { arg: k, cls: 'sm' })} ${B('discard', '✖', { arg: k, cls: 'sm' })}</div>`; }).join('') : '<p class="note">Empty</p>'}
    ${S.items.length > 3 ? '<p class="warnline">Over capacity: the party must discard one.</p>' : ''}${S.pending.check ? `<p class="note">${LOOT.find(l => l.id === S.pending.check).name} armed for the next roll</p>` : ''}${S.pending.star ? `<p class="note">${LOOT.find(l => l.id === S.pending.star).name} armed for the next encounter</p>` : ''}</div>
  <div class="gcard"><h3>Timer & banner</h3><div class="row">${[15, 30, 60, 90].map(s => B('timer', s + 's', { arg: s, cls: 'sm' })).join('')} ${B('timer', 'stop', { arg: 0, cls: 'sm' })} ${S.banner ? B('clearBanner', 'clear banner', { cls: 'sm' }) : ''}</div></div>
  <div class="gcard"><h3>Achievements (${S.ach.length})</h3><div>${ACHIEVEMENTS.map(a => `<button class="b sm ${S.ach.includes(a.id) ? 'on' : ''}" data-act="achToggle" data-arg="${a.id}" title="${esc(a.text)}">${a.icon} ${esc(a.name)}</button>`).join(' ')}</div></div>
  <div class="gcard"><h3>Run log</h3><div class="log">${S.log.slice().reverse().map(l => `<div>N${l.n} · <b>${esc(l.t)}</b> ${esc(l.d)}</div>`).join('')}</div></div>`;
}

/* ---------------- GM actions ---------------- */
act('openPlayer', () => {
  playerWin = window.open(location.href.split('#')[0] + '#player', IS_BOSS_PRACTICE ? 'sqPracticePlayer' : 'sqPlayer', 'width=1280,height=760');
  return false;
});
act('mute', () => { S.muted = !S.muted; });
act('board', () => { S.showBoard = !S.showBoard; });
act('undo', () => { if (!hist.length) return false; hist.pop(); restoreRun(JSON.parse(hist.pop() || JSON.stringify(S))); });
act('newRun', () => { if (IS_BOSS_PRACTICE) { startBossPractice(); return; } if (S.phase !== 'title' && S.phase !== 'debrief' && !confirm('Abandon this run and start a new one?')) return false; startRun(); });
// Effects have already been applied in a saved run. Discard expired animation work
// and let the GM acknowledge the saved result, including any pending hot-seat pick.
function restoreRun(saved) {
  if (!saved || !saved.phase) return false;
  if (mapRollTimer) { clearInterval(mapRollTimer); mapRollTimer = null; }
  S = saved; VEIL = null; veilFor = 0; S.spinUntil = 0;
  // Existing Plans Officers who picked the former passive keep the new perk slot.
  (S.party || []).forEach(p => { if (p.cls === 'plans' && p.perk === 'prepo') p.perk = 'foresight'; });
  FX = []; emit('resetFx');
  if (S.gmNext) { S.gmNext.steps = [0]; S.gmNext.animations = []; S.gmNext.ready = true; }
  if (S.phase === 'mapRoll') beginMapGeneration();
}
act('resume', () => { try { return restoreRun(JSON.parse(localStorage.getItem(RUN_STORAGE_KEY))); } catch (e) { return false; } });
act('introNext', () => { if (S.introPage === 0) { S.phase = 'avatars'; sfx('start'); return; } S.introPage = Math.min(INTRO_PAGE_COUNT - 1, S.introPage + 1); sfx(S.introPage === 2 ? 'alarm' : 'click'); });
act('introPrev', () => { S.introPage = Math.max(0, S.introPage - 1); });
act('noticeOk', () => {
  S.notice = (S.noticeQ || []).shift() || null;
  if (S.notice) S.notice.at = Date.now();
  else if (S.phase === 'manifest' && S.manifestRollPending) beginManifestReveal();
});
act('setStops', n => {
  if (S.mapLocked) { alert('The route map is already open: the length can only change before that.'); return false; }
  S.stops = +n; try { localStorage.setItem('sq_stops', String(+n)); } catch (e) { }
});
act('rerollMap', () => { if (S.mapLocked) return false; S.mapSeed = (Math.random() * 0xFFFFFFFF) >>> 0; S.map = genMap(S.mapSeed); sfx('click'); });
act('toParty', () => { S.phase = S.party.some(p => p.name.trim() && p.av == null) ? 'avatars' : 'party'; sfx('start'); });
act('setAv', a => { const [i, k] = a.split(',').map(Number); S.party[i].av = k; S.party[i].g = AVATARS[k].g; sfx('click'); });
act('avDone', () => {
  // Icons precede the overview; late joiners can finish their icons after the briefing.
  const next = S.introPage === INTRO_PAGE_COUNT - 1 ? 'party' : 'intro';
  if (!S.rosterChoice) { S.rosterNext = next; S.phase = 'roster'; S.votes = {}; }
  else { S.phase = next; if (next === 'intro') S.introPage = 1; }
  log('Avatars', 'Chosen'); sfx('start');
});
act('pickRoster', id => {
  if (S.phase !== 'roster' || !ROSTER_OPTIONS.some(r => r.id === id)) return false;
  S.rosterChoice = id; S.votes = {};
  S.introExampleName = pickOne(getRoster().names);
  S.phase = S.rosterNext || 'intro'; if (S.phase === 'intro') S.introPage = 1;
  log('Name roster', getRoster().option.name); sfx('start');
});
// GM presses a pending cadet button on their behalf
act('actorGo', () => { if (!S.actor || spinning()) return false; S.lastActor = S.actor.slot; const f = ACTOR_RUN[S.actor.kind]; if (f) f(); });
// party-voted rest stop / supply depot options, by key
act('restPick', k => {
  S.cur.resultBase = resultSnapshot();
  if (METER[k]) return ACT.restMeter(k);
  if (k === 'loy') return ACT.restLoy();
  if (k.startsWith('rc')) return ACT.restRecharge(k.slice(2));
});
act('depotPick', k => {
  if (!depotOptions().some(o => o.key === k && !o.dis)) return false;
  const c = S.cur; c.resultBase = resultSnapshot();
  const done = (txt) => { if (k !== 'skip') depotTax(); c.trades = (c.trades || 0) + 1; c.step = 'done'; c.result = txt; log('Base Exchange', txt); };
  if (k === 'favor' || k === 'tasker') { c.trade = k; c.step = 'who'; S.votes = {}; return; }
  if (k === 'train') { c.step = 'train'; return; }
  if (k === 'pizza') { bxSpend(2, 'Pizza for the flight'); applyEff({ mor: 3, why: 'Pizza for the flight' }); return done('Pizza for the whole flight: 📦 for ❤️'); }
  if (k === 'coffee' || k === 'schmooze') { bxSpend(2, 'Coffee for the Group CC'); applyEff({ tru: 2, why: 'Coffee for the Group CC' }); return done("Coffee run for the Group CC's staff: 📦 for ⭐"); }
  if (k === 'deocs') { bxSpend(1, 'DEOCS Survey'); runDeocs(); return done(`DEOCS Survey: exact meter values for the next ${DIFFICULTY.deocsStops} stops`); }
  if (k === 'overtime') { applyEff({ mor: -2, why: 'Mandatory overtime' }); applyEff({ res: 3, why: 'Mandatory overtime' }); return done('Skipped the lunch run for mandatory overtime: ❤️ for 📦'); }
  if (k === 'offbooks') { applyEff({ res: 4, flag: 'OFF_BOOKS', why: 'GPC card, no paperwork' }); return done('Put it on the unit GPC card: +4 📦, no paperwork'); }
  done('Just browsing: no purchase');
});
// favor / tasker: the team picks which Unit member pays
act('depotWho', sl => {
  const c = S.cur, n = npc(sl); if (!c || c.step !== 'who' || !n || n.gone || n.out > 0) return false;
  if (c.trade === 'favor') { changeLoy(sl, -2); c.lootEarned = true; c.result = `Called in a favor from ${n.rank} ${n.name}: free loot spin`; }
  else {
    const coast = n.trait === 'coaster' && !n.broken, over = n.trait === 'overach' && !n.broken;
    changeLoy(sl, coast ? 1 : over ? -2 : -1); applyEff({ mis: coast ? 5 : 3, why: 'Volunteered for the tasker' });
    c.result = `Volunteered ${n.rank} ${n.name} for the tasker: +${coast ? 5 : 3} 🎯${coast ? ' (a challenge woke the Coaster up)' : over ? ' (the Over-Achiever is overloaded)' : ''}`;
  }
  depotTax(); c.trades = (c.trades || 0) + 1;
  c.step = 'done'; S.votes = {}; log('Base Exchange', c.result); assignPending();
});
// Budget Squeeze (FSS commander): every trade costs 1 extra 📦 unless Pre-Positioned Supplies makes all BX purchases free
function depotTax() { if (stagedSupplyHolder()) return; if (S.cur && S.cur.freeTrade) { S.cur.freeTrade = false; return; } ccApply('depotTax', 'BX purchase'); }
// A BX 📦 cost, waived by the passive Pre-Positioned Supplies perk
function bxSpend(n, why) {
  if (stagedSupplyHolder()) { log('Base Exchange', `${why}: free (Pre-Positioned Supplies)`); return; }
  if (S.pending.prepo) { S.pending.prepo = false; if (S.cur) S.cur.freeTrade = true; toast('📦', 'PRE-POSITIONED SUPPLIES', `${why}: no 📦 spent`); log('Base Exchange', `${why}: free (Pre-Positioned Supplies)`); return; }
  applyEff({ res: -n, why });
}
// Logistician (LRS commander): a second trade per visit
function depotAgainOk() { const c = S.cur; return c && c.type === 'depot' && c.step === 'done' && ccHook('depot2').length && (c.trades || 0) === 1 && !c.lootEarned && !c.lootRoll && !S.actor; }
act('depotAgain', () => { if (!depotAgainOk()) return false; const h = ccHook('depot2')[0]; S.cur.step = 'choose'; S.cur.trade = null; S.votes = {}; ccReact(h, 'A second purchase at the BX'); });
act('depotTrain', a => {
  const [i, st] = a.split(','), p = S.party[+i];
  if (!S.cur || S.cur.type !== 'depot' || S.cur.step !== 'train' || !p || p.fired || !STATS.includes(st)) return false;
  bxSpend(2, 'Training slot'); p.train = p.train || {}; p.train[st] = (p.train[st] || 0) + 1;
  depotTax(); S.cur.trades = (S.cur.trades || 0) + 1;
  S.cur.step = 'done'; S.cur.result = `Study guides: ${cadetName(+i)} +1 ${st} for the rest of the game`; log('Base Exchange', S.cur.result);
});
act('depotBack', () => { S.cur.step = 'choose'; S.cur.trade = null; S.votes = {}; });
act('lockParty', () => { const w = lockParty(); S.partyWarn = w; if (w) return; S.partyWarn = ''; sfx('level'); });
act('lockPerks', () => { const w = lockPerks(); S.partyWarn = w; if (w) return; S.partyWarn = ''; sfx('start'); });
act('backToClasses', () => {
  S.phase = 'party'; S.partyWarn = '';
  while (S.party.length < 4) S.party.push({ name: '', cls: '', perk: '', up: '', used: 0, av: null });
});
act('pickUnit', id => pickUnit(id));
act('toPatch', () => { S.phase = 'patch'; S.votes = {}; sfx('start'); });
act('showItems', () => { if (S.phase !== 'patch') return false; autoPatch(); S.phase = 'itemsBriefing'; S.votes = {}; sfx('start'); });
act('itemAwardOk', () => { if (S.phase !== 'itemAward' || !S.itemAward || S.gmNext || spinning()) return false; S.phase = S.itemAward.returnPhase || 'node'; S.itemAward = null; assignPending(); });
const MANIFEST_REVEAL = { total: 10000, commander: 2000, stagger: 2000, member: 2000 };
function beginManifestReveal() {
  if (S.notice || (S.noticeQ || []).length) { S.manifestRollPending = true; return; }
  S.manifestRollPending = false;
  S.manifestRollAt = Date.now(); S.manifestRollUntil = S.manifestRollAt + MANIFEST_REVEAL.total;
  const revealAt = S.manifestRollAt;
  setTimeout(() => { if (S.phase === 'manifest' && S.manifestRollAt === revealAt) { push(true); renderGM(); } }, MANIFEST_REVEAL.total + 150);
}
act('showManifest', () => {
  autoPatch(); S.phase = 'manifest'; S.votes = {}; sfx('start'); confidantStart();
  S.manifestRollAt = 0; S.manifestRollUntil = 0; S.manifestRollPending = true;
  beginManifestReveal();
});
let mapRollTimer = null;
function beginMapGeneration() {
  if (mapRollTimer) clearInterval(mapRollTimer);
  S.phase = 'mapRoll'; S.mapLocked = false; S.mapRoll = 1; S.mapSeed = (Math.random() * 0xFFFFFFFF) >>> 0; S.map = genMap(S.mapSeed); S.votes = {}; sfx('start');
  const frames = 10;
  mapRollTimer = setInterval(() => {
    if (S.phase !== 'mapRoll') { clearInterval(mapRollTimer); mapRollTimer = null; return; }
    S.mapSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
    S.map = genMap(S.mapSeed);
    S.mapRoll++;
    if (S.mapRoll >= frames) {
      clearInterval(mapRollTimer); mapRollTimer = null;
      S.mapLocked = true; S.pos = { tier: -1, idx: null }; S.phase = 'map'; S.votes = {};
      log('Route seed locked', String(S.mapSeed)); sfx('start');
    }
    push();
  }, 500);
}
function autoPatch() {
  if (S.patch || !PATCHES[S.unit]) return;
  const n = {}; Object.values(S.votes || {}).forEach(k => { if (patchFree(S, String(k))) n[k] = (n[k] || 0) + 1; });
  const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0], f = top || (PATCHES[S.unit].find(p => patchFree(S, p.id)) || {}).id; if (f) setPatch(f);
}
// Commander's Confidant (XO ability) is passive: with an XO in the party, every squadron's 👎 is crossed out on
// squadron select and is off for the whole game once one is picked. The org chart shows the notice.
function confidantStart() {
  const i = confidantIdx(S), u = unitObj();
  if (i < 0 || !u || S.flags.confidantShown) return;
  S.flags.ccNegOff = true; S.flags.confidantShown = true;
  notice('🗣️', `${cadetName(i).toUpperCase()}: COMMANDER'S CONFIDANT`,
    `${cadetName(i)} already has the Squadron Commander's ear. The commander's negative perk, "${u.cc.neg.name}" (${u.cc.neg.text}), will not apply this game. It's crossed out.`);
  log('Ability', `${cadetName(i)}: Commander's Confidant (passive) cancelled ${u.cc.neg.name}`);
}
// the team votes on their phones; the GM clicks the winner to lock it in (Change reopens the vote)
act('setPatch', id => { if (!patchFree(S, id)) return false; setPatch(id); S.votes = {}; sfx('level'); log('Team patch', `${(patchOf(S) || {}).icon || ''} ${S.callsign}`); });
act('unsetPatch', () => { S.patch = ''; S.callsign = ''; S.votes = {}; });
act('toMap', () => { if (S.manifestRollPending || Date.now() < (S.manifestRollUntil || 0)) return false;
  if (!S.patch && PATCHES[S.unit]) { // nobody locked one in: the top-voted free patch, else the first free one
    const n = {}; Object.values(S.votes || {}).forEach(k => { if (patchFree(S, String(k))) n[k] = (n[k] || 0) + 1; });
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0], f = top || (PATCHES[S.unit].find(p => patchFree(S, p.id)) || {}).id; if (f) setPatch(f); }
  beginMapGeneration(); });
act('node', a => { const [t, i] = a.split(',').map(Number); chooseNode(t, i); });
act('rallySwapNode', a => {
  const rr = S.routeRally, key = String(a), [t, i] = key.split(',').map(Number);
  if (S.phase !== 'map' || !rr || !rr.candidates.includes(key) || t !== rr.tier) return false;
  if (!rr.first) { rr.first = key; return; }
  if (rr.first === key) { rr.first = null; return; }
  const [ot, oi] = rr.first.split(',').map(Number), first = S.map.tiers[ot][oi], second = S.map.tiers[t][i];
  if (!first || !second || first.visited || second.visited || first.type === second.type) return false;
  [first.type, second.type] = [second.type, first.type];
  const firstName = NODE_TYPES[first.type].name, secondName = NODE_TYPES[second.type].name;
  S.routeRally = null;
  notice('🙌', 'ROUTE REASSIGNED', `The First Sergeant swapped the encounter types of two reachable stops: ${firstName} and ${secondName}.`);
  log('Route Reassignment', `Swapped stop ${ot + 1} option ${oi + 1} with stop ${t + 1} option ${i + 1}`);
});
act('bossStart', () => { if (!S.bossReady || S.phase !== 'map') return false; startBoss(); });
act('waypoint', key => takeWaypoint(key));
act('collapse', () => { S.wp = null; S.cur = null; S.inject = null; S.actor = null; S.votes = {}; S.phase = 'map'; S.bossReady = true; log('Captain Russell', 'Skipped the remaining stops for time; the IG is ready on the route map'); if (!S.leveled) S.leveled = true; });
act('choose', a => choose(+a));
act('timer', a => { S.timer = +a ? { end: Date.now() + (+a) * 1000, label: S.cur && S.cur.step === 'stars' ? 'ACT IT OUT' : 'DECIDE' } : null; });
act('roller', a => { if (isOut(S, +a)) return false; S.cur.roller = +a; S.cur.rollerLocked = true; S.votes = {}; sfx('click'); });
act('lead', a => { S.cur.lead = +a; });
act('resolveRoll', () => { if (!S.cur.rollerLocked) return false; resolveRoll(S.cur.roller, {}); });
act('stars', a => rateStars(+a, S.cur.lead ?? S.tokenHolder));
act('perkUse', i => usePerk(+i));
act('perkReset', i => { delete S.flags['perkUsed_' + S.party[+i].perk]; });
act('tackleRoller', i => { if (!S.inject || S.inject.stage !== 'tackle' || isOut(S, +i)) return false; S.inject.roller = +i; S.inject.rollerLocked = true; S.votes = {}; setActor('tackle', +i); sfx('click'); });
act('fumble', () => spinFumble());
act('lootd4', () => { doneActor('lootd4'); if (S.cur) { S.cur.lootRoll = false; S.cur.lootEarned = true; } spinLoot(); });
act('loot', () => spinLoot());
act('nodeDone', () => { if (S.cur && S.cur.type !== 'crisisEvent' && crisisNow('node')) return; afterNode(); });
act('restMeter', k => {
  if (!METER[k]) return false;
  const less = ccHook('restLess')[0];
  const mainGain = (isPreIGRest() ? Math.ceil(DIFFICULTY.restMain / 2) : DIFFICULTY.restMain) - (less ? 1 : 0);
  applyEff({ [k]: mainGain, why: 'Rest Stop' });
  if (less) ccReact(less, `Rest Stop: ${METER[k].label} +${mainGain} instead of +${DIFFICULTY.restMain}`);
  S.cur.step = 'done'; S.cur.result = `Rested: +${mainGain} ${METER[k].label}`;
});
act('restRecharge', i => { const p = S.party[+i]; if (isPreIGRest() || !p || p.fired || !p.used) return false; p.used = 0; S.cur.step = 'done'; S.cur.result = `${cadetName(+i)}'s ability recharged`; toast('🔋', 'RECHARGED', cadetName(+i)); log('Rest Stop', 'Ability recharged'); });
act('restLoy', () => {
  const eligible = S.npcs.filter(n => !n.gone);
  const preIG = isPreIGRest();
  const recipients = preIG ? eligible.slice().sort((a, b) => a.loy - b.loy).slice(0, Math.ceil(eligible.length / 2)) : eligible;
  recipients.forEach(n => changeLoy(n.slot, 1)); traitCare();
  const result = preIG ? `Time Crunch: +1 loyalty for the ${recipients.length} lowest-loyalty Unit members` : '+1 loyalty for the whole Unit';
  S.cur.step = 'done'; S.cur.result = result; log('Rest Stop', result);
});
act('spinMystery', () => {
  const c = S.cur;
  if (!c || c.step !== 'spin') return false;
  doneActor('mystery');
  c.mystery = rnd(MYSTERY.length);
  showDie(6, c.mystery + 1, `UNKNOWN TERRITORY · d6${byWho()}`, `➜ ${MYSTERY[c.mystery].name}`, MYSTERY_TABLE());
  c.step = 'revealed'; log('Unknown node', MYSTERY[c.mystery].name);
});
function isFreeLoot(c) { return !!(c && c.type === 'depot' && (c.freeLoot || c.result === 'Free loot!')); }
act('mysteryGo', () => {
  if (S.phase !== 'node' || !S.cur || S.cur.type !== 'unknown' || S.cur.step !== 'revealed' || !MYSTERY[S.cur.mystery]) return false;
  const id = MYSTERY[S.cur.mystery].id;
  if (id === 'crisis' || id === 'elite') return enterNode(id);
  if (id === 'rest' || id === 'depot') return enterNode(id);
  if (id === 'wing') { S.votes = {}; snapBase(); S.cur = { type: 'crisis', wing: true, step: 'brief', choice: null, intel: false }; sfx('start'); return; }
  if (id === 'loot') { S.cur = { type: 'depot', freeLoot: true, step: 'done', result: 'Free loot!', lootEarned: true }; assignPending(); return; }
});
act('spinTrigger', () => spinTrigger());
act('spinMurphy', () => spinMurphy());
act('applyInject', a => applyInject(+a));
act('closeInject', () => closeInject());
act('confirmLevel', () => {
  S.party.forEach(p => {
    if (p.fired) return;
    const u = upOf(p);
    if (u.now) applyEff({ ...u.now, why: u.name });
    if (p.up === 'council') S.npcs.forEach(n => changeLoy(n.slot, 1));
    if (p.up === 'wingman') { const n = S.npcs.filter(n => !n.gone).sort((a, b) => a.loy - b.loy)[0]; if (n) changeLoy(n.slot, 2); }
  });
  S.leveled = true; log('Level up', S.party.map(p => `${p.name}: ${upOf(p).name}`).join('; '));
  emit('levelDone'); sfx('level'); advance();
});
act('bossNext', () => { if (bossNext() === false) return false; });
act('gmNext', () => {
  const q = S.gmNext; if (!q || !q.ready) return false;
  q.steps.shift(); q.animations?.shift(); emit('gmNext');
  if (q.steps.length) {
    q.ready = false; S.spinUntil = Date.now() + q.steps[0];
    armGMNext(q);
  } else {
    if (q.after === 'integrity') {
      S.gmNext = null; S.spinUntil = 0;
      gameOver(S.boss.integrityReasons, 'integrity', true); return;
    }
    if (q.after === 'hotseat') {
      const Bs = S.boss, eligible = S.party.map((p, i) => i).filter(i => !S.party[i].fired);
      const lowest = eligible.slice().sort((a, b) => (Bs.p2.rolls[a] - Bs.p2.rolls[b]) || (Math.random() - 0.5))[0];
      Bs.p2.who = [lowest];
      bossLog(`🎲 Hot seat: ${cadetName(lowest)} rolled lowest (${Bs.p2.rolls[lowest]}) and faces the interview.`);
    }
    S.gmNext = null; S.spinUntil = 0;
    // One click dismisses the completed hit and starts the next opening/support action.
    // Do not return to a second, identical result pane between attacks.
    if (S.phase === 'boss' && S.boss?.stage === 'opening') { bossNext(); return; }
    if (S.phase === 'boss' && S.boss?.stage === 'vouch') { bossVouchNext(); return; }
    if (S.phase === 'boss' && S.boss?.stage === 'auditResult') { bossNext(); return; }
    if (S.phase === 'boss' && S.boss?.stage === 'resolved') { bossNext(); return; }
    // Dismissing the Unknown Territory result also enters its revealed stop.
    // Otherwise the same reveal remains on screen with a second Continue button.
    if (S.phase === 'node' && S.cur?.type === 'unknown' && S.cur.step === 'revealed') ACT.mysteryGo();
  }
});
act('bossVouchNext', () => { if (bossVouchNext() === false) return false; });
act('bossStar', a => { const [j, n] = a.split(',').map(Number); const b = S.boss; if (!b || b.stage !== 'hotseat' || !b.p2.who || b.p2.done || !Number.isInteger(j) || j < 0 || j >= b.p2.who.length || ![1, 2, 3].includes(n)) return false; b.p2.stars[j] = n; });
act('hotSeat', i => bossHotSeat(Number(i)));
act('bossStarsDone', () => bossStarsDone());
act('bossResolve', () => { if (bossResolve() === false) return false; });
act('bossAction', type => { if (!S.boss || S.boss.stage !== 'act' || !['press', 'defend'].includes(type)) return false; S.boss.teamAction = type; });
act('finish', () => finishGame());
act('saveBoard', () => { saveToBoard(); S.showBoard = true; sfx('ach'); });
act('toDebrief', () => { S.party.forEach((p, i) => { if (!S.grades[i]) S.grades[i] = defaultGrade(); }); S.phase = 'debrief'; S.showBoard = false; S.timer = null; S.banner = null; emit('powerdown'); });
act('showGrade', i => { const g = S.grades[+i] = S.grades[+i] || defaultGrade(); g.shown = !g.shown; });
act('dview', v => { S.debrief.view = v; S.debrief.spot = null; });
act('spot', i => { S.debrief.spot = S.debrief.spot === +i ? null : +i; S.debrief.view = 'timeline'; });
act('saveGrades', () => {
  if (S.practice || IS_BOSS_PRACTICE) return false;
  const all = loadGrades(), u = UNITS.find(x => x.id === S.unit);
  S.party.forEach((p, i) => { const g = S.grades[i] || defaultGrade();
    all.push({ date: new Date().toISOString(), callsign: S.callsign, unit: u ? u.name : '', cadet: p.name, cls: CLASS[p.cls].name, reflection: +g.ref, engagement: +g.eng, concepts: +g.con, total: (+g.ref) + (+g.eng) + (+g.con), notes: g.notes, gameGrade: S.final ? S.final.grade.g : '', gameScore: S.final ? S.final.total : '' }); });
  localStorage.setItem('sq_grades', JSON.stringify(all)); S.gradesSaved = true;
});
act('exportCSV', () => {
  const rows = loadGrades(); if (!rows.length) { alert('No saved grades yet.'); return false; }
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
  download('practicum-adventure-grades.csv', csv, 'text/csv'); return false;
});
act('exportBoard', () => { download('practicum-adventure-backup.json', JSON.stringify({ leaderboard: loadBoard(), grades: loadGrades() }, null, 2), 'application/json'); return false; });
act('clearBoard', () => { if (!confirm('Delete every leaderboard entry? Export a backup first.')) return false; saveBoard([]); });
act('meter', a => { const [k, v] = a.split(','); applyEff({ [k]: +v, why: 'Captain Russell adjustment' }); });
act('loy', a => { const [s, v] = a.split(','); changeLoy(s, +v); log('Captain Russell adjustment', `${npcLabel(S, s)} loyalty ${sign(+v)}`); });
act('reveal', s => reveal(s));
act('ability', i => useAbility(+i));
act('item', k => useItem(+k));
act('discard', k => { S.items.splice(+k, 1); });
act('card', id => playCard(id));
act('clearBanner', () => { S.banner = null; });
act('achToggle', id => { if (S.ach.includes(id)) S.ach = S.ach.filter(x => x !== id); else award(id); });

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/* inputs that update state without a full action */
function onInput(e) {
  const el = e.target, k = el.dataset.inp; if (!k) return;
  const a = el.dataset.arg;
  if (k === 'pup' && S.party[+a] && S.party[+a].fired) return;
  const live = e.type === 'input';
  switch (k) {
    case 'practiceUnit': if (IS_BOSS_PRACTICE && UNITS.some(u => u.id === el.value)) S.practiceConfig.unit = el.value; save(); return;
    case 'practicePreset': if (IS_BOSS_PRACTICE && BOSS_PRACTICE_PRESETS[el.value]) S.practiceConfig.preset = el.value; save(); return;
    case 'practiceExact': if (IS_BOSS_PRACTICE) S.practiceConfig.exact = el.checked; save(); return;
    // typed fields update quietly (no GM re-render) so a click on a button right
    // after typing isn't swallowed by the DOM being rebuilt underneath it
    case 'pname': S.party[+a].name = el.value; if (!live) push(true); else save(); return;
    case 'callsign': S.callsign = el.value; if (!live) push(true); else save(); return;
    case 'site': localStorage.setItem('sq_site', el.value.trim()); if (!live) push(true); return;
    case 'gnote': S.grades[+a] = S.grades[+a] || defaultGrade(); S.grades[+a].notes = el.value; S.gradesSaved = false; if (!live) push(true); else save(); return;
  }
  if (live && k !== 'grade') return;
  snap();
  switch (k) {
    case 'pcls': S.party[+a].cls = el.value; S.party[+a].perk = ''; break;
    case 'pperk': S.party[+a].perk = el.value; break;
    case 'pup': S.party[+a].up = el.value; break;
    case 'puni': S.party[+a].uni = el.value; break;
    case 'phair': S.party[+a].hair = el.value; break;
    case 'grade': { const [i, f] = a.split(','); S.grades[+i] = S.grades[+i] || defaultGrade(); S.grades[+i][f] = +el.value; S.gradesSaved = false; if (live) { save(); el.nextElementSibling.textContent = el.value; return; } break; }
  }
  push();
}

function initGM() {
  document.body.className = 'gm';
  S = newState();
  if (IS_BOSS_PRACTICE) startBossPractice();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    run(b.dataset.act, b.dataset.arg, b);
  });
  document.addEventListener('change', onInput);
  document.addEventListener('input', onInput);
  document.addEventListener('change', e => {
    if (e.target.id !== 'importFile') return;
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      try {
        const d = JSON.parse(t);
        if (d.leaderboard) { const merged = loadBoard().concat(d.leaderboard.filter(x => !loadBoard().some(y => y.date === x.date))); saveBoard(merged); if (typeof cloudSync === 'function') cloudSync(); }
        if (d.grades) { const g = loadGrades(); localStorage.setItem('sq_grades', JSON.stringify(g.concat(d.grades.filter(x => !g.some(y => y.date === x.date && y.cadet === x.cadet))))); }
        alert('Imported.'); push();
      } catch (err) { alert('Could not read that file.'); }
    });
  });
  window.addEventListener('message', e => {
    if (e.data?.type === 'diceSettled' && e.origin === location.origin && e.source === playerWin) { acknowledgeDice(e.data.animationId); return; }
    if (e.data && e.data.type === 'beginBriefing' && e.origin === location.origin && S.phase === 'welcome') { run('beginBriefing'); return; }
    if (!e.data || e.data.type !== 'hello') return;
    projectorSeenAt = Date.now();
    const fresh = e.source && e.source !== playerWin;
    if (e.source) playerWin = e.source;
    if (fresh || e.data.need) push(!fresh);
  });
  if (bc) bc.onmessage = e => {
    if (e.data?.type === 'hello') projectorSeenAt = Date.now();
    if (e.data?.type === 'diceSettled') acknowledgeDice(e.data.animationId);
    else if (e.data && e.data.type === 'beginBriefing' && S.phase === 'welcome') run('beginBriefing');
    else if (e.data && e.data.type === 'hello' && e.data.need) push(true);
  };
  setInterval(() => { if (S.timer && Date.now() > S.timer.end + 3000) { S.timer = null; push(); } }, 1000);
  if (typeof netStart === 'function') netStart();
  if (typeof cloudStart === 'function') cloudStart(); // shared leaderboard (cloud.js)
  push();
}

// One codebase, four pages: GM console (index.html), projector (index.html#player),
// cadet phone (join.html, data-mode="phone") and the field guide (guide.html).
window.addEventListener('load', () => {
  const mode = document.body.dataset.mode;
  if (mode === 'phone') return initPhone();
  if (mode === 'guide') return initGuide();
  if (IS_PLAYER) initPlayer(); else initGM();
});
