/* =====================================================================
   PRACTICUM ADVENTURE - cadet phone controller (join.html)
   Connects to the GM console's room over PeerJS and shows a phone-sized
   view of the game. Everything a cadet taps is a request; the GM console
   checks it and stays in charge of the game.
   ===================================================================== */
const PHONE_PREFIX = IS_BOSS_PRACTICE ? 'afas3410-practice-' : 'afas3410-sq-';
const PHONE_ROOM_KEY = IS_BOSS_PRACTICE ? 'sq_practice_phone_room' : 'sq_phone_room';
const PHONE_JOINED_KEY = IS_BOSS_PRACTICE ? 'sq_practice_joined' : 'sq_joined';
const PH = { peer: null, conn: null, v: null, status: 'idle', err: '', ended: false, tab: 'game', lastHello: 0, toast: '' };

function initPhone() {
  document.body.className = 'phone';
  const qs = new URLSearchParams(location.search);
  // test.html opens several "phones" in one browser: ?cid= gives each tab its own identity
  // (localStorage is shared across tabs, so without it every tab would be the same cadet)
  const testCid = qs.get('cid');
  PH.cid = testCid ? 'test-' + testCid : localStorage.getItem('sq_cid') || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  if (!testCid) localStorage.setItem('sq_cid', PH.cid);
  PH.room = (qs.get('room') || localStorage.getItem(PHONE_ROOM_KEY) || '').toUpperCase();
  PH.name = qs.get('name') || localStorage.getItem('sq_phone_name') || '';
  document.addEventListener('click', onTap);
  phRender();
  if ((qs.get('auto') || sessionStorage.getItem(PHONE_JOINED_KEY)) && PH.room && PH.name) phConnect();
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
  c.on('open', () => { PH.status = 'live'; sessionStorage.setItem(PHONE_JOINED_KEY, '1'); phSend({ t: 'hello', name: PH.name }); phRender(); });
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
    PH.ended = true; PH.status = 'ended'; PH.err = d.why === 'removed' ? 'Captain Russell removed you from this party.' : 'Captain Russell started a new game.';
    sessionStorage.removeItem(PHONE_JOINED_KEY);
    try { PH.conn.close(); } catch (e) { }
    return phRender();
  }
  if (d.t === 'view') {
    const prev = PH.v; PH.v = d.v;
    // not seated yet but the party is still forming: ask again (after a new run)
    if (d.v.you == null && ['title', 'join', 'welcome', 'intro', 'avatars', 'roster', 'party'].includes(d.v.phase) && Date.now() - PH.lastHello > 3000) { PH.lastHello = Date.now(); phSend({ t: 'hello', name: PH.name }); }
    const myTurn = v => v && v.you != null && ((v.cur && v.cur.step === 'roll' && v.cur.roller === v.you) || (v.actor && v.actor.slot === v.you));
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
      localStorage.setItem(PHONE_ROOM_KEY, PH.room); localStorage.setItem('sq_phone_name', PH.name);
      return phConnect();
    }
    case 'rejoin': PH.ended = false; return phConnect();
    case 'tab': if (arg === 'game' && PH.tab === 'kit' && PH.v && PH.v.phase === 'kit') phSend({ t: 'kit' });
      PH.tab = arg; if (arg === 'kit') PH.kitBack = !PH.kitSeen || PH.kitBack || (PH.v && PH.v.phase === 'kit'); if (arg === 'game') PH.kitBack = false; if (arg === 'kit' && PH.v && PH.v.you != null && PH.v.party[PH.v.you].perk) PH.kitSeen = true; window.scrollTo(0, 0); return phRender();
    case 'cls': case 'perk': case 'up': case 'look': return phSend({ t: a, v: arg });
    case 'av': PH.toLook = true; return phSend({ t: 'av', v: +arg }); // after the pick, glide down to uniform / hair
    case 'vote': return phSend({ t: 'vote', v: /^\d+$/.test(arg) ? +arg : arg });
    case 'roll': b.disabled = true; return phSend({ t: 'roll' });
    case 'hotseatRoll': b.disabled = true; return phSend({ t: 'hotseatRoll' });
    case 'act': b.disabled = true; return phSend({ t: 'act', v: arg });
    case 'rvote': return phSend({ t: 'rvote', v: +arg });
    case 'bact': { // boss team vote: "press" · "defend"
      const [type, x] = arg.split(':');
      return phSend({ t: 'bact', v: { type } });
    }
    case 'req': phSend({ t: 'req', v: arg }); phToast('Request sent to Captain Russell'); return;
  }
}
function phToast(t) { PH.toast = t; phRender(); setTimeout(() => { PH.toast = ''; phRender(); }, 2200); }

/* ---------------- render ----------------
   Three tabs, no overlap:
     GAME = what's happening now, what you must tap (pulsing blue), and a strip of what you CAN use now (gold)
     KIT  = your class, stats, perk, upgrade, and the team's items (gold when usable now)
     ORG  = your commander (perks, intent) and your Unit members (trait, loyalty)
   Button states: .need = required to move on · .avail = optional, usable now · .sel = your pick */
const pbtn = (p, a, html, o = {}) => `<button class="ph-btn ${o.cls || ''}" data-p="${p}" ${a != null ? `data-a="${esc(a)}"` : ''} ${o.dis ? 'disabled' : ''}>${html}</button>`;
const cls3 = (sel, need) => (sel ? 'sel' : need ? 'need' : '');
const guideLink = '<a class="ph-link" href="guide.html" target="_blank">📖 Open the Field Guide</a>';
const voted = v => v.votes && v.votes[v.you] != null;
// vote count only: ties are the GM's call (the 👑 next to the Flight Commander's vote shows their pick)
const tieLine = (v, showTie = false) => (v.voters ? `<div class="ph-note">✋ ${Object.keys(v.votes || {}).length}/${v.voters} voted${showTie && v.crown != null && v.crown >= 0 ? ' · the 👑 breaks ties.' : ''}</div>` : '');
// this cadet can't act: in a meeting this stop, or relieved of command for good
const outMe = v => v.you != null && (v.offline === v.you || !!(v.party[v.you] && v.party[v.you].fired));
const firedMe = v => v.you != null && !!(v.party[v.you] && v.party[v.you].fired);
const myUsable = v => firedMe(v) ? [] : (v.usable || []).filter(u => u.who == null || u.who === v.you);

