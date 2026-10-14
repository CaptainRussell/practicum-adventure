/* =====================================================================
   PRACTICUM ADVENTURE - cadet phone controller (join.html)
   Connects to the GM console's room over PeerJS and shows a phone-sized
   view of the game. Everything a cadet taps is a request; the GM console
   checks it and stays in charge of the game.
   ===================================================================== */
const PHONE_PREFIX = 'afas3410-sq-';
const PH = { peer: null, conn: null, v: null, status: 'idle', err: '', ended: false, tab: 'game', lastHello: 0, toast: '' };

function initPhone() {
  document.body.className = 'phone';
  const qs = new URLSearchParams(location.search);
  PH.cid = localStorage.getItem('sq_cid') || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  localStorage.setItem('sq_cid', PH.cid);
  PH.room = (qs.get('room') || localStorage.getItem('sq_phone_room') || '').toUpperCase();
  PH.name = localStorage.getItem('sq_phone_name') || '';
  document.addEventListener('click', onTap);
  phRender();
  if (sessionStorage.getItem('sq_joined') && PH.room && PH.name) phConnect();
}

/* ---------------- connection ---------------- */
function phConnect() {
  if (!window.Peer) { PH.status = 'error'; PH.err = 'Could not load the connection library. Check your internet.'; return phRender(); }
  PH.status = 'connecting'; PH.ended = false; phRender();
  if (!PH.peer || PH.peer.destroyed) {
    PH.peer = new Peer({ debug: 0 });
    PH.peer.on('open', phDial);
    PH.peer.on('disconnected', () => { try { PH.peer.reconnect(); } catch (e) { } });
    PH.peer.on('error', e => {
      PH.err = e.type;
      PH.status = e.type === 'peer-unavailable' ? 'noroom' : 'error';
      phRender();
      if (e.type !== 'peer-unavailable') setTimeout(() => { if (PH.status !== 'live' && !PH.ended) phDial(); }, 4000);
    });
  } else phDial();
}
function phDial() {
  if (!PH.peer || PH.peer.disconnected) return;
  const c = PH.peer.connect(PHONE_PREFIX + PH.room.toLowerCase(), { reliable: true });
  PH.conn = c;
  c.on('open', () => { PH.status = 'live'; sessionStorage.setItem('sq_joined', '1'); phSend({ t: 'hello', name: PH.name }); phRender(); });
  c.on('data', phData);
  c.on('close', () => {
    if (PH.ended) return;
    PH.status = 'lost'; phRender();
    setTimeout(() => { if (PH.status !== 'live' && !PH.ended) phDial(); }, 3000);
  });
}
function phSend(o) { o.cid = PH.cid; try { PH.conn && PH.conn.open && PH.conn.send(o); } catch (e) { } }
function phData(d) {
  if (!d) return;
  if (d.t === 'bye') {
    PH.ended = true; PH.status = 'ended'; PH.err = d.why === 'removed' ? 'The GM removed you from this party.' : 'The GM started a new game.';
    sessionStorage.removeItem('sq_joined');
    try { PH.conn.close(); } catch (e) { }
    return phRender();
  }
  if (d.t === 'view') {
    const prev = PH.v; PH.v = d.v;
    // not seated yet but the party is still forming: ask again (after a new run)
    if (d.v.you == null && ['title', 'intro', 'party'].includes(d.v.phase) && Date.now() - PH.lastHello > 3000) { PH.lastHello = Date.now(); phSend({ t: 'hello', name: PH.name }); }
    const myTurn = v => v && v.cur && v.cur.step === 'roll' && v.cur.roller === v.you;
    if (myTurn(d.v) && !myTurn(prev)) { try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) { } }
    phRender();
  }
}

