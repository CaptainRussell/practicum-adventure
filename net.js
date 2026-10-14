/* =====================================================================
   PRACTICUM ADVENTURE - phone play (GM side)
   The GM console opens a PeerJS "room". Cadets' phones (join.html) connect
   to it directly over WebRTC: no server of our own, no accounts. The free
   PeerJS broker only introduces the two ends; game traffic is peer-to-peer.

   Phones only ever receive publicView(): what the projector already shows,
   plus their own picks. Hidden traits, exact effects and trap flags never
   leave this window.
   ===================================================================== */
const NET = { peer: null, conns: {}, status: 'off', err: '' };
const ROOM_PREFIX = 'afas3410-sq-';

function roomCode() {
  let c = localStorage.getItem('sq_room');
  if (!c) { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[rnd(23)]).join(''); localStorage.setItem('sq_room', c); }
  return c;
}
function siteBase() {
  if (/^https?:/.test(location.protocol)) return location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
  return localStorage.getItem('sq_site') || '';
}
function joinUrl() { const b = siteBase(); return b ? `${b}join.html?room=${roomCode()}` : ''; }

function netStart() {
  if (NET.peer && !NET.peer.destroyed) return;
  if (!window.Peer) { NET.status = 'nolib'; NET.err = 'PeerJS did not load (no internet?)'; return; }
  NET.status = 'connecting';
  const peer = new Peer(ROOM_PREFIX + roomCode().toLowerCase(), { debug: 0 });
  NET.peer = peer;
  peer.on('open', () => { NET.status = 'live'; NET.err = ''; renderGM(); push(true); });
  peer.on('connection', conn => {
    conn.on('data', d => onClient(conn, d));
    conn.on('close', () => { for (const k in NET.conns) if (NET.conns[k] === conn) delete NET.conns[k]; renderGM(); });
  });
  peer.on('disconnected', () => { NET.status = 'reconnecting'; try { peer.reconnect(); } catch (e) { } renderGM(); });
  peer.on('error', e => {
    NET.err = e.type || String(e);
    if (e.type === 'unavailable-id') { NET.status = 'retrying'; try { peer.destroy(); } catch (x) { } setTimeout(netStart, 4000); }
    else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) NET.status = 'error';
    renderGM();
  });
}
function netStop() {
  for (const k in NET.conns) { try { NET.conns[k].send({ t: 'bye' }); NET.conns[k].close(); } catch (e) { } }
  NET.conns = {};
}
function phonesOnline() { return Object.keys(NET.conns).length; }

