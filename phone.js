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
  // test.html opens several "phones" in one browser: ?cid= gives each tab its own identity
  // (localStorage is shared across tabs, so without it every tab would be the same cadet)
  const testCid = qs.get('cid');
  PH.cid = testCid ? 'test-' + testCid : localStorage.getItem('sq_cid') || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  if (!testCid) localStorage.setItem('sq_cid', PH.cid);
  PH.room = (qs.get('room') || localStorage.getItem('sq_phone_room') || '').toUpperCase();
  PH.name = qs.get('name') || localStorage.getItem('sq_phone_name') || '';
  document.addEventListener('click', onTap);
  phRender();
  if ((qs.get('auto') || sessionStorage.getItem('sq_joined')) && PH.room && PH.name) phConnect();
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
    if (d.v.you == null && ['title', 'join', 'intro', 'avatars', 'party'].includes(d.v.phase) && Date.now() - PH.lastHello > 3000) { PH.lastHello = Date.now(); phSend({ t: 'hello', name: PH.name }); }
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
      localStorage.setItem('sq_phone_room', PH.room); localStorage.setItem('sq_phone_name', PH.name);
      return phConnect();
    }
    case 'rejoin': PH.ended = false; return phConnect();
    case 'tab': if (arg === 'game' && PH.tab === 'kit' && PH.v && PH.v.phase === 'kit') phSend({ t: 'kit' });
      PH.tab = arg; if (arg === 'kit') PH.kitBack = !PH.kitSeen || PH.kitBack || (PH.v && PH.v.phase === 'kit'); if (arg === 'game') PH.kitBack = false; if (arg === 'kit' && PH.v && PH.v.you != null && PH.v.party[PH.v.you].perk) PH.kitSeen = true; window.scrollTo(0, 0); return phRender();
    case 'cls': case 'perk': case 'up': case 'look': return phSend({ t: a, v: arg });
    case 'av': PH.toLook = true; return phSend({ t: 'av', v: +arg }); // after the pick, glide down to uniform / hair
    case 'vote': return phSend({ t: 'vote', v: /^\d+$/.test(arg) ? +arg : arg });
    case 'roll': b.disabled = true; return phSend({ t: 'roll' });
    case 'act': b.disabled = true; return phSend({ t: 'act', v: arg });
    case 'rvote': return phSend({ t: 'rvote', v: +arg });
    case 'bact': { // boss action: "press" · "defend" · "clear"
      if (arg === 'clear') return phSend({ t: 'bact', v: null });
      const [type, x] = arg.split(':');
      return phSend({ t: 'bact', v: { type } });
    }
    case 'req': phSend({ t: 'req', v: arg }); phToast('Request sent to the GM'); return;
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
const tieLine = v => (v.voters ? `<div class="ph-note">✋ ${Object.keys(v.votes || {}).length}/${v.voters} voted</div>` : '');
// voter names in their class colour; the Flight Commander's vote carries the 👑 (Rock, Paper, Rank)
const voterHtml = (v, names) => names.map(nm => { const k = v.party.findIndex(q => rankName(q) === nm), p = v.party[k], fc = k >= 0 && k === v.crown; return `<span class="${fc && v.tie ? 'tieglow' : ''}" style="color:${clsColor(p)}">${fc ? '👑 ' : ''}${esc(nm)}</span>`; }).join(', ');
// this cadet can't act: in a meeting this stop, or relieved of command for good
const outMe = v => v.you != null && (v.offline === v.you || !!(v.party[v.you] && v.party[v.you].fired));
const myUsable = v => (v.usable || []).filter(u => u.who == null || u.who === v.you);

