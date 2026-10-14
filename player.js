/* =====================================================================
   PRACTICUM ADVENTURE - player screen (projector)
   Renders whatever state the GM window sends, and plays the one-shot
   effects (wheels, rolls, toasts, sounds) in order through a queue so
   two things never fight for the screen.
   ===================================================================== */
const P = { S: null, board: [], seen: new Set(), got: false };

function initPlayer() {
  document.body.className = 'player';
  const gate = document.createElement('div');
  gate.className = 'gate';
  gate.innerHTML = `<div class="logo">PRACTICUM<br>ADVENTURE</div><div class="ptitle blink" style="font-size:18px">CLICK TO START</div><div class="sub">(enables sound · press F11 for full screen)</div>`;
  gate.onclick = () => { SFX.unlock(); SFX.play('start'); gate.remove(); };
  document.body.appendChild(gate);
  window.addEventListener('message', e => onMsg(e.data));
  if (bc) bc.onmessage = e => onMsg(e.data);
  // Keep saying hello: if the GM window is reloaded it re-learns where the
  // player screen is, and 'need' asks for a full state when we have none yet.
  const hello = () => {
    const msg = { type: 'hello', need: !P.got };
    try { window.opener && window.opener.postMessage(msg, '*'); } catch (e) { }
    try { !P.got && bc && bc.postMessage(msg); } catch (e) { }
    setTimeout(hello, P.got ? 4000 : 1500);
  };
  hello();
  setInterval(tickTimer, 250);
  try { document.fonts.load('20px "Press Start 2P"'); } catch (e) { }
  $('#app').innerHTML = `<div class="titlescr"><div class="sub">Waiting for the GM console...</div></div>`;
}

function onMsg(d) {
  if (!d || d.type !== 'state') return;
  P.got = true;
  P.S = d.S; P.board = d.board || []; P.join = d.join || null;
  S = d.S; // shared helpers (available(), curMission(), unitQ()...) read the global S
  SFX.muted = !!P.S.muted;
  render();
  (d.fx || []).forEach(f => { if (P.seen.has(f.id)) return; P.seen.add(f.id); playFx(f); });
}

/* ---------------- fx queue ---------------- */
const Q = []; let qBusy = false;
function enqueue(fn, dur) { Q.push([fn, dur]); if (!qBusy) nextQ(); }
function nextQ() {
  const it = Q.shift(); if (!it) { qBusy = false; return; }
  qBusy = true; let clean = null;
  try { clean = it[0](); } catch (e) { console.error(e); }
  setTimeout(() => { try { typeof clean === 'function' && clean(); } catch (e) { } nextQ(); }, it[1]);
}
function overlay(html, cls = '') {
  const d = document.createElement('div');
  d.className = 'ovl ' + cls; d.innerHTML = html;
  d.onclick = () => d.remove();
  document.body.appendChild(d);
  return () => d.remove();
}
let toastChain = Promise.resolve();
function showToast(icon, title, text) {
  toastChain = toastChain.then(() => new Promise(res => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<div class="ti">${icon}</div><div><div class="tt">${esc(title)}</div><div class="tn">${esc(text)}</div></div>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
    setTimeout(res, 2600);
  }));
}

function playFx(f) {
  const S = P.S;
  switch (f.k) {
    case 'sfx': return enqueue(() => SFX.play(f.n), 0);
    case 'sfxLater': return enqueue(() => SFX.play(f.n), 0);
    case 'wheel': return enqueue(() => spinOverlay(f), WHEEL_MS + (f.hold ? 2600 : 1500));
    case 'deltas': return enqueue(() => showDeltas(f.d), 0);
    case 'toast': return enqueue(() => showToast(f.icon, f.title, f.text), 0);
    case 'ach': return enqueue(() => { const a = ACH[f.aid]; SFX.play('ach'); return overlay(`<div class="bigcard good achcard"><div class="sectlbl" style="color:var(--gold)">🏅 ACHIEVEMENT UNLOCKED · +10 PTS</div><div style="font-size:90px;margin-top:10px">${a.icon}</div><h2>${esc(a.name)}</h2><div class="bt">${mt(esc(a.text))}</div></div>`); }, 3200);
    case 'dice': return enqueue(() => diceOverlay(f), DICE_MS + 1300);
    case 'lootDrop': return enqueue(() => { const l = LOOT.find(x => x.id === f.lid); if (!l) return; SFX.play('loot');
      return overlay(`<div class="bigcard lootcard" style="border-color:${RARITY[l.rar].color}"><div class="sectlbl" style="color:${RARITY[l.rar].color}">🎁 LOOT DROP · ${l.rar.toUpperCase()}</div>
        <div style="font-size:110px;margin-top:8px">${l.icon}</div><h2 style="color:${RARITY[l.rar].color}">${esc(l.name)}</h2><div class="bt">${mt(esc(l.text))}</div>
        <div class="bt" style="font-size:22px;color:var(--dim)">Added to your team items (${f.count}/3). Ask the GM to use it when it helps!</div></div>`, 'solid'); }, 4200);
    case 'multiDice': return enqueue(() => multiDiceOverlay(f), 4200 + 1800);
    case 'loyDelta': return enqueue(() => showLoy(f), 0);
    case 'forecast': return enqueue(() => showToast('🔮', 'FORESIGHT', `Next inject: ${MURPHY[f.idx].name}`), 0);
    case 'levelDone': return enqueue(() => showToast('⬆️', 'UPGRADES LOCKED IN', 'Back to the map'), 0);
    case 'big': return enqueue(() => overlay(`<div class="bigcard ${f.cls || ''}"><div style="font-size:70px">${f.icon || ''}</div><h2>${esc(f.title)}</h2><div class="bt">${esc(f.text)}</div></div>`), 3600);
    case 'roll': return enqueue(() => rollOverlay(f), 6200);
    case 'stars': return enqueue(() => overlay(`<div class="bigcard good"><h2>${esc(f.who)}</h2><div class="stars">${'⭐'.repeat(f.n)}${'<span style="opacity:.2">⭐</span>'.repeat(3 - f.n)}</div><div class="verdict pass">${['', 'ROUGH', 'SOLID', 'NAILED IT!'][f.n]}</div></div>`), 3000);
    case 'flash': return enqueue(() => { document.body.classList.add('flashred'); return () => document.body.classList.remove('flashred'); }, 1900);
    case 'bossIntro': return enqueue(() => overlay(`<div class="ptitle blink" style="color:var(--bad);font-size:26px">⚠ WARNING ⚠</div><div class="bigcard bad"><canvas id="bossIntroCv" width="32" height="32" style="width:220px;height:220px;image-rendering:pixelated"></canvas><h2>${BOSS.name}</h2><div class="bt">${BOSS.title}</div></div><div class="ptitle" style="font-size:16px">INSPECTION IN PROGRESS</div>`, '') && (drawBoss($('#bossIntroCv')), () => document.querySelectorAll('.ovl').forEach(o => o.remove())), 4200);
    case 'bossHit': return enqueue(() => { const b = $('.bossart'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } }, 500);
    case 'gameOver': return enqueue(() => { SFX.play('over'); return overlay(`<div class="bigcard bad" style="max-width:1100px"><div style="font-size:90px">💀</div><h2 style="font-size:44px">GAME OVER</h2><div class="bt" style="font-family:var(--pixel);font-size:16px;line-height:1.6;color:var(--bad)">${esc(GAME_OVER_TEXT)}</div><div class="bt">The Inspector General found: ${esc(f.reasons.join('; '))}</div></div>`); }, 6500);
    case 'powerdown': return enqueue(() => { const d = document.createElement('div'); d.className = 'powerdown'; document.body.appendChild(d); return () => d.remove(); }, 1500);
    case 'results': return;
    case 'injectResult': return;
  }
}