/* ---- incoming ---- */
const JOINABLE = ['title', 'intro', 'party'];
function slotOf(cid) { const c = (S.clients || {})[cid]; return c ? c.slot : null; }
function onClient(conn, d) {
  if (!d || !d.cid) return;
  const cid = String(d.cid).slice(0, 40);
  S.clients = S.clients || {}; S.blocked = S.blocked || {};
  if (d.t === 'hello') {
    NET.conns[cid] = conn;
    if (S.blocked[cid]) { conn.send({ t: 'bye', why: 'removed' }); return; }
    if (!S.clients[cid] && JOINABLE.includes(S.phase)) {
      const name = String(d.name || '').trim().slice(0, 24) || 'Cadet';
      const slot = S.party.findIndex(p => !p.name.trim());
      if (slot >= 0) {
        S.party[slot].name = name;
        S.clients[cid] = { name, slot };
        log('Phone joined', `${name} (P${slot + 1})`);
        toast('📱', 'CADET JOINED', name); sfx('click');
      } else S.clients[cid] = { name, slot: null };
    }
    push(true); renderGM();
    return;
  }
  const slot = slotOf(cid);
  if (slot == null || !S.party[slot]) return;
  const me = S.party[slot];
  const apply = fn => { snap(); const r = fn(); if (r === false) { hist.pop(); netSendTo(cid); return; } push(); };
  switch (d.t) {
    case 'cls': if (S.phase !== 'party' || !CLASS[d.v]) return netSendTo(cid);
      if (S.party.some((p, i) => i !== slot && p.name && p.cls === d.v)) return netSendTo(cid);
      return apply(() => { me.cls = d.v; me.perk = ''; });
    case 'perk': if (S.phase !== 'perks' || !me.cls || !CLASS[me.cls].perks.some(p => p.id === d.v)) return netSendTo(cid);
      return apply(() => { me.perk = d.v; });
    case 'av': if (S.phase !== 'avatars' || !(d.v >= 0 && d.v < AVATARS.length)) return netSendTo(cid);
      if (S.party.some((p, i) => i !== slot && p.av === d.v)) return netSendTo(cid);
      return apply(() => { me.av = d.v; });
    case 'up': if (S.phase !== 'levelup' || !CLASS[me.cls].ups.some(u => u.id === d.v)) return netSendTo(cid);
      return apply(() => { me.up = d.v; });
    case 'vote': {
      // what can be voted on depends on the screen: route stop, rest/depot option, or mission choice
      const c = S.cur; let ok = false;
      if (S.phase === 'map') ok = available().some(([t, i]) => `${t},${i}` === String(d.v));
      else if (S.phase === 'node' && c && c.step === 'choose' && (c.type === 'rest' || c.type === 'depot'))
        ok = (c.type === 'rest' ? restOptions() : depotOptions()).some(o => o.key === String(d.v) && !o.dis);
      else if (S.phase === 'node' && c && c.step === 'brief' && curMission()) ok = !!curMission().choices[d.v];
      else if (S.inject && S.inject.stage === 'result' && S.inject.idx != null && !spinning()) ok = !!(MURPHY[S.inject.idx].options || [])[d.v];
      if (!ok) return netSendTo(cid);
      return apply(() => { S.votes = S.votes || {}; S.votes[slot] = d.v; });
    }
    // before a d20 check: any cadet can add a boost or toggle "play it safe"; the 👑 holder picks the roller
    case 'boost': case 'unboost': case 'safe': case 'roller': {
      const c = S.cur;
      if (S.phase !== 'node' || !c || c.step !== 'roll' || spinning() || S.offline === slot) return netSendTo(cid);
      if (d.t === 'boost') { if (!canBoost(d.v)) return netSendTo(cid); return apply(() => { c.boost = c.boost || {}; c.boost[d.v] = (c.boost[d.v] || 0) + 1; sfx('click'); }); }
      if (d.t === 'unboost') return apply(() => { c.boost = {}; });
      if (d.t === 'safe') return apply(() => { c.safe = !c.safe; sfx('click'); });
      if (slot !== S.tokenHolder || !S.party[d.v] || S.offline === +d.v || c.spec.check.stat === 'LOYB') return netSendTo(cid);
      return apply(() => { c.roller = +d.v; sfx('click'); });
    }
    case 'act': {
      // the cadet whose turn it is presses their roll/spin button
      if (!S.actor || S.actor.slot !== slot || S.actor.kind !== d.v || spinning() || !ACTOR_RUN[d.v]) return netSendTo(cid);
      return apply(() => { S.lastActor = slot; ACTOR_RUN[d.v](); });
    }
    case 'p3roll': {
      if (spinning()) return netSendTo(cid);
      return apply(() => bossP3Roll(slot));
    }
    case 'roll': {
      const c = S.cur;
      if (S.phase !== 'node' || !c || c.step !== 'roll' || (c.roller ?? S.tokenHolder) !== slot || spinning() || S.offline === slot) return netSendTo(cid);
      return apply(() => resolveRoll(slot, { coffee: S.pending.coffee, typ: c.typ }));
    }
    case 'b3stat': {
      const B = S.boss; if (S.phase !== 'boss' || !B || B.phase !== 3 || B.p3.results || !STATS.includes(d.v)) return netSendTo(cid);
      if (B.p3.rows.some((r, i) => i !== slot && r.stat === d.v)) return netSendTo(cid);
      return apply(() => { B.p3.rows[slot].stat = d.v; });
    }
    case 'req': {
      const kinds = { ability: 'use their ability', pause: 'call a Tactical Pause', intel: 'use the Intel Briefing', waiver: 'Submit a Waiver (reroll)' };
      const k = String(d.v || '');
      let what = kinds[k];
      if (k.startsWith('item:')) { const it = LOOT.find(l => l.id === k.slice(5)); if (it && S.items.includes(it.id)) what = `use the team's ${it.icon} ${it.name}`; }
      if (k.startsWith('perk:')) { const pk = CLASS[me.cls] && CLASS[me.cls].perks.find(p => p.id === k.slice(5)); if (pk && me.perk === pk.id) what = `use their perk: ${pk.name}`; }
      if (!what) return;
      S.requests = (S.requests || []).filter(r => !(r.slot === slot && r.kind === k));
      S.requests.push({ slot, kind: k, text: `${rankName(me)} wants to ${what}` });
      toast('🙋', 'REQUEST SENT TO THE GM', `${rankName(me)}: ${what}`);
      sfx('click'); push(true); renderGM();
      return;
    }
  }
}