function phRender() {
  const app = $('#app');
  // every state push rebuilds the screen: keep whatever the cadet is typing
  const f = document.activeElement, keep = f && f.id && f.tagName === 'INPUT' ? { id: f.id, v: f.value, s: f.selectionStart } : null;
  if (PH.status !== 'live' || !PH.v) app.innerHTML = phJoinScreen();
  else {
    const v = PH.v, me = v.you != null ? v.party[v.you] : null;
    // the 🎒 KIT tab starts glowing on the Check Your Kit screen, not before
    const preKit = ['title', 'join', 'welcome', 'intro', 'avatars', 'roster', 'party', 'perks', 'unit', 'patch', 'itemsBriefing'].includes(v.phase);
    const kitGlow = me && !me.fired && me.cls && PH.tab !== 'kit' && me.perk && !preKit && (v.phase === 'kit' ? !me.kitOk : !PH.kitSeen);
    const note = v.notice ? `<div class="ph-card ph-result"><div class="ph-h" style="margin-top:0">${v.notice.icon} ${esc(v.notice.title)}</div>${mt(esc(v.notice.text))}<div class="ph-note">Waiting for Captain Russell to continue...</div></div>` : '';
    const gameBody = note + phActor(v) + phGame(v, me) + phNow(v, me);
    const gameGlow = PH.tab !== 'game' && !v.spinning && /class="[^"]*\bneed\b/.test(gameBody);
    const body = PH.tab === 'kit' ? phKit(v, me) : PH.tab === 'org' ? phOrg(v) : gameBody;
    app.innerHTML = `<div class="ph-wrap">${phHeader(v, me)}${body}</div>
      <div class="ph-tabs"><button class="${PH.tab === 'game' ? 'on' : ''} ${gameGlow || (PH.tab === 'kit' && PH.kitBack) ? 'glow' : ''}" data-p="tab" data-a="game">🎮 GAME</button><button class="${PH.tab === 'kit' ? 'on' : ''} ${kitGlow ? 'glow' : ''}" data-p="tab" data-a="kit">🎒 KIT</button><button class="${PH.tab === 'org' ? 'on' : ''}" data-p="tab" data-a="org" ${v.unit ? '' : 'disabled'}>🏢 ORG</button></div>
      ${PH.toast ? `<div class="ph-toast">${esc(PH.toast)}</div>` : ''}`;
  }
  fitLines(app); // long effect lines (big names) shrink to fit their button
  // just picked an icon: scroll down to the uniform / hair options once they appear
  if (PH.toLook && PH.v && PH.v.phase === 'avatars') { const el = document.getElementById('phLook'); if (el) { PH.toLook = false; setTimeout(() => el.scrollIntoView({ block: 'start' }), 60); } }
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.s); } catch (e) { } } }
}

function phJoinScreen() {
  const msg = {
    connecting: '🟡 Connecting...', lost: '🟡 Connection lost, reconnecting...',
    noroom: "🔴 Room not found. Check the code on the projector (Captain Russell’s console must be open).",
    error: `🔴 Connection problem (${esc(PH.err)}). Retrying...`, ended: `⚪ ${esc(PH.err)}`,
  }[PH.status] || (PH.err ? `🔴 ${esc(PH.err)}` : '');
  return `<div class="ph-wrap"><div class="logo" style="font-size:34px;text-align:center;margin:24px 0">PRACTICUM<br>ADVENTURE</div>
    ${PH.status === 'ended' ? `<div class="ph-card">${msg}</div>${pbtn('rejoin', null, '🔁 REJOIN', { cls: 'ph-big' })}` : `
    <label class="sectlbl">ROOM CODE</label><input id="phRoom" class="ph-input" maxlength="4" autocomplete="off" value="${esc(PH.room)}" placeholder="ABCD">
    <label class="sectlbl" style="display:block;margin-top:12px">YOUR LAST NAME</label><input id="phName" class="ph-input" maxlength="24" autocomplete="off" value="${esc(PH.name)}" placeholder="SNUFFY">
    ${pbtn('join', null, PH.status === 'connecting' ? 'CONNECTING...' : '▶ JOIN GAME', { cls: 'ph-big', dis: PH.status === 'connecting' })}
    ${msg ? `<div class="ph-card">${msg}</div>` : ''}`}
    ${guideLink}</div>`;
}

function phHeader(v, me) {
  const cls = me && CLASS[me.cls];
  return `<div class="ph-head">
      ${me && me.av != null ? `<img src="${avatarOf(me)}">` : '<div class="ph-noav">?</div>'}
      <div style="flex:1"><div class="ph-nm">${me ? insignia(me) : ''}${esc(me ? rankName(me) : PH.name)}${me && v.you === v.crown ? ' 👑' : ''}</div>
      <div class="ph-cl">${me ? (cls ? `${cls.name}${me.fired ? ' · 🪓 FIRED' : ''}` : 'No position yet') : 'Spectator'}${v.team ? ` · ${v.patch ? v.patch.icon + ' ' : ''}${esc(v.team.toUpperCase())}` : ''}</div>
</div>
      <span class="ph-dot" title="connected">●</span></div>`;
}

// The big "your turn" button for whatever random event this cadet owns right now
function phActor(v) {
  const a = v.actor; if (!a || v.you == null) return '';
  const tbl = v.actorTable ? `<div class="ph-card"><small>${v.actorTable.map(r => `<b>${r.lo === r.hi ? r.lo : r.lo + '-' + r.hi}</b> ${r.icon || ''} ${esc(r.label)}`).join('<br>')}</small></div>` : '';
  if (a.slot === v.you) return `<div class="ph-warn" style="background:var(--gold);color:#000">🎲 YOUR TURN!</div>${pbtn('act', a.kind, `🎲 ${esc(a.label.toUpperCase())}`, { cls: 'ph-big ph-roll need', dis: v.spinning })}${tbl}`;
  const who = v.party[a.slot];
  return `<div class="ph-card ph-center">🎲 ${esc(who ? rankName(who) : '?')}: ${esc(a.label.toLowerCase())}...</div>${tbl}`;
}

