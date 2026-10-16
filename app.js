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
function presetAvatar(i, uni, hair) {
  const key = `${i}|${uni || ''}|${hair || ''}`;
  if (_pav[key]) return _pav[key];
  const a = { ...(AVATARS[i] || AVATARS[0]) }, hc = HAIR_COLORS.find(h => h.id === hair);
  if (hc && hc.c) a.hair = hc.c;
  const c = document.createElement('canvas'); c.width = c.height = 12;
  const x = c.getContext('2d'), R = (col, px, py, w, h) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  R(`hsl(${i * 47 % 360},40%,22%)`, 0, 0, 12, 12);
  switch (uni) { // uniform (cosmetic)
    case 'ocp': R('#7d7a5a', 1, 10, 10, 2); R('#5b5a3e', 2, 10, 1, 1); R('#9a8f6a', 5, 11, 2, 1); R('#4a4a32', 8, 10, 1, 1); R('#3a3a28', 9, 11, 1, 1); break;
    case 'blues': R('#1b2a55', 1, 10, 10, 2); R('#dfe6f0', 5, 10, 2, 1); R('#1b2a55', 5, 11, 2, 1); R('#c0c0c0', 3, 10, 1, 1); break;
    case 'flight': R('#6f7a52', 1, 10, 10, 2); R('#3a3f2a', 3, 11, 2, 1); R('#3a7bd5', 8, 10, 1, 1); break;
    case 'pt': R('#3d4552', 1, 10, 10, 2); R('#cfd8e3', 4, 10, 4, 1); break;
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
// A class's badge: its rank insignia (replaces the old class emoji). h = height in px.
function clsIcon(clsId, h) { const c = CLASS[clsId]; return c ? `<span class="clsins">${rankSvg(c.ins || c.rank, h)}</span>` : ''; }
// An NPC / commander's insignia from a "Lt Col Name" label (nothing for civilians)
function npcIns(label, h) { const r = RANK_ORDER.slice().sort((a, b) => b.length - a.length).find(x => String(label || '').startsWith(x + ' ')); return r ? rankSvg(r, h) : ''; }
// The chain of command for the 👑 tie-break: Flight Commander, then the SEL, the XO (1st Lt), Plans (2d Lt), the First Sergeant, the UTM
const CHAIN = ['fc', 'chief', 'xo', 'plans', 'shirt', 'utm'];
// the next cadet in the chain who isn't fired (skip = a seat to pass over), or -1
function nextInChain(S, skip) { const ok = (S.party || []).map((p, i) => i).filter(i => i !== skip && !S.party[i].fired && S.party[i].cls);
  return ok.sort((a, b) => (CHAIN.indexOf(S.party[a].cls) + 1 || 99) - (CHAIN.indexOf(S.party[b].cls) + 1 || 99))[0] ?? -1; }
// Who holds the 👑 tie-break: the Flight Commander, or (no FC in the party / once they're fired) the next in the chain of command
function crownIdx(S) { if (!S || !S.party) return -1; if (S.crown != null) return S.crown; return S.party.findIndex(c => c.cls === 'fc'); }
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
function setPatch(id) { const p = (PATCHES[S.unit] || []).find(x => x.id === id); S.patch = id; S.callsign = p ? p.name.toUpperCase() : ''; }

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
// an ability / perk text as badge + text (the Flight Commander's Command Token is passive)
function useHtml(text, kind) { const u = useSplit(text); return `${useBadge(kind || u.kind)} ${mt(esc(u.text))}`; }
/* What a choice can do to each meter, computed from its real effects so nothing is hidden:
   the same change in every outcome → that many ▲/▼ (up to 3); a change that depends on the roll or
   the acting (or differs by class) → ❔. Delayed fallout (next:) is still a surprise by design. */
function choiceShow(ch) {
  const outs = [];
  const add = (pre, e) => { const o = {}; METERS.forEach(m => { o[m.k] = ((pre || {})[m.k] || 0) + ((e || {})[m.k] || 0); if ((e && e.set && e.set[m.k] != null) || (pre && pre.set && pre.set[m.k] != null)) o[m.k] = 'set'; }); outs.push(o); };
  const one = c => {
    if (c.kind === 'check' && c.check) { add(c.pre, c.check.pass); add(c.pre, c.check.fail); }
    else if (c.kind === 'stars' && c.stars) c.stars.forEach(st => add(c.pre, st));
    else add(c.pre, c.eff);
  };
  if (ch.ifClass) { one({ ...ch, ...normal(ch.ifClass.then), pre: ch.pre }); one({ ...ch, ...normal(ch.ifClass.else), pre: ch.pre }); } else one(ch);
  return METERS.map(m => {
    const vals = outs.map(o => o[m.k]); if (vals.every(v => !v)) return null;
    if (vals.every(v => v === vals[0]) && vals[0] !== 'set') return [m.k, Math.max(-3, Math.min(3, vals[0]))];
    return [m.k, '?'];
  }).filter(Boolean);
}
// returns HTML: labelled meter + green up-arrows / red down-arrows
function arrows(show) {
  return (show || []).map(([k, n]) => `<span class="arw">${meterTag(k)}${n === '?' ? '❔' : `<span class="${n > 0 ? 'up' : 'dn'}">${(n > 0 ? '▲' : '▼').repeat(Math.abs(n))}</span>`}</span>`).join(' ');
}
/* Power-ups that are worth using RIGHT NOW (tokens, items, class abilities, perks).
   Shown on the projector and on phones so cadets notice "we could use X here".
   who: party slot that owns it, or null for team stuff. req: what a phone sends. */
function usableNow(S) {
  const out = []; if (!S || !S.party) return out;
  const c = S.cur, ph = S.phase, inj = S.inject, items = S.items || [], pend = S.pending || {};
  const has = id => items.includes(id);
  const mission = ph === 'node' && c && !['rest', 'depot', 'unknown'].includes(c.type);
  const add = (who, req, icon, label, hint, hot) => out.push({ who, req, icon, label, hint, hot: !!hot });
  // team items: when each kind of item helps (see LOOT use types in data.js)
  const anytime = ['map', 'node', 'inject', 'boss'].includes(ph);
  items.forEach(id => {
    const l = LOOT.find(x => x.id === id); if (!l) return;
    const u = l.use, req = 'item:' + id, hint = fill(S, l.text);
    if (u.type === 'check' && mission && c.step === 'roll' && !pend.check) add(null, req, l.icon, l.name, `+${u.n} on this roll`, true);
    if (u.type === 'star' && mission && c.step === 'stars' && !pend.star) add(null, req, l.icon, l.name, '+1 star on this encounter', true);
    if (u.type === 'undo' && mission && c.step === 'done' && c.choice != null) add(null, req, l.icon, l.name, 'Undo that decision and choose again');
    if (u.type === 'wheel' && ph === 'inject' && inj && inj.stage === 'trigger') add(null, req, l.icon, l.name, 'Skip the d6: pick Meh or Success', true);
    if (u.type === 'cancel' && ph === 'inject' && inj && inj.stage === 'done' && inj.idx != null && MURPHY[inj.idx].type === 'bad' && !inj.cancelled) add(null, req, l.icon, l.name, 'Cancel this Wheel of Failure result!', true);
    if (u.type === 'intel' && mission && c.step === 'brief' && !c.intel) add(null, req, l.icon, l.name, 'See the exact effects of every choice');
    if (u.type === 'deocs' && anytime && !deocsOn(S)) add(null, req, l.icon, l.name, `See the exact meters for ${DIFFICULTY.deocsStops} stops`, METERS.some(m => S.meters[m.k] <= DIFFICULTY.dangerAt));
    if (u.type === 'meter' && anytime) add(null, req, l.icon, l.name, hint, METERS.some(m => (u.eff[m.k] || 0) > 0 && S.meters[m.k] <= 2));
    if (u.type === 'anyMeter' && anytime) add(null, req, l.icon, l.name, `+${u.n} to any meter`, METERS.some(m => S.meters[m.k] <= 2));
    if ((u.type === 'loyAll' || u.type === 'loyOne') && anytime && (S.npcs || []).some(n => n.loy < 5)) add(null, req, l.icon, l.name, hint, (S.npcs || []).some(n => n.loy <= 1));
    if (u.type === 'branch' && branchUseful(S)) add(null, req, l.icon, l.name, branchUseful(S));
    if (u.type === 'recharge' && anytime && S.party.some(p => (p.used && CLASS[p.cls] && CLASS[p.cls].ability && !CLASS[p.cls].ability.auto) || (p.perk && p.perk !== 'hold' && (S.flags || {})['perkUsed_' + p.perk]))) add(null, req, l.icon, l.name, 'Recharge a used ability or perk');
  });
  const inGame = ['map', 'node', 'inject', 'boss'].includes(ph);
  if (!inGame) return out;
  S.party.forEach((p, i) => {
    const cl = CLASS[p.cls]; if (!cl || p.fired) return;
    const ab = cl.ability;
    if (ab && !ab.auto && p.used < abilityLimit(p)) {
      if (ab.id === 'rally') add(i, 'ability', clsIcon(p.cls, 18), ab.name, '❤️ +2 and every Unit member +1 loyalty', S.meters.mor <= 3 || (S.npcs || []).some(n => n.loy <= 1));
      if (ab.id === 'pcs' && pcsCandidates(S).length) add(i, 'ability', clsIcon(p.cls, 18), ab.name, 'PCS an enlisted Unit member: a hand-picked replacement (one rank up, loyalty 4, an Ally)', pcsCandidates(S).some(n => n.loy <= 1));
      if (ab.id === 'sevenlvl' && S.meters.mis < 10) add(i, 'ability', clsIcon(p.cls, 18), ab.name, '+3 🎯', S.meters.mis <= 3);
    }
    const w = perkWhen(S, p, i);
    if (w) { const pk = cl.perks.find(k => k.id === p.perk) || {}; add(i, 'perk:' + p.perk, pk.icon || '🎁', pk.name || p.perk, w.hint, w.hot); }
  });
  // "moment" = only useful right now (cancel this result, reroll this failure, skip this die...):
  // the projector asks the team to decide; everything else lives on phones as "You can use now"
  out.forEach(u => {
    const it = u.req.startsWith('item:') && LOOT.find(l => l.id === u.req.slice(5));
    u.moment = (it && ['cancel', 'wheel', 'undo'].includes(it.use.type)) || ['perk:beenthere', 'perk:lead', 'perk:mti', 'perk:ear'].includes(u.req);
  });
  return out;
}
// When each perk can be used (null = not now). Perks are once per game; Hold the Line fires on its own.
function perkWhen(S, p, i) {
  if (!p.perk || p.fired || (S.flags || {})['perkUsed_' + p.perk]) return null;
  const c = S.cur, ph = S.phase, inj = S.inject, Bs = S.boss, pend = S.pending || {};
  const mission = ph === 'node' && c && !['rest', 'depot', 'unknown'].includes(c.type);
  const anytime = ['map', 'node', 'inject', 'boss'].includes(ph);
  const npcs = S.npcs || [];
  switch (p.perk) {
    case 'beenthere': return ph === 'inject' && inj && inj.stage === 'done' && inj.idx != null && MURPHY[inj.idx].type === 'bad' && !inj.cancelled && !inj.blocked ? { hint: 'Cancel this Wheel of Failure result', hot: true } : null;
    case 'ncopull': return anytime && npcs.some(n => !n.gone && n.loy < 5) ? { hint: 'One Unit member +3 loyalty', hot: npcs.some(n => !n.gone && n.loy <= 1) } : null;
    case 'deocs': return anytime && !deocsOn(S) ? { hint: `See the exact meters for ${DIFFICULTY.deocsStops} stops, everyone +1 loyalty`, hot: METERS.some(m => S.meters[m.k] <= DIFFICULTY.dangerAt) } : null;
    case 'resiliency': return anytime && S.meters.mor <= 7 ? { hint: '❤️ +3, everyone +1 loyalty, 🎯 −1' } : null;
    case 'readroom': return mission && c.step === 'brief' && !c.intel && c.type !== 'crisisEvent' ? { hint: 'See the exact effects of every choice' } : null;
    case 'ear': return S.lastTruLoss > 0 ? { hint: `Cancel the last ⭐ loss (−${S.lastTruLoss})`, hot: true } : null;
    case 'emergency': return anytime && S.meters.res <= 7 ? { hint: '+3 📦 right now', hot: S.meters.res <= 2 } : null;
    case 'prepo': return ph === 'node' && c && c.type === 'depot' && c.step === 'choose' && !pend.prepo ? { hint: 'The next BX purchase costs no 📦', hot: S.meters.res <= 2 } : null;
    case 'lead': return leadTarget(S) ? { hint: 'Turn that failed roll into a pass (⭐ −1)', hot: true } : null;
    case 'mti': return leadTarget(S) ? { hint: 'Take command: that failed roll counts as a pass', hot: true } : null;
    case 'readiness': return ['map', 'node', 'inject'].includes(ph) && !(S.flags || {}).MOCK_INSPECTION ? { hint: `Mock inspection: the IG starts with ${DIFFICULTY.mockInsp} less HP` } : null;
  }
  return null;
}
// Branch Plan (loot item): only worth it when your path actually blocks some of the next stops. Returns the hint or ''.
function branchUseful(S) {
  if (S.phase !== 'map' || !S.map || S.branch || S.pos.tier < 0 || S.pos.tier >= S.map.tiers.length - 1) return '';
  const reach = (S.map.links[S.pos.tier][S.pos.idx] || []).length, all = S.map.tiers[S.pos.tier + 1].length;
  return reach < all ? `Your path reaches ${reach} of ${all} next stops: unlock all of them` : '';
}
// Talent Management (SEL): the enlisted Unit members who can be PCSed out
const pcsCandidates = S => (S.npcs || []).filter(n => n.enlisted && !n.gone && !n.handpicked);
const RANK_UP = { AB: 'Amn', Amn: 'A1C', A1C: 'SrA', SrA: 'SSgt', SSgt: 'SSgt' }; // the org chart tops out at SSgt
const PCS_TRAITS = ['mentor', 'genius', 'overach', 'cynic', 'climber']; // a hand-picked Airman comes with an upside
// what Lead From the Front would turn into a pass right now (a failed scenario check or Tackle it)
function leadTarget(S) { const t = memoTarget(S); return t === 'boss' ? null : t; }
function memoTarget(S) {
  const c = S.cur, inj = S.inject, Bs = S.boss;
  if (S.phase === 'node' && c && c.step === 'done' && c.rollRes && !c.rollRes.pass && !c.rollRes.safe && c.preRoll) return 'mission';
  if (S.phase === 'inject' && inj && inj.stage === 'done' && inj.tackleFail && inj.preTackle && !inj.cancelled) return 'tackle';
  if (S.phase === 'boss' && Bs && Bs.stage === 'resolved' && (Bs.lastFails || []).length) return 'boss';
  return null;
}
// a stat-gated choice is open when any cadet has the stat at the minimum
function gateOpen(req) { return !req || S.party.some((_, i) => statOf(i, req.stat) >= req.min); }

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
function tackleInfo(m, roller) {
  const t = m.tackle, r = roller != null ? roller : bestRoller(t.stat, t.m), b = rollBonus(r, t.stat, t.m), dc = t.dc + DIFFICULTY.dcPlus, need = Math.min(20, Math.max(2, dc - b));
  return { stat: t.stat, who: cadetName(r), bonus: b, dc, need, pct: (21 - need) * 5, fail: effChips(t.fail || {}) };
}
function tackleRows(m, roller) {
  const k = tackleInfo(m, roller);
  return `<div class="tkrow">🎲 ${esc(k.who)} rolls ${k.stat} ${sign(k.bonus)}: needs <b>${k.need}+</b> (${k.pct}%)</div>
    <div class="tkrow tkok">✅ PASS: no loss</div><div class="tkrow tkbad">❌ FAIL: ${k.fail}</div>`;
}
function effText(S, e) {
  if (!e) return 'no change';
  const out = [];
  if (e.set) for (const k in e.set) out.push(`${METER[k].icon} set to ${e.set[k]}`);
  for (const m of METERS) if (e[m.k]) out.push(`${m.icon}${sign(e[m.k])}`);
  if (e.loy) for (const s in e.loy) out.push(`${npcLabel(S, s)} loyalty ${sign(e.loy[s])}`);
  if (e.traitLoy) out.push(`${TRAIT[e.traitLoy.trait].name} Unit members loyalty ${sign(e.traitLoy.d)}`);
  if (e.traitAny) out.push(`if ${e.traitAny.slot ? npcLabel(S, e.traitAny.slot) + ' is ' : 'any NPC is '}${(e.traitAny.traits || [e.traitAny.trait]).map(t => TRAIT[t].name).join('/')}: ${effText(S, e.traitAny.eff)}`);
  if (e.reveal) out.push(`reveals ${npcLabel(S, e.reveal)}'s trait`);
  if (e.next) out.push(`next node${e.next.p != null ? ` (${Math.round(e.next.p * 100)}% chance)` : ''}: ${effText(S, e.next)}`);
  if (e.offlineSelf) out.push('you are offline next stop');
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
  if (ch.kind === 'check') parts.push(`${statLabel(ch.check.stat)} vs ${checkDC(ch.check)} · PASS: ${effText(S, ch.check.pass)} · FAIL: ${effText(S, ch.check.fail)}`);
  if (ch.kind === 'stars') parts.push(ch.stars.map((e, i) => `${i + 1}★ ${effText(S, e)}`).join(' · '));
  return parts.join(' · ');
}
function normal(sub) { return { kind: sub.kind || 'fx', eff: sub.eff, check: sub.check }; }

/* ---------------- scoring ---------------- */
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
  parts.push(['Inspection result', S.bossBonus || 0], ['🎤 stars ×5', (S.starsTotal || 0) * 5],
    ['Achievements', (S.ach || []).reduce((a, id) => a + ((ACH[id] && ACH[id].pts) ?? 10), 0)], ['Unit Allies ×10', allies * 10]);
  return { parts, total: parts.reduce((a, p) => a + p[1], 0) };
}
function gradeFor(S, total) {
  if (S.gameOver) return { g: 'F', title: 'GAME OVER', strat: GAME_OVER_TEXT, color: '#ff3b5c' };
  return GRADES.find(g => total >= g.min);
}
function isAlly(n) { return !n.gone && (n.loy >= 5 || ((n.handpicked || (n.trait === 'cynic' && n.revealed)) && n.loy >= 4)); } // hand-picked (Talent Management) and Cynic: Ally at 4

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
    items: [], flags: {}, ach: [], starsTotal: 0, intent: null, traitDone: {}, usedInjects: [],
    micCount: 0, micLow: false, crises: 0, crisisQueue: [], pendingNext: [], usedMissions: [],
    map: null, pos: { tier: -1, idx: null }, cur: null, inject: null, boss: null,
    gmCards: [], gmUsed: [], dcMod: 0, banner: null, timer: null, // gmCards: GM cards were removed
    log: [], offline: null, offlineNext: null, reveals: 0, lastTruLoss: 0,
    leveled: false, wp: null, gameOver: false, gameOverReasons: [], bossBonus: 0, callsign: '',
    saved: false, debrief: { view: 'objectives', spot: null }, stops: routeStops(), grades: {}, showBoard: false, muted: false,
    pending: { check: null, star: null, prepo: false }, usedLoot: [],
    spinUntil: 0, nodeCount: 0, final: null, wheel: null,
  };
}