/* ---- outgoing: what a phone is allowed to see ---- */
function publicView(slot) {
  const m = S.phase === 'node' ? curMission() : null;
  const c = S.cur;
  const v = {
    phase: S.phase, introPage: S.introPage, you: slot, room: roomCode(), spinning: spinning(),
    party: S.party.map(p => ({ name: p.name, cls: p.cls, perk: p.perk, av: p.av, up: p.up, used: p.used })),
    tokenHolder: S.tokenHolder, offline: S.offline, unit: S.unit, cc: S.cc,
    meters: S.meters, lt: S.lt, items: S.items,
    npcs: (S.npcs || []).map(n => ({ slot: n.slot, rank: n.rank, name: n.name, pub: n.pub, loy: n.loy, out: n.out, broken: n.broken, ally: isAlly(n), trait: n.revealed ? n.trait : null })),
    map: S.map ? S.map.tiers.map(t => t.map(n => ({ type: n.type, done: n.done, visited: n.visited }))) : null, pos: S.pos,
    avail: S.phase === 'map' ? available().map(([t, i]) => `${t},${i}`) : [],
    votes: S.votes || {},
    actor: S.actor || null,
    usable: usableNow(S),
    itemInfo: (S.items || []).map(id => { const l = LOOT.find(x => x.id === id); return { id, icon: l.icon, name: l.name, text: l.text, rar: l.rar }; }),
    ach: S.ach, final: S.final ? { g: S.final.grade.g, title: S.final.grade.title, total: S.final.total } : null,
    gameOver: S.gameOver,
  };
  if (S.phase === 'node' && S.cur && S.cur.step === 'choose' && (S.cur.type === 'rest' || S.cur.type === 'depot'))
    v.options = (S.cur.type === 'rest' ? restOptions() : depotOptions()).map(o => ({ key: o.key, html: mt(esc(o.label)), dis: !!o.dis }));
  if (c && S.phase === 'node') {
    v.cur = { type: c.type, step: c.step, choice: c.choice, roller: c.roller ?? S.tokenHolder, result: c.result || null, stars: c.stars || null,
      roll: c.rollRes ? { d20: c.rollRes.d20, total: c.rollRes.total, dc: c.rollRes.dc, pass: c.rollRes.pass, nat: c.rollRes.nat, safe: !!c.rollRes.safe } : null,
      check: c.step === 'roll' && c.spec && c.spec.check ? { stat: c.spec.check.stat } : null };
    if (c.step === 'roll' && c.spec && c.spec.check) {
      const p = rollPreview(), st = c.spec.check.stat;
      Object.assign(v.cur, { boost: c.boost || {}, safe: !!c.safe, odds: rollOdds(p, c.safe),
        canBoost: Object.fromEntries(BOOST_METERS.map(k => [k, canBoost(k)])),
        stats: st && st !== 'LOYB' ? S.party.map((_, i) => statOf(i, st)) : null });
    }
    if (m) v.mission = { title: m.title, icon: m.icon, sob: m.sob, text: fill(S, m.text),
      choices: m.choices.map(ch => ({ t: fill(S, ch.t), show: ch.show || null, lock: !!ch.lock, mic: !!ch.mic, intel: c.intel ? specText(S, ch) : null })) };
  }
  if (S.phase === 'inject' && S.inject) {
    const mm = S.inject.idx != null && !spinning() ? MURPHY[S.inject.idx] : null;
    v.inject = { stage: S.inject.stage, name: mm ? mm.name : null, text: mm ? mm.text || '' : '', note: S.inject.note || null, type: mm ? mm.type : null,
      effHtml: mm && !mm.options ? effHtml(effText(S, mm.eff)) : null,
      options: mm && mm.options ? mm.options.map(o => ({ t: o.t, html: effHtml(effText(S, o.eff)) })) : null };
  }
  if (S.boss) v.boss = { phase: S.boss.phase, hp: S.boss.hp, max: S.boss.max, who: S.boss.p2.who, q: S.boss.p2.who ? S.boss.p2.q.map(i => BOSS_QUESTIONS[i]) : null,
    stats: S.boss.p3.rows.map(r => r.stat), rolls: S.boss.p3.rows.map(r => r.d20 || null), allies: S.boss.p3.rows.map(r => !!r.ally),
    done3: !!S.boss.p3.results, result: S.boss.result || null };
  return v;
}
function netSendTo(cid) {
  const conn = NET.conns[cid]; if (!conn || !conn.open) return;
  try { conn.send({ t: 'view', v: publicView(slotOf(cid)) }); } catch (e) { }
}
function netBroadcast() { for (const cid in NET.conns) netSendTo(cid); }

