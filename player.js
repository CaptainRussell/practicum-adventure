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
  P.S = d.S; P.board = d.board || []; P.join = d.join || null; P.usedPatches = P.board.map(r => r.patchKey).filter(Boolean);
  S = d.S; // shared helpers (available(), curMission(), ccHook()...) read the global S
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
  // A null duration holds the queue until the overlay is explicitly dismissed.
  if (it[1] == null) return;
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
    case 'ach': return enqueue(() => showAch(ACH[f.aid]), 0);
    case 'dice': return enqueue(() => diceOverlay(f), f.table ? HYPE_MS + 1800 : DICE_MS + 1300);
    case 'lootDrop': return enqueue(() => { const l = LOOT.find(x => x.id === f.lid); if (!l) return; SFX.play('loot');
      return overlay(`<div class="bigcard lootcard" style="border-color:${lootColor(l)}"><div class="sectlbl" style="color:${lootColor(l)}">🎁 LOOT DROP${l.home ? ' · ' + UNITS.find(u => u.id === l.home[0]).name : ''}</div>
        <div style="font-size:110px;margin-top:8px">${l.icon}</div><h2 style="color:${lootColor(l)}">${esc(l.name)}</h2><div class="bt">${mt(esc(fill(S, l.text)))}</div>
        <div class="bt" style="font-size:22px;color:var(--dim)">Added to your team items (${f.count}/3). Ask the GM to use it when it helps!</div></div>`, 'solid'); }, 4200);
    case 'multiDice': return enqueue(() => multiDiceOverlay(f), 4200 + 1800);
    case 'loyDelta': return enqueue(() => showLoy(f), 0);
    case 'levelDone': return enqueue(() => showToast('⬆️', 'UPGRADES LOCKED IN', 'Back to the map'), 0);
    case 'big': return enqueue(() => overlay(`<div class="bigcard ${f.cls || ''}"><div style="font-size:70px">${f.icon || ''}</div><h2>${esc(f.title)}</h2><div class="bt">${esc(f.text)}</div></div>`), 3600);
    case 'critical': return enqueue(() => {
      const d = overlay(`<div class="bigcard ${f.cls || 'bad'}"><div style="font-size:70px">${f.icon || '🚨'}</div><h2>${esc(f.title)}</h2><div class="bt">${esc(f.text)}</div><div class="bt" style="margin-top:20px;font-size:14px;color:var(--gold)">CLICK TO CONTINUE</div></div>`);
      d.onclick = () => { d.remove(); nextQ(); };
    }, null);
    case 'roll': return enqueue(() => rollOverlay(f), 6200);
    case 'stars': return enqueue(() => overlay(`<div class="bigcard good"><h2>${esc(f.who)}</h2><div class="stars">${'⭐'.repeat(f.n)}${'<span style="opacity:.2">⭐</span>'.repeat(3 - f.n)}</div><div class="verdict pass">${['', 'ROUGH', 'SOLID', 'NAILED IT!'][f.n]}</div></div>`), 3000);
    case 'flash': return enqueue(() => { document.body.classList.add('flashred'); return () => document.body.classList.remove('flashred'); }, 1900);
    case 'bossIntro': return enqueue(() => overlay(`<div class="ptitle blink" style="color:var(--bad);font-size:26px">⚠ WARNING ⚠</div><div class="bigcard bad"><canvas id="bossIntroCv" width="32" height="32" style="width:220px;height:220px;image-rendering:pixelated"></canvas><h2>${BOSS.name}</h2><div class="bt">${BOSS.title}</div></div><div class="ptitle" style="font-size:16px">INSPECTION IN PROGRESS</div>`, '') && (drawBoss($('#bossIntroCv')), () => document.querySelectorAll('.ovl').forEach(o => o.remove())), 4200);
    case 'bossHit': return enqueue(() => { const b = $('.bossart'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } }, 500);
    case 'gameOver': return enqueue(() => { SFX.play('over'); return overlay(`<div class="bigcard bad" style="max-width:1100px"><div style="font-size:90px">💀</div><h2 style="font-size:44px">GAME OVER</h2><div class="bt" style="font-family:var(--pixel);font-size:16px;line-height:1.6;color:var(--bad)">${esc(GAME_OVER_TEXT)}</div><div class="bt">${f.kind === 'crisis' ? '' : 'The Inspector General found: '}${esc(f.reasons.join('; '))}</div></div>`); }, 6500);
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
function tumble(el, sides, final, ms, done, onNum) {
  const span = el.querySelector('span'), t0 = performance.now();
  el.classList.add('rolling');
  (function step() {
    const t = performance.now() - t0;
    if (t < ms) { const n = 1 + rnd(sides); span.textContent = n; onNum && onNum(n); SFX.play('tick'); setTimeout(step, 40 + t / 14); }
    else { span.textContent = final; el.classList.remove('rolling'); el.classList.add('landed'); done && done(); }
  })();
}
// With a table: every outcome is shown first and a highlight sweeps across them (the drumroll),
// then the die spins, the highlight follows the tumbling number, and the winner lights up.
function hypeDice(f) {
  const rows = f.table, hit = rows.findIndex(r => f.v >= r.lo && f.v <= r.hi);
  const rm = overlay(`<div class="wt">${esc(f.title)}</div><div class="hype">${rows.map(r => `<div class="hr" style="--c:${r.color}"><b>${r.lo === r.hi ? r.lo : r.lo + '-' + r.hi}</b><span>${r.icon || ''} ${esc(r.label)}</span></div>`).join('')}</div>
    ${dieHtml(f.sides, '?')}<div class="wres"></div>`, 'solid');
  const ov = document.querySelectorAll('.ovl'), d = ov[ov.length - 1], els = d.querySelectorAll('.hr');
  const light = k => els.forEach((e, i) => e.classList.toggle('lit', i === k));
  let k = 0;
  const sweep = setInterval(() => { light(k % els.length); SFX.play('tick'); k++; }, 300);
  const go = setTimeout(() => {
    clearInterval(sweep); light(-1); SFX.play('alarm');
    tumble(d.querySelector('.die'), f.sides, f.v, 2000, () => {
      els.forEach((e, i) => e.classList.add(i === hit ? 'win' : 'lose'));
      d.querySelector('.wres').innerHTML = esc(f.result || ''); SFX.play('good');
    }, n => light(rows.findIndex(r => n >= r.lo && n <= r.hi)));
  }, 2400);
  return () => { clearInterval(sweep); clearTimeout(go); rm(); };
}
function diceOverlay(f) {
  if (f.table) return hypeDice(f);
  const rm = overlay(`<div class="wt">${esc(f.title)}</div>${f.goal ? `<div class="goalDie">🎯 GOAL DIE: ${f.goal}+</div>` : ''}${dieHtml(f.sides, '?')}<div class="wres"></div>`, 'solid');
  const ov = document.querySelectorAll('.ovl'); const d = ov[ov.length - 1];
  tumble(d.querySelector('.die'), f.sides, f.v, DICE_MS - 900, () => {
    d.querySelector('.wres').innerHTML = esc(f.result || ''); SFX.play('good');
  });
  return rm;
}
function multiDiceOverlay(f) {
  const rm = overlay(`<div class="wt">${esc(f.title)}</div><div class="dicerow">${f.rows.map(r => `<div class="dcol"><img src="${r.av != null ? presetAvatar(r.av, r.uni, r.hair) : avatar(r.name)}">${r.goal ? `<div class="goalDie">🎯 ${r.goal}+</div>` : ''}${dieHtml(20, '?')}<div class="dn2">${esc(r.name)}</div><div class="dtag ${r.hi ? 'hi' : ''}">&nbsp;</div></div>`).join('')}</div>`, 'solid');
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
  const goal = Math.min(20, Math.max(2, r.dc - (r.total - r.d20)));
  const rm = overlay(`<div class="bigcard rollcard"><h2>${esc(f.who)} ${r.safe ? 'PLAYS IT SAFE 🛡️' : 'ROLLS THE d20'}</h2>
    ${r.safe ? '' : `<div class="goalDie">🎯 GOAL DIE: ${goal}+</div>`}
    ${dieHtml(20, '?', 'big')}
    <div class="after" style="visibility:hidden">
    <div class="rollline">${r.parts.length ? r.parts.map(p => `<span class="${p[1] >= 0 ? 'up' : 'dn'}">${sign(p[1])}</span> ${mt(esc(p[0]))}`).join(' &nbsp; ') : 'no modifiers'}</div>
    <div class="rollline">= <b>${r.total}</b> vs target <b>${r.dc}</b></div>
    <div class="verdict ${r.pass ? 'pass' : 'fail'}">${verdict}</div></div></div>`, 'solid');
  const ov = document.querySelectorAll('.ovl'); const d = ov[ov.length - 1];
  tumble(d.querySelector('.die'), 20, r.d20, r.safe ? 300 : 1800, () => {
    d.querySelector('.after').style.visibility = 'visible';
    d.querySelector('.bigcard').classList.add(r.pass ? 'good' : 'bad');
    SFX.play(r.nat === 20 ? 'crit' : r.nat === 1 ? 'fumble' : r.pass ? 'good' : 'bad');
  });
  return rm;
}
// Achievement unlocked: a small bar along the bottom of the screen (doesn't hold up the game)
function showAch(a) {
  if (!a) return;
  SFX.play('ach');
  const w = document.createElement('div'); w.className = 'achbar';
  w.style.bottom = (12 + document.querySelectorAll('.achbar').length * 52) + 'px';
  w.innerHTML = `<span class="ai">${a.icon}</span><span><b>🏅 ${esc(a.name)}</b>${a.pts ? ` <i>+${a.pts} PTS</i>` : ''}<small>${mt(esc(a.text))}</small></span>`;
  document.body.appendChild(w); setTimeout(() => w.remove(), 4500);
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
  document.body.className = 'player' + (S.phase === 'debrief' ? ' reality' : '') + (S.phase === 'join' ? ' joining' : '');
  const full = ['title', 'join', 'intro', 'party', 'perks', 'kit', 'avatars', 'boss', 'results', 'debrief', 'levelup', 'unit', 'patch', 'manifest'].includes(S.phase);
  const hud = !['title', 'join', 'intro', 'debrief', 'party', 'perks', 'kit', 'avatars', 'unit'].includes(S.phase);
  $('#app').innerHTML = `<div class="pl">${hud ? renderHud(S) : '<div></div>'}
    <div class="stage ${full ? 'full' : ''}"><div class="main">${renderMain(S)}</div>${full ? '' : `<div class="side">${renderSide(S)}</div>`}</div></div>
    ${S.showBoard ? renderBoardOverlay() : ''}${renderJoinBox(S)}${renderActorBanner(S)}${renderResultCard(S)}${renderNotice(S)}`;
  fitCard(); fitLines($('#app'));
  // the GM only pushes state when something changes, so redraw ourselves when a wheel/die finishes
  clearTimeout(P.spinT);
  if (Date.now() < (S.spinUntil || 0)) P.spinT = setTimeout(render, S.spinUntil - Date.now() + 80);
  const bc2 = $('#bossCv'); if (bc2) drawBoss(bc2);
  const boardOv = $('#boardOv'); if (boardOv) boardOv.onclick = null;
}