// GAME tab: only what you can use RIGHT NOW (everything else lives in the KIT tab)
function phNow(v, me) {
  if (!me || !me.cls || ['title', 'join', 'welcome', 'intro', 'party', 'perks', 'kit', 'avatars', 'roster', 'results', 'debrief'].includes(v.phase)) return '';
  const list = myUsable(v); if (!list.length) return '';
  return `<div class="ph-h" style="color:var(--gold)">⚡ YOU CAN USE NOW</div>` + list.map(u => pbtn('req', u.req, `${u.icon} <b>${esc(u.label)}</b>${u.who != null ? ' <small>(yours)</small>' : ' <small>(team)</small>'}<br><small>${mt(esc(u.hint))} · tap to ask Captain Russell</small>`, { cls: 'avail' + (u.hot ? ' hot' : '') })).join('');
}

function phResult(v) {
  const r = v.result; if (!r) return '';
  const lootOf = id => LOOT.find(x => x.id === id);
  const rows = [
    ...r.meters.map(([k, d]) => `<div class="${d > 0 ? 'up' : 'dn'}"><b>${sign(d)}</b> ${METER[k].icon} ${METER[k].label}</div>`),
    ...r.loy.map(([w, d]) => `<div class="${d > 0 ? 'up' : 'dn'}"><b>${sign(d)}</b> 🤝 ${esc(w)} loyalty</div>`),
    ...r.gained.map(id => `<div class="up"><b>+</b> ${lootOf(id).icon} ${esc(lootOf(id).name)}</div>`),
    ...r.lost.map(id => `<div><b>-</b> ${lootOf(id).icon} ${esc(lootOf(id).name)} <small>used</small></div>`),
    ...(r.reductions || []).map(r => `<div class="loss-reduction">${esc(lossReductionText(r))}</div>`),
  ];
  return `<div class="ph-card ph-result"><div class="ph-h" style="margin-top:0">RESULT</div><b>${esc(r.head)}</b>${rows.length ? `<div class="ph-rrows">${rows.join('')}</div>` : '<div class="ph-note">No change to your meters.</div>'}<div class="ph-note">Waiting for Captain Russell to continue...</div></div>`;
}