/* ---- GM panel ---- */
function gmPhonesCard() {
  const url = joinUrl();
  const st = { off: '⚪ off', connecting: '🟡 connecting…', live: '🟢 live', reconnecting: '🟡 reconnecting…', retrying: '🟡 room code busy, retrying…', error: '🔴 error', nolib: '🔴 offline' }[NET.status] || NET.status;
  const reqs = S.requests || [];
  return `<div class="gcard"><h3>📱 Phones · room ${roomCode()} · ${st} · ${phonesOnline()} connected</h3>
    ${NET.err && NET.status !== 'live' ? `<p class="warnline">${esc(NET.err)}. If this keeps happening, the network may block phone connections; just run the game from this console.</p>` : ''}
    ${url ? `<p class="note">Join: <b>${esc(url)}</b></p>` : `<p class="warnline">Opened from a file: paste your GitHub Pages address to show a join link. <input type="text" id="siteUrl" placeholder="https://you.github.io/practicum-adventure/" value="${esc(localStorage.getItem('sq_site') || '')}" data-inp="site"></p>`}
    ${reqs.map((r, k) => `<div class="row warnline">🙋 ${esc(r.text)} ${B('reqOk', 'Approve', { arg: k, cls: 'sm go' })} ${B('reqNo', 'Dismiss', { arg: k, cls: 'sm' })}</div>`).join('')}
    <div class="row">${B('newRoom', '🔄 New room code', { cls: 'sm' })} ${B('dropPhones', '📴 Disconnect all phones', { cls: 'sm' })}</div></div>`;
}
act('reqOk', k => {
  const r = (S.requests || [])[+k]; if (!r) return false;
  S.requests.splice(+k, 1);
  if (r.kind === 'ability') return useAbility(r.slot);
  if (r.kind === 'pause') { if (!S.lt.pause) return alert('Tactical Pause already used.'); return ACT.ltPause(); }
  if (r.kind === 'intel') { if (!S.lt.intel || !S.cur || S.cur.step !== 'brief') return alert('Intel Briefing only works while a mission brief is up (and once per run).'); return ACT.ltIntel(); }
  if (r.kind === 'waiver') { if (!S.lt.waiver || !S.cur || !S.cur.rollRes || S.cur.step !== 'done') return alert('A Waiver needs a roll that just happened.'); return ACT.waiver(); }
  if (r.kind.startsWith('item:')) { const k2 = S.items.indexOf(r.kind.slice(5)); if (k2 < 0) return alert('The team no longer has that item.'); return useItem(k2); }
  if (r.kind.startsWith('perk:')) {
    const id = r.kind.slice(5);
    if (id === 'typ') { if (!S.cur || S.cur.step !== 'roll') return alert('Trust Your People works during a CMD roll.'); S.cur.typ = true; }
    else S.flags['perkUsed_' + id] = true;
    const pk = CLASS[S.party[r.slot].cls].perks.find(p => p.id === id);
    toast(CLASS[S.party[r.slot].cls].icon, 'PERK USED', `${cadetName(r.slot)}: ${pk ? pk.name : id}`);
    log('Perk', `${cadetName(r.slot)}: ${pk ? pk.name : id}`);
  }
});
act('reqNo', k => { (S.requests || []).splice(+k, 1); });
act('newRoom', () => { if (!confirm('Make a new room code? Connected phones will need to rejoin.')) return false; netStop(); localStorage.removeItem('sq_room'); try { NET.peer.destroy(); } catch (e) { } NET.peer = null; setTimeout(netStart, 300); });
act('dropPhones', () => { if (!confirm('Disconnect every phone?')) return false; netStop(); S.clients = {}; });
act('kick', i => {
  const cid = Object.keys(S.clients || {}).find(k => S.clients[k].slot === +i);
  if (cid) { S.blocked = S.blocked || {}; S.blocked[cid] = true; delete S.clients[cid]; try { NET.conns[cid].send({ t: 'bye', why: 'removed' }); } catch (e) { } }
  S.party[+i] = { name: '', cls: '', perk: '', up: '', used: 0, av: null };
});
