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
const WHEEL_MS = 4300;
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
function presetAvatar(i) {
  if (_pav[i]) return _pav[i];
  const a = AVATARS[i] || AVATARS[0];
  const c = document.createElement('canvas'); c.width = c.height = 12;
  const x = c.getContext('2d'), R = (col, px, py, w, h) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  R(`hsl(${i * 47 % 360},40%,22%)`, 0, 0, 12, 12);
  R(a.shirt, 1, 10, 10, 2); R('#ffd23f', 3, 10, 1, 1);                 // uniform + rank
  R(a.skin, 3, 3, 6, 7); R(a.skin, 2, 5, 1, 2); R(a.skin, 9, 5, 1, 2);   // head + ears
  if (a.style === 'short') { R(a.hair, 3, 2, 6, 2); R(a.hair, 2, 3, 1, 2); R(a.hair, 9, 3, 1, 2); }
  if (a.style === 'buzz') R(a.hair, 3, 2, 6, 1);
  if (a.style === 'long') { R(a.hair, 3, 2, 6, 2); R(a.hair, 2, 3, 1, 6); R(a.hair, 9, 3, 1, 6); }
  if (a.style === 'bun') { R(a.hair, 3, 2, 6, 2); R(a.hair, 5, 0, 2, 2); }
  if (a.style === 'puff') { R(a.hair, 2, 0, 8, 3); R(a.hair, 1, 1, 1, 3); R(a.hair, 10, 1, 1, 3); }
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
    case 'robot': R('#9aa4b1', 3, 3, 6, 7); R('#ff2e63', 4, 6, 1, 1); R('#ff2e63', 7, 6, 1, 1); R('#9aa4b1', 5, 0, 2, 3); R('#555', 4, 8, 4, 1); break;
  }
  return (_pav[i] = c.toDataURL());
}
function avatarOf(p) { return p && p.av != null ? presetAvatar(p.av) : avatar(p ? p.name : '?'); }

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
// A cadet's in-game name: the rank that goes with their class + their name ("Capt Helle").
function rankName(p) {
  if (!p) return '';
  const c = p.cls && CLASS[p.cls];
  return c && p.name ? `${c.rank} ${p.name}` : (p.name || '');
}
function npcOf(S, s) { return (S.npcs || []).find(n => n.slot === s); }
function npcLabel(S, s) { const n = npcOf(S, s); return n ? `${n.rank} ${n.name}` : `[${s}]`; }
function fill(S, t) { return String(t || '').replace(/\{([ABCD])\}/g, (_, s) => npcLabel(S, s)).replace(/\{CC\}/g, S.cc || 'the CC'); }
// A meter icon as a coloured, labelled tag: "❤️ Morale" in the meter's colour.
function meterTag(k) { const m = METER[k]; return `<span class="mtag" style="--c:${m.color}">${m.icon} ${m.label}</span>`; }
// Labels every bare meter icon in a piece of (already escaped) HTML. Skips ⭐ used
// as a star rating ("3⭐", "⭐⭐⭐") so ratings never read as "Trust".
const METER_ICON_RE = /(?<![\d⭐])(🎯|❤️|⭐|📦)(?!⭐)/gu;
function mt(html) {
  return String(html ?? '').replace(METER_ICON_RE, ic => { const m = METERS.find(x => x.icon === ic); return m ? meterTag(m.k) : ic; });
}
// returns HTML: labelled meter + green up-arrows / red down-arrows
function arrows(show) {
  return (show || []).map(([k, n]) => `<span class="arw">${meterTag(k)}${n === '?' ? '❔' : `<span class="${n > 0 ? 'up' : 'dn'}">${(n > 0 ? '▲' : '▼').repeat(Math.abs(n))}</span>`}</span>`).join(' ');
}
// escapes text, colours +N green and -N red, and labels meter icons
function effHtml(t) { return mt(esc(t).replace(/([+−-]\d+)/g, m => `<span class="${m[0] === '+' ? 'up' : 'dn'}">${m}</span>`)); }
function effText(S, e) {
  if (!e) return 'no change';
  const out = [];
  if (e.set) for (const k in e.set) out.push(`${METER[k].icon} set to ${e.set[k]}`);
  for (const m of METERS) if (e[m.k]) out.push(`${m.icon}${sign(e[m.k])}`);
  if (e.loy) for (const s in e.loy) out.push(`${npcLabel(S, s)} loyalty ${sign(e.loy[s])}`);
  if (e.traitLoy) out.push(`${TRAIT[e.traitLoy.trait].name} NPCs loyalty ${sign(e.traitLoy.d)}`);
  if (e.traitAny) out.push(`if ${e.traitAny.slot ? npcLabel(S, e.traitAny.slot) + ' is ' : 'any NPC is '}${(e.traitAny.traits || [e.traitAny.trait]).map(t => TRAIT[t].name).join('/')}: ${effText(S, e.traitAny.eff)}`);
  if (e.reveal) out.push(`reveals ${npcLabel(S, e.reveal)}'s trait`);
  if (e.next) out.push(`next node: ${effText(S, e.next)}`);
  if (e.flag) out.push(`flag ${e.flag}`);
  if (e.ach) out.push(`🏅 ${ACH[e.ach].name}`);
  if (e.why) out.push(`(${e.why})`);
  return out.join(', ') || 'no change';
}
function statLabel(st) { return st === 'LOYB' ? 'd20 + A1C loyalty' : st ? st : 'plain d20'; }
function specText(S, ch) {
  if (ch.ifClass) {
    const names = ch.ifClass.cls.map(c => CLASS[c].name).join(' or ');
    return `If the party has ${names}: ${specText(S, { ...ch, ifClass: null, ...normal(ch.ifClass.then) })} · Otherwise: ${specText(S, { ...ch, ifClass: null, ...normal(ch.ifClass.else) })}`;
  }
  const parts = [];
  if (ch.pre) parts.push(`On choosing: ${effText(S, ch.pre)}`);
  if (ch.kind === 'fx') parts.push(effText(S, ch.eff));
  if (ch.kind === 'check') parts.push(`${statLabel(ch.check.stat)} vs ${ch.check.dc} · PASS: ${effText(S, ch.check.pass)} · FAIL: ${effText(S, ch.check.fail)}`);
  if (ch.kind === 'stars') parts.push(ch.stars.map((e, i) => `${i + 1}★ ${effText(S, e)}`).join(' · '));
  return parts.join(' · ');
}
function normal(sub) { return { kind: sub.kind || 'fx', eff: sub.eff, check: sub.check }; }

/* ---------------- scoring ---------------- */
function computeScore(S) {
  const vals = METERS.map(m => S.meters[m.k]);
  const sum = vals.reduce((a, b) => a + b, 0), low = Math.min(...vals);
  const allies = (S.npcs || []).filter(n => isAlly(n)).length;
  const unused = (S.items || []).length + Object.values(S.lt || {}).filter(Boolean).length;
  const parts = [
    ['Meters total ×3', sum * 3],
    ['Lowest meter ×10 (balance)', low * 10],
    ['Inspection result', S.bossBonus || 0],
    ['🎤 stars ×5', (S.starsTotal || 0) * 5],
    ['Achievements ×10', (S.ach || []).length * 10],
    ['NPC Allies ×5', allies * 5],
    ['Unused items & tokens ×5', unused * 5],
  ];
  return { parts, total: parts.reduce((a, p) => a + p[1], 0) };
}
function gradeFor(S, total) {
  if (S.gameOver) return { g: 'F', title: 'GAME OVER', strat: GAME_OVER_TEXT, color: '#ff3b5c' };
  return GRADES.find(g => total >= g.min);
}
function isAlly(n) { return n.loy >= 5 || (n.trait === 'cynic' && n.revealed && n.loy >= 4); }

/* ---------------- leaderboard storage ---------------- */
function loadBoard() { try { return JSON.parse(localStorage.getItem('sq_leaderboard') || '[]'); } catch (e) { return []; } }
function saveBoard(b) { try { localStorage.setItem('sq_leaderboard', JSON.stringify(b)); } catch (e) { } }
function sortBoard(b) { return b.slice().sort((x, y) => (x.gameOver - y.gameOver) || (y.score - x.score) || (y.low - x.low) || (y.stars - x.stars)); }
/* NPC roster: the built-in lists in data.js, unless the GM saved an override
   in this browser (handy for a different class without re-uploading). */