function phRender() {
  const app = $('#app');
  // every state push rebuilds the screen: keep whatever the cadet is typing
  const f = document.activeElement, keep = f && f.id && f.tagName === 'INPUT' ? { id: f.id, v: f.value, s: f.selectionStart } : null;
  if (PH.status !== 'live' || !PH.v) app.innerHTML = phJoinScreen();
  else {
    const v = PH.v, me = v.you != null ? v.party[v.you] : null;
    const kitGlow = me && me.cls && PH.tab !== 'kit' && me.perk && (v.phase === 'kit' ? !me.kitOk : !PH.kitSeen);
    const note = v.notice ? `<div class="ph-card ph-result"><div class="ph-h" style="margin-top:0">${v.notice.icon} ${esc(v.notice.title)}</div>${mt(esc(v.notice.text))}<div class="ph-note">Waiting for the GM to continue...</div></div>` : '';
    const body = PH.tab === 'kit' ? phKit(v, me) : PH.tab === 'org' ? phOrg(v) : note + phActor(v) + phGame(v, me) + phNow(v, me);
    app.innerHTML = `<div class="ph-wrap">${phHeader(v, me)}${body}</div>
      <div class="ph-tabs"><button class="${PH.tab === 'game' ? 'on' : ''} ${PH.tab === 'kit' && PH.kitBack ? 'glow' : ''}" data-p="tab" data-a="game">🎮 GAME</button><button class="${PH.tab === 'kit' ? 'on' : ''} ${kitGlow ? 'glow' : ''}" data-p="tab" data-a="kit">🎒 KIT</button><button class="${PH.tab === 'org' ? 'on' : ''}" data-p="tab" data-a="org" ${v.unit ? '' : 'disabled'}>🏢 ORG</button></div>
      ${PH.toast ? `<div class="ph-toast">${esc(PH.toast)}</div>` : ''}`;
  }
  // just picked an icon: scroll down to the uniform / hair options once they appear
  if (PH.toLook && PH.v && PH.v.phase === 'avatars') { const el = document.getElementById('phLook'); if (el) { PH.toLook = false; setTimeout(() => el.scrollIntoView({ block: 'start' }), 60); } }
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.s); } catch (e) { } } }
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
    <label class="sectlbl" style="display:block;margin-top:12px">YOUR LAST NAME</label><input id="phName" class="ph-input" maxlength="24" autocomplete="off" value="${esc(PH.name)}" placeholder="SNUFFY">
    ${pbtn('join', null, PH.status === 'connecting' ? 'CONNECTING...' : '▶ JOIN GAME', { cls: 'ph-big', dis: PH.status === 'connecting' })}
    ${msg ? `<div class="ph-card">${msg}</div>` : ''}`}
    ${guideLink}</div>`;
}

function phHeader(v, me) {
  const cls = me && CLASS[me.cls];
  const u = v.unit && UNITS.find(x => x.id === v.unit);
  return `<div class="ph-head">
      ${me && me.av != null ? `<img src="${avatarOf(me)}">` : '<div class="ph-noav">?</div>'}
      <div style="flex:1"><div class="ph-nm">${me ? insignia(me) : ''}${esc(me ? rankName(me) : PH.name)}</div>
      <div class="ph-cl">${me ? (cls ? `${cls.name}${me.fired ? ' · 🪓 FIRED' : ''}${v.you === v.crown ? ' · 👑' : ''}` : 'No position yet') : 'Spectator'}${v.team ? ` · ${v.patch ? v.patch.icon + ' ' : ''}${esc(v.team.toUpperCase())}` : ''}</div>
</div>
      <span class="ph-dot" title="connected">●</span></div>
    ${v.unit ? `<div class="ph-meters">${METERS.map(m => { const x = v.meters[m.k], b = meterBand(x); const intent = v.ccInfo && v.ccInfo.intent === m.k;
      // hidden meters: a small band word unless a DEOCS Survey is running (only the projector's band pulses)
      if (!v.deocs) return `<div style="--c:${m.color}"><div class="ph-ml">${meterIcon(m)}</div><div class="ph-mn" style="color:${m.color}">${m.name}${intent ? '<br><small class="ph-int">INTENT</small>' : ''}</div><div class="ph-band ${b.cls}">${b.word}</div></div>`;
      return `<div style="--c:${m.color}"><div class="ph-ml">${meterIcon(m)} ${x}</div><div class="ph-mn" style="color:${m.color}">${m.name}${intent ? '<br><small class="ph-int">INTENT</small>' : ''}</div><div class="ph-bar"><i style="width:${x * 10}%"></i></div></div>`; }).join('')}</div>
      ${v.deocs && !['results', 'debrief'].includes(v.phase) ? `<div class="ph-note" style="text-align:center">📋 DEOCS Survey: exact numbers${v.deocsLeft ? ` for ${v.deocsLeft} more stop${v.deocsLeft === 1 ? '' : 's'}` : ' (last stop)'}</div>` : ''}` : ''}`;
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
  if (!me || !me.cls || ['title', 'join', 'intro', 'party', 'perks', 'kit', 'avatars', 'results', 'debrief'].includes(v.phase)) return '';
  const list = myUsable(v); if (!list.length) return '';
  return `<div class="ph-h" style="color:var(--gold)">⚡ YOU CAN USE NOW</div>` + list.map(u => pbtn('req', u.req, `${u.icon} <b>${esc(u.label)}</b>${u.who != null ? ' <small>(yours)</small>' : ' <small>(team)</small>'}<br><small>${mt(esc(u.hint))} · tap to ask the GM</small>`, { cls: 'avail' + (u.hot ? ' hot' : '') })).join('');
}