/* ---- sync ---- */
// The title screen is never saved, so opening the console can't overwrite the run you want to resume.
function save() { if (S.phase === 'title') return; try { localStorage.setItem('sq_run', JSON.stringify(S)); } catch (e) { } }
// Which "screen" the game is on. When it changes, any running countdown ends,
// so a timer never carries over onto the next event.
function screenKey() {
  const c = S.cur, i = S.inject, b = S.boss;
  return [S.phase, S.introPage, S.nodeCount, c && c.type, c && c.step, c && c.mid,
    i && i.stage, i && i.forced, b && b.phase].join('|');
}
function push(quiet) {
  const key = screenKey();
  if (key !== S.screenKey) { if (S.screenKey !== undefined) S.timer = null; S.screenKey = key; }
  save();
  const fx = FX.map(f => ({ ...f, id: Date.now() + '-' + (++fxSeq) }));
  FX = [];
  const join = typeof roomCode === 'function' ? { code: roomCode(), url: joinUrl(), live: NET.status === 'live', full: typeof seatsFull === 'function' && seatsFull() } : null;
  const msg = { type: 'state', S: shownState(), fx, board: sortBoard(loadBoard()), join };
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
  return VEIL ? { ...VEIL, spinUntil: S.spinUntil, muted: S.muted, clients: S.clients } : S;
}
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
// A die with a table (lo, hi, label) first shows every possible outcome and sweeps across
// them (HYPE_MS) so the room knows what's at stake, then rolls and lights up the winner.
const DICE_MS = 2800, HYPE_MS = 6000;
function showDie(sides, v, title, result, table) {
  const ms = table ? HYPE_MS : DICE_MS;
  S.spinUntil = Math.max(S.spinUntil, Date.now() + ms);
  emit('dice', { sides, v, title, result, table: table || null });
  setTimeout(afterSpin, ms + 60);
}
function rollDie(sides, title, describe, table) {
  const v = 1 + rnd(sides);
  showDie(sides, v, title, describe ? describe(v) : '', table);
  return v;
}
// Foresight (Plans Officer, passive): while they're in the party, the d6 never lands on the Wheel of Failure
function foresightOn(S) { return (S.party || []).some(p => !p.fired && CLASS[p.cls] && CLASS[p.cls].ability && CLASS[p.cls].ability.id === 'foresight'); }
function wheelFor(d6) { const t = injectTypeFor(d6); return t === 'bad' && foresightOn(S) ? 'mixed' : t; }
function injectTable() { return INJECT_ORDER.map(t => { const [lo, hi] = injectRange(t).split('-').map(Number), w = t === 'bad' && foresightOn(S) ? 'mixed' : t; return { lo, hi: hi || lo, label: INJECT_WHEELS[w].name + (w !== t ? ' (Foresight)' : ''), icon: INJECT_WHEELS[w].icon, color: INJECT_WHEELS[w].color }; }); }
const MYSTERY_TABLE = () => MYSTERY.map((m, i) => ({ lo: i + 1, hi: i + 1, label: m.name, icon: m.icon, color: m.color }));
const LOOT_TABLE = () => [{ lo: 1, hi: 2, label: 'NO LOOT', icon: '💨', color: '#8f8fc8' }, { lo: 3, hi: 4, label: 'LOOT DROP', icon: '🎁', color: '#ffd23f' }];
// the table for whatever random event is waiting on a cadet's button (shown before they press it)
function actorTable(S) {
  const k = S.actor && S.actor.kind;
  return k === 'trigger' ? injectTable() : k === 'mystery' ? MYSTERY_TABLE() : k === 'lootd4' ? LOOT_TABLE() : null;
}
// A popup that explains a perk or ability the moment it is used; stays up until the GM continues
function notice(icon, title, text) { S.notice = { icon, title, text, at: Date.now() }; }
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
function meterBand(v) { return v <= DIFFICULTY.dangerAt ? { word: 'DANGER', cls: 'danger' } : v >= 7 ? { word: 'STRONG', cls: 'strong' } : { word: 'STEADY', cls: 'steady' }; }
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
const hasPerk = p => S.party.some(c => c.name && c.perk === p);
const hasUp = u => S.party.some(c => c.name && c.up === u);
const hasClass = id => S.party.some(c => c.name && c.cls === id);
// the cadet whose ability is Commander's Confidant (the XO), or -1
function confidantIdx(S) { return (S.party || []).findIndex(p => !p.fired && CLASS[p.cls] && CLASS[p.cls].ability && CLASS[p.cls].ability.id === 'confidant'); }
const unitObj = () => (S.unit ? UNITS.find(u => u.id === S.unit) : null);
const npc = s => S.npcs.find(n => n.slot === s);
const fcIdx = () => S.party.findIndex(c => c.cls === 'fc');
const cadetName = i => (S.party[i] ? rankName(S.party[i]) : '?');
function curMission() {
  const c = S.cur; if (!c) return null;
  if (c.type === 'spot') return SPOTLIGHTS.find(x => x.id === c.sid);
  if (c.type === 'crisisEvent') { const C = CRISES[c.meter]; return { title: C.title, icon: C.icon, sob: 'CRISIS EVENT', text: c.death || '', loss: c.lost || C.loss, help: !!C.help, choices: C.choices }; }
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
      ccHook('gain').forEach(h => { if (h.k === k) v = Math.max(0, v + h.d); });
      if (k === 'tru' && S.babysit > 0) v = Math.max(0, v - 1); // the CC's babysitter takes the credit
    } else {
      if (k === 'res' && hasUp('contingency')) v = Math.min(-1, v + 1);
      if (k === 'mis' && hasUp('proficiency')) v = Math.min(-1, v + 1);
      if (k === 'mor' && hasUp('engine')) v = Math.max(v, -1);
      if (k === 'tru' && hasUp('golden')) v = Math.min(-1, v + 1);
      if (k === 'tru' && opt.late) ccHook('late').forEach(h => { v *= 2; ccReact(h, 'Bad news delivered late: ⭐ loss doubled'); });
    }
    const old = S.meters[k];
    let nv = Math.max(0, Math.min(10, old + v));
    // Hold the Line (FC perk) fires on its own the first time a meter would hit 0
    if (nv === 0 && old > 0 && hasPerk('hold') && !S.flags.perkUsed_hold && !S.party.some(p => p.perk === 'hold' && p.fired)) {
      nv = 1; S.flags.perkUsed_hold = true;
      const f = S.party.find(p => p.perk === 'hold');
      notice('🛡️', `${rankName(f).toUpperCase()}: HOLD THE LINE!`, `${METER[k].label} would have hit 0. It stops at 1 instead.`);
      log('Perk', `${rankName(f)}: Hold the Line (${METER[k].label})`);
    }
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
  if (e.flag === 'BABYSITTER') S.babysit = 2;
  if (e.ach) award(e.ach);
  if (e.next) S.pendingNext.push(e.next);
  if (e.offlineSelf && S.cur && S.cur.slot != null) { S.offlineNext = S.cur.slot; log('Offline', `${cadetName(S.cur.slot)} is offline next stop`); }
  if (d.length) { emit('deltas', { d }); log('Meters', d.map(([k, v]) => METER[k].icon + sign(v)).join(' ') + (e.why ? ` (${e.why})` : '')); }
  checkZero();
}
// Trait rewards fire automatically (once per member unless noted) with a card everyone sees
function traitReward(n, text, eff, loy) {
  if (!n || n.broken || (S.traitDone || {})[n.slot]) return;
  S.traitDone = { ...(S.traitDone || {}), [n.slot]: true };
  const t = TRAIT[n.trait];
  emit('big', { cls: 'good', icon: t.icon, title: `${n.rank} ${n.name}`.toUpperCase() + ` · ${t.name.toUpperCase()}`, text });
  log('Trait', `${n.rank} ${n.name} (${t.name}): ${text}`);
  if (loy) changeLoy(n.slot, loy);
  if (eff) applyEff({ ...eff, why: t.name });
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
  const old = n.loy, wasAlly = isAlly(n);
  n.loy = Math.max(0, Math.min(5, n.loy + v));
  if (n.loy !== old) emit('loyDelta', { who: `${n.rank} ${n.name}`, v: n.loy - old });
  if (n.loy === 0 && old > 0 && !n.broken) breaking(n);
  if (!wasAlly && isAlly(n)) {
    toast('🤝', 'NEW ALLY', `${n.rank} ${n.name} is now an Ally`); sfx('loot');
    if (S.npcs.filter(isAlly).length >= 2) award('opendoor');
    if (n.trait === 'mentor') { traitReward(n, 'Empowered to train others, they take the newest Airman under their wing.', { mis: 1, mor: 1 }); if (n.slot !== 'B') changeLoy('B', 2); }
  }
  if (n.trait === 'silent' && old < 4 && n.loy >= 4) traitReward(n, 'They finally asked for help, and the work shows it.', { mis: 2 });
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
function reveal(s) { // every trait is visible now; kept so older mission effects still work
  const n = npc(s); if (n) n.revealed = true;
}
function award(id) {
  if (S.ach.includes(id)) return;
  S.ach.push(id);
  emit('ach', { aid: id }); log('Achievement', ACH[id].name); // not 'id': push() stamps every fx with its own id
}
function checkZero() {
  // in the boss fight there is no next stop: a meter at 0 is an Adverse Finding (it counts as a crisis)
  if (S.phase === 'boss' && S.boss) {
    const Bs = S.boss;
    for (const m of METERS) if (S.meters[m.k] === 0) {
      if (S.crises >= 1) { crisisGameOver(m.k); return; } // a second crisis is the end, even mid-inspection
      S.crises++;
      S.meters[m.k] = 1; Bs.hp += DIFFICULTY.adverseHeal; Bs.max = Math.max(Bs.max, Bs.hp); Bs.adverse = true;
      bossLog(`🚨 ADVERSE FINDING: ${m.name} hit 0. IG +${DIFFICULTY.adverseHeal} HP; every roll −1 for the rest of the fight. Another one = GAME OVER.`);
      emit('big', { cls: 'bad', icon: '🚨', title: 'ADVERSE FINDING', text: `${m.name} hit zero during the inspection. The IG heals ${DIFFICULTY.adverseHeal} HP and every roll is −1. One more meter at zero = GAME OVER.` });
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
  if (k === 'mis') { S.items = []; S.flags.MISSION_FAIL = true; return CRISES.mis.loss; }
  if (k === 'mor') { S.flags.LOST_AIRMAN = true; S.npcs.forEach(n => changeLoy(n.slot, -1)); return CRISES.mor.loss; }
  if (k === 'tru') {
    // the Flight Commander, or the 👑 holder when the party has no FC; only one cadet is ever fired
    const f = S.party.some(c => c.fired) ? -1 : fcIdx() >= 0 ? fcIdx() : crownIdx(S);
    if (f < 0) return 'Nobody is relieved this time: there is no one left to fire.';
    S.party[f].fired = true;
    const next = nextInChain(S) >= 0 ? nextInChain(S) : null;
    S.crown = next != null ? next : -1; S.tokenHolder = S.crown;
    S.requests = (S.requests || []).filter(r => r.slot !== f);
    return `${cadetName(f)} is FIRED: no votes, rolls or perk for the rest of the game. The 👑 tie-break passes to ${next != null ? cadetName(next) : 'nobody'}.`;
  }
  if (k === 'res') {
    S.items = [];
    const n = S.npcs.filter(x => !x.gone).sort((a, b) => a.loy - b.loy)[0];
    if (n) { n.gone = true; n.out = 999; return `${n.rank} ${n.name} quit the unit for good, and every team item is gone.`; }
    return CRISES.res.loss;
  }
  return '';
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
  const c = S.party[i]; if (!c || !c.cls) return 0;
  const up = CLASS[c.cls].ups.find(u => u.id === c.up);
  return (CLASS[c.cls].stats[stat] || 0) + ((up && up.stats && up.stats[stat]) || 0) + ((c.train || {})[stat] || 0);
}
// What a cadet adds to a check, as one number: stat + 1 if the check is their specialty
const isSpec = (i, m) => { const p = S.party[i], cl = p && CLASS[p.cls]; return !!(cl && (cl.spec || []).includes(m)); };
function rollBonus(i, stat, m) { return stat && stat !== 'LOYB' ? statOf(i, stat) + (isSpec(i, m) ? 1 : 0) : 0; }
// The default roller: whoever adds the most (anyone can volunteer instead)
function bestRoller(stat, m) {
  let best = -99, bi = 0;
  S.party.forEach((_, i) => { if (isOut(S, i)) return; const v = rollBonus(i, stat, m); if (v > best) { best = v; bi = i; } });
  return bi;
}
function rollCalc(check, roller, d20, o = {}) {
  const parts = []; let total = d20;
  if (check.stat === 'LOYB') { const n = npc('B'); parts.push([`${n.rank} ${n.name} loyalty`, n.loy]); total += n.loy; }
  else if (check.stat) {
    let sv = statOf(roller, check.stat), lbl = `${cadetName(roller)} ${check.stat}`;
    parts.push([lbl, sv]); total += sv;
    const cl = S.party[roller] && CLASS[S.party[roller].cls];
    if (cl && (cl.spec || []).includes(check.m)) { parts.push(['Specialist', 1]); total += 1; }
  }
  const mv = S.meters[check.m];
  if (mv >= 8) { parts.push([`${METER[check.m].icon} high`, 2]); total += 2; }
  else if (mv <= 2) { parts.push([`${METER[check.m].icon} low`, -2]); total -= 2; }
  const bonusItem = o.bonusItem && LOOT.find(l => l.id === o.bonusItem);
  if (bonusItem) { parts.push([`${bonusItem.icon} ${bonusItem.name}`, bonusItem.use.n]); total += bonusItem.use.n; }
  const dc = checkDC(check);
  const nat = o.safe ? 0 : d20 === 20 ? 20 : d20 === 1 ? 1 : 0; // playing it safe: no crits, no fumbles
  const pass = nat === 20 || (nat !== 1 && total >= dc);
  return { total, parts, dc, pass, nat, d20, safe: !!o.safe };
}
// The target number for a check: base + difficulty, squadron quirks, elite stops, Loaded Dice.
function checkDC(check) {
  let dc = check.dc + DIFFICULTY.dcPlus;
  if (ccHook('hard').some(h => h.m === check.m)) dc = Math.max(dc, DC_HARD);
  if (S.cur && S.cur.type === 'elite') dc += 3;
  return dc + (S.dcMod || 0);
}
// "d20 +5 · need 10+ (55%)" or, playing it safe, "safe 8 +5 = 13 vs 15: FAIL"
function rollOdds(p, safe) {
  if (safe) { const t = DIFFICULTY.safeRoll + p.total; return `safe ${DIFFICULTY.safeRoll} ${sign(p.total)} = ${t} vs ${p.dc}: ${t >= p.dc ? 'PASS' : 'FAIL'}`; }
  const need = Math.min(20, Math.max(2, p.dc - p.total));
  return `d20 ${sign(p.total)} vs ${p.dc} · need ${need}+ (${(21 - need) * 5}%)`;
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
//   opener (❓ or ⚔️) → warm-up → the test (💀 or 🔦) → supply → final push (💀, ⚔️ or ❓) → prep (🏕️ or 🛒) → IG.
// Each beat lists the nodes it always offers (fixed) and what fills the rest (fill: weights).
// Scenarios can repeat at a stop; other types can't. Paths branch and merge at random (never crossing).
const ROUTE_BEATS = {
  open:   { name: 'Opener',     fixed: ['unknown', 'crisis'], fill: [['crisis', 100]],                             width: [2, 3] },
  warm:   { name: 'Warm-up',    fixed: ['crisis'],          fill: [['crisis', 45], ['unknown', 25], ['spot', 30]], width: [2, 3] },
  test:   { name: 'The test',   fixed: ['elite', 'spot'],   fill: [],                                              width: [2, 2] },
  supply: { name: 'Supply run', fixed: ['depot'],           fill: [['crisis', 60], ['unknown', 40]],               width: [2, 3] },
  push:   { name: 'Mid push',   fixed: ['crisis'],          fill: [['unknown', 40], ['spot', 30], ['crisis', 30]], width: [2, 3] },
  final:  { name: 'Final push', fixed: ['elite', 'crisis', 'unknown'], fill: [],                                   width: [3, 3] },
  prep:   { name: 'Prep',       fixed: ['rest', 'depot'],   fill: [],                                              width: [2, 2] },
};
// Route length: the GM picks 7, 6 or 5 stops (remembered in this browser). Shorter routes drop middle
// beats but always keep the opener, the test, the final push and the prep stop.
const STOP_PLANS = {
  7: ['open', 'warm', 'test', 'supply', 'push', 'final', 'prep'],
  6: ['open', 'warm', 'test', 'supply', 'final', 'prep'],
  5: ['open', 'warm', 'test', 'final', 'prep'],
};
const MAP_RULES = { unknowns: [2, 3] }; // [min, max] ❓ per map (the opener and the final push always have one)
const routeStops = () => { const n = +((S && S.stops) || localStorage.getItem('sq_stops') || 6); return STOP_PLANS[n] ? n : 6; };
const levelAfter = () => (S.map && S.map.levelAfter) || 3;
function rollMap() {
  const weighted = bag => {
    let r = Math.random() * bag.reduce((a, b) => a + b[1], 0);
    for (const [k, w] of bag) { if ((r -= w) < 0) return k; }
    return bag[0][0];
  };
  // 🔦 spotlights: at most DIFFICULTY.spotlights per map (never more than there are cadets). WHO is in the
  // spotlight is rolled on arrival. The test's spotlight is handed out first; one past the cap becomes a Scenario.
  let spots = Math.min(DIFFICULTY.spotlights, S.party.length);
  const n = routeStops(), plan = STOP_PLANS[n], tiers = plan.map(() => null);
  const order = plan.map((_, t) => t).sort((a, b) => (plan[b] === 'test') - (plan[a] === 'test'));
  for (const t of order) {
    const beat = ROUTE_BEATS[plan[t]], [lo, hi] = beat.width, w = lo + Math.floor(Math.random() * (hi - lo + 1));
    const types = beat.fixed.slice(0, w);
    let pool = beat.fill.filter(x => x[0] === 'crisis' || !types.includes(x[0]));
    while (types.length < w && pool.length) { const k = weighted(pool); types.push(k); if (k !== 'crisis') pool = pool.filter(x => x[0] !== k); }
    tiers[t] = shuffle(types.map(type => {
      if (type === 'spot') { if (spots > 0) spots--; else type = 'crisis'; }
      return { type, done: false };
    }));
  }
  // links: a random "staircase" walk between neighbouring stops, so paths branch and merge
  // but never cross, and every node has a way in and a way out
  const links = tiers.map((row, t) => {
    const next = tiers[t + 1]; if (!next) return row.map(() => []);
    const out = row.map(() => []); let i = 0, j = 0; out[0].push(0);
    while (i < row.length - 1 || j < next.length - 1) {
      const canI = i < row.length - 1, canJ = j < next.length - 1, r = Math.random();
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
function genMap() {
  let m;
  for (let i = 0; i < 300; i++) { m = rollMap(); if (mapOk(m)) return m; }
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
  mystery: 'Roll the d6: unknown territory', lootd4: 'Roll the d4 for loot', loot: 'Spin the loot wheel',
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
  if (c.fumblePending) return setActor('fumble', c.rollRes ? c.rollRes.roller : nextActor());
  if (c.lootRoll) return setActor('lootd4', nextActor());
  if (c.lootEarned) return setActor('loot', nextActor());
  S.actor = null;
}
function lootD4() {
  const c = S.cur; if (!c || !c.lootRoll) return;
  doneActor('lootd4'); c.lootRoll = false;
  if (rollDie(4, `LOOT CHANCE · d4${byWho()}`, n => n >= 3 ? '🎁 LOOT DROP!' : 'No loot this time', LOOT_TABLE()) >= 3) c.lootEarned = true;
  assignPending();
}
// what the cadet's button does, by kind
const ACTOR_RUN = {
  trigger: () => spinTrigger(), murphy: () => spinMurphy(), mystery: () => ACT.spinMystery(),
  lootd4: () => lootD4(), loot: () => spinLoot(), fumble: () => spinFumble(), hotseat: () => bossHotSeat(),
  speaker: () => spinSpeaker(), tackle: () => resolveTackle(),
};

/* ---- party votes (map, rest stop, supply depot, mission choices) ---- */
function votersFor(key) { const v = S.votes || {}; return Object.keys(v).filter(s => String(v[s]) === String(key)).map(Number); }
function restOptions() {
  const o = METERS.map(m => ({ key: m.k, label: `+${DIFFICULTY.restMain} ${m.icon}, +${DIFFICULTY.restOthers} to the rest` }));
  o.push({ key: 'loy', label: '🤝 +1 loyalty to every Unit member, +1 ❤️' });
  S.party.forEach((p, i) => { const ab = CLASS[p.cls] && CLASS[p.cls].ability; if (ab && !ab.auto && p.used) o.push({ key: 'rc' + i, label: `🔋 Recharge ${rankName(p)}'s ${ab.name}` }); });
  return o;
}
function depotOptions() {
  // Pre-Positioned Supplies (Plans perk): the next 📦 cost is waived
  const free = !!(S.pending && S.pending.prepo), cost = n => free ? `FREE (was −${n} 📦)` : `−${n} 📦`, short = n => !free && S.meters.res < n;
  return [
    { key: 'pizza', label: `🍕 Pizza for the whole flight: ${cost(2)} → +3 ❤️`, dis: short(2) },
    { key: 'coffee', label: `☕ Coffee run for the Group CC's staff meeting: ${cost(2)} → +2 ⭐`, dis: short(2) },
    { key: 'train', label: `📚 Study guides from the BX bookstore: ${cost(2)} → one cadet +1 to a stat for the rest of the game`, dis: short(2) },
    { key: 'deocs', label: `📋 Run a DEOCS Survey: ${cost(1)} → exact meter values for ${DIFFICULTY.deocsStops} stops`, dis: short(1) || deocsOn(S) },
    { key: 'favor', label: '🎁 A Unit member picks something up for you: −2 loyalty → free loot spin' },
    { key: 'tasker', label: '🎯 Volunteer someone for the BX Saturday detail: a Unit member −1 loyalty → +3 🎯' },
    { key: 'overtime', label: '⏰ Skip the lunch run, mandatory overtime: −2 ❤️ → +3 📦', dis: S.meters.mor < 2 },
    { key: 'offbooks', label: '💳 Put the shopping on the unit GPC card, skip the paperwork: +4 📦' },
    { key: 'skip', label: 'Just browsing (no purchase)' },
  ];
}
// What the team votes on at a Rest Stop / Supply Depot right now (the depot's "who pays?" step votes on Unit members)
function stopOptions() {
  const c = S.cur; if (!c) return [];
  if (c.step === 'choose') return c.type === 'rest' ? restOptions() : depotOptions();
  if (c.step === 'who') return S.npcs.map(n => ({ key: 'who:' + n.slot, label: `${n.rank} ${n.name} (loyalty ${n.loy})${c.trade === 'favor' ? ': −2 loyalty' : ': −1 loyalty'}`, dis: n.out > 0 }));
  return [];
}
// Is a team vote open right now? (Old votes linger in S.votes after the GM locks a choice.)
function votingOpen(S) {
  const c = S.cur, i = S.inject;
  if (S.phase === 'map' || (S.phase === 'unit' && !S.unitRolled) || (S.phase === 'patch' && !S.patch)) return true;
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
function tieText(S) {
  const f = S.party[crownIdx(S)];
  return `⚖️ TIE VOTE · ROCK, PAPER, RANK: 👑 ${f ? rankName(f).toUpperCase() : 'THE FLIGHT COMMANDER'} DECIDES`;
}

/* ---- result card: what changed since the event started ---- */
function snapBase() { S.base = { m: { ...S.meters }, loy: Object.fromEntries((S.npcs || []).map(n => [n.slot, n.loy])), items: (S.items || []).slice() }; }
function resultSummary(S) {
  const b = S.base; if (!b) return { meters: [], loy: [], gained: [], lost: [] };
  const items = S.items || [];
  return {
    meters: METERS.map(m => [m.k, S.meters[m.k] - b.m[m.k]]).filter(x => x[1]),
    loy: (S.npcs || []).map(n => [`${n.rank} ${n.name}`, n.loy - (b.loy[n.slot] ?? n.loy)]).filter(x => x[1]),
    gained: items.filter(id => !b.items.includes(id)), lost: b.items.filter(id => !items.includes(id)),
  };
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
  const prev = S, keepBoard = S && S.muted;
  S = newState(); S.muted = !!keepBoard; hist = [];
  S.map = genMap(); // previewed (and rerollable) on the GM console until the route map opens
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
  // no Flight Commander (it's optional): the 👑 tie-break goes to the next in the chain of command
  S.crown = fcIdx() >= 0 ? null : nextInChain(S);
  S.tokenHolder = crownIdx(S);
  S.phase = 'perks';
  log('Positions locked', p.map(c => `${c.name} (${CLASS[c.cls].name})`).join('; '));
  return '';
}
function lockPerks() {
  if (S.party.some(c => !c.perk)) return 'Every cadet needs a perk.';
  S.phase = 'kit'; S.votes = {}; S.party.forEach(c => { c.kitOk = false; }); // everyone checks their kit before the squadron vote
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
  S.intent = u.cc.intent;
  const taken = S.party.map(c => c.name.toLowerCase());
  const ok = n => !taken.some(t => t.split(/[\s,]+/).includes(n.toLowerCase()));
  const R = getRoster();
  const lower = shuffle(R.lower.filter(ok)), upper = shuffle(R.upper.filter(ok));
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
    const name = (sl.pool === 'lower' ? lower : upper).shift();
    return { slot: sl.s, rank: own.rank === 'Civ.' ? civTitle(name) : own.rank, pub: own.pub, enlisted: sl.enlisted, name,
      trait: traits[i], revealed: true, loy: DIFFICULTY.startLoy, out: 0, broken: false };
  });
  S.cc = `${u.ccRank} ${upper.shift()}`;
  // named characters outside the Unit (Wing CC, a visiting general...), from names nobody is using
  S.extras = {};
  for (const k in EXTRAS) {
    const x = EXTRAS[k], name = (x.pool === 'lower' ? lower : upper).shift() || (x.pool === 'lower' ? upper : lower).shift();
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
  S.offline = S.offlineNext; S.offlineNext = null; S.branch = false; S.wp = null;
  if (S.babysit > 0) S.babysit--;
  if (S.offline != null) S.banner = { text: `📵 ${cadetName(S.offline)} IS IN A MEETING: CAN'T SPEAK OR ROLL THIS NODE`, cls: 'blue' };
  log(`Node ${S.nodeCount}: ${NODE_TYPES[node.type].name}`);
  if (S.pendingNext.length) { const pend = S.pendingNext; S.pendingNext = []; pend.forEach(e => {
    if (e.p != null && Math.random() >= e.p) { log('Dodged it', e.why || 'A delayed risk did not happen'); return; }
    if (e.why) toast('⏰', 'IT CAUGHT UP WITH YOU', e.why);
    applyEff(e);
  }); }
  // the squadron's chronic weak spot wears down every few stops
  const u = unitObj();
  if (u && u.drain && S.nodeCount % DIFFICULTY.drainEvery === 0) {
    toast(u.icon, `SQUADRON TENDENCY: ${u.drain.name}`, `${u.drain.text}. ${METER[u.drain.k].label} −1`);
    applyEff({ [u.drain.k]: -1, why: u.drain.name });
  }
  if (crisisNow({ k: 'enter', t, i })) return; // the drain (or a delayed hit) bottomed a meter out: the crisis comes first
  enterNode(node.type, node);
}
// Missions this squadron can draw: general ones plus its own signature missions (4x as likely).
// Squadron-first: a mission comes from the squadron's own pool (DIFFICULTY.squadronShare of the time),
// otherwise from the generic core. 💀 Elite stops draw the squadron's critical mission first.
function drawMission(elite) {
  const fresh = m => !m.off && !S.usedMissions.includes(m.id), mine = m => (m.home || []).includes(S.unit);
  const crit = MISSIONS.filter(m => m.critical && mine(m) && fresh(m));
  if (elite && crit.length) return pickOne(crit);
  const own = MISSIONS.filter(m => !m.critical && mine(m) && fresh(m)), core = MISSIONS.filter(m => !m.critical && !m.home && fresh(m));
  const first = Math.random() < DIFFICULTY.squadronShare ? [own, core] : [core, own];
  const bag = first.find(b => b.length) || MISSIONS.filter(m => !m.off && !m.critical && (mine(m) || !m.home));
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
    const fresh = all.filter(i => !done.includes(i) && SPOTLIGHTS.some(x => x.cls === S.party[i].cls)), cand = fresh.length ? fresh : all;
    const k = rnd(cand.length), slot = cand[k], sp = SPOTLIGHTS.find(x => x.cls === S.party[slot].cls);
    S.spotlit = done.concat(slot);
    spinWheel('🔦 WHO IS IN THE SPOTLIGHT?', cadetSlices(cand), k, true);
    S.cur = { type, sid: sp.id, slot, step: 'brief', choice: null, intel: false, swap: null };
    S.banner = { text: `🔦 SPOTLIGHT: ${cadetName(slot).toUpperCase()} DECIDES ALONE. EVERYONE ELSE: SILENT.`, cls: 'blue' };
    log('Spotlight', `${sp.title} (${cadetName(slot)})`); sfx('start');
  } else if (type === 'rest' || type === 'depot') {
    S.cur = { type, step: 'choose' };
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
  if (m.choices[i] && m.choices[i].req && !gateOpen(m.choices[i].req)) { alert(`Locked: needs a cadet with ${m.choices[i].req.stat} +${m.choices[i].req.min}.`); return false; }
  c.preChoice = JSON.stringify(S);
  let effIdx = i;
  if (c.swap && c.swap.includes(i)) effIdx = c.swap[0] === i ? c.swap[1] : c.swap[0];
  const base = m.choices[i], src = m.choices[effIdx];
  let spec = src.ifClass ? { ...src, ...normal(src.ifClass[src.ifClass.cls.some(hasClass) ? 'then' : 'else']) } : { ...src };
  spec.tags = base.tags; spec.mic = src.mic; spec.speaker = src.speaker;
  c.choice = i; c.spec = spec;
  if (c.type !== 'spot') S.banner = null;
  sfx('click');
  log(`Choice ${'ABCD'[i]}`, fill(S, base.t) + (effIdx !== i ? ' (PLOT TWIST: effects swapped)' : ''));
  logObj(m, base.t);
  const opt = { double: c.type === 'elite', late: (spec.tags || []).includes('late') };
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
function finishStep() {
  const c = S.cur; c.step = 'done';
  if (c.type === 'elite') c.lootEarned = true;
  else if ((c.type === 'crisis' || c.type === 'spot') && !c.lootEarned) c.lootRoll = true; // a cadet rolls the d4
  assignPending();
}
function resolveRoll(roller, o) {
  const c = S.cur, spec = c.spec;
  c.preRoll = JSON.stringify(S);
  const safe = false; // "play it safe" was removed: every check rolls the die
  const lead = !!(o && o.lead); // Lead From the Front keeps the die as rolled and forces a pass (no new roll on screen)
  let d20 = lead ? o.d20 : 1 + rnd(20);
  if (!lead) { S.spinUntil = Date.now() + 4800; setTimeout(afterSpin, 4860); }
  const bonusItem = S.pending.check; if (bonusItem) { removeItem(bonusItem); S.pending.check = null; }
  const r = rollCalc(spec.check, roller, d20, { ...o, bonusItem, safe });
  r.roller = roller;
  if (o && o.lead) { r.pass = true; r.nat = 0; r.lead = true; }
  c.rollRes = r;
  S.dcMod = 0;
  const who = spec.check.stat === 'LOYB' ? npcLabel(S, 'B') : cadetName(roller);
  if (!lead) emit('roll', { r, who });
  log(`Roll: ${who}`, `${safe ? 'PLAYED IT SAFE (' + d20 + ')' : 'd20 ' + d20} → ${r.total} vs ${r.dc}: ${r.pass ? 'PASS' : 'FAIL'}${r.nat === 20 ? ' (CRIT)' : r.nat === 1 ? ' (FUMBLE)' : ''}`);
  const opt = { double: c.type === 'elite' || r.nat === 20, late: (spec.tags || []).includes('late') };
  applyEff(r.pass ? spec.check.pass : spec.check.fail, opt);
  if (r.pass) ccApply('afterPass', 'Passed check', h => h.m === spec.check.m);
  else ccApply('afterFail', 'Failed check', h => !h.m || h.m === spec.check.m);
  if (r.nat === 20) { award('crit'); c.lootEarned = true; }
  if (r.nat === 1) c.fumblePending = true;
  if (r.pass && S.party[roller] && S.party[roller].up === 'standards') applyEff({ tru: 1, why: 'Standards Bearer' });
  finishStep();
}
function rateStars(n, lead) {
  const c = S.cur, spec = c.spec;
  let st = n, bonus = [];
  const starItem = S.pending.star && LOOT.find(l => l.id === S.pending.star);
  if (starItem && st < 3) { st++; bonus.push(`${starItem.icon} ${starItem.name}`); }
  if (starItem) { removeItem(starItem.id); S.pending.star = null; }
  c.stars = st; c.lead = lead; c.starBonus = bonus;
  S.starsTotal += st; S.micCount++; if (st < 2) S.micLow = true;
  if (st === 3) award('clearcomms');
  emit('stars', { n: st, who: cadetName(lead) }); sfx('stars');
  log(`🎤 ${cadetName(lead)} led the encounter`, `${st}★${bonus.length ? ' (' + bonus.join(', ') + ')' : ''}`);
  applyEff(spec.stars[st - 1], { double: c.type === 'elite' });
  if (st === 3) { ccApply('stars3', '3⭐ encounter'); withTrait('climber').forEach(n => traitReward(n, 'Public praise. They noticed, and so did everyone else.', null, 2)); }
  if (st === 1) ccApply('stars1', '1⭐ encounter');
  finishStep();
}
function removeItem(id) { const i = S.items.indexOf(id); if (i >= 0) S.items.splice(i, 1); }
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
  if (S.map && S.pos.tier >= lastTier() && !(S.wp && S.wp.queue.length)) return startBoss();
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
  log('Inject wheel', INJECT_WHEELS[inj.filter].name + (inj.filter !== injectTypeFor(d) ? ' (Foresight: not the Wheel of Failure)' : ''));
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
      const k = rnd(S.npcs.length), n = S.npcs[k];
      spinWheel('WHO GOES ON LEAVE?', S.npcs.map((x, j) => ({ label: `${x.rank} ${x.name}`.toUpperCase(), color: WHEEL_COLORS[j % WHEEL_COLORS.length] })), k);
      n.out = 2; note += `${n.rank} ${n.name} is out for 2 stops.`;
    }
    if (m.special === 'meeting') {
      const all = S.party.map((_, i) => i), k = rnd(all.length);
      spinWheel('WHO GETS PULLED INTO A MEETING?', cadetSlices(all), k);
      S.offlineNext = k; note += `${cadetName(k)} is offline next stop.`;
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
  inj.preTackle = JSON.stringify(S); // Lead From the Front / Prior MTI restore this and force a pass
  doneActor('tackle');
  const m = MURPHY[inj.idx], t = m.tackle, i = inj.roller;
  let d20 = o.lead ? o.d20 : 1 + rnd(20);
  inj.tackleD20 = d20;
  // Emergency Leave: the member goes no matter what; tackling it means covering the gap
  let leaver = null;
  if (m.special === 'leave') {
    if (o.lead && o.leaver) leaver = npc(o.leaver); // Lead From the Front: same person, no new spin
    else { const k = rnd(S.npcs.length); leaver = S.npcs[k];
      spinWheel('WHO GOES ON LEAVE?', S.npcs.map((x, j) => ({ label: `${x.rank} ${x.name}`.toUpperCase(), color: WHEEL_COLORS[j % WHEEL_COLORS.length] })), k); }
    if (leaver) { leaver.out = 2; inj.leaver = leaver.slot; }
  }
  const cl = CLASS[S.party[i].cls], spec = (cl.spec || []).includes(t.m) ? 1 : 0;
  const sv = statOf(i, t.stat), total = d20 + sv + spec, dc = t.dc + DIFFICULTY.dcPlus;
  const pass = !!o.lead || d20 === 20 || (d20 !== 1 && total >= dc);
  if (!o.lead) showDie(20, d20, `TACKLE IT · ${cadetName(i)} · ${t.stat}`, `${d20} + ${sv} ${t.stat}${spec ? ' + 1 specialist' : ''} = ${total} vs ${dc} → ${pass ? 'TACKLED!' : 'FAILED'}`);
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
// The run's loot pool: the 4 generic items + the squadron's 4. Even odds; an item leaves the pool once it drops.
function lootPool(keep) {
  const all = LOOT.filter(l => !l.home || l.home.includes(S.unit)).map(l => l.id);
  const fresh = all.filter(id => id === keep || !(S.usedLoot || []).includes(id));
  return fresh.length ? fresh : all;
}
function spinLoot() {
  const id = pickOne(lootPool()), pool = lootPool(id), item = LOOT.find(l => l.id === id);
  S.usedLoot = (S.usedLoot || []).concat(id);
  doneActor('loot');
  spinWheel(`LOOT DROP!${byWho()}`, pool.map(x => { const l = LOOT.find(y => y.id === x); return { label: l.name, color: lootColor(l) }; }), pool.indexOf(id));
  S.items.push(item.id);
  if (S.items.length > 3) { // the bag holds 3: the oldest item falls out
    const oldId = S.items.shift(), old = LOOT.find(l => l.id === oldId); // shift ONCE (not inside find)
    log('Inventory full', `Dropped ${old.icon} ${old.name}`);
    emit('big', { cls: '', title: 'BAG FULL', icon: '🎒', text: `Only 3 items fit, so the oldest one was dropped: ${old.icon} ${old.name}. Use items before they're lost!` });
  }
  emit('sfxLater', { n: 'loot' });
  emit('lootDrop', { lid: item.id, count: S.items.length }); // pops up after the wheel and explains the item
  log('Loot', `${item.icon} ${item.name}`);
  if (S.cur) { S.cur.lootEarned = false; assignPending(); }
  return item;
}
function applyFumble(f, roller) {
  applyEff(f.eff);
  if (f.special === 'wrongname') { const n = pickOne(S.npcs); changeLoy(n.slot, -1); toast('😬', 'WRONG NAME', `${n.rank} ${n.name} noticed. Loyalty −1`); }
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
/* ---- boss: Lt Col Cacic, three telegraphed rounds ----
   Each round the IG announces an attack on a meter. Every cadet picks one action on their phone
   (Press with their best stat, or Defend), then the GM resolves the round. Allies vouch once at the start. */
function startBoss() {
  S.phase = 'boss'; S.cur = null; S.banner = null; S.actor = null;
  const broken = S.npcs.filter(n => n.broken || n.loy === 0);
  const hp = Math.max(1, DIFFICULTY.bossHp + (S.flags.WITNESS_IG ? 3 : 0) + broken.length * DIFFICULTY.witnessHp + (S.flags.MISSION_FAIL ? DIFFICULTY.crisisIgHp : 0) - (S.flags.MOCK_INSPECTION ? DIFFICULTY.mockInsp : 0));
  S.boss = { hp, max: hp, round: 0, stage: 'intro', log: [], atk: null, acts: {}, allyUsed: {}, adverse: false,
    weak: S.npcs.some(n => n.trait === 'witness' && n.loy >= 4), wargame: null, lastFails: [], res: [],
    p2: { who: null, q: [], stars: [0, 0], rolls: null, done: false } };
  const Bs = S.boss;
  bossLog(`👹 ${BOSS.name} arrives: ${hp} HP.`);
  if (S.flags.WITNESS_IG) bossLog('🕵️ The Witness reported you to the IG: +3 HP.');
  if (S.flags.MISSION_FAIL) bossLog(`💥 The IG read the Mission Failure report: +${DIFFICULTY.crisisIgHp} HP.`);
  if (S.flags.MOCK_INSPECTION) bossLog(`📋 Your Readiness Inspection already found and fixed the easy write-ups: −${DIFFICULTY.mockInsp} HP.`);
  broken.forEach(n => bossLog(`🗣️ ${n.rank} ${n.name} hit their breaking point and is now a hostile witness: IG +${DIFFICULTY.witnessHp} HP.`));
  if (Bs.weak) bossLog(`🕵️ The Witness tipped you off: Press target ${examDC(Bs)}.`);
  const allies = S.npcs.filter(isAlly);
  if (allies.length) bossDmg(allies.length * 2, `${allies.map(n => `${n.rank} ${n.name}`).join(', ')} vouch${allies.length === 1 ? 'es' : ''} for you (Allies, 2 each)`);
  // the commander shows up for you, or doesn't
  if (S.meters.tru >= 7) bossDmg(DIFFICULTY.vouch, `${S.cc} vouches for your flight (⭐ ${deocsOn(S) ? S.meters.tru : 'STRONG'})`);
  else if (S.meters.tru <= 3) { Bs.hp += DIFFICULTY.vouch; Bs.max += DIFFICULTY.vouch; bossLog(`👎 ${S.cc} throws you under the bus (⭐ ${deocsOn(S) ? S.meters.tru : 'LOW'}): IG +${DIFFICULTY.vouch} HP`); }
  emit('bossIntro'); sfx('boss');
  log('BOSS', `${BOSS.name}, ${BOSS.title} (HP ${Bs.hp})`);
}
function bossLog(t) { S.boss.log.push(t); }
function bossDmg(n, why) {
  S.boss.hp = Math.max(0, S.boss.hp - n);
  bossLog(`💥 ${n} damage: ${why}`);
  emit('bossHit', { n }); sfx('hit');
}
const examDC = Bs => DIFFICULTY.examDC - (Bs && Bs.weak ? 3 : 0);
// Opening audit: integrity first (any trap = Game Over), then readiness
function bossAudit() {
  const traps = TRAP_FLAGS.filter(f => S.flags[f]);
  bossLog('📋 THE AUDIT: the clipboard scans your run...');
  if (traps.length) { gameOver(traps.map(f => FLAG_TEXT[f])); return true; }
  bossLog('✅ No integrity findings.');
  if (S.flags.HONEST_BROKER) { applyEff({ tru: 2, why: 'Honest Broker' }); bossDmg(2, 'You reported the real numbers (Honest Broker)'); }
  const strong = METERS.filter(m => S.meters[m.k] >= 5).length;
  if (strong) bossDmg(Math.min(8, strong * 2), `${strong} meter${strong > 1 ? 's' : ''} at 5+ (readiness is the attack)`);
  else bossLog('No meters at 5+. The audit finds nothing to praise.');
  return false;
}
function bossRound(r) {
  const Bs = S.boss, Rd = BOSS_ROUNDS[r - 1];
  Bs.round = r; Bs.acts = {}; Bs.wargame = null; Bs.lastFails = []; Bs.res = [];
  const k = Rd.targets.slice().sort((a, b) => S.meters[a] - S.meters[b])[0];
  Bs.atk = { k, n: DIFFICULTY.bossAttack, name: Rd.atk };
  bossLog(`${Rd.icon} ROUND ${r}: ${Rd.name}. The IG telegraphs ${Rd.atk}: ${METER[k].icon} −${Bs.atk.n} at the end of the round.`);
  if (r === 2) {
    Bs.stage = 'hotseat'; setActor('hotseat', nextActor());
    const qs = shuffle(BOSS_QUESTIONS).slice(0, 2), broken = S.npcs.filter(n => n.broken || n.loy === 0);
    if (broken.length) qs[0] = `Tell me about ${broken[0].rank} ${broken[0].name}. How did it get that bad, and what did you do about it?`;
    Bs.p2 = { who: null, q: qs, stars: [0, 0], rolls: null, done: false };
    if (S.flags.VAGUE_ANSWER) { applyEff({ tru: -2, why: '"You said you were on it."' }); bossLog('😬 "You said you were on it." ⭐ −2'); }
    if (S.flags.DODGED) { applyEff({ tru: -2, why: '"Whose tasking was it, really?"' }); bossLog('😬 "Whose tasking was it, really?" ⭐ −2'); }
  } else Bs.stage = 'act';
  sfx('alarm');
}
// Round 2: everyone rolls a d20; the two LOWEST rolls answer the IG's questions.
function bossHotSeat() {
  const Bs = S.boss;
  if (!Bs || Bs.stage !== 'hotseat' || Bs.p2.who) return;
  doneActor('hotseat');
  const rolls = S.party.map(() => 1 + rnd(20));
  const order = S.party.map((_, i) => i).sort((a, b) => (rolls[a] - rolls[b]) || (Math.random() - 0.5));
  Bs.p2.who = order.slice(0, 2); Bs.p2.rolls = rolls;
  emit('multiDice', { title: 'WHO FACES THE INTERVIEW? · lowest two rolls', rows: S.party.map((p, i) => ({ name: rankName(p), av: p.av, uni: p.uni, hair: p.hair, v: rolls[i], hi: Bs.p2.who.includes(i), tag: Bs.p2.who.includes(i) ? 'HOT SEAT' : 'SAFE' })) });
  S.spinUntil = Date.now() + 4200; setTimeout(afterSpin, 4260);
  bossLog(`🎲 Hot seat: ${Bs.p2.who.map(cadetName).join(' and ')} (lowest rolls)`);
}
function bossStarsDone() {
  const Bs = S.boss, st = Bs.p2.stars, total = st[0] + st[1];
  S.starsTotal += total;
  bossDmg(total, `Interview answers (${st[0]}★ + ${st[1]}★)`);
  if (S.flags.NEWKID_ALLY) bossDmg(1, 'The new Airman you welcomed vouches for you');
  Bs.p2.done = true; Bs.stage = 'act';
  S.objLog = (S.objLog || []).concat({ n: S.nodeCount, title: 'THE IG INTERVIEW', icon: '🎤', choice: `${Bs.p2.who.map(cadetName).join(' and ')}: ${st[0]}★ + ${st[1]}★`, obj: ['comm'] });
}
// Is this action allowed for cadet i this round? (checked for phones and the console alike)
function bossActOk(i, a) {
  const Bs = S.boss; if (!Bs || Bs.stage !== 'act' || !a || isOut(S, i) || !S.party[i]) return false;
  const others = Object.entries(Bs.acts).filter(([s]) => +s !== i).map(([, x]) => x);
  return a.type === 'press' || a.type === 'defend';
}
// Boss Press always uses the cadet's best stat (no stat picking)
function bestStat(i) { return STATS.slice().sort((a, b) => statOf(i, b) - statOf(i, a))[0]; }
function bossActText(i, a) {
  if (!a) return '⏳ choosing...';
  if (a.type === 'press') { const st = bestStat(i); return `🗡️ Press with ${st} (+${statOf(i, st)})`; }
  if (a.type === 'defend') return '🛡️ Defend (block 2)';
  return '';
}
function bossResolve() {
  const Bs = S.boss; if (!Bs || Bs.stage !== 'act') return false;
  const dc = examDC(Bs), pen = Bs.adverse ? 1 : 0, acts = Bs.acts;
  const sup = {};
  const presses = Object.entries(acts).filter(([, a]) => a.type === 'press').map(([s]) => [+s, { type: 'press', stat: bestStat(+s) }]);
  const rows = []; Bs.lastFails = []; Bs.res = [];
  presses.forEach(([i, a]) => {
    const d = 1 + rnd(20);
    const sv = statOf(i, a.stat), bonus = (sup[i] || 0) - pen, total = d + sv + bonus;
    const pass = d === 20 || (d !== 1 && total >= dc);
    Bs.res.push({ i, d, bonus: sv + bonus, stat: a.stat, pass });
    rows.push({ name: cadetName(i), av: S.party[i].av, uni: S.party[i].uni, hair: S.party[i].hair, v: d, hi: pass, tag: d === 20 ? 'CRIT! 4 DMG' : d === 1 ? 'FUMBLE' : `${a.stat} = ${total} ${pass ? 'HIT' : 'MISS'}` });
    if (d === 20) { bossDmg(4, `${cadetName(i)} CRITICAL (${a.stat})`); award('crit'); }
    else if (pass) bossDmg(2, `${cadetName(i)}: ${d}+${sv} ${a.stat}${sup[i] ? ` +${sup[i]} support` : ''}${pen ? ' −1' : ''} = ${total} vs ${dc}`);
    else {
      bossLog(`❌ ${cadetName(i)}: ${total} vs ${dc} (miss)`); Bs.lastFails.push(i);
      if (d === 1) { const f = pickOne(FUMBLES); applyFumble(f, null); bossLog(`🤦 Natural 1: ${f.name} (${f.text})`); }
    }
  });
  if (rows.length) { emit('multiDice', { title: `ROUND ${Bs.round} · PRESS THE INSPECTION · target ${dc}`, rows }); S.spinUntil = Date.now() + 4200; setTimeout(afterSpin, 4260); }
  // the IG's telegraphed attack: each Defend blocks 2
  const defends = Object.values(acts).filter(a => a.type === 'defend');
  const n = Math.max(0, Bs.atk.n - 2 * defends.length);
  if (n) {
    applyEff({ [Bs.atk.k]: -n, why: Bs.atk.name });
    bossLog(`🗡️ ${Bs.atk.name}: ${METER[Bs.atk.k].icon} −${n}${defends.length ? ` (cut by ${2 * defends.length})` : ''}`);
    if (S.meters[Bs.atk.k] < 3) S.flags.bossDrop = true;
  } else bossLog(`🛡️ The team blocked ${Bs.atk.name} completely.`);
  Bs.stage = 'resolved';
  log('Boss round', `${Bs.round}: IG at ${Bs.hp} HP`);
}
function bossNext() {
  const Bs = S.boss;
  if (Bs.stage === 'intro') { if (bossAudit()) return; return bossRound(1); }
  if (Bs.stage === 'resolved') return Bs.round < BOSS_ROUNDS.length ? bossRound(Bs.round + 1) : endBoss();
  return false;
}
function endBoss() {
  const Bs = S.boss, hp = Bs.hp;
  const res = hp <= 0 ? ['🏆 OUTSTANDING', 60] : hp <= 5 ? ['🥇 EXCELLENT', 35] : hp <= 10 ? ['✅ SATISFACTORY', 10] : ['⚠️ MARGINAL', -15];
  Bs.result = res[0]; S.bossBonus = res[1]; Bs.stage = 'done';
  bossLog(`INSPECTION RESULT: ${res[0]} (${sign(res[1])})`);
  if (hp <= 0 && !S.flags.bossDrop) award('flawless');
  emit('big', { cls: hp <= 5 ? 'good' : '', title: 'INSPECTION RESULT', icon: '📋', text: `${res[0]}  ·  IG HP LEFT: ${hp}` });
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
function gameOver(reasons, kind = 'integrity') {
  S.gameOver = true; S.gameOverReasons = reasons; S.gameOverKind = kind;
  S.cur = null; S.inject = null; S.actor = null; S.notice = null;
  if (S.boss) bossLog(`🚨 ${kind === 'crisis' ? 'SECOND CRISIS' : 'INTEGRITY FINDING'}: ` + reasons.join('; '));
  log('GAME OVER', reasons.join('; '));
  emit('gameOver', { reasons, kind }); sfx('over');
  const sc = computeScore(S);
  S.final = { ...sc, grade: gradeFor(S, sc.total), at: Date.now() };
  S.phase = 'results';
  saveToBoard();
}
// Every finished run goes on the leaderboard automatically (Game Overs show as 💀). Saving again
// (e.g. after fixing the team name) updates the same entry instead of adding a second one.
function saveToBoard() {
  const u = UNITS.find(x => x.id === S.unit);
  S.boardDate = S.boardDate || new Date().toISOString();
  const b = loadBoard().filter(r => r.date !== S.boardDate);
  b.push({
    callsign: (S.callsign || 'NO PATCH').toUpperCase().slice(0, 18), unit: u ? u.name : '', grade: S.final.grade.g,
    score: S.final.total, low: Math.min(...METERS.map(m => S.meters[m.k])), stars: S.starsTotal, ach: S.ach.length,
    gameOver: S.gameOver, cadets: S.party.map(c => rankName(c)).join(', '), date: S.boardDate, patch: (patchOf(S) || {}).icon || '', patchKey: S.patch ? `${S.unit}:${S.patch}` : '',
  });
  saveBoard(b); S.saved = true;
  if (typeof cloudQueue === 'function') cloudQueue(S.boardDate); // shared leaderboard (cloud.js)
  log('Leaderboard', `Saved as ${S.callsign}`);
}

/* ---- abilities, items, GM cards ---- */
function abilityLimit(c) { return 1; }
// Talent Management: the Unit member in that slot PCSes out and a hand-picked replacement takes the slot:
// one rank higher (SSgt at most), a fresh name, a trait with an upside nobody in the unit has, loyalty 4 and an Ally right away.
function pcsReplace(old) {
  const R = getRoster(), pool = (SLOTS.find(x => x.s === old.slot) || {}).pool === 'upper' ? R.upper : R.lower;
  const used = new Set([...S.npcs.map(n => n.name), ...S.party.map(p => p.name), String(S.cc || '').split(' ').pop(), ...Object.values(S.extras || {}).map(x => x.name), ...(S.pcsNames || [])].map(x => String(x).toLowerCase()));
  const free = n => !used.has(n.toLowerCase());
  const name = shuffle(pool.filter(free))[0] || shuffle((pool === R.upper ? R.lower : R.upper).filter(free))[0];
  if (!name) return null;
  const have = S.npcs.map(n => n.trait), fits = t => !have.includes(t) && !(old.slot === 'B' && TRAIT[t].vet);
  const trait = shuffle(PCS_TRAITS.filter(fits))[0] || shuffle(TRAITS.map(t => t.id).filter(fits))[0] || old.trait;
  S.pcsNames = (S.pcsNames || []).concat(old.name); // the old member's name stays out of the roster
  const nu = { slot: old.slot, rank: RANK_UP[old.rank] || old.rank, pub: 'Hand-picked by the Senior Enlisted Leader', enlisted: true, name,
    trait, revealed: true, loy: 4, out: 0, broken: false, handpicked: true };
  S.npcs[S.npcs.indexOf(old)] = nu;
  log('Talent Management', `${old.rank} ${old.name} PCSed out; ${nu.rank} ${nu.name} arrives`);
  return nu;
}
// Use cadet i's perk (from a phone request or the console). Every perk is once per game.
function usePerk(i) {
  const p = S.party[i], id = p && p.perk, pk = p && perkOf(p);
  if (!id || !perkWhen(S, p, i)) { alert(`${pk ? pk.name : 'That perk'} can't be used right now.`); return false; }
  const name = cadetName(i), c = S.cur, inj = S.inject;
  let what = '';
  switch (id) {
    case 'beenthere': {
      const items = S.items.slice(), flags = { ...S.flags };
      S = JSON.parse(inj.preApply); S.items = items; S.flags = flags; S.actor = null;
      S.inject.stage = 'done'; S.inject.note = 'Cancelled: the SEL has Been There.'; S.inject.cancelled = true;
      what = 'The SEL has seen this one before. The Wheel of Failure result is cancelled: no loss.'; break;
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
    case 'mti': // Prior MTI (UTM): like Lead From the Front, with no ⭐ cost
    case 'lead': { // the FC takes the failed roll on personally: it counts as a pass, ⭐ −1. No reroll on screen:
      // only the net change to the meters (failed result → passed result, plus the ⭐ −1) is shown.
      const t = leadTarget(S), flags = { ...S.flags }, before = { ...S.meters }, fx0 = FX.length;
      if (t === 'mission') { const d = c.rollRes.d20, roller = c.rollRes.roller; S = JSON.parse(c.preRoll); S.flags = flags; resolveRoll(roller, { lead: true, d20: d }); }
      else if (t === 'tackle') { const d = inj.tackleD20, lv = inj.leaver; S = JSON.parse(inj.preTackle); S.flags = flags; resolveTackle({ lead: true, d20: d, leaver: lv }); }
      else return false;
      if (id === 'lead') applyEff({ tru: -1, why: 'Lead From the Front: the commander noticed you overrode your people' });
      FX = FX.slice(0, fx0).concat(FX.slice(fx0).filter(f => !['deltas', 'roll', 'dice', 'injectResult', 'wheel'].includes(f.k)));
      const d = METERS.map(m => [m.k, S.meters[m.k] - before[m.k]]).filter(x => x[1]);
      if (d.length) emit('deltas', { d });
      if (S.base) S.base.m = { ...before }; // the result card now shows just what Lead From the Front changed
      what = id === 'mti' ? `${name} switches to Military Training Instructor mode and takes command. The failed roll now counts as a PASS.`
        : `${name} takes it on personally. The failed roll now counts as a PASS, but ⭐ −1: the commander noticed you overrode your people.`;
      break;
    }
    case 'prepo': S.pending.prepo = true; what = 'The gear was staged ahead of time: the next BX purchase costs no 📦.'; break;
    case 'readiness': S.flags.MOCK_INSPECTION = true; what = `The flight runs its own readiness inspection and fixes what it finds. The IG will start with ${DIFFICULTY.mockInsp} less HP.`; break;
  }
  S.flags['perkUsed_' + id] = true;
  notice(pk.icon || '🎁', `${name.toUpperCase()}: ${pk.name.toUpperCase()}`, what); sfx('loot'); log('Perk', `${name}: ${pk.name}`);
}
function useAbility(i) {
  const c = S.party[i], ab = CLASS[c.cls].ability; if (!ab) return;
  if (c.used >= abilityLimit(c)) return alert('Already used.');
  let what = '';
  if (ab.id === 'rally') {
    applyEff({ mor: 2, why: 'Rally' }); S.npcs.forEach(n => changeLoy(n.slot, 1)); traitCare();
    what = 'The First Sergeant rallies the unit: ❤️ +2 and every Unit member +1 loyalty.';
  } else if (ab.id === 'pcs') {
    const opts = pcsCandidates(S); if (!opts.length) return alert('No enlisted Unit member can PCS right now.');
    const s = opts.length === 1 ? opts[0].slot : (prompt(`Talent Management: who PCSes out? ${opts.map(n => `${n.slot} = ${n.rank} ${n.name} (loyalty ${n.loy})`).join(', ')}`, opts[0].slot) || '').trim().toUpperCase();
    const old = opts.find(n => n.slot === s); if (!old) return;
    const nu = pcsReplace(old); if (!nu) return alert('No unused name left in the roster for a replacement.');
    what = `${old.rank} ${old.name} PCSes out. The SEL hand-picked the replacement: ${nu.rank} ${nu.name} (${TRAIT[nu.trait].icon} ${TRAIT[nu.trait].name}), loyalty ${nu.loy} and already an Ally.`;
  } else if (ab.id === 'sevenlvl') {
    applyEff({ mis: 3, why: '7-Level Upgrade' });
    what = 'The UTM pushes the flight through 7-level upgrade training: 🎯 +3.';
  }
  c.used++;
  notice(clsIcon(c.cls, 80), `${rankName(c).toUpperCase()}: ${ab.name.toUpperCase()}`, what); sfx('loot');
  log('Ability', `${c.name}: ${ab.name}`);
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
    case 'loyOne': { const s = (prompt(`${it.name}: which Unit member? ${S.npcs.map(n => `${n.slot} = ${n.rank} ${n.name} (${n.loy})`).join(', ')}`, 'A') || '').trim().toUpperCase(); if (!npc(s)) return; changeLoy(s, u.d); break; }
    case 'intel': if (!c || c.step !== 'brief') return alert(`${it.name} works while a mission brief is up.`); c.intel = true; break;
    case 'deocs': runDeocs(); toast('📋', 'DEOCS SURVEY RESULTS', `Exact meter values for the next ${DIFFICULTY.deocsStops} stops`); break;
    case 'branch': if (!branchUseful(S)) return alert(`${it.name} works on the route map when your path doesn't reach every next stop.`); S.branch = true; toast(it.icon, it.name.toUpperCase(), 'Vote for ANY stop in the next column'); break;
    case 'wheel': {
      if (!inj || inj.stage !== 'trigger') return alert(`${it.name} works before the inject d6 is rolled.`);
      const w = (prompt(`${it.name}: which wheel? M = Wheel of Meh, S = Wheel of Success`, 'S') || '').trim().toUpperCase();
      if (!['M', 'S'].includes(w)) return;
      inj.filter = w === 'S' ? 'good' : 'mixed'; inj.stage = 'murphy'; setActor('murphy', nextActor());
      log('Inject wheel', `${it.name}: picked ${INJECT_WHEELS[inj.filter].name}`); break;
    }
    case 'recharge': {
      const opts = [];
      S.party.forEach((p, i) => {
        const ab = CLASS[p.cls] && CLASS[p.cls].ability;
        if (ab && !ab.auto && p.used) opts.push([`${i + 1}A`, `${p.name}'s ${ab.name}`, () => { p.used = 0; }]);
        if (p.perk && p.perk !== 'hold' && S.flags['perkUsed_' + p.perk]) opts.push([`${i + 1}P`, `${p.name}'s perk ${perkOf(p).name}`, () => { delete S.flags['perkUsed_' + p.perk]; }]);
      });
      if (!opts.length) return alert('Nothing to recharge yet.');
      const pick = (prompt(`${it.name}: recharge which? ${opts.map(o => `${o[0]} = ${o[1]}`).join(', ')}`, opts[0][0]) || '').trim().toUpperCase();
      const o = opts.find(x => x[0] === pick); if (!o) return; o[2](); break;
    }
    case 'undo': {
      if (!c || !c.preChoice) return alert(`Use ${it.name} right after a decision (before continuing).`);
      const items = S.items.slice(); items.splice(k, 1);
      S = JSON.parse(c.preChoice); S.items = items;
      toast(it.icon, it.name.toUpperCase(), 'Choose again'); sfx('loot'); log('Item', it.name); return;
    }
    case 'cancel': {
      if (!inj || inj.stage !== 'done' || !inj.preApply) return alert(`Use ${it.name} right after a Wheel of Failure result lands.`);
      const pre = JSON.parse(inj.preApply), items = S.items.filter((x, j) => j !== k), flags = { ...S.flags };
      S = pre; S.items = items; S.flags = flags; S.actor = null; S.inject.stage = 'done'; S.inject.note = `Cancelled by the ${it.name}.`; S.inject.cancelled = true;
      toast(it.icon, it.name.toUpperCase(), 'Inject cancelled'); log('Item', `${it.name} cancelled the inject`); return;
    }
    default: return;
  }
  S.items.splice(k, 1);
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
    <div id="gmMain">${S.notice ? `<div class="gcard" style="border-color:var(--gold)"><div class="row"><b style="flex:1">${S.notice.icon} Popup on the projector and phones: ${esc(S.notice.title)}</b>${B('noticeOk', '✅ Continue', { cls: 'pri sm' })}</div><div class="note">${esc(S.notice.text)}</div></div>` : ''}${gmActorCard()}${voteTie(S) ? `<div class="note" style="margin:0 0 6px">${esc(tieText(S))}</div>` : ''}${gmMain()}</div>
    <div id="gmSide">${typeof gmPhonesCard === 'function' ? gmPhonesCard() : ''}${['title', 'join', 'intro', 'party', 'perks', 'kit', 'avatars'].includes(S.phase) ? gmSideLite() : gmSide()}</div>
  </div>`;
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
    case 'unit': return `<div class="gcard"><h2>Pick the squadron</h2><p class="note">The team votes on their phones (✋; the 👑 breaks ties). Click the winner: it draws the Unit members (excluding anyone in this party) and deals traits.</p>
      ${S.unitRolled ? B('toPatch', '🎖️ Next: pick the team patch', { cls: 'pri' }) : `<div class="row">${UNITS.map(u => B('pickUnit', `${u.icon} ${u.name}${voteTag(u.id)}`, { arg: u.id, cls: 'go' })).join('')}</div>`}</div>`;
    case 'join': return gmJoin();
    case 'intro': return gmIntro();
    case 'avatars': return gmAvatars();
    case 'patch': return gmPatch();
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
  const shared = typeof cloudOn === 'function' && cloudOn(); // shared leaderboard: clearing it here would just re-download it
  const R = getRoster();
  const rosterCard = `<div class="gcard"><h3>NPC roster</h3>
    <p class="note">${R.builtin ? `Using the built-in roster from data.js: ${R.upper.length} upper (POC) and ${R.lower.length} lower (AS200/250/500) names. Edit below and save to override it in this browser only.` : `Using a custom roster saved in this browser: ${R.upper.length} upper and ${R.lower.length} lower names.`}</p>
    <div class="note">Upper: Unit members C and D, Squadron CC</div><textarea id="rosterUp">${esc(R.upper.join(', '))}</textarea>
    <div class="note">Lower: SSgt, A1C</div><textarea id="rosterLo">${esc(R.lower.join(', '))}</textarea>
    <div class="row">${B('saveRoster', '💾 Save override')} ${R.builtin ? '' : B('clearRoster', 'Back to built-in roster', { cls: 'sm' })}</div></div>`;
  return `<div class="gcard"><h2>Welcome, Game Master</h2>
    <p>1. Click <b>Open player screen</b> and drag that window onto the projector (press F11 there for full screen). Click it once so sound can play.<br>
    2. Start a new run for each party. The console autosaves, so a closed tab can be resumed.</p>
    ${stopsPicker()}
    <div class="row">${B('newRun', '▶️ Start a new run', { cls: 'pri' })}
    ${saved && saved.phase && saved.phase !== 'title' ? B('resume', `⏯️ Resume saved run (${esc(saved.phase)}${saved.callsign ? ', ' + esc(saved.callsign) : ''})`) : ''}</div></div>
    <div class="gcard"><h3>Leaderboard (${b.length} runs)</h3>${boardTable(b)}
    <div class="row">${B('exportBoard', '💾 Export leaderboard + grades (JSON)')} <label class="b">📂 Import JSON<input type="file" id="importFile" accept=".json" class="hide"></label>
    ${B('exportCSV', '📊 Export grades CSV')} ${shared ? '' : B('clearBoard', '🗑️ Clear leaderboard', { cls: 'red' })}</div>
    <p class="note">${typeof cloudStatus === 'function' ? cloudStatus() + '<br>' : ''}Top 3 non-Game-Over runs earn extra credit. ${shared ? 'Grades stay in this browser only: export them after each practicum day. To delete a leaderboard entry, use the Firebase console.' : 'Data lives in this browser; export a backup after each practicum day.'}</p></div>${rosterCard}`;
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
  <p class="note">Cadets pick their positions (by phone or out loud). Flight Commander is optional (without one, the 👑 tie-break goes down the chain of command: SEL, XO, Plans Officer, First Sergeant, UTM), and there are no duplicate positions. Leave row 4 blank for a 3-person party. Perks stay hidden until the positions are locked.</p>
  ${S.party.map((c, i) => `<div class="gchoice"><div class="row">
    <b>P${i + 1}</b>${c.av != null ? `<img src="${avatarOf(c)}" style="width:28px;height:28px;image-rendering:pixelated">` : ''}<input type="text" id="pname${i}" placeholder="Cadet name (or they join by phone)" value="${esc(c.name)}" data-inp="pname" data-arg="${i}">
    ${Object.values(S.clients || {}).some(k => k.slot === i) ? '<span class="pill y">📱 phone</span>' : ''}
    ${c.name ? B('kick', '✖', { arg: i, cls: 'sm', title: 'Remove this cadet (and their phone)' }) : ''}
    <select data-inp="pcls" data-arg="${i}"><option value="">- position -</option>${CLASSES.map(k => `<option value="${k.id}" ${c.cls === k.id ? 'selected' : ''} ${c.cls !== k.id && taken.includes(k.id) ? 'disabled' : ''}>${k.rank} · ${k.name}</option>`).join('')}</select>
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
  <div class="row">${B('backToClasses', '⬅️ Back to positions')} ${B('lockPerks', '✅ Lock perks → check your kit', { cls: 'pri', dis: S.party.some(c => !c.perk) })}</div></div>`;
}

// Kit check: every cadet opens the 🎒 KIT tab on their phone (class, stats, ability, perk), then comes back to 🎮 GAME
function gmKit() {
  const done = S.party.filter(c => c.kitOk).length;
  return `<div class="gcard"><h2>🎒 Check your kit</h2>
  <p class="note">Every cadet opens the 🎒 KIT tab on their phone to see their position, stats, ability and perk, then taps 🎮 GAME to come back (it marks them ✅ here). Cadets without a phone: read their kit to them from the projector.</p>
  ${S.party.map(c => `<div class="row">${c.kitOk ? '✅' : '⏳'} ${clsIcon(c.cls, 18)} <b>${esc(rankName(c))}</b> <span class="note">${esc(CLASS[c.cls].name)} · ${perkOf(c).icon} ${esc(perkOf(c).name)}</span></div>`).join('')}
  <div class="row">${B('kitDone', `${done === S.party.length ? '✅' : '➡️'} Continue → choose the squadron (${done}/${S.party.length} checked)`, { cls: 'pri' })}</div></div>`;
}
act('kitDone', () => { S.phase = 'unit'; S.votes = {}; sfx('start'); });
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
    g += `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" fill="#1b1b4a" stroke="${nt.color}" stroke-width="2"/><text x="${x}" y="${y + 6}" font-size="16" text-anchor="middle">${nt.icon}</text>`; }));
  g += `<text x="${x0}" y="${H / 2 + 6}" font-size="16" text-anchor="middle">🛫</text><text x="${x1}" y="${H / 2 + 7}" font-size="20" text-anchor="middle">👹</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:560px;background:#0b0b1e;border:1px solid #333;margin:6px 0">${g}</svg>`;
}
// Join screen: the projector is one big QR code so every cadet can scan it before the briefing starts
function gmJoin() {
  const n = Object.keys(S.clients || {}).length;
  return `<div class="gcard"><h2>📱 Join screen</h2>
    <p class="note">The projector shows the join QR code full screen. Wait until every cadet has scanned it and joined, then start the briefing. Cadets can still join later (until positions are picked); the QR stays in the corner.</p>
    <p><b>${n}</b> phone${n === 1 ? '' : 's'} joined${n ? `: ${Object.values(S.clients).map(c => esc(c.name)).join(', ')}` : ''}</p>
    <div class="row">${B('startBriefing', '▶️ Start the briefing', { cls: 'pri' })}</div></div>`;
}
act('startBriefing', () => { S.phase = 'intro'; S.introPage = 0; sfx('click'); });
function gmIntro() {
  const pg = S.introPage;
  const txt = ['The projector shows WHY ARE WE DOING THIS?: the five practicum objectives. Tell them every stop tests at least one, and the debrief will show which.',
    'The projector shows HOW TO PLAY: the whole game in one screen. Read it out loud (about 60 seconds).',
    'The projector shows JOB 1: keep all 4 meters high (they only show STRONG / STEADY / DANGER until someone runs a DEOCS Survey). Every other icon is in the Field Guide.',
    'The projector shows JOB 2 on its own: one integrity violation (lie, cover up, fudge a record, skip the paperwork) = GAME OVER. Pause here and let it land.'][pg];
  return `<div class="gcard"><h2>Game briefing (${pg + 1}/4)</h2>
    <p class="note">${txt}</p>
    <div class="row">${B('introPrev', '⬅️ Back', { dis: pg === 0 })} ${pg < 3 ? B('introNext', ['Next: how to play ➡️', 'Next: Job 1 (meters) ➡️', 'Next: Job 2 (integrity) ➡️'][pg], { cls: 'pri' }) : B('toParty', '▶️ Go to character icons', { cls: 'pri' })}</div></div>`;
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
    ${B('avDone', '✅ Done: go to position select', { cls: 'pri', dis: named.length < 2 || named.some(p => p.av == null) })}</div>`;
}

function gmManifest() {
  const u = UNITS.find(x => x.id === S.unit);
  return `<div class="gcard"><h2>${u.icon} ${u.name}: ${u.sq}</h2>
  <p><b>Sq CC:</b> ${esc(S.cc)} · <b>Intent:</b> ${METER[u.cc.intent].icon} ${METER[u.cc.intent].label} (7+ at the end = +${DIFFICULTY.intent}, under 4 = −${DIFFICULTY.intent})<br>
  👍 <b>${esc(u.cc.pos.name)}</b>: ${esc(u.cc.pos.text)}<br><span style="${confidantIdx(S) >= 0 ? 'opacity:.45;text-decoration:line-through' : ''}">👎 <b>${esc(u.cc.neg.name)}</b>: ${esc(u.cc.neg.text)}</span>${confidantIdx(S) >= 0 ? ' <span class="note">(cancelled by the XO)</span>' : ''}<br>
  <b>Tendency:</b> ${esc(u.drain.name)}: ${esc(u.drain.text)} (${METER[u.drain.k].label} −1 every ${DIFFICULTY.drainEvery} stops)</p>
  <table class="g"><tr><th>Slot</th><th>Unit member</th><th>Role</th><th>Trait (visible to everyone)</th></tr>
  ${S.npcs.map(n => { const t = TRAIT[n.trait]; return `<tr><td>${n.slot}</td><td>${insignia(n.rank, 18)}${esc(n.rank + ' ' + n.name)}</td><td class="note">${esc(n.pub)}</td><td>${t.icon} <b>${t.name}</b>: ${esc(t.what)}<br><span class="note">Reward: ${esc(t.reward)} · Breaking point: ${esc(t.bpText)}</span></td></tr>`; }).join('')}</table>
  <p class="note">The projector shows the org chart. Give the party ~45 seconds to read it, then open the map.</p>
  <p><b>Team patch:</b> ${S.patch ? `${(patchOf(S) || {}).icon} ${esc(S.callsign)}` : 'none'}</p>
  ${B('toMap', '🗺️ Open the route map', { cls: 'pri' })}</div>`;
}
// Team patch = team name: its own screen between the squadron reveal and the org chart
function gmPatch() {
  return `<div class="gcard"><h2>🎖️ Team patch</h2>
  <p class="note">The patch is the team's name on the leaderboard. The team votes on their phones (✋; the 👑 breaks ties). Click the winner to lock it in. Patches already on the leaderboard are taken. If nobody locks one in, the top vote (or the first free patch) is used.</p>
  <div class="row">${S.patch ? `<span class="pill y">${(patchOf(S) || {}).icon} ${esc(S.callsign)} locked in</span> ${B('unsetPatch', 'Change (reopen the vote)', { cls: 'sm' })}`
    : (PATCHES[S.unit] || []).map(p => B('setPatch', `${p.icon} ${esc(p.name)}${patchFree(S, p.id) ? voteTag(p.id) : ' (taken)'}`, { arg: p.id, cls: 'go sm', dis: !patchFree(S, p.id) })).join(' ')}</div>
  <div class="row">${B('showManifest', '📋 Show the org chart', { cls: 'pri' })}</div></div>`;
}

function gmMap() {
  const av = available();
  return `<div class="gcard"><h2>Route map: next stop</h2>
  <p class="note">${S.map.tiers.length} stops, then the IG. Paths branch and merge; the party can only move along the lines. The party votes on their phones (✋); click the winner. Level up after stop ${levelAfter()}. ❓ and 🔦 are rolled when the party arrives.${S.branch ? ' <b>🌿 Branch Plan active: any stop in the next column.</b>' : ''}</p>
  ${S.map.tiers.map((tier, t) => `<div class="row"><b style="width:60px">Stop ${t + 1}</b>${tier.map((nd, i) => {
    const open = av.some(([a, b]) => a === t && b === i);
    const nt = NODE_TYPES[nd.type];
    return B('node', `${nt.icon} ${nt.name}${nd.visited ? ' ✔' : ''}${open ? voteTag(`${t},${i}`) : ''}`, { arg: `${t},${i}`, dis: !open, cls: open ? 'go' : nd.visited ? 'on' : '' });
  }).join('')}</div>`).join('')}
  ${wpOptions().length ? `<div class="row"><b>${CHECKPOINT[wpOptions()[0].kind].icon} Checkpoint first:</b> ${wpOptions().map(o => B('waypoint', `${CHECKPOINT[o.kind].icon} ${CHECKPOINT[o.kind].short} → ${o.then.icon} ${o.then.name}${voteTag(o.key)}`, { arg: o.key, cls: 'go' })).join('')}<span class="note">Picking a waypoint runs it and locks in the path to that next stop.</span></div>` : ''}
  <div class="row"><b style="width:60px">Boss</b><span class="pill">👹 ${BOSS.name}</span></div>
  ${S.pos.tier >= 0 && S.pos.tier < lastTier() ? `<div class="row">${B('collapse', `⏩ Running late: skip the remaining ${lastTier() - S.pos.tier} stop(s), go to the boss`)}</div>` : ''}</div>`;
}

function gmChoiceList(m, c) {
  const votes = S.votes || {};
  return m.choices.map((ch, i) => {
    const picked = c.choice === i;
    const voters = Object.keys(votes).filter(s => votes[s] === i).map(s => cadetName(+s));
    const sw = c.swap && c.swap.includes(i) ? ' <span class="pill y">PLOT TWIST swapped</span>' : '';
    const locked = ch.req && !gateOpen(ch.req);
    return `<div class="gchoice" style="${picked ? 'border-color:var(--gold)' : ''}${locked ? ';opacity:.5' : ''}"><div class="h">
      <b>${'ABCD'[i]}</b><span class="t">${esc(fill(S, ch.t))} ${ch.mic ? '🎤' : ''} ${ch.req ? `<span class="pill">🔐 ${ch.req.stat} +${ch.req.min}${locked ? ' (nobody has it)' : ''}</span>` : ''} ${ch.trap ? '<span class="trap">💀 TRAP</span>' : ''}${sw}</span>
      <span>${arrows(choiceShow(ch))}</span>
      ${voters.length ? `<span class="pill y" title="${esc(voters.join(', '))}">📱 ${voters.length} vote${voters.length > 1 ? 's' : ''}</span>` : ''}
      ${c.step === 'brief' ? B('choose', 'Choose', { arg: i, cls: 'go', dis: locked }) : ''}</div>
      <div class="eff">${esc(specText(S, ch))}</div>${ch.note ? `<div class="note">${esc(fill(S, ch.note))}</div>` : ''}</div>`;
  }).join('');
}

function gmNode() {
  const c = S.cur;
  if (c.type === 'rest' || c.type === 'depot') {
    const rest = c.type === 'rest';
    let body;
    if (c.step === 'choose') body = `<div class="row">${(rest ? restOptions() : depotOptions()).map(o => B(rest ? 'restPick' : 'depotPick', o.label + voteTag(o.key), { arg: o.key, dis: o.dis, cls: o.key === 'offbooks' ? 'red' : '' })).join('')}</div>
      ${!rest ? `<div class="row">${gmPerkButton('prepo')}${S.pending.prepo ? '<span class="pill y">📦 Pre-Positioned Supplies: the next purchase is free</span>' : ''}</div><p class="note">The GPC card option is an integrity trap: the IG finds it in the Audit (Game Over). Don\'t warn them.</p>` : ''}`;
    else if (c.step === 'who') body = `<p>${c.trade === 'favor' ? 'A Unit member grabs you something (−2 loyalty, loot spin)' : 'Volunteer for the BX Saturday detail (−1 loyalty, +3 🎯)'}: the team picks who pays (they vote on phones).</p>
      <div class="row">${stopOptions().map(o => B('depotWho', o.label + voteTag(o.key), { arg: o.key.slice(4), dis: o.dis })).join('')} ${B('depotBack', '⬅️ Back', { cls: 'sm' })}</div>`;
    else if (c.step === 'train') body = `<p>Study guides (−2 📦): pick the cadet and the stat they train.</p>
      ${S.party.map((p, i) => `<div class="row"><b style="width:140px">${esc(cadetName(i))}</b>${STATS.map(st => B('depotTrain', `${st} ${sign(statOf(i, st))} → ${sign(statOf(i, st) + 1)}`, { arg: `${i},${st}`, cls: 'sm' })).join('')}</div>`).join('')}
      ${B('depotBack', '⬅️ Back', { cls: 'sm' })}`;
    else body = gmDonePanel();
    return `<div class="gcard"><h2>${rest ? '🏕️ Rest Stop' : '🛒 Base Exchange (BX)'}</h2><p class="note">The party votes on their phones (✋); click the winning option.</p>${body}</div>`;
  }
  if (c.type === 'unknown') {
    const my = c.mystery != null ? MYSTERY[c.mystery] : null;
    return `<div class="gcard"><h2>❓ Unknown node</h2>
    ${c.step === 'spin' ? `<p class="note">Nothing is decided yet: the d6 picks the outcome when the cadet presses it. ${MYSTERY.map((m, i) => `${i + 1} ${m.name}`).join(' · ')}</p>${B('spinMystery', '🎲 Roll the d6', { cls: 'pri' })}`
        : spinning() ? '<p class="note">Spinning...</p>' : `<p class="bigres">${my.name}</p>${B('mysteryGo', 'Continue ➡️', { cls: 'pri' })}`}</div>`;
  }
  const m = curMission();
  const isCE = c.type === 'crisisEvent';
  let body = '';
  if (c.step === 'brief') body = `<div class="row">${B('timer', '⏱️ 30s decision clock', { arg: 30 })}</div>`;
  else if (c.step === 'roll') body = gmRollPanel();
  else if (c.step === 'stars') body = gmStarsPanel();
  else if (c.step === 'done') body = gmDonePanel();
  return `<div class="gcard"><h2>${m.icon} ${c.type === 'elite' ? '💀 ELITE: ' : isCE ? '🚨 ' : c.type === 'spot' ? '🔦 ' : ''}${esc(m.title)}</h2>
    <div class="note">${esc(m.sob)} ${c.type === 'elite' ? '· ELITE: every check is one step harder (+3), positive effects double, loot guaranteed' : ''}</div>
    ${c.type === 'spot' ? `<p class="warnline">🔦 Spotlight on ${esc(cadetName(c.slot))}: only their phone can vote or roll. Everyone else stays silent.</p>` : ''}
    ${m.cc ? `<p class="warnline">🎖️ Commander encounter: you play ${esc(S.cc)}.</p>` : ''}
    <p style="font-size:15px">${esc(fill(S, m.text))}</p>${isCE ? `<p class="warnline">💀 Lost for good: ${esc(m.loss || '')} · A second crisis = GAME OVER.</p>` : ''}
    ${S.banner && c.type !== 'spot' ? `<p class="warnline">${esc(S.banner.text)} ${B('clearBanner', 'clear', { cls: 'sm' })}</p>` : ''}
    ${S.offline != null ? `<p class="warnline">📵 ${esc(cadetName(S.offline))} is offline this node.</p>` : ''}
    ${gmChoiceList(m, c)}${body}</div>`;
}

function gmRollPanel() {
  const c = S.cur, ch = c.spec.check, r = c.roller;
  const preview = rollPreview();
  const isLoy = ch.stat === 'LOYB';
  return `<div class="gchoice" style="border-color:var(--accent)"><b>🎲 CHECK: ${esc(statLabel(ch.stat))} vs ${preview.dc}</b> <span class="pill y">${rollOdds(preview, c.safe)}</span>
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
  return `<div class="gchoice" style="border-color:var(--gold)"><b>🎤 DIALOGUE ENCOUNTER</b> <span class="note">You play the other side. Start the act clock, let them act it out, then rate it.</span>
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
    <div class="row">
      ${gmPerkButton('mti')} ${gmPerkButton('lead')}
      ${c.fumblePending ? B('fumble', '🤦 Spin the Fumble wheel', { cls: 'red' }) : ''}
      ${c.lootRoll && !c.fumblePending ? B('lootd4', '🎲 Roll the d4 for loot', { cls: 'pri' }) : ''}
      ${c.lootEarned && !c.fumblePending && !c.lootRoll ? B('loot', '🎁 Spin for loot!', { cls: 'pri' }) : ''}
      ${typeof depotAgainOk === 'function' && depotAgainOk() ? B('depotAgain', '🛒 Logistician: make a second trade', { cls: 'go' }) : ''}
      ${spinning() ? '<span class="note">Spinning...</span>' : (!pending ? B('nodeDone', 'Continue ➡️', { cls: 'pri' }) : '')}
    </div>${pending && !spinning() ? '<div class="note">These are the cadets\' buttons (see the yellow banner above); press here only to do it for them.</div>' : ''}</div>`;
}

function gmInject() {
  const inj = S.inject;
  if (!inj) return '';
  const m = inj.idx != null ? MURPHY[inj.idx] : null;
  let body = '';
  if (inj.stage === 'trigger') body = `<p class="note">d6 picks the wheel: ${INJECT_ORDER.map(t => `${injectRange(t)} ${INJECT_WHEELS[t].name}`).join(' · ')}.</p>${B('spinTrigger', '🎲 Roll the d6', { cls: 'pri' })}`;
  else if (spinning()) body = '<p class="note">Spinning on the projector...</p>';
  else if (inj.stage === 'clear') body = `<p class="bigres ok">ALL CLEAR</p>${B('closeInject', 'Continue ➡️', { cls: 'pri' })}`;
  else if (inj.stage === 'murphy') body = `<p class="bigres">${INJECT_WHEELS[inj.filter].icon} ${INJECT_WHEELS[inj.filter].name}</p>${B('spinMurphy', '🎡 Spin the wheel', { cls: 'pri' })}`;
  else if (inj.stage === 'result') body = `<p class="bigres">${esc(m.name)} <span class="pill">${m.type}</span></p><p>${esc(fill(S, m.text || ''))} ${m.options ? '' : effText(S, m.eff)}</p>
      ${inj.blocked ? '<p class="ok">Blocked by Foresight.</p>' : ''}
      ${m.options ? `<p class="note">The team votes on their phones (✋) for how to respond; click the winner.</p><div class="row">${m.options.map((o, i) => B('applyInject', `${esc(fill(S, o.t))}: ${effText(S, o.eff)}${voteTag(i)}`, { arg: i, cls: 'go' })).join('')}
        ${m.tackle && !inj.blocked ? B('applyInject', `💪 Tackle it: d20 + ${m.tackle.stat} vs ${m.tackle.dc + DIFFICULTY.dcPlus}${voteTag(m.options.length)}`, { arg: m.options.length, cls: 'go' }) : ''}</div>` : B('applyInject', 'Apply', { arg: 0, cls: 'pri' })}`;
  else if (inj.stage === 'tackle') { const t = m.tackle, r = inj.roller;
    body = `<p class="bigres">💪 TACKLE IT: ${esc(m.name)}</p><p class="note">d20 + ${t.stat} vs ${t.dc + DIFFICULTY.dcPlus}. Pass = no loss; fail = ${effText(S, t.fail || {})}. The team votes on who rolls; once you lock it in, the roller taps ROLL.</p>
      <div class="row">${inj.rollerLocked ? 'Roller locked:' : '🗳️ The team votes; click the winner to lock it in:'} ${S.party.map((p, i) => B('tackleRoller', `${esc(p.name)} (${t.stat} ${sign(rollBonus(i, t.stat, t.m))}${isSpec(i, t.m) ? ' ★' : ''})${inj.rollerLocked ? '' : voteTag('r' + i)}`, { arg: i, cls: inj.rollerLocked && r === i ? 'on' : 'go', dis: isOut(S, i) })).join('')}</div>
      `; }
  else if (inj.stage === 'done') body = `<p class="bigres">${esc(m ? m.name : '')}</p><p>${esc(fill(S, inj.note || ''))}</p>
      <div class="row">${m && m.type === 'bad' && !inj.cancelled ? S.items.map((id, k) => { const l = LOOT.find(x => x.id === id); return l.use.type === 'cancel' ? B('item', `${l.icon} Use ${esc(l.name)} (cancel it)`, { arg: k }) : ''; }).join('') : ''} ${gmPerkButton('beenthere')} ${gmPerkButton('mti')} ${gmPerkButton('lead')}
      ${B('closeInject', 'Continue ➡️', { cls: 'pri' })}</div>`;
  return `<div class="gcard"><h2>${inj.forced ? '🃏 Curveball: ' : ''}Injects</h2>${body}</div>`;
}

function gmLevel() {
  return `<div class="gcard"><h2>⬆️ LEVEL UP!</h2><p class="note">Each cadet picks one upgrade.</p>
  ${S.party.map((p, i) => `<div class="gchoice"><b>${clsIcon(p.cls, 18)} ${esc(p.name)}</b> <span class="note">${CLASS[p.cls].name}</span>
    <div class="row">${CLASS[p.cls].ups.map(u => `<label class="b ${p.up === u.id ? 'on' : ''}"><input type="radio" class="hide" name="up${i}" data-inp="pup" data-arg="${i}" value="${u.id}" ${p.up === u.id ? 'checked' : ''}>${esc(u.name)}: <span class="note">${esc(u.text)}</span></label>`).join('')}</div></div>`).join('')}
  ${B('confirmLevel', '✅ Confirm upgrades', { cls: 'pri', dis: S.party.some(p => !p.up) })}</div>`;
}

function gmBoss() {
  const Bs = S.boss, Rd = BOSS_ROUNDS[Bs.round - 1];
  let body = '';
  const tele = Bs.atk ? `<p class="warnline">${Rd.icon} Round ${Bs.round}: ${Rd.name} · IG telegraphs ${esc(Bs.atk.name)}: ${METER[Bs.atk.k].icon} −${Bs.atk.n} at the end of the round</p>` : '';
  if (Bs.stage === 'intro') body = `<p>The boss intro is on the projector. HP ${Bs.hp}/${Bs.max}.</p>${B('bossNext', '📋 THE AUDIT: integrity check, then round 1', { cls: 'pri' })}`;
  else if (Bs.stage === 'hotseat' && !Bs.p2.who) body = `${tele}<p class="note">Everyone rolls a d20; the two lowest rolls answer the IG's questions (a cadet presses it on their phone).</p>${B('hotSeat', '🎲 Roll for the hot seat', { cls: 'pri' })}`;
  else if (Bs.stage === 'hotseat') body = `${tele}${Bs.p2.who.map((w, j) => `<div class="gchoice"><b>${esc(cadetName(w))}</b> <span class="note">(rolled ${Bs.p2.rolls ? Bs.p2.rolls[w] : '?'})</span><div>"${esc(Bs.p2.q[j])}"</div>
      <div class="row">${B('timer', '⏱️ 20s', { arg: 20 })} ${[1, 2, 3].map(n => B('bossStar', '⭐'.repeat(n), { arg: `${j},${n}`, cls: Bs.p2.stars[j] === n ? 'on' : '' })).join('')}</div></div>`).join('')}
      ${B('bossStarsDone', '💥 Score the answers, then everyone picks an action', { cls: 'pri', dis: Bs.p2.stars.some(x => !x) })}`;
  else if (Bs.stage === 'act') {
    body = `${tele}<p class="note">Each cadet picks ONE action on their phone (secret until you resolve). Press target ${examDC(Bs)}${Bs.adverse ? ', −1 to every roll (Adverse Finding)' : ''}. You can set actions for anyone without a phone.</p>
      ${S.party.map((p, i) => { const a = Bs.acts[i]; return `<div class="gchoice"><b>${esc(cadetName(i))}</b> <span class="${a ? '' : 'note'}">${esc(bossActText(i, a))}</span>
        <div class="row">${B('bossAct', `🗡️ Press (${bestStat(i)} ${sign(statOf(i, bestStat(i)))})`, { arg: `${i},press`, cls: 'sm' + (a && a.type === 'press' ? ' on' : ''), dis: !bossActOk(i, { type: 'press' }) })}
        ${B('bossAct', '🛡️ Defend (block 2)', { arg: `${i},defend`, cls: 'sm' + (a && a.type === 'defend' ? ' on' : ''), dis: !bossActOk(i, { type: 'defend' }) })}</div></div>`; }).join('')}
      <div class="row">${B('timer', '⏱️ 30s action clock', { arg: 30 })} ${B('bossResolve', `💥 Resolve round ${Bs.round}`, { cls: 'pri', dis: spinning() })}</div>`;
  } else if (Bs.stage === 'resolved') body = `${tele}<div class="row">${B('bossNext', Bs.round < BOSS_ROUNDS.length ? `➡️ Round ${Bs.round + 1}: ${BOSS_ROUNDS[Bs.round].name}` : '📋 Inspection result', { cls: 'pri', dis: spinning() })}</div>`;
  else if (Bs.stage === 'done') body = `<p class="bigres">${esc(Bs.result)}</p>${B('finish', '🏁 Show final results', { cls: 'pri' })}`;
  return `<div class="gcard"><h2>👹 ${BOSS.name}: ${BOSS.title}</h2><p><b>HP ${Bs.hp}/${Bs.max}</b> · ${Bs.round ? `Round ${Bs.round}/3` : 'Intro'}${Bs.adverse ? ' · 🚨 Adverse Finding (−1 rolls)' : ''}${Bs.weak ? ' · 🕵️ Witness tip (target −3)' : ''}</p>${body}
    <div class="log" style="margin-top:10px">${Bs.log.map(l => `<div>${esc(l)}</div>`).join('')}</div></div>`;
}
// A "use this perk" button for whoever has it, only when it can be used right now
function gmPerkButton(id) {
  const i = S.party.findIndex(p => p.perk === id); if (i < 0 || !perkWhen(S, S.party[i], i)) return '';
  return B('perkUse', `${perkOf(S.party[i]).icon} ${esc(cadetName(i))}: ${esc(perkOf(S.party[i]).name)}`, { arg: i, cls: 'go' });
}

function gmResults() {
  const f = S.final;
  return `<div class="gcard"><h2>${S.gameOver ? '💀 GAME OVER' : 'Final results'}</h2>
    <p class="bigres" style="color:${f.grade.color}">Grade ${f.grade.g}: ${esc(f.grade.title)} · ${f.total} pts</p>
    ${S.gameOver ? `<p class="bad">${esc(S.gameOverReasons.join('; '))}</p>` : ''}
    <table class="g">${f.parts.map(p => `<tr><td>${esc(p[0])}</td><td>${p[1]}</td></tr>`).join('')}</table>
    <p class="note">${S.saved ? `✅ Saved to the leaderboard automatically as ${(patchOf(S) || {}).icon || ''} ${esc(S.callsign)}.` : B('saveBoard', '🏆 Save to leaderboard', { cls: 'pri' })}</p>
    <div class="row">${B('board', S.showBoard ? 'Hide leaderboard on projector' : 'Show leaderboard on projector')} ${B('toDebrief', '🔌 Power down: reality debrief', { cls: 'go' })}</div></div>`;
}

const objEvents = (S, id) => (S.objLog || []).filter(e => e.obj.includes(id));
function suggestions() {
  const q = [], L = S.log.map(l => l.t + ' ' + l.d).join(' | ');
  if (S.gameOver || S.flags.HONEST_BROKER || S.ach.includes('hardright')) q.push('What made the integrity shortcut tempting? What would it cost you in real life?');
  if ((S.npcs || []).some(n => n.broken)) q.push("Everyone's trait was on the org chart, and someone still hit their breaking point. What did you see coming, and why didn't you act on it?");
  if (S.micLow) q.push('One encounter earned only 1 star. Redo that line now: what would you say to that Airman?');
  if (S.meters.mis >= 7 && S.meters.mor <= 4) q.push('You won the mission and lost the people. When is that the right call?');
  if (S.crises) q.push('You hit a Crisis Event. Which earlier decision set that up, and when could you still have stopped it?');
  if (S.flags.LOST_AIRMAN) q.push("Your flight lost an Airman. What warning signs do real units miss, and what is a leader's duty when they see one?");
  if (S.party.some(p => p.fired)) q.push('Your Flight Commander was relieved. What does a commander need to see to keep confidence in a leader?');
  if (S.usedMissions.includes('M3')) q.push('What barrier to creative thinking showed up in "We tried that in 2019," and what removes it?');
  const used = id => S.usedMissions.includes(id);
  if (used('M19') || used('M24')) q.push('Which warning signs showed up before it became a crisis? Who had a duty to report them, and what made it hard?');
  if (used('M13') || used('M14') || used('M15')) q.push('Where is the line between taking care of an Airman and covering for them?');
  if (used('M22')) q.push('How do you correct insubordination in public without losing the room, or the Airman?');
  if (used('M17') || used('M23')) q.push('Was that a discipline problem or a leadership problem (schedules, fatigue)? How do you tell the difference?');
  const u = unitObj();
  if (u) q.push(`Your squadron's tendency was ${u.drain.name} (${METER[u.drain.k].label}). How did you plan around it, and what is the real-world version in a ${u.sq}?`);
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
  lines.push(g ? `Team result: ${g.g} · ${g.title}${S.gameOver ? '' : ` (${S.final.total} pts)`}` : 'Team result: not finished');
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
    <div class="row">${B('dview', '🎯 Objectives', { arg: 'objectives', cls: dv.view === 'objectives' ? 'on' : '' })} ${B('dview', '📖 Decoder', { arg: 'decoder', cls: dv.view === 'decoder' ? 'on' : '' })} ${B('dview', '🕒 Replay timeline', { arg: 'timeline', cls: dv.view === 'timeline' ? 'on' : '' })}</div>
    ${dv.view === 'timeline' ? `<p class="note">Click an event to spotlight it on the projector.</p><div class="log" style="max-height:260px">${S.log.map((l, i) => `<div><button class="b sm ${dv.spot === i ? 'on' : ''}" data-act="spot" data-arg="${i}">🔦</button> N${l.n} · <b>${esc(l.t)}</b> ${esc(l.d)}</div>`).join('')}</div>` : ''}
    ${dv.view === 'objectives' ? `<p class="note">The projector shows the five objectives and every event in this run that tested each one. Use it as the wrap-up.</p>${OBJECTIVES.map(o => { const ev = objEvents(S, o.id); return `<div class="gchoice"><b>${o.icon} ${esc(o.name)}</b> <span class="note">${ev.length} event${ev.length === 1 ? '' : 's'}</span>${ev.map(e => `<div class="note">Stop ${e.n} · ${esc(e.title)}${e.choice ? `: "${esc(e.choice)}"` : ''}</div>`).join('')}</div>`; }).join('')}` : ''}
    <h3 style="margin-top:12px">Suggested questions</h3><ol>${suggestions().map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
    <div class="gcard"><h3>Practicum rubric (GM only) · ${RUBRIC.map(r => `${r[1]} ${r[2]}`).join(' · ')} = /${RUBRIC_MAX}</h3>
    <p class="note">Everyone starts at ${RUBRIC_MAX}/${RUBRIC_MAX}; mark down from there. Concepts is pre-filled from the run (light deductions, −2 at most) and each cadet's notes start with the team review below. Edit anything.</p>
    <div class="gchoice">${teamReview(S).lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>
    ${S.party.map((p, i) => { const g = S.grades[i] || defaultGrade(); return `<div class="gchoice"><b>${esc(p.name)}</b> <span class="note">${CLASS[p.cls].name}</span> · <b>${(+g.ref) + (+g.eng) + (+g.con)}/${RUBRIC_MAX}</b>
      ${RUBRIC.map(([k, lbl, mx]) => `<div class="slider">${lbl}<input type="range" min="0" max="${mx}" value="${g[k]}" data-inp="grade" data-arg="${i},${k}"><b>${g[k]}</b></div>`).join('')}
      <textarea placeholder="Notes (the cadet sees these when you show them)" data-inp="gnote" data-arg="${i}">${esc(g.notes)}</textarea>
      <div class="row">${B('showGrade', g.shown ? '🙈 Hide from cadet' : '📱 Show cadet', { arg: i, cls: g.shown ? 'on sm' : 'sm go', title: 'Sends this score and your notes to this cadet\'s phone only' })}${g.shown ? '<span class="note">On their phone now. Edits update it live.</span>' : ''}</div></div>`; }).join('')}
    <div class="row">${B('saveGrades', S.gradesSaved ? '✅ Grades saved' : '💾 Save grades')} ${B('exportCSV', '📊 Export all grades CSV')} ${B('newRun', '▶️ Next party: new run', { cls: 'pri' })}</div></div>`;
}

function gmSideLite() {
  return `${routeCard()}
  <div class="gcard"><h3>Quick reference</h3><p class="note">Checks: d20 + stat (+2 if the tied meter is 8+, −2 if 2 or less). Normal ${DC_NORMAL}, Hard ${DC_HARD}. Nat 20 = crit (double good + loot). Nat 1 = fumble.<br>
    Harder settings (DIFFICULTY in data.js): an inject after every ${DIFFICULTY.injectEvery === 1 ? '' : DIFFICULTY.injectEvery === 2 ? 'other ' : DIFFICULTY.injectEvery + 'th '}stop (d6: ${INJECT_ORDER.map(t => injectRange(t) + ' ' + t).join(', ')}), squadron tendency −1 every ${DIFFICULTY.drainEvery} stops, IG HP ${DIFFICULTY.bossHp}, IG hits −${DIFFICULTY.bossAttack}.<br>Score = meters×3 + lowest meter×10 + intent ±20 + inspection (+60 to −15) + stars×5 + achievements (0-25 each) + allies×10. Unused items/perks score nothing.</p></div>`;
}
function gmSide() {
  return `${routeCard()}
  <div class="gcard"><h3>Meters (manual override)</h3><div class="gmeters">${METERS.map(m => `<div class="mt">${m.icon}<span>${m.name}</span>${B('meter', '−', { arg: m.k + ',-1', cls: 'sm' })}<b>${S.meters[m.k]}</b>${B('meter', '+', { arg: m.k + ',1', cls: 'sm' })}</div>`).join('')}</div>
    <div class="note">${deocsOn(S) ? `📋 DEOCS Survey running: players see exact numbers (${deocsLeft(S)} more stop${deocsLeft(S) === 1 ? '' : 's'})` : `Players see STRONG / STEADY / DANGER (≤${DIFFICULTY.dangerAt}), not numbers.`}</div>
    ${S.crisisQueue.length ? `<p class="warnline">Crisis queued: ${S.crisisQueue.map(k => METER[k].name).join(', ')}</p>` : ''}</div>
  <div class="gcard"><h3>Party & abilities</h3><p class="note">👑 The Flight Commander (without one, the next in the chain of command) breaks tied votes (Rock, Paper, Rank). That is the token's only power.</p>
    ${S.party.map((p, i) => { const ab = CLASS[p.cls].ability; return `<div class="row"><b>${clsIcon(p.cls, 18)} ${esc(p.name)}${i === crownIdx(S) ? ' 👑' : ''}${p.fired ? ' 🪓 FIRED' : ''}</b>
      ${ab ? B('ability', `${esc(ab.name)} ${ab.auto ? '(passive)' : p.used >= abilityLimit(p) ? '(used)' : ''}`, { arg: i, cls: 'sm', dis: ab.auto || p.used >= abilityLimit(p), title: ab.text }) : ''}
      <span class="note">${esc(perkOf(p).name)}${p.up ? ' · ' + esc(upOf(p).name) : ''}</span></div>`; }).join('')}</div>
  <div class="gcard"><h3>🎁 Perks (once per game)</h3>${S.party.map((p, i) => { const pk = perkOf(p), used = S.flags['perkUsed_' + p.perk], w = perkWhen(S, p, i);
      return `<div class="row"><b>${clsIcon(p.cls, 18)} ${esc(p.name)}</b> ${pk.icon} ${esc(pk.name)} ${used ? '<span class="pill">used</span>' : w ? B('perkUse', 'use now', { arg: i, cls: 'sm go', title: w.hint }) : '<span class="note">not now</span>'}
        ${used && p.perk !== 'hold' ? B('perkReset', '↺', { arg: i, cls: 'sm', title: 'Manual fix: mark unused' }) : ''}</div>`; }).join('')}</div>
  ${S.unit ? (() => { const u = unitObj(); return `<div class="gcard"><h3>${npcIns(S.cc, 18)} ${esc(S.cc)}</h3><div class="note">Intent: ${METER[u.cc.intent].icon} ${METER[u.cc.intent].label} (now ${S.meters[u.cc.intent]})</div>
    <div>👍 <b>${esc(u.cc.pos.name)}</b> <span class="note">${esc(u.cc.pos.text)}</span></div><div style="${S.flags.ccNegOff ? 'opacity:.4;text-decoration:line-through' : ''}">👎 <b>${esc(u.cc.neg.name)}</b> <span class="note">${esc(u.cc.neg.text)}</span></div></div>`; })() : ''}
  <div class="gcard"><h3>NPCs</h3>${S.npcs.map(n => { const t = TRAIT[n.trait]; return `<div class="row"><b>${n.slot}</b> ${insignia(n.rank, 18)}${esc(n.rank + ' ' + n.name)}${n.gone ? ' <span class="pill">GONE</span>' : ''}
      ${B('loy', '−', { arg: n.slot + ',-1', cls: 'sm' })}<b>${n.loy}</b>${B('loy', '+', { arg: n.slot + ',1', cls: 'sm' })}
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
  playerWin = window.open(location.href.split('#')[0] + '#player', 'sqPlayer', 'width=1280,height=760');
  return false;
});
act('mute', () => { S.muted = !S.muted; });
act('board', () => { S.showBoard = !S.showBoard; });
act('undo', () => { if (!hist.length) return false; hist.pop(); S = JSON.parse(hist.pop() || JSON.stringify(S)); });
act('newRun', () => { if (S.phase !== 'title' && S.phase !== 'debrief' && !confirm('Abandon this run and start a new one?')) return false; startRun(); });
act('resume', () => { try { S = JSON.parse(localStorage.getItem('sq_run')); } catch (e) { } });
act('introNext', () => { S.introPage = Math.min(3, S.introPage + 1); sfx(S.introPage === 3 ? 'alarm' : 'click'); });
act('introPrev', () => { S.introPage = Math.max(0, S.introPage - 1); });
act('noticeOk', () => { S.notice = null; });
act('setStops', n => {
  if (S.mapLocked) { alert('The route map is already open: the length can only change before that.'); return false; }
  S.stops = +n; try { localStorage.setItem('sq_stops', String(+n)); } catch (e) { }
  if (S.phase !== 'title') S.map = genMap();
});
act('rerollMap', () => { if (S.mapLocked) return false; S.map = genMap(); sfx('click'); });
act('toParty', () => { S.phase = 'avatars'; sfx('start'); });
act('setAv', a => { const [i, k] = a.split(',').map(Number); S.party[i].av = k; S.party[i].g = AVATARS[k].g; sfx('click'); });
act('avDone', () => { S.phase = 'party'; log('Avatars', 'Chosen'); sfx('start'); });
// GM presses a pending cadet button on their behalf
act('actorGo', () => { if (!S.actor || spinning()) return false; S.lastActor = S.actor.slot; const f = ACTOR_RUN[S.actor.kind]; if (f) f(); });
// party-voted rest stop / supply depot options, by key
act('restPick', k => {
  if (METER[k]) return ACT.restMeter(k);
  if (k === 'loy') return ACT.restLoy();
  if (k.startsWith('rc')) return ACT.restRecharge(k.slice(2));
});
act('depotPick', k => {
  const c = S.cur, done = (txt) => { if (k !== 'skip') depotTax(); c.trades = (c.trades || 0) + 1; c.step = 'done'; c.result = txt; log('Base Exchange', txt); };
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
  const c = S.cur, n = npc(sl); if (!n) return false;
  if (c.trade === 'favor') { changeLoy(sl, -2); c.lootEarned = true; c.result = `Called in a favor from ${n.rank} ${n.name}: free loot spin`; }
  else {
    const coast = n.trait === 'coaster' && !n.broken, over = n.trait === 'overach' && !n.broken;
    changeLoy(sl, coast ? 1 : over ? -2 : -1); applyEff({ mis: coast ? 5 : 3, why: 'Volunteered for the tasker' });
    c.result = `Volunteered ${n.rank} ${n.name} for the tasker: +${coast ? 5 : 3} 🎯${coast ? ' (a challenge woke the Coaster up)' : over ? ' (the Over-Achiever is overloaded)' : ''}`;
  }
  depotTax(); c.trades = (c.trades || 0) + 1;
  c.step = 'done'; S.votes = {}; log('Base Exchange', c.result); assignPending();
});
// Budget Squeeze (FSS commander): every trade costs 1 extra 📦 (not the one Pre-Positioned Supplies paid for)
function depotTax() { if (S.cur && S.cur.freeTrade) { S.cur.freeTrade = false; return; } ccApply('depotTax', 'BX purchase'); }
// A BX 📦 cost, unless Pre-Positioned Supplies is armed: then this purchase (and its Budget Squeeze extra) is free
function bxSpend(n, why) {
  if (S.pending.prepo) { S.pending.prepo = false; if (S.cur) S.cur.freeTrade = true; toast('📦', 'PRE-POSITIONED SUPPLIES', `${why}: no 📦 spent`); log('Base Exchange', `${why}: free (Pre-Positioned Supplies)`); return; }
  applyEff({ res: -n, why });
}
// Logistician (LRS commander): a second trade per visit
function depotAgainOk() { const c = S.cur; return c && c.type === 'depot' && c.step === 'done' && ccHook('depot2').length && (c.trades || 0) === 1 && !c.lootEarned && !c.lootRoll && !S.actor; }
act('depotAgain', () => { if (!depotAgainOk()) return false; const h = ccHook('depot2')[0]; S.cur.step = 'choose'; S.cur.trade = null; S.votes = {}; ccReact(h, 'A second purchase at the BX'); });
act('depotTrain', a => {
  const [i, st] = a.split(','), p = S.party[+i];
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
act('showManifest', () => { autoPatch(); S.phase = 'manifest'; S.votes = {}; sfx('start'); confidantStart(); });
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
    `${cadetName(i)} already has ${S.cc}'s ear. The commander's negative perk, "${u.cc.neg.name}" (${u.cc.neg.text}), will not apply this game. It's crossed out.`);
  log('Ability', `${cadetName(i)}: Commander's Confidant (passive) cancelled ${u.cc.neg.name}`);
}
// the team votes on their phones; the GM clicks the winner to lock it in (Change reopens the vote)
act('setPatch', id => { if (!patchFree(S, id)) return false; setPatch(id); S.votes = {}; sfx('level'); log('Team patch', `${(patchOf(S) || {}).icon || ''} ${S.callsign}`); });
act('unsetPatch', () => { S.patch = ''; S.callsign = ''; S.votes = {}; });
act('toMap', () => { if (!S.patch && PATCHES[S.unit]) { // nobody locked one in: the top-voted free patch, else the first free one
    const n = {}; Object.values(S.votes || {}).forEach(k => { if (patchFree(S, String(k))) n[k] = (n[k] || 0) + 1; });
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0], f = top || (PATCHES[S.unit].find(p => patchFree(S, p.id)) || {}).id; if (f) setPatch(f); } if (!S.map) S.map = genMap(); S.mapLocked = true; S.pos = { tier: -1, idx: null }; S.phase = 'map'; S.votes = {}; sfx('start'); });
act('node', a => { const [t, i] = a.split(',').map(Number); chooseNode(t, i); });
act('waypoint', key => takeWaypoint(key));
act('collapse', () => { S.wp = null; log('GM', 'Skipped the remaining stops for time'); if (!S.leveled) { S.leveled = true; } startBoss(); });
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
act('lootd4', () => lootD4());
act('loot', () => spinLoot());
act('nodeDone', () => { if (S.cur && S.cur.type !== 'crisisEvent' && crisisNow('node')) return; afterNode(); });
act('restMeter', k => {
  const less = ccHook('restLess')[0];
  applyEff({ ...Object.fromEntries(METERS.map(m => [m.k, m.k === k ? DIFFICULTY.restMain - (less ? 1 : 0) : DIFFICULTY.restOthers])), why: 'Rest Stop' });
  if (less) ccReact(less, `Rest Stop: ${METER[k].label} +${DIFFICULTY.restMain - 1} instead of +${DIFFICULTY.restMain}`);
  S.cur.step = 'done'; S.cur.result = `Rested: +${DIFFICULTY.restMain} ${METER[k].name}, +${DIFFICULTY.restOthers} everything else`;
});
act('restRecharge', i => { S.party[+i].used = 0; S.cur.step = 'done'; S.cur.result = `${cadetName(+i)}'s ability recharged`; toast('🔋', 'RECHARGED', cadetName(+i)); log('Rest Stop', 'Ability recharged'); });
act('restLoy', () => { const less = ccHook('restLess')[0]; S.npcs.forEach(n => changeLoy(n.slot, 1)); traitCare(); if (less) ccReact(less, 'Rest Stop: no ❤️ this time'); else applyEff({ mor: 1, why: 'Rest Stop' }); S.cur.step = 'done'; S.cur.result = '+1 loyalty for the whole Unit, +1 Morale'; log('Rest Stop', '+1 loyalty all'); });
act('spinMystery', () => {
  const c = S.cur;
  if (!c || c.step !== 'spin') return false;
  doneActor('mystery');
  c.mystery = rnd(MYSTERY.length);
  showDie(6, c.mystery + 1, `UNKNOWN TERRITORY · d6${byWho()}`, `➜ ${MYSTERY[c.mystery].name}`, MYSTERY_TABLE());
  c.step = 'revealed'; log('Unknown node', MYSTERY[c.mystery].name);
});
act('mysteryGo', () => {
  const id = MYSTERY[S.cur.mystery].id;
  if (id === 'crisis' || id === 'elite') return enterNode(id);
  if (id === 'wing') { S.votes = {}; snapBase(); S.cur = { type: 'crisis', wing: true, step: 'brief', choice: null, intel: false }; sfx('start'); return; }
  if (id === 'loot') { S.cur = { type: 'depot', step: 'done', result: 'Free loot!', lootEarned: true }; assignPending(); return; }
  S.phase = 'inject'; S.cur = null; snapBase();
  S.inject = { stage: 'murphy', filter: id === 'bad' ? 'bad' : 'good', fromNode: true };
  setActor('murphy', nextActor());
});
act('spinTrigger', () => spinTrigger());
act('spinMurphy', () => spinMurphy());
act('applyInject', a => applyInject(+a));
act('closeInject', () => closeInject());
act('confirmLevel', () => {
  S.party.forEach(p => {
    const u = upOf(p);
    if (u.now) applyEff({ ...u.now, why: u.name });
    if (p.up === 'council') S.npcs.forEach(n => changeLoy(n.slot, 1));
    if (p.up === 'wingman') { const n = S.npcs.slice().sort((a, b) => a.loy - b.loy)[0]; if (n) changeLoy(n.slot, 2); }
  });
  S.leveled = true; log('Level up', S.party.map(p => `${p.name}: ${upOf(p).name}`).join('; '));
  emit('levelDone'); sfx('level'); advance();
});
act('bossNext', () => { if (bossNext() === false) return false; });
act('bossStar', a => { const [j, n] = a.split(',').map(Number); S.boss.p2.stars[j] = n; });
act('hotSeat', () => bossHotSeat());
act('bossStarsDone', () => bossStarsDone());
act('bossResolve', () => { if (bossResolve() === false) return false; });
act('bossAct', a => {
  const [i, type] = a.split(','), act = { type };
  const cur = S.boss.acts[+i];
  if (cur && JSON.stringify(cur) === JSON.stringify(act)) { delete S.boss.acts[+i]; return; } // click again to clear
  if (!bossActOk(+i, act)) return false;
  S.boss.acts[+i] = act;
});
act('finish', () => finishGame());
act('saveBoard', () => { saveToBoard(); S.showBoard = true; sfx('ach'); });
act('toDebrief', () => { S.party.forEach((p, i) => { if (!S.grades[i]) S.grades[i] = defaultGrade(); }); S.phase = 'debrief'; S.showBoard = false; S.timer = null; S.banner = null; emit('powerdown'); });
act('showGrade', i => { const g = S.grades[+i] = S.grades[+i] || defaultGrade(); g.shown = !g.shown; });
act('dview', v => { S.debrief.view = v; S.debrief.spot = null; });
act('spot', i => { S.debrief.spot = S.debrief.spot === +i ? null : +i; S.debrief.view = 'timeline'; });
act('saveGrades', () => {
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
act('meter', a => { const [k, v] = a.split(','); applyEff({ [k]: +v, why: 'GM adjust' }); });
act('loy', a => { const [s, v] = a.split(','); changeLoy(s, +v); log('GM adjust', `${npcLabel(S, s)} loyalty ${sign(+v)}`); });
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
  const live = e.type === 'input';
  switch (k) {
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
    if (!e.data || e.data.type !== 'hello') return;
    const fresh = e.source && e.source !== playerWin;
    if (e.source) playerWin = e.source;
    if (fresh || e.data.need) push(!fresh);
  });
  if (bc) bc.onmessage = e => { if (e.data && e.data.type === 'hello' && e.data.need) push(true); };
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