// Long missions + lots of power-ups can overflow a 720p projector: step the
// mission card down to denser text until everything fits.
function fitCard() {
  const m = $('.mcard'); if (!m) return;
  for (const lvl of ['dense', 'denser']) {
    if (m.scrollHeight <= m.clientHeight + 2) return;
    m.classList.add(lvl);
  }
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
  if (!j || !j.url || !j.live || j.full || !(S.phase === 'title' || S.phase === 'avatars' || (S.phase === 'intro' && S.introPage === 0))) return '';
  const src = qrSrc(j.url);
  return `<div class="joinbox">${src ? `<img src="${src}">` : ''}<div><div class="sectlbl">📱 JOIN ON YOUR PHONE</div>
    <div class="jurl">${esc(j.url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</div><div class="jcode">ROOM ${esc(j.code)}</div></div></div>`;
}
// The first screen of a run: the join QR blown up to fill the projector, so the whole room can scan it
function renderJoinScreen(S) {
  const j = P.join, src = j && j.url ? qrSrc(j.url) : '';
  const names = Object.values(S.clients || {}).map(c => c.name).filter(Boolean);
  if (!src) return `<div class="joinscr"><div class="ptitle">📱 JOIN ON YOUR PHONE</div><div class="jsub">${j && j.code ? `Phones are connecting… ROOM <b>${esc(j.code)}</b>` : 'Phones are off: the GM runs this one from the console.'}</div></div>`;
  return `<div class="joinscr"><img class="jqr" src="${src}" alt="Join QR code">
    <div class="jside"><div class="ptitle">📱 SCAN TO JOIN</div>
      <div class="jurl">${esc(j.url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</div>
      <div class="jcode">ROOM <b>${esc(j.code)}</b></div>
      <div class="jsub">${j.live ? '' : '🟡 connecting… '}${names.length ? `✅ ${names.length} joined: ${names.map(esc).join(', ')}` : 'Waiting for cadets…'}</div></div></div>`;
}
function voteDots(S, i) {
  const v = S.votes || {};
  const who = Object.keys(v).filter(s => String(v[s]) === String(i)).map(Number).filter(s => S.party[s]);
  const tie = !!voteTie(S), cr = crownIdx(S);
  return who.length ? `<div class="votes">${who.map(s => { const p = S.party[s]; return `<span class="vd ${tie && s === cr ? 'tieglow' : ''}" style="--cc:${clsColor(p)}"><img src="${avatarOf(p)}" title="${esc(rankName(p))}">${s === cr ? '<i>👑</i>' : ''}</span>`; }).join('')}</div>` : '';
}
// "CAPT SNUFFY: ROLL THE INJECT CHECK!" — whose turn it is to press the button
function renderActorBanner(S) {
  if (!S.actor || spinning() || S.phase === 'debrief') return '';
  const p = S.party[S.actor.slot];
  // the Unknown d6 and the inject d6 already show their outcomes on the screen behind: just the name and icon
  const short = ['mystery', 'trigger'].includes(S.actor.kind), t = short ? null : actorTable(S);
  return `<div class="actorbar">${p ? `<img src="${avatarOf(p)}">` : ''}<div><div class="ab1">🎲 YOUR TURN, ${esc(rankName(p).toUpperCase())}</div>${short ? '' : `<div class="ab2">${esc(S.actor.label)}: tap the button on your phone!</div>`}
    ${t ? `<div class="abt">${t.map(r => `<span style="--c:${r.color}"><b>${r.lo === r.hi ? r.lo : r.lo + '-' + r.hi}</b> ${r.icon || ''} ${esc(r.label)}</span>`).join('')}</div>` : ''}</div></div>`;
}
// A perk or ability just fired: explain what it did until the GM continues
function renderNotice(S) {
  const n = S.notice; if (!n) return '';
  return `<div class="rescard notice"><div class="bigcard ${n.cls || 'good'}"><div class="bigic" style="font-size:80px">${n.icon}</div><div class="sectlbl" style="color:var(--gold)">${esc(n.label || 'PERK / ABILITY USED')}</div><h2>${esc(n.title)}</h2><div class="bt">${mt(esc(n.text))}</div><div class="rwait">⏳ Waiting for the GM to continue</div></div></div>`;
}
// ties: no banner; the Flight Commander's vote icon glows while the vote is tied (the GM directs the call)
function renderTie(S) { return ''; }
// What just changed: stays on screen until the GM clicks Continue
function renderResultCard(S) {
  if (!resultReady(S)) return '';
  const r = resultSummary(S), lootOf = id => LOOT.find(x => x.id === id);
  // one change per line, amount first: "−1 ⭐ Trust", "+ 📦 Pallet of Spares"
  const row = (cls, amt, what) => `<div class="rrow ${cls}"><b>${amt}</b><span>${what}</span></div>`;
  const starRow = S.phase === 'node' && S.cur && S.cur.stars ? row('star', `+${S.cur.stars}`, '⭐ STARS EARNED') : '';
  const rows = [
    ...(starRow ? [starRow] : []),
    ...r.meters.map(([k, d]) => row(d > 0 ? 'up' : 'dn', sign(d), `${METER[k].icon} ${METER[k].label}`)),
    ...r.loy.map(([who, d]) => row(d > 0 ? 'up' : 'dn', sign(d), `🤝 ${esc(who)} loyalty`)),
    ...r.gained.map(id => row('up', '+', `${lootOf(id).icon} ${esc(lootOf(id).name)}`)),
    ...r.lost.map(id => row('', '-', `${lootOf(id).icon} ${esc(lootOf(id).name)} <small>used</small>`)),
  ];
  const good = r.meters.reduce((a, [, d]) => a + d, 0);
  const tested = S.phase === 'node' && S.cur && !['rest', 'depot', 'unknown'].includes(S.cur.type) ? objChips(curMission()) : '';
  return `<div class="rescard"><div class="bigcard ${good > 0 ? 'good' : good < 0 ? 'bad' : ''}"><div class="sectlbl">${teamTag(S) ? esc(teamTag(S)) + ' · ' : ''}RESULT</div>${(() => { const rr = S.phase === 'node' && S.cur && S.cur.rollRes; if (!rr) { const c = S.cur; if (S.phase === 'node' && c && c.stars) return `<h2>🎤 ${esc(cadetName(c.lead))}</h2><div class="rstars">${[1, 2, 3].map(k => `<span class="${k <= c.stars ? 'on' : ''}">⭐</span>`).join('')}</div>`; return `<h2>${esc(resultHeadline(S))}</h2>`; }
    const v = rr.nat === 20 ? 'CRITICAL!' : rr.nat === 1 ? 'FUMBLE!' : rr.pass ? 'SUCCESS' : 'FAILED';
    return `<h2 class="verdict2 ${rr.pass ? 'up' : 'dn'}">${rr.lead ? '📢 ' : ''}${v}</h2><div class="bt rmath">rolled ${rr.d20} · total ${rr.total} vs target ${rr.dc}${rr.lead ? ' · Prior MTI' : ''}</div>`; })()}${tested ? `<div class="sob" style="margin:4px 0 8px"><span class="objlbl">THIS TESTED</span>${tested}</div>` : ''}
    ${rows.length ? `<div class="rrows">${rows.join('')}</div>` : '<div class="bt">No change to your meters.</div>'}
    ${(() => { const d = usableNow(S).filter(u => u.moment); return d.length ? `<div class="rdecide">⚡ DECIDE NOW: USE IT OR PASS${d.map(u => `<div>${u.icon} <b>${esc(u.label)}</b>${u.who != null ? ` (${esc(rankName(S.party[u.who]))})` : ''}: ${mt(esc(u.hint))}</div>`).join('')}</div>` : ''; })()}
    <div class="rwait">⏳ Waiting for the GM to continue</div></div></div>`;
}
// Power-ups worth using right now (tokens, items, abilities, perks)
// Projector: only moment-specific power-ups, as a decision for the team (general ones are on phones)
function renderPowerups(S) {
  const list = usableNow(S).filter(u => u.moment); if (!list.length) return '';
  return `<div class="powerups decide"><span class="pu-h">⚡ DECIDE NOW: USE IT OR PASS</span>${list.map(u => `<span class="pu ${u.hot ? 'hot' : ''}">${u.icon} <b>${esc(u.label)}</b>${u.who != null ? ` <i>(${esc(rankName(S.party[u.who]))})</i>` : ''}<span class="hint"> · ${mt(esc(u.hint))}</span></span>`).join('')}</div>`;
}

