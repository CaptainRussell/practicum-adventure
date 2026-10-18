/* =====================================================================
   PRACTICUM ADVENTURE - player screen (projector)
   Renders whatever state the GM window sends, and plays the one-shot
   effects (wheels, rolls, toasts, sounds) in order through a queue so
   two things never fight for the screen.
   ===================================================================== */
const P = { S: null, board: [], seen: new Set(), seenStates: new Set(), got: false };

function initPlayer() {
  document.body.className = 'player';
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
  window.addEventListener('message', e => onMsg(e.data));
  if (bc) bc.onmessage = e => onMsg(e.data);
  // Keep saying hello: if the GM window is reloaded it re-learns where the
  // player screen is, and 'need' asks for a full state when we have none yet.
  const hello = () => {
    const msg = { type: 'hello', need: !P.got };
    try { window.opener && window.opener.postMessage(msg, '*'); } catch (e) { }
    try { bc && bc.postMessage(msg); } catch (e) { }
    setTimeout(hello, P.got ? 4000 : 1500);
  };
  hello();
  setInterval(tickTimer, 250);
  try { document.fonts.load('20px "Press Start 2P"'); } catch (e) { }
  $('#app').innerHTML = `<div class="titlescr"><div class="sub">Waiting for Captain Russell’s console...</div></div>`;
}

function onMsg(d) {
  if (!d || d.type !== 'state') return;
  // The same packet can arrive through both postMessage and BroadcastChannel.
  if (d.stateId) {
    if (P.seenStates.has(d.stateId)) return;
    P.seenStates.add(d.stateId);
    if (P.seenStates.size > 512) P.seenStates.delete(P.seenStates.values().next().value);
  }
  P.got = true;
  P.S = d.S; P.board = d.board || []; P.join = d.join || null; P.usedPatches = P.board.map(r => r.patchKey).filter(Boolean);
  S = d.S; // shared helpers (available(), curMission(), ccHook()...) read the global S
  SFX.muted = !!P.S.muted;
  render();
  (d.fx || []).forEach(f => { if (P.seen.has(f.id)) return; P.seen.add(f.id); if (f.k === 'gmNext') advanceHeldFx(); else playFx(f); });
}

/* ---------------- fx queue ---------------- */
const Q = []; let qBusy = false, heldClean = null, queueEpoch = 0;
function enqueue(fn, dur) { Q.push([fn, dur]); if (!qBusy) nextQ(); }
function nextQ() {
  const it = Q.shift(); if (!it) { qBusy = false; return; }
  qBusy = true; let clean = null;
  try { clean = it[0](); } catch (e) { console.error(e); }
  // A null duration holds the queue until the overlay is explicitly dismissed.
  if (it[1] == null) { heldClean = clean; return; }
  const epoch = queueEpoch;
  setTimeout(() => { if (epoch !== queueEpoch) return; try { typeof clean === 'function' && clean(); } catch (e) { } nextQ(); }, it[1]);
}
function advanceHeldFx() {
  if (!qBusy || !heldClean) return;
  try { heldClean(); } catch (e) { }
  heldClean = null; qBusy = false; nextQ();
}
function overlay(html, cls = '', clickDismiss = true) {
  const d = document.createElement('div');
  d.className = 'ovl ' + cls; d.innerHTML = html;
  const cleanup = () => { d.querySelectorAll('.die').forEach(el => el._cancelRoll?.()); d.remove(); };
  if (clickDismiss) d.onclick = cleanup;
  document.body.appendChild(d);
  return cleanup;
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
    case 'resetFx':
      queueEpoch++; Q.length = 0;
      document.querySelectorAll('.hotseat-roll-fx').forEach(el => { el.querySelectorAll('.die').forEach(d => d._cancelRoll?.()); el.remove(); });
      if (typeof heldClean === 'function') heldClean();
      heldClean = null; qBusy = false;
      document.querySelectorAll('.ovl').forEach(el => el.remove());
      P.bossVisualRoot = null; P.bossPhase = null; render();
      return;
    case 'sfx': return enqueue(() => SFX.play(f.n), 0);
    case 'sfxLater': return enqueue(() => SFX.play(f.n), 0);
    case 'wheel': return enqueue(() => spinOverlay(f), null);
    case 'deltas': if (P.S?.phase === 'boss') return; return enqueue(() => showDeltas(f.d), 0);
    case 'toast': return enqueue(() => showToast(f.icon, f.title, f.text), 0);
    case 'ach': return enqueue(() => showAch(ACH[f.aid]), 0);
    case 'dice': return enqueue(() => diceOverlay(f), null);
    case 'multiDice': return enqueue(() => multiDiceOverlay(f), null);
    case 'hotSeatDie': return hotSeatDie(f);
    case 'bossIntegrity': return enqueue(() => integrityStrike(f), null);
    case 'bossCombat': return enqueue(() => f.integrityPass ? approvedAuditAnimation(f) : combatAnimation(f, () => diceSettled(f)), null);
    case 'flightHit': return enqueue(() => {
      const patch = $('.battle-flight-patch');
      if (patch) { patch.classList.remove('taking-hit', 'blocking-hit'); void patch.offsetWidth; patch.classList.add(f.damage ? 'taking-hit' : 'blocking-hit'); }
      showToast(f.damage ? '💥' : '🛡️', f.name, f.damage ? `${METER[f.meter].label} −${f.damage}${f.blocked ? ` · ${f.blocked} blocked` : ''}` : 'The flight blocks the attack.');
    }, 900);
    case 'loyDelta': return enqueue(() => showLoy(f), 0);
    case 'levelDone': return enqueue(() => showToast('⬆️', 'UPGRADES LOCKED IN', 'Back to the map'), 0);
    case 'big': return enqueue(() => overlay(`<div class="bigcard ${f.cls || ''}"><div style="font-size:70px">${f.icon || ''}</div><h2>${esc(f.title)}</h2><div class="bt">${esc(f.text)}</div></div>`), 3600);
    case 'critical': return enqueue(() => {
      const d = overlay(`<div class="bigcard ${f.cls || 'bad'}"><div style="font-size:70px">${f.icon || '🚨'}</div><h2>${esc(f.title)}</h2><div class="bt">${esc(f.text)}</div><div class="bt" style="margin-top:20px;font-size:14px;color:var(--gold)">CLICK TO CONTINUE</div></div>`);
      d.onclick = () => { d.remove(); nextQ(); };
    }, null);
    case 'roll': return enqueue(() => rollOverlay(f), null);
    case 'stars': return enqueue(() => overlay(`<div class="bigcard good"><h2>${esc(f.who)}</h2><div class="stars">${'⭐'.repeat(f.n)}${'<span style="opacity:.2">⭐</span>'.repeat(3 - f.n)}</div><div class="verdict pass">${['', 'ROUGH', 'SOLID', 'NAILED IT!'][f.n]}</div></div>`), 3000);
    case 'flash': return enqueue(() => { document.body.classList.add('flashred'); return () => document.body.classList.remove('flashred'); }, 1900);
    case 'bossIntro': return enqueue(() => overlay(`<div class="ptitle blink" style="color:var(--bad);font-size:26px">⚠ WARNING ⚠</div><div class="bigcard bad"><canvas id="bossIntroCv" width="32" height="32" style="width:220px;height:220px;image-rendering:pixelated"></canvas><h2>${BOSS.name}</h2><div class="bt">${BOSS.title}</div></div><div class="ptitle" style="font-size:16px">INSPECTION IN PROGRESS</div>`, '') && (drawBoss($('#bossIntroCv')), () => document.querySelectorAll('.ovl').forEach(o => o.remove())), 4200);
    case 'bossHit': return enqueue(() => {
      const b = $('.bossart'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      const patch = $('.battle-flight-patch'); if (patch) { patch.classList.remove('dealing-hit'); void patch.offsetWidth; patch.classList.add('dealing-hit'); }
    }, 650);
    case 'gameOver': return enqueue(() => { SFX.play('over'); return overlay(`<div class="bigcard bad" style="max-width:1100px"><div style="font-size:90px">💀</div><h2 style="font-size:44px">GAME OVER</h2><div class="bt" style="font-family:var(--pixel);font-size:16px;line-height:1.6;color:var(--bad)">${esc(GAME_OVER_TEXT)}</div><div class="bt">${f.kind === 'crisis' ? '' : 'The Inspector General found: '}${esc(f.reasons.join('; '))}</div></div>`); }, 6500);
    case 'powerdown': return enqueue(() => { const d = document.createElement('div'); d.className = 'powerdown'; document.body.appendChild(d); return () => d.remove(); }, 1500);
    case 'results': return;
    case 'injectResult': return;
  }
}

// These rolls run independently: every phone owns its own die, with no shared actor hold.
function hotSeatDie(f) {
  const d = document.createElement('div');
  d.className = 'hotseat-roll-fx'; d.dataset.slot = f.i; d.style.setProperty('--slot', f.i);
  const player = P.S?.party[f.i];
  d.innerHTML = `${rollIdentity(player, f.name)}${dieHtml(20, '?')}<small>HOT SEAT · d20</small>`;
  const arena = document.querySelector('.battle-stage .combat-arena');
  arena?.closest('.battle-stage').classList.add('is-hotseat-rolling');
  (arena || document.body).appendChild(d); prepareDice(d);
  tumble(d.querySelector('.die'), 20, f.v, 1800, () => {
    SFX.play('good');
    setTimeout(() => {
      if (!d.isConnected) return;
      d.classList.add('settled');
      diceSettled(f);
    }, 650);
  });
}