function phItemAward(v, award) {
  const item = (v.itemInfo || []).find(l => l.id === award?.id) || LOOT.find(l => l.id === award?.id);
  const dropped = LOOT.find(l => l.id === award?.dropped);
  if (!item) return '';
  return `<div class="ph-h">${item.icon} ${esc(item.name.toUpperCase())}</div><div class="ph-card ph-center"><b>Added to your team’s items (${award.count}/3).</b><br>${mt(esc(fill(v, item.text)))}</div>${dropped ? `<div class="ph-warn">🎒 Bag full: dropped ${dropped.icon} ${esc(dropped.name)}.</div>` : ''}<div class="ph-card">${esc(INTRO_ITEMS)}</div>`;
}
function phGame(v, me) {
  if (v.you == null) return `<div class="ph-card">👀 You're watching as a spectator. Keep your eyes on the projector!</div>
    <div class="ph-card">📱 <b>Already playing on another device</b> (dead battery, new phone)? Tell Captain Russell to move this device into your seat.</div>${guideLink}`;
  switch (v.phase) {
    case 'title': case 'join': case 'welcome': case 'intro':
      return `<div class="ph-card">✅ You're in, <b>${esc(me.name)}</b>!<br><br>Watch the projector while Captain Russell explains the game. ${me.av == null ? 'Choose your character icon before the three-job overview. You will pick your position after the briefing.' : 'Your icon is ready. You will pick your position after the briefing.'}</div>${v.phase === 'intro' && v.introPage >= 2 ? `<div class="ph-card"><b>${['JOB 1 · INTEGRITY FIRST', 'JOB 2 · LOYALTY & UNIT COHESION', 'JOB 3 · THE FOUR METERS'][v.introPage - 2]}</b><br>${esc(v.introPage === 2 ? INTRO_INTEGRITY : v.introPage === 3 ? INTRO_LOYALTY : INTRO_RANGES + ' ' + INTRO_METER_SCALE)}</div>` : ''}${guideLink}`;
    case 'party': return phParty(v, me);
    case 'roster': return `<div class="ph-h">CHOOSE THE GAME’S NAMES</div>${tieLine(v)}` + ROSTER_OPTIONS.map((r,i) => pbtn('vote',r.id,`<span class="roster-phone-option">${rosterPin(r)}<span><b>${i+1}. ${esc(r.name)}</b><br><small>${esc(r.rank)}</small></span></span>`,{cls:cls3(String((v.votes||{})[v.you])===r.id,!voted(v))})).join('');
    case 'perks': { const cls = CLASS[me.cls];
      return `<div class="ph-h">🎁 PICK YOUR PERK · ${esc(cls.name)}</div>`
        + cls.perks.map(p => pbtn('perk', p.id, `${p.icon} <b>${esc(p.name)}</b><br><small>${useHtml(p.text)}</small>`, { cls: cls3(me.perk === p.id, !me.perk) })).join('')
        + (me.perk ? `<div class="ph-card ph-center">✅ Locked in. ${v.party.every(p => p.perk) ? 'Waiting on Captain Russell.' : 'Waiting for the rest of the team...'}</div>` : ''); }
    case 'kit': return me.kitOk ? `<div class="ph-card ph-center">✅ Kit checked. Your kit is always one tap away in the 🎒 KIT tab.<br><br>${v.party.every(p => p.kitOk) ? 'Waiting on Captain Russell.' : 'Waiting for the rest of the team...'}</div>`
      : '<div class="ph-h">🎒 CHECK YOUR KIT</div><div class="ph-card">Review your position, stats, ability, perk and team items—including your 📋 DEOCS Survey.</div><div class="ph-point"><b>Tap the glowing 🎒 KIT tab at the bottom of the screen.</b><div class="ph-arrow">👇</div></div>';
    case 'avatars': return `<div class="ph-h">PICK YOUR CHARACTER ICON</div><div class="ph-note">Your icon also sets your gender in the game.</div>` + AV_GROUPS.map(G => `<div class="ph-h">${G.label}</div><div class="ph-avgrid">${G.idx.map(k => {
      const who = v.party.find(p => p.av === k); const mine = me.av === k;
      return `<button class="ph-av ${mine ? 'sel' : me.av == null && !who ? 'need' : ''}" data-p="av" data-a="${k}" ${who && !mine ? 'disabled' : ''}><img src="${who ? avatarOf(who) : presetAvatar(k)}"><span>${avNum(k)}${who && !mine ? ' · ' + esc(rankName(who)) : ''}</span></button>`; }).join('')}</div>`).join('') + phLook(me);
    case 'unit': {
      if (v.unitPicked) { const u = UNITS.find(x => x.id === v.unit), deployed = v.unit === 'ch' && (v.npcs || []).find(n => n.slot === 'D'); return `<div class="ph-card ph-center"><span style="font-size:48px">${u.icon}</span><br><b>${u.name}</b><br>${u.sq}${deployed ? `<br><b>🧑‍🤝‍🧑 DEPLOYED UNTIL AFTER THE INSPECTION:</b> ${esc(deployed.rank)} ${esc(deployed.name)}` : ''}</div>
      <div class="ph-warn">SQUADRON PENALTY<br><small>${esc(squadPenaltyText(u.id, v))}</small></div>`; }
      const votes = v.votes || {};
      return `<div class="ph-h">✋ CHOOSE YOUR SQUADRON</div>${tieLine(v, true)}` + unitPickOrder(v).map(u => {
        return pbtn('vote', u.id, `${u.icon} <b>${esc(u.sq)}</b>`, { cls: cls3(String(votes[v.you]) === u.id, !voted(v)) });
      }).join(''); }
    case 'patch': { // team patch: a team vote, like the squadron (Captain Russell locks in the winner)
      const votes = v.votes || {};
      const pick = v.patch ? `<div class="ph-card ph-center">🎖️ TEAM PATCH LOCKED IN<br><span style="font-size:40px">${v.patch.icon}</span><br><b>${esc(v.patch.name)}</b></div>`
        : `<div class="ph-h">✋ VOTE ON YOUR TEAM PATCH</div><div class="ph-note">The patch is your team's name on the leaderboard. Choosing one also gives the team a 📋 DEOCS Survey item. Vote as a team; the 👑 breaks ties.</div>${tieLine(v)}<div class="ph-row">${(v.patches || []).map(p => {
          return pbtn('vote', p.id, `<span style="font-size:34px">${p.icon}</span><br><small>${esc(p.name)}${p.taken ? '<br>TAKEN' : ''}</small>`, { cls: cls3(String(votes[v.you]) === p.id, !voted(v) && !p.taken), dis: p.taken });
        }).join('')}</div>`;
      return pick; }
    case 'itemsBriefing': return phItemAward(v, { id: 'deocs', count: v.items.length });
    case 'itemAward': return phItemAward(v, v.itemAward);
    case 'manifest': return `${v.patch ? `<div class="ph-card ph-center"><span style="font-size:34px">${v.patch.icon}</span><br><b>${esc(v.patch.name)}</b></div>` : ''}
      <div class="ph-card ph-center">🏢 Your org chart is on the projector, and in the <b>ORG</b> tab below any time.</div>` + phOrg(v);
    case 'mapRoll': return `<div class="ph-h">🎲 GENERATING YOUR ROUTE</div><div class="ph-card ph-center">Watch the projector while the route is rolled. Your first stop will appear here when the seed locks in.</div>`;
    case 'map': {
      const votes = v.votes || {}, fired = firedMe(v), away = v.offlineNext === v.you || fired;
      const awayNote = fired ? '🪓 You were relieved: no more votes.' : '📵 You can\'t vote right now.';
      const wps = (v.wpOpts || []).map(o => {
        return pbtn('vote', o.key, `${o.icon} <b>${esc(o.name)}</b>`, { cls: cls3(!away && String(votes[v.you]) === o.key, !voted(v) && !away), dis: away }); }).join('');
      if (wps) return `<div class="ph-h">${v.wpOpts[0].icon} PICK YOUR WAYPOINT</div><div class="ph-note">${fired ? 'Your team is choosing the route.' : v.wpOpts.length > 1 ? 'The waypoint you pick also locks in your path to the next stop.' : 'Your path is set: tap to head into it.'}</div>${away ? `<div class="ph-warn">${awayNote}</div>` : ''}${tieLine(v)}` + wps;
      if (v.bossReady) {
        return `<div class="ph-h">${igIcon()} FINAL STOP: THE INSPECTOR GENERAL</div><div class="ph-note">The route is complete. Vote when your team is ready to enter the inspection.</div>${away ? `<div class="ph-warn">${awayNote}</div>` : ''}${tieLine(v)}` + pbtn('vote', 'boss', `🥊 <b>ENTER THE IG INSPECTION</b>`, { cls: cls3(!away && String(v.votes && v.votes[v.you]) === 'boss', !voted(v) && !away), dis: away }); }
      return `<div class="ph-h">WHERE TO NEXT?</div>${away ? `<div class="ph-warn">${fired ? awayNote : '📵 You\'re stuck in a meeting: no vote on the route, and you\'re offline next stop.'}</div>` : ''}${v.branch ? '<div class="ph-note">🌿 Branch Plan: any stop in the next column.</div>' : ''}${tieLine(v)}` + (v.avail || []).map(key => {
        const [t, i] = key.split(',').map(Number), n = v.map[t][i], nt = NODE_TYPES[n.type];
        return pbtn('vote', key, `${nt.icon} <b>${nt.name}</b>${['elite', 'spot'].includes(n.type) ? ' 🎁' : ''}`, { cls: cls3(!away && String(votes[v.you]) === key, !voted(v) && !away), dis: away });
      }).join('');
    }
    case 'node': return phNode(v, me);
    case 'inject': return phInject(v);
    case 'levelup': if (me.fired) return `<div class="ph-h">⬆️ LEVEL UP!</div><div class="ph-warn">🪓 You were relieved. No upgrade or passive effects.</div>`; return `<div class="ph-h">⬆️ LEVEL UP!</div><div class="ph-card">Pick one upgrade for your ${CLASS[me.cls].name}:</div>
      ${CLASS[me.cls].ups.map(u => pbtn('up', u.id, `<b>${esc(u.name)}</b><br><small>${mt(esc(u.text))}</small>`, { cls: cls3(me.up === u.id, !me.up) })).join('')}`;
    case 'boss': return phBoss(v, me);
    case 'results': return phFinal(v);
    case 'debrief': { const g = v.myGrade;
      return `<div class="ph-card ph-center">🔌 Game over. Eyes up front for the debrief.</div>${g ? `<div class="ph-h">📝 YOUR PRACTICUM SCORE</div><div class="ph-card"><div class="ph-center" style="font-size:48px;color:var(--gold)">${(+g.ref) + (+g.eng) + (+g.con)}<small style="font-size:22px">/20</small></div>
        <div>Reflection <b>${+g.ref}/8</b> · Engagement <b>${+g.eng}/6</b> · Concepts <b>${+g.con}/6</b></div>${g.notes ? `<div class="ph-situ" style="margin-top:8px;white-space:pre-line">${esc(g.notes)}</div>` : ''}</div>` : ''}`; }
  }
  return '';
}