/* ---------------- taps ---------------- */
function onTap(e) {
  const b = e.target.closest('[data-p]'); if (!b || b.disabled) return;
  const a = b.dataset.p, arg = b.dataset.a;
  switch (a) {
    case 'join': {
      PH.room = ($('#phRoom').value || '').trim().toUpperCase();
      PH.name = ($('#phName').value || '').trim();
      if (PH.room.length < 4 || !PH.name) { PH.err = 'Enter the 4-letter room code and your last name.'; PH.status = 'idle'; return phRender(); }
      localStorage.setItem('sq_phone_room', PH.room); localStorage.setItem('sq_phone_name', PH.name);
      return phConnect();
    }
    case 'rejoin': PH.ended = false; return phConnect();
    case 'tab': PH.tab = arg; return phRender();
    case 'cls': case 'perk': case 'up': case 'b3stat': return phSend({ t: a, v: arg });
    case 'av': return phSend({ t: 'av', v: +arg });
    case 'vote': return phSend({ t: 'vote', v: +arg });
    case 'roll': b.disabled = true; return phSend({ t: 'roll' });
    case 'req': phSend({ t: 'req', v: arg }); phToast('Request sent to the GM'); return;
  }
}
function phToast(t) { PH.toast = t; phRender(); setTimeout(() => { PH.toast = ''; phRender(); }, 2200); }

/* ---------------- render ---------------- */
const pbtn = (p, a, html, o = {}) => `<button class="ph-btn ${o.cls || ''}" data-p="${p}" ${a != null ? `data-a="${esc(a)}"` : ''} ${o.dis ? 'disabled' : ''}>${html}</button>`;
const guideLink = '<a class="ph-link" href="guide.html" target="_blank">📖 Open the Field Guide</a>';

function phRender() {
  const app = $('#app');
  if (PH.status !== 'live' || !PH.v) { app.innerHTML = phJoinScreen(); return; }
  const v = PH.v, me = v.you != null ? v.party[v.you] : null;
  app.innerHTML = `<div class="ph-wrap">${phHeader(v, me)}${PH.tab === 'kit' ? phKit(v, me) : phGame(v, me)}</div>
    <div class="ph-tabs"><button class="${PH.tab === 'game' ? 'on' : ''}" data-p="tab" data-a="game">🎮 GAME</button><button class="${PH.tab === 'kit' ? 'on' : ''}" data-p="tab" data-a="kit">🧰 MY KIT</button><a href="guide.html" target="_blank">📖 GUIDE</a></div>
    ${PH.toast ? `<div class="ph-toast">${esc(PH.toast)}</div>` : ''}`;
}

function phJoinScreen() {
  const msg = {
    connecting: '🟡 Connecting...', lost: '🟡 Connection lost, reconnecting...',
    noroom: "🔴 Room not found. Check the code on the projector (the GM console must be open).",
    error: `🔴 Connection problem (${esc(PH.err)}). Retrying...`, ended: `⚪ ${esc(PH.err)}`,
  }[PH.status] || (PH.err ? `🔴 ${esc(PH.err)}` : '');
  return `<div class="ph-wrap"><div class="logo" style="font-size:34px;text-align:center;margin:24px 0">PRACTICUM<br>ADVENTURE</div>
    ${PH.status === 'ended' ? `<div class="ph-card">${msg}</div>${pbtn('rejoin', null, '🔁 REJOIN', { cls: 'ph-big' })}` : `
    <label class="sectlbl">ROOM CODE</label><input id="phRoom" class="ph-input" maxlength="4" autocomplete="off" value="${esc(PH.room)}" placeholder="ABCD">
    <label class="sectlbl" style="display:block;margin-top:12px">YOUR LAST NAME</label><input id="phName" class="ph-input" maxlength="24" autocomplete="off" value="${esc(PH.name)}" placeholder="HELLE">
    ${pbtn('join', null, PH.status === 'connecting' ? 'CONNECTING...' : '▶ JOIN GAME', { cls: 'ph-big', dis: PH.status === 'connecting' })}
    ${msg ? `<div class="ph-card">${msg}</div>` : ''}`}
    ${guideLink}</div>`;
}