function spinOverlay(f) {
  const n = f.slices.length;
  const d = document.createElement('div');
  d.className = 'ovl';
  d.className = 'ovl solid';
  d.innerHTML = `<div class="wt">${esc(f.title)}</div><div class="needle2"></div><canvas width="720" height="720"></canvas><div class="wres"></div>`;
  document.body.appendChild(d);
  const cv = d.querySelector('canvas');
  const a = 2 * Math.PI / n, start = Math.random() * 2 * Math.PI;
  const end = wheelTarget(n, f.idx) + 2 * Math.PI * 7;
  const T = WHEEL_MS - 300, t0 = performance.now();
  let lastSeg = -1;
  const ease = t => 1 - Math.pow(1 - t, 4);
  function frame(now) {
    const t = Math.min(1, (now - t0) / T);
    const rot = start + (end - start) * ease(t);
    drawWheel(cv, f.slices, rot);
    const seg = Math.floor((rot + Math.PI / 2) / a);
    if (seg !== lastSeg) { lastSeg = seg; SFX.play('tick'); }
    if (t < 1) requestAnimationFrame(frame);
    else {
      const s = f.slices[f.idx];
      d.querySelector('.wres').innerHTML = `<span style="color:${s.color}">${esc(s.label)}</span>`;
      SFX.play('good');
    }
  }
  drawWheel(cv, f.slices, start);
  requestAnimationFrame(frame);
  return () => d.remove();
}

/* ---------------- dice ---------------- */
const DIE_SHAPE = { 4: 'tri', 6: 'sq', 10: 'kite', 20: 'hex' };
function dieHtml(sides, v, cls = '') { return `<div class="die ${DIE_SHAPE[sides] || 'hex'} ${cls}"><span>${v}</span><small>d${sides}</small></div>`; }
// tumble the number on a die element, land on `final`, then call done()
function tumble(el, sides, final, ms, done) {
  const span = el.querySelector('span'), t0 = performance.now();
  el.classList.add('rolling');
  (function step() {
    const t = performance.now() - t0;
    if (t < ms) { span.textContent = 1 + rnd(sides); SFX.play('tick'); setTimeout(step, 40 + t / 14); }
    else { span.textContent = final; el.classList.remove('rolling'); el.classList.add('landed'); done && done(); }
  })();
}
function diceOverlay(f) {
  const rm = overlay(`<div class="wt">${esc(f.title)}</div>${dieHtml(f.sides, '?')}<div class="wres"></div>`, 'solid');
  const ov = document.querySelectorAll('.ovl'); const d = ov[ov.length - 1];
  tumble(d.querySelector('.die'), f.sides, f.v, DICE_MS - 900, () => {
    d.querySelector('.wres').innerHTML = esc(f.result || ''); SFX.play('good');
  });
  return rm;
}
function multiDiceOverlay(f) {
  const rm = overlay(`<div class="wt">${esc(f.title)}</div><div class="dicerow">${f.rows.map(r => `<div class="dcol"><img src="${r.av != null ? presetAvatar(r.av) : avatar(r.name)}">${dieHtml(20, '?')}<div class="dn2">${esc(r.name)}</div><div class="dtag ${r.hi ? 'hi' : ''}">&nbsp;</div></div>`).join('')}</div>`, 'solid');
  const ov = document.querySelectorAll('.ovl'); const d = ov[ov.length - 1];
  d.querySelectorAll('.dcol').forEach((col, i) => {
    const r = f.rows[i];
    setTimeout(() => tumble(col.querySelector('.die'), 20, r.v, 1300, () => {
      const tg = col.querySelector('.dtag'); tg.textContent = r.tag; col.classList.add(r.hi ? 'win' : 'lose'); SFX.play(r.hi ? 'good' : 'click');
    }), i * 450);
  });
  return rm;
}
function rollOverlay(f) {
  const r = f.r;
  const verdict = r.nat === 20 ? 'CRITICAL HIT!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED';
  const rm = overlay(`<div class="bigcard rollcard"><h2>${esc(f.who)} ROLLS THE d20</h2>
    ${dieHtml(20, '?', 'big')}
    <div class="after" style="visibility:hidden">
    <div class="rollline">${r.parts.length ? r.parts.map(p => `<span class="${p[1] >= 0 ? 'up' : 'dn'}">${sign(p[1])}</span> ${mt(esc(p[0]))}`).join(' &nbsp; ') : 'no modifiers'}</div>
    <div class="rollline">= <b>${r.total}</b> vs target <b>${r.dc}</b></div>
    <div class="verdict ${r.pass ? 'pass' : 'fail'}">${verdict}</div></div></div>`, 'solid');
  const ov = document.querySelectorAll('.ovl'); const d = ov[ov.length - 1];
  tumble(d.querySelector('.die'), 20, r.d20, 1800, () => {
    d.querySelector('.after').style.visibility = 'visible';
    d.querySelector('.bigcard').classList.add(r.pass ? 'good' : 'bad');
    SFX.play(r.nat === 20 ? 'crit' : r.nat === 1 ? 'fumble' : r.pass ? 'good' : 'bad');
  });
  return rm;
}
function showLoy(f) {
  const w = document.createElement('div'); w.className = 'deltas loyd';
  w.innerHTML = `<span class="${f.v > 0 ? 'p' : 'n'}" style="font-size:20px">${esc(f.who)} LOYALTY ${sign(f.v)}</span>`;
  document.body.appendChild(w); setTimeout(() => w.remove(), 2700);
}