// the projector builds up the grade, so the phone waits before spoiling it
const PHONE_REVEAL_MS = 9000;
function phFinal(v) {
  if (!v.final) return '';
  const key = v.final.total + v.final.g;
  if (PH.finalKey !== key) { PH.finalKey = key; PH.finalSeen = Date.now(); setTimeout(phRender, PHONE_REVEAL_MS + 50); }
  if (Date.now() - PH.finalSeen < PHONE_REVEAL_MS) return `<div class="ph-card ph-center">🥁 The board is deliberating...<br><br>Eyes on the projector!</div>`;
  return `<div class="ph-card ph-center"><div class="grade" style="font-size:110px">${esc(v.final.g)}</div>${v.final.total} PTS · ${v.ach.length} 🏅</div>`;
}

// uniform + hair colour, under the icon grid once an icon is picked (cosmetic only)
function phLook(me) {
  if (me.av == null) return '';
  return `<div class="ph-h" id="phLook">👕 CUSTOMIZE <small class="ph-legend">looks only</small></div><div class="ph-note">Pick a uniform and hair color below (optional).</div><div class="ph-card ph-center"><img src="${avatarOf(me)}" style="width:96px;height:96px;image-rendering:pixelated;border:3px solid #000"></div>
    <div class="ph-note">Uniform</div><div class="ph-row">${UNIFORMS.map(u => pbtn('look', 'uni:' + u.id, `<img src="${presetAvatar(me.av, u.id, me.hair)}" style="width:40px;height:40px;image-rendering:pixelated"><br><small>${u.name}</small>`, { cls: (me.uni || '') === u.id ? 'sel' : '' })).join('')}</div>
    <div class="ph-note">Hair color</div><div class="ph-row">${HAIR_COLORS.map(h => pbtn('look', 'hair:' + h.id, `<img src="${presetAvatar(me.av, me.uni, h.id)}" style="width:40px;height:40px;image-rendering:pixelated"><br><small>${h.name}</small>`, { cls: (me.hair || '') === h.id ? 'sel' : '' })).join('')}</div>`;
}

// Class select: a short list of the classes (who has which). Tapping one picks it and expands
// just that card with its details; the projector shows every class in full.
function phParty(v, me) {
  let h = '';
  h += `<div class="ph-h">${me.cls ? 'YOUR POSITION' : 'PICK YOUR POSITION'}</div><div class="ph-note">Tap a position to pick it. Full details are on the projector.</div>`;
  h += positionPickOrder(v).map(c => {
    const who = v.party.find(p => p.name && p.cls === c.id), mine = me.cls === c.id;
    const tag = who && !mine ? ` <small>${who.av != null ? `<img src="${avatarOf(who)}" style="width:20px;height:20px;image-rendering:pixelated;vertical-align:middle"> ` : ''}${esc(rankName(who))}</small>` : '';
    return pbtn('cls', c.id, `<span class="ph-ci">${clsIcon(c.id, 26)}</span><b>${c.name}</b> <small>${c.rank}</small>${tag}${mine ? ' ✅' : ''}`, { cls: cls3(mine, !me.cls && !who), dis: who && !mine });
  }).join('');
  return h;
}

function phRoute(v) {
  if (!v.map) return '';
  // the stops the team actually took, then what's left
  return `<div class="ph-route">${v.map.map((tier, t) => { const k = tier.findIndex(n => n.visited); const n = tier[k >= 0 ? k : 0];
    // 🎡 after the stops where an inject hits
    return `<span class="${k >= 0 ? (n.done ? 'done' : 'here') : ''}">${k >= 0 ? NODE_TYPES[n.type].icon : '❔'}<small>${t + 1}</small></span>${injectAfter(t) ? '<b>›</b><span class="inj">🎡<small>INJ</small></span>' : ''}${t === (v.levelAfter || 3) - 1 ? '<b>›</b><span class="inj lvl">⬆️<small>LVL</small></span>' : ''}`; }).join('<b>›</b>')}<b>›</b><span>${igIcon()}<small>IG</small></span></div>`;
}

// ORG tab: the commander and the Unit
function phOrg(v) {
  if (!v.unit) return `<div class="ph-card">Your org chart appears once the squadron is rolled.</div>`;
  const u = UNITS.find(x => x.id === v.unit), cc = v.ccInfo;
  return `<div class="ph-h">🤝 YOUR UNIT${v.patch ? ` <small class="ph-legend">${v.patch.icon} ${esc(v.patch.name)}</small>` : ''}</div>
    <div class="ph-npc cc"><b>${npcIns(v.cc, 18)} ${esc(v.cc)}</b> <small>${ccBadge(14)} Squadron CC</small>
      <div><small>Intent ${meterTag(cc.intent)} · 👍 ${esc(cc.pos.name)} · <span style="${cc.negOff ? 'text-decoration:line-through;opacity:.5' : ''}">👎 ${esc(cc.neg.name)}</span></small><div class="ph-note">Squadron penalty: ${esc(squadPenaltyText(v.unit, v))}</div></div></div>
    ${v.npcs.slice().sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank)).map(n => { const t = TRAIT[n.trait]; return `<div class="ph-npc ${n.ally ? 'ally' : ''}"><b>${insignia(n.rank, 18)}${esc(n.rank)} ${esc(n.name)}</b>${n.ally ? ' 🤝' : ''}${n.broken ? ' 💔' : ''}${n.gone ? ' (GONE)' : n.out ? ' (OUT)' : ''}
      ${t ? `<div><small>${t.icon} ${esc(t.name)}${n.done ? ' ✅' : ''}</small></div>${traitInfo(n, n.ally, n.done).map(([k, x]) => `<div class="ph-trait ${k}"><small>${mt(esc(x))}</small></div>`).join('')}` : ''}
      <div class="loyrow"><div class="loy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div>${loyBandHtml(n.loy, n.ally, n.broken)}</div></div>`; }).join('')}`;
}