// One HUD meter. Hidden by default: a STRONG / STEADY / DANGER band (danger flashes red).
// A DEOCS Survey shows the exact number and the 10-pip bar.
function meterHtml(S, m) {
  const v = S.meters[m.k], b = meterBand(v);
  if (deocsOn(S)) return `<div class="meter ${b.cls === 'danger' ? 'low' : ''}" style="--c:${m.color}"><div class="lbl"><span>${meterIcon(m)} ${m.name}</span><span>${v}</span></div><div class="bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</div></div>`;
  return `<div class="meter fog ${b.cls} ${b.cls === 'danger' ? 'low' : ''}" style="--c:${m.color}"><div class="lbl"><span>${meterIcon(m)} ${m.name}</span></div><div class="band">${b.word}</div></div>`;
}
function renderHud(S) {
  const u = S.unit ? UNITS.find(x => x.id === S.unit) : null;
  const items = (S.items || []).map(id => LOOT.find(l => l.id === id)).map(l => `<span title="${esc(l.name)}">${l.icon}</span>`).join('');
  return `<div class="hud">
    <div class="unit">${u ? `${u.icon} ${u.name}<small>${u.sq}</small>` : 'PRACTICUM ADVENTURE'}</div>
    <div class="meters">${METERS.map(m => meterHtml(S, m)).join('')}${deocsOn(S) && !['results', 'debrief'].includes(S.phase) ? `<div class="deocs-tag">📋 DEOCS${deocsLeft(S) ? ` · ${deocsLeft(S)} more` : ' · last stop'}</div>` : ''}</div>
    <div class="right">
      ${patchOf(S) ? `<div class="tok patch" style="--c:${UNITS.find(x => x.id === S.unit).color}"><b>${patchOf(S).icon}</b>${esc(patchOf(S).name.toUpperCase())}</div>` : ''}
      ${S.intent ? `<div class="tok" style="--c:${METER[S.intent].color}"><b>${METER[S.intent].icon}</b>INTENT</div>` : ''}
      <div class="inv">${items || '<span style="opacity:.3">·</span>'}</div>
    </div></div>`;
}

function renderDanger(S) {
  const d = dangerInfo(S); if (!d) return '';
  return `<div class="danger-alert">⚠️ ${mt(esc(d.text))}${d.tools.length ? `<div class="dtools">Could help now: ${d.tools.map(esc).join(' · ')}</div>` : ''}</div>`;
}
function renderSide(S) {
  const pt = patchOf(S), cr = crownIdx(S);
  return `<div class="sectlbl">${pt ? `<span class="sidepatch" style="--c:${UNITS.find(x => x.id === S.unit).color}">${pt.icon} ${esc(pt.name.toUpperCase())}</span>` : 'YOUR FLIGHT'}</div>
    <div class="pgrid">${S.party.map((p, i) => { const off = S.offline === i || (S.phase === 'map' && S.offlineNext === i); return `<div class="pcard ${off || p.fired ? 'offline' : ''}" style="border-color:${clsColor(p)}"><img src="${avatarOf(p)}" style="border-color:${clsColor(p)}"><div><div class="nm">${insignia(p)}${esc(rankName(p))}</div><div class="cl">${CLASS[p.cls] ? CLASS[p.cls].name : ''}${p.fired ? ' · 🪓 FIRED' : off ? ' · 📵 MEETING' : ''}</div></div>${i === cr ? '<div class="crown">👑</div>' : ''}</div>`; }).join('')}</div>
    ${(S.items || []).length ? `<div class="sectlbl" style="margin-top:6px">🎒 TEAM ITEMS (${S.items.length}/3)</div><div class="sitems1">${S.items.map(id => { const l = LOOT.find(x => x.id === id); return `<span>${l.icon} ${esc(l.name)}</span>`; }).join('')}</div>` : ''}
    <div class="sectlbl" style="margin-top:6px">YOUR UNIT</div>
    ${S.cc ? `<div class="npc cc"><img src="${avatar(S.cc)}"><div><div class="nm">${insignia(S.cc.split(' ').slice(0, -1).join(' '))}${esc(S.cc)}</div><div class="tr rev">${ccBadge(20)} Squadron Commander${S.intent ? ` · intent ${METER[S.intent].icon}` : ''}</div></div></div>` : ''}
    <div class="ugrid">${S.npcs.slice().sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank)).map(n => { const t = TRAIT[n.trait]; return `<div class="npc mini ${isAlly(n) ? 'ally' : ''} ${n.broken || n.gone ? 'broken' : ''} ${n.out ? 'out' : ''}"><img src="${avatar(n.name + n.rank)}"><div>
      <div class="nm">${insignia(n.rank)}${esc(n.rank)} ${esc(n.name)}${isAlly(n) ? ' 🤝' : ''}${n.gone ? ' (GONE)' : n.out ? ' (OUT)' : ''}</div>
      <div class="tr rev">${t.icon} ${t.name}</div>
      <div class="loyrow"><div class="loy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div>${loyBandHtml(n.loy, isAlly(n), n.broken)}</div></div></div>`; }).join('')}</div>`;
}