function phHeader(v, me) {
  const cls = me && CLASS[me.cls];
  const u = v.unit && UNITS.find(x => x.id === v.unit);
  return `<div class="ph-head">
      ${me && me.av != null ? `<img src="${presetAvatar(me.av)}">` : '<div class="ph-noav">?</div>'}
      <div style="flex:1"><div class="ph-nm">${esc(me ? rankName(me) : PH.name)}${me && v.tokenHolder === v.you && !['title', 'intro', 'party'].includes(v.phase) ? ' 👑' : ''}</div>
      <div class="ph-cl">${me ? (cls ? `${cls.icon} ${cls.name}` : 'No class yet') : 'Spectator'}${u ? ` · ${u.icon} ${u.name}` : ''}</div></div>
      <span class="ph-dot" title="connected">●</span></div>
    ${v.unit ? `<div class="ph-meters">${METERS.map(m => { const x = v.meters[m.k]; return `<div style="--c:${m.color}"><div class="ph-ml">${m.icon} ${x}</div><div class="ph-mn" style="color:${m.color}">${m.name}</div><div class="ph-bar"><i style="width:${x * 10}%"></i></div></div>`; }).join('')}</div>` : ''}`;
}

function phGame(v, me) {
  if (v.you == null) return `<div class="ph-card">👀 The party is full, so you're watching this round as a spectator. Keep your eyes on the projector!</div>${guideLink}`;
  switch (v.phase) {
    case 'title': case 'intro':
      return `<div class="ph-card">✅ You're in, <b>${esc(me.name)}</b>!<br><br>Watch the projector while the GM explains the game. Class selection is next.</div>${guideLink}`;
    case 'party': return phParty(v, me);
    case 'perks': { const cls = CLASS[me.cls];
      return `<div class="ph-h">🎁 PERKS REVEALED</div><div class="ph-card">${cls.icon} <b>${esc(rankName(me))}</b>, pick ONE perk for your ${cls.name}:</div>`
        + cls.perks.map(p => pbtn('perk', p.id, `<b>${esc(p.name)}</b><br><small>${mt(esc(p.text))}</small>`, { cls: me.perk === p.id ? 'sel' : '' })).join('')
        + (me.perk ? '<div class="ph-card ph-center">✅ Locked in. Waiting for the rest of the team...</div>' : ''); }
    case 'avatars': return `<div class="ph-h">PICK YOUR PILOT</div><div class="ph-avgrid">${AVATARS.map((_, k) => {
      const who = v.party.find(p => p.av === k); const mine = me.av === k;
      return `<button class="ph-av ${mine ? 'sel' : ''}" data-p="av" data-a="${k}" ${who && !mine ? 'disabled' : ''}><img src="${presetAvatar(k)}"><span>${k + 1}${who && !mine ? ' · ' + esc(rankName(who)) : ''}</span></button>`; }).join('')}</div>`;
    case 'unit': return `<div class="ph-card ph-center">🎲 Rolling for your squadron...<br>Look up!</div>`;
    case 'manifest': return `<div class="ph-h">YOUR SQUADRON</div><div class="ph-card"><b>Commander:</b> ${esc(v.cc)}<br>${mt(esc(UNITS.find(x => x.id === v.unit).quirk))}</div>${phCrew(v)}`;
    case 'map': return `<div class="ph-h">YOUR ROUTE</div>${phRoute(v)}<div class="ph-card ph-center">The GM is moving the team to the next stop.</div>`;
    case 'node': return phNode(v, me);
    case 'inject': return phInject(v);
    case 'levelup': return `<div class="ph-h">⬆️ LEVEL UP!</div><div class="ph-card">Pick one upgrade for your ${CLASS[me.cls].name}:</div>
      ${CLASS[me.cls].ups.map(u => pbtn('up', u.id, `<b>${esc(u.name)}</b><br><small>${mt(esc(u.text))}${u.id === 'wind' && !CLASS[me.cls].ability ? ' (you have no ability)' : ''}</small>`, { cls: me.up === u.id ? 'sel' : '' })).join('')}`;
    case 'boss': return phBoss(v, me);
    case 'results': return v.final ? `<div class="ph-card ph-center"><div class="grade" style="font-size:110px">${esc(v.final.g)}</div><div class="ph-h">${esc(v.final.title)}</div>${v.final.total} PTS · ${v.ach.length} 🏅</div>` : '';
    case 'debrief': return `<div class="ph-card ph-center">🔌 Game over. Eyes up front for the debrief.</div>`;
  }
  return '';
}