function phNode(v, me) {
  const c = v.cur; if (!c) return '';
  if (isFreeLoot(c)) return `<div class="ph-h">🎁 FREE LOOT</div><div class="ph-card ph-center">An item for the team. No purchase needed.</div>`;
  if (c.type === 'rest' || c.type === 'depot') {
    const head = `<div class="ph-h">${c.type === 'rest' ? '🏕️ REST STOP: PICK ONE' : c.step === 'who' ? '🛒 WHO PAYS? (team decides)' : '🛒 BASE EXCHANGE (BX): ONE PURCHASE'}</div>`;
    const crunch = v.preIGRest ? '<div class="ph-warn">🕒 TIME CRUNCH · PRE-IG REST −50%</div>' : '';
    if (c.step === 'train') return head + crunch + `<div class="ph-card ph-center">📚 Training slot: tell Captain Russell who trains which stat.</div>`;
    if ((c.step !== 'choose' && c.step !== 'who') || !v.options) return head + crunch + (phResult(v) || `<div class="ph-card ph-center">✅ ${esc(c.result || '')}</div>`);
    const votes = v.votes || {}, inactive = outMe(v);
    return head + crunch + tieLine(v) + v.options.map(o => {
      return pbtn('vote', o.key, `${o.html}`, { cls: cls3(!inactive && String(votes[v.you]) === o.key, !voted(v) && !o.dis && !inactive), dis: o.dis || inactive });
    }).join('');
  }
  if (c.type === 'unknown') return `<div class="ph-card ph-center">❓ UNKNOWN TERRITORY<br>A d6 decides what happens...</div>`;
  const m = v.mission; if (!m) return '';
  const offline = outMe(v);
  const spot = c.type === 'spot', mine = spot && c.slot === v.you, watching = spot && !mine;
  let top = `<div class="ph-h">${c.type === 'crisisEvent' ? '🚨 ' : c.type === 'elite' ? '💀 ' : spot ? '🔦 ' : ''}${sceneIcon(m,22)} ${esc(m.title)}</div>`;
  if (spot) top += mine ? `<div class="ph-warn" style="background:var(--accent);color:#000">🔦 SPOTLIGHT ON YOU: you decide alone. Your team can't help.</div>`
    : `<div class="ph-card ph-center">🔦 SPOTLIGHT: <b>${esc(rankName(v.party[c.slot]))}</b> decides alone.<br><b>Stay silent.</b> Watch how they handle it.</div>`;
  if (m.cc) top += `<div class="ph-card ph-center">${ccBadge(18)} Commander encounter: <b>${esc(v.cc)}</b></div>`;
  if (m.compartmented && c.step === 'brief') top += `<div class="ph-card ph-center">🔍 Compartmented: no arrows. Decide on the facts.</div>`;
  top += c.step === 'brief' || c.choice == null || !m.choices[c.choice] ? `<details class="ph-more ph-card"><summary>📺 Situation on the screen · tap to read it here</summary><div style="margin-top:6px">${esc(m.text)}</div></details>`
    : `<div class="ph-card"><small>Your team chose</small><br><b>${'ABCD'[c.choice]}. ${esc(m.choices[c.choice].t)}</b>${m.realres ? `<div class="ph-arw"><b>Result:</b> ${m.realres}</div>` : ''}</div>`;
  if (c.type === 'crisisEvent' && m.loss) top += `<div class="ph-warn">💀 LOST FOR GOOD: ${mt(esc(m.loss))}${c.step === 'brief' ? '<br><b>One more Crisis Event = GAME OVER.</b>' : ''}</div>${m.help ? `<div class="ph-card"><small>💙 ${esc(CRISIS_HELP)}</small></div>` : ''}`;
  if (me && me.fired) top += `<div class="ph-warn">🪓 You were relieved of command: no votes or rolls for the rest of the game. Coach your team out loud!</div>`;
  if (offline) top += `<div class="ph-warn">📵 You're in a meeting this stop: no talking or rolling!</div>`;
  if (c.step === 'roll') {
    const rollerMine = c.roller === v.you;
    const who = v.party[c.roller] ? rankName(v.party[c.roller]) : '?';
    const st = c.check && c.check.stat;
    const bon = i => c.stats ? `${st} ${sign(c.stats[i])}${c.spec && c.spec[i] ? ' ★' : ''}` : '';
    if (c.rollerVote) return top + phRollerVote(v, st, c.odds4, offline);
    let h = `<div class="ph-card ph-center">🎲 <b>${st === 'LOYB' ? "A1C loyalty" : st || 'Luck'}</b> · <b style="color:var(--gold)">${esc(c.odds || '')}</b><br><small>Roller: ${esc(who)}${c.stats ? ` (${bon(c.roller)})` : ''}</small></div>`;
    h += rollerMine && !offline
      ? pbtn('roll', null, '🎲 ROLL THE d20!', { cls: 'ph-big ph-roll need', dis: v.spinning })
      : `<div class="ph-card ph-center">⏳ Waiting for ${esc(who)} to roll...</div>`;
    return top + h;
  }
  if (c.step === 'stars') {
    const lead = c.lead != null ? v.party[c.lead] : null;
    return top + `<div class="ph-card ph-center">🎤 ACT IT OUT: ${lead ? (c.lead === v.you ? '<b style="color:var(--gold)">YOU talk!</b>' : `<b>${esc(rankName(lead))}</b> talks`) : 'who talks?'}<br>Captain Russell plays: ${esc(m.choices[c.choice]?.roleplay || 'the other side')}.</div>`;
  }
  if (c.step === 'done') {
    if (v.result) return top + phResult(v);
    const r = c.roll;
    const res = r ? `${r.safe ? '🛡️ SAFE' : '🎲'} ${r.d20} → ${r.total} vs ${r.dc}: ${r.nat === 20 ? 'CRITICAL!' : r.nat === 1 ? 'FUMBLE!' : r.pass ? 'SUCCESS' : 'FAILED'}` : c.stars ? `🎤 ${'⭐'.repeat(c.stars)}` : 'Decision locked in';
    return top + `<div class="ph-card ph-center">${v.spinning ? '🎲 ...' : esc(res)}</div>`;
  }
  // brief: vote (in a spotlight only the spotlighted cadet's buttons work)
      const votes = v.votes || {};
  return top + (spot ? '' : tieLine(v)) +
    m.choices.map((ch, i) => {
      const dis = offline || watching;
      return `<button class="ph-btn ph-choice ${cls3(votes[v.you] === i, !voted(v) && !dis)}" data-p="vote" data-a="${i}" ${dis ? 'disabled' : ''}>
        <span class="ph-key">${'ABCD'[i]}</span> ${esc(ch.t)}${ch.mic ? '<span class="ph-mic">🎤 ACT IT OUT</span>' : ''}${ch.checkLabel ? `<span class="ph-mic">🎲 ROLL · ${esc(ch.checkLabel)}</span>` : ''}
        ${ch.smell ? '<div class="ph-req" style="color:var(--warn)">⚠️ Your Rule Bender says: this one smells like a shortcut</div>' : ''}
        ${ch.show ? `<div class="ph-arw">${arrows(ch.show)}</div>` : ''}
        ${ch.intel ? `<div class="ph-intel">🔎 ${effHtml(ch.intel)}</div>` : ''}
        </button>`;
    }).join('');
}