function approvedAuditAnimation(f) {
  let scanCleanup = null, attackCleanup = null, approvalPause = null, stopped = false;
  scanCleanup = integrityStrike({ ...f, passed: true }, () => {
    if (stopped) return;
    // Hold the approval so the audience can read it before the team advances.
    approvalPause = setTimeout(() => {
      if (stopped) return;
      scanCleanup?.(true); scanCleanup = null;
      attackCleanup = combatAnimation(f, () => diceSettled(f));
    }, 1200);
  });
  return () => { stopped = true; clearTimeout(approvalPause); scanCleanup?.(); attackCleanup?.(); };
}
function integrityStrike(f, onApproved) {
  const root = document.querySelector('.battle-stage');
  if (!root) { if (f.passed) onApproved?.(); else diceSettled(f); return () => {}; }
  const timers = [], animations = [], pieces = [];
  const later = (fn, ms) => timers.push(setTimeout(() => { if (root.isConnected) fn(); }, ms));
  P.bossVisualRoot = root; root.classList.add('is-animating');
  root.classList.toggle('combat-super', !f.passed); root.classList.toggle('integrity-pass-scene', !!f.passed);
  animateBossPhase(root, 2);
  const title = root.querySelector('.combat-action-title'); title.textContent = '📋 INTEGRITY SCAN';
  root.querySelector('.combat-action-actor').textContent = BOSS.name;
  showCombatNarration(root, '📋 The IG examines the flight’s record.');
  const patch = root.querySelector('.combat-patch'), arena = root.querySelector('.combat-arena'), ig = root.querySelector('.combat-ig');
  const create = (cls, html, parent = arena) => { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; parent.appendChild(el); pieces.push(el); return el; };
  const clipboard = create('integrity-audit-clipboard', '📋', ig);
  animations.push(clipboard.animate([{ opacity: 0, transform: 'translateY(30px) rotate(15deg)' }, { opacity: 1, transform: 'translateY(-20px) rotate(-8deg)' }], { duration: 650, fill: 'forwards', easing: 'ease-out' }));
  SFX.play('alarm');
  later(() => {
    const a = arena.getBoundingClientRect(), p = patch.getBoundingClientRect();
    const scan = create('integrity-audit-scan', '');
    Object.assign(scan.style, { left: `${p.left-a.left}px`, top: `${p.top-a.top}px`, width: `${p.width}px` });
    const motion = scan.animate([{ opacity: 0, transform: 'translateY(0)' }, { opacity: 1, offset: .1 }, { opacity: 1, transform: `translateY(${p.height}px)`, offset: .9 }, { opacity: 0, transform: `translateY(${p.height}px)` }], { duration: 1200, fill: 'forwards', easing: 'linear' });
    motion.onfinish = () => scan.remove(); animations.push(motion);
  }, 500);
  const finding = (f.reasons || []).join('; ');
  later(() => { title.textContent = f.passed ? '✅ NO FINDINGS' : '🔍 VIOLATION FOUND'; showCombatNarration(root, f.passed ? '✅ No integrity findings.' : `🔍 ${finding}`); SFX.play(f.passed ? 'good' : 'bad'); }, 1750);
  later(() => {
    title.textContent = f.passed ? '✅ INTEGRITY APPROVED' : '🚨 INTEGRITY FAILURE';
    showCombatNarration(root, f.passed ? '✅ Integrity passed. The flight’s record is clean.' : `🚨 ${finding} · The flight is relieved of command.`);
    const a = arena.getBoundingClientRect(), p = patch.getBoundingClientRect();
    const stamp = create(`integrity-audit-stamp${f.passed ? ' approved' : ''}`, f.passed ? '<b>✅<br>APPROVED</b>' : '<b>INTEGRITY<br>FAILURE</b>');
    Object.assign(stamp.style, { left: `${p.left+p.width/2-a.left}px`, top: `${p.top+p.height/2-a.top}px` });
    animations.push(stamp.animate([{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-9deg) scale(2.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-9deg) scale(1)' }], { duration: 300, fill: 'forwards', easing: 'cubic-bezier(.1,.8,.2,1)' }));
    if (f.passed) {
      animations.push(patch.animate([{ filter: 'none' }, { filter: 'brightness(1.3) drop-shadow(0 0 20px #94ff76)' }, { filter: 'none' }], { duration: 750 }));
      SFX.play('good'); return;
    }
    const cracks = create('integrity-audit-cracks', '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M0 16 12 16 7 27 20 33M100 22 87 29 93 38 80 45M8 100 13 86 23 91 29 78M100 83 87 78 92 65 79 59"/></svg>');
    Object.assign(cracks.style, { left: `${p.left-a.left}px`, top: `${p.top-a.top}px`, width: `${p.width}px`, height: `${p.height}px` });
    animations.push(patch.animate([{ filter: 'grayscale(0)', opacity: 1 }, { filter: 'grayscale(1)', opacity: .35 }], { duration: 1800, fill: 'forwards' }));
    animations.push(root.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 350 }));
    SFX.play('over');
  }, 2500);
  later(() => f.passed ? onApproved?.() : diceSettled(f), f.passed ? 3400 : 4500);
  return (resume = false) => {
    timers.forEach(clearTimeout); animations.forEach(a => a.cancel()); pieces.forEach(el => el.remove());
    root.classList.remove('is-animating', 'combat-super', 'integrity-pass-scene');
    if (resume) return;
    if (P.bossVisualRoot === root) P.bossVisualRoot = null;
    if (P.S?.phase === 'boss') render();
  };
}

// Every combat action uses the same two actors and one impact moment.
// The engine outcome is authoritative; the displayed values change at contact.
function setCombatHP(root, hp, max, deferDefeat = false) {
  root.querySelector('.combat-ig').classList.toggle('combat-ig-defeated', hp <= 0 && !deferDefeat);
  const value = root.querySelector('.combat-hp'), bar = root.querySelector('.combat-ig-hp');
  value.textContent = hp; value.classList.toggle('over-base', hp > max);
  bar.classList.toggle('bonus-hp', hp > max);
  bar.querySelector('i').style.width = `${Math.max(0, Math.min(100, hp / max * 100))}%`;
}
function showCombatNarration(root, text) {
  root._combatNarration = text;
  const pane = root.closest('.battle')?.querySelector('.battle-details');
  if (pane) pane.innerHTML = `<p class="boss-snippet">${combatText(text)}</p>`;
}
function combatIdentities(state = P.S) {
  return [
    ...(state?.party || []).filter(p => p.name).map(p => ({ full: rankName(p), name: p.name, rank: rankOf(p) })),
    ...(state?.npcs || []).map(n => ({ full: `${n.rank} ${n.name}`, name: n.name, rank: n.rank })),
    ...(state?.cc ? [{ full: state.cc, name: commanderSurname(state), rank: commanderRank(state) }] : []),
    { full: BOSS.name, name: 'Cacic', rank: 'Lt Col' }
  ];
}
function combatLabel(name, state = P.S) {
  const person = combatIdentities(state).find(p => p.full === name);
  return person ? `<span class="combat-identity">${insignia(person.rank, 22)} ${esc(person.name.trim())}</span>` : esc(name);
}
function combatText(text) {
  let html = igText(text);
  combatIdentities().sort((a,b) => b.full.length - a.full.length).forEach(p => { html = html.replaceAll(esc(p.full), combatLabel(p.full)); });
  return html;
}
function combatAnimation(f, done) {
  const noStrike = ['defend', 'boost', 'audit'].includes(f.side);
  const chargeMs = bossReadinessChargeMs(f);
  const root = document.querySelector('.battle-stage'), timers = [], animations = [], transientNodes = [];
  if (!root) { done?.(); return () => {}; }
  P.bossVisualRoot = root;
  if (f.stage === 'vouch') {
    root.querySelector('.combat-support-lineup')?.remove();
    const holder = document.createElement('template'); holder.innerHTML = renderCombatSupport(f.supportLineup || []);
    if (holder.content.firstElementChild) root.querySelector('.combat-arena').before(holder.content.firstElementChild);
  }
  root._combatMeters = { ...(f.metersBefore || P.S.meters) };
  const startingMeters = root.querySelector('.combat-team-meters');
  if (startingMeters) startingMeters.outerHTML = renderCombatMeters({ ...P.S, meters: root._combatMeters });
  if (f.stage) {
    const phase = f.round ? f.round + 2 : f.stage === 'opening' ? 0 : f.stage === 'vouch' ? 1 : 2;
    animateBossPhase(root, phase);
  }
  root.classList.add('is-animating');
  root.classList.toggle('combat-super', !!f.fatal);
  root.querySelector('.combat-action-title').textContent = f.label;
  root.querySelector('.combat-action-actor').innerHTML = combatLabel(f.actor || '');
  showCombatNarration(root, f.fatal ? f.reasons.join('; ') : f.side === 'defend' ? '🛡️ The flight raises its guard to reduce the next IG attack.' : f.side === 'boost' ? 'The Inspector General gains bonus HP.' : f.side === 'audit' ? '✅ Integrity check passed.' : '');
  setCombatHP(root, f.hpBefore ?? P.S.boss?.hp, f.max ?? P.S.boss?.max);
  const later = (fn, ms) => timers.push(setTimeout(() => { if (root.isConnected) fn(); }, ms));
  drawBoss(root.querySelector('canvas'));
  const flight = root.querySelector('.combat-flight'), ig = root.querySelector('.combat-ig');
  // Block has already been consumed in engine state; preserve its visual for
  // the whole incoming attack rather than waiting until the impact to show it.
  if (f.side === 'ig' && f.blocked) flight.querySelector('.combat-shield').classList.add('visible');
  let person = null, reusePerson = false;
  if (f.side === 'team' && (f.attackers?.length || f.portrait)) {
    person = f.reuseHotSeat ? root.querySelector('.hotseat-speaker') : null;
    reusePerson = !!person;
    if (!reusePerson) {
    person = document.createElement('div'); person.className = 'combat-person';
    const portrait = (p, name) => `<img src="${p.av != null ? presetAvatar(p.av, p.uni, p.hair) : avatar(p.seed)}" alt="${esc(name)}"><b>${combatLabel(name)}</b>`;
    if (f.attackers?.length) {
      person.classList.add('combat-team-strike');
      person.innerHTML = f.attackers.map(a => `<div class="combat-team-member">${portrait(a.portrait, a.name)}</div>`).join('');
    } else person.innerHTML = portrait(f.portrait, f.actor);
    root.querySelector('.combat-arena').appendChild(person);
    animations.push(person.animate([{ opacity: 0, scale: .65 }, { opacity: 1, scale: 1 }], { duration: 200, fill: 'forwards', easing: 'ease-out' }));
    }
    root.querySelector('.combat-action-actor').textContent = '';
  }
  if (chargeMs && person) {
    root.querySelector('.combat-action-title').textContent = 'READINESS POWER-UP';
    showCombatNarration(root, '⚡ Each meter at 5+ powers up the team: +2 attack damage.');
    f.chargeMeters.forEach((key, index) => later(() => {
      const meter = root.querySelectorAll('.combat-team-meters .meter')[METERS.findIndex(m => m.k === key)];
      if (!meter) return;
      const m = METER[key], arena = root.querySelector('.combat-arena'), a = arena.getBoundingClientRect();
      animations.push(meter.animate([
        { filter: 'brightness(1)', boxShadow: '0 0 0 transparent' },
        { filter: 'brightness(1.8)', boxShadow: `0 0 18px ${m.color}`, offset: .3 },
        { filter: 'brightness(1)', boxShadow: '0 0 0 transparent' }
      ], { duration: 1100, easing: 'ease-out' }));
      const team = person.getBoundingClientRect();
      const buff = document.createElement('div'); buff.className = 'combat-readiness-buff';
      buff.innerHTML = `<span>${m.icon}</span><b>+2 DMG</b>`;
      buff.style.left = `${team.left + team.width / 2 - a.left}px`;
      buff.style.top = `${Math.max(8, team.top - a.top - 100)}px`;
      arena.appendChild(buff); transientNodes.push(buff);
      const power = buff.animate([
        { transform: 'translateX(-50%) scale(.25)', opacity: 0 },
        { transform: 'translateX(-50%) scale(1.12)', opacity: 1, offset: .22 },
        { transform: 'translateX(-50%) translateY(-5px) scale(1)', opacity: 1, offset: .8 },
        { transform: 'translateX(-50%) translateY(-12px) scale(1)', opacity: 0 }
      ], { duration: 1100, fill: 'forwards', easing: 'ease-out' });
      power.onfinish = () => buff.remove(); animations.push(power);
      person.querySelectorAll('img').forEach(sprite => {
        animations.push(sprite.animate([{ filter: 'brightness(1)' }, { filter: `brightness(1.8) drop-shadow(0 0 12px ${m.color})` }, { filter: 'brightness(1)' }], { duration: 1100 }));
      });
    }, 200 + index * 1100));
    later(() => { root.querySelector('.combat-action-title').textContent = f.label; }, chargeMs);
  }
  if (f.side === 'boost') {
    const eye = document.createElement('div');
    transientNodes.push(eye);
    eye.className = 'combat-heal-eye';
    if (f.portrait) {
      const p = f.portrait;
      eye.classList.add('combat-heal-portrait');
      eye.innerHTML = `<img src="${p.av != null ? presetAvatar(p.av, p.uni, p.hair) : avatar(p.seed)}" alt="${esc(f.actor)}">`;
    } else eye.textContent = f.boostIcon || '👁️';
    root.querySelector('.combat-arena').appendChild(eye);
    const sparks = document.createElement('div'); sparks.className = 'combat-heal-sparks';
    transientNodes.push(sparks);
    sparks.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const angle = i * Math.PI / 4;
      return `<i style="--dx:${Math.round(Math.cos(angle) * 105)}px;--dy:${Math.round(Math.sin(angle) * 90)}px;--delay:${i * 35}ms">✦</i>`;
    }).join('');
    ig.appendChild(sparks);
    later(() => {
      const start = eye.getBoundingClientRect(), destination = ig.querySelector('canvas').getBoundingClientRect();
      const dx = destination.left + destination.width / 2 - start.left - start.width / 2;
      const dy = destination.top + destination.height / 2 - start.top - start.height / 2;
      const eyeFlight = eye.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * .6}px,${dy * .3}px) scale(1.2)`, opacity: 1, offset: .6 },
        { transform: `translate(${dx}px,${dy}px) scale(.15)`, opacity: 0 }
      ], { duration: 620, easing: 'ease-in', fill: 'forwards' });
      eyeFlight.onfinish = () => eye.remove();
      animations.push(eyeFlight);
    }, 200);
  }
  const attacker = f.side === 'ig' ? ig : person, defender = f.side === 'ig' ? flight : ig;
  later(() => {
    if (noStrike || !attacker) return;
    if (f.projectile) {
      const arena = root.querySelector('.combat-arena'), bounds = arena.getBoundingClientRect();
      const source = (person?.querySelector('img') || flight.querySelector('.combat-patch')).getBoundingClientRect();
      const destination = ig.querySelector('canvas').getBoundingClientRect();
      const projectile = document.createElement('div'); projectile.className = 'combat-projectile'; projectile.textContent = f.projectile;
      projectile.style.left = `${source.left + source.width / 2 - bounds.left}px`;
      projectile.style.top = `${source.top + source.height / 2 - bounds.top}px`;
      arena.appendChild(projectile); transientNodes.push(projectile);
      const dx = destination.left + destination.width / 2 - source.left - source.width / 2;
      const dy = destination.top + destination.height / 2 - source.top - source.height / 2;
      const thrown = projectile.animate([
        { transform: 'translate(-50%,-50%) rotate(-20deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * .5}px),calc(-50% + ${dy * .5 - 70}px)) rotate(180deg)`, opacity: 1, offset: .5 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(380deg)`, opacity: 1, offset: .95 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(400deg) scale(.6)`, opacity: 0 }
      ], { duration: 620, fill: 'forwards', easing: 'linear' });
      thrown.onfinish = () => projectile.remove(); animations.push(thrown); return;
    }
    const a = attacker.getBoundingClientRect(), d = defender.getBoundingClientRect();
    const dx = f.side === 'ig' ? d.right - a.left - 20 : d.left - a.right + 20;
    animations.push(attacker.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px) scale(${f.fatal ? 1.3 : 1.08})`, offset: .45 }, { transform: `translateX(${dx}px)`, offset: .6 }, { transform: 'translateX(0)' }], { duration: 1300, easing: 'ease-in-out' }));
  }, 200 + chargeMs);
  later(() => {
    let text = '', description = '';
    const target = ['defend', 'audit'].includes(f.side) ? flight : f.side === 'boost' ? ig : defender;
    if (f.fatal) { text = 'FLIGHT RELIEVED'; description = GAME_OVER_TEXT; target.classList.add('combat-defeated'); SFX.play('over'); }
    else if (f.side === 'defend') { text = `+${f.block} BLOCK`; description = '🛡️ Guard ready · expires after the IG attack.'; }
    else if (f.side === 'boost') {
      text = `+${f.heal} HP${f.percent ? ` (+${f.percent}%)` : ''}`;
      description = `${f.actor}: IG gains ${f.heal} HP${f.percent ? ` (+${f.percent}% of base HP, rounded up)` : ''}.`;
      animations.push(ig.querySelector('canvas').animate([
        { filter: 'none' },
        { filter: 'brightness(1.65) drop-shadow(0 0 24px #94ff76)', offset: .25 },
        { filter: 'brightness(1.65) drop-shadow(0 0 24px #94ff76)', offset: .6 },
        { filter: 'none' }
      ], { duration: 1200 }));
      ig.querySelectorAll('.combat-heal-sparks i').forEach(spark => {
        animations.push(spark.animate([
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' },
          { opacity: 1, offset: .2 },
          { opacity: 0, transform: `translate(calc(-50% + ${spark.style.getPropertyValue('--dx')}),calc(-50% + ${spark.style.getPropertyValue('--dy')})) scale(1.2)` }
        ], { duration: 900, delay: parseFloat(spark.style.getPropertyValue('--delay')) || 0, fill: 'both', easing: 'ease-out' }));
      });
    }
    else if (f.side === 'audit') { text = 'CLEAN FLIGHT'; description = '✅ No integrity findings.'; }
    else if (f.miss) { text = 'MISS'; description = 'The attack misses. No HP lost.'; }
    else if (f.side === 'ig') { text = f.damage ? `−${f.damage} ${METER[f.meter].label.toUpperCase()}` : 'BLOCKED'; description = `👹 ${f.label} targets ${METER[f.meter].icon} ${METER[f.meter].label}: ${f.damage} damage.${f.blocked ? ` 🛡️ ${f.blocked} blocked.` : ''}${(f.reductions || []).map(r => ' ' + lossReductionText(r)).join('')}`; }
    else { text = `−${f.damage} HP`; description = `${f.actor} deals ${f.damage} damage to the IG.`; }
    if ((f.side === 'defend') || (f.side === 'ig' && f.blocked)) flight.querySelector('.combat-shield').classList.add('visible');
    const popup = target.querySelector('.combat-popup'); popup.textContent = text;
    // A one-shot Web Animation survives arena reparenting without replaying.
    animations.push(popup.animate([
      { opacity: 0, marginTop: '18px' },
      { opacity: 1, marginTop: '0', offset: .12 },
      { opacity: 1, marginTop: '-6px', offset: .78 },
      { opacity: 0, marginTop: '-16px' }
    ], { duration: 1400, fill: 'forwards', easing: 'ease-out' }));
    if (!f.miss && !noStrike) animations.push(target.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.3)', transform: 'translateX(-8px)' }, { filter: 'brightness(1)', transform: 'translateX(0)' }], { duration: 450 }));
    if (!f.fatal) SFX.play(f.miss ? 'bad' : noStrike ? 'good' : 'hit');
    const hpAfter = f.hpAfter ?? f.hpBefore ?? P.S.boss?.hp;
    const killingBlow = !f.miss && f.side === 'team' && f.hpBefore > 0 && hpAfter <= 0;
    setCombatHP(root, hpAfter, f.max ?? P.S.boss?.max, killingBlow);
    if (killingBlow) {
      const sprite = ig.querySelector('canvas');
      const defeat = sprite.animate([
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: 'translateY(-18px) rotate(-15deg)', offset: .2 },
        { transform: 'translateY(-32px) rotate(165deg)', offset: .48 },
        { transform: 'translateY(8px) rotate(368deg) scale(.9)', offset: .8 },
        { transform: 'translateY(0) rotate(360deg) scale(1)' }
      ], { delay: 200, duration: 2000, easing: 'ease-in-out', fill: 'forwards' });
      defeat.onfinish = () => ig.classList.add('combat-ig-defeated');
      animations.push(defeat);
      const stars = document.createElement('div'); stars.className = 'combat-defeat-stars';
      stars.setAttribute('aria-hidden', 'true'); stars.textContent = '✦ ★ ✦';
      ig.appendChild(stars); transientNodes.push(stars);
      animations.push(stars.animate([
        { opacity: 0, transform: 'translate(-50%,0) scale(.5)' },
        { opacity: 1, transform: 'translate(-50%,-22px) scale(1.2)', offset: .3 },
        { opacity: 0, transform: 'translate(-50%,-45px) scale(1)' }
      ], { delay: 200, duration: 2000, fill: 'both', easing: 'ease-out' }));
    }
    if (f.stage === 'vouch') {
      const supporter = root.querySelector('.combat-support-member.active');
      if (supporter) {
        supporter.classList.remove('active'); supporter.classList.add('complete');
        supporter.querySelector('b').textContent = '✓';
        supporter.setAttribute('aria-label', `${supporter.querySelector('span').textContent}: finished`);
      }
    }
    const meterBefore = root._combatMeters[f.meter];
    const finalMeters = f.metersAfter || { ...root._combatMeters, ...(f.meter ? { [f.meter]: f.meterAfter } : {}) };
    const hitEnd = f.hitMeterAfter ?? finalMeters[f.meter];
    const drain = f.side === 'ig' && f.meter && meterBefore > hitEnd;
    root._combatMeters = drain ? { ...finalMeters, [f.meter]: meterBefore } : finalMeters;
    const meters = root.querySelector('.combat-team-meters');
    if (meters) meters.outerHTML = renderCombatMeters({ ...P.S, meters: root._combatMeters });
    if (drain) {
      const end = hitEnd, loss = meterBefore - end;
      const meter = root.querySelectorAll('.combat-team-meters .meter')[METERS.findIndex(m => m.k === f.meter)];
      const pips = [...meter.querySelectorAll('.bar i')], number = meter.querySelector('.lbl>span:last-child');
      for (let step = 0; step < loss; step++) {
        const pip = pips[meterBefore - 1 - step];
        const wipe = pip.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }],
          { delay: step * 1200 / loss, duration: 1200 / loss, fill: 'forwards', easing: 'linear' });
        animations.push(wipe);
        later(() => {
          pip.classList.remove('on'); wipe.cancel();
          const value = meterBefore - step - 1;
          number.textContent = value; meter.classList.toggle('low', value <= DIFFICULTY.dangerAt);
          root._combatMeters[f.meter] = value;
        }, (step + 1) * 1200 / loss);
      }
      if (f.recovery) {
        later(() => { showCombatNarration(root, f.recovery.text); }, 1400);
        const gain = f.recovery.to - end;
        for (let step = 1; step <= gain; step++) later(() => {
          const value = end + step, pip = pips[value - 1]; pip.classList.add('on');
          animations.push(pip.animate([{ filter: 'brightness(2.5)' }, { filter: 'brightness(1)' }], { duration: 350 }));
          number.textContent = value; meter.classList.toggle('low', value <= DIFFICULTY.dangerAt);
          root._combatMeters[f.meter] = value;
        }, 1400 + step * 700 / gain);
        later(() => { root._combatMeters = finalMeters; }, 2100);
      } else later(() => { root._combatMeters = finalMeters; }, 1200);
    }
    showCombatNarration(root, f.narration || description);
  }, 820 + chargeMs);
  later(() => {
    if (person && !reusePerson) animations.push(person.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }));
  }, 1800 + chargeMs);
  const defeatTime = !f.miss && f.side === 'team' && f.hpBefore > 0 && f.hpAfter <= 0 ? 2500 : 0;
  later(() => {
    if (f.side === 'ig') flight.querySelector('.combat-shield').classList.remove('visible');
    done?.();
  }, 2350 + defeatTime + chargeMs + (f.recovering ? 1400 : 0));
  return () => {
    timers.forEach(clearTimeout); animations.forEach(a => a.cancel());
    transientNodes.forEach(el => el.remove());
    if (!reusePerson) person?.remove();
    root.classList.remove('is-animating');
    if (P.bossVisualRoot === root) P.bossVisualRoot = null;
    if (P.S?.phase === 'boss') render();
  };
}

function spinOverlay(f) {
  const n = f.slices.length;
  const d = document.createElement('div');
  d.className = 'ovl';
  d.className = 'ovl solid';
  d.innerHTML = `<div class="wt">${esc(f.title)}</div><div class="needle2"></div><canvas width="720" height="720"></canvas><div class="wres"></div>`;
  document.body.appendChild(d);
  const cv = d.querySelector('canvas');
  const a = 2 * Math.PI / n, turn = 2 * Math.PI, start = Math.random() * turn;
  // Choose a point inside the winning segment, leaving a small margin at either edge.
  const landing = ((wheelTarget(n, f.idx) + (Math.random() - 0.5) * a * 0.76) % turn + turn) % turn;
  const end = landing + turn * (5 + Math.floor(Math.random() * 4));
  const T = WHEEL_MS - 300, t0 = performance.now();
  let lastSeg = -1;
  const ease = t => 1 - Math.pow(1 - t, 3);
  let frameId;
  function frame(now) {
    if (!d.isConnected) return;
    const t = Math.min(1, (now - t0) / T);
    const rot = start + (end - start) * ease(t);
    drawWheel(cv, f.slices, rot);
    const seg = Math.floor((rot + Math.PI / 2) / a);
    if (seg !== lastSeg) { lastSeg = seg; SFX.play('tick'); d.querySelector('.needle2').animate?.([{ transform: 'rotate(-5deg)' }, { transform: 'rotate(0deg)' }], { duration: 110 }); }
    if (t < 1) frameId = requestAnimationFrame(frame);
    else {
      const s = f.slices[f.idx];
      d.querySelector('.wres').innerHTML = `<span style="color:${s.color}">${esc(s.label)}</span>`;
      SFX.play('good');
    }
  }
  drawWheel(cv, f.slices, start);
  frameId = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(frameId); d.remove(); };
}

/* ---------------- dice ---------------- */
// Physics and models are bundled locally in vendor/dice/dice.js.
function rollIdentity(person, label) {
  if (!person) return label ? `<div class="roll-identity"><b>${esc(label)}</b></div>` : '';
  const name = label || rankName(person);
  const picture = person.rank && !person.cls ? avatar(person.name + person.rank) : avatarOf(person);
  return `<div class="roll-identity"><img class="roll-avatar" src="${picture}" alt="">${P.S?.phase === 'boss' ? `<b>${combatLabel(name)}</b>` : `${insignia(person, 20)}<b>${esc(name)}</b>`}</div>`;
}
function dieHtml(sides, v, cls = '') { return `<div class="die ${cls}" data-sides="${sides}" role="img" aria-label="d${sides}"><div class="dice-tray"></div><span>${esc(v)}</span><small>d${sides}</small></div>`; }
function setDieValue(el, value) {
  el.querySelector('span').textContent = value;
  el.setAttribute('aria-label', `d${el.dataset.sides}: ${value}`);
}
function prepareDice(root) { root.querySelectorAll('.die').forEach(el => setDieValue(el, '?')); }
function tumble(el, sides, final, ms, done, onNum) {
  if (!el.isConnected) return;
  el.classList.add('rolling');
  let finished = false, handle;
  const finish = failed => {
    if (finished || !el.isConnected) return;
    finished = true; clearTimeout(watchdog);
    if (failed) { handle?.cancel(); el.classList.add('dice-fallback'); }
    setDieValue(el, final);
    el.classList.remove('rolling'); el.classList.add('landed');
    onNum?.(final); done?.();
  };
  // Unsupported WebGL or a lost graphics context must never block the game.
  const watchdog = setTimeout(() => finish(true), 18000);
  el._cancelRoll = () => { finished = true; clearTimeout(watchdog); handle?.cancel(); };
  try {
    handle = window.PracticumDice.roll(el.querySelector('.dice-tray'), sides, final);
    handle.promise.then(result => { if (result) finish(false); }).catch(error => {
      console.warn('Physics dice unavailable; displaying the game result.', error); finish(true);
    });
  } catch (error) { console.warn('Physics dice unavailable.', error); finish(true); }
}
// Acknowledged only after every die in this overlay has settled.
function diceSettled(f) {
  if (!f.animationId) return;
  const msg = { type: 'diceSettled', animationId: f.animationId };
  try { window.opener?.postMessage(msg, location.origin); } catch (e) { }
  try { window.parent !== window && window.parent.postMessage(msg, location.origin); } catch (e) { }
  try { bc?.postMessage(msg); } catch (e) { }
}
// With a table: every outcome is shown first and a highlight sweeps across them (the drumroll),
// then the physical die rolls and the winning outcome lights up when it settles.
function hypeDice(f) {
  const rows = f.table, hit = rows.findIndex(r => f.v >= r.lo && f.v <= r.hi);
  const rm = overlay(`<div class="wt">${esc(f.title)}</div>${rollIdentity(P.S?.party[f.roller])}<div class="hype">${rows.map(r => `<div class="hr" style="--c:${r.color}"><b>${r.lo === r.hi ? r.lo : r.lo + '-' + r.hi}</b><span>${r.icon || ''} ${esc(r.label)}</span></div>`).join('')}</div>
    ${dieHtml(f.sides, '?')}<div class="wres"></div>`, 'solid', false);
  const ov = document.querySelectorAll('.ovl'), d = ov[ov.length - 1], els = d.querySelectorAll('.hr');
  prepareDice(d);
  const light = k => els.forEach((e, i) => e.classList.toggle('lit', i === k));
  let k = 0;
  const sweep = setInterval(() => { light(k % els.length); SFX.play('tick'); k++; }, 300);
  const go = setTimeout(() => {
    clearInterval(sweep); light(-1); SFX.play('alarm');
    tumble(d.querySelector('.die'), f.sides, f.v, 2000, () => {
      els.forEach((e, i) => e.classList.add(i === hit ? 'win' : 'lose'));
      d.querySelector('.wres').innerHTML = esc(f.result || ''); SFX.play('good'); diceSettled(f);
    }, n => light(rows.findIndex(r => n >= r.lo && n <= r.hi)));
  }, 2400);
  return () => { clearInterval(sweep); clearTimeout(go); rm(); };
}
function diceOverlay(f) {
  if (f.table) return hypeDice(f);
  const rm = overlay(`<div class="wt">${esc(f.title)}</div>${rollIdentity(P.S?.party[f.roller])}${f.goal ? `<div class="goalDie">🎯 GOAL DIE: ${f.goal}+</div>` : ''}${dieHtml(f.sides, '?')}<div class="wres"></div>`, 'solid', false);
  const ov = document.querySelectorAll('.ovl'); const d = ov[ov.length - 1];
  prepareDice(d);
  tumble(d.querySelector('.die'), f.sides, f.v, DICE_MS - 900, () => {
    d.querySelector('.wres').innerHTML = esc(f.result || ''); SFX.play('good'); diceSettled(f);
  });
  return rm;
}
function multiDiceOverlay(f) {
  const html = `<div class="wt">${esc(f.title)}</div><div class="dicerow">${f.rows.map(r => `<div class="dcol">${rollIdentity(P.S?.party.find(p => rankName(p) === r.name) || r, r.name)}${r.goal ? `<div class="goalDie">🎯 ${r.goal}+</div>` : ''}${dieHtml(20, '?')}<div class="dtag ${r.hi ? 'hi' : ''}">&nbsp;</div></div>`).join('')}</div>`;
  const arenaRoot = f.combat && document.querySelector('.battle-stage');
  let rm, d;
  if (arenaRoot) {
    P.bossVisualRoot = arenaRoot; arenaRoot.classList.add('is-rolling');
    arenaRoot.querySelector('.combat-action-title').textContent = f.title;
    showCombatNarration(arenaRoot, '🎲 Roll the goal die or higher to hit the IG.');
    d = document.createElement('div'); d.className = 'battle-team-roll'; d.innerHTML = html;
    arenaRoot.querySelector('.combat-arena').appendChild(d);
    rm = () => { d.querySelectorAll('.die').forEach(el => el._cancelRoll?.()); d.remove(); arenaRoot.classList.remove('is-rolling'); };
  } else {
    rm = overlay(html, 'solid', false);
    const ov = document.querySelectorAll('.ovl'); d = ov[ov.length - 1];
  }
  prepareDice(d);
  const cols = [...d.querySelectorAll('.dcol')]; let landed = 0, combatClean = null, combatTimer = null;
  cols.forEach((col, i) => {
    const r = f.rows[i];
    setTimeout(() => tumble(col.querySelector('.die'), 20, r.v, 1300, () => {
      if (++landed === cols.length) {
        cols.forEach((all, j) => {
          const row = f.rows[j]; setDieValue(all.querySelector('.die'), row.v);
          all.querySelector('.dtag').textContent = row.tag; all.classList.add(row.hi ? 'win' : 'lose');
        });
        SFX.play('good');
        if (f.combat) combatTimer = setTimeout(() => { if (!d.isConnected) return; rm(); combatClean = combatAnimation(f.combat, () => diceSettled(f)); }, 700);
        else diceSettled(f);
      }
    }), i * 180);
  });
  return () => {
    clearTimeout(combatTimer); rm();
    if (combatClean) combatClean();
    else if (arenaRoot && P.bossVisualRoot === arenaRoot) { P.bossVisualRoot = null; if (P.S?.phase === 'boss') render(); }
  };
}
function rollOverlay(f) {
  const r = f.r;
  const verdict = r.nat === 20 ? 'CRITICAL HIT!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED';
  const goal = Math.min(20, Math.max(2, r.dc - (r.total - r.d20)));
  const roller = f.npcSlot ? npcOf(P.S, f.npcSlot) : P.S?.party[r.roller];
  const rm = overlay(`<div class="bigcard rollcard">${rollIdentity(roller, f.who)}<h2>${r.safe ? 'PLAYS IT SAFE 🛡️' : 'ROLLS THE d20'}</h2>
    ${r.safe ? '' : `<div class="goalDie">🎯 GOAL DIE: ${goal}+</div>`}
    ${dieHtml(20, '?', 'big')}
    <div class="after" style="visibility:hidden">
    <div class="rollline">${r.parts.length ? r.parts.map(p => `<span class="${p[1] >= 0 ? 'up' : 'dn'}">${sign(p[1])}</span> ${mt(esc(p[0]))}`).join(' &nbsp; ') : 'no modifiers'}</div>
    <div class="rollline">= <b>${r.total}</b> vs target <b>${r.dc}</b></div>
    <div class="verdict ${r.pass ? 'pass' : 'fail'}">${verdict}</div></div></div>`, 'solid', false);
  const ov = document.querySelectorAll('.ovl'); const d = ov[ov.length - 1];
  prepareDice(d);
  tumble(d.querySelector('.die'), 20, r.d20, r.safe ? 300 : 1800, () => {
    d.querySelector('.after').style.visibility = 'visible';
    d.querySelector('.bigcard').classList.add(r.pass ? 'good' : 'bad');
    SFX.play(r.nat === 20 ? 'crit' : r.nat === 1 ? 'fumble' : r.pass ? 'good' : 'bad'); diceSettled(f);
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
  const timerHost = S.phase === 'boss' ? $('.battle-heading') : document.body;
  if (timerHost && el.parentElement !== timerHost) timerHost.appendChild(el);
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
  // Approved Cacic portrait; matches inspector-general.svg.
  R('#1b1b4a', 0, 0, 32, 32);
  R('#22345a', 6, 19, 20, 13);
  R('#16243f', 6, 23, 4, 9);
  R('#16243f', 22, 23, 4, 9);
  R('#afc9e1', 13, 19, 7, 13);
  R('#344a70', 10, 19, 3, 4);
  R('#344a70', 20, 19, 3, 4);
  R('#14213b', 15, 21, 2, 11);
  R('#14213b', 14, 20, 4, 2);
  R('#d7a180', 13, 16, 7, 4);
  R('#e6b493', 10, 5, 13, 10);
  R('#e6b493', 11, 15, 11, 2);
  R('#d7a180', 12, 17, 9, 1);
  R('#d7a180', 9, 9, 1, 5);
  R('#d7a180', 23, 9, 1, 5);
  R('#775e4c', 11, 3, 11, 1);
  R('#594332', 10, 4, 13, 1);
  R('#6c503c', 10, 5, 2, 2);
  R('#6c503c', 21, 5, 2, 2);
  R('#594332', 10, 7, 1, 2);
  R('#594332', 22, 7, 1, 2);
  R('#75513c', 12, 9, 3, 1);
  R('#75513c', 18, 9, 3, 1);
  R('#f5e7d8', 12, 10, 3, 1);
  R('#f5e7d8', 18, 10, 3, 1);
  R('#527c98', 13, 10, 1, 1);
  R('#527c98', 19, 10, 1, 1);
  R('#cc9677', 16, 10, 1, 3);
  R('#8a6150', 15, 14, 3, 1);
  R('#aeb8c6', 7, 19, 3, 1);
  R('#aeb8c6', 23, 19, 3, 1);
  R('#cdd6dd', 19, 22, 3, 1);
  R('#cdd6dd', 20, 21, 1, 3);
  R('#bb4856', 18, 25, 1, 1);
  R('#e4ca72', 19, 25, 1, 1);
  R('#567eae', 20, 25, 1, 1);
  R('#80a0c2', 18, 26, 1, 1);
  R('#cd4b52', 19, 26, 1, 1);
  R('#e4ca72', 20, 26, 1, 1);
  R('#c4b895', 10, 25, 3, 1);
  R('#c0c0c0', 24, 14, 8, 12);
  R('#8b5a2b', 26, 13, 3, 2);
  R('#42434b', 25, 17, 6, 1);
  R('#42434b', 25, 19, 6, 1);
  R('#42434b', 25, 21, 6, 1);
  R('#42434b', 25, 23, 6, 1);
  R('#e6b493', 22, 21, 3, 3);
}

/* ---------------- render ---------------- */
function render() {
  const S = P.S; if (!S) return;
  // Keep the arena's real DOM while physics dice or an attack are in flight.
  const oldArena = document.querySelector('.battle-stage');
  const keepArena = S.phase === 'boss' && oldArena && (P.bossVisualRoot === oldArena || (S.boss?.stage === 'hotseat' && oldArena.querySelector('.hotseat-roll-fx')));
  if (keepArena) {
    // Never detach active fighters: reattaching them restarts CSS effects and can
    // briefly expose a finished spell again during acknowledgements/countdowns.
    if (!P.bossVisualRoot) {
      const chosen = S.boss.p2.who?.[0];
      oldArena.querySelectorAll('.hotseat-roll-fx').forEach(el => {
        const selected = chosen != null && Number(el.dataset.slot) === chosen;
        el.classList.toggle('chosen', selected);
        el.querySelector(':scope > small').textContent = selected ? (S.boss.p2.tied ? '🎤 TIE PICK · YOU’RE UP' : '🎤 LOWEST · YOU’RE UP') : chosen != null ? 'HOT SEAT · d20' : 'WAITING FOR ALL ROLLS';
      });
      if (chosen != null && !oldArena._hotSeatResultsTimer) {
        oldArena._hotSeatResultsTimer = setTimeout(() => {
          if (!oldArena.isConnected || P.S?.boss?.stage !== 'hotseat') return;
          const cards = [...oldArena.querySelectorAll('.hotseat-roll-fx')];
          cards.forEach(card => card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }));
          setTimeout(() => {
            if (!oldArena.isConnected) return;
            cards.forEach(card => { card.querySelector('.die')?._cancelRoll?.(); card.remove(); });
            oldArena.classList.remove('is-hotseat-rolling'); render();
          }, 450);
        }, 3500);
      }
      const template = document.createElement('template'); template.innerHTML = renderBoss(S);
      const speaker = template.content.querySelector('.hotseat-speaker');
      if (speaker && !oldArena.querySelector('.hotseat-speaker')) oldArena.querySelector('.combat-arena')?.appendChild(speaker);
      const details = template.content.querySelector('.battle-details');
      if (details) document.querySelector('.battle-details')?.replaceWith(details);
    }
    tickTimer();
    return;
  }
  oldArena?.querySelectorAll('.hotseat-roll-fx .die').forEach(el => el._cancelRoll?.());
  // Keep the same countdown node when rebuilding the battle board.
  const runningTimer = $('#timer'); if (runningTimer) document.body.appendChild(runningTimer);
  document.body.className = 'player' + (S.phase === 'debrief' ? ' reality' : '') + (['title', 'join'].includes(S.phase) ? ' joining' : '');
  const full = ['title', 'join', 'welcome', 'intro', 'party', 'perks', 'kit', 'avatars', 'roster', 'boss', 'results', 'debrief', 'levelup', 'unit', 'patch', 'itemsBriefing', 'itemAward', 'manifest'].includes(S.phase);
  const hud = !['boss', 'title', 'join', 'welcome', 'intro', 'debrief', 'party', 'perks', 'kit', 'avatars', 'roster', 'unit', 'itemsBriefing', 'itemAward'].includes(S.phase);
  $('#app').innerHTML = `<div class="pl ${S.phase === 'boss' ? 'boss-view' : ''}">${hud ? renderHud(S) : S.phase === 'boss' ? '' : '<div></div>'}
    <div class="stage ${full ? 'full' : ''}"><div class="main">${renderMain(S)}</div>${full ? '' : `<div class="side">${renderSide(S)}</div>`}</div></div>
    ${S.showBoard ? renderBoardOverlay() : ''}${renderJoinBox(S)}${renderActorBanner(S)}${renderResultCard(S)}${renderNotice(S)}`;
  const start = $('#welcomeStart');
  if (start) start.onclick = () => {
    SFX.unlock(); SFX.play('start');
    const message = { type: 'beginBriefing' };
    try { window.opener && window.opener.postMessage(message, location.origin); } catch (e) { }
    try { bc && bc.postMessage(message); } catch (e) { }
  };
  fitCard(); fitLines($('#app'));
  // the GM only pushes state when something changes, so redraw ourselves when a wheel/die finishes
  clearTimeout(P.spinT);
  if (Date.now() < (S.spinUntil || 0)) P.spinT = setTimeout(render, S.spinUntil - Date.now() + 80);
  animateReplacementNotice(S);
  const bc2 = $('#bossCv'); if (bc2) drawBoss(bc2);
  if (S.phase === 'manifest') animateManifestRoll(S);
  if (S.phase === 'boss') {
    const root = document.querySelector('.battle-stage'), labels = [...root.querySelectorAll('.boss-phase-track>span')];
    const active = labels.findIndex(el => el.classList.contains('active'));
    animateBossPhase(root, active < 0 ? labels.length : active); tickTimer();
  } else P.bossPhase = null;
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
  if (!j || !j.url || !j.live || j.full || !(S.phase === 'avatars' || (S.phase === 'intro' && S.introPage === 0))) return '';
  const src = qrSrc(j.url);
  return `<div class="joinbox">${src ? `<img src="${src}">` : ''}<div><div class="sectlbl">📱 JOIN ON YOUR PHONE</div>
    <div class="jurl">${esc(j.url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</div><div class="jcode">ROOM ${esc(j.code)}</div></div></div>`;
}
// The first screen of a run: the join QR blown up to fill the projector, so the whole room can scan it
function renderJoinScreen(S) {
  const j = P.join, src = j && j.url ? qrSrc(j.url) : '';
  const names = Object.values(S.clients || {}).map(c => c.name).filter(Boolean);
  if (!src) return `<div class="joinscr"><div class="ptitle">📱 JOIN ON YOUR PHONE</div><div class="jsub">${j && j.code ? `Phones are connecting… ROOM <b>${esc(j.code)}</b>` : 'Phones are off: Captain Russell runs this one from the console.'}</div></div>`;
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
  if (!S.actor || spinning() || ['boss', 'debrief'].includes(S.phase)) return '';
  const p = S.party[S.actor.slot];
  // the Unknown d6 and the inject d6 already show their outcomes on the screen behind: just the name and icon
  const short = ['mystery', 'trigger'].includes(S.actor.kind), t = short ? null : actorTable(S);
  return `<div class="actorbar">${p ? `<img src="${avatarOf(p)}">` : ''}<div><div class="ab1">🎲 YOUR TURN, ${esc(rankName(p).toUpperCase())}</div>${short ? '' : `<div class="ab2">${esc(S.actor.label)}: tap the button on your phone!</div>`}
    ${t ? `<div class="abt">${t.map(r => `<span style="--c:${r.color}"><b>${r.lo === r.hi ? r.lo : r.lo + '-' + r.hi}</b> ${r.icon || ''} ${esc(r.label)}</span>`).join('')}</div>` : ''}</div></div>`;
}
// A perk or ability just fired: explain what it did until the GM continues
function renderNotice(S) {
  const n = S.notice; if (!n) return '';
  const replacement = n.replacement, t = replacement && TRAIT[replacement.trait];
  const card = replacement ? `<div class="replacement-reveal"><small>${esc(replacement.previous)} PCSes out</small><img src="${avatar(replacement.name + replacement.rank)}" alt="Replacement"><b class="replacement-name">${insignia(replacement.rank)}${esc(replacement.rank)} ${esc(replacement.name)}</b><span class="replacement-trait">${t.icon} ${esc(t.name)}</span><small class="replacement-loyalty">🤝 ALLY · Loyalty ${replacement.loy}/5</small></div>` : '';
  return `<div class="rescard notice"><div class="bigcard ${n.cls || 'good'} ${replacement?'replacement-notice':''}">${replacement?'':`<div class="bigic" style="font-size:80px">${n.icon}</div>`}<div class="sectlbl" style="color:var(--gold)">${esc(n.label || 'PERK / ABILITY USED')}</div><h2>${esc(n.title)}</h2>${card}<div class="bt replacement-summary">${mt(esc(n.text))}</div><div class="rwait">⏳ Waiting for Captain Russell to continue</div></div></div>`;
}
function animateReplacementNotice(S) {
  const note = S.notice, member = note?.replacement, card = document.querySelector('.replacement-reveal');
  if (!member || !card || card._rolling) return;
  card._rolling = true;
  const identity = card.querySelector('.replacement-name'), trait = card.querySelector('.replacement-trait'), image = card.querySelector('img');
  const finalIdentity = identity.innerHTML, finalTrait = trait.innerHTML, finalImage = image.src;
  const roster = getRoster(), names = roster.names;
  const tick = () => {
    if (!card.isConnected) return;
    const elapsed = Date.now() - note.at, frame = Math.floor(elapsed / 120);
    if (elapsed >= 2600) {
      identity.innerHTML = finalIdentity; trait.innerHTML = finalTrait; image.src = finalImage;
      card.closest('.bigcard').classList.remove('replacement-rolling'); card.classList.add('org-roll-locked'); return;
    }
    card.closest('.bigcard').classList.add('replacement-rolling');
    const name = elapsed >= 1700 ? member.name : names[frame % names.length];
    const rank = elapsed >= 1000 ? member.rank : ['Amn','A1C','SrA','SSgt'][frame % 4];
    identity.innerHTML = `${insignia(rank)}${esc(rank)} ${esc(name)}`;
    image.src = elapsed >= 1700 ? finalImage : avatar(name + rank);
    const t = TRAITS[frame % TRAITS.length]; trait.textContent = `${t.icon} ${t.name}`;
    setTimeout(tick, 120);
  };
  tick();
}
// ties: no banner; the Flight Commander's vote icon glows while the vote is tied (the GM directs the call)
function renderTie(S) { return ''; }
// What just changed: stays on screen until the GM clicks Continue
function renderResultCard(S) {
  if (!resultReady(S)) return '';
  const r = resultSummary(S), lootOf = id => LOOT.find(x => x.id === id);
  // one change per line, amount first: "−1 ⭐ Trust", "+ 📦 Pallet of Spares"
  const row = (cls, amt, what) => `<div class="rrow ${cls}"><b>${amt}</b><span>${what}</span></div>`;
  const rows = [
    ...r.meters.map(([k, d]) => row(d > 0 ? 'up' : 'dn', sign(d), `${METER[k].icon} ${METER[k].label}`)),
    ...r.loy.map(([who, d]) => row(d > 0 ? 'up' : 'dn', sign(d), `🤝 ${esc(who)} loyalty`)),
    ...r.gained.map(id => row('up', '+', `${lootOf(id).icon} ${esc(lootOf(id).name)}`)),
    ...r.lost.map(id => row('', '-', `${lootOf(id).icon} ${esc(lootOf(id).name)} <small>used</small>`)),
    ...r.reductions.map(r => `<div class="loss-reduction">${esc(lossReductionText(r))}</div>`),
  ];
  const good = r.meters.reduce((a, [, d]) => a + d, 0);
  const tested = S.phase === 'node' && S.cur && !['rest', 'depot', 'unknown'].includes(S.cur.type) ? objChips(curMission()) : '';
  return `<div class="rescard"><div class="bigcard ${good > 0 ? 'good' : good < 0 ? 'bad' : ''}"><div class="sectlbl">${teamTag(S) ? esc(teamTag(S)) + ' · ' : ''}RESULT</div>${(() => { const rr = S.phase === 'node' && S.cur && S.cur.rollRes; if (!rr) { const c = S.cur; if (S.phase === 'node' && c && c.stars) return `<h2>🎤 ${esc(cadetName(c.lead))}</h2><div class="rstars">${[1, 2, 3].map(k => `<span class="${k <= c.stars ? 'on' : ''}">⭐</span>`).join('')}</div>`; return `<h2>${esc(resultHeadline(S))}</h2>`; }
    const v = rr.nat === 20 ? 'CRITICAL!' : rr.nat === 1 ? 'FUMBLE!' : rr.pass ? 'SUCCESS' : 'FAILED';
    return `<h2 class="verdict2 ${rr.pass ? 'up' : 'dn'}">${rr.lead ? '📢 ' : ''}${v}</h2><div class="bt rmath">rolled ${rr.d20} · total ${rr.total} vs target ${rr.dc}${rr.lead ? ' · Prior MTI' : ''}</div>`; })()}${tested ? `<div class="sob" style="margin:4px 0 8px"><span class="objlbl">THIS TESTED</span>${tested}</div>` : ''}
    ${rows.length ? `<div class="rrows">${rows.join('')}</div>` : '<div class="bt">No change to your meters.</div>'}
    ${(() => { const d = usableNow(S).filter(u => u.moment); return d.length ? `<div class="rdecide">⚡ DECIDE NOW: USE IT OR PASS${d.map(u => `<div>${u.icon} <b>${esc(u.label)}</b>${u.who != null ? ` (${esc(rankName(S.party[u.who]))})` : ''}: ${mt(esc(u.hint))}</div>`).join('')}</div>` : ''; })()}
    <div class="rwait">⏳ Waiting for Captain Russell to continue</div></div></div>`;
}
// Power-ups worth using right now (tokens, items, abilities, perks)
// Projector: only moment-specific power-ups, as a decision for the team (general ones are on phones)
function renderPowerups(S) {
  const list = usableNow(S).filter(u => u.moment); if (!list.length) return '';
  return `<div class="powerups decide"><span class="pu-h">⚡ DECIDE NOW: USE IT OR PASS</span>${list.map(u => `<span class="pu ${u.hot ? 'hot' : ''}">${u.icon} <b>${esc(u.label)}</b>${u.who != null ? ` <i>(${esc(rankName(S.party[u.who]))})</i>` : ''}<span class="hint"> · ${mt(esc(u.hint))}</span></span>`).join('')}</div>`;
}

// One HUD meter. Hidden by default: a STRONG / STEADY / DANGER band (danger flashes red).
// A DEOCS Survey or the IG battle shows the exact number and the 10-pip bar.
function meterHtml(S, m) {
  const v = S.meters[m.k], b = meterBand(v);
  if (S.phase === 'boss' || deocsOn(S)) return `<div class="meter ${b.cls === 'danger' ? 'low' : ''}" style="--c:${m.color}"><div class="lbl"><span>${meterIcon(m)} ${m.name}</span><span>${v}</span></div><div class="bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</div></div>`;
  return `<div class="meter fog ${b.cls} ${b.cls === 'danger' ? 'low' : ''}" style="--c:${m.color}"><div class="lbl"><span>${meterIcon(m)} ${m.name}</span></div><div class="band">${b.word}</div></div>`;
}
function renderHud(S) {
  const u = S.unit ? UNITS.find(x => x.id === S.unit) : null;
  return `<div class="hud">
    <div class="unit">${u ? `${u.icon} ${u.name}` : 'PRACTICUM ADVENTURE'}</div>
    <div class="meters">${METERS.map(m => meterHtml(S, m)).join('')}${deocsOn(S) && !['boss', 'results', 'debrief'].includes(S.phase) ? `<div class="deocs-tag">📋 DEOCS${deocsLeft(S) ? ` · ${deocsLeft(S)} more` : ' · last stop'}</div>` : ''}</div>
    <div class="right">
      ${patchOf(S) ? `<div class="tok patch" style="--c:${UNITS.find(x => x.id === S.unit).color}"><b>${patchOf(S).icon}</b>${esc(patchOf(S).name.toUpperCase())}</div>` : ''}
      ${S.intent ? `<div class="tok" style="--c:${METER[S.intent].color}"><b>${METER[S.intent].icon}</b>CC INTENT</div>` : ''}
    </div></div>`;
}

function renderDanger(S) {
  const d = dangerInfo(S); if (!d) return '';
  return `<div class="danger-alert">⚠️ ${mt(esc(d.text))}${d.tools.length ? `<div class="dtools">Could help now: ${d.tools.map(esc).join(' · ')}</div>` : ''}</div>`;
}
function renderSide(S) {
  const cr = crownIdx(S);
  return `<div class="pgrid">${S.party.map((p, i) => { const off = S.offline === i || (S.phase === 'map' && S.offlineNext === i); return `<div class="pcard ${off || p.fired ? 'offline' : ''}" style="border-color:${clsColor(p)}"><img src="${avatarOf(p)}" style="border-color:${clsColor(p)}"><div><div class="nm">${insignia(p)}${esc(rankName(p))}</div><div class="cl">${CLASS[p.cls] ? CLASS[p.cls].name : ''}${p.fired ? ' · 🪓 FIRED' : off ? ' · 📵 MEETING' : ''}</div></div>${i === cr ? '<div class="crown">👑</div>' : ''}</div>`; }).join('')}</div>
    ${(S.items || []).length ? `<div class="sectlbl" style="margin-top:6px">🎒 TEAM ITEMS (${S.items.length}/3)</div><div class="sitems1">${S.items.map(id => { const l = LOOT.find(x => x.id === id); return `<span>${l.icon} ${esc(l.name)}</span>`; }).join('')}</div>` : ''}
    <div class="sectlbl" style="margin-top:6px">YOUR UNIT</div>
    ${S.cc ? `<div class="npc cc"><img src="${avatar(S.cc)}"><div><div class="nm">${insignia(commanderRank(S))}${esc(S.cc)}</div><div class="tr rev">${ccBadge(20)} Squadron Commander${S.intent ? ` · intent ${METER[S.intent].icon}` : ''}</div></div></div>` : ''}
    ${S.unit === 'pp' && !['boss', 'results', 'debrief'].includes(S.phase) ? `<div class="ticket-status" title="Ticket System: lose 1 Resources every 2 stops"><b>🎟️ TICKET SYSTEM</b><span>−1 📦 in ${S.commStopsRemaining ?? 2} stop${(S.commStopsRemaining ?? 2) === 1 ? '' : 's'}</span></div>` : ''}
    <div class="ugrid">${S.npcs.slice().sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank)).map(n => { const t = TRAIT[n.trait]; return `<div class="npc mini ${isAlly(n) ? 'ally' : ''} ${n.broken || n.gone ? 'broken' : ''} ${n.out ? 'out' : ''}"><img src="${avatar(n.name + n.rank)}"><div>
      <div class="nm">${insignia(n.rank)}${esc(n.rank)} ${esc(n.name)}${isAlly(n) ? ' 🤝' : ''}${n.deceased ? ' (DECEASED)' : n.gone ? ' (GONE)' : n.out ? ' (OUT)' : ''}</div>
      <div class="tr rev">${t.icon} ${t.name}</div>
      <div class="loyrow"><div class="loy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div>${loyBandHtml(n.loy, isAlly(n), n.broken)}</div></div></div>`; }).join('')}</div>`;
}

function renderMain(S) {
  if (S.inject && S.inject.forced) return renderInject(S);
  switch (S.phase) {
    case 'title': return renderJoinScreen(S);
    case 'welcome': return renderWelcome();
    case 'join': return renderJoinScreen(S);
    case 'intro': return renderIntro(S);
    case 'party': return renderParty(S);
    case 'roster': return renderRosterChoices(S);
    case 'perks': return renderPerks(S);
    case 'kit': return renderKitCheck(S);
    case 'avatars': return renderAvatars(S);
    case 'unit': { const u = S.unitRolled && UNITS.find(x => x.id === S.unit), deployed = S.unit === 'ch' && (S.npcs || []).find(n => n.slot === 'D');
      if (u) return `<div class="titlescr unitrev" style="--c:${u.color}"><div style="font-size:150px;line-height:1">${u.icon}</div><div class="ptitle" style="color:${u.color};font-size:64px">${u.name}</div><div class="unitsq">${u.sq.toUpperCase()}</div>${deployed ? `<div class="sub" style="color:var(--bad);font-size:24px">🧑‍🤝‍🧑 DEPLOYED UNTIL AFTER THE INSPECTION: ${esc(deployed.rank)} ${esc(deployed.name)}</div>` : ''}<div class="sub">SQUADRON PENALTY · ${esc(squadPenaltyText(u.id, S))}</div></div>`;
      return `<div style="display:flex;flex-direction:column;gap:8px;height:100%;padding-bottom:50px"><div class="ptitle" style="text-align:center">CHOOSE YOUR SQUADRON </div>
        <div class="unitgrid u3">${unitPickOrder(S).map((x, i) => `<div class="unitcard" style="--c:${x.color};position:relative"><div class="ui">${x.icon}</div><div><div class="unm">${x.name}</div><div class="usq">${x.sq}</div>
          <div class="ustart bands4">${METERS.map(m => { const b = meterBand(x.start[m.k]); return `<div class="sb4 ${b.cls}" style="--mc:${m.color}"><span class="sbi">${m.icon}</span><span class="sbn">${m.name}</span><span class="sbw fitw">${b.word}</span></div>`; }).join('')}</div>
          <div class="sub">PENALTY · ${esc(squadPenaltyText(x.id))}</div></div>${voteDots(S, x.id)}</div>`).join('')}</div></div>`; }
    case 'patch': return renderPatch(S);
    case 'itemsBriefing': return renderItemsBriefing(S);
    case 'itemAward': return renderItemAward(S, S.itemAward);
    case 'manifest': return renderManifest(S);
    case 'mapRoll': return renderMap(S);
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

function renderWelcome() {
  return `<div class="titlescr"><div class="logo">PRACTICUM<br>ADVENTURE<small>For AFAS 3410 (Fall 2026)</small><small class="credit">Created by Captain Russell</small></div>
    <button id="welcomeStart" class="b pri ptitle blink" style="font-size:18px">CLICK TO START</button>
    <div class="sub">Press F11 for full screen</div></div>`;
}

function renderTitle() {
  const top = P.board.filter(b => !b.gameOver).slice(0, 5);
  return `<div class="titlescr"><div class="logo">PRACTICUM<br>ADVENTURE<small>For AFAS 3410 (Fall 2026)</small><small class="credit">Created by Captain Russell</small></div>
    <div class="ptitle blink" style="font-size:20px">INSERT CADETS TO CONTINUE</div>
    ${top.length ? `<div class="box" style="min-width:640px"><div class="sectlbl">HIGH SCORES</div><table class="lb">${top.map((b, i) => `<tr class="${i < 3 ? 'top' : ''}"><td class="rk">${i + 1}</td><td>${esc(b.callsign)}<div class="lbc">${esc(b.cadets || '')}</div></td><td>${esc(b.grade)}</td><td>${b.score}</td></tr>`).join('')}</table></div>` : ''}</div>`;
}

function renderIntro(S) {
  if (S.introPage === 0) return `<div class="intro"><div class="ptitle" style="text-align:center">Tested Samples of Behavior</div>
    <div class="objgrid">${OBJECTIVES.map((o, i) => `<div class="obj"><div class="oi">${o.icon}</div><div><b>${i + 1}. ${esc(o.name)}</b><div>${esc(o.text)}</div></div></div>`).join('')}</div></div>`;
  if (S.introPage === 1) return `<div class="intro">
    <div class="ptitle" style="text-align:center">YOUR THREE JOBS</div>
    <div class="sub" style="text-align:center">Every decision affects your integrity, your people, or your flight's readiness.</div>
    <div class="steps jobs-overview">${INTRO_JOBS.map(([ic, h, t], i) => `<div class="step"><div class="sn">${i + 1}</div><div class="si">${ic}</div><div><b>${esc(h)}</b><div>${esc(t)}</div></div></div>`).join('')}</div></div>`;
  if (S.introPage === 2) return renderIntegrity();
  if (S.introPage === 3) return renderLoyalty(S);
  return `<div class="intro readscr jobslide">${renderJobHeading(2)}
    <div class="rs-t">Each meter runs from <b>0 to 10</b>.</div>
    <div class="rs-meters">${METERS.map(m => `<div class="rs-m" style="--c:${m.color}"><div class="rs-i">${m.icon}</div><b>${m.name}</b><div>${esc(INTRO_METERS[m.k])}</div></div>`).join('')}</div>
    <div class="rs-bands"><span class="meter fog strong"><span class="band">STRONG · 7–10</span></span><span class="meter fog steady"><span class="band">STEADY · ${DIFFICULTY.dangerAt + 1}–6</span></span><span class="meter fog danger low"><span class="band">DANGER · 0–${DIFFICULTY.dangerAt}</span></span></div>
    <div class="rs-t rs-crisis">🚨 At <b>0</b>, a meter triggers a <b>Crisis Event</b>.<br>A second crisis means <b>GAME OVER</b>.</div></div>`;
}
function renderJobHeading(index) {
  const [icon, title] = INTRO_JOBS[index];
  return `<div class="job-heading"><div class="job-icon">${icon}</div><div class="ptitle">JOB ${index + 1} · ${esc(title.toUpperCase())}</div></div>`;
}
function renderLoyalty(S = {}) {
  const name = S.introExampleName && !rosterNameIsPlayer(S.introExampleName,S) ? S.introExampleName : getRoster(S).names[0];
  return `<div class="intro loyaltyscr jobslide">${renderJobHeading(1)}
    <div class="loyalty-example"><div class="sectlbl">EXAMPLE UNIT MEMBER</div>
      <img src="${avatar('SSgt ' + name)}" alt="Example Unit member portrait">
      <div class="nm">${insignia('SSgt')} SSgt ${esc(name)}</div><div class="sub">One of the people you lead</div>
      <div class="loy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < 3 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="loyalty-value">LOYALTY: 3 / 5</div></div>
    <div class="rs-t">Loyalty: <b>0–5</b>. Your choices build or damage it.</div>
    <div class="rs-t"><b>0: Breaking Point.</b> <b>5: Ally support against the Inspector General.</b></div></div>`;
}
// Integrity is the first job, before loyalty and meters.
function renderIntegrity() {
  return `<div class="intro integscr jobslide">${renderJobHeading(0)}
    <div class="loyalty-example integrity-example"><div class="sectlbl">${esc(BOSS.title)}</div>
      <img src="${inspectorPortrait()}" alt="Inspector General portrait">
      <div class="nm">${combatLabel(BOSS.name)}</div>
      <div class="sub">Finds integrity violations at the inspection.</div></div>
    <div class="ig-big">ONE VIOLATION = <b>GAME OVER</b></div>
    <div class="ig-list"><span>🤥 Lie</span><span>🙈 Cover it up</span><span>📝 Fudge a record</span><span>⏭️ Skip the paperwork</span></div>
    </div>`;
}

function renderParty(S) {
  return `<div style="display:flex;flex-direction:column;gap:10px;height:100%"><div class="ptitle" style="text-align:center;font-size:24px">SELECT YOUR POSITION</div>
    ${S.callsign ? `<div class="ptitle" style="text-align:center;font-size:18px;color:var(--accent)">TEAM ${esc(S.callsign.toUpperCase())}</div>` : ''}
    <div class="classgrid">${positionPickOrder(S).map(c => {
      const who = S.party.find(p => p.cls === c.id && p.name);
      return `<div class="ccard ${who ? 'taken' : ''}" style="${who ? `border-color:${c.color}` : ''}"><div class="chead"><span class="ic">${clsIcon(c.id, 40)}</span><h3 style="color:${c.color}">${c.name}</h3>${who ? `<div class="who" style="background:${c.color}">${who.av != null ? `<img src="${avatarOf(who)}">` : ''}${esc(rankName(who))}</div>` : ''}</div>
        <div class="sub cline"><span style="color:var(--gold)">${c.rankLong}</span></div>
        <div class="ab"><b style="color:var(--accent)">${c.ability ? c.ability.icon + ' ' + esc(c.ability.name) : '👑 COMMAND'}</b> ${c.ability ? useHtml(c.ability.short || c.ability.text) : useHtml(c.abilityText, 'passive')}</div>
        
        <div class="cfoot"><div class="cfocus"><span class="cspec-lbl">FOCUS</span> <span class="mtag" style="--c:${['fc', 'chief'].includes(c.id) ? c.color : METER[c.spec[0]].color}">${esc(c.focus)}</span></div><div class="cspec"><span class="cspec-lbl">CHECK BONUS +1</span><div class="cspec-tags">${(c.spec || []).map(k => meterTag(k)).join(' ')}</div></div><div class="statline">${STATS.map(s => `${s} <b>+${c.stats[s]}</b>`).join(' · ')}</div></div></div>`;
    }).join('')}</div></div>`;
}

// Perk reveal: one card per cadet showing ONLY their class's two perks.
// Kit check follows the patch / DEOCS briefing so the team item is already in the bag.
function renderKitCheck(S) {
  return `<div class="kitchk"><div class="ptitle">🎒 CHECK YOUR KIT</div>
    <div class="sub">Tap <b>🎒 KIT</b> to review your position, ability, perk and team items—including <b>📋 DEOCS Survey</b>. Then tap <b>🎮 GAME</b> to come back.</div>
    <div class="kitrow">${S.party.map(p => { const c = CLASS[p.cls], pk = c.perks.find(k => k.id === p.perk);
      return `<div class="ccard ${p.kitOk ? 'taken' : ''}" style="${p.kitOk ? `border-color:${c.color}` : ''}"><div class="chead"><img src="${avatarOf(p)}" style="width:48px;height:48px;image-rendering:pixelated"><div><h3>${insignia(p)}${esc(rankName(p))}</h3><div class="sub" style="font-size:19px;color:${c.color}">${c.name}</div></div></div>
        <div class="kitline">${c.ability ? c.ability.icon : '👑'} <b>${esc(c.ability ? c.ability.name : 'Command Token')}</b></div><div class="kitline">${pk ? pk.icon : '🎁'} <b>${esc(pk ? pk.name : '-')}</b></div>
        <div class="kitst">${p.kitOk ? '✅ CHECKED' : '⏳ checking…'}</div></div>`; }).join('')}</div></div>`;
}
function renderPerks(S) {
  return `<div style="display:flex;flex-direction:column;gap:12px;height:100%"><div class="ptitle" style="text-align:center;font-size:24px">🎁 PERKS REVEALED: PICK ONE</div>
    <div class="perkgrid" style="grid-template-columns:repeat(${S.party.length},1fr)">${S.party.map(p => { const c = CLASS[p.cls]; return `<div class="ccard ${p.perk ? 'taken' : ''}">
      <div class="chead"><img src="${avatarOf(p)}" style="width:40px;height:40px;image-rendering:pixelated"><div><h3>${insignia(p)}${esc(rankName(p))}</h3><div class="sub" style="font-size:19px">${c.name}</div></div></div>
      <div class="sub" style="font-size:15px;line-height:1.35;padding:5px 8px"><b>PASSIVE BASELINE</b><br>${c.ability.icon} ${esc(c.ability.name)} · ${esc(c.ability.short.replace(/^Passive:\s*/i, ''))}</div>
      ${c.perks.map((k, j) => `<div class="perk big ${p.perk === k.id ? 'sel' : p.perk ? 'off' : ''}"><b>${p.perk === k.id ? '▶ ' : ''}<span class="pki">${k.icon}</span>${esc(k.name)}</b><div>${useHtml(k.text)}</div></div>`).join('')}
      <div class="sub" style="text-align:center;font-size:20px">${p.perk ? `✅ Locked in. ${S.party.every(x => x.perk) ? 'Waiting on Captain Russell.' : 'Waiting on the rest of the team...'}` : '⏳ choosing...'}</div></div>`; }).join('')}</div></div>`;
}

function renderAvatars(S) {
  return `<div style="display:flex;flex-direction:column;gap:14px;height:100%"><div class="ptitle" style="text-align:center">PICK YOUR CHARACTER ICON</div>
    <div class="sub" style="text-align:center">Pick on your phone 📱 · your icon also sets your gender in the game</div>
    ${AV_GROUPS.map(G => `<div class="sectlbl" style="font-size:14px">${G.label}</div><div class="avgrid">${G.idx.map(k => { const who = S.party.find(p => p.av === k); return `<div class="avc ${who ? 'taken' : ''}"><div class="avn">${avNum(k)}</div><img src="${who ? avatarOf(who) : presetAvatar(k)}"><div class="avw">${who ? esc(rankName(who)) : '&nbsp;'}</div></div>`; }).join('')}</div>`).join('')}</div>`;
}

function renderItemsBriefing(S) {
  return renderItemAward(S, { id: 'deocs', count: S.items.length });
}
function renderItemAward(S, award) {
  const item = LOOT.find(l => l.id === award?.id), dropped = LOOT.find(l => l.id === award?.dropped);
  if (!item) return '';
  return `<div class="intro items-briefing">
    <div class="loyalty-example item-award"><div class="ptitle">${item.icon} ${esc(item.name.toUpperCase())}</div><div class="rs-t">Added to your team’s items (${award.count}/3).</div><div class="rs-t">${mt(esc(fill(S, item.text)))}</div></div>
    ${dropped ? `<div class="rs-t item-dropped">🎒 Bag full: dropped the oldest item, ${dropped.icon} <b>${esc(dropped.name)}</b>.</div>` : ''}
    <div class="rs-t">${esc(INTRO_ITEMS)}</div></div>`;
}
function animateManifestRoll(S) {
  if (S.notice || S.manifestRollPending || !S.manifestRollAt || Date.now() >= S.manifestRollUntil) return;
  const roster = getRoster(), names = roster.names;
  const commander = document.querySelector('.org .ccpanel');
  if (commander) {
    const identity = commander.querySelector('.ccname'), image = commander.querySelector('.cchead > img');
    const finalIdentity = identity.innerHTML, finalImage = image.src;
    const rank = commanderRank(S);
    const candidates = names;
    const tickCommander = () => {
      if (!commander.isConnected) return;
      const elapsed = Date.now() - S.manifestRollAt;
      if (elapsed >= MANIFEST_REVEAL.commander) {
        identity.innerHTML = finalIdentity; image.src = finalImage;
        commander.classList.remove('org-rolling'); commander.classList.add('org-roll-locked'); return;
      }
      commander.classList.add('org-rolling');
      const candidate = candidates[Math.floor(elapsed / 120) % candidates.length];
      const name = `${rank} ${candidate}`;
      identity.innerHTML = `${insignia(rank)} ${esc(name)}`;
      image.src = avatar(name);
      setTimeout(tickCommander, 120);
    };
    tickCommander();
  }
  const members = S.npcs.slice().sort((a,b) => rankIdx(a.rank) - rankIdx(b.rank));
  document.querySelectorAll('.org .orgrow:last-child .orgcard').forEach((card, index) => {
    const n = members[index]; if (!n) return;
    const identity = card.querySelector('.nm'), trait = card.querySelector('.orgtrait'), image = card.querySelector(':scope > img');
    const finalIdentity = identity.innerHTML, finalTrait = trait.innerHTML, finalImage = image.src;
    const start = MANIFEST_REVEAL.commander + index * MANIFEST_REVEAL.stagger, end = start + MANIFEST_REVEAL.member;
    const tick = () => {
      if (!card.isConnected) return;
      const elapsed = Date.now() - S.manifestRollAt, frame = Math.floor(elapsed / 120) + index * 7;
      if (elapsed >= end) {
        identity.innerHTML = finalIdentity; trait.innerHTML = finalTrait; image.src = finalImage;
        card.classList.remove('org-rolling', 'org-roll-waiting'); card.classList.add('org-roll-locked'); return;
      }
      card.classList.toggle('org-rolling', elapsed >= start);
      card.classList.toggle('org-roll-waiting', elapsed < start);
      if (elapsed < start) {
        identity.textContent = '🎲 ASSIGNING…'; trait.textContent = '—'; image.style.visibility = 'hidden';
      } else {
        image.style.visibility = '';
        const rolledName = elapsed >= start + 1700 ? n.name : names[frame % names.length];
        const rolledRank = elapsed >= start + 1000 ? n.rank : ['Amn','A1C','SrA','SSgt'][frame % 4];
        identity.innerHTML = `${insignia(rolledRank)}${esc(rolledRank)} ${esc(rolledName)}`;
        image.src = elapsed >= start + 1700 ? finalImage : avatar(rolledName + rolledRank);
        const t = TRAITS[frame % TRAITS.length]; trait.textContent = `${t.icon} ${t.name}`;
      }
      setTimeout(tick, Math.min(120, (elapsed < start ? start : end) - elapsed));
    };
    tick();
  });
}
function renderRosterChoices(S) {
  return `<div class="roster-choice-screen"><div class="ptitle">CHOOSE THE GAME’S NAMES</div><div class="sub">Pick one roster for your commander, unit, and other characters.</div><div class="roster-choice-grid">${ROSTER_OPTIONS.map((r,i) => `<div class="roster-choice-card"><div class="roster-choice-heading">${rosterPin(r,52)}<div><h3>${i+1}. ${esc(r.name)}</h3><small>${esc(r.rank)}</small></div></div><p>${esc(r.names.filter(n => !rosterNameIsPlayer(n,S)).join(' · '))}</p>${voteDots(S,r.id)}</div>`).join('')}</div></div>`;
}
function renderManifest(S) {
  // Pending notices must not expose the already-generated roster before its reveal.
  if (S.manifestRollPending || (S.notice && !S.manifestRollAt)) return '<div class="org-reveal-blank" aria-label="Org chart reveal pending"></div>';
  const u = UNITS.find(x => x.id === S.unit), cc = u.cc;
  return `<div style="display:flex;flex-direction:column;gap:8px;overflow:hidden">
    <div class="ptitle" style="text-align:center">ORGANIZATIONAL CHART</div>
    <div class="org">
      <div class="ccpanel" style="--c:${u.color}">
        <div class="cchead"><img src="${avatar(S.cc)}"><div style="flex:1"><div class="cclbl">${ccBadge(24)} SQUADRON COMMANDER</div><div class="ccname">${insignia(commanderRank(S))} ${esc(S.cc)}</div></div><div class="ccunit"><span class="ccunit-icon">${u.icon}</span><div class="ccunit-label">${esc(u.sq.toUpperCase())}</div></div></div>
        <div class="cctiles">
          <div class="cct" style="--t:var(--gold)"><div class="ctl">${ccBadge(20)} INTENT</div><div class="ctb">${meterTag(cc.intent)}</div><div class="cts">Their top priority</div></div>
          <div class="cct" style="--t:var(--good)"><div class="ctl">👍 REWARDS</div><div class="ctb">${esc(cc.pos.name)}</div><div class="cts">${mt(esc(cc.pos.text))}</div></div>
          <div class="cct" style="--t:var(--bad);${S.flags.ccNegOff ? 'opacity:.4;text-decoration:line-through' : ''}"><div class="ctl">👎 PUNISHES</div><div class="ctb">${esc(cc.neg.name)}</div><div class="cts">${mt(esc(cc.neg.text))}</div></div>
          <div class="cct" style="--t:var(--accent)"><div class="ctl">⚠️ SQUADRON PENALTY</div><div class="cts">${esc(squadPenaltyText(S.unit, Date.now() < (S.manifestRollUntil || 0) ? null : S))}</div></div>
        </div></div>
      <div class="orgline"></div>
      <div class="orgrow">${patchOf(S) ? `<span class="pch on orgpatch" style="--c:${u.color}"><b>${patchOf(S).icon}</b>${esc(patchOf(S).name)}</span>` : ''}${S.party.map(p => `<div class="orgcard mini" style="border-color:${clsColor(p)}"><img src="${avatarOf(p)}"><div><div class="nm">${insignia(p)}${esc(rankName(p))}</div><div class="rk">${CLASS[p.cls].name}</div></div></div>`).join('')}</div>
      <div class="orgline"></div>
      <div class="orgrow">${S.npcs.slice().sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank)).map(n => { const t = TRAIT[n.trait]; return `<div class="orgcard ${n.gone ? 'gone' : ''}"${n.gone ? ` title="${n.deceased ? 'Deceased' : (S.unit === 'ch' && n.slot === 'D') ? 'Deployed for the inspection' : 'Permanently left the unit'}"` : ''}><img src="${avatar(n.name + n.rank)}"><div class="rk orgpub">${esc(n.pub)}</div>${n.gone ? `<div class="rk">${n.deceased ? '🕯️ DECEASED' : (S.unit === 'ch' && n.slot === 'D') ? 'DEPLOYED FOR INSPECTION' : 'LEFT THE UNIT'}</div>` : ''}<div class="orgfooter"><div class="nm">${insignia(n.rank)}${esc(n.rank)} ${esc(n.name)}</div><div class="orgability"><div class="rk orgtrait" style="color:var(--good)">${t.icon} ${esc(t.name)}</div><div class="orgdetails">${traitInfo(n, isAlly(n), (S.traitDone || {})[n.slot]).map(([k, x]) => `<div class="rk ${k}">${mt(esc(x))}</div>`).join('')}</div></div><div class="rk orgloyband">${loyBandHtml(n.loy, isAlly(n), n.broken)}</div><div class="loy orgloy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div></div></div>`; }).join('')}</div>
    </div>
    </div>`;
}
// Team patch = team name: its own screen after the squadron reveal, before the org chart
function renderPatch(S) {
  const u = UNITS.find(x => x.id === S.unit);
  return `<div class="patchscr"><div class="ptitle">🎖️ PICK YOUR TEAM PATCH</div>
    <div class="sub">${u.icon} ${esc(u.sq)} · the patch is your team's name on the leaderboard · 📋 choosing a patch gives the team a DEOCS Survey item${S.patch ? ' · LOCKED IN ✅' : ''}</div>
    <div class="patchrow big">${(PATCHES[S.unit] || []).map(p => { const taken = (P.usedPatches || []).includes(`${S.unit}:${p.id}`); return `<span class="pch ${S.patch === p.id ? 'on' : S.patch ? 'off' : ''} ${taken ? 'taken' : ''}" style="--c:${u.color}"><b>${p.icon}</b>${esc(p.name)}${taken ? '<br>TAKEN' : ''}${S.patch ? '' : voteDots(S, p.id)}</span>`; }).join('')}</div>${renderTie(S)}</div>`;
}

// The route map: at every stop the party picks one of the 2-3 options its paths reach (votes show as avatars).
function renderMap(S) {
  const n = S.map.tiers.length, W = 1000, H = 580, startX = 48, bossX = 946, gap = 165;
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
  // Checkpoint names have their own header rows, clear of STOP labels and encounter nodes.
  const CHK = { inject: { ...CHECKPOINT.inject, name: 'INJECT', mark: k => checkMark(S, k, 'inject') },
    level: { ...CHECKPOINT.level, name: 'LEVEL UP', mark: k => checkMark(S, k, 'level') } };
  const w = S.wp;
  for (let k = 0; k < n; k++) checks(k).forEach((kind, ci, all) => {
    const x0 = pt(k, 0)[0], x1 = pt(k + 1, 0)[0], gx = x0 + (x1 - x0) * (ci + 1) / (all.length + 1);
    const C = CHK[kind], st = C.mark(k), past = st === 'past';
    const col = past ? '#8f8fc8' : C.color;
    lines += `<line x1="${gx}" y1="72" x2="${gx}" y2="${H - 18}" stroke="${col}" stroke-width="2" stroke-dasharray="3 9" opacity="${past ? 0.2 : 0.45}"/>`;
    nodes += `<text x="${gx}" y="${kind === 'level' ? 60 : 38}" font-size="8" fill="${col}" text-anchor="middle" font-family="'Press Start 2P'" opacity="${past ? 0.6 : 1}">${past ? '✅ ' : ''}${C.name}</text>`;
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
      ${['elite', 'spot'].includes(nd.type) ? `<text x="${x + 29}" y="${y + 31}" font-size="20" text-anchor="middle" aria-label="Loot reward opportunity">🎁</text>` : ''}
      <text x="${x}" y="${top ? y - 50 : y + 62}" font-size="10" fill="${nt.color}" text-anchor="middle" font-family="'Press Start 2P'">${esc(label)}</text>
      ${vs.map((p, j) => { const ix = x - 40 + j * 21, iy = top ? y + 44 : y - 64; return `<rect x="${ix - 2}" y="${iy - 2}" width="24" height="24" fill="${clsColor(p)}"/><image href="${avatarOf(p)}" x="${ix}" y="${iy}" width="20" height="20" style="image-rendering:pixelated"/>${p.cls === 'fc' ? `<text x="${ix + 10}" y="${top ? iy + 36 : iy - 4}" font-size="13" text-anchor="middle">👑</text>` : ''}`; }).join('')}
      ${nd.done ? `<text x="${x + 32}" y="${y - 26}" font-size="26" text-anchor="middle">✅</text>` : ''}</g>`;
  }));
  return `<div style="display:flex;flex-direction:column;height:100%;gap:10px">${S.phase === 'mapRoll' ? `<div class="seedroll"><span>🎲 ROLLING ROUTE</span><span class="seednum">${String(S.mapSeed || 0).padStart(10, '0')}</span><small>${S.mapRoll}/10</small></div>` : S.phase === 'map' && S.mapSeed != null ? `<div class="seedlocked">🎲 FINAL ROUTE SEED · ${S.mapSeed}</div>` : ''}${S.phase !== 'mapRoll' && (S.bossReady || wpo.length || S.branch) ? `<div class="ptitle" style="font-size:20px">${S.bossReady ? `${igIcon(28)} THE IG IS NEXT` : wpo.length ? `${CHECKPOINT[wpo[0].kind].icon} PICK YOUR ${CHECKPOINT[wpo[0].kind].short} WAYPOINT` : ''} <span class="ptsub">${S.phase === 'mapRoll' || S.bossReady ? '' : `${wpo.length > 1 ? '· locks in your path' : ''}`}</span>${S.branch ? ' · 🌿 BRANCH PLAN: ANY NEXT STOP' : ''}</div>` : ''}
    <div class="mapwrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${lines}
      <g><rect x="${startX - 40}" y="${H / 2 - 40}" width="80" height="80" fill="#14143a" stroke="#7dff6b" stroke-width="5"/><text x="${startX}" y="${H / 2 + 15}" font-size="42" text-anchor="middle">${patchOf(S)?.icon || '🎖️'}</text><text x="${startX}" y="${H / 2 + 62}" font-size="10" fill="#7dff6b" text-anchor="middle" font-family="'Press Start 2P'">START</text></g>
      ${nodes}
      <g><rect x="${bossX - 48}" y="${H / 2 - 48}" width="96" height="96" fill="${S.bossReady ? '#5a1020' : '#3a0010'}" stroke="${S.bossReady ? '#ffd23f' : '#ff2e63'}" stroke-width="${S.bossReady ? 10 : 7}">${S.bossReady ? '<animate attributeName="stroke-opacity" values="1;0.35;1" dur="1s" repeatCount="indefinite"/>' : ''}</rect><image href="${inspectorPortrait()}" x="${bossX - 40}" y="${H / 2 - 40}" width="80" height="80" style="image-rendering:pixelated"/><text x="${bossX}" y="${H / 2 + 72}" font-size="10" fill="${S.bossReady ? '#ffd23f' : '#ff2e63'}" text-anchor="middle" font-family="'Press Start 2P'">THE IG</text></g>
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
  if (isFreeLoot(c)) return `<div class="titlescr"><div style="font-size:90px">🎁</div><div class="ptitle">FREE LOOT</div><div class="sub">An item for the team. No purchase needed.</div>${renderPowerups(S)}</div>`;
  const rest = c.type === 'rest';
  // the BX has more options, so it gets a compact one-line header
  const head = rest || c.step !== 'choose' ? `<div style="text-align:center"><span style="font-size:90px">${rest ? '🏕️' : '🛒'}</span><div class="ptitle">${rest ? 'REST STOP' : 'BASE EXCHANGE (BX)'}</div>
    <div class="sub">${c.step === 'choose' ? 'Pick ONE' : ''}</div></div>`
    : `<div style="text-align:center"><div class="ptitle"><span style="font-size:44px;vertical-align:middle">🛒</span> BASE EXCHANGE (BX)</div><div class="sub">One purchase</div></div>`;
  if (c.step === 'train') return `<div class="titlescr">${head}<div class="ptitle" style="font-size:22px">📚 STUDY GUIDES: WHO STUDIES WHICH STAT?</div></div>`;
  if (c.step !== 'choose' && c.step !== 'who') return `<div class="titlescr">${head}<div class="ptitle" style="color:var(--good);font-size:24px">${esc(c.result || '')}</div>${renderPowerups(S)}</div>`;
  const crunch = isPreIGRest() ? '<div class="banner blue">🕒 TIME CRUNCH · PRE-IG REST −50%</div>' : '';
  const opts = stopOptions();
  if (c.step === 'who') return `<div style="display:flex;flex-direction:column;gap:14px;height:100%;justify-content:center">${head}<div class="ptitle" style="text-align:center;font-size:22px">WHO PAYS? ${c.trade === 'favor' ? '(−2 loyalty, free loot spin)' : '(−1 loyalty, +3 🎯)'}</div>
    <div class="optgrid">${opts.map(o => `<div class="choice ${o.dis ? 'dim' : ''}" style="grid-template-columns:1fr;position:relative"><div class="ct">${mt(esc(o.label))}</div>${voteDots(S, o.key)}</div>`).join('')}</div></div>`;
  return `<div style="display:flex;flex-direction:column;gap:14px;height:100%;justify-content:center">${head}${crunch}
    <div class="optgrid ${rest ? '' : 'bx'}">${opts.map(o => `<div class="choice ${o.dis ? 'dim' : ''}" style="grid-template-columns:1fr;position:relative"><div class="ct">${mt(esc(o.label))}</div>${voteDots(S, o.key)}</div>`).join('')}</div>${renderPowerups(S)}</div>`;
}

function renderNode(S) {
  const c = S.cur; if (!c) return '';
  if (c.type === 'rest' || c.type === 'depot') return renderStop(S, c);
  if (c.type === 'unknown') return `<div class="titlescr" style="padding-bottom:110px"><div style="font-size:100px">❓</div><div class="ptitle">UNKNOWN TERRITORY</div>${c.step === 'revealed' && c.mystery != null ? `<div class="ptitle" style="color:var(--accent)">${sceneIcon(MYSTERY[c.mystery],36)} ${MYSTERY[c.mystery].name}</div>` : `<div class="sub">Anything can happen. The d6 decides:</div><div class="wheelpick">${MYSTERY.map((x, i) => `<span style="--c:${x.color}"><b>${i + 1}</b>${sceneIcon(x,28)} ${x.name}</span>`).join('')}</div>`}</div>`;
  const m = curMission();
  const actOutEncounter = isActOutEncounter(S, m);
  const ce = c.type === 'crisisEvent';
  const hint = c.step === 'roll' ? (() => {
      const ch = c.spec.check, what = ch.stat === 'LOYB' ? `${npcLabel(S, 'B')}'s loyalty` : ch.stat || 'luck';
      if (!c.rollerLocked) return `<div class="rollbig">🗳️ WHO ROLLS ${esc(what)}? </div>${rollerVoteHtml(S, i => rollerOdds(S, i), 'r')}`;
      const p = rollPreview(), r = c.roller;
      const need = Math.min(20, Math.max(2, p.dc - p.total));
      return `<div class="rollbig">🎲 ${esc((rankName(S.party[r]) || '?').toUpperCase())} ROLLS ${esc(what)} ${sign(p.total)} · GOAL DIE <b>${need}+</b> <span>(${(21 - need) * 5}%)</span></div>`; })()
    : c.step === 'stars' ? `<div class="banner gold">🎤 ${c.type === 'spot' ? 'SPOTLIGHT SCENE' : 'ACT IT OUT'}: ${c.lead != null ? `${esc(rankName(S.party[c.lead]).toUpperCase())} DOES THE TALKING!` : 'SPIN TO SEE WHO TALKS...'}<br>Captain Russell plays: ${esc(fill(S, m.choices[c.choice]?.roleplay || 'the other side'))}.</div>` : '';
  let result = '';
  if (c.step === 'done') {
    if (c.rollRes) { const r = c.rollRes; result = `<div class="banner ${r.pass ? 'gold' : ''}">🎲 ${r.d20} → ${r.total} vs ${r.dc}: ${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED'}</div>`; }
    else if (c.stars) result = `<div class="banner gold">🎤 ${'⭐'.repeat(c.stars)}</div>`;
    else result = `<div class="banner blue">DECISION LOCKED IN</div>`;
  }
  return `<div class="mcard ${c.step === 'brief' ? '' : 'compact'}">
    <div class="mhead"><div class="ic">${sceneIcon(m,64)}</div><div><h2 style="${ce ? 'color:var(--bad)' : ''}">${ce ? '🚨 CRISIS EVENT: ' : c.type === 'elite' ? '💀 ELITE: ' : ''}${esc(m.title)}</h2><div class="sob">${objChips(m) ? `<span class="objlbl">TESTS</span>${objChips(m)}` : esc(m.sob)}</div></div></div>
    ${c.type === 'elite' ? '<div class="banner">💀 ELITE SCENARIO: every choice requires a d20 check · loot on success</div>' : ''}
    ${m.cc ? `<div class="banner gold">${ccBadge(26)} COMMANDER ENCOUNTER: ${esc(S.cc.toUpperCase())}</div>` : ''}
    ${c.step === 'brief' && arrowsHidden(S) ? '<div class="banner blue">🔍 COMPARTMENTED: no arrows. Decide on the facts.</div>' : ''}
    ${S.banner ? `<div class="banner ${S.banner.cls || ''}">${esc(S.banner.text)}</div>` : ''}
    <div class="situ">${esc(fill(S, m.text))}</div>
    ${ce ? `<div class="crisisloss">💀 LOST FOR GOOD: ${mt(esc(fill(S, m.loss || '')))}</div>${c.step === 'brief' ? '<div class="banner">⚠️ ONE MORE CRISIS EVENT = GAME OVER. Dig out without dropping another meter to zero.</div>' : ''}${m.help ? `<div class="helpline">💙 ${esc(CRISIS_HELP)}</div>` : ''}` : ''}
    ${hint}${renderPowerups(S)}
    <div class="choices" ${c.choice != null ? 'style="grid-template-columns:1fr"' : ''}>${m.choices.map((ch, i) => c.choice != null && c.choice !== i ? '' : `<div class="choice ${c.choice === i ? 'picked' : ''} ${actOutEncounter ? 'hasmic' : ''}">
      <div class="key">${'ABCD'[i]}</div><div><div class="ct">${esc(fill(S, ch.t))}</div>${ch.trap && benderTell(S) ? '<div class="req" style="color:var(--warn)">⚠️ SMELLS LIKE A SHORTCUT</div>' : ''}
      ${c.step === 'done' && c.choice === i ? `<div class="arrows realres"><b>RESULT:</b> ${resultChips(S)}</div>` : !arrowsHidden(S) ? `<div class="arrows">${arrows(choiceShow(ch))}</div>` : ''}
      ${c.intel ? `<div class="intel">🔎 ${effHtml(specText(S, ch))}</div>` : ''}</div>
      ${actOutEncounter ? '<div class="micbadge">🎤 ACT IT OUT · RATE 1–3★</div>' : choiceCheckLabel(S, ch) ? `<div class="dicebadge">🎲 ROLL<span>${esc(choiceCheckLabel(S, ch))}</span></div>` : ''}${voteDots(S, i)}</div>`).join('')}</div>
    ${c.step === 'brief' ? `<div class="sub" style="font-size:22px">${actOutEncounter ? (c.type === 'spot' ? '🔦 Spotlight choice: act it out for a 1–3 star rating · only the spotlighted cadet decides · everyone else stays silent · ' : '🎤 This scenario is Act It Out: every choice is rated 1–3 stars · ') : ''}${actOutEncounter ? '' : '🎲 roll to resolve checks · '}<span class="up">▲</span> raises · <span class="dn">▼</span> lowers · ❔ = depends</div>` : ''}
    ${result}${c.step === 'done' ? eventRecapHtml(S) : ''}${c.step === 'done' && c.lootMessage ? `<div class="banner bad">${esc(c.lootMessage)}</div>` : ''}</div>`;
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
      <div class="whoroll">🗳️ WHO ROLLS? </div>${rollerVoteHtml(S, i => tackleOdds(S, m, i), 'r')}${pu}</div>`;
    return `<div class="titlescr"><div class="bigcard bad"><div class="sectlbl">💪 TACKLE IT</div><h2 style="margin-top:10px">${esc(m.name)}</h2>
      <div class="bt tkbox">${tackleRows(m, inj.roller)}</div></div>
      <div class="whoroll">🎲 ${esc(r ? rankName(r).toUpperCase() : '?')}, ROLL ON YOUR PHONE!</div>${pu}</div>`; }
  const vote = m.options && inj.stage === 'result' && !inj.blocked;
  return `<div class="titlescr injscr"><div class="bigcard ${cls}"><div class="sectlbl">${INJECT_WHEELS[m.type].icon} ${INJECT_WHEELS[m.type].name}</div><h2 style="margin-top:10px">${esc(m.name)}</h2>
    <div class="bt">${esc(fill(S, m.text || ''))}</div>${m.options ? '' : `<div class="bt injeff">${effLines(S, m.eff)}</div>`}
    ${inj.note ? `<div class="bt" style="color:var(--gold)">${esc(fill(S, inj.note))}</div>` : ''}</div>
    ${vote ? `<div class="whoroll" style="font-size:16px">✋ HOW DO YOU RESPOND? </div>
      <div class="optgrid" style="width:100%;grid-template-columns:repeat(${m.options.length + (m.tackle ? 1 : 0)},1fr)">${m.options.map((o, i) => `<div class="choice" style="grid-template-columns:48px 1fr;position:relative"><div class="key">${'AB'[i] || i + 1}</div><div><div class="ct">${esc(fill(S, o.t))}</div><div class="arrows">${effLines(S, o.eff)}</div></div>${voteDots(S, i)}</div>`).join('')}
        ${m.tackle ? `<div class="choice" style="grid-template-columns:48px 1fr;position:relative"><div class="key">💪</div><div><div class="ct">💪 TACKLE IT · ${m.tackle.stat} roll</div>${tackleRows(m)}</div>${voteDots(S, m.options.length)}</div>` : ''}</div>` : ''}${pu}</div>`;
}

function renderLevel(S) {
  return `<div class="titlescr"><div class="logo" style="font-size:60px">LEVEL UP!</div>${teamTag(S) ? `<div class="ptitle" style="font-size:18px;color:var(--gold)">${esc(teamTag(S))}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(${S.party.length},1fr);gap:16px;width:100%">${S.party.map(p => `<div class="ccard ${p.up ? 'taken' : ''}" style="align-items:center;text-align:center">
      <img src="${avatarOf(p)}" style="width:80px;height:80px;image-rendering:pixelated"><h3>${insignia(p)}${esc(rankName(p))}</h3><div class="sub">${CLASS[p.cls].name}</div>
      ${CLASS[p.cls].ups.map(u => `<div class="ab" style="${p.up === u.id ? 'color:var(--gold)' : p.up ? 'opacity:.3' : ''}">${p.up === u.id ? '▶ ' : ''}<b>${esc(u.name)}</b>: ${mt(esc(u.text))}</div>`).join('')}</div>`).join('')}</div></div>`;
}