function phParty(v, me) {
  const needFC = !v.party.some(p => p.name && p.cls === 'fc');
  const cls = me.cls && CLASS[me.cls];
  let h = needFC ? '<div class="ph-warn">⚠️ Your team needs a Flight Commander</div>' : '';
  if (cls) h += `<div class="ph-card ph-center">✅ You picked <b>${cls.icon} ${cls.name}</b>.<br>Your 🎁 perks are revealed once the GM locks every class.</div>`;
  h += `<div class="ph-h" style="margin-top:14px">${cls ? 'CHANGE CLASS' : 'SELECT YOUR CLASS'}</div>`;
  h += CLASSES.map(c => {
    const who = v.party.find(p => p.name && p.cls === c.id); const mine = me.cls === c.id;
    return pbtn('cls', c.id, `<span class="ph-ci">${c.icon}</span><b>${c.name}</b>${who && !mine ? ` <small>(${esc(rankName(who))})</small>` : ''}<br>
      <small style="color:var(--gold)">You'd be: ${c.rankLong} (${c.rank} ${esc(me.name)})</small><br>
      <small>Specialty: ${mt(c.guards)} · ${STATS.map(s => `${s}+${c.stats[s]}`).join(' ')}</small><br>
      <small>${c.ability ? '⚡ ' + esc(c.ability.name) + ': ' + mt(esc(c.ability.text)) : '👑 ' + esc(c.abilityText)}</small>`, { cls: mine ? 'sel' : '', dis: who && !mine });
  }).join('');
  return h;
}

function phRoute(v) {
  if (!v.map) return '';
  return `<div class="ph-route">${v.map.map((n, i) => { const nt = NODE_TYPES[n.type]; const here = v.pos.tier === i;
    return `<span class="${n.done ? 'done' : here ? 'here' : ''}">${nt.icon}<small>${i + 1}</small></span>`; }).join('<b>›</b>')}<b>›</b><span>👹<small>IG</small></span></div>`;
}

function phCrew(v) {
  return `<div class="ph-h">YOUR CREW</div>${v.npcs.map(n => `<div class="ph-npc ${n.ally ? 'ally' : ''}"><b>${esc(n.rank)} ${esc(n.name)}</b>${n.ally ? ' 🤝' : ''}${n.out ? ' (OUT)' : ''}
    <div><small>${n.trait ? TRAIT[n.trait].icon + ' ' + TRAIT[n.trait].name : esc(n.pub)}</small></div>
    <div class="loy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div></div>`).join('')}`;
}