function getRoster() {
  try {
    const r = JSON.parse(localStorage.getItem('sq_roster') || 'null');
    if (r && r.upper && r.upper.length >= 3 && r.lower && r.lower.length >= 2) return r;
  } catch (e) { }
  return { upper: POOL_UPPER, lower: POOL_LOWER, builtin: true };
}
function parseNames(t) { return String(t || '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean); }
function loadGrades() { try { return JSON.parse(localStorage.getItem('sq_grades') || '[]'); } catch (e) { return []; } }

/* =====================================================================
   GM ENGINE
   ===================================================================== */
let S = null;
let hist = [];
let FX = [];
let playerWin = null;
let fxSeq = 0;
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('practicum-adventure') : null;

function newState() {
  return {
    phase: 'title', introPage: 0, party: [0, 1, 2, 3].map(() => ({ name: '', cls: '', perk: '', up: '', used: 0, av: null })),
    tokenHolder: 0, unit: null, npcs: [], cc: '', meters: { mis: 5, mor: 5, tru: 5, res: 5 },
    lt: { pause: true, intel: true, waiver: true }, items: [], flags: {}, ach: [], starsTotal: 0,
    micCount: 0, micLow: false, crisesSurvived: 0, crisisQueue: [], pendingNext: [], usedMissions: [],
    map: null, pos: { tier: -1, idx: null }, cur: null, inject: null, boss: null,
    gmCards: shuffle(GM_CARDS.map(c => c.id)).slice(0, 3), gmUsed: [], dcMod: 0, banner: null, timer: null,
    log: [], offline: null, offlineNext: null, forecast: null, reveals: 0, lastTruLoss: 0,
    leveled: false, levelPending: false, gameOver: false, gameOverReasons: [], bossBonus: 0, callsign: '',
    saved: false, debrief: { view: 'decoder', spot: null }, grades: {}, showBoard: false, muted: false,
    skipInject: false, beenThereUsed: false, contingency: false, pending: { coffee: false, sticky: false },
    spinUntil: 0, nodeCount: 0, final: null, wheel: null,
  };
}

/* ---- sync ---- */
// The title screen is never saved, so opening the console can't overwrite the run you want to resume.
function save() { if (S.phase === 'title') return; try { localStorage.setItem('sq_run', JSON.stringify(S)); } catch (e) { } }
function push(quiet) {
  save();
  const fx = FX.map(f => ({ ...f, id: Date.now() + '-' + (++fxSeq) }));
  FX = [];
  const join = typeof roomCode === 'function' ? { code: roomCode(), url: joinUrl(), live: NET.status === 'live' } : null;
  const msg = { type: 'state', S, fx, board: sortBoard(loadBoard()), join };
  try { if (playerWin && !playerWin.closed) playerWin.postMessage(msg, '*'); } catch (e) { }
  try { bc && bc.postMessage(msg); } catch (e) { }
  if (typeof netBroadcast === 'function') netBroadcast();
  if (!quiet) renderGM();
}
// when a wheel/die animation finishes: unlock the GM buttons and tell phones
function afterSpin() { renderGM(); if (typeof netBroadcast === 'function') netBroadcast(); }
function snap() { hist.push(JSON.stringify(S)); if (hist.length > 60) hist.shift(); }
function emit(k, data = {}) { FX.push({ k, ...data }); }
function sfx(n) { emit('sfx', { n }); }
function toast(icon, title, text) { emit('toast', { icon, title, text }); }
function log(t, d = '') { S.log.push({ n: S.nodeCount, t, d }); }
function spinning() { return Date.now() < S.spinUntil; }
function spinWheel(title, slices, idx, hold) {
  S.spinUntil = Date.now() + WHEEL_MS;
  S.wheel = { title, slices, idx };
  emit('wheel', { title, slices, idx, hold: !!hold });
  setTimeout(afterSpin, WHEEL_MS + 60);
}

/* ---- digital dice: the GM rolls, the projector animates the die ---- */
const DICE_MS = 2800;
function showDie(sides, v, title, result) {
  S.spinUntil = Math.max(S.spinUntil, Date.now() + DICE_MS);
  emit('dice', { sides, v, title, result });
  setTimeout(afterSpin, DICE_MS + 60);
}
function rollDie(sides, title, describe) {
  const v = 1 + rnd(sides);
  showDie(sides, v, title, describe ? describe(v) : '');
  return v;
}

/* ---- queries ---- */
const party = () => S.party.filter(p => p.name.trim());
const hasPerk = p => S.party.some(c => c.name && c.perk === p);
const hasUp = u => S.party.some(c => c.name && c.up === u);
const hasClass = id => S.party.some(c => c.name && c.cls === id);
const unitQ = () => (S.unit ? UNITS.find(u => u.id === S.unit).q : '');
const npc = s => S.npcs.find(n => n.slot === s);
const fcIdx = () => S.party.findIndex(c => c.cls === 'fc');
const cadetName = i => (S.party[i] ? rankName(S.party[i]) : '?');
function curMission() {
  const c = S.cur; if (!c) return null;
  if (c.type === 'crisisEvent') return { title: CRISES[c.meter].title, icon: CRISES[c.meter].icon, sob: 'CRISIS EVENT', text: CRISES[c.meter].text, choices: CRISES[c.meter].choices };
  if (c.wing) return WING_VISIT;
  return MISSIONS.find(m => m.id === c.mid);
}

/* ---- effects ---- */
function applyEff(e, opt = {}) {
  if (!e) return;
  const d = [];
  if (e.set) for (const k in e.set) { const old = S.meters[k]; S.meters[k] = e.set[k]; if (old !== e.set[k]) d.push([k, e.set[k] - old]); }
  for (const m of METERS) {
    let v = e[m.k]; if (!v) continue; const k = m.k;
    if (v > 0) {
      if (opt.double) v *= 2;
      if (k === 'res' && unitQ() === 'wallet') v = Math.max(0, v - 1);
      if (k === 'mor' && unitQ() === 'people') v += 1;
    } else {
      if (k === 'res' && hasUp('efficiency')) v = Math.min(-1, v + 1);
      if (k === 'mor' && hasUp('engine')) v = Math.max(v, -2);
      if (k === 'tru' && opt.late && unitQ() === 'late') v *= 2;
    }
    const old = S.meters[k];
    let nv = Math.max(0, Math.min(10, old + v));
    if (k === 'res' && hasPerk('hoarder') && old >= 2) nv = Math.max(nv, 2);
    S.meters[k] = nv;
    if (nv !== old) d.push([k, nv - old]);
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
  if (e.ach) award(e.ach);
  if (e.next) S.pendingNext.push(e.next);
  if (d.length) { emit('deltas', { d }); log('Meters', d.map(([k, v]) => METER[k].icon + sign(v)).join(' ') + (e.why ? ` (${e.why})` : '')); }
  checkZero();
}
function changeLoy(s, v) {
  const n = npc(s); if (!n || !v) return;
  const old = n.loy, wasAlly = isAlly(n);
  n.loy = Math.max(0, Math.min(5, n.loy + v));
  if (n.loy !== old) emit('loyDelta', { who: `${n.rank} ${n.name}`, v: n.loy - old });
  if (n.loy === 0 && old > 0 && !n.broken) breaking(n);
  if (!wasAlly && isAlly(n)) { toast('🤝', 'NEW ALLY', `${n.rank} ${n.name} is now an Ally`); sfx('loot'); }
}
function breaking(n) {
  const t = TRAIT[n.trait];
  n.broken = true; S.flags.npcZero = true;
  if (!n.revealed) { n.revealed = true; S.reveals++; }
  emit('big', { cls: 'bad', title: 'BREAKING POINT', icon: t.icon, text: `${n.rank} ${n.name} (${t.name}): ${t.bpText}` });
  sfx('bad');
  log('Breaking point', `${n.rank} ${n.name}: ${t.bpText}`);
  const { out, flag, ...m } = t.bp;
  if (out) n.out = out;
  if (flag) S.flags[flag] = true;
  applyEff(m);
}
function reveal(s) {
  const n = npc(s); if (!n || n.revealed) return;
  n.revealed = true; S.reveals++;
  const t = TRAIT[n.trait];
  toast(t.icon, 'HIDDEN TRAIT REVEALED', `${n.rank} ${n.name}: ${t.name}. ${t.what}`);
  log('Trait revealed', `${n.rank} ${n.name}: ${t.name}`);
  if (S.reveals >= 2) award('opendoor');
}
function award(id) {
  if (S.ach.includes(id)) return;
  S.ach.push(id);
  emit('ach', { aid: id }); log('Achievement', ACH[id].name); // not 'id': push() stamps every fx with its own id
}
function checkZero() {
  for (const m of METERS) {
    if (S.meters[m.k] === 0 && !S.crisisQueue.includes(m.k)) {
      S.crisisQueue.push(m.k);
      emit('big', { cls: 'bad', title: 'CRISIS INCOMING', icon: '🚨', text: `${m.name} hit zero! A Crisis Event will strike before the next node.` });
      sfx('alarm');
      log('Crisis queued', m.name + ' hit 0');
    }
  }
}

/* ---- rolls ---- */
function statOf(i, stat) {
  const c = S.party[i]; if (!c || !c.cls) return 0;
  let v = CLASS[c.cls].stats[stat] || 0;
  if (c.up === 'battle' && (stat === 'CMD' || stat === 'GRIT')) v += 1;
  return v;
}
function rollCalc(check, roller, d20, o = {}) {
  const parts = []; let total = d20;
  if (check.stat === 'LOYB') { const n = npc('B'); parts.push([`${n.rank} ${n.name} loyalty`, n.loy]); total += n.loy; }
  else if (check.stat) {
    let sv = statOf(roller, check.stat), lbl = `${cadetName(roller)} ${check.stat}`;
    if (o.typ && check.stat === 'CMD' && fcIdx() >= 0) { const f = statOf(fcIdx(), 'CMD'); if (f > sv) { sv = f; lbl = 'CMD (Trust Your People)'; } }
    parts.push([lbl, sv]); total += sv;
    if (check.stat === 'CHA' && S.party[roller] && S.party[roller].perk === 'silver') { parts.push(['Silver Tongue', 2]); total += 2; }
  }
  const mv = S.meters[check.m];
  if (mv >= 8) { parts.push([`${METER[check.m].icon} high`, 2]); total += 2; }
  else if (mv <= 2) { parts.push([`${METER[check.m].icon} low`, -2]); total -= 2; }
  if (check.m === 'mis' && hasPerk('lff')) { parts.push(['Lead From the Front', 1]); total += 1; }
  if (o.coffee) { parts.push(['☕ Coffee', 2]); total += 2; }
  let dc = check.dc;
  if (check.m === 'mis' && ['hardmis', 'people'].includes(unitQ())) dc = Math.max(dc, 16);
  if (S.cur && S.cur.type === 'elite') dc += 3;
  dc += S.dcMod || 0;
  const nat = d20 === 20 ? 20 : d20 === 1 ? 1 : 0;
  const pass = nat === 20 || (nat !== 1 && total >= dc);
  return { total, parts, dc, pass, nat, d20 };
}

/* ---- map ---- */
// A single fixed path of 6 stops, then the boss. Kept in the tier/link shape
// the rest of the code walks, just one node per tier. Stops 1, 3 and 6 are
// always missions, so every run gets at least 3 real leadership decisions.
const LEVEL_AFTER = 3; // everyone levels up after this stop
function genMap() {
  const weighted = bag => {
    let r = Math.random() * bag.reduce((a, b) => a + b[1], 0);
    for (const [k, w] of bag) { if ((r -= w) < 0) return k; }
    return bag[0][0];
  };
  const types = [
    'crisis',
    weighted([['crisis', 30], ['unknown', 25], ['rest', 25], ['depot', 20]]),
    'crisis',
    weighted([['crisis', 40], ['elite', 30], ['unknown', 30]]),
    weighted([['rest', 35], ['depot', 30], ['crisis', 35]]),
    weighted([['crisis', 50], ['elite', 50]]),
  ];
  const tiers = types.map(type => [{ type, mystery: type === 'unknown' ? rnd(MYSTERY.length) : null, done: false }]);
  return { tiers, links: tiers.map(() => [[0]]) };
}
const lastTier = () => (S.map ? S.map.tiers.length - 1 : 0);
function available() {
  if (!S.map) return [];
  if (S.pos.tier === -1) return S.map.tiers[0].map((_, i) => [0, i]);
  if (S.pos.tier >= lastTier()) return [];
  return S.map.links[S.pos.tier][S.pos.idx].map(i => [S.pos.tier + 1, i]);
}

/* ---- flow ---- */
function startRun() {
  const keepBoard = S && S.muted;
  S = newState(); S.muted = !!keepBoard; hist = [];
  S.phase = 'intro'; S.introPage = 0;
  if (typeof netStop === 'function') netStop(); // last party's phones drop off; the new party joins fresh
}
function lockParty() {
  const p = party();
  if (p.length < 2) return 'Enter at least 2 cadets.';
  if (p.some(c => !c.cls)) return 'Every cadet needs a class.';
  const cls = p.map(c => c.cls);
  if (new Set(cls).size !== cls.length) return 'No duplicate classes.';
  if (!cls.includes('fc')) return 'Someone must be the Flight Commander.';
  S.party = p.map(c => ({ ...c, perk: '' })); // perks are a surprise: revealed on the next screen
  S.tokenHolder = fcIdx();
  S.phase = 'perks';
  log('Classes locked', p.map(c => `${c.name} (${CLASS[c.cls].name})`).join('; '));
  return '';
}
function lockPerks() {
  if (S.party.some(c => !c.perk)) return 'Every cadet needs a perk.';
  S.phase = 'avatars';
  log('Perks locked', S.party.map(c => `${c.name}: ${perkOf(c).name}`).join('; '));
  return '';
}
function perkOf(c) { return CLASS[c.cls].perks.find(p => p.id === c.perk) || { name: '-' }; }
function upOf(c) { return CLASS[c.cls].ups.find(p => p.id === c.up) || { name: '-' }; }
function rollUnit() {
  const v = rollDie(6, 'ROLL FOR YOUR SQUADRON · d6', n => `${UNITS[n - 1].icon} ${UNITS[n - 1].name}`);
  const u = UNITS[v - 1];
  S.unit = u.id;
  S.meters = { ...u.start };
  const taken = S.party.map(c => c.name.toLowerCase());
  const ok = n => !taken.some(t => t.split(/[\s,]+/).includes(n.toLowerCase()));
  const R = getRoster();
  const lower = shuffle(R.lower.filter(ok)), upper = shuffle(R.upper.filter(ok));
  const traits = shuffle(TRAITS.map(t => t.id));
  S.npcs = SLOTS.map((sl, i) => ({
    slot: sl.s, rank: sl.rank, pub: sl.pub, name: (sl.pool === 'lower' ? lower : upper).shift(),
    trait: traits[i], revealed: false, loy: hasPerk('opendoor') ? 4 : 3, out: 0, broken: false,
  }));
  S.cc = `${u.ccRank} ${upper.shift()}`;
  log('Unit rolled', `${u.name} (${u.sq}); Sq CC ${S.cc}`);
  S.unitRolled = true; // stay on the 'unit' screen until the GM reveals the manifest, so the die isn't spoiled
}
function chooseNode(t, i) {
  S.pos = { tier: t, idx: i };
  const node = S.map.tiers[t][i];
  node.visited = true;
  S.nodeCount++;
  S.offline = S.offlineNext; S.offlineNext = null;
  if (S.offline != null) S.banner = { text: `📵 ${cadetName(S.offline)} IS IN A MEETING: CAN'T SPEAK OR ROLL THIS NODE`, cls: 'blue' };
  log(`Node ${S.nodeCount}: ${NODE_TYPES[node.type].name}`);
  if (S.pendingNext.length) { const pend = S.pendingNext; S.pendingNext = []; pend.forEach(e => applyEff(e)); }
  enterNode(node.type, node);
}
function enterNode(type, node) {
  S.phase = 'node'; S.votes = {};
  if (type === 'crisis' || type === 'elite') {
    const pool = MISSIONS.filter(m => !S.usedMissions.includes(m.id));
    const m = pickOne(pool.length ? pool : MISSIONS);
    S.usedMissions.push(m.id);
    S.cur = { type, mid: m.id, step: 'brief', choice: null, intel: false, swap: null };
    log(`${type === 'elite' ? 'ELITE ' : ''}Mission ${m.id}`, m.title);
    sfx(type === 'elite' ? 'boss' : 'start');
  } else if (type === 'rest' || type === 'depot') {
    S.cur = { type, step: 'choose' };
    if (hasPerk('yearend')) applyEff({ res: 2, why: 'Year-End Money' });
    sfx('good');
  } else if (type === 'unknown') {
    S.cur = { type, step: 'spin', mystery: node ? node.mystery : rnd(MYSTERY.length) };
  }
}
function startCrisisEvent() {
  let k;
  while (S.crisisQueue.length) { k = S.crisisQueue.shift(); if (S.meters[k] === 0) break; k = null; }
  if (!k) return advance();
  S.phase = 'node'; S.votes = {};
  S.cur = { type: 'crisisEvent', meter: k, step: 'brief', choice: null, intel: false };
  emit('flash'); sfx('alarm');
  log('CRISIS EVENT', CRISES[k].title);
}
function choose(i) {
  const m = curMission(), c = S.cur;
  c.preChoice = JSON.stringify(S);
  let effIdx = i;
  if (c.swap && c.swap.includes(i)) effIdx = c.swap[0] === i ? c.swap[1] : c.swap[0];
  const base = m.choices[i], src = m.choices[effIdx];
  let spec = src.ifClass ? { ...src, ...normal(src.ifClass[src.ifClass.cls.some(hasClass) ? 'then' : 'else']) } : { ...src };
  spec.tags = base.tags; spec.mic = src.mic;
  c.choice = i; c.spec = spec;
  S.banner = null;
  sfx('click');
  log(`Choice ${'ABCD'[i]}`, fill(S, base.t) + (effIdx !== i ? ' (PLOT TWIST: effects swapped)' : ''));
  const opt = { double: c.type === 'elite', late: (spec.tags || []).includes('late') };
  applyEff(spec.pre, opt);
  if ((spec.tags || []).includes('idea') && unitQ() === 'idea') applyEff({ tru: 1, why: 'Innovation fan CC' });
  if (spec.kind === 'fx') { applyEff(spec.eff, opt); finishStep(); }
  else if (spec.kind === 'check') { c.step = 'roll'; c.roller = S.tokenHolder; }
  else if (spec.kind === 'stars') { c.step = 'stars'; c.lead = S.tokenHolder; }
}
function finishStep() {
  const c = S.cur; c.step = 'done';
  if (c.type === 'elite') c.lootEarned = true;
  else if (c.type === 'crisis' && !c.lootEarned) {
    if (rollDie(4, 'LOOT CHANCE · d4 (4 = loot)', n => n === 4 ? '🎁 LOOT DROP!' : 'No loot this time') === 4) c.lootEarned = true;
  }
}
function resolveRoll(roller, o) {
  const c = S.cur, spec = c.spec;
  c.preRoll = JSON.stringify(S);
  const d20 = 1 + rnd(20);
  S.spinUntil = Date.now() + 4800; setTimeout(afterSpin, 4860);
  if (o.coffee) { removeItem('coffee'); S.pending.coffee = false; }
  if (o.typ) S.flags.typUsed = true;
  const r = rollCalc(spec.check, roller, d20, o);
  r.roller = roller;
  c.rollRes = r;
  S.dcMod = 0;
  emit('roll', { r, who: spec.check.stat === 'LOYB' ? npcLabel(S, 'B') : cadetName(roller) });
  log(`Roll: ${spec.check.stat === 'LOYB' ? npcLabel(S, 'B') : cadetName(roller)}`, `d20 ${d20} → ${r.total} vs ${r.dc}: ${r.pass ? 'PASS' : 'FAIL'}${r.nat === 20 ? ' (CRIT)' : r.nat === 1 ? ' (FUMBLE)' : ''}`);
  const opt = { double: c.type === 'elite' || r.nat === 20, late: (spec.tags || []).includes('late') };
  applyEff(r.pass ? spec.check.pass : spec.check.fail, opt);
  if (r.nat === 20) { award('crit'); c.lootEarned = true; }
  if (r.nat === 1) c.fumblePending = true;
  if (!r.pass && S.tokenHolder !== fcIdx() && !hasUp('delegator')) applyEff({ tru: -1, why: 'Delegated and it failed: the FLT/CC still owns it' });
  if (S.party[roller] && S.party[roller].up === 'standards') applyEff({ mis: 1, why: 'Standards Bearer' });
  finishStep();
}
function rateStars(n, lead) {
  const c = S.cur, spec = c.spec;
  let st = n, bonus = [];
  if (S.pending.sticky && st < 3) { st++; bonus.push('📝 Sticky Note'); }
  if (S.pending.sticky) { removeItem('sticky'); S.pending.sticky = false; }
  if (S.party[lead] && S.party[lead].perk === 'toughlove' && st < 3) { st++; bonus.push('Tough Love'); }
  c.stars = st; c.lead = lead; c.starBonus = bonus;
  S.starsTotal += st; S.micCount++; if (st < 2) S.micLow = true;
  if (st === 3) award('clearcomms');
  emit('stars', { n: st, who: cadetName(lead) }); sfx('stars');
  log(`🎤 ${cadetName(lead)} led the encounter`, `${st}★${bonus.length ? ' (' + bonus.join(', ') + ')' : ''}`);
  applyEff(spec.stars[st - 1], { double: c.type === 'elite' });
  finishStep();
}
function removeItem(id) { const i = S.items.indexOf(id); if (i >= 0) S.items.splice(i, 1); }
function afterNode(skipTrigger) {
  const c = S.cur;
  S.npcs.forEach(n => { if (n.out > 0) n.out--; });
  S.offline = null; S.banner = null;
  if (S.tokenHolder !== fcIdx() && fcIdx() >= 0) { S.tokenHolder = fcIdx(); log('Command Token', 'returned to the Flight Commander'); }
  if (c && c.type === 'crisisEvent') {
    S.crisesSurvived++; if (S.crisesSurvived >= 2) award('murphy');
    S.cur = null; return advance();
  }
  if (S.map && S.pos.tier >= 0) S.map.tiers[S.pos.tier][S.pos.idx].done = true;
  if (S.pos.tier === LEVEL_AFTER - 1 && !S.leveled) S.levelPending = true;
  S.cur = null;
  if (skipTrigger) return advance();
  S.phase = 'inject';
  S.inject = { stage: 'trigger' };
}
function advance() {
  S.inject = null; S.cur = null;
  if (S.crisisQueue.length) return startCrisisEvent();
  if (S.levelPending) { S.phase = 'levelup'; S.levelPending = false; sfx('level'); emit('flash', { color: 'gold' }); return; }
  if (S.map && S.pos.tier >= lastTier()) return startBoss();
  S.phase = 'map';
}

/* ---- injects ---- */
function spinTrigger() {
  const cut = Math.round(INJECT_CHANCE * 10); // d10: 1..cut = inject
  let fire;
  if (S.skipInject) {
    S.skipInject = false; fire = false;
    showDie(10, cut + 1 + rnd(10 - cut), 'BATTLE RHYTHM · AUTO ALL CLEAR', '✅ ALL CLEAR');
    log('Battle Rhythm', 'Inject skipped');
  } else {
    fire = rollDie(10, `INJECT CHECK · d10 (1-${cut} = inject)`, n => n <= cut ? '🌪️ INJECT!' : '✅ ALL CLEAR') <= cut;
  }
  S.inject.stage = fire ? 'murphy' : 'clear';
  log('Inject check', fire ? 'INJECT' : 'ALL CLEAR');
}
function murphySlices() {
  return MURPHY.map(m => ({ label: m.name, color: m.type === 'bad' ? '#ff5d5d' : m.type === 'good' ? '#7dff6b' : '#ffd23f', ink: m.type === 'bad' ? '#fff' : '#000' }));
}
function spinMurphy() {
  const inj = S.inject;
  let idx;
  if (S.forecast) { idx = S.forecast.idx; inj.blocked = S.forecast.blocked; S.forecast = null; }
  else {
    const pool = MURPHY.map((m, i) => [m, i]).filter(([m]) => !inj.filter || m.type === inj.filter);
    idx = pickOne(pool)[1];
  }
  inj.idx = idx; inj.stage = 'result';
  spinWheel("MURPHY'S LAW", murphySlices(), idx, true);
  log('Murphy wheel', MURPHY[idx].name + (inj.blocked ? ' (BLOCKED by Foresight)' : ''));
}
function applyInject(choice) {
  const inj = S.inject, m = MURPHY[inj.idx];
  inj.preApply = JSON.stringify(S);
  let note = '';
  if (inj.blocked) note = 'Blocked by Foresight. No effect.';
  else if (m.type === 'bad' && hasPerk('beenthere') && !S.beenThereUsed) { S.beenThereUsed = true; note = 'Ignored: the Flight Chief has Been There.'; }
  else {
    let eff = m.options ? m.options[choice].eff : { ...m.eff };
    if (m.type === 'bad' && S.contingency) { S.contingency = false; eff = Object.fromEntries(Object.entries(eff).map(([k, v]) => [k, Math.trunc(v / 2)])); note = 'Halved by Contingency Plan. '; }
    applyEff(eff);
    if (m.special === 'leave') {
      const v = rollDie(4, 'WHO GOES ON LEAVE? · d4', n => `${S.npcs[n - 1].rank} ${S.npcs[n - 1].name}`);
      const n = S.npcs[v - 1]; n.out = 2; note += `${n.rank} ${n.name} is out for 2 nodes.`;
    }
    if (m.special === 'meeting') {
      const v = rollDie(S.party.length, `WHO GETS PULLED INTO A MEETING? · d${S.party.length}`, k => cadetName(k - 1));
      S.offlineNext = v - 1; note += `${cadetName(v - 1)} is offline next node.`;
    }
    if (m.options) note += `Party chose: ${m.options[choice].t}.`;
  }
  inj.note = note; inj.stage = 'done';
  emit('injectResult', { idx: inj.idx, note });
  sfx(m.type === 'good' ? 'good' : m.type === 'bad' ? 'bad' : 'click');
  log('Inject', `${m.name}${note ? ' · ' + note : ''}`);
}
function closeInject() {
  const forced = S.inject && S.inject.forced, fromNode = S.inject && S.inject.fromNode;
  S.wheel = null;
  if (forced) { S.inject = null; return; }
  if (fromNode) { S.inject = null; return afterNode(true); }
  advance();
}

/* ---- loot / fumble ---- */
function lootSlices() { return LOOT.map(l => ({ label: l.name, color: RARITY[l.rar].color })); }
function spinLoot() {
  let r = Math.random() * 100, rar = 'common';
  for (const k of Object.keys(RARITY)) { if ((r -= RARITY[k].w) < 0) { rar = k; break; } }
  const pool = LOOT.map((l, i) => [l, i]).filter(([l]) => l.rar === rar);
  const [item, idx] = pickOne(pool);
  spinWheel('LOOT DROP!', lootSlices(), idx);
  S.items.push(item.id);
  emit('sfxLater', { n: 'loot' });
  log('Loot', `${item.icon} ${item.name} (${item.rar})`);
  if (S.cur) S.cur.lootEarned = false;
  return item;
}
function spinFumble() {
  const idx = rnd(FUMBLES.length), f = FUMBLES[idx];
  spinWheel('FUMBLE!', FUMBLES.map((x, i) => ({ label: x.name, color: i % 2 ? '#ff9f43' : '#ff5d5d' })), idx);
  applyEff(f.eff);
  log('Fumble', `${f.name}: ${f.text}`);
  if (S.cur) { S.cur.fumblePending = false; S.cur.fumble = idx; }
}

/* ---- boss ---- */
function startBoss() {
  S.phase = 'boss'; S.cur = null; S.banner = null;
  const hp = S.flags.WITNESS_IG ? 23 : BOSS.hp;
  S.boss = {
    hp, max: hp, phase: 0, log: [], witnessHandled: false,
    p2: { who: null, q: shuffle([...BOSS_QUESTIONS.keys()]).slice(0, 2), stars: [0, 0] },
    p3: { rows: S.party.map(() => ({ stat: '', d20: '', ally: false })) },
  };
  if (hasUp('golden')) applyEff({ tru: 1, why: 'Golden Child' });
  emit('bossIntro'); sfx('boss');
  log('BOSS', `${BOSS.name}, ${BOSS.title} (HP ${hp})`);
}
function bossLog(t) { S.boss.log.push(t); }
function bossDmg(n, why) {
  S.boss.hp = Math.max(0, S.boss.hp - n);
  bossLog(`💥 ${n} damage: ${why}`);
  emit('bossHit', { n }); sfx('hit');
}
function bossAttack() {
  let low = METERS[0].k;
  METERS.forEach(m => { if (S.meters[m.k] < S.meters[low]) low = m.k; });
  applyEff({ [low]: -2 });
  if (S.meters[low] < 3) S.flags.bossDrop = true;
  bossLog(`🗡️ The IG attacks your weakest meter: ${METER[low].name} −2`);
}
function bossPhase1() {
  const B = S.boss; B.phase = 1;
  const traps = TRAP_FLAGS.filter(f => S.flags[f]);
  bossLog('📋 THE AUDIT: the clipboard scans your run...');
  if (traps.length) return gameOver(traps.map(f => FLAG_TEXT[f]));
  bossLog('✅ No integrity findings.');
  if (S.flags.HONEST_BROKER) { applyEff({ tru: 2, why: 'Honest Broker' }); bossDmg(2, 'You reported the real numbers (Honest Broker)'); }
  const strong = METERS.filter(m => S.meters[m.k] >= 5).length;
  if (strong) bossDmg(Math.min(8, strong * 2), `${strong} meter${strong > 1 ? 's' : ''} at 5+ (readiness is the attack)`);
  else bossLog('No meters at 5+. The audit finds nothing to praise.');
  bossAttack();
}
function bossPhase2Start() {
  S.boss.phase = 2;
  bossLog('🎤 THE INTERVIEW');
  if (S.flags.VAGUE_ANSWER) { applyEff({ tru: -2, why: '"You said you were on it."' }); bossLog('😬 "You said you were on it." ⭐ −2'); }
}
// Everyone rolls a d20; the two LOWEST rolls face the Inspector's questions.
function bossHotSeat() {
  const B = S.boss;
  const rolls = S.party.map(() => 1 + rnd(20));
  const order = S.party.map((_, i) => i).sort((a, b) => (rolls[a] - rolls[b]) || (Math.random() - 0.5));
  B.p2.who = order.slice(0, 2);
  B.p2.rolls = rolls;
  emit('multiDice', { title: 'WHO FACES THE INTERVIEW? · lowest two rolls', rows: S.party.map((p, i) => ({ name: rankName(p), av: p.av, v: rolls[i], hi: B.p2.who.includes(i), tag: B.p2.who.includes(i) ? 'HOT SEAT' : 'SAFE' })) });
  S.spinUntil = Date.now() + 4200; setTimeout(afterSpin, 4260);
  bossLog(`🎲 Hot seat: ${B.p2.who.map(cadetName).join(' and ')} (lowest rolls)`);
}
function bossPhase2Resolve() {
  const B = S.boss, st = B.p2.stars;
  const total = st[0] + st[1];
  S.starsTotal += total;
  bossDmg(total, `Interview answers (${st[0]}★ + ${st[1]}★)`);
  if (S.flags.NEWKID_ALLY) bossDmg(1, 'The new Airman you welcomed vouches for you');
  bossAttack();
  B.p2.done = true;
}
function bossPhase3Start() { S.boss.phase = 3; bossLog('🚨 NO-NOTICE EXERCISE: everyone rolls'); sfx('alarm'); }
function bossPhase3Resolve() {
  const B = S.boss, dc = B.witnessHandled ? 10 : 13;
  const high = METERS.filter(m => S.meters[m.k] >= 8).length;
  B.p3.rows.forEach(r => { r.d20 = r.ally ? '' : 1 + rnd(20); });
  emit('multiDice', { title: `NO-NOTICE EXERCISE · d20 + stat${high ? ` + ${high}` : ''} vs ${dc}`, rows: B.p3.rows.map((r, i) => {
    if (r.ally) return { name: cadetName(i), av: S.party[i].av, v: '🤝', hi: true, tag: 'ALLY PASS' };
    const t = r.d20 + statOf(i, r.stat) + high;
    return { name: cadetName(i), av: S.party[i].av, v: r.d20, hi: r.d20 === 20 || (r.d20 !== 1 && t >= dc), tag: r.d20 === 20 ? 'CRIT!' : r.d20 === 1 ? 'FUMBLE' : `${r.stat} = ${t}` };
  }) });
  S.spinUntil = Date.now() + 4200; setTimeout(afterSpin, 4260);
  B.p3.results = B.p3.rows.map((r, i) => {
    if (r.ally) { bossDmg(2, `${cadetName(i)}: an Ally NPC carries the check`); return { auto: true }; }
    const d = +r.d20; const sv = r.stat ? statOf(i, r.stat) : 0;
    const total = d + sv + high;
    if (d === 1) {
      const f = pickOne(FUMBLES); applyEff(f.eff);
      bossLog(`🤦 ${cadetName(i)} rolled a natural 1: ${f.name} (${f.text})`); sfx('fumble');
      return { d, total, pass: false };
    }
    if (d === 20) { bossDmg(4, `${cadetName(i)} CRITICAL (${r.stat})`); award('crit'); return { d, total, pass: true }; }
    if (total >= dc) { bossDmg(2, `${cadetName(i)}: ${d}+${sv} ${r.stat}${high ? `+${high}` : ''} = ${total} vs ${dc}`); return { d, total, pass: true }; }
    bossLog(`❌ ${cadetName(i)}: ${d}+${sv} ${r.stat}${high ? `+${high}` : ''} = ${total} vs ${dc} (miss)`);
    return { d, total, pass: false };
  });
  endBoss();
}
function endBoss() {
  const B = S.boss, hp = B.hp;
  const res = hp <= 0 ? ['🏆 OUTSTANDING', 50] : hp <= 5 ? ['🥇 EXCELLENT', 30] : hp <= 10 ? ['✅ SATISFACTORY', 10] : ['⚠️ MARGINAL', 0];
  B.result = res[0]; S.bossBonus = res[1]; B.phase = 4;
  bossLog(`INSPECTION RESULT: ${res[0]} (+${res[1]})`);
  if (hp <= 0 && !S.flags.bossDrop) award('flawless');
  emit('big', { cls: hp <= 5 ? 'good' : '', title: 'INSPECTION RESULT', icon: '📋', text: `${res[0]}  ·  BOSS HP LEFT: ${hp}` });
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
  S.final = { ...sc, grade: gradeFor(S, sc.total) };
  S.phase = 'results';
  emit('results'); sfx(S.gameOver ? 'over' : 'level');
}
function gameOver(reasons) {
  S.gameOver = true; S.gameOverReasons = reasons;
  bossLog('🚨 INTEGRITY FINDING: ' + reasons.join('; '));
  log('GAME OVER', reasons.join('; '));
  emit('gameOver', { reasons }); sfx('over');
  const sc = computeScore(S);
  S.final = { ...sc, grade: gradeFor(S, sc.total) };
  S.phase = 'results';
}
function saveToBoard() {
  const b = loadBoard(), u = UNITS.find(x => x.id === S.unit);
  b.push({
    callsign: (S.callsign || 'NO NAME').toUpperCase().slice(0, 14), unit: u ? u.name : '', grade: S.final.grade.g,
    score: S.final.total, low: Math.min(...METERS.map(m => S.meters[m.k])), stars: S.starsTotal, ach: S.ach.length,
    gameOver: S.gameOver, cadets: S.party.map(c => c.name).join(', '), date: new Date().toISOString(),
  });
  saveBoard(b); S.saved = true;
  log('Leaderboard', `Saved as ${S.callsign}`);
}

/* ---- abilities, items, GM cards ---- */
function abilityLimit(c) { return c.cls === 'xo' && unitQ() === 'xo2' ? 2 : 1; }
function useAbility(i) {
  const c = S.party[i], ab = CLASS[c.cls].ability; if (!ab) return;
  if (c.used >= abilityLimit(c)) return alert('Already used.');
  if (ab.id === 'network') {
    const s = prompt('Enlisted Network: reveal which NPC? (A=SSgt, B=A1C, C=TSgt, D=Civ)', 'A'); if (!s || !npc(s.toUpperCase())) return;
    reveal(s.toUpperCase());
  } else if (ab.id === 'rally') {
    applyEff({ mor: 2, why: 'Rally' }); S.npcs.forEach(n => changeLoy(n.slot, 1));
  } else if (ab.id === 'ear') {
    if (!S.lastTruLoss) return alert('No ⭐ loss to cancel yet.');
    applyEff({ tru: S.lastTruLoss, why: "Commander's Ear" }); S.lastTruLoss = 0;
  } else if (ab.id === 'requisition') {
    const k = (prompt('Requisition: which meter? mis / mor / tru', 'mis') || '').trim(); if (!['mis', 'mor', 'tru'].includes(k)) return;
    const amt = parseInt(prompt(`How many points of ${METER[k].name}? (costs 2 📦 each, you have ${S.meters.res})`, '1'), 10);
    if (!(amt > 0) || amt * 2 > S.meters.res) return alert('Not enough 📦.');
    applyEff({ res: -amt * 2, [k]: amt, why: 'Requisition' });
  } else if (ab.id === 'foresight') {
    S.forecast = { idx: rnd(MURPHY.length), blocked: false };
    emit('forecast', { idx: S.forecast.idx });
  }
  c.used++;
  toast(CLASS[c.cls].icon, 'ABILITY USED', `${c.name}: ${ab.name}`); sfx('loot');
  log('Ability', `${c.name}: ${ab.name}`);
}
function useItem(k) {
  const id = S.items[k], it = LOOT.find(l => l.id === id);
  const consume = () => S.items.splice(k, 1);
  switch (id) {
    case 'coffee': S.pending.coffee = !S.pending.coffee; return;
    case 'sticky': S.pending.sticky = !S.pending.sticky; return;
    case 'pizza': applyEff({ mor: 2, why: 'Pizza Fund' }); break;
    case 'rhythm': S.skipInject = true; break;
    case 'deck': applyEff({ tru: 2, why: 'Perfect Slide Deck' }); break;
    case 'recharge': {
      const n = prompt('Recharge whose ability? ' + S.party.map((c, i) => `${i + 1}=${c.name}`).join(', '), '1');
      const c = S.party[(+n) - 1]; if (!c) return; c.used = 0; break;
    }
    case 'token': { const k2 = Object.keys(S.lt).find(t => !S.lt[t]); if (!k2) return alert('No used tokens to restore.'); S.lt[k2] = true; break; }
    case 'coin': { const m = (prompt('Commander\'s Coin: +3 to which meter? mis / mor / tru / res', 'mor') || '').trim(); if (!METER[m]) return; applyEff({ [m]: 3, why: "Commander's Coin" }); break; }
    case 'door': S.npcs.forEach(n => changeLoy(n.slot, 5)); break;
    case 'doover': {
      if (!S.cur || !S.cur.preChoice) return alert('Use Do-Over right after a decision (before continuing).');
      const items = S.items.slice(); items.splice(k, 1);
      S = JSON.parse(S.cur.preChoice); S.items = items;
      toast('🔄', 'DO-OVER!', 'Choose again'); sfx('loot'); log('Item', 'Do-Over'); return;
    }
    case 'rolodex': {
      if (!S.inject || S.inject.stage !== 'done' || !S.inject.preApply) return alert('Use the Rolodex right after a bad inject is applied.');
      const pre = JSON.parse(S.inject.preApply); const items = pre.items.filter((x, j) => j !== k);
      S = pre; S.items = items; S.inject.stage = 'done'; S.inject.note = 'Cancelled by the Chief\'s Rolodex.'; S.inject.cancelled = true;
      toast('📇', "CHIEF'S ROLODEX", 'Inject cancelled'); log('Item', "Chief's Rolodex cancelled the inject"); return;
    }
    default: return;
  }
  consume();
  toast(it.icon, 'ITEM USED', it.name); sfx('loot'); log('Item', it.name);
}
function playCard(id) {
  const used = () => { S.gmUsed.push(id); log('GM card', GM_CARDS.find(c => c.id === id).name); };
  switch (id) {
    case 'curveball': S.inject = { stage: 'murphy', forced: true }; spinMurphy(); break;
    case 'loaded': { const v = parseInt(prompt('Loaded Dice: +3 (harder) or -3 (easier)?', '3'), 10); if (![3, -3].includes(v)) return; S.dcMod = v; break; }
    case 'clock': S.timer = { end: Date.now() + 15000, label: 'SHOT CLOCK' }; break;
    case 'witness': { const s = (prompt('Reveal which NPC? A/B/C/D', 'A') || '').toUpperCase(); if (!npc(s)) return; reveal(s); emit('big', { cls: 'bad', title: 'THE WITNESS SPEAKS', icon: '🕵️', text: `Everyone now knows ${npcLabel(S, s)} is ${TRAIT[npc(s).trait].name}.` }); break; }
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
  snap();
  const r = fn(arg, el);
  if (r === false) { hist.pop(); renderGM(); return; }
  push();
}

const B = (act, label, o = {}) => `<button class="b ${o.cls || ''}" data-act="${act}" ${o.arg != null ? `data-arg="${esc(o.arg)}"` : ''} ${o.dis ? 'disabled' : ''} title="${esc(o.title || '')}">${label}</button>`;

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
      ${B('newRun', '🆕 New run', { cls: 'red' })}
    </div>
    <div id="gmMain">${gmMain()}</div>
    <div id="gmSide">${typeof gmPhonesCard === 'function' ? gmPhonesCard() : ''}${['title', 'intro', 'party', 'perks', 'avatars'].includes(S.phase) ? gmSideLite() : gmSide()}</div>
  </div>`;
  if (focusId && document.getElementById(focusId)) { const el = document.getElementById(focusId); el.focus(); if (el.setSelectionRange && el.type === 'text') { const l = el.value.length; el.setSelectionRange(l, l); } }
}

function gmMain() {
  if (S.inject && S.inject.forced) return gmInject();
  switch (S.phase) {
    case 'title': return gmTitle();
    case 'party': return gmParty();
    case 'perks': return gmPerks();
    case 'unit': return `<div class="gcard"><h2>Roll the unit</h2><p class="note">Rolls a d6 on the projector for the squadron, draws the NPCs (excluding anyone in this party), and deals hidden traits.</p>${S.unitRolled ? (spinning() ? '<p class="note">Rolling...</p>' : B('showManifest', '📋 Show the crew manifest', { cls: 'pri' })) : B('rollUnit', '🎲 Roll the d6 for the unit', { cls: 'pri' })}</div>`;
    case 'intro': return gmIntro();
    case 'avatars': return gmAvatars();
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
  let saved = null; try { saved = JSON.parse(localStorage.getItem('sq_run') || 'null'); } catch (e) { }
  const b = sortBoard(loadBoard());
  const R = getRoster();
  const rosterCard = `<div class="gcard"><h3>NPC roster</h3>
    <p class="note">${R.builtin ? `Using the built-in roster from data.js: ${R.upper.length} upper (POC) and ${R.lower.length} lower (AS200/250/500) names. Edit below and save to override it in this browser only.` : `Using a custom roster saved in this browser: ${R.upper.length} upper and ${R.lower.length} lower names.`}</p>
    <div class="note">Upper: TSgt, Civilian, Squadron CC</div><textarea id="rosterUp">${esc(R.upper.join(', '))}</textarea>
    <div class="note">Lower: SSgt, A1C</div><textarea id="rosterLo">${esc(R.lower.join(', '))}</textarea>
    <div class="row">${B('saveRoster', '💾 Save override')} ${R.builtin ? '' : B('clearRoster', 'Back to built-in roster', { cls: 'sm' })}</div></div>`;
  return `<div class="gcard"><h2>Welcome, Game Master</h2>
    <p>1. Click <b>Open player screen</b> and drag that window onto the projector (press F11 there for full screen). Click it once so sound can play.<br>
    2. Start a new run for each party. The console autosaves, so a closed tab can be resumed.</p>
    <div class="row">${B('newRun', '▶️ Start a new run', { cls: 'pri' })}
    ${saved && saved.phase && saved.phase !== 'title' ? B('resume', `⏯️ Resume saved run (${esc(saved.phase)}${saved.callsign ? ', ' + esc(saved.callsign) : ''})`) : ''}</div></div>
    <div class="gcard"><h3>Leaderboard (${b.length} runs)</h3>${boardTable(b)}
    <div class="row">${B('exportBoard', '💾 Export leaderboard + grades (JSON)')} <label class="b">📂 Import JSON<input type="file" id="importFile" accept=".json" class="hide"></label>
    ${B('exportCSV', '📊 Export grades CSV')} ${B('clearBoard', '🗑️ Clear leaderboard', { cls: 'red' })}</div>
    <p class="note">Top 3 non-Game-Over runs earn extra credit. Data lives in this browser; export a backup after each practicum day.</p></div>${rosterCard}`;
}
act('saveRoster', () => {
  const upper = parseNames($('#rosterUp').value), lower = parseNames($('#rosterLo').value);
  if (upper.length < 3 || lower.length < 2) { alert('Need at least 3 upper and 2 lower names.'); return false; }
  localStorage.setItem('sq_roster', JSON.stringify({ upper, lower }));
});
act('clearRoster', () => { if (!confirm('Go back to the built-in roster from data.js?')) return false; localStorage.removeItem('sq_roster'); });
function boardTable(b) {
  if (!b.length) return '<p class="note">No runs yet.</p>';
  let rank = 0;
  return `<table class="g"><tr><th>#</th><th>Team</th><th>Unit</th><th>Grade</th><th>Score</th><th>Cadets</th></tr>${b.map(r => `<tr><td>${r.gameOver ? '💀' : ++rank}</td><td>${esc(r.callsign)}</td><td>${esc(r.unit)}</td><td>${esc(r.grade)}</td><td>${r.score}</td><td class="note">${esc(r.cadets)}</td></tr>`).join('')}</table>`;
}

function gmParty() {
  const taken = S.party.map(c => c.cls);
  return `<div class="gcard"><h2>Character select</h2>
  <p class="note">Cadets pick their classes (by phone or out loud). Flight Commander is required, and there are no duplicate classes. Leave row 4 blank for a 3-person party. Perks stay hidden until the classes are locked.</p>
  ${S.party.map((c, i) => `<div class="gchoice"><div class="row">
    <b>P${i + 1}</b><input type="text" id="pname${i}" placeholder="Cadet name (or they join by phone)" value="${esc(c.name)}" data-inp="pname" data-arg="${i}">
    ${Object.values(S.clients || {}).some(k => k.slot === i) ? '<span class="pill y">📱 phone</span>' : ''}
    ${c.name ? B('kick', '✖', { arg: i, cls: 'sm', title: 'Remove this cadet (and their phone)' }) : ''}
    <select data-inp="pcls" data-arg="${i}"><option value="">- class -</option>${CLASSES.map(k => `<option value="${k.id}" ${c.cls === k.id ? 'selected' : ''} ${c.cls !== k.id && taken.includes(k.id) ? 'disabled' : ''}>${k.icon} ${k.name}</option>`).join('')}</select>
    </div></div>`).join('')}
  <div class="warnline" id="partyWarn">${esc(S.partyWarn || '')}</div>
  <div class="row">${B('lockParty', '🔒 Lock in the classes → reveal perks', { cls: 'pri' })}</div></div>`;
}
function gmPerks() {
  return `<div class="gcard"><h2>🎁 Perk selection</h2>
  <p class="note">The projector now reveals each cadet's two perks. They pick one (by phone or out loud).</p>
  ${S.party.map((c, i) => `<div class="gchoice"><b>${CLASS[c.cls].icon} ${esc(rankName(c))}</b> <span class="note">${CLASS[c.cls].name}</span>
    <div class="row">${CLASS[c.cls].perks.map(p => `<label class="b ${c.perk === p.id ? 'on' : ''}"><input type="radio" class="hide" name="perk${i}" data-inp="pperk" data-arg="${i}" value="${p.id}" ${c.perk === p.id ? 'checked' : ''}>${esc(p.name)}: <span class="note">${esc(p.text)}</span></label>`).join('')}</div></div>`).join('')}
  <div class="warnline">${esc(S.partyWarn || '')}</div>
  <div class="row">${B('backToClasses', '⬅️ Back to classes')} ${B('lockPerks', '✅ Lock perks → pick pilots', { cls: 'pri', dis: S.party.some(c => !c.perk) })}</div></div>`;
}

function gmIntro() {
  const pg = S.introPage;
  return `<div class="gcard"><h2>Game briefing (${pg + 1}/2)</h2>
    <p class="note">${pg === 0 ? 'The projector shows HOW TO PLAY: the whole game in one screen. Read it out loud (about 60 seconds).' : 'The projector shows READING THE SCREEN: what every icon, arrow and token means.'}</p>
    <div class="row">${B('introPrev', '⬅️ Back', { dis: pg === 0 })} ${pg === 0 ? B('introNext', 'Next: icon legend ➡️', { cls: 'pri' }) : B('toParty', '▶️ Go to class select', { cls: 'pri' })}</div></div>`;
}
function gmAvatars() {
  const taken = S.party.map(p => p.av);
  return `<div class="gcard"><h2>Pick your pilot</h2><p class="note">The projector shows 16 numbered characters. Each cadet calls out a number.</p>
    ${S.party.map((p, i) => `<div class="gchoice"><b>${CLASS[p.cls].icon} ${esc(p.name)}</b> ${p.av != null ? `<span class="pill y">#${p.av + 1}</span>` : ''}
      <div class="row">${AVATARS.map((_, k) => `<button class="b sm ${p.av === k ? 'on' : ''}" data-act="setAv" data-arg="${i},${k}" ${p.av !== k && taken.includes(k) ? 'disabled' : ''} title="#${k + 1}"><img src="${presetAvatar(k)}" style="width:28px;height:28px;image-rendering:pixelated;display:block"></button>`).join('')}</div></div>`).join('')}
    ${B('avDone', '✅ Done: roll for the unit', { cls: 'pri', dis: S.party.some(p => p.av == null) })}</div>`;
}

function gmManifest() {
  const u = UNITS.find(x => x.id === S.unit);
  return `<div class="gcard"><h2>${u.icon} ${u.name}: ${u.sq}</h2>
  <p><b>Sq CC:</b> ${esc(S.cc)} · <b>Quirk:</b> ${esc(u.quirk)}</p>
  <table class="g"><tr><th>Slot</th><th>NPC</th><th>Public trait</th><th>Hidden trait (GM only)</th></tr>
  ${S.npcs.map(n => { const t = TRAIT[n.trait]; return `<tr><td>${n.slot}</td><td>${esc(n.rank + ' ' + n.name)}</td><td class="note">${esc(n.pub)}</td><td>${t.icon} <b>${t.name}</b>: ${esc(t.what)}<br><span class="note">Reward: ${esc(t.reward)} · Breaking point: ${esc(t.bpText)}</span></td></tr>`; }).join('')}</table>
  <p class="note">The projector is showing the crew manifest (org chart). Give the party ~45 seconds to read it, then open the map.</p>
  ${B('toMap', '🗺️ Open the route map', { cls: 'pri' })}</div>`;
}

function gmMap() {
  const av = available();
  return `<div class="gcard"><h2>Route map: next stop</h2>
  <p class="note">One path: ${S.map.tiers.length} stops, then the IG. Level up after stop ${LEVEL_AFTER}. Click the glowing stop to move on. Allow roughly 3 minutes per stop.</p>
  ${S.map.tiers.map((tier, t) => `<div class="row"><b style="width:60px">Tier ${t + 1}</b>${tier.map((nd, i) => {
    const open = av.some(([a, b]) => a === t && b === i);
    const nt = NODE_TYPES[nd.type];
    const myst = nd.type === 'unknown' ? ` <span class="note">(${MYSTERY[nd.mystery].name})</span>` : '';
    return B('node', `${nt.icon} ${nt.name}${myst}${nd.done ? ' ✔' : ''}`, { arg: `${t},${i}`, dis: !open, cls: open ? 'go' : '' });
  }).join('')}</div>`).join('')}
  <div class="row"><b style="width:60px">Boss</b><span class="pill">👹 ${BOSS.name}</span></div>
  ${S.pos.tier >= 0 && S.pos.tier < lastTier() ? `<div class="row">${B('collapse', `⏩ Running late: skip the remaining ${lastTier() - S.pos.tier} stop(s), go to the boss`)}</div>` : ''}</div>`;
}

function gmChoiceList(m, c) {
  const votes = S.votes || {};
  return m.choices.map((ch, i) => {
    const picked = c.choice === i;
    const voters = Object.keys(votes).filter(s => votes[s] === i).map(s => cadetName(+s));
    const sw = c.swap && c.swap.includes(i) ? ' <span class="pill y">PLOT TWIST swapped</span>' : '';
    return `<div class="gchoice" style="${picked ? 'border-color:var(--gold)' : ''}"><div class="h">
      <b>${'ABCD'[i]}</b><span class="t">${esc(fill(S, ch.t))} ${ch.lock ? '🔒' : ''} ${ch.mic ? '🎤' : ''} ${ch.trap ? '<span class="trap">💀 TRAP</span>' : ''}${sw}</span>
      <span>${arrows(ch.show)}</span>
      ${voters.length ? `<span class="pill y" title="${esc(voters.join(', '))}">📱 ${voters.length} vote${voters.length > 1 ? 's' : ''}${ch.lock && voters.includes(cadetName(S.tokenHolder)) ? ' 👑' : ''}</span>` : ''}
      ${c.step === 'brief' ? B('choose', 'Choose', { arg: i, cls: 'go' }) : ''}</div>
      <div class="eff">${esc(specText(S, ch))}</div>${ch.note ? `<div class="note">${esc(fill(S, ch.note))}</div>` : ''}</div>`;
  }).join('');
}

function gmNode() {
  const c = S.cur;
  if (c.type === 'rest') return `<div class="gcard"><h2>🏕️ Rest Stop</h2><p class="note">The party picks ONE.${hasPerk('yearend') ? ' (Year-End Money already paid +2 📦.)' : ''}</p>
    ${c.step === 'choose' ? `<div class="row">${METERS.map(m => B('restMeter', `+2 ${m.icon}`, { arg: m.k })).join('')}</div>
    <div class="row">${S.party.map((p, i) => CLASS[p.cls].ability ? B('restRecharge', `🔋 Recharge ${esc(p.name)} (${CLASS[p.cls].ability.name})`, { arg: i, dis: !p.used }) : '').join('')}</div>
    <div class="row">${B('restLoy', '🤝 +1 loyalty to all NPCs')}</div>` : `<p class="bigres">${esc(c.result || '')}</p>${B('nodeDone', 'Continue ➡️', { cls: 'pri' })}`}</div>`;
  if (c.type === 'depot') return `<div class="gcard"><h2>🛒 Supply Depot</h2><p class="note">One trade.${hasPerk('yearend') ? ' (Year-End Money already paid +2 📦.)' : ''}</p>
    ${c.step === 'choose' ? `<div class="row">${B('depotLoot', '🎁 Pay 2 📦 for a loot spin', { dis: S.meters.res < 2 })}</div>
    <div class="row">Pay 2 of: ${['mis', 'mor', 'tru'].map(k => B('depotRes', `${METER[k].icon} → +2 📦`, { arg: k, dis: S.meters[k] < 2 })).join('')}</div>
    <div class="row">${B('depotToken', '🎫 Buy back a Leadership Token for 2 ⭐', { dis: S.meters.tru < 2 || !Object.values(S.lt).includes(false) })} ${B('depotSkip', 'No trade')}</div>`
      : `<p class="bigres">${esc(c.result || '')}</p>${spinning() ? '<p class="note">Spinning...</p>' : B('nodeDone', 'Continue ➡️', { cls: 'pri' })}`}</div>`;
  if (c.type === 'unknown') {
    const my = MYSTERY[c.mystery];
    return `<div class="gcard"><h2>❓ Unknown node</h2>
    ${c.step === 'spin' ? `<p class="note">This node's outcome is pre-rolled (so Recon can reveal it): <b>${my.name}</b>. Roll to reveal it on the projector.</p>${B('spinMystery', '🎲 Roll the d6', { cls: 'pri' })}`
        : spinning() ? '<p class="note">Spinning...</p>' : `<p class="bigres">${my.name}</p>${B('mysteryGo', 'Continue ➡️', { cls: 'pri' })}`}</div>`;
  }
  const m = curMission();
  const isCE = c.type === 'crisisEvent';
  let body = '';
  if (c.step === 'brief') {
    body = `<div class="row">
      ${B('ltIntel', '🔎 Intel Briefing (show exact effects)', { dis: !S.lt.intel || c.intel || isCE })}
      ${B('ltPause', '⏸️ Tactical Pause (30s)', { dis: !S.lt.pause })}
      ${B('timer', '⏱️ 30s decision clock', { arg: 30 })}
    </div>`;
  } else if (c.step === 'roll') body = gmRollPanel();
  else if (c.step === 'stars') body = gmStarsPanel();
  else if (c.step === 'done') body = gmDonePanel();
  return `<div class="gcard"><h2>${m.icon} ${c.type === 'elite' ? '💀 ELITE: ' : isCE ? '🚨 ' : ''}${esc(m.title)}</h2>
    <div class="note">${esc(m.sob)} ${c.type === 'elite' ? '· ELITE: every check is one step harder (+3), positive effects double, loot guaranteed' : ''}</div>
    <p style="font-size:15px">${esc(fill(S, m.text))}</p>
    ${S.banner ? `<p class="warnline">${esc(S.banner.text)} ${B('clearBanner', 'clear', { cls: 'sm' })}</p>` : ''}
    ${S.offline != null ? `<p class="warnline">📵 ${esc(cadetName(S.offline))} is offline this node.</p>` : ''}
    ${gmChoiceList(m, c)}${body}</div>`;
}

function gmRollPanel() {
  const c = S.cur, ch = c.spec.check, r = c.roller ?? S.tokenHolder;
  const preview = rollCalc(ch, r, 10, { coffee: S.pending.coffee, typ: c.typ });
  const isLoy = ch.stat === 'LOYB';
  return `<div class="gchoice" style="border-color:var(--accent)"><b>🎲 CHECK: ${esc(statLabel(ch.stat))} vs ${preview.dc}</b>
    <div class="row">${isLoy ? `<span class="note">${esc(npcLabel(S, 'B'))} rolls (a cadet rolls the die for them)</span>` : `Who rolls? ${S.party.map((p, i) => B('roller', `${esc(p.name)} (${ch.stat ? ch.stat + ' ' + sign(statOf(i, ch.stat)) : '+0'})`, { arg: i, cls: r === i ? 'on' : '', dis: S.offline === i })).join('')}`}</div>
    <div class="note">Modifiers (besides the die): ${preview.parts.map(p => `${esc(p[0])} ${sign(p[1])}`).join(', ') || 'none'}</div>
    <div class="row">
      ${S.items.includes('coffee') ? B('coffee', `☕ Coffee +2 ${S.pending.coffee ? '(ON)' : ''}`, { cls: S.pending.coffee ? 'on' : '' }) : ''}
      ${hasPerk('typ') && !S.flags.typUsed && ch.stat === 'CMD' ? B('typ', `Trust Your People ${c.typ ? '(ON)' : ''}`, { cls: c.typ ? 'on' : '' }) : ''}
      ${S.dcMod ? `<span class="pill y">Loaded Dice ${sign(S.dcMod)}</span>` : ''}
    </div>
    <div class="row">${B('resolveRoll', '🎲 Roll the d20', { cls: 'pri' })} <span class="note">The die rolls on the projector.</span></div></div>`;
}
function gmStarsPanel() {
  const c = S.cur, lead = c.lead ?? S.tokenHolder;
  return `<div class="gchoice" style="border-color:var(--gold)"><b>🎤 DIALOGUE ENCOUNTER</b> <span class="note">You play the NPC. Start the act clock, let them act it out, then rate it.</span>
    <div class="row">${B('timer', '⏱️ 30s act clock', { arg: 30 })} ${B('timer', '⏱️ 60s', { arg: 60 })}</div>
    <div class="row">Who led it? ${S.party.map((p, i) => B('lead', esc(p.name) + (p.perk === 'toughlove' ? ' (Tough Love +1)' : ''), { arg: i, cls: lead === i ? 'on' : '', dis: S.offline === i })).join('')}</div>
    ${S.items.includes('sticky') ? `<div class="row">${B('sticky', `📝 Sticky Note +1 star ${S.pending.sticky ? '(ON)' : ''}`, { cls: S.pending.sticky ? 'on' : '' })}</div>` : ''}
    <div class="row">Rate: ${B('stars', '⭐ 1 star', { arg: 1 })} ${B('stars', '⭐⭐ 2 stars', { arg: 2 })} ${B('stars', '⭐⭐⭐ 3 stars', { arg: 3, cls: 'pri' })}</div>
    <div class="note">1★ vague, blames, or gets it wrong · 2★ clear but one-sided · 3★ specific, respectful, sets expectations and listens</div></div>`;
}
function gmDonePanel() {
  const c = S.cur;
  let res = '';
  if (c.rollRes) { const r = c.rollRes; res = `🎲 ${r.d20} → ${r.total} vs ${r.dc}: <b class="${r.pass ? 'ok' : 'bad'}">${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE' : r.pass ? 'PASS' : 'FAIL'}</b>`; }
  if (c.stars) res = `🎤 ${'⭐'.repeat(c.stars)}${c.starBonus && c.starBonus.length ? ` <span class="note">(${esc(c.starBonus.join(', '))})</span>` : ''}`;
  return `<div class="gchoice" style="border-color:var(--good)"><div class="bigres">${res || 'Effects applied.'}</div>
    <div class="row">
      ${c.rollRes && S.lt.waiver ? B('waiver', '📝 Submit a Waiver (reroll)') : ''}
      ${c.fumblePending ? B('fumble', '🤦 Spin the Fumble wheel', { cls: 'red' }) : ''}
      ${c.lootEarned && !c.fumblePending ? B('loot', '🎁 Spin for loot!', { cls: 'pri' }) : ''}
      ${spinning() ? '<span class="note">Spinning...</span>' : (!c.fumblePending && !c.lootEarned ? B('nodeDone', 'Continue ➡️', { cls: 'pri' }) : '')}
    </div></div>`;
}

function gmInject() {
  const inj = S.inject;
  if (!inj) return '';
  const m = inj.idx != null ? MURPHY[inj.idx] : null;
  let body = '';
  if (inj.stage === 'trigger') body = `<p class="note">d10: 1-${Math.round(INJECT_CHANCE * 10)} = inject.${S.skipInject ? ' Battle Rhythm is active: auto ALL CLEAR.' : ''}</p>${B('spinTrigger', '🎲 Roll the inject check', { cls: 'pri' })}`;
  else if (spinning()) body = '<p class="note">Spinning on the projector...</p>';
  else if (inj.stage === 'clear') body = `<p class="bigres ok">ALL CLEAR</p>${B('closeInject', 'Continue ➡️', { cls: 'pri' })}`;
  else if (inj.stage === 'murphy') body = `<p class="bigres bad">INJECT!</p>${S.forecast ? `<p class="warnline">Foresight forecast: ${MURPHY[S.forecast.idx].name}${S.forecast.blocked ? ' (BLOCKED)' : ''}</p>` : ''}${B('spinMurphy', "🎡 Spin Murphy's wheel", { cls: 'pri' })}`;
  else if (inj.stage === 'result') body = `<p class="bigres">${esc(m.name)} <span class="pill">${m.type}</span></p><p>${esc(m.text || '')} ${effText(S, m.eff)}</p>
      ${inj.blocked ? '<p class="ok">Blocked by Foresight.</p>' : ''}
      ${m.options ? `<div class="row">${m.options.map((o, i) => B('applyInject', `${o.t}: ${effText(S, o.eff)}`, { arg: i, cls: 'go' })).join('')}</div>` : B('applyInject', 'Apply', { arg: 0, cls: 'pri' })}`;
  else if (inj.stage === 'done') body = `<p class="bigres">${esc(m ? m.name : '')}</p><p>${esc(inj.note || '')}</p>
      <div class="row">${m && m.type === 'bad' && !inj.cancelled && S.items.includes('rolodex') ? B('item', "📇 Use Chief's Rolodex (cancel it)", { arg: S.items.indexOf('rolodex') }) : ''}
      ${B('closeInject', 'Continue ➡️', { cls: 'pri' })}</div>`;
  return `<div class="gcard"><h2>${inj.forced ? '🃏 Curveball: ' : ''}Injects</h2>${body}</div>`;
}

function gmLevel() {
  return `<div class="gcard"><h2>⬆️ LEVEL UP!</h2><p class="note">Each cadet picks one upgrade.</p>
  ${S.party.map((p, i) => `<div class="gchoice"><b>${CLASS[p.cls].icon} ${esc(p.name)}</b> <span class="note">${CLASS[p.cls].name}</span>
    <div class="row">${CLASS[p.cls].ups.map(u => `<label class="b ${p.up === u.id ? 'on' : ''}"><input type="radio" class="hide" name="up${i}" data-inp="pup" data-arg="${i}" value="${u.id}" ${p.up === u.id ? 'checked' : ''}>${esc(u.name)}: <span class="note">${esc(u.text)}${u.id === 'wind' && !CLASS[p.cls].ability ? ' (no ability)' : ''}</span></label>`).join('')}</div></div>`).join('')}
  ${B('confirmLevel', '✅ Confirm upgrades', { cls: 'pri', dis: S.party.some(p => !p.up) })}</div>`;
}

function gmBoss() {
  const Bs = S.boss;
  let body = '';
  if (Bs.phase === 0) body = `<p>Boss intro is on the projector. HP ${Bs.max}${S.flags.WITNESS_IG ? ' (The Witness reported you: HP 23)' : ''}.</p>
    <label class="row"><input type="checkbox" data-inp="witness" ${Bs.witnessHandled ? 'checked' : ''}> The Witness trait was discovered and handled (Phase 3 target drops to 10)</label>
    ${B('boss1', '📋 Phase 1: THE AUDIT', { cls: 'pri' })}`;
  else if (Bs.phase === 1) body = B('boss2', '🎤 Phase 2: THE INTERVIEW', { cls: 'pri' });
  else if (Bs.phase === 2 && !Bs.p2.who) body = `<p class="note">Everyone rolls a d20 on the projector; the two lowest rolls are in the hot seat.</p>${B('hotSeat', '🎲 Roll for the hot seat', { cls: 'pri' })}`;
  else if (Bs.phase === 2) body = `${Bs.p2.who.map((w, j) => `<div class="gchoice"><b>${esc(cadetName(w))}</b> <span class="note">(rolled ${Bs.p2.rolls ? Bs.p2.rolls[w] : '?'})</span><div>"${esc(BOSS_QUESTIONS[Bs.p2.q[j]])}"</div>
      <div class="row">${B('timer', '⏱️ 20s', { arg: 20 })} ${[1, 2, 3].map(n => B('bossStar', '⭐'.repeat(n), { arg: `${j},${n}`, cls: Bs.p2.stars[j] === n ? 'on' : '' })).join('')}</div></div>`).join('')}
      ${B('boss2resolve', '💥 Resolve the interview', { cls: 'pri', dis: Bs.p2.done || Bs.p2.stars.some(s => !s) })}
      ${Bs.p2.done ? B('boss3', '🚨 Phase 3: NO-NOTICE EXERCISE', { cls: 'pri' }) : ''}`;
  else if (Bs.phase === 3) {
    const usedStats = Bs.p3.rows.map(r => r.stat);
    const allies = S.npcs.filter(isAlly).length;
    body = `<p class="note">Each cadet calls out the stat they'll use (each stat only once). Then everyone rolls a d20 on the projector. Target ${Bs.witnessHandled ? 10 : 13}. +1 per meter at 8+. Allies available: ${allies}.</p>
      ${Bs.p3.rows.map((r, i) => `<div class="row"><b style="width:140px">${esc(cadetName(i))}</b>
        <select data-inp="b3stat" data-arg="${i}"><option value="">- stat -</option>${STATS.map(st => `<option value="${st}" ${r.stat === st ? 'selected' : ''} ${r.stat !== st && usedStats.includes(st) ? 'disabled' : ''}>${st} ${sign(statOf(i, st))}</option>`).join('')}</select>
        ${allies ? `<label><input type="checkbox" data-inp="b3ally" data-arg="${i}" ${r.ally ? 'checked' : ''}> Ally auto-pass</label>` : ''}
        ${Bs.p3.results ? `<span class="note">rolled ${r.d20 || 'ally'}</span>` : ''}</div>`).join('')}
      ${B('boss3resolve', '🎲 Everyone rolls!', { cls: 'pri', dis: !!Bs.p3.results })}`;
  } else if (Bs.phase === 4) body = `<p class="bigres">${esc(Bs.result)}</p>${B('finish', '🏁 Show final results', { cls: 'pri' })}`;
  return `<div class="gcard"><h2>👹 ${BOSS.name}: ${BOSS.title}</h2><p><b>HP ${Bs.hp}/${Bs.max}</b> · Phase ${Math.min(Bs.phase, 3)}</p>${body}
    <div class="log" style="margin-top:10px">${Bs.log.map(l => `<div>${esc(l)}</div>`).join('')}</div></div>`;
}

function gmResults() {
  const f = S.final;
  return `<div class="gcard"><h2>${S.gameOver ? '💀 GAME OVER' : 'Final results'}</h2>
    <p class="bigres" style="color:${f.grade.color}">Grade ${f.grade.g}: ${esc(f.grade.title)} · ${f.total} pts</p>
    ${S.gameOver ? `<p class="bad">${esc(S.gameOverReasons.join('; '))}</p>` : ''}
    <table class="g">${f.parts.map(p => `<tr><td>${esc(p[0])}</td><td>${p[1]}</td></tr>`).join('')}</table>
    <div class="row" style="margin-top:10px">Leaderboard team name: <input type="text" id="callsign" maxlength="14" value="${esc(S.callsign)}" data-inp="callsign" placeholder="e.g. TEAM ALPHA">
    ${B('saveBoard', S.saved ? '✅ Saved to leaderboard' : '🏆 Save to leaderboard', { cls: 'pri', dis: S.saved })}</div>
    <div class="row">${B('board', S.showBoard ? 'Hide leaderboard on projector' : 'Show leaderboard on projector')} ${B('toDebrief', '🔌 Power down: reality debrief', { cls: 'go' })}</div></div>`;
}

function suggestions() {
  const q = [], L = S.log.map(l => l.t + ' ' + l.d).join(' | ');
  if (/Delegated and it failed/.test(L)) q.push('Who was responsible when that delegated task went wrong, and did your actions match that?');
  if (S.gameOver || S.flags.HONEST_BROKER || S.ach.includes('hardright')) q.push('What made the integrity shortcut tempting? What would it cost you in real life?');
  if (S.reveals) q.push("You uncovered an NPC's hidden trait. What would you have done differently if you'd known that from the start?");
  if (S.micLow) q.push('One encounter earned only 1 star. Redo that line now: what would you say to that Airman?');
  if (S.meters.mis >= 7 && S.meters.mor <= 4) q.push('You won the mission and lost the people. When is that the right call?');
  if (S.crisesSurvived) q.push('You hit a Crisis Event. Which earlier decision set that up?');
  if (S.usedMissions.includes('M3')) q.push('What barrier to creative thinking showed up in "We tried that in 2019," and what removes it?');
  return q.concat(DEBRIEF_ALWAYS);
}
function gmDebrief() {
  const dv = S.debrief;
  return `<div class="gcard"><h2>🔌 Reality debrief</h2>
    <div class="row">${B('dview', '📖 Decoder', { arg: 'decoder', cls: dv.view === 'decoder' ? 'on' : '' })} ${B('dview', '🕒 Replay timeline', { arg: 'timeline', cls: dv.view === 'timeline' ? 'on' : '' })}</div>
    ${dv.view === 'timeline' ? `<p class="note">Click an event to spotlight it on the projector.</p><div class="log" style="max-height:260px">${S.log.map((l, i) => `<div><button class="b sm ${dv.spot === i ? 'on' : ''}" data-act="spot" data-arg="${i}">🔦</button> N${l.n} · <b>${esc(l.t)}</b> ${esc(l.d)}</div>`).join('')}</div>` : ''}
    <h3 style="margin-top:12px">Suggested questions</h3><ol>${suggestions().map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
    <div class="gcard"><h3>Practicum rubric (GM only) · Reflection 8 · Engagement 6 · Concepts 6 = /20</h3>
    ${S.party.map((p, i) => { const g = S.grades[i] || { ref: 0, eng: 0, con: 0, notes: '' }; return `<div class="gchoice"><b>${esc(p.name)}</b> <span class="note">${CLASS[p.cls].name}</span> · <b>${(+g.ref) + (+g.eng) + (+g.con)}/20</b>
      ${[['ref', 'Reflection', 8], ['eng', 'Engagement', 6], ['con', 'Concepts', 6]].map(([k, lbl, mx]) => `<div class="slider">${lbl}<input type="range" min="0" max="${mx}" value="${g[k]}" data-inp="grade" data-arg="${i},${k}"><b>${g[k]}</b></div>`).join('')}
      <textarea placeholder="Notes" data-inp="gnote" data-arg="${i}">${esc(g.notes)}</textarea></div>`; }).join('')}
    <div class="row">${B('saveGrades', S.gradesSaved ? '✅ Grades saved' : '💾 Save grades')} ${B('exportCSV', '📊 Export all grades CSV')} ${B('newRun', '▶️ Next party: new run', { cls: 'pri' })}</div></div>`;
}

function gmSideLite() {
  return `<div class="gcard"><h3>Your GM cards this run</h3>${S.gmCards.map(id => { const c = GM_CARDS.find(x => x.id === id); return `<div><b>🃏 ${c.name}</b> <span class="note">${c.text}</span></div>`; }).join('')}</div>
  <div class="gcard"><h3>Quick reference</h3><p class="note">Checks: d20 + stat (+2 if the tied meter is 8+, −2 if 2 or less). Normal 13, Hard 16. Nat 20 = crit (double good + loot). Nat 1 = fumble.<br>Score = meters×3 + lowest meter×10 + boss + stars×5 + achievements×10 + allies×5 + unused×5.</p></div>`;
}
function gmSide() {
  const lt = S.lt;
  return `
  <div class="gcard"><h3>Meters (manual override)</h3><div class="gmeters">${METERS.map(m => `<div class="mt">${m.icon}<span>${m.name}</span>${B('meter', '−', { arg: m.k + ',-1', cls: 'sm' })}<b>${S.meters[m.k]}</b>${B('meter', '+', { arg: m.k + ',1', cls: 'sm' })}</div>`).join('')}</div>
    ${S.crisisQueue.length ? `<p class="warnline">Crisis queued: ${S.crisisQueue.map(k => METER[k].name).join(', ')}</p>` : ''}</div>
  <div class="gcard"><h3>👑 Command Token & party</h3>
    ${S.party.map((p, i) => { const ab = CLASS[p.cls].ability; return `<div class="row"><b>${CLASS[p.cls].icon} ${esc(p.name)}</b>
      ${B('token', S.tokenHolder === i ? '👑 holder' : 'give 👑', { arg: i, cls: S.tokenHolder === i ? 'on sm' : 'sm' })}
      ${ab ? B('ability', `${esc(ab.name)} ${p.used >= abilityLimit(p) ? '(used)' : ''}`, { arg: i, cls: 'sm', dis: p.used >= abilityLimit(p), title: ab.text }) : ''}
      <span class="note">${esc(perkOf(p).name)}${p.up ? ' · ' + esc(upOf(p).name) : ''}</span></div>`; }).join('')}
    ${S.tokenHolder !== fcIdx() ? '<p class="warnline">Token delegated: failed checks also cost the FLT/CC ⭐ −1 (until the node ends).</p>' : ''}
    ${S.forecast ? `<p class="warnline">🔮 Forecast: ${MURPHY[S.forecast.idx].name} ${S.forecast.blocked ? '(BLOCKED)' : B('block', 'Block it', { cls: 'sm' })}</p>` : ''}</div>
  <div class="gcard"><h3>Leadership tokens (one each per run)</h3><div class="row">
    ${[['pause', '⏸️ Tactical Pause'], ['intel', '🔎 Intel Briefing'], ['waiver', '📝 Submit a Waiver']].map(([k, l]) => B('ltToggle', `${l} ${lt[k] ? '✅' : '✖'}`, { arg: k, cls: 'sm', title: 'Click to toggle (manual fix)' })).join('')}</div></div>
  <div class="gcard"><h3>NPCs</h3>${S.npcs.map(n => { const t = TRAIT[n.trait]; return `<div class="row"><b>${n.slot}</b> ${esc(n.rank + ' ' + n.name)}
      ${B('loy', '−', { arg: n.slot + ',-1', cls: 'sm' })}<b>${n.loy}</b>${B('loy', '+', { arg: n.slot + ',1', cls: 'sm' })}
      <span class="${n.revealed ? 'warnline' : 'note'}">${t.icon} ${t.name}${n.revealed ? '' : ' (hidden)'}</span>
      ${n.revealed ? '' : B('reveal', 'reveal', { arg: n.slot, cls: 'sm' })}${isAlly(n) ? ' <span class="pill y">ALLY</span>' : ''}${n.out ? ` <span class="pill">out ${n.out}</span>` : ''}${n.broken ? ' <span class="pill">broken</span>' : ''}</div>`; }).join('')}</div>
  <div class="gcard"><h3>Inventory (${S.items.length}/3)</h3>${S.items.length ? S.items.map((id, k) => { const it = LOOT.find(l => l.id === id); return `<div class="row">${it.icon} <b>${esc(it.name)}</b> <span class="note">${esc(it.text)}</span> ${B('item', 'use', { arg: k, cls: 'sm' })} ${B('discard', '✖', { arg: k, cls: 'sm' })}</div>`; }).join('') : '<p class="note">Empty</p>'}
    ${S.items.length > 3 ? '<p class="warnline">Over capacity: the party must discard one.</p>' : ''}${S.pending.coffee ? '<p class="note">☕ Coffee armed for the next roll</p>' : ''}${S.pending.sticky ? '<p class="note">📝 Sticky Note armed for the next encounter</p>' : ''}</div>
  <div class="gcard"><h3>GM cards</h3>${S.gmCards.map(id => { const c = GM_CARDS.find(x => x.id === id); const u = S.gmUsed.includes(id); return `<div class="row">${B('card', `🃏 ${c.name}`, { arg: id, dis: u, cls: 'sm' })} <span class="note">${esc(c.text)}</span></div>`; }).join('')}</div>
  <div class="gcard"><h3>Timer & banner</h3><div class="row">${[15, 30, 60, 90].map(s => B('timer', s + 's', { arg: s, cls: 'sm' })).join('')} ${B('timer', 'stop', { arg: 0, cls: 'sm' })} ${S.banner ? B('clearBanner', 'clear banner', { cls: 'sm' }) : ''}</div></div>
  <div class="gcard"><h3>Achievements (${S.ach.length})</h3><div>${ACHIEVEMENTS.map(a => `<button class="b sm ${S.ach.includes(a.id) ? 'on' : ''}" data-act="achToggle" data-arg="${a.id}" title="${esc(a.text)}">${a.icon} ${esc(a.name)}</button>`).join(' ')}</div></div>
  <div class="gcard"><h3>Run log</h3><div class="log">${S.log.slice().reverse().map(l => `<div>N${l.n} · <b>${esc(l.t)}</b> ${esc(l.d)}</div>`).join('')}</div></div>`;
}

/* ---------------- GM actions ---------------- */
act('openPlayer', () => {
  playerWin = window.open(location.href.split('#')[0] + '#player', 'sqPlayer', 'width=1280,height=760');
  return false;
});
act('mute', () => { S.muted = !S.muted; });
act('board', () => { S.showBoard = !S.showBoard; });
act('undo', () => { if (!hist.length) return false; hist.pop(); S = JSON.parse(hist.pop() || JSON.stringify(S)); });
act('newRun', () => { if (S.phase !== 'title' && S.phase !== 'debrief' && !confirm('Abandon this run and start a new one?')) return false; startRun(); });
act('resume', () => { try { S = JSON.parse(localStorage.getItem('sq_run')); } catch (e) { } });
act('introNext', () => { S.introPage = 1; sfx('click'); });
act('introPrev', () => { S.introPage = 0; });
act('toParty', () => { S.phase = 'party'; sfx('start'); });
act('setAv', a => { const [i, k] = a.split(',').map(Number); S.party[i].av = k; sfx('click'); });
act('avDone', () => { S.phase = 'unit'; log('Avatars', 'Chosen'); sfx('start'); });
act('lockParty', () => { const w = lockParty(); S.partyWarn = w; if (w) return; S.partyWarn = ''; sfx('level'); });
act('lockPerks', () => { const w = lockPerks(); S.partyWarn = w; if (w) return; S.partyWarn = ''; sfx('start'); });
act('backToClasses', () => {
  S.phase = 'party'; S.partyWarn = '';
  while (S.party.length < 4) S.party.push({ name: '', cls: '', perk: '', up: '', used: 0, av: null });
});
act('rollUnit', () => rollUnit());
act('showManifest', () => { S.phase = 'manifest'; sfx('start'); });
act('toMap', () => { S.map = genMap(); S.phase = 'map'; sfx('start'); });
act('node', a => { const [t, i] = a.split(',').map(Number); chooseNode(t, i); });
act('collapse', () => { log('GM', 'Skipped the remaining stops for time'); if (!S.leveled) { S.leveled = true; } startBoss(); });
act('choose', a => choose(+a));
act('ltIntel', () => { S.lt.intel = false; S.cur.intel = true; log('Leadership token', 'Intel Briefing'); toast('🔎', 'INTEL BRIEFING', 'Exact effects revealed'); sfx('loot'); });
act('ltPause', () => { S.lt.pause = false; S.timer = { end: Date.now() + 30000, label: 'TACTICAL PAUSE' }; log('Leadership token', 'Tactical Pause'); sfx('click'); });
act('timer', a => { S.timer = +a ? { end: Date.now() + (+a) * 1000, label: S.cur && S.cur.step === 'stars' ? 'ACT IT OUT' : 'DECIDE' } : null; });
act('roller', a => { S.cur.roller = +a; });
act('lead', a => { S.cur.lead = +a; });
act('coffee', () => { S.pending.coffee = !S.pending.coffee; });
act('sticky', () => { S.pending.sticky = !S.pending.sticky; });
act('typ', () => { S.cur.typ = !S.cur.typ; });
act('resolveRoll', () => resolveRoll(S.cur.roller ?? S.tokenHolder, { coffee: S.pending.coffee, typ: S.cur.typ }));
act('stars', a => rateStars(+a, S.cur.lead ?? S.tokenHolder));
act('waiver', () => {
  const pre = JSON.parse(S.cur.preRoll); S = pre; S.lt.waiver = false; S.cur.step = 'roll';
  toast('📝', 'WAIVER APPROVED', 'Roll again!'); sfx('loot'); log('Leadership token', 'Submit a Waiver (reroll)');
});
act('fumble', () => spinFumble());
act('loot', () => spinLoot());
act('nodeDone', () => afterNode());
act('restMeter', k => { applyEff({ [k]: 2, why: 'Rest Stop' }); S.cur.step = 'done'; S.cur.result = `+2 ${METER[k].name}`; });
act('restRecharge', i => { S.party[+i].used = 0; S.cur.step = 'done'; S.cur.result = `${cadetName(+i)}'s ability recharged`; toast('🔋', 'RECHARGED', cadetName(+i)); log('Rest Stop', 'Ability recharged'); });
act('restLoy', () => { S.npcs.forEach(n => changeLoy(n.slot, 1)); S.cur.step = 'done'; S.cur.result = '+1 loyalty to all NPCs'; log('Rest Stop', '+1 loyalty all'); });
act('depotLoot', () => { applyEff({ res: -2 }); const it = spinLoot(); S.cur.step = 'done'; S.cur.result = `Bought: ${it.icon} ${it.name}`; });
act('depotRes', k => { applyEff({ [k]: -2, res: 2, why: 'Supply Depot trade' }); S.cur.step = 'done'; S.cur.result = `Traded 2 ${METER[k].name} for +2 📦`; });
act('depotToken', () => { const k = Object.keys(S.lt).find(t => !S.lt[t]); applyEff({ tru: -2 }); S.lt[k] = true; S.cur.step = 'done'; S.cur.result = 'Bought back a Leadership Token'; log('Supply Depot', 'Token bought back'); });
act('depotSkip', () => { S.cur.step = 'done'; S.cur.result = 'No trade'; });
act('spinMystery', () => {
  const c = S.cur;
  showDie(6, c.mystery + 1, 'UNKNOWN TERRITORY · d6', MYSTERY.map((m, i) => `${i + 1} ${m.name}`).join(' · ') + `  ➜  ${MYSTERY[c.mystery].name}`);
  c.step = 'revealed'; log('Unknown node', MYSTERY[c.mystery].name);
});
act('mysteryGo', () => {
  const id = MYSTERY[S.cur.mystery].id;
  if (id === 'crisis' || id === 'elite') return enterNode(id);
  if (id === 'wing') { S.votes = {}; S.cur = { type: 'crisis', wing: true, step: 'brief', choice: null, intel: false }; sfx('start'); return; }
  if (id === 'loot') { S.cur = { type: 'depot', step: 'done', result: 'Free loot!' }; spinLoot(); return; }
  S.phase = 'inject'; S.cur = null;
  S.inject = { stage: 'murphy', filter: id === 'bad' ? 'bad' : 'good', fromNode: true };
  spinMurphy();
});
act('spinTrigger', () => spinTrigger());
act('spinMurphy', () => spinMurphy());
act('applyInject', a => applyInject(+a));
act('closeInject', () => closeInject());
act('confirmLevel', () => {
  S.party.forEach(p => { if (p.up === 'wind') p.used = 0; if (p.up === 'contingency') S.contingency = true; });
  S.leveled = true; log('Level up', S.party.map(p => `${p.name}: ${upOf(p).name}`).join('; '));
  emit('levelDone'); sfx('level'); advance();
});
act('boss1', () => bossPhase1());
act('boss2', () => bossPhase2Start());
act('bossStar', a => { const [j, n] = a.split(',').map(Number); S.boss.p2.stars[j] = n; });
act('hotSeat', () => bossHotSeat());
act('boss2resolve', () => bossPhase2Resolve());
act('boss3', () => bossPhase3Start());
act('boss3resolve', () => {
  const bad = S.boss.p3.rows.findIndex(r => !r.ally && !r.stat);
  if (bad >= 0) { alert(`${cadetName(bad)} needs to pick a stat.`); return false; }
  bossPhase3Resolve();
});
act('spendWaiver', () => { S.lt.waiver = false; log('Leadership token', 'Waiver (boss reroll)'); });
act('finish', () => finishGame());
act('saveBoard', () => { if (!S.callsign.trim()) { alert('Enter a team name first.'); return false; } saveToBoard(); S.showBoard = true; sfx('ach'); });
act('toDebrief', () => { S.phase = 'debrief'; S.showBoard = false; S.timer = null; S.banner = null; emit('powerdown'); });
act('dview', v => { S.debrief.view = v; S.debrief.spot = null; });
act('spot', i => { S.debrief.spot = S.debrief.spot === +i ? null : +i; S.debrief.view = 'timeline'; });
act('saveGrades', () => {
  const all = loadGrades(), u = UNITS.find(x => x.id === S.unit);
  S.party.forEach((p, i) => { const g = S.grades[i] || { ref: 0, eng: 0, con: 0, notes: '' };
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
act('meter', a => { const [k, v] = a.split(','); applyEff({ [k]: +v, why: 'GM adjust' }); });
act('loy', a => { const [s, v] = a.split(','); changeLoy(s, +v); log('GM adjust', `${npcLabel(S, s)} loyalty ${sign(+v)}`); });
act('reveal', s => reveal(s));
act('token', i => { S.tokenHolder = +i; log('Command Token', `now held by ${cadetName(+i)}`); toast('👑', 'COMMAND TOKEN', `${cadetName(+i)} has the token`); });
act('ability', i => useAbility(+i));
act('block', () => { S.forecast.blocked = true; log('Foresight', 'Next inject blocked'); });
act('ltToggle', k => { S.lt[k] = !S.lt[k]; });
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
  const live = e.type === 'input';
  switch (k) {
    // typed fields update quietly (no GM re-render) so a click on a button right
    // after typing isn't swallowed by the DOM being rebuilt underneath it
    case 'pname': S.party[+a].name = el.value; if (!live) push(true); else save(); return;
    case 'callsign': S.callsign = el.value; save(); return;
    case 'site': localStorage.setItem('sq_site', el.value.trim()); if (!live) push(true); return;
    case 'gnote': S.grades[+a] = S.grades[+a] || { ref: 0, eng: 0, con: 0, notes: '' }; S.grades[+a].notes = el.value; S.gradesSaved = false; save(); return;
    case 'b3d20': S.boss.p3.rows[+a].d20 = el.value; save(); return;
  }
  if (live && k !== 'grade') return;
  snap();
  switch (k) {
    case 'pcls': S.party[+a].cls = el.value; S.party[+a].perk = ''; break;
    case 'pperk': S.party[+a].perk = el.value; break;
    case 'pup': S.party[+a].up = el.value; break;
    case 'witness': S.boss.witnessHandled = el.checked; break;
    case 'b3stat': S.boss.p3.rows[+a].stat = el.value; break;
    case 'b3ally': S.boss.p3.rows[+a].ally = el.checked; break;
    case 'grade': { const [i, f] = a.split(','); S.grades[+i] = S.grades[+i] || { ref: 0, eng: 0, con: 0, notes: '' }; S.grades[+i][f] = +el.value; S.gradesSaved = false; if (live) { save(); el.nextElementSibling.textContent = el.value; return; } break; }
  }
  push();
}

function initGM() {
  document.body.className = 'gm';
  S = newState();
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
        if (d.leaderboard) { const merged = loadBoard().concat(d.leaderboard.filter(x => !loadBoard().some(y => y.date === x.date))); saveBoard(merged); }
        if (d.grades) { const g = loadGrades(); localStorage.setItem('sq_grades', JSON.stringify(g.concat(d.grades.filter(x => !g.some(y => y.date === x.date && y.cadet === x.cadet))))); }
        alert('Imported.'); push();
      } catch (err) { alert('Could not read that file.'); }
    });
  });
  window.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'hello') return;
    const fresh = e.source && e.source !== playerWin;
    if (e.source) playerWin = e.source;
    if (fresh || e.data.need) push(!fresh);
  });
  if (bc) bc.onmessage = e => { if (e.data && e.data.type === 'hello' && e.data.need) push(true); };
  setInterval(() => { if (S.timer && Date.now() > S.timer.end + 3000) { S.timer = null; push(); } }, 1000);
  if (typeof netStart === 'function') netStart();
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