function animateBossPhase(root, phase) {
  const nav = root.querySelector('.boss-phase-track'); if (!nav) return;
  const labels = [...nav.querySelectorAll(':scope>span')], previous = P.bossPhase;
  // Animation holds can still carry the prior phase in their veiled snapshot.
  if (previous != null && phase < previous && P.S?.gmNext) phase = previous;
  if (nav._phase === phase) return;
  nav._phase = phase; P.bossPhase = phase;
  labels.forEach((el, i) => {
    el.classList.toggle('active', i === phase); el.classList.toggle('complete', i < phase);
    if (i === phase) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  });
  nav._motion?.cancel();
  let cursor = nav.querySelector('.boss-phase-cursor');
  if (!cursor) { cursor = document.createElement('i'); cursor.className = 'boss-phase-cursor'; cursor.setAttribute('aria-hidden', 'true'); nav.appendChild(cursor); }
  const target = labels[phase];
  if (!target) { cursor.style.opacity = '0'; return; }
  const bounds = nav.getBoundingClientRect();
  const position = el => { const r = el.getBoundingClientRect(); return { left: `${r.left - bounds.left}px`, top: `${r.top - bounds.top}px`, width: `${r.width}px`, height: `${r.height}px` }; };
  const end = position(target); Object.assign(cursor.style, end, { opacity: '1' });
  if (previous != null && previous !== phase && labels[previous] && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nav._motion = cursor.animate([position(labels[previous]), end], { duration: 650, easing: 'cubic-bezier(.22,.68,.16,1)' });
  }
}
function renderCombatSupport(lineup) {
  if (!lineup.length) return '';
  return `<div class="combat-support-lineup" aria-label="Support lineup">${lineup.map(v => {
    const p = v.portrait;
    return `<div class="combat-support-member ${v.active ? 'active' : v.done ? 'complete' : ''}" aria-label="${esc(v.name)}: ${v.active ? 'supporting now' : v.done ? 'finished' : 'waiting'}">${p ? `<img src="${p.av != null ? presetAvatar(p.av, p.uni, p.hair) : avatar(p.seed)}" alt="">` : ''}<span>${combatLabel(v.name)}</span><b>${v.done ? '✓' : v.active ? '➜' : v.kind === 'cc' ? '👍' : '🤝'}</b></div>`;
  }).join('')}</div>`;
}
function renderCombatMeters(S) {
  return `<div class="combat-team-meters">${METERS.map(m => meterHtml(S, m)).join('')}</div>`;
}
function renderHotSeatSpeaker(S) {
  const b = S.boss;
  if (!['hotseat','interviewResult'].includes(b.stage) || !b.p2?.who?.length) return '';
  return `<div class="hotseat-speaker" aria-label="Hot Seat speaker">${b.p2.who.map(i => {
    const p = S.party[i];
    return `<div class="hotseat-speaker-member"><small>🎤 HOT SEAT</small><img class="hotseat-speaker-avatar" src="${avatarOf(p)}" alt="${esc(rankName(p))}"><b>${combatLabel(rankName(p), S)}</b></div>`;
  }).join('')}</div>`;
}
function renderBossArena(S) {
  const b = S.boss, patch = patchOf(S) || { icon: '🎖️', name: 'YOUR FLIGHT' };
  const intent = b.atk && !['done', 'resolved'].includes(b.stage) && b.hp > 0;
  const phase = b.stage === 'done' ? 6 : b.round ? b.round + 2 : b.stage === 'opening' ? 0 : b.stage === 'vouch' ? 1 : 2;
  const progress = ['1 · OPENING', '2 · SUPPORT', '3 · AUDIT', '4 · RECORDS', '5 · INTERVIEW', '6 · EXERCISE'];
  return `<section class="battle-stage"><header class="combat-action battle-heading"><nav class="boss-phase-track" aria-label="Inspection phases">${progress.map((label, i) => `<span class="${i === phase ? 'active' : i < phase ? 'complete' : ''}"${i === phase ? ' aria-current="step"' : ''}>${label}</span>`).join('')}</nav><b class="combat-action-title">${b.round ? `ROUND ${b.round} · ` : ''}${bossStageLabel(b)}</b><span class="combat-action-actor"></span></header>
    ${renderCombatSupport(bossSupportLineup(S))}
    <div class="combat-arena"><div class="combat-fighter combat-flight"><div class="combat-patch">${patch.icon}</div><b>${esc(patch.name)}</b>${renderCombatMeters(S)}<span class="combat-meter">${b.block ? `🛡️ ${b.block} BLOCK` : ''}</span><div class="combat-shield ${b.block ? 'visible' : ''}">🛡️</div><div class="combat-popup"></div></div>
      ${renderHotSeatSpeaker(S)}<div class="combat-fighter combat-ig ${b.hp <= 0 ? 'combat-ig-defeated' : ''}">${intent ? `<div class="combat-intent"><small>${b.stage === 'enemy' ? 'ATTACK' : 'NEXT ATTACK'}</small><span>${METER[b.atk.k].icon} ${METER[b.atk.k].label} −${b.atk.n}</span></div>` : ''}<canvas id="bossCv" width="32" height="32"></canvas><div class="combat-ig-hp ${b.hp > b.max ? 'bonus-hp' : ''}"><i style="width:${Math.max(0, Math.min(100, b.hp / b.max * 100))}%"></i><span><b class="combat-hp ${b.hp > b.max ? 'over-base' : ''}">${b.hp}</b> / ${b.max} HP</span></div><b>${combatLabel(BOSS.name)}</b><div class="combat-popup"></div></div></div>
    </section>`;
}