// The roller vote (scenario checks and Tackle it): each cadet with their bonus and odds
function phRollerVote(v, st, odds, offline) {
  const votes = v.votes || {};
  return `<div class="ph-h">🗳️ WHO ROLLS ${esc(st || '')}?</div><div class="ph-note">Vote for the roller. Captain Russell locks in the winner, then they roll.</div>${tieLine(v)}` + v.party.map((p, i) => {
    const o = odds && odds[i]; if (!o) return '';
    return pbtn('rvote', i, `${insignia(p)}<b>${esc(rankName(p))}</b>${i === v.you ? ' <small>(you)</small>' : ''}<br><small>${esc(o.stat)} ${sign(o.bonus)}${o.spec ? ' ★' : ''} · needs ${o.need}+ (${(21 - o.need) * 5}%)</small>`,
      { cls: cls3(!offline && String(votes[v.you]) === 'r' + i, !voted(v) && !offline), dis: offline });
  }).join('');
}

function phInject(v) {
  const i = v.inject; if (!i) return '';
  const w = i.wheel;
  if (i.stage === 'trigger') return `<div class="ph-card ph-center">📡 INJECT INCOMING</div>`;
  if (v.spinning && i.stage !== 'done') return `<div class="ph-card ph-center">${w ? w.icon + ' ' + esc(w.name) : '🎡'}... look up!</div>`;
  if (i.stage === 'clear') return `<div class="ph-card ph-center">📋 INJECT SKIPPED (Battle Rhythm)</div>`;
  if (i.stage === 'murphy') return `<div class="ph-card ph-center">${w.icon} <b>${esc(w.name)}</b></div>`;
  if (i.stage === 'done' && v.result) return phResult(v);
  const head = `<div class="ph-h">${w ? w.icon + ' ' : ''}${esc(i.name || '')}</div>${i.effHtml ? `<div class="ph-card ph-center">${i.effHtml}</div>` : ''}${i.note ? `<div class="ph-note" style="color:var(--gold)">${esc(i.note)}</div>` : ''}`;
  if (i.stage === 'tackle' && i.tackle) {
    const t = i.tackle, who = v.party[t.roller];
    const bon = k => `${t.stat} ${sign(t.bonus[k])}${t.spec[k] ? ' ★' : ''}`;
    if (t.vote) return head + phRollerVote(v, t.stat, t.odds4, outMe(v));
    return head + `<div class="ph-card ph-center">💪 Tackle: d20 + <b>${t.stat}</b> vs ${t.dc}<br><small>Roller: ${esc(who ? rankName(who) : '?')} (${bon(t.roller)})</small></div>`;
  }
  if (i.stage !== 'result' || !i.options) return head;
  const votes = v.votes || {}, inactive = outMe(v);
  return head + tieLine(v) + i.options.map((o, k) => {
    return pbtn('vote', k, `<span class="ph-key">${o.tackle ? '💪' : 'AB'[k] || k + 1}</span> <b>${esc(o.t)}</b><br><small>${o.html}</small>`, { cls: cls3(!inactive && votes[v.you] === k, !voted(v) && !inactive), dis: inactive });
  }).join('');
}