function phNode(v, me) {
  const c = v.cur; if (!c) return '';
  if (c.type === 'rest') return `<div class="ph-card ph-center">🏕️ REST STOP<br><br>Pick ONE as a team and tell the GM:<br>+2 to any meter · recharge an ability · +1 loyalty to all NPCs</div>${c.result ? `<div class="ph-card">✅ ${esc(c.result)}</div>` : ''}`;
  if (c.type === 'depot') return `<div class="ph-card ph-center">🛒 SUPPLY DEPOT<br><br>One trade, as a team. Tell the GM.</div>${c.result ? `<div class="ph-card">✅ ${esc(c.result)}</div>` : ''}`;
  if (c.type === 'unknown') return `<div class="ph-card ph-center">❓ UNKNOWN TERRITORY<br>Rolling...</div>`;
  const m = v.mission; if (!m) return '';
  const offline = v.offline === v.you;
  let top = `<div class="ph-h">${c.type === 'crisisEvent' ? '🚨 ' : c.type === 'elite' ? '💀 ' : ''}${esc(m.icon)} ${esc(m.title)}</div><div class="ph-situ">${esc(m.text)}</div>`;
  if (offline) top += `<div class="ph-warn">📵 You're in a meeting this stop: no talking or rolling!</div>`;
  if (c.step === 'roll') {
    const mine = c.roller === v.you;
    const who = v.party[c.roller] ? rankName(v.party[c.roller]) : '?';
    return top + (mine && !offline
      ? `<div class="ph-card ph-center">YOUR ROLL${c.check && c.check.stat && c.check.stat !== 'LOYB' ? ` · ${c.check.stat} +${CLASS[me.cls].stats[c.check.stat]}` : ''}</div>${pbtn('roll', null, '🎲 ROLL THE d20!', { cls: 'ph-big ph-roll', dis: v.spinning })}`
      : `<div class="ph-card ph-center">🎲 ${esc(who)} is rolling...</div>`);
  }
  if (c.step === 'stars') return top + `<div class="ph-card ph-center">🎤 ACT IT OUT!<br>The GM plays the NPC and rates you 1-3 stars.</div>`;
  if (c.step === 'done') {
    const r = c.roll;
    const res = r ? `🎲 ${r.d20} → ${r.total} vs ${r.dc}: ${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED'}` : c.stars ? `🎤 ${'⭐'.repeat(c.stars)}` : 'Decision locked in';
    return top + `<div class="ph-card ph-center">${v.spinning ? '🎲 ...' : esc(res)}</div>`;
  }
  // brief: vote
  const votes = v.votes || {};
  return top + `<div class="ph-note">Tap to vote. Talk it over; the GM locks in the team's choice. 🔒 = the 👑 holder decides.</div>` +
    m.choices.map((ch, i) => {
      const voters = Object.keys(votes).filter(s => votes[s] === i).map(s => v.party[+s] && rankName(v.party[+s])).filter(Boolean);
      return `<button class="ph-btn ph-choice ${votes[v.you] === i ? 'sel' : ''}" data-p="vote" data-a="${i}" ${offline ? 'disabled' : ''}>
        <b>${'ABCD'[i]}</b> ${esc(ch.t)} ${ch.lock ? '🔒' : ''}${ch.mic ? '🎤' : ''}
        ${ch.show ? `<div class="ph-arw">${arrows(ch.show)}</div>` : ''}
        ${ch.intel ? `<div class="ph-intel">🔎 ${effHtml(ch.intel)}</div>` : ''}
        ${voters.length ? `<div class="ph-voters">🗳️ ${voters.map(esc).join(', ')}</div>` : ''}</button>`;
    }).join('');
}

function phInject(v) {
  const i = v.inject; if (!i) return '';
  if (i.stage === 'trigger' || v.spinning) return `<div class="ph-card ph-center">📡 Inject check... look up!</div>`;
  if (i.stage === 'clear') return `<div class="ph-card ph-center">✅ ALL CLEAR</div>`;
  if (i.stage === 'murphy') return `<div class="ph-card ph-center">🌪️ INJECT INCOMING!</div>`;
  return `<div class="ph-card ph-center">🌪️ ${esc(i.name || '')}${i.note ? `<br><small>${esc(i.note)}</small>` : ''}</div>`;
}