function renderBoss(S) {
  const b = S.boss; if (!b) return '';
  const stage = b.stage, preview = bossAttackPreview(S);
  const votes = action => `<div class="battle-votes">${S.party.filter((_, i) => b.votes[i] === action).map(p => `<img src="${avatarOf(p)}" title="${esc(rankName(p))}" alt="${esc(p.name)}">`).join('')}</div>`;
  const line = text => `<p class="boss-snippet">${combatText(text)}</p>`;
  const reductions = entries => (entries || []).map(r => line(lossReductionText(r))).join('');
  let content = '';
  if (stage === 'opening') {
    const e = b.openingCurrent;
    content = line(e ? bossOpeningNarration(e) : 'Squadron and position passives adjust the IG’s starting HP.');
  } else if (stage === 'vouch') {
    const v = b.vouchCurrent || b.vouches?.[b.vouchIdx];
    content = line(v ? bossSupportNarration(v) : 'Allies and the commander support the flight before the Audit.');
  } else if (stage === 'intro') content = line('The IG checks integrity, then your readiness deals damage.');
  else if (stage === 'integrityStrike') content = line('Integrity violation. The flight is relieved.');
  else if (stage === 'auditResult') content = line(`✅ Integrity passed. Readiness${b.auditResult?.honest ? ' and Honest Broker' : ''} dealt ${b.auditResult?.damage || 0} damage.`);
  else if (stage === 'intent') content = line(b.round === 2 ? 'One cadet faces the Hot Seat before your team acts.' : 'Your team acts first: attack or defend.');
  else if (stage === 'hotseat') {
    if (!b.p2.who) content = line('Everyone rolls. The lowest roll faces the Hot Seat.') + `<div class="hotseat-rolls">${S.party.map((p, i) => p.name && !p.fired ? `<div class="hotseat-result"><b>${combatLabel(rankName(p), S)}</b><strong>${b.p2.settled?.[i] ? b.p2.rolls[i] : b.p2.rolls?.[i] != null ? '🎲' : '—'}</strong></div>` : '').join('')}</div>`;
    else content = b.p2.who.map((i, j) => `<div class="boss-hotseat-name">🎤 ${combatLabel(rankName(S.party[i]), S)} · rolled ${b.p2.rolls[i]}${b.p2.tied ? ' · tie pick' : ' · lowest'}</div><blockquote>${esc(b.p2.q[j])}</blockquote><p class="boss-snippet">${b.p2.stars[j] ? '⭐'.repeat(b.p2.stars[j]) : 'Act it out · 1–3 stars deal 1–3 damage.'}</p>`).join('');
  } else if (stage === 'interviewResult') content = line(`🎤 ${b.p2.stars[0]} stars · IG takes ${b.interviewDamage || 0} damage.`) + reductions(b.interviewReductions);
  else if (stage === 'act') {
    const loss = k => meterLossPreview(b.atk.k, k, S).loss;
    content = `<div class="battle-hand"><div class="battle-card ${b.teamAction === 'press' ? 'selected' : ''}"><header>🗡️ ATTACK</header><p>${preview ? `🎯 Die ${preview.need}+ · 2 damage (critical: 4)<br>${combatLabel(preview.name, S)}` : 'No attacker available.'}</p><footer>If IG survives: ${METER[b.atk.k].label} −${loss(b.atk.n)}</footer>${votes('press')}</div><div class="battle-card defend ${b.teamAction === 'defend' ? 'selected' : ''}"><header>🛡️ DEFEND</header><p>Gain 2 Block for this round.</p><footer>${METER[b.atk.k].label} loss after Block: ${loss(Math.max(0, b.atk.n - 2))}</footer>${votes('defend')}</div></div>`;
  } else if (stage === 'playerResult') {
    const t = b.turnResult;
    content = line(t?.action === 'defend' ? '🛡️ 2 Block ready for the IG’s attack.' : `IG takes ${t?.damage || 0} damage.${b.hp <= 0 ? ' Attack cancelled.' : ' The IG acts next.'}`) + reductions(t?.reductions);
  } else if (stage === 'enemy') {
    const blocked = Math.min(b.atk.n, b.block || 0), forecast = meterLossPreview(b.atk.k, Math.max(0, b.atk.n - blocked), S);
    content = line(`${b.atk.name}: ${METER[b.atk.k].label} −${forecast.loss}${blocked ? ` · ${blocked} blocked` : ''}.`) + reductions(forecast.reduction ? [forecast.reduction] : []);
  } else if (stage === 'resolved') content = line(`${b.atk.name}: ${METER[b.atk.k].label} −${b.attackDamage || 0}${b.attackBlocked ? ` · ${b.attackBlocked} blocked` : ''}.`) + reductions(b.enemyReductions);
  else if (stage === 'done') { const defeat = bossDefeatScore(S); content = `<h3>${esc(b.result)}</h3>${defeat ? line(`🏆 Phase ${defeat.phase} victory · 30 ×${defeat.multiplier} = +${defeat.points} points`) : ''}`; }
  return `<section class="battle battle-minimal">${renderBossArena(S)}<div class="battle-turn battle-details">${content}</div></section>`;
}