function showDeltas(d) {
  const w = document.createElement('div'); w.className = 'deltas';
  w.innerHTML = d.map(([k, v]) => `<span class="${v > 0 ? 'p' : 'n'}">${METER[k].icon} ${METER[k].label.toUpperCase()} ${sign(v)}</span>`).join('');
  document.body.appendChild(w);
  SFX.play(d.some(x => x[1] < 0) && !d.some(x => x[1] > 0) ? 'bad' : 'click');
  setTimeout(() => w.remove(), 2700);
}

function tickTimer() {
  const S = P.S; let el = $('#timer');
  if (!S || !S.timer) { if (el) el.remove(); return; }
  const left = Math.max(0, Math.ceil((S.timer.end - Date.now()) / 1000));
  if (!el) { el = document.createElement('div'); el.id = 'timer'; el.className = 'timer'; document.body.appendChild(el); }
  el.className = 'timer' + (left <= 5 ? ' low' : '');
  el.innerHTML = `<small>${esc(S.timer.label || 'TIME')}</small>${left > 0 ? String(left).padStart(2, '0') : "TIME!"}`;
  if (left > 0 && left <= 5 && el.dataset.last != left) { el.dataset.last = left; SFX.play('tick'); }
  if (left === 0 && el.dataset.last !== '0') { el.dataset.last = '0'; SFX.play('alarm'); }
}

/* ---------------- boss pixel art ---------------- */
function drawBoss(cv) {
  if (!cv) return;
  const x = cv.getContext('2d'), R = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
  x.clearRect(0, 0, 32, 32);
  R('#1b1b4a', 0, 0, 32, 32);
  R('#2a3b6e', 7, 18, 18, 14);           // uniform
  R('#1a2550', 15, 18, 2, 14);
  R('#f1c27d', 10, 5, 12, 12);           // face
  R('#444', 9, 3, 14, 3); R('#444', 9, 5, 2, 4); R('#444', 21, 5, 2, 4); // hair
  R('#000', 12, 9, 3, 1); R('#000', 18, 9, 3, 1); // angry brows
  R('#ff2e63', 13, 10, 2, 2); R('#ff2e63', 18, 10, 2, 2); // eyes
  R('#000', 14, 14, 5, 1);               // frown
  R('#c0c0c0', 23, 13, 9, 12); R('#8b5a2b', 26, 12, 3, 2); // clipboard
  for (let i = 0; i < 4; i++) R('#333', 24, 16 + i * 2, 7, 1);
  R('#ff2e63', 25, 23, 2, 1);
  R('#f1c27d', 21, 20, 3, 3);            // hand
  R('#ffd23f', 9, 20, 3, 2);             // badge
}

/* ---------------- render ---------------- */
function render() {
  const S = P.S; if (!S) return;
  document.body.className = 'player' + (S.phase === 'debrief' ? ' reality' : '');
  const full = ['title', 'intro', 'party', 'perks', 'avatars', 'boss', 'results', 'debrief', 'levelup', 'unit', 'manifest'].includes(S.phase);
  const hud = !['title', 'intro', 'debrief', 'party', 'perks', 'avatars', 'unit'].includes(S.phase);
  $('#app').innerHTML = `<div class="pl">${hud ? renderHud(S) : '<div></div>'}
    <div class="stage ${full ? 'full' : ''}"><div class="main">${renderMain(S)}</div>${full ? '' : `<div class="side">${renderSide(S)}</div>`}</div></div>
    ${S.showBoard ? renderBoardOverlay() : ''}${renderJoinBox(S)}${renderActorBanner(S)}`;
  const bc2 = $('#bossCv'); if (bc2) drawBoss(bc2);
  const boardOv = $('#boardOv'); if (boardOv) boardOv.onclick = null;
}

/* join-by-phone box (QR + code) while the party is forming */
const _qr = {};
function qrSrc(text) {
  if (_qr[text]) return _qr[text];
  if (!window.qrcode) return '';
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return (_qr[text] = q.createDataURL(6, 2)); } catch (e) { return ''; }
}
function renderJoinBox(S) {
  const j = P.join;
  if (!j || !j.url || !j.live || !(S.phase === 'title' || (S.phase === 'intro' && S.introPage === 0))) return '';
  const src = qrSrc(j.url);
  return `<div class="joinbox">${src ? `<img src="${src}">` : ''}<div><div class="sectlbl">📱 JOIN ON YOUR PHONE</div>
    <div class="jurl">${esc(j.url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</div><div class="jcode">ROOM ${esc(j.code)}</div></div></div>`;
}
function voteDots(S, i) {
  const v = S.votes || {};
  const who = Object.keys(v).filter(s => String(v[s]) === String(i)).map(s => S.party[+s]).filter(Boolean);
  return who.length ? `<div class="votes">${who.map(p => `<img src="${avatarOf(p)}" title="${esc(rankName(p))}">`).join('')}</div>` : '';
}
// "CAPT HELLE: ROLL THE INJECT CHECK!" — whose turn it is to press the button
function renderActorBanner(S) {
  if (!S.actor || spinning() || S.phase === 'debrief') return '';
  const p = S.party[S.actor.slot];
  return `<div class="actorbar">${p ? `<img src="${avatarOf(p)}">` : ''}<div><div class="ab1">🎲 YOUR TURN, ${esc(rankName(p).toUpperCase())}</div><div class="ab2">${esc(S.actor.label)}: tap the button on your phone!</div></div></div>`;
}
// Power-ups worth using right now (tokens, items, abilities, perks)
function renderPowerups(S) {
  const list = usableNow(S); if (!list.length) return '';
  return `<div class="powerups"><span class="pu-h">⚡ USABLE NOW</span>${list.map(u => `<span class="pu ${u.hot ? 'hot' : ''}">${u.icon} <b>${esc(u.label)}</b>${u.who != null ? ` <i>(${esc(rankName(S.party[u.who]))})</i>` : ''} · ${mt(esc(u.hint))}</span>`).join('')}</div>`;
}