function phBoss(v, me) {
  const b = v.boss; if (!b) return '';
  let h = `<div class="ph-h">👹 ${BOSS.name}</div><div class="ph-card">HP ${b.hp} / ${b.max}<div class="ph-bar" style="--c:var(--bad)"><i style="width:${b.hp / b.max * 100}%"></i></div></div>`;
  if (b.phase === 2 && b.who) {
    const j = b.who.indexOf(v.you);
    h += j >= 0 ? `<div class="ph-warn">🔥 YOU'RE IN THE HOT SEAT</div><div class="ph-situ">"${esc(b.q[j])}"</div>` : `<div class="ph-card">😮‍💨 You're safe. ${b.who.map(w => esc(rankName(v.party[w]))).join(' and ')} face the IG.</div>`;
  }
  if (b.phase === 3 && !b.done3) {
    h += `<div class="ph-card">🚨 NO-NOTICE EXERCISE: pick the stat you'll roll with. Each stat can only be used once.</div>` +
      STATS.map(s => { const owner = b.stats.findIndex(x => x === s); const mine = owner === v.you;
        return pbtn('b3stat', s, `<b>${s} +${CLASS[me.cls].stats[s] + (me.up === 'battle' && (s === 'CMD' || s === 'GRIT') ? 1 : 0)}</b>${owner >= 0 && !mine ? ` <small>(${esc(rankName(v.party[owner]))})</small>` : ''}`, { cls: mine ? 'sel' : '', dis: owner >= 0 && !mine }); }).join('');
  }
  if (b.result) h += `<div class="ph-card ph-center">${esc(b.result)}</div>`;
  return h;
}

function phKit(v, me) {
  if (!me || !me.cls) return `<div class="ph-card">Pick a class first.</div>`;
  const c = CLASS[me.cls], perk = c.perks.find(p => p.id === me.perk), up = c.ups.find(u => u.id === me.up);
  const inGame = !['title', 'intro', 'party', 'perks', 'avatars', 'results', 'debrief'].includes(v.phase);
  return `<div class="ph-h">${c.icon} ${c.name}</div><div class="ph-note">Rank: ${c.rankLong}</div>
    <div class="ph-card"><small>Specialty: ${mt(c.guards)}</small><div class="stats" style="margin-top:6px">${STATS.map(s => `<div>${s}<b>+${c.stats[s]}</b></div>`).join('')}</div></div>
    <div class="ph-card"><b>${c.ability ? '⚡ ' + esc(c.ability.name) : '👑 COMMAND'}</b><br><small>${mt(esc(c.ability ? c.ability.text : c.abilityText))}</small>${c.ability ? `<br><small>${me.used ? 'Used' : 'Ready'}</small>` : ''}</div>
    ${perk ? `<div class="ph-card"><b>PERK: ${esc(perk.name)}</b><br><small>${mt(esc(perk.text))}</small></div>` : ''}
    ${up ? `<div class="ph-card"><b>UPGRADE: ${esc(up.name)}</b><br><small>${mt(esc(up.text))}</small></div>` : ''}
    ${inGame ? `<div class="ph-h">ASK THE GM</div>
      ${c.ability ? pbtn('req', 'ability', `⚡ Use ${esc(c.ability.name)}`, { dis: me.used > 0 }) : ''}
      ${pbtn('req', 'pause', '⏸️ Tactical Pause (30s)', { dis: !v.lt.pause })}
      ${pbtn('req', 'intel', '🔎 Intel Briefing (exact effects)', { dis: !v.lt.intel })}
      ${pbtn('req', 'waiver', '📝 Submit a Waiver (reroll)', { dis: !v.lt.waiver })}` : ''}
    ${v.items && v.items.length ? `<div class="ph-h">TEAM ITEMS</div>${v.items.map(id => { const l = LOOT.find(x => x.id === id); return `<div class="ph-card">${l.icon} <b>${esc(l.name)}</b><br><small>${mt(esc(l.text))}</small></div>`; }).join('')}` : ''}
    ${v.npcs && v.npcs.length ? phCrew(v) : ''}`;
}