function phResult(v) {
  const r = v.result; if (!r) return '';
  const lootOf = id => LOOT.find(x => x.id === id);
  const rows = [
    ...r.meters.map(([k, d]) => `<div class="${d > 0 ? 'up' : 'dn'}">${METER[k].icon} ${METER[k].label} <b>${sign(d)}</b></div>`),
    ...r.loy.map(([w, d]) => `<div class="${d > 0 ? 'up' : 'dn'}">🤝 ${esc(w)} loyalty <b>${sign(d)}</b></div>`),
    ...r.gained.map(id => `<div class="up">🎁 Gained ${lootOf(id).icon} ${esc(lootOf(id).name)}</div>`),
    ...r.lost.map(id => `<div>🎒 Used ${lootOf(id).icon} ${esc(lootOf(id).name)}</div>`),
  ];
  return `<div class="ph-card ph-result"><div class="ph-h" style="margin-top:0">RESULT</div><b>${esc(r.head)}</b>${rows.length ? `<div class="ph-rrows">${rows.join('')}</div>` : '<div class="ph-note">No change to your meters.</div>'}<div class="ph-note">Waiting for the GM to continue...</div></div>`;
}

function phGame(v, me) {
  if (v.you == null) return `<div class="ph-card">👀 You're watching as a spectator. Keep your eyes on the projector!</div>
    <div class="ph-card">📱 <b>Already playing on another device</b> (dead battery, new phone)? Tell the GM: they can move this device into your seat.</div>${guideLink}`;
  switch (v.phase) {
    case 'title': case 'join': case 'intro':
      return `<div class="ph-card">✅ You're in, <b>${esc(me.name)}</b>!<br><br>Watch the projector while the GM explains the game. Next you pick your character icon, then your position.</div>${guideLink}`;
    case 'party': return phParty(v, me);
    case 'perks': { const cls = CLASS[me.cls];
      return `<div class="ph-h">🎁 PICK YOUR PERK</div><div class="ph-card">${clsIcon(me.cls, 20)} <b>${esc(rankName(me))}</b>, pick ONE perk for your ${cls.name}. Each perk works once per game.</div>`
        + cls.perks.map(p => pbtn('perk', p.id, `${p.icon} <b>${esc(p.name)}</b><br><small>${mt(esc(p.text))}</small>`, { cls: cls3(me.perk === p.id, !me.perk) })).join('')
        + (me.perk ? '<div class="ph-card ph-center">✅ Locked in. Waiting for the rest of the team...</div>' : ''); }
    case 'kit': return me.kitOk ? '<div class="ph-card ph-center">✅ Kit checked. Your kit is always one tap away in the 🎒 KIT tab.<br><br>Waiting for the rest of the team...</div>'
      : '<div class="ph-h">🎒 CHECK YOUR KIT</div><div class="ph-card">Before you pick a squadron, look at what you\'re bringing: your position, stats, ability and perk.</div><div class="ph-point"><b>Tap the glowing 🎒 KIT tab at the bottom of the screen.</b><div class="ph-arrow">👇</div></div>';
    case 'avatars': return `<div class="ph-h">PICK YOUR CHARACTER ICON</div><div class="ph-note">Your icon also sets your gender in the game.</div>` + AV_GROUPS.map(G => `<div class="ph-h">${G.label}</div><div class="ph-avgrid">${G.idx.map(k => {
      const who = v.party.find(p => p.av === k); const mine = me.av === k;
      return `<button class="ph-av ${mine ? 'sel' : me.av == null && !who ? 'need' : ''}" data-p="av" data-a="${k}" ${who && !mine ? 'disabled' : ''}><img src="${who ? avatarOf(who) : presetAvatar(k)}"><span>${avNum(k)}${who && !mine ? ' · ' + esc(rankName(who)) : ''}</span></button>`; }).join('')}</div>`).join('') + phLook(me);
    case 'unit': {
      if (v.unitPicked) { const u = UNITS.find(x => x.id === v.unit); return `<div class="ph-card ph-center"><span style="font-size:48px">${u.icon}</span><br><b>${u.name}</b><br>${u.sq}</div>
      <div class="ph-warn">⚠️ SQUADRON WARNING: ${esc(u.drain.name)}<br><small>${esc(u.drain.text)}. ${meterTag(u.drain.k, '−1')} every ${DIFFICULTY.drainEvery} stops. It comes with this unit.</small></div>`; }
      const votes = v.votes || {};
      return `<div class="ph-h">✋ CHOOSE YOUR SQUADRON</div><div class="ph-note">Details are on the projector. Vote as a team; the Flight Commander breaks ties.</div>${tieLine(v)}` + UNITS.map(u => {
        const voters = Object.keys(votes).filter(s2 => String(votes[s2]) === u.id).map(s2 => v.party[+s2] && rankName(v.party[+s2])).filter(Boolean);
        return pbtn('vote', u.id, `${u.icon} <b>${esc(u.sq)}</b>${voters.length ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}`, { cls: cls3(String(votes[v.you]) === u.id, !voted(v)) });
      }).join(''); }
    case 'patch': { // team patch: a team vote, like the squadron (the GM locks in the winner)
      const votes = v.votes || {};
      const pick = v.patch ? `<div class="ph-card ph-center">🎖️ TEAM PATCH LOCKED IN<br><span style="font-size:40px">${v.patch.icon}</span><br><b>${esc(v.patch.name)}</b></div>`
        : `<div class="ph-h">✋ VOTE ON YOUR TEAM PATCH</div><div class="ph-note">The patch is your team's name on the leaderboard. Vote as a team; the Flight Commander breaks ties.</div>${tieLine(v)}<div class="ph-row">${(v.patches || []).map(p => {
          const voters = Object.keys(votes).filter(s2 => String(votes[s2]) === p.id).map(s2 => v.party[+s2] && rankName(v.party[+s2])).filter(Boolean);
          return pbtn('vote', p.id, `<span style="font-size:34px">${p.icon}</span><br><small>${esc(p.name)}${p.taken ? '<br>TAKEN' : ''}</small>${voters.length ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}`, { cls: cls3(String(votes[v.you]) === p.id, !voted(v) && !p.taken), dis: p.taken });
        }).join('')}</div>`;
      return pick; }
    case 'manifest': return `${v.patch ? `<div class="ph-card ph-center"><span style="font-size:34px">${v.patch.icon}</span><br><b>${esc(v.patch.name)}</b></div>` : ''}
      <div class="ph-card ph-center">🏢 Your org chart is on the projector, and in the <b>ORG</b> tab below any time.</div>` + phOrg(v);
    case 'map': {
      const votes = v.votes || {}, away = v.offlineNext === v.you;
      const wps = (v.wpOpts || []).map(o => { const voters = Object.keys(votes).filter(s => String(votes[s]) === o.key).map(s => v.party[+s] && rankName(v.party[+s])).filter(Boolean);
        return pbtn('vote', o.key, `${o.icon} <b>${esc(o.name)}</b> <small>then → ${esc(o.then)}</small>${voters.length ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}`, { cls: cls3(String(votes[v.you]) === o.key, !voted(v) && !away), dis: away }); }).join('');
      if (wps) return `<div class="ph-h">${v.wpOpts[0].icon} PICK YOUR WAYPOINT</div><div class="ph-note">${v.wpOpts.length > 1 ? 'The waypoint you pick also locks in your path to the next stop.' : 'Your path is set: tap to head into it.'}</div>${away ? '<div class="ph-warn">📵 You can\'t vote right now.</div>' : ''}${tieLine(v)}` + wps;
      return `<div class="ph-h">WHERE TO NEXT?</div>${away ? '<div class="ph-warn">📵 You\'re stuck in a meeting: no vote on the route, and you\'re offline next stop.</div>' : ''}${v.branch ? '<div class="ph-note">🌿 Branch Plan: any stop in the next column.</div>' : ''}${tieLine(v)}` + (v.avail || []).map(key => {
        const [t, i] = key.split(',').map(Number), n = v.map[t][i], nt = NODE_TYPES[n.type];
        const voters = Object.keys(votes).filter(s => String(votes[s]) === key).map(s => v.party[+s] && rankName(v.party[+s])).filter(Boolean);
        const nxt = v.links && v.map[t + 1] ? (v.links[t][i] || []).map(j => NODE_TYPES[v.map[t + 1][j].type].icon).join(' ') : '👹';
        return pbtn('vote', key, `${nt.icon} <b>${nt.name}</b> <small>then → ${nxt}</small>${voters.length ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}`, { cls: cls3(String(votes[v.you]) === key, !voted(v) && !away), dis: away });
      }).join('');
    }
    case 'node': return phNode(v, me);
    case 'inject': return phInject(v);
    case 'levelup': return `<div class="ph-h">⬆️ LEVEL UP!</div><div class="ph-card">Pick one upgrade for your ${CLASS[me.cls].name}:</div>
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
  return `<div class="ph-card ph-center"><div class="grade" style="font-size:110px">${esc(v.final.g)}</div><div class="ph-h">${esc(v.final.title)}</div>${v.final.total} PTS · ${v.ach.length} 🏅</div>`;
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
  h += CLASSES.map(c => {
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
    return `<span class="${k >= 0 ? (n.done ? 'done' : 'here') : ''}">${k >= 0 ? NODE_TYPES[n.type].icon : '❔'}<small>${t + 1}</small></span>${injectAfter(t) ? '<b>›</b><span class="inj">🎡<small>INJ</small></span>' : ''}${t === (v.levelAfter || 3) - 1 ? '<b>›</b><span class="inj lvl">⬆️<small>LVL</small></span>' : ''}`; }).join('<b>›</b>')}<b>›</b><span>👹<small>IG</small></span></div>`;
}

// ORG tab: the commander and the Unit
function phOrg(v) {
  if (!v.unit) return `<div class="ph-card">Your org chart appears once the squadron is rolled.</div>`;
  const u = UNITS.find(x => x.id === v.unit), cc = v.ccInfo;
  return `<div class="ph-h">🤝 YOUR UNIT${v.patch ? ` <small class="ph-legend">${v.patch.icon} ${esc(v.patch.name)}</small>` : ''}</div>
    <div class="ph-npc cc"><b>${npcIns(v.cc, 18)} ${esc(v.cc)}</b> <small>Squadron CC</small>
      <div><small>Intent ${meterTag(cc.intent)} · 👍 ${esc(cc.pos.name)} · <span style="${cc.negOff ? 'text-decoration:line-through;opacity:.5' : ''}">👎 ${esc(cc.neg.name)}</span> · ⚠️ ${esc(u.drain.name)}</small></div></div>
    ${v.npcs.slice().sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank)).map(n => { const t = TRAIT[n.trait]; return `<div class="ph-npc ${n.ally ? 'ally' : ''}"><b>${insignia(n.rank, 18)}${esc(n.rank)} ${esc(n.name)}</b>${n.ally ? ' 🤝' : ''}${n.broken ? ' 💔' : ''}${n.gone ? ' (GONE)' : n.out ? ' (OUT)' : ''}
      ${t ? `<div><small>${t.icon} ${esc(t.name)}${n.done ? ' ✅' : ''}</small></div>` : ''}
      <div class="loy">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n.loy ? 'on' : ''}"></i>`).join('')}</div></div>`; }).join('')}`;
}