function renderHud(S) {
  const u = S.unit ? UNITS.find(x => x.id === S.unit) : null;
  const items = (S.items || []).map(id => LOOT.find(l => l.id === id)).map(l => `<span title="${esc(l.name)}">${l.icon}</span>`).join('');
  return `<div class="hud">
    <div class="unit">${u ? `${u.icon} ${u.name}<small>${u.sq}</small>` : 'PRACTICUM ADVENTURE'}</div>
    <div class="meters">${METERS.map(m => { const v = S.meters[m.k]; return `<div class="meter ${v <= 2 ? 'low' : ''}" style="--c:${m.color}"><div class="lbl"><span>${m.icon} ${m.name}</span><span>${v}</span></div><div class="bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</div></div>`; }).join('')}</div>
    <div class="right">
      ${[['pause', '⏸️', 'PAUSE'], ['intel', '🔎', 'INTEL'], ['waiver', '📝', 'WAIVER']].map(([k, i, l]) => `<div class="tok ${S.lt[k] ? '' : 'used'}"><b>${i}</b>${l}</div>`).join('')}
      <div class="inv">${items || '<span style="opacity:.3">·</span>'}</div>
    </div></div>`;
}

function renderSide(S) {
  return `<div class="sectlbl">YOUR FLIGHT</div>
    <div class="pgrid">${S.party.map((p, i) => `<div class="pcard ${S.offline === i ? 'offline' : ''}"><img src="${avatarOf(p)}"><div><div class="nm">${esc(rankName(p))}</div><div class="cl">${CLASS[p.cls] ? CLASS[p.cls].icon + ' ' + CLASS[p.cls].name : ''}${S.offline === i ? ' · 📵 MEETING' : ''}</div></div>${S.tokenHolder === i ? '<div class="crown">👑</div>' : ''}</div>`).join('')}</div>
    ${(S.items || []).length ? `<div class="sectlbl" style="margin-top:6px">🎒 TEAM ITEMS (${S.items.length}/3)</div>${S.items.map(id => { const l = LOOT.find(x => x.id === id); return `<div class="sitem"><span>${l.icon}</span><div><b>${esc(l.name)}</b><div>${mt(esc(l.text))}</div></div></div>`; }).join('')}` : ''}
    <div class="sectlbl" style="margin-top:6px">YOUR CREW</div>
    ${S.npcs.map(n => { const t = TRAIT[n.trait]; return `<div class="npc ${isAlly(n) ? 'ally' : ''} ${n.broken ? 'broken' : ''} ${n.out ? 'out' : ''}"><img src="${avatar(n.name + n.rank)}"><div>
      <div class="nm">${esc(n.rank)} ${esc(n.name)}${isAlly(n) ? ' 🤝' : ''}${n.out ? ' (OUT)' : ''}</div>
      <div class="tr ${n.revealed ? 'rev' : ''}">${n.revealed ? `${t.icon} ${t.name}` : esc(n.pub)}</div>
      <div class="loy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div></div></div>`; }).join('')}
    ${S.forecast ? `<div class="banner blue">🔮 FORECAST: ${esc(MURPHY[S.forecast.idx].name)}${S.forecast.blocked ? ' (BLOCKED)' : ''}</div>` : ''}`;
}

function renderMain(S) {
  if (S.inject && S.inject.forced) return renderInject(S);
  switch (S.phase) {
    case 'title': return renderTitle();
    case 'intro': return renderIntro(S);
    case 'party': return renderParty(S);
    case 'perks': return renderPerks(S);
    case 'avatars': return renderAvatars(S);
    case 'unit': { const u = S.unitRolled && UNITS.find(x => x.id === S.unit);
      if (u) return `<div class="titlescr"><div style="font-size:140px">${u.icon}</div><div class="ptitle" style="color:${u.color};font-size:46px">${u.name}</div><div class="unitsq">${u.sq.toUpperCase()}</div></div>`;
      return `<div style="display:flex;flex-direction:column;gap:12px;height:100%;padding-bottom:90px"><div class="ptitle" style="text-align:center">ROLL FOR YOUR SQUADRON · d6</div>
        <div class="unitgrid">${UNITS.map((x, i) => `<div class="unitcard" style="--c:${x.color}"><div class="un">${i + 1}</div><div class="ui">${x.icon}</div><div class="unm">${x.name}</div><div class="usq">${x.sq}</div></div>`).join('')}</div></div>`; }
    case 'manifest': return renderManifest(S);
    case 'map': return renderMap(S);
    case 'node': return renderNode(S);
    case 'inject': return renderInject(S);
    case 'levelup': return renderLevel(S);
    case 'boss': return renderBoss(S);
    case 'results': return renderResults(S);
    case 'debrief': return renderDebrief(S);
  }
  return '';
}

function renderTitle() {
  const top = P.board.filter(b => !b.gameOver).slice(0, 5);
  return `<div class="titlescr"><div class="logo">PRACTICUM<br>ADVENTURE<small>A LEADERSHIP RPG · AS300</small></div>
    <div class="ptitle blink" style="font-size:20px">INSERT CADETS TO CONTINUE</div>
    ${top.length ? `<div class="box" style="min-width:640px"><div class="sectlbl">HIGH SCORES</div><table class="lb">${top.map((b, i) => `<tr class="${i < 3 ? 'top' : ''}"><td class="rk">${i + 1}</td><td>${esc(b.callsign)}</td><td>${esc(b.grade)}</td><td>${b.score}</td></tr>`).join('')}</table></div>` : ''}</div>`;
}

function renderIntro(S) {
  if (S.introPage === 0) return `<div class="intro">
    <div class="ptitle" style="text-align:center">HOW TO PLAY</div>
    <div class="steps">${INTRO_STEPS.map(([ic, h, t], i) => `<div class="step"><div class="sn">${i + 1}</div><div class="si">${ic}</div><div><b>${esc(h)}</b><div>${esc(t)}</div></div></div>`).join('')}</div>
    <div class="banner gold" style="font-size:12px;line-height:1.7">${esc(INTRO_WIN)}</div>
    <div class="banner" style="font-size:12px">${esc(INTRO_LOSE)}</div></div>`;
  return `<div class="intro"><div class="ptitle" style="text-align:center">READING THE SCREEN</div>
    <div class="legend">${LEGEND.map(([ic, h, t]) => `<div class="lg"><div class="li">${ic}</div><div><b>${esc(h)}</b><div>${esc(t)}</div></div></div>`).join('')}</div></div>`;
}

function renderParty(S) {
  return `<div style="display:flex;flex-direction:column;gap:10px;height:100%"><div class="ptitle" style="text-align:center;font-size:24px">SELECT YOUR CLASS</div>
    <div class="sub" style="text-align:center;font-size:21px">👑 Flight Commander required · no duplicates · 🎁 every class hides 2 secret perks, revealed once classes lock${P.join && P.join.live ? ` · 📱 pick on your phone (ROOM <b style="color:var(--gold)">${esc(P.join.code)}</b>)` : ''}</div>
    <div class="statlegend">${STATS.map(s => `<span><b>${s}</b> ${STAT_INFO[s].name}: ${STAT_INFO[s].text}</span>`).join('')}</div>
    <div class="classgrid">${CLASSES.map(c => {
      const who = S.party.find(p => p.cls === c.id && p.name);
      return `<div class="ccard ${who ? 'taken' : ''}"><div class="chead"><span class="ic">${c.icon}</span><h3>${c.name}</h3>${who ? `<div class="who">${esc(rankName(who))}</div>` : ''}</div>
        <div class="sub cline"><span style="color:var(--gold)">${c.rankLong}</span> · Specialty: ${mt(c.guards)}</div>
        <div class="stats">${STATS.map(s => `<div>${s}<b>+${c.stats[s]}</b></div>`).join('')}</div>
        <div class="ab"><b style="color:var(--accent)">${c.ability ? '⚡ ' + esc(c.ability.name) : '👑 COMMAND'}:</b> ${mt(esc(c.ability ? c.ability.text : c.abilityText))}</div>
        <div class="perk off">🎁 PERKS: ??? · ??? <small>(revealed after classes lock)</small></div></div>`;
    }).join('')}</div></div>`;
}

// Perk reveal: one card per cadet showing ONLY their class's two perks.
function renderPerks(S) {
  return `<div style="display:flex;flex-direction:column;gap:12px;height:100%"><div class="ptitle" style="text-align:center;font-size:24px">🎁 PERKS REVEALED: PICK ONE</div>
    <div class="sub" style="text-align:center;font-size:22px">Each cadet chooses one perk for their class (on your phone or tell the GM)</div>
    <div class="perkgrid" style="grid-template-columns:repeat(${S.party.length},1fr)">${S.party.map(p => { const c = CLASS[p.cls]; return `<div class="ccard ${p.perk ? 'taken' : ''}">
      <div class="chead"><img src="${avatarOf(p)}" style="width:40px;height:40px;image-rendering:pixelated"><div><h3>${esc(rankName(p))}</h3><div class="sub" style="font-size:19px">${c.icon} ${c.name}</div></div></div>
      ${c.perks.map((k, j) => `<div class="perk big ${p.perk === k.id ? 'sel' : p.perk ? 'off' : ''}"><b>${p.perk === k.id ? '▶ ' : ''}PERK ${'AB'[j]} · ${esc(k.name)}</b><div>${mt(esc(k.text))}</div></div>`).join('')}
      <div class="sub" style="text-align:center;font-size:20px">${p.perk ? '✅ LOCKED IN' : '⏳ choosing...'}</div></div>`; }).join('')}</div></div>`;
}

function renderAvatars(S) {
  return `<div style="display:flex;flex-direction:column;gap:14px;height:100%"><div class="ptitle" style="text-align:center">PICK YOUR PILOT</div>
    <div class="sub" style="text-align:center">Call out a number to the GM</div>
    <div class="avgrid">${AVATARS.map((_, k) => { const who = S.party.find(p => p.av === k); return `<div class="avc ${who ? 'taken' : ''}"><div class="avn">${k + 1}</div><img src="${presetAvatar(k)}"><div class="avw">${who ? esc(rankName(who)) : '&nbsp;'}</div></div>`; }).join('')}</div></div>`;
}

function renderManifest(S) {
  const u = UNITS.find(x => x.id === S.unit);
  const card = (name, rank, sub, extra = '') => `<div class="orgcard" ${extra}><img src="${avatar(name)}"><div class="nm">${esc(rank)}<br>${esc(name.replace(/ ?(SSgt|A1C|TSgt|Civ\.)$/, ''))}</div><div class="rk">${sub}</div></div>`;
  return `<div style="display:flex;flex-direction:column;gap:14px;overflow:hidden">
    <div style="display:flex;align-items:center;gap:20px"><div style="font-size:64px">${u.icon}</div><div><h2 style="color:${u.color};font-size:26px">${u.name}</h2><div class="unitsq" style="text-align:left;font-size:20px">${u.sq.toUpperCase()} · CREW MANIFEST</div></div></div>
    <div class="org">
      <div class="orgrow"><div class="orgcard" style="border-color:var(--bad);max-width:560px"><img src="${avatar(S.cc)}"><div class="nm">SQUADRON COMMANDER<br>${esc(S.cc)}</div><div class="rk" style="color:var(--gold)">QUIRK: ${mt(esc(u.quirk))}</div></div></div>
      <div class="orgline"></div>
      <div class="orgrow">${S.party.map(p => `<div class="orgcard" style="border-color:var(--gold)"><img src="${avatarOf(p)}"><div class="nm">${esc(rankName(p))}</div><div class="rk">${CLASS[p.cls].icon} ${CLASS[p.cls].name}</div></div>`).join('')}</div>
      <div class="orgline"></div>
      <div class="orgrow">${S.npcs.map(n => `<div class="orgcard"><img src="${avatar(n.name + n.rank)}"><div class="nm">${esc(n.rank)} ${esc(n.name)}</div><div class="rk">${esc(n.pub)}</div><div class="rk" style="color:var(--warn)">HIDDEN TRAIT: ???</div></div>`).join('')}</div>
    </div></div>`;
}

// Two lanes: at every stop the party picks the top or bottom option (votes show as avatars).
function renderMap(S) {
  const n = S.map.tiers.length, W = 1000, H = 520, startX = 48, bossX = 946;
  const step = (bossX - startX) / (n + 1), laneY = [H / 2 - 120, H / 2 + 120];
  const pt = (k, i) => k === -1 ? [startX, H / 2] : k === n ? [bossX, H / 2] : [startX + step * (k + 1), laneY[i]];
  const av = available(), recon = S.party.some(p => p.perk === 'recon');
  const isOpen = (t, i) => av.some(([a, b]) => a === t && b === i);
  const visited = (t, i) => S.map.tiers[t][i].visited;
  let lines = '', nodes = '';
  const line = (a, b, lit, live) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${lit ? '#ffd23f' : live ? '#7d7dd8' : '#2a2a6a'}" stroke-width="${lit ? 7 : 5}" stroke-dasharray="${lit ? '' : '12 10'}"/>`;
  [0, 1].forEach(i => { lines += line(pt(-1), pt(0, i), visited(0, i), S.pos.tier === -1); });
  for (let k = 0; k < n - 1; k++) [0, 1].forEach(i => [0, 1].forEach(j => {
    lines += line(pt(k, i), pt(k + 1, j), visited(k, i) && visited(k + 1, j), S.pos.tier === k && S.pos.idx === i);
  }));
  [0, 1].forEach(i => { lines += line(pt(n - 1, i), pt(n), visited(n - 1, i), false); });
  if (typeof LEVEL_AFTER !== 'undefined' && LEVEL_AFTER < n) {
    const x = (pt(LEVEL_AFTER - 1, 0)[0] + pt(LEVEL_AFTER, 0)[0]) / 2;
    nodes += `<text x="${x}" y="${H / 2 + 12}" font-size="30" text-anchor="middle">⬆️</text>`;
  }
  S.map.tiers.forEach((tier, k) => tier.forEach((nd, i) => {
    const [x, y] = pt(k, i), nt = NODE_TYPES[nd.type];
    const open = isOpen(k, i), here = S.pos.tier === k && S.pos.idx === i;
    // short labels so neighbouring stops never collide
    const label = nd.type === 'unknown' && recon ? MYSTERY[nd.mystery].name : { crisis: 'CRISIS', elite: 'ELITE', rest: 'REST', depot: 'DEPOT', unknown: '???' }[nd.type];
    const top = i === 0;
    const vs = votersFor(`${k},${i}`).map(s => S.party[s]).filter(Boolean);
    nodes += `<g opacity="${!open && !nd.visited && av.length ? 0.4 : 1}">
      <rect x="${x - 40}" y="${y - 40}" width="80" height="80" fill="${nd.visited ? '#2a2a10' : '#1b1b4a'}" stroke="${here ? '#fff' : open ? nt.color : nd.visited ? '#ffd23f' : '#3a3a8a'}" stroke-width="${open || here ? 7 : 5}">
      ${open ? '<animate attributeName="stroke-opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/>' : ''}</rect>
      <text x="${x}" y="${y + 15}" font-size="42" text-anchor="middle">${nt.icon}</text>
      ${i === 0 ? `<text x="${x}" y="${y - 66}" font-size="11" fill="#8f8fc8" text-anchor="middle" font-family="'Press Start 2P'">STOP ${k + 1}</text>` : ''}
      <text x="${x}" y="${top ? y - 50 : y + 62}" font-size="10" fill="${nt.color}" text-anchor="middle" font-family="'Press Start 2P'">${esc(label)}</text>
      ${vs.map((p, j) => `<image href="${avatarOf(p)}" x="${x - 40 + j * 21}" y="${top ? y + 44 : y - 64}" width="20" height="20" style="image-rendering:pixelated"/>`).join('')}
      ${nd.done ? `<text x="${x + 32}" y="${y - 26}" font-size="26" text-anchor="middle">✅</text>` : ''}</g>`;
  }));
  return `<div style="display:flex;flex-direction:column;height:100%;gap:10px"><div class="ptitle" style="font-size:20px">YOUR ROUTE · VOTE ON YOUR PHONE 📱</div>
    <div class="mapwrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${lines}
      <g><rect x="${startX - 34}" y="${H / 2 - 34}" width="68" height="68" fill="#14143a" stroke="#7dff6b" stroke-width="5"/><text x="${startX}" y="${H / 2 + 13}" font-size="36" text-anchor="middle">🛫</text><text x="${startX}" y="${H / 2 + 58}" font-size="10" fill="#7dff6b" text-anchor="middle" font-family="'Press Start 2P'">START</text></g>
      ${nodes}
      <g><rect x="${bossX - 48}" y="${H / 2 - 48}" width="96" height="96" fill="#3a0010" stroke="#ff2e63" stroke-width="7"/><text x="${bossX}" y="${H / 2 + 18}" font-size="52" text-anchor="middle">👹</text><text x="${bossX}" y="${H / 2 + 72}" font-size="10" fill="#ff2e63" text-anchor="middle" font-family="'Press Start 2P'">THE IG</text></g>
    </svg></div>
    <div class="sub">⚔️ Crisis · 💀 Elite (harder, double rewards, loot) · 🏕️ Rest · 🛒 Supply Depot · ❓ Unknown · ⬆️ Level up</div>
    ${renderPowerups(S)}</div>`;
}