function phBoss(v, me) {
  const b = v.boss; if (!b) return '';
  let h = `<div class="ph-h">${b.round ? `ROUND ${b.round} · ` : ''}${esc(b.stageLabel || 'INSPECTION')}</div>`;
  const recap = () => `<div class="ph-card">${(b.recap || []).map(line => `<div>${igText(line)}</div>`).join('')}</div>`;
  if (b.stage === 'act') {
    const my = b.my, p = b.attackPreview;
    h += `<div class="ph-card">${igIcon()} Next IG attack: <b>${esc(b.atk.name)}</b><br>${meterTag(b.atk.k, `−${b.atk.n}`)} incoming before Block and loss reducers.</div>`;
    if (outMe(v)) return h + `<div class="ph-warn">${me?.fired ? 'You were relieved: no vote.' : 'You are in a meeting: no vote.'}</div>`;
    h += `<div class="ph-note">Choose one team action. ✋ ${b.votes.press + b.votes.defend} voted${my ? `<br>Your choice: ${my === 'press' ? 'ATTACK' : 'DEFEND'}` : ''}</div>`;
    h += pbtn('bact', 'press', `🗡️ <b>ATTACK · 2 DAMAGE</b><br><small>${p ? `${esc(p.name)} · d20 ${p.need}+ (${p.chance}%)<br>Critical: 4 damage · miss: 0<br>If IG survives: ${esc(METER[b.atk.k].label)} −${b.attackLoss ?? b.atk.n}${p.item ? '<br>Includes ' + esc(LOOT.find(l => l.id === p.item).name) : ''}` : 'No cadet available'}</small>`, { cls: 'ph-bossbtn ' + cls3(my === 'press', !my), dis: !p });
    h += pbtn('bact', 'defend', `🛡️ <b>DEFEND · 2 BLOCK</b><br><small>No roll. Your ${esc(METER[b.atk.k].label)} loss: ${b.defendLoss ?? Math.max(0, b.atk.n - 2)} (after loss reducers).<br>Block expires after this round.</small>`, { cls: 'ph-bossbtn ' + cls3(my === 'defend', !my) });
    return h;
  }
  if (b.stage === 'opening') {
    const effect = b.openingCurrent;
    h += `<div class="ph-card">${effect ? `${effect.icon} <b>${esc(effect.name)}</b><br>${esc(effect.why)}<br><b>${effect.amount < 0 ? `💥 ${esc(rankName(v.party[effect.cadet]))} deals ${effect.actualDamage} damage` : `IG +${effect.amount} bonus HP`}</b>` : `The IG starts at ${b.max} base HP. Opening effects resolve before Support.`}</div>`;
  } else if (b.stage === 'vouch') h += `<div class="ph-card">${b.vouchCurrent ? `${esc(b.vouchCurrent.name)}<br>${esc(b.vouchCurrent.why)}` : 'Allies and the commander act before The Audit.'}</div>`;
  else if (b.stage === 'intro') h += `<div class="ph-card">📋 The IG checks integrity and readiness. Read the result on the projector.</div>`;
  else if (b.stage === 'intent') h += `<div class="ph-card">${igIcon()} ${esc(b.atk.name)}<br>${meterTag(b.atk.k, `−${b.atk.n}`)} incoming before Block and loss reducers.<br><br>Your team acts first.${b.round === 2 ? ' The Hot Seat comes first this round.' : ''}</div>`;
  else if (b.stage === 'hotseat') {
    if (b.interviewConsequences?.length) h += `<div class="ph-card">${b.interviewConsequences.map(line => esc(line)).join('<br>')}</div>`;
    if (!b.who) {
      const roll = b.hotSeatRolls?.[v.you];
      h += `<div class="ph-card ph-center">🎲 Each cadet rolls. The lowest roll answers the IG.</div>`;
      if (roll?.active) h += !roll.rolled ? pbtn('hotseatRoll', '', '🎲 ROLL YOUR d20', { cls: 'ph-bossbtn need' }) : `<div class="ph-card ph-center">${roll.settled ? `You rolled <b>${roll.value}</b>. Waiting for the other rolls.` : 'Your die is rolling…'}</div>`;
    }
    else h += b.who.includes(v.you) ? `<div class="ph-warn">🎤 YOUR HOT SEAT</div><div class="ph-situ">${esc(b.q[b.who.indexOf(v.you)])}</div><div class="ph-note">Act it out · 1–3 stars deal 1–3 damage.</div>` : `<div class="ph-card">🎤 ${b.who.map(w => esc(rankName(v.party[w]))).join(', ')} faces the IG.</div>`;
  } else if (['auditResult', 'interviewResult', 'playerResult', 'resolved'].includes(b.stage)) {
    h += recap();
    if (b.stage === 'playerResult') h += `<div class="ph-note">${b.hp <= 0 ? 'IG defeated. Its attack is cancelled.' : 'Team action complete. The IG attacks next.'}</div>`;
  } else if (b.stage === 'enemy') h += `<div class="ph-card">${igIcon()} IG TURN<br>${esc(b.atk.name)}<br>${b.atk.n} incoming − ${Math.min(b.atk.n, b.block)} Block<br>${b.enemyForecast?.reduction ? `${esc(lossReductionText(b.enemyForecast.reduction))}<br>` : ''}<b>${meterTag(b.atk.k, `−${b.enemyForecast?.loss ?? Math.max(0, b.atk.n - b.block)}`)}</b></div>`;
  else if (b.stage === 'done') h += `<div class="ph-card ph-center">${esc(b.result)}</div>`;
  return h + `<div class="ph-note">IG: <b class="${b.hp > b.max ? 'over-base' : ''}">${b.hp}</b>/${b.max} HP · Waiting for Captain Russell</div>`;
}

// KIT tab: your class, and everything you or the team could use (gold = usable now)
function phKit(v, me) {
  if (!me || !me.cls) return `<div class="ph-card">Pick a position first.</div>`;
  if (me.fired) return `<div class="ph-h">${clsIcon(me.cls, 24)} YOUR KIT · INACTIVE</div><div class="ph-warn">🪓 You were relieved. Your abilities, perks, and upgrades no longer support the flight.</div>`;
  const c = CLASS[me.cls], perk = c.perks.find(p => p.id === me.perk), up = c.ups.find(u => u.id === me.up);
  const now = {}; myUsable(v).forEach(u => { now[u.req] = u; });
  const row = (req, icon, name, text, state) => {
    const u = req && now[req];
    if (u) return pbtn('req', req, `${icon} <b>${esc(name)}</b> <span class="ph-tag">USE NOW</span><br><small>${mt(esc(u.hint))} · tap to ask Captain Russell</small>`, { cls: 'avail' + (u.hot ? ' hot' : '') });
    const tag = useBadge(state) || (state ? `<span class="ph-tag off">${state.toUpperCase()}</span>` : '');
    return `<div class="ph-kitrow ${state === 'used' ? 'used' : ''}">${icon} <b>${esc(name)}</b> ${tag}<br><small>${mt(esc(useSplit(text).text))}</small></div>`;
  };
  let h = (PH.kitBack ? '<div class="ph-point">✅ This is your kit: check it any time during the game.<br><b>Now tap the glowing 🎮 GAME tab at the bottom to go back.</b><div class="ph-arrow">👇</div></div>' : '') + `<div class="ph-h">${clsIcon(me.cls, 24)} ${c.name}</div><div class="ph-note">Rank: ${c.rankLong}<br>Focus: ${esc(c.focus)}<br>Check bonus: +1 on ${(c.spec || []).map(k => meterTag(k)).join(' ')} checks</div>
    <div class="ph-card"><div class="stats">${STATS.map(s => `<div>${s}<b>+${me.st ? me.st[s] : c.stats[s]}</b></div>`).join('')}</div>
      <small>${STATS.map(s => `<b>${s}</b> ${STAT_INFO[s].name}: ${STAT_INFO[s].text}`).join('<br>')}</small></div>`;
  h += `<div class="ph-h">🎒 YOUR KIT <small class="ph-legend">gold = usable now</small></div>`;
  if (c.ability) h += row('ability', clsIcon(me.cls, 20), c.ability.name, c.ability.text, c.ability.auto ? 'passive' : me.used ? 'used' : 'once');
  else h += row(null, '👑', 'Command Token', c.abilityText, 'passive');
  if (perk) h += row('perk:' + perk.id, perk.icon || '🎁', perk.name, perk.text, me.perkUsed ? 'used' : useSplit(perk.text).kind || 'once');
  if (up) h += row(null, '⬆️', up.name, up.text, 'upgrade');
  h += `<div class="ph-h">🧺 TEAM ITEMS (${(v.itemInfo || []).length}/3)</div>`;
  h += (v.itemInfo || []).length ? v.itemInfo.map(l => row('item:' + l.id, l.icon, l.name, l.text, '')).join('')
    : `<div class="ph-note">None yet (the bag holds 3). Loot is guaranteed after spotlight and elite events, but basic scenarios do not drop loot.</div>`;
  return h;
}