// The grade is built up: each score line ticks in, then the total, a drumroll, and the letter slams down.
const REVEAL = { step: 700, drum: 2400 };
function renderResults(S) {
  if (!S.final) return '';
  const f = { ...S.final, parts: displayScoreParts(S.final.parts) };
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
      ? `<div class="grade slam" style="color:${g.color}">${g.g}</div>`
      : `<div class="grade" style="color:var(--dim)">${showTotal ? '<span class="blink">?</span>' : '?'}</div><div class="ptitle" style="font-size:16px;color:var(--dim)">${showTotal ? 'THE BOARD IS DELIBERATING...' : 'TALLYING YOUR RECORD...'}</div>`}
      <figure class="results-inspector${S.boss?.hp === 0 && !S.gameOver ? ' defeated' : ''}"><img src="${inspectorPortrait()}" alt="Inspector General Lt Col Cacic"><figcaption>${combatLabel(BOSS.name)}</figcaption></figure></div>
    <div>${showGrade ? `<div class="box" style="font-size:28px;font-style:italic">OPB Strat: ${esc(g.strat)}</div>` : ''}
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
  if (dv.view === 'objectives') return `<div class="real"><h2>Tested Samples of Behavior</h2><div class="sub">The five samples of behavior, and the moments in YOUR run that tested each one.</div>
    <div class="objdeb">${OBJECTIVES.map(o => { const ev = (S.objLog || []).filter(e => objEventIds(e).includes(o.id)); return `<div class="od"><h3>${o.icon} ${esc(o.name)}</h3><div class="ot">${esc(o.text)}</div>
      ${ev.length ? `<ul>${ev.map(e => `<li><b>Stop ${e.n} · ${esc(e.title)}</b>${e.choice ? `<br>"${esc(e.choice)}"` : ''}</li>`).join('')}</ul>` : '<div class="ot" style="opacity:.6">Not tested in this run. Talk through where it shows up in your future job.</div>'}</div>`; }).join('')}</div></div>`;
  return `<div class="real"><h2>Back to reality</h2><div class="sub">The game is over. Here's what each piece actually was.</div>
    <table class="dec">${DECODER.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>`;
}