// Rest stop / supply depot: the options, with each cadet's vote shown as their avatar
function renderStop(S, c) {
  const rest = c.type === 'rest';
  const head = `<div style="text-align:center"><span style="font-size:90px">${rest ? '🏕️' : '🛒'}</span><div class="ptitle">${rest ? 'REST STOP' : 'SUPPLY DEPOT'}</div>
    <div class="sub">${c.step === 'choose' ? `${rest ? 'Pick ONE' : 'One trade'}: vote on your phone!` : ''}</div></div>`;
  if (c.step !== 'choose') return `<div class="titlescr">${head}<div class="ptitle" style="color:var(--good);font-size:24px">${esc(c.result || '')}</div>${renderPowerups(S)}</div>`;
  const opts = rest ? restOptions() : depotOptions();
  return `<div style="display:flex;flex-direction:column;gap:14px;height:100%;justify-content:center">${head}
    <div class="optgrid">${opts.map(o => `<div class="choice ${o.dis ? 'dim' : ''}" style="grid-template-columns:1fr;position:relative"><div class="ct">${mt(esc(o.label))}</div>${voteDots(S, o.key)}</div>`).join('')}</div>${renderPowerups(S)}</div>`;
}

function renderNode(S) {
  const c = S.cur; if (!c) return '';
  if (c.type === 'rest' || c.type === 'depot') return renderStop(S, c);
  if (c.type === 'unknown') return `<div class="titlescr"><div style="font-size:140px">❓</div><div class="ptitle">UNKNOWN TERRITORY</div>${c.step === 'revealed' ? `<div class="ptitle" style="color:var(--accent)">${MYSTERY[c.mystery].name}</div>` : '<div class="sub">Anything can happen...</div>'}</div>`;
  const m = curMission();
  const ce = c.type === 'crisisEvent';
  const hint = c.step === 'roll' ? (() => { const ch = c.spec.check; let dc = ch.dc; if (ch.m === 'mis' && ['hardmis', 'people'].includes(unitQ())) dc = Math.max(dc, 16); if (c.type === 'elite') dc += 3; dc += S.dcMod || 0; return `<div class="banner gold">🎲 ROLL FOR IT! ${ch.stat === 'LOYB' ? `${npcLabel(S, 'B')}'s loyalty` : ch.stat || 'Pure luck'} · TARGET ${dc}${ch.stat && ch.stat !== 'LOYB' ? ' · Choose who rolls!' : ''}</div>`; })()
    : c.step === 'stars' ? `<div class="banner gold">🎤 DIALOGUE ENCOUNTER: ACT IT OUT! The GM plays the NPC.</div>` : '';
  let result = '';
  if (c.step === 'done') {
    if (c.rollRes) { const r = c.rollRes; result = `<div class="banner ${r.pass ? 'gold' : ''}">🎲 ${r.d20} → ${r.total} vs ${r.dc}: ${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED'}</div>`; }
    else if (c.stars) result = `<div class="banner gold">🎤 ${'⭐'.repeat(c.stars)}</div>`;
    else result = `<div class="banner blue">DECISION LOCKED IN</div>`;
  }
  return `<div class="mcard">
    <div class="mhead"><div class="ic">${m.icon}</div><div><h2 style="${ce ? 'color:var(--bad)' : ''}">${ce ? '🚨 CRISIS EVENT: ' : c.type === 'elite' ? '💀 ELITE: ' : ''}${esc(m.title)}</h2><div class="sob">${esc(m.sob)}</div></div></div>
    ${c.type === 'elite' ? '<div class="banner">💀 ELITE CRISIS: every check +3 harder · positive effects doubled · guaranteed loot</div>' : ''}
    ${S.banner ? `<div class="banner ${S.banner.cls || ''}">${esc(S.banner.text)}</div>` : ''}
    <div class="situ">${esc(fill(S, m.text))}</div>
    ${hint}${renderPowerups(S)}
    <div class="choices" ${c.choice != null ? 'style="grid-template-columns:1fr"' : ''}>${m.choices.map((ch, i) => c.choice != null && c.choice !== i ? '' : `<div class="choice ${c.choice === i ? 'picked' : ''}">
      <div class="key">${'ABCD'[i]}</div><div><div class="ct">${esc(fill(S, ch.t))}</div>
      ${ch.show ? `<div class="arrows">${arrows(ch.show)}</div>` : ''}
      ${c.intel ? `<div class="intel">🔎 ${effHtml(specText(S, ch))}</div>` : ''}</div>
      <div class="tags">${ch.lock ? '🔒' : ''}${ch.mic ? '🎤' : ''}</div>${voteDots(S, i)}</div>`).join('')}</div>
    <div class="sub" style="font-size:22px">🔒 = Command Token holder decides · 🎤 = act it out · <span class="up">▲</span> raises · <span class="dn">▼</span> lowers · doubled = bigger swing · ❔ = depends</div>
    ${result}</div>`;
}

function renderInject(S) {
  const inj = S.inject; if (!inj) return '';
  const who = S.actor && S.party[S.actor.slot] ? rankName(S.party[S.actor.slot]) : null;
  const pu = renderPowerups(S);
  if (inj.stage === 'trigger') return `<div class="titlescr"><div style="font-size:120px">📡</div><div class="ptitle">INJECT CHECK...</div>
    <div class="whoroll">${who ? `🎲 ${esc(who.toUpperCase())}, ROLL THE d10 ON YOUR PHONE!` : 'Rolling the d10...'}</div><div class="sub">1-${Math.round(INJECT_CHANCE * 10)} = Murphy strikes · 7-10 = all clear</div>${pu}</div>`;
  if (inj.stage === 'clear') return `<div class="titlescr"><div style="font-size:120px">✅</div><div class="ptitle" style="color:var(--good)">ALL CLEAR</div><div class="sub">Murphy is sleeping. For now.</div></div>`;
  if (inj.stage === 'murphy') return `<div class="titlescr"><div style="font-size:120px">🌪️</div><div class="ptitle" style="color:var(--bad)">INJECT INCOMING!</div>
    <div class="whoroll">${who ? `🎡 ${esc(who.toUpperCase())}, SPIN MURPHY'S WHEEL ON YOUR PHONE!` : "Spinning Murphy's wheel..."}</div>${pu}</div>`;
  const m = MURPHY[inj.idx];
  const cls = m.type === 'good' ? 'good' : m.type === 'bad' ? 'bad' : '';
  return `<div class="titlescr"><div class="bigcard ${cls}"><div class="sectlbl">${m.type === 'good' ? 'GOOD NEWS' : m.type === 'bad' ? "MURPHY'S LAW" : 'CURVEBALL'}</div><h2 style="margin-top:10px">${esc(m.name)}</h2>
    <div class="bt">${esc(m.text || '')}</div><div class="bt injeff">${m.options ? m.options.map(o => `${esc(o.t)}: ${effHtml(effText(S, o.eff))}`).join('<br>') : effHtml(effText(S, m.eff))}</div>
    ${inj.note ? `<div class="bt" style="color:var(--gold)">${esc(inj.note)}</div>` : ''}</div>${pu}</div>`;
}

function renderLevel(S) {
  return `<div class="titlescr"><div class="logo" style="font-size:60px">LEVEL UP!</div>
    <div style="display:grid;grid-template-columns:repeat(${S.party.length},1fr);gap:16px;width:100%">${S.party.map(p => `<div class="ccard ${p.up ? 'taken' : ''}" style="align-items:center;text-align:center">
      <img src="${avatarOf(p)}" style="width:80px;height:80px;image-rendering:pixelated"><h3>${esc(rankName(p))}</h3><div class="sub">${CLASS[p.cls].icon} ${CLASS[p.cls].name}</div>
      ${CLASS[p.cls].ups.map(u => `<div class="ab" style="${p.up === u.id ? 'color:var(--gold)' : p.up ? 'opacity:.3' : ''}">${p.up === u.id ? '▶ ' : ''}<b>${esc(u.name)}</b>: ${mt(esc(u.text))}</div>`).join('')}</div>`).join('')}</div></div>`;
}

function renderBoss(S) {
  const Bs = S.boss; if (!Bs) return '';
  const ph = ['THE AUDIT', 'THE INTERVIEW', 'NO-NOTICE EXERCISE'];
  let center = '';
  if (Bs.phase === 2 && !Bs.p2.who) center = `<div class="box" style="margin-bottom:12px;font-size:30px">🎲 Everyone rolls a d20. The two LOWEST rolls face the Inspector's questions...</div>`;
  else if (Bs.phase === 2) center = `<div class="box" style="margin-bottom:12px">${Bs.p2.who.map((w, j) => `<div style="margin:6px 0"><b style="color:var(--gold)">${esc(rankName(S.party[w]))}:</b> "${esc(BOSS_QUESTIONS[Bs.p2.q[j]])}" ${Bs.p2.stars[j] ? '⭐'.repeat(Bs.p2.stars[j]) : ''}</div>`).join('')}</div>`;
  if (Bs.phase === 3) center = `<div class="box" style="margin-bottom:12px">EVERYONE ROLLS! Pick a different stat each, then tap ROLL on your phone. Target ${Bs.witnessHandled ? 10 : 13}. +1 per meter at 8+. Pass = 2 dmg · Nat 20 = 4 dmg.
    <div style="margin-top:8px">${S.party.map((p, i) => { const r = Bs.p3.rows[i]; return `<div>${esc(rankName(p))}: ${r.ally ? '🤝 ally pass' : r.stat ? `<b>${r.stat}</b> ${r.d20 ? `🎲 ${r.d20}` : '⏳ ready to roll'}` : '⏳ picking a stat'}</div>`; }).join('')}</div></div>`;
  return `<div class="boss">
    <div class="bossart"><canvas id="bossCv" width="32" height="32"></canvas><div class="ptitle" style="font-size:16px;color:var(--bad);text-shadow:none">${BOSS.name}</div><div class="sub">${BOSS.title}</div>
      <div class="hpbar"><i style="width:${Math.max(0, Bs.hp / Bs.max * 100)}%"></i></div><div class="hptxt">HP ${Bs.hp} / ${Bs.max}</div></div>
    <div><div class="phases">${ph.map((n, i) => `<span class="${Bs.phase === i + 1 ? 'on' : Bs.phase > i + 1 ? 'done' : ''}">${i + 1}. ${n}</span>`).join('')}</div>
      ${Bs.phase === 0 ? `<div class="box" style="font-size:30px">The Inspector General has arrived for your unit's inspection.<br><br>Every phase, the IG attacks your <b style="color:var(--bad)">weakest meter</b>. Balanced units survive.</div>` : ''}
      ${center}
      ${Bs.result ? `<div class="banner gold" style="font-size:20px">${esc(Bs.result)}</div>` : ''}
      <div class="blog">${Bs.log.slice(-9).map(l => `<div>${esc(l)}</div>`).join('')}</div></div></div>`;
}

function renderResults(S) {
  const f = S.final; if (!f) return '';
  const g = f.grade;
  return `<div class="resgrid">
    <div style="text-align:center"><div class="grade" style="color:${g.color}">${g.g}</div><div class="ptitle" style="font-size:20px;color:${g.color}">${esc(g.title)}</div></div>
    <div><div class="box" style="font-size:28px;font-style:italic">OPR STRAT: ${esc(g.strat)}</div>
      ${S.gameOver ? `<div class="banner" style="margin-top:12px">${esc(S.gameOverReasons.join('; '))}</div>` : ''}
      <div class="brk" style="margin-top:16px">${f.parts.map(p => `<span>${esc(p[0])}</span><b>${p[1]}</b>`).join('')}<span style="color:var(--gold)">TOTAL SCORE</span><b style="color:var(--gold);font-size:22px">${f.total}</b></div>
      <div class="achs">${S.ach.map(id => `<span>${ACH[id].icon} ${esc(ACH[id].name)}</span>`).join('') || '<span style="opacity:.5">No achievements</span>'}</div>
      ${S.callsign ? `<div class="ptitle" style="font-size:18px;margin-top:14px">TEAM: ${esc(S.callsign.toUpperCase())}</div>` : ''}</div></div>`;
}

function renderBoardOverlay() {
  let rank = 0;
  const rows = P.board.slice(0, 12).map(b => { const ko = b.gameOver; const r = ko ? '💀' : ++rank; return `<tr class="${ko ? 'ko' : rank <= 3 ? 'top' : ''}"><td class="rk">${r}</td><td>${esc(b.callsign)}</td><td>${esc(b.unit)}</td><td>${esc(b.grade)}</td><td>${b.score}</td><td>${b.ach}🏅</td><td>${!ko && rank <= 3 ? '⭐ EXTRA CREDIT' : ''}</td></tr>`; }).join('');
  return `<div class="ovl" id="boardOv" style="z-index:40"><div class="box" style="width:min(1200px,92vw)"><div class="ptitle" style="text-align:center;margin-bottom:14px">🏆 HIGH SCORES 🏆</div>
    <table class="lb"><tr><th>#</th><th>TEAM</th><th>UNIT</th><th>GRADE</th><th>SCORE</th><th>ACH</th><th></th></tr>${rows || '<tr><td colspan="7">No runs yet. Be the first!</td></tr>'}</table></div></div>`;
}

function renderDebrief(S) {
  const dv = S.debrief;
  if (dv.view === 'timeline') {
    return `<div class="real"><h2>Your run, replayed</h2><div class="sub">Every choice, roll, and inject from today. Real units don't get a replay.</div>
      <div class="tl">${S.log.map((l, i) => `<div class="ev ${dv.spot === i ? 'spot' : dv.spot != null ? 'dimmed' : ''}"><b>Node ${l.n} · ${esc(l.t)}</b>${esc(l.d)}</div>`).join('')}</div></div>`;
  }
  return `<div class="real"><h2>Back to reality</h2><div class="sub">The game is over. Here's what each piece actually was.</div>
    <table class="dec">${DECODER.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>`;
}