function renderMain(S) {
  if (S.inject && S.inject.forced) return renderInject(S);
  switch (S.phase) {
    case 'title': return renderTitle();
    case 'join': return renderJoinScreen(S);
    case 'intro': return renderIntro(S);
    case 'party': return renderParty(S);
    case 'perks': return renderPerks(S);
    case 'kit': return renderKitCheck(S);
    case 'avatars': return renderAvatars(S);
    case 'unit': { const u = S.unitRolled && UNITS.find(x => x.id === S.unit);
      if (u) return `<div class="titlescr unitrev" style="--c:${u.color}"><div style="font-size:150px;line-height:1">${u.icon}</div><div class="ptitle" style="color:${u.color};font-size:64px">${u.name}</div><div class="unitsq">${u.sq.toUpperCase()}</div>
        <div class="unitwarn"><div class="uwh">⚠️ SQUADRON WARNING: ${esc(u.drain.name)}</div><div class="uwt">${esc(u.drain.text)}.</div>
          <div class="uwm">${meterTag(u.drain.k, '<span class="dn">−1</span>')} every ${DIFFICULTY.drainEvery} stops, all game long</div>
          <div class="uws">This is your squadron's chronic weak spot. It comes with the unit you picked: plan around it.</div></div></div>`;
      return `<div style="display:flex;flex-direction:column;gap:8px;height:100%;padding-bottom:50px"><div class="ptitle" style="text-align:center">CHOOSE YOUR SQUADRON <span class="ptsub">· vote on your phone 📱</span></div>
        <div class="unitgrid u3">${UNITS.map((x, i) => `<div class="unitcard" style="--c:${x.color};position:relative"><div class="ui">${x.icon}</div><div><div class="unm">${x.name}</div><div class="usq">${x.sq}</div>
          <div class="ustart bands4">${METERS.map(m => { const b = meterBand(x.start[m.k]); return `<div class="sb4 ${b.cls}" style="--mc:${m.color}"><span class="sbi">${m.icon}</span><span class="sbn">${m.name}</span><span class="sbw fitw">${b.word}</span></div>`; }).join('')}</div>
          <div class="uwarn"><b>⚠️ SQUADRON WARNING: ${esc(x.drain.name)}</b><div>${esc(x.drain.text)}. ${meterTag(x.drain.k, '−1')} every ${DIFFICULTY.drainEvery} stops</div></div></div>${voteDots(S, x.id)}</div>`).join('')}</div></div>`; }
    case 'patch': return renderPatch(S);
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
  return `<div class="titlescr"><div class="logo">PRACTICUM<br>ADVENTURE<small>For AFAS 3410 (Fall 2026)</small><small class="credit">Created by Captain Russell</small></div>
    <div class="ptitle blink" style="font-size:20px">INSERT CADETS TO CONTINUE</div>
    ${top.length ? `<div class="box" style="min-width:640px"><div class="sectlbl">HIGH SCORES</div><table class="lb">${top.map((b, i) => `<tr class="${i < 3 ? 'top' : ''}"><td class="rk">${i + 1}</td><td>${esc(b.callsign)}<div class="lbc">${esc(b.cadets || '')}</div></td><td>${esc(b.grade)}</td><td>${b.score}</td></tr>`).join('')}</table></div>` : ''}</div>`;
}

function renderIntro(S) {
  if (S.introPage === 0) return `<div class="intro"><div class="ptitle" style="text-align:center">WHY ARE WE DOING THIS?</div>
    <div class="sub" style="text-align:center;font-size:24px">AS300 Leadership Practicum: today you practice the job, not just the vocabulary. Five objectives:</div>
    <div class="banner gold" style="font-size:12px;line-height:1.7">Every stop tests at least one of these. At the end, the debrief shows exactly which moments tested which objective.</div>
    <div class="objgrid">${OBJECTIVES.map((o, i) => `<div class="obj"><div class="oi">${o.icon}</div><div><b>${i + 1}. ${esc(o.name)}</b><div>${esc(o.text)}</div></div></div>`).join('')}</div></div>`;
  if (S.introPage === 1) return `<div class="intro">
    <div class="ptitle" style="text-align:center">HOW TO PLAY</div>
    <div class="steps">${INTRO_STEPS.map(([ic, h, t], i) => `<div class="step"><div class="sn">${i + 1}</div><div class="si">${ic}</div><div><b>${esc(h)}</b><div>${esc(t)}</div></div></div>`).join('')}</div></div>`;
  // Two jobs, nothing else: keep the 4 meters high, and never break integrity. (Full legend: the Field Guide.)
  if (S.introPage === 3) return renderIntegrity();
  return `<div class="intro readscr"><div class="ptitle" style="text-align:center">READING THE SCREEN</div>
    <div class="rs-h">JOB 1 · KEEP ALL 4 METERS HIGH</div>
    <div class="rs-meters">${METERS.map(m => `<div class="rs-m" style="--c:${m.color}"><div class="rs-i">${m.icon}</div><b>${m.name}</b><div>${esc(INTRO_METERS[m.k])}</div></div>`).join('')}</div>
    <div class="rs-bands"><span class="meter fog strong"><span class="band">STRONG</span></span><span class="meter fog steady"><span class="band">STEADY</span></span><span class="meter fog danger low"><span class="band">!DANGER!</span></span></div>
    <div class="rs-t">${mt(esc(INTRO_FOG))}</div></div>`;
}
// Briefing page 4: Job 2 on its own screen, so nobody misses it
function renderIntegrity() {
  return `<div class="intro integscr"><div class="ig-skull">💀</div>
    <div class="ptitle" style="text-align:center;color:var(--bad)">JOB 2 · NO INTEGRITY VIOLATIONS</div>
    <div class="ig-big">ONE VIOLATION = <b>GAME OVER</b></div>
    <div class="ig-list"><span>🤥 Lie</span><span>🙈 Cover it up</span><span>📝 Fudge a record</span><span>⏭️ Skip the paperwork</span></div>
    <div class="ig-t">Some choices are shortcuts. They look like they help your meters. The Inspector General finds every one of them at the end.</div>
    <div class="ig-t gold">Integrity First. In real life there is no respawn.</div></div>`;
}

function renderParty(S) {
  return `<div style="display:flex;flex-direction:column;gap:10px;height:100%"><div class="ptitle" style="text-align:center;font-size:24px">SELECT YOUR POSITION</div>
    ${S.callsign ? `<div class="ptitle" style="text-align:center;font-size:18px;color:var(--accent)">TEAM ${esc(S.callsign.toUpperCase())}</div>` : ''}
    <div class="sub" style="text-align:center;font-size:21px">no duplicate positions · no Flight Commander? the 👑 goes down the chain of command${P.join && P.join.live ? ` · 📱 pick on your phone (ROOM <b style="color:var(--gold)">${esc(P.join.code)}</b>)` : ''}</div>
    <div class="classgrid">${CLASSES.map(c => {
      const who = S.party.find(p => p.cls === c.id && p.name);
      return `<div class="ccard ${who ? 'taken' : ''}" style="${who ? `border-color:${c.color}` : ''}"><div class="chead"><span class="ic">${clsIcon(c.id, 40)}</span><h3 style="color:${c.color}">${c.name}</h3>${who ? `<div class="who" style="background:${c.color}">${who.av != null ? `<img src="${avatarOf(who)}">` : ''}${esc(rankName(who))}</div>` : ''}</div>
        <div class="sub cline"><span style="color:var(--gold)">${c.rankLong}</span></div>
        <div class="ab"><b style="color:var(--accent)">${c.ability ? c.ability.icon + ' ' + esc(c.ability.name) : '👑 COMMAND'}</b> ${c.ability ? useHtml(c.ability.short || c.ability.text) : useHtml(c.abilityText, 'passive')}</div>
        
        <div class="cfoot"><div class="cspec"><span class="cspec-lbl">FOCUS</span><div class="cspec-tags">${(c.spec || []).map(k => meterTag(k)).join(' ')}</div></div><div class="statline">${STATS.map(s => `${s} <b>+${c.stats[s]}</b>`).join(' · ')}</div></div></div>`;
    }).join('')}</div></div>`;
}

// Perk reveal: one card per cadet showing ONLY their class's two perks.
// Kit check (after perks, before the squadron vote): everyone looks at their kit on their phone
function renderKitCheck(S) {
  return `<div class="kitchk"><div class="ptitle">🎒 CHECK YOUR KIT</div>
    <div class="sub">On your phone: tap <b>🎒 KIT</b> to see your position, stats, ability and perk, then tap <b>🎮 GAME</b> to come back.</div>
    <div class="kitrow">${S.party.map(p => { const c = CLASS[p.cls], pk = c.perks.find(k => k.id === p.perk);
      return `<div class="ccard ${p.kitOk ? 'taken' : ''}" style="${p.kitOk ? `border-color:${c.color}` : ''}"><div class="chead"><img src="${avatarOf(p)}" style="width:48px;height:48px;image-rendering:pixelated"><div><h3>${insignia(p)}${esc(rankName(p))}</h3><div class="sub" style="font-size:19px;color:${c.color}">${c.name}</div></div></div>
        <div class="kitline">${c.ability ? c.ability.icon : '👑'} <b>${esc(c.ability ? c.ability.name : 'Command Token')}</b></div><div class="kitline">${pk ? pk.icon : '🎁'} <b>${esc(pk ? pk.name : '-')}</b></div>
        <div class="kitst">${p.kitOk ? '✅ CHECKED' : '⏳ checking…'}</div></div>`; }).join('')}</div></div>`;
}
function renderPerks(S) {
  return `<div style="display:flex;flex-direction:column;gap:12px;height:100%"><div class="ptitle" style="text-align:center;font-size:24px">🎁 PERKS REVEALED: PICK ONE</div>
    <div class="sub" style="text-align:center;font-size:22px">Each cadet chooses one perk for their position (on your phone or tell the GM)</div>
    <div class="perkgrid" style="grid-template-columns:repeat(${S.party.length},1fr)">${S.party.map(p => { const c = CLASS[p.cls]; return `<div class="ccard ${p.perk ? 'taken' : ''}">
      <div class="chead"><img src="${avatarOf(p)}" style="width:40px;height:40px;image-rendering:pixelated"><div><h3>${insignia(p)}${esc(rankName(p))}</h3><div class="sub" style="font-size:19px">${c.name}</div></div></div>
      ${c.perks.map((k, j) => `<div class="perk big ${p.perk === k.id ? 'sel' : p.perk ? 'off' : ''}"><b>${p.perk === k.id ? '▶ ' : ''}<span class="pki">${k.icon}</span>${esc(k.name)}</b><div>${useHtml(k.text)}</div></div>`).join('')}
      <div class="sub" style="text-align:center;font-size:20px">${p.perk ? '✅ LOCKED IN' : '⏳ choosing...'}</div></div>`; }).join('')}</div></div>`;
}

function renderAvatars(S) {
  return `<div style="display:flex;flex-direction:column;gap:14px;height:100%"><div class="ptitle" style="text-align:center">PICK YOUR CHARACTER ICON</div>
    <div class="sub" style="text-align:center">Pick on your phone 📱 · your icon also sets your gender in the game</div>
    ${AV_GROUPS.map(G => `<div class="sectlbl" style="font-size:14px">${G.label}</div><div class="avgrid">${G.idx.map(k => { const who = S.party.find(p => p.av === k); return `<div class="avc ${who ? 'taken' : ''}"><div class="avn">${avNum(k)}</div><img src="${who ? avatarOf(who) : presetAvatar(k)}"><div class="avw">${who ? esc(rankName(who)) : '&nbsp;'}</div></div>`; }).join('')}</div>`).join('')}</div>`;
}

function renderManifest(S) {
  const u = UNITS.find(x => x.id === S.unit), cc = u.cc;
  return `<div style="display:flex;flex-direction:column;gap:8px;overflow:hidden">
    <div class="org">
      <div class="ccpanel" style="--c:${u.color}">
        <div class="cchead"><img src="${avatar(S.cc)}"><div style="flex:1"><div class="cclbl">${ccBadge(24)} SQUADRON COMMANDER</div><div class="ccname">${insignia(S.cc.split(' ').slice(0, -1).join(' '))} ${esc(S.cc)}</div></div><div style="text-align:right"><div class="ccname">${u.icon} ${u.name}</div><div class="cclbl">${u.sq.toUpperCase()} · ORG CHART</div></div></div>
        <div class="cctiles">
          <div class="cct" style="--t:var(--gold)"><div class="ctl">${ccBadge(20)} INTENT</div><div class="ctb">${meterTag(cc.intent)}</div><div class="cts">Their top priority</div></div>
          <div class="cct" style="--t:var(--good)"><div class="ctl">👍 REWARDS</div><div class="ctb">${esc(cc.pos.name)}</div><div class="cts">${mt(esc(cc.pos.text))}</div></div>
          <div class="cct" style="--t:var(--bad);${S.flags.ccNegOff ? 'opacity:.4;text-decoration:line-through' : ''}"><div class="ctl">👎 PUNISHES</div><div class="ctb">${esc(cc.neg.name)}</div><div class="cts">${mt(esc(cc.neg.text))}</div></div>
          <div class="cct" style="--t:var(--warn)"><div class="ctl">⚠️ TENDENCY</div><div class="ctb">${esc(u.drain.name)}</div><div class="cts">${meterTag(u.drain.k, '−1')} every ${DIFFICULTY.drainEvery} stops</div></div>
        </div></div>
      <div class="orgline"></div>
      <div class="orgrow">${patchOf(S) ? `<span class="pch on orgpatch" style="--c:${u.color}"><b>${patchOf(S).icon}</b>${esc(patchOf(S).name)}</span>` : ''}${S.party.map(p => `<div class="orgcard mini" style="border-color:${clsColor(p)}"><img src="${avatarOf(p)}"><div><div class="nm">${insignia(p)}${esc(rankName(p))}</div><div class="rk">${CLASS[p.cls].name}</div></div></div>`).join('')}</div>
      <div class="orgline"></div>
      <div class="orgrow">${S.npcs.slice().sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank)).map(n => { const t = TRAIT[n.trait]; return `<div class="orgcard"><img src="${avatar(n.name + n.rank)}"><div class="rk orgpub">${esc(n.pub)}</div><div class="orgfooter"><div class="nm">${insignia(n.rank)}${esc(n.rank)} ${esc(n.name)}</div><div class="orgability"><div class="rk orgtrait" style="color:var(--good)">${t.icon} ${esc(t.name)}</div><div class="orgdetails">${traitInfo(n, isAlly(n), (S.traitDone || {})[n.slot]).map(([k, x]) => `<div class="rk ${k}">${mt(esc(x))}</div>`).join('')}</div></div><div class="rk orgloyband">${loyBandHtml(n.loy, isAlly(n), n.broken)}</div><div class="loy orgloy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div></div></div>`; }).join('')}</div>
    </div>
    </div>`;
}
// Team patch = team name: its own screen after the squadron reveal, before the org chart
function renderPatch(S) {
  const u = UNITS.find(x => x.id === S.unit);
  return `<div class="patchscr"><div class="ptitle">🎖️ PICK YOUR TEAM PATCH</div>
    <div class="sub">${u.icon} ${esc(u.sq)} · the patch is your team's name on the leaderboard · ${S.patch ? 'LOCKED IN ✅' : 'vote on your phone ✋'}</div>
    <div class="patchrow big">${(PATCHES[S.unit] || []).map(p => { const taken = (P.usedPatches || []).includes(`${S.unit}:${p.id}`); return `<span class="pch ${S.patch === p.id ? 'on' : S.patch ? 'off' : ''} ${taken ? 'taken' : ''}" style="--c:${u.color}"><b>${p.icon}</b>${esc(p.name)}${taken ? '<br>TAKEN' : ''}${S.patch ? '' : voteDots(S, p.id)}</span>`; }).join('')}</div>${renderTie(S)}</div>`;
}

// The route map: at every stop the party picks one of the 2-3 options its paths reach (votes show as avatars).
function renderMap(S) {
  const n = S.map.tiers.length, W = 1000, H = 520, startX = 48, bossX = 946, gap = 165;
  // checkpoints between stops (in the order they happen): 🎡 inject, then ⬆️ level up
  const checks = k => checksAfter(S.map, k);
  const wpo = wpOptions(), wpOpen = key => wpo.some(o => o.key === key);
  // column x positions: a stop-to-stop gap is 1 unit, +CHK_W for each checkpoint in it so its lane has room
  const CHK_W = 0.5, colX = [startX]; // colX[k + 1] = x of column k (k = -1 start ... n boss)
  const units = [1]; for (let k = 0; k < n; k++) units.push(1 + checks(k).length * CHK_W);
  const unit = (bossX - startX) / units.reduce((a, b) => a + b, 0);
  units.forEach(u => colX.push(colX[colX.length - 1] + u * unit));
  const pt = (k, i) => {
    if (k === -1) return [startX, H / 2];
    if (k === n) return [bossX, H / 2];
    const m = S.map.tiers[k].length;
    return [colX[k + 1], H / 2 + (i - (m - 1) / 2) * gap];
  };
  const av = available();
  const isOpen = (t, i) => av.some(([a, b]) => a === t && b === i);
  const visited = (t, i) => S.map.tiers[t][i].visited;
  let lines = '', nodes = '';
  const line = (a, b, lit, live) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${lit ? '#ffd23f' : live ? '#7d7dd8' : '#2a2a6a'}" stroke-width="${lit ? 7 : 5}" stroke-dasharray="${lit ? '' : '12 10'}"/>`;
  S.map.tiers[0].forEach((_, i) => { lines += line(pt(-1), pt(0, i), visited(0, i), S.pos.tier === -1); });
  for (let k = 0; k < n - 1; k++) S.map.tiers[k].forEach((_, i) => (S.map.links[k][i] || []).forEach(j => {
    lines += line(pt(k, i), pt(k + 1, j), visited(k, i) && visited(k + 1, j), S.pos.tier === k && S.pos.idx === i);
  }));
  S.map.tiers[n - 1].forEach((_, i) => { lines += line(pt(n - 1, i), pt(n), visited(n - 1, i), false); });
  for (let k = 0; k < n; k++) nodes += `<text x="${pt(k, 0)[0]}" y="16" font-size="11" fill="#8f8fc8" text-anchor="middle" font-family="'Press Start 2P'">STOP ${k + 1}</text>`;
  // checkpoint lanes (🎡 inject, ⬆️ level up): named in the STOP row, with a waypoint on every path that crosses the lane
  const CHK = { inject: { ...CHECKPOINT.inject, name: 'INJECT', mark: k => checkMark(S, k, 'inject') },
    level: { ...CHECKPOINT.level, name: 'LEVEL UP', mark: k => checkMark(S, k, 'level') } };
  const w = S.wp;
  for (let k = 0; k < n; k++) checks(k).forEach((kind, ci, all) => {
    const x0 = pt(k, 0)[0], x1 = pt(k + 1, 0)[0], gx = x0 + (x1 - x0) * (ci + 1) / (all.length + 1);
    const C = CHK[kind], st = C.mark(k), past = st === 'past';
    const col = past ? '#8f8fc8' : C.color;
    lines += `<line x1="${gx}" y1="30" x2="${gx}" y2="${H - 18}" stroke="${col}" stroke-width="2" stroke-dasharray="3 9" opacity="${past ? 0.2 : 0.45}"/>`;
    nodes += `<text x="${gx}" y="16" font-size="8" fill="${col}" text-anchor="middle" font-family="'Press Start 2P'" opacity="${past ? 0.6 : 1}">${past ? '✅ ' : ''}${C.name}</text>`;
    // every path segment that crosses this lane: [from point, to point, traveled?]
    // the waypoint on the segment the team picked is lit (traveled) once it's running or done
    const picked = (i, j) => w && w.k === k && S.pos.tier === k && i === S.pos.idx && String(w.dest) === String(j) && (w.done.includes(kind) || w.cur === kind);
    const segs = k < n - 1
      ? S.map.tiers[k].flatMap((_, i) => (S.map.links[k][i] || []).map(j => [pt(k, i), pt(k + 1, j), (visited(k, i) && visited(k + 1, j)) || picked(i, j), S.pos.tier === k && i === S.pos.idx ? `w:${kind}:${j}` : null]))
      : S.map.tiers[k].map((_, i) => [pt(k, i), pt(n), picked(i, 'boss') || (S.phase === 'boss' && visited(k, i)), S.pos.tier === k && i === S.pos.idx ? `w:${kind}:boss` : null]);
    // Branch Plan: waypoints toward stops off the path get their own segment
    if (S.pos.tier === k) wpo.filter(o => o.kind === kind && !segs.some(sg => sg[3] === o.key)).forEach(o => segs.push([pt(k, S.pos.idx), o.j === 'boss' ? pt(n) : pt(k + 1, o.j), false, o.key]));
    const dots = [];
    segs.forEach(([a, b, lit, key]) => {
      const y = a[1] + (b[1] - a[1]) * (gx - a[0]) / (b[0] - a[0]);
      const d = dots.find(o => Math.abs(o.y - y) < 22); // paths that cross at the same spot share one waypoint
      if (d) { d.lit = d.lit || lit; if (key) d.keys.push(key); } else dots.push({ y, lit, keys: key ? [key] : [] });
    });
    dots.forEach(({ y, lit, keys }) => {
      const okey = keys.find(wpOpen), live = st === 'live' && lit;
      const vs = okey ? votersFor(okey).map(s2 => S.party[s2]).filter(Boolean) : [];
      nodes += `<g opacity="${lit || okey ? 1 : past ? 0.3 : wpo.length ? 0.35 : 0.8}"><circle cx="${gx}" cy="${y}" r="${okey ? 24 : 15}" fill="#1e1206" stroke="${lit ? '#ffd23f' : col}" stroke-width="${okey ? 6 : lit ? 4 : 3}">${live || okey ? '<animate attributeName="stroke-opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/>' : ''}</circle>
        <text x="${gx}" y="${y + (okey ? 9 : 6)}" font-size="${okey ? 24 : 16}" text-anchor="middle">${C.icon}</text>
        ${vs.map((p, j2) => `<rect x="${gx - 22 + j2 * 21}" y="${y + 28}" width="22" height="22" fill="${clsColor(p)}"/><image href="${avatarOf(p)}" x="${gx - 21 + j2 * 21}" y="${y + 29}" width="20" height="20" style="image-rendering:pixelated"/>`).join('')}</g>`;
    });
  });
  S.map.tiers.forEach((tier, k) => tier.forEach((nd, i) => {
    const [x, y] = pt(k, i), nt = NODE_TYPES[nd.type];
    const open = isOpen(k, i), here = S.pos.tier === k && S.pos.idx === i;
    // short labels so neighbouring stops never collide
    const label = nd.type === 'spot' ? 'SPOTLIGHT' : { crisis: 'SCENARIO', elite: 'ELITE', rest: 'REST', depot: 'BX', unknown: '???' }[nd.type];
    const top = i < (tier.length - 1) / 2; // labels above the top node(s), below the rest
    const vs = votersFor(`${k},${i}`).map(s => S.party[s]).filter(Boolean);
    nodes += `<g opacity="${!open && !nd.visited && av.length ? 0.4 : 1}">
      <rect x="${x - 40}" y="${y - 40}" width="80" height="80" fill="${nd.visited ? '#2a2a10' : '#1b1b4a'}" stroke="${here ? '#fff' : open ? nt.color : nd.visited ? '#ffd23f' : '#3a3a8a'}" stroke-width="${open || here ? 7 : 5}">
      ${open ? '<animate attributeName="stroke-opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/>' : ''}</rect>
      <text x="${x}" y="${y + 15}" font-size="42" text-anchor="middle">${nt.icon}</text>
      ${['elite', 'spot'].includes(nd.type) ? `<text x="${x + 29}" y="${y + 31}" font-size="20" text-anchor="middle" aria-label="Guaranteed loot">🎁</text>` : ''}
      <text x="${x}" y="${top ? y - 50 : y + 62}" font-size="10" fill="${nt.color}" text-anchor="middle" font-family="'Press Start 2P'">${esc(label)}</text>
      ${vs.map((p, j) => { const ix = x - 40 + j * 21, iy = top ? y + 44 : y - 64; return `<rect x="${ix - 2}" y="${iy - 2}" width="24" height="24" fill="${clsColor(p)}"/><image href="${avatarOf(p)}" x="${ix}" y="${iy}" width="20" height="20" style="image-rendering:pixelated"/>${p.cls === 'fc' ? `<text x="${ix + 10}" y="${top ? iy + 36 : iy - 4}" font-size="13" text-anchor="middle">👑</text>` : ''}`; }).join('')}
      ${nd.done ? `<text x="${x + 32}" y="${y - 26}" font-size="26" text-anchor="middle">✅</text>` : ''}</g>`;
  }));
  return `<div style="display:flex;flex-direction:column;height:100%;gap:10px"><div class="ptitle" style="font-size:20px">${teamTag(S) ? esc(teamTag(S)) + ': ' : ''}${S.bossReady ? '👹 THE IG IS NEXT · vote on your phone when ready' : wpo.length ? `${CHECKPOINT[wpo[0].kind].icon} PICK YOUR ${CHECKPOINT[wpo[0].kind].short} WAYPOINT` : 'YOUR ROUTE'} <span class="ptsub">${S.bossReady ? '' : `· vote on your phone 📱${wpo.length && wpo.length > 1 ? ' · it also locks in your path' : ''}`}</span>${S.branch ? ' · 🌿 BRANCH PLAN: ANY NEXT STOP' : ''}</div>
    <div class="mapwrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${lines}
      <g><rect x="${startX - 34}" y="${H / 2 - 34}" width="68" height="68" fill="#14143a" stroke="#7dff6b" stroke-width="5"/><text x="${startX}" y="${H / 2 + 13}" font-size="36" text-anchor="middle">🛫</text><text x="${startX}" y="${H / 2 + 58}" font-size="10" fill="#7dff6b" text-anchor="middle" font-family="'Press Start 2P'">START</text></g>
      ${nodes}
      <g><rect x="${bossX - 48}" y="${H / 2 - 48}" width="96" height="96" fill="${S.bossReady ? '#5a1020' : '#3a0010'}" stroke="${S.bossReady ? '#ffd23f' : '#ff2e63'}" stroke-width="${S.bossReady ? 10 : 7}">${S.bossReady ? '<animate attributeName="stroke-opacity" values="1;0.35;1" dur="1s" repeatCount="indefinite"/>' : ''}</rect><text x="${bossX}" y="${H / 2 + 18}" font-size="52" text-anchor="middle">👹</text><text x="${bossX}" y="${H / 2 + 72}" font-size="10" fill="${S.bossReady ? '#ffd23f' : '#ff2e63'}" text-anchor="middle" font-family="'Press Start 2P'">THE IG</text></g>
    </svg></div>
    ${renderPowerups(S)}</div>`;
}

// The roller vote: every cadet's card with their bonus and odds; votes show as avatars
function rollerVoteHtml(S, odds, pre) {
  return `<div class="rollvote">${S.party.map((p, i) => { if (isOut(S, i)) return ''; const o = odds(i);
    return `<div class="rv" style="--cc:${clsColor(p)}"><img src="${avatarOf(p)}"><div><div class="nm">${insignia(p)}${esc(rankName(p))}</div><div class="rvb">${esc(o.stat)} <b>${sign(o.bonus)}</b>${o.spec ? ' ★' : ''} · needs <b>${o.need}+</b> (${(21 - o.need) * 5}%)</div></div>${voteDots(S, pre + i)}</div>`; }).join('')}</div>`;
}
// Rest stop / supply depot: the options, with each cadet's vote shown as their avatar
function renderStop(S, c) {
  const rest = c.type === 'rest';
  // the BX has more options, so it gets a compact one-line header
  const head = rest || c.step !== 'choose' ? `<div style="text-align:center"><span style="font-size:90px">${rest ? '🏕️' : '🛒'}</span><div class="ptitle">${rest ? 'REST STOP' : 'BASE EXCHANGE (BX)'}</div>
    <div class="sub">${c.step === 'choose' ? 'Pick ONE: vote on your phone!' : ''}</div></div>`
    : `<div style="text-align:center"><div class="ptitle"><span style="font-size:44px;vertical-align:middle">🛒</span> BASE EXCHANGE (BX)</div><div class="sub">One purchase: vote on your phone!</div></div>`;
  if (c.step === 'train') return `<div class="titlescr">${head}<div class="ptitle" style="font-size:22px">📚 STUDY GUIDES: WHO STUDIES WHICH STAT?</div></div>`;
  if (c.step !== 'choose' && c.step !== 'who') return `<div class="titlescr">${head}<div class="ptitle" style="color:var(--good);font-size:24px">${esc(c.result || '')}</div>${renderPowerups(S)}</div>`;
  const opts = stopOptions();
  if (c.step === 'who') return `<div style="display:flex;flex-direction:column;gap:14px;height:100%;justify-content:center">${head}<div class="ptitle" style="text-align:center;font-size:22px">WHO PAYS? ${c.trade === 'favor' ? '(−2 loyalty, free loot spin)' : '(−1 loyalty, +3 🎯)'}</div>
    <div class="optgrid">${opts.map(o => `<div class="choice ${o.dis ? 'dim' : ''}" style="grid-template-columns:1fr;position:relative"><div class="ct">${mt(esc(o.label))}</div>${voteDots(S, o.key)}</div>`).join('')}</div></div>`;
  return `<div style="display:flex;flex-direction:column;gap:14px;height:100%;justify-content:center">${head}
    <div class="optgrid ${rest ? '' : 'bx'}">${opts.map(o => `<div class="choice ${o.dis ? 'dim' : ''}" style="grid-template-columns:1fr;position:relative"><div class="ct">${mt(esc(o.label))}</div>${voteDots(S, o.key)}</div>`).join('')}</div>${renderPowerups(S)}</div>`;
}

function renderNode(S) {
  const c = S.cur; if (!c) return '';
  if (c.type === 'rest' || c.type === 'depot') return renderStop(S, c);
  if (c.type === 'unknown') return `<div class="titlescr" style="padding-bottom:110px"><div style="font-size:100px">❓</div><div class="ptitle">UNKNOWN TERRITORY</div>${c.step === 'revealed' && c.mystery != null ? `<div class="ptitle" style="color:var(--accent)">${MYSTERY[c.mystery].name}</div>` : `<div class="sub">Anything can happen. The d6 decides:</div><div class="wheelpick">${MYSTERY.map((x, i) => `<span style="--c:${x.color}"><b>${i + 1}</b>${x.icon} ${x.name}</span>`).join('')}</div>`}</div>`;
  const m = curMission();
  const ce = c.type === 'crisisEvent';
  const hint = c.step === 'roll' ? (() => {
      const ch = c.spec.check, what = ch.stat === 'LOYB' ? `${npcLabel(S, 'B')}'s loyalty` : ch.stat || 'luck';
      if (!c.rollerLocked) return `<div class="rollbig">🗳️ WHO ROLLS ${esc(what)}? <span>vote on your phone 📱</span></div>${rollerVoteHtml(S, i => rollerOdds(S, i), 'r')}`;
      const p = rollPreview(), r = c.roller;
      const need = Math.min(20, Math.max(2, p.dc - p.total));
      return `<div class="rollbig">🎲 ${esc((rankName(S.party[r]) || '?').toUpperCase())} ROLLS ${esc(what)} ${sign(p.total)} · GOAL DIE <b>${need}+</b> <span>(${(21 - need) * 5}%)</span></div>`; })()
    : c.step === 'stars' ? `<div class="banner gold">🎤 DIALOGUE ENCOUNTER: ${c.lead != null ? `${esc(rankName(S.party[c.lead]).toUpperCase())} DOES THE TALKING!` : 'SPIN TO SEE WHO TALKS...'} The GM plays the other side.</div>` : '';
  let result = '';
  if (c.step === 'done') {
    if (c.rollRes) { const r = c.rollRes; result = `<div class="banner ${r.pass ? 'gold' : ''}">🎲 ${r.d20} → ${r.total} vs ${r.dc}: ${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED'}</div>`; }
    else if (c.stars) result = `<div class="banner gold">🎤 ${'⭐'.repeat(c.stars)}</div>`;
    else result = `<div class="banner blue">DECISION LOCKED IN</div>`;
  }
  return `<div class="mcard ${c.step === 'brief' ? '' : 'compact'}">
    <div class="mhead"><div class="ic">${m.badge ? ccBadge(64) : m.icon}</div><div><h2 style="${ce ? 'color:var(--bad)' : ''}">${ce ? '🚨 CRISIS EVENT: ' : c.type === 'elite' ? '💀 ELITE: ' : ''}${esc(m.title)}</h2><div class="sob">${objChips(m) ? `<span class="objlbl">TESTS</span>${objChips(m)}` : esc(m.sob)}</div></div></div>
    ${c.type === 'elite' ? '<div class="banner">💀 ELITE SCENARIO: every check +3 harder · positive effects doubled · guaranteed loot</div>' : ''}
    ${m.cc ? `<div class="banner gold">${ccBadge(26)} COMMANDER ENCOUNTER: ${esc(S.cc.toUpperCase())}</div>` : ''}
    ${c.step === 'brief' && arrowsHidden(S) ? '<div class="banner blue">🔍 COMPARTMENTED: no arrows. Decide on the facts.</div>' : ''}
    ${S.banner ? `<div class="banner ${S.banner.cls || ''}">${esc(S.banner.text)}</div>` : ''}
    <div class="situ">${esc(fill(S, m.text))}</div>
    ${ce ? `<div class="crisisloss">💀 LOST FOR GOOD: ${mt(esc(fill(S, m.loss || '')))}</div>${c.step === 'brief' ? '<div class="banner">⚠️ ONE MORE CRISIS EVENT = GAME OVER. Dig out without dropping another meter to zero.</div>' : ''}${m.help ? `<div class="helpline">💙 ${esc(CRISIS_HELP)}</div>` : ''}` : ''}
    ${hint}${renderPowerups(S)}
    <div class="choices" ${c.choice != null ? 'style="grid-template-columns:1fr"' : ''}>${m.choices.map((ch, i) => c.choice != null && c.choice !== i ? '' : `<div class="choice ${c.choice === i ? 'picked' : ''} ${ch.req && !gateOpen(ch.req) ? 'locked' : ''} ${ch.mic ? 'hasmic' : ''}">
      <div class="key">${'ABCD'[i]}</div><div><div class="ct">${esc(fill(S, ch.t))}</div>${ch.trap && benderTell(S) ? '<div class="req" style="color:var(--warn)">⚠️ SMELLS LIKE A SHORTCUT</div>' : ''}${ch.req ? `<div class="req">🔐 NEEDS ${ch.req.stat} +${ch.req.min}${gateOpen(ch.req) ? '' : ' · LOCKED'}</div>` : ''}
      ${c.step === 'done' && c.choice === i ? `<div class="arrows realres"><b>RESULT:</b> ${resultChips(S)}</div>` : !arrowsHidden(S) ? `<div class="arrows">${arrows(choiceShow(ch))}</div>` : ''}
      ${c.intel ? `<div class="intel">🔎 ${effHtml(specText(S, ch))}</div>` : ''}</div>
      ${ch.mic ? '<div class="micbadge">🎤 ACT IT OUT</div>' : ''}${ch.kind === 'check' || ch.check ? '<div class="dicebadge">🎲 ROLL</div>' : ''}${voteDots(S, i)}</div>`).join('')}</div>
    ${c.step === 'brief' ? `<div class="sub" style="font-size:22px">${c.type === 'spot' ? '🔦 One cadet decides alone · everyone else stays silent · ' : ''}🎤 ACT IT OUT = you play the scene · 🔐 = needs a stat · <span class="up">▲</span> raises · <span class="dn">▼</span> lowers · ❔ = depends</div>` : ''}
    ${result}</div>`;
}

function renderInject(S) {
  const inj = S.inject; if (!inj) return '';
  const who = S.actor && S.party[S.actor.slot] ? rankName(S.party[S.actor.slot]) : null;
  const pu = renderPowerups(S);
  if (inj.stage === 'trigger') return `<div class="titlescr" style="padding-bottom:110px"><div style="font-size:100px">📡</div><div class="ptitle">INJECT INCOMING...</div>
    <div class="whoroll">${who ? `🎲 ${esc(who.toUpperCase())}, ROLL THE d6 ON YOUR PHONE!` : 'Rolling the d6...'}</div>
    <div class="wheelpick">${INJECT_ORDER.map(t => `<span style="--c:${INJECT_WHEELS[t].color}"><b>${injectRange(t)}</b>${INJECT_WHEELS[t].icon} ${INJECT_WHEELS[t].name}</span>`).join('')}</div>${pu}</div>`;
  if (inj.stage === 'clear') return `<div class="titlescr"><div style="font-size:120px">📋</div><div class="ptitle" style="color:var(--good)">INJECT SKIPPED</div><div class="sub">Battle Rhythm kept the chaos away. For now.</div></div>`;
  if (inj.stage === 'murphy') { const w = INJECT_WHEELS[inj.filter]; return `<div class="titlescr"><div style="font-size:120px">${w.icon}</div><div class="ptitle" style="color:${w.color}">${w.name}</div>
    <div class="whoroll">${who ? `🎡 ${esc(who.toUpperCase())}, SPIN THE WHEEL ON YOUR PHONE!` : 'Spinning the wheel...'}</div>${pu}</div>`; }
  const m = MURPHY[inj.idx];
  const cls = m.type === 'good' ? 'good' : m.type === 'bad' ? 'bad' : '';
  if (inj.stage === 'tackle') { const r = S.party[inj.roller];
    if (!inj.rollerLocked) return `<div class="titlescr"><div class="bigcard bad"><div class="sectlbl">💪 TACKLE IT · ${m.tackle.stat} roll</div><h2 style="margin-top:10px">${esc(m.name)}</h2>
      <div class="bt tkbox"><div class="tkrow tkok">✅ PASS: no loss</div><div class="tkrow tkbad">❌ FAIL: ${tackleInfo(m).fail}</div></div></div>
      <div class="whoroll">🗳️ WHO ROLLS? <span class="ptsub">vote on your phone</span></div>${rollerVoteHtml(S, i => tackleOdds(S, m, i), 'r')}${pu}</div>`;
    return `<div class="titlescr"><div class="bigcard bad"><div class="sectlbl">💪 TACKLE IT</div><h2 style="margin-top:10px">${esc(m.name)}</h2>
      <div class="bt tkbox">${tackleRows(m, inj.roller)}</div></div>
      <div class="whoroll">🎲 ${esc(r ? rankName(r).toUpperCase() : '?')}, ROLL ON YOUR PHONE!</div>${pu}</div>`; }
  const vote = m.options && inj.stage === 'result' && !inj.blocked;
  return `<div class="titlescr injscr"><div class="bigcard ${cls}"><div class="sectlbl">${INJECT_WHEELS[m.type].icon} ${INJECT_WHEELS[m.type].name}</div><h2 style="margin-top:10px">${esc(m.name)}</h2>
    <div class="bt">${esc(fill(S, m.text || ''))}</div>${m.options ? '' : `<div class="bt injeff">${effLines(S, m.eff)}</div>`}
    ${inj.note ? `<div class="bt" style="color:var(--gold)">${esc(fill(S, inj.note))}</div>` : ''}</div>
    ${vote ? `<div class="whoroll" style="font-size:16px">✋ HOW DO YOU RESPOND? <span class="ptsub">vote on your phone</span></div>
      <div class="optgrid" style="width:100%;grid-template-columns:repeat(${m.options.length + (m.tackle ? 1 : 0)},1fr)">${m.options.map((o, i) => `<div class="choice" style="grid-template-columns:48px 1fr;position:relative"><div class="key">${'AB'[i] || i + 1}</div><div><div class="ct">${esc(fill(S, o.t))}</div><div class="arrows">${effLines(S, o.eff)}</div></div>${voteDots(S, i)}</div>`).join('')}
        ${m.tackle ? `<div class="choice" style="grid-template-columns:48px 1fr;position:relative"><div class="key">💪</div><div><div class="ct">💪 TACKLE IT · ${m.tackle.stat} roll</div>${tackleRows(m)}</div>${voteDots(S, m.options.length)}</div>` : ''}</div>` : ''}${pu}</div>`;
}

function renderLevel(S) {
  return `<div class="titlescr"><div class="logo" style="font-size:60px">LEVEL UP!</div>${teamTag(S) ? `<div class="ptitle" style="font-size:18px;color:var(--gold)">${esc(teamTag(S))}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(${S.party.length},1fr);gap:16px;width:100%">${S.party.map(p => `<div class="ccard ${p.up ? 'taken' : ''}" style="align-items:center;text-align:center">
      <img src="${avatarOf(p)}" style="width:80px;height:80px;image-rendering:pixelated"><h3>${insignia(p)}${esc(rankName(p))}</h3><div class="sub">${CLASS[p.cls].name}</div>
      ${CLASS[p.cls].ups.map(u => `<div class="ab" style="${p.up === u.id ? 'color:var(--gold)' : p.up ? 'opacity:.3' : ''}">${p.up === u.id ? '▶ ' : ''}<b>${esc(u.name)}</b>: ${mt(esc(u.text))}</div>`).join('')}</div>`).join('')}</div></div>`;
}

function renderBoss(S) {
  const Bs = S.boss; if (!Bs) return '';
  let center = '';
  if (Bs.stage === 'vouch') {
    const v = Bs.vouchCurrent || (Bs.vouches || [])[Bs.vouchIdx], npc = v && v.slot ? S.npcs.find(n => n.slot === v.slot) : null;
    center = `<div class="box vouchbox"><b>🤝 SUPPORT ARRIVES</b>${v ? `<div class="vouchscene"><img class="vouchactor" src="${npc ? avatar(npc.name + npc.rank) : avatar(S.cc)}"><span class="vouchimpact">💥</span><span class="vouchtarget">👹</span></div><h3>${esc(Bs.vouchCurrent ? Bs.vouchCurrent.name : v.name)}</h3><div>${esc(Bs.vouchCurrent ? Bs.vouchCurrent.why : 'Ready to step in')}</div>` : ''}<small>${Bs.vouchKO ? 'The Inspector General is down.' : 'Watch each ally and commander take their turn.'}</small></div>`;
  }
  if (Bs.stage === 'intro') center = `<div class="box" style="font-size:28px">The Inspector General has arrived. Clear the integrity audit, then choose one squadron action together each round.<br><br><b>🗡️ TEAM ATTACK</b>: one d20 from your strongest available cadet<br><b>🛡️ TEAM DEFEND</b>: block 2 of the IG's attack</div>`;
  if (Bs.atk && Bs.stage !== 'done') center += `<div class="tele">🗡️ IG ATTACK: ${esc(Bs.atk.name)} · ${meterTag(Bs.atk.k, `−${Bs.atk.n}`)} at the end of the round<br><span style="font-size:11px;color:#fff">each 🛡️ Defend blocks 2</span></div>`;
  if (Bs.stage === 'hotseat' && !Bs.p2.who) center += `<div class="box" style="font-size:28px">🎲 Every active cadet rolls a d20. The LOWEST active roll faces one question for ${esc(UNITS.find(u => u.id === S.unit).sq)}...</div>`;
  else if (Bs.stage === 'hotseat') center += `<div class="box">${Bs.p2.who.map((w, j) => `<div style="margin:6px 0"><b style="color:var(--gold)">${esc(rankName(S.party[w]))}:</b> "${esc(Bs.p2.q[j])}" ${Bs.p2.stars[j] ? '⭐'.repeat(Bs.p2.stars[j]) : ''}</div>`).join('')}</div>`;
  if (Bs.stage === 'act') center += `<div class="box" style="font-size:24px">🤝 TEAM DECISION · Attack ${Object.values(Bs.votes).filter(v => v === 'press').length} · Defend ${Object.values(Bs.votes).filter(v => v === 'defend').length} · ${Bs.teamAction ? `GM locked ${Bs.teamAction.toUpperCase()}` : 'vote on your phone'}<br>Press target ${examDC(Bs)}${Bs.adverse ? ' · −1 every roll (Adverse Finding)' : ''}</div>`;
  return `<div class="boss">
    <div class="bossart ${Bs.hp <= 0 ? 'defeated' : ''}"><canvas id="bossCv" width="32" height="32"></canvas>${Bs.hp <= 0 ? '<div class="banner gold">💀 IG DEFEATED</div>' : ''}${teamTag(S) ? `<div class="sub" style="color:var(--gold)">vs ${esc(teamTag(S))}</div>` : ''}<div class="ptitle" style="font-size:16px;color:var(--bad);text-shadow:none">${BOSS.name}</div><div class="sub">${BOSS.title}</div>
      <div class="hpbar"><i style="width:${Math.max(0, Math.min(100, Bs.hp / Bs.max * 100))}%"></i></div><div class="hptxt">HP ${Bs.hp} / ${Bs.max}</div>
      ${Bs.adverse ? '<div class="banner" style="margin-top:8px">🚨 ADVERSE FINDING</div>' : ''}</div>
    <div><div class="phases">${BOSS_ROUNDS.map((r, i) => `<span class="${Bs.round === i + 1 && Bs.stage !== 'done' ? 'on' : Bs.round > i + 1 || Bs.stage === 'done' ? 'done' : ''}">${i + 1}. ${r.name}</span>`).join('')}</div>
      ${center}
      ${Bs.result ? `<div class="banner gold" style="font-size:20px">${esc(Bs.result)}</div>` : ''}
      <div class="blog">${Bs.log.slice(-5).map(l => `<div>${esc(l)}</div>`).join('')}</div></div>
    <div class="boss-support"><b>🤝 VOUCHING FOR THE FLIGHT</b>${(Bs.supporters || []).map(v => `<span class="supporter">${v.kind === 'cc' ? '🎖️' : '🤝'} ${esc(v.name)}</span>`).join('') || '<span class="supporter">No allies or commander support</span>'}</div></div>`;
}

// The grade is built up: each score line ticks in, then the total, a drumroll, and the letter slams down.
const REVEAL = { step: 700, drum: 2400 };
function renderResults(S) {
  const f = S.final; if (!f) return '';
  const g = f.grade, n = f.parts.length;
  const el = f.at ? Date.now() - f.at : 1e9;
  const totalAt = n * REVEAL.step + 400, gradeAt = totalAt + REVEAL.drum;
  const shown = Math.min(n, Math.floor(el / REVEAL.step)), showTotal = el >= totalAt, showGrade = el >= gradeAt;
  const stage = showGrade ? n + 2 : showTotal ? n + 1 : shown;
  if (P.revealKey !== f.at) { P.revealKey = f.at; P.revealStage = el > gradeAt + 2000 ? n + 2 : 0; }
  if (stage > P.revealStage) {
    P.revealStage = stage;
    SFX.play(showGrade ? (S.gameOver ? 'over' : ['S', 'A'].includes(g.g) ? 'crit' : g.g === 'B' ? 'level' : 'bad') : showTotal ? 'alarm' : 'tick');
  }
  if (!showGrade) { clearTimeout(P.revT); P.revT = setTimeout(render, 120); }
  return `<div class="resgrid">
    <div style="text-align:center">${showGrade
      ? `<div class="grade slam" style="color:${g.color}">${g.g}</div><div class="ptitle" style="font-size:20px;color:${g.color}">${esc(g.title)}</div>`
      : `<div class="grade" style="color:var(--dim)">${showTotal ? '<span class="blink">?</span>' : '?'}</div><div class="ptitle" style="font-size:16px;color:var(--dim)">${showTotal ? 'THE BOARD IS DELIBERATING...' : 'TALLYING YOUR RECORD...'}</div>`}</div>
    <div>${showGrade ? `<div class="box" style="font-size:28px;font-style:italic">OPR STRAT: ${esc(g.strat)}</div>` : ''}
      ${S.gameOver ? `<div class="banner" style="margin-top:12px">${esc(S.gameOverReasons.join('; '))}</div>` : ''}
      <div class="brk" style="margin-top:16px">${f.parts.slice(0, shown).map(p => `<span class="tickin">${esc(p[0])}</span><b class="tickin">${p[1]}</b>`).join('')}
        ${showTotal ? `<span class="tickin" style="color:var(--gold)">TOTAL SCORE</span><b class="tickin" style="color:var(--gold);font-size:22px">${f.total}</b>` : ''}</div>
      ${showGrade ? `<div class="achs">${S.ach.map(id => `<span>${ACH[id].icon} ${esc(ACH[id].name)}</span>`).join('') || '<span style="opacity:.5">No achievements</span>'}</div>` : ''}
      ${S.callsign ? `<div class="ptitle" style="font-size:18px;margin-top:14px">TEAM: ${esc(S.callsign.toUpperCase())}</div>` : ''}</div></div>`;
}

function renderBoardOverlay() {
  let rank = 0;
  const rows = P.board.slice(0, 12).map(b => { const ko = b.gameOver; const r = ko ? '💀' : ++rank; return `<tr class="${ko ? 'ko' : rank <= 3 ? 'top' : ''}"><td class="rk">${r}</td><td>${b.patch ? b.patch + ' ' : ''}${esc(b.callsign)}<div class="lbc">${esc(b.cadets || '')}</div></td><td>${esc(b.unit)}</td><td>${esc(b.grade)}</td><td>${b.score}</td><td>${b.ach}🏅</td><td>${!ko && rank <= 3 ? '⭐ EXTRA CREDIT' : ''}</td></tr>`; }).join('');
  return `<div class="ovl" id="boardOv" style="z-index:40"><div class="box" style="width:min(1200px,92vw)"><div class="ptitle" style="text-align:center;margin-bottom:14px">🏆 HIGH SCORES 🏆</div>
    <table class="lb"><tr><th>#</th><th>TEAM</th><th>UNIT</th><th>GRADE</th><th>SCORE</th><th>ACH</th><th></th></tr>${rows || '<tr><td colspan="7">No runs yet. Be the first!</td></tr>'}</table></div></div>`;
}

function renderDebrief(S) {
  const dv = S.debrief;
  if (dv.view === 'timeline') {
    return `<div class="real"><h2>Your run, replayed</h2><div class="sub">Every choice, roll, and inject from today. Real units don't get a replay.</div>
      <div class="tl">${S.log.map((l, i) => `<div class="ev ${dv.spot === i ? 'spot' : dv.spot != null ? 'dimmed' : ''}"><b>Node ${l.n} · ${esc(l.t)}</b>${esc(l.d)}</div>`).join('')}</div></div>`;
  }
  if (dv.view === 'objectives') return `<div class="real"><h2>What today tested</h2><div class="sub">The five practicum objectives, and the moments in YOUR run that tested each one.</div>
    <div class="objdeb">${OBJECTIVES.map(o => { const ev = (S.objLog || []).filter(e => e.obj.includes(o.id)); return `<div class="od"><h3>${o.icon} ${esc(o.name)}</h3><div class="ot">${esc(o.text)}</div>
      ${ev.length ? `<ul>${ev.map(e => `<li><b>Stop ${e.n} · ${esc(e.title)}</b>${e.choice ? `<br>"${esc(e.choice)}"` : ''}</li>`).join('')}</ul>` : '<div class="ot" style="opacity:.6">Not tested in this run. Talk through where it shows up in your future job.</div>'}</div>`; }).join('')}</div></div>`;
  return `<div class="real"><h2>Back to reality</h2><div class="sub">The game is over. Here's what each piece actually was.</div>
    <table class="dec">${DECODER.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>`;
}