function phNode(v, me) {
  const c = v.cur; if (!c) return '';
  if (c.type === 'rest' || c.type === 'depot') {
    const head = `<div class="ph-h">${c.type === 'rest' ? '🏕️ REST STOP: PICK ONE' : c.step === 'who' ? '🛒 WHO PAYS? (team decides)' : '🛒 BASE EXCHANGE (BX): ONE PURCHASE'}</div>`;
    if (c.step === 'train') return head + `<div class="ph-card ph-center">📚 Training slot: tell the GM who trains which stat.</div>`;
    if ((c.step !== 'choose' && c.step !== 'who') || !v.options) return head + (phResult(v) || `<div class="ph-card ph-center">✅ ${esc(c.result || '')}</div>`);
    const votes = v.votes || {};
    return head + tieLine(v) + v.options.map(o => {
      const voters = Object.keys(votes).filter(s => String(votes[s]) === o.key).map(s => v.party[+s] && rankName(v.party[+s])).filter(Boolean);
      return pbtn('vote', o.key, `${o.html}${voters.length ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}`, { cls: cls3(String(votes[v.you]) === o.key, !voted(v) && !o.dis), dis: o.dis });
    }).join('');
  }
  if (c.type === 'unknown') return `<div class="ph-card ph-center">❓ UNKNOWN TERRITORY<br>A d6 decides what happens...</div>`;
  const m = v.mission; if (!m) return '';
  const offline = outMe(v);
  const spot = c.type === 'spot', mine = spot && c.slot === v.you, watching = spot && !mine;
  let top = `<div class="ph-h">${c.type === 'crisisEvent' ? '🚨 ' : c.type === 'elite' ? '💀 ' : spot ? '🔦 ' : ''}${esc(m.icon)} ${esc(m.title)}</div>`;
  if (spot) top += mine ? `<div class="ph-warn" style="background:var(--accent);color:#000">🔦 SPOTLIGHT ON YOU: you decide alone. Your team can't help.</div>`
    : `<div class="ph-card ph-center">🔦 SPOTLIGHT: <b>${esc(rankName(v.party[c.slot]))}</b> decides alone.<br><b>Stay silent.</b> Watch how they handle it.</div>`;
  if (m.cc) top += `<div class="ph-card ph-center">🎖️ Commander encounter: <b>${esc(v.cc)}</b></div>`;
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
    let h = `<div class="ph-card ph-center">🎲 <b>${st === 'LOYB' ? "A1C loyalty" : st || 'Luck'}</b> · <b style="color:var(--gold)">${esc(c.odds || '')}</b><br><small>Roller: ${esc(who)}${c.stats ? ` (${bon(c.roller)})` : ''}${c.typ ? " · FC's CMD" : ''}</small></div>`;
    h += rollerMine && !offline
      ? pbtn('roll', null, '🎲 ROLL THE d20!', { cls: 'ph-big ph-roll need', dis: v.spinning })
      : `<div class="ph-card ph-center">⏳ Waiting for ${esc(who)} to roll...</div>`;
    return top + h;
  }
  if (c.step === 'stars') {
    const lead = c.lead != null ? v.party[c.lead] : null;
    return top + `<div class="ph-card ph-center">🎤 ACT IT OUT: ${lead ? (c.lead === v.you ? '<b style="color:var(--gold)">YOU talk!</b>' : `<b>${esc(rankName(lead))}</b> talks`) : 'who talks?'}</div>`;
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
      const voters = Object.keys(votes).filter(s => votes[s] === i).map(s => v.party[+s] && rankName(v.party[+s])).filter(Boolean);
      const dis = offline || watching || ch.locked;
      return `<button class="ph-btn ph-choice ${cls3(votes[v.you] === i, !voted(v) && !dis)}" data-p="vote" data-a="${i}" ${dis ? 'disabled' : ''}>
        <span class="ph-key">${'ABCD'[i]}</span> ${esc(ch.t)}${ch.mic ? '<span class="ph-mic">🎤 ACT IT OUT</span>' : ''}
        ${ch.smell ? '<div class="ph-req" style="color:var(--warn)">⚠️ Your Rule Bender says: this one smells like a shortcut</div>' : ''}
        ${ch.req ? `<div class="ph-req">🔐 Needs ${ch.req.stat} +${ch.req.min}${ch.locked ? ': nobody on the team has it' : ''}</div>` : ''}
        ${ch.show ? `<div class="ph-arw">${arrows(ch.show)}</div>` : ''}
        ${ch.intel ? `<div class="ph-intel">🔎 ${effHtml(ch.intel)}</div>` : ''}
        ${voters.length && !spot ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}</button>`;
    }).join('');
}

// The roller vote (scenario checks and Tackle it): each cadet with their bonus and odds
function phRollerVote(v, st, odds, offline) {
  const votes = v.votes || {};
  return `<div class="ph-h">🗳️ WHO ROLLS ${esc(st || '')}?</div><div class="ph-note">Vote for the roller. The GM locks in the winner, then they roll.</div>${tieLine(v)}` + v.party.map((p, i) => {
    const o = odds && odds[i]; if (!o) return '';
    const voters = Object.keys(votes).filter(s => String(votes[s]) === 'r' + i).map(s => v.party[+s] && rankName(v.party[+s])).filter(Boolean);
    return pbtn('rvote', i, `${insignia(p)}<b>${esc(rankName(p))}</b>${i === v.you ? ' <small>(you)</small>' : ''}<br><small>${esc(o.stat)} ${sign(o.bonus)}${o.spec ? ' ★' : ''} · needs ${o.need}+ (${(21 - o.need) * 5}%)</small>${voters.length ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}`,
      { cls: cls3(String(votes[v.you]) === 'r' + i, !voted(v) && !offline), dis: offline });
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
  const votes = v.votes || {};
  return head + tieLine(v) + i.options.map((o, k) => {
    const voters = Object.keys(votes).filter(s => votes[s] === k).map(s => v.party[+s] && rankName(v.party[+s])).filter(Boolean);
    return pbtn('vote', k, `<span class="ph-key">${o.tackle ? '💪' : 'AB'[k] || k + 1}</span> <b>${esc(o.t)}</b><br><small>${o.html}</small>${voters.length ? `<div class="ph-voters">✋ ${voterHtml(v, voters)}</div>` : ''}`, { cls: cls3(votes[v.you] === k, !voted(v)) });
  }).join('');
}

function phBoss(v, me) {
  const b = v.boss; if (!b) return '';
  let h = `<div class="ph-h">👹 ${b.round ? `ROUND ${b.round}: ${esc(b.roundName)}` : BOSS.name}</div><div class="ph-card">IG HP ${b.hp}/${b.max}${b.atk && b.stage !== 'done' ? ` · <span style="color:var(--bad)">🗡️ ${meterTag(b.atk.k, `−${b.atk.n}`)} this round</span>` : ''}<div class="ph-bar" style="--c:var(--bad)"><i style="width:${Math.min(100, b.hp / b.max * 100)}%"></i></div>
    ${b.adverse ? '<small style="color:var(--bad)">🚨 Adverse Finding: −1 on every roll</small>' : ''}</div>`;
  if (b.stage === 'intro') h += `<div class="ph-card">The Inspector General has arrived. The audit checks your integrity first. Then three rounds: each round you pick ONE action on this phone.</div>`;
  if (b.stage === 'hotseat') {
    if (!b.who) h += `<div class="ph-card ph-center">🎤 THE INTERVIEW: everyone rolls; the two lowest face the IG's questions...</div>`;
    else { const j = b.who.indexOf(v.you);
      h += j >= 0 ? `<div class="ph-warn">🔥 YOU'RE IN THE HOT SEAT</div><div class="ph-situ">"${esc(b.q[j])}"</div>` : `<div class="ph-card">😮‍💨 You're safe. ${b.who.map(w => esc(rankName(v.party[w]))).join(' and ')} face the IG.</div>`; }
  }
  if (b.stage === 'act') {
    const my = b.my;
    if (outMe(v)) return h + `<div class="ph-warn">${me && me.fired ? '🪓 You were relieved: no action.' : "📵 You're in a meeting: no action this round."}</div>`;
    h += my ? `<div class="ph-card ph-center">✅ Locked: <b>${esc(b.myText)}</b><br><small>Tap another action to switch, until the GM resolves the round.</small></div>`
      : `<div class="ph-note">Pick ONE (secret until the GM resolves the round).</div>`;
    const bs = b.best || { stat: 'CMD', v: 0 }, pct = (21 - Math.min(20, Math.max(2, b.dc - bs.v + (b.adverse ? 1 : 0)))) * 5;
    h += pbtn('bact', 'press', `🗡️ <b>PRESS</b> <small>(${bs.stat} +${bs.v}, ${pct}% to hit for 2)</small><br><small>Roll your best stat against the IG</small>`, { cls: 'ph-bossbtn ' + cls3(my && my.type === 'press', !my) });
    h += pbtn('bact', 'defend', `🛡️ <b>DEFEND</b><br><small>Block 2 of the IG's attack this round</small>`, { cls: 'ph-bossbtn ' + cls3(my && my.type === 'defend', !my) });
    if (my) h += pbtn('bact', 'clear', '↩️ Clear my action');
    h += `<div class="ph-note">Team: ${v.party.map((p, k) => `${esc(p.name)} ${b.locked[k] ? '✅' : '⏳'}`).join(' · ')}</div>`;
  }
  if (b.stage === 'resolved' || b.stage === 'done') h += `<div class="ph-card"><small>${b.log.map(esc).join('<br>')}</small></div>`;
  if (b.result) h += `<div class="ph-card ph-center">${esc(b.result)}</div>`;
  return h;
}

// KIT tab: your class, and everything you or the team could use (gold = usable now)
function phKit(v, me) {
  if (!me || !me.cls) return `<div class="ph-card">Pick a position first.</div>`;
  const c = CLASS[me.cls], perk = c.perks.find(p => p.id === me.perk), up = c.ups.find(u => u.id === me.up);
  const now = {}; myUsable(v).forEach(u => { now[u.req] = u; });
  const row = (req, icon, name, text, state) => {
    const u = req && now[req];
    if (u) return pbtn('req', req, `${icon} <b>${esc(name)}</b> <span class="ph-tag">USE NOW</span><br><small>${mt(esc(u.hint))} · tap to ask the GM</small>`, { cls: 'avail' + (u.hot ? ' hot' : '') });
    return `<div class="ph-kitrow ${state === 'used' ? 'used' : ''}">${icon} <b>${esc(name)}</b>${state ? ` <span class="ph-tag off">${state.toUpperCase()}</span>` : ''}<br><small>${mt(esc(text))}</small></div>`;
  };
  let h = (PH.kitBack ? '<div class="ph-point">✅ This is your kit: check it any time during the game.<br><b>Now tap the glowing 🎮 GAME tab at the bottom to go back.</b><div class="ph-arrow">👇</div></div>' : '') + `<div class="ph-h">${clsIcon(me.cls, 24)} ${c.name}</div><div class="ph-note">Rank: ${c.rankLong} · Specialty: ${mt(c.guards)} (+1 on those checks)</div>
    <div class="ph-card"><div class="stats">${STATS.map(s => `<div>${s}<b>+${me.st ? me.st[s] : c.stats[s]}</b></div>`).join('')}</div>
      <small>${STATS.map(s => `<b>${s}</b> ${STAT_INFO[s].name}: ${STAT_INFO[s].text}`).join('<br>')}</small></div>`;
  h += `<div class="ph-h">🎒 YOUR KIT <small class="ph-legend">gold = usable now</small></div>`;
  if (c.ability) h += row('ability', clsIcon(me.cls, 20), c.ability.name, c.ability.text, c.ability.auto ? (v.ccInfo && v.ccInfo.negOff ? 'active' : 'passive') : me.used ? 'used' : 'once');
  else h += row(null, '👑', 'Command Token', c.abilityText, '');
  if (perk) h += row('perk:' + perk.id, perk.icon || '🎁', perk.name, perk.text, perk.id === 'hold' ? (me.perkUsed ? 'used' : 'passive') : me.perkUsed ? 'used' : 'once');
  if (up) h += row(null, '⬆️', up.name, up.text, 'upgrade');
  h += `<div class="ph-h">🧺 TEAM ITEMS (${(v.itemInfo || []).length}/3)</div>`;
  h += (v.itemInfo || []).length ? v.itemInfo.map(l => row('item:' + l.id, l.icon, l.name, l.text, '')).join('')
    : `<div class="ph-note">None yet (the bag holds 3). Loot drops from crises, crits and the BX.</div>`;
  return h;
}
