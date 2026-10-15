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
const JOINABLE = ['title', 'intro', 'avatars', 'party'];
function slotOf(cid) { const c = (S.clients || {})[cid]; return c ? c.slot : null; }
function onClient(conn, d) {
  if (!d || !d.cid) return;
  const cid = String(d.cid).slice(0, 40);
  S.clients = S.clients || {}; S.blocked = S.blocked || {};
  if (d.t === 'hello') {
    NET.conns[cid] = conn;
    if (S.blocked[cid]) { conn.send({ t: 'bye', why: 'removed' }); return; }
    if (!S.clients[cid]) {
      const name = String(d.name || '').trim().slice(0, 24) || 'Cadet';
      // seats fill while the party forms; anyone later is a spectator the GM can move into a seat (device transfer)
      const slot = JOINABLE.includes(S.phase) ? S.party.findIndex(p => !p.name.trim()) : -1;
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
      return apply(() => { me.av = d.v; me.g = AVATARS[d.v].g; });
    case 'look': { // uniform / hair colour (cosmetic), any time before the classes lock
      const [k, val] = String(d.v || '').split(':');
      const ok = ['avatars', 'party'].includes(S.phase) && ((k === 'uni' && UNIFORMS.some(u => u.id === (val || ''))) || (k === 'hair' && HAIR_COLORS.some(h => h.id === (val || ''))));
      if (!ok) return netSendTo(cid);
      return apply(() => { me[k] = val || ''; });
    }
    case 'patch': // the team patch, on the org chart screen (any cadet; last tap wins)
      if (S.phase !== 'manifest' || !patchFree(S, d.v)) return netSendTo(cid);
      return apply(() => { setPatch(d.v); sfx('click'); });
    case 'up': if (S.phase !== 'levelup' || !CLASS[me.cls].ups.some(u => u.id === d.v)) return netSendTo(cid);
      return apply(() => { me.up = d.v; });
    case 'vote': {
      // what can be voted on depends on the screen: route stop, rest/depot option, or mission choice
      const c = S.cur; let ok = false;
      // in a meeting: no vote this stop, and none on the route right after being pulled in
      if (slot === S.offline || (S.phase === 'map' && slot === S.offlineNext)) return netSendTo(cid);
      if (S.phase === 'map') ok = available().some(([t, i]) => `${t},${i}` === String(d.v));
      else if (S.phase === 'unit' && !S.unitRolled) ok = UNITS.some(u => u.id === String(d.v));
      else if (S.phase === 'node' && c && (c.step === 'choose' || c.step === 'who') && (c.type === 'rest' || c.type === 'depot'))
        ok = stopOptions().some(o => o.key === String(d.v) && !o.dis);
      else if (S.phase === 'node' && c && c.step === 'brief' && curMission()) {
        const ch = curMission().choices[d.v];
        ok = !!ch && !(ch.req && !gateOpen(ch.req)) && (c.type !== 'spot' || slot === c.slot); // spotlight: only that cadet decides
      }
      else if (S.inject && S.inject.stage === 'result' && S.inject.idx != null && !spinning()) {
        const mm = MURPHY[S.inject.idx], n = (mm.options || []).length;
        ok = !!(mm.options || [])[d.v] || (!!mm.tackle && d.v === n && !S.inject.blocked);
      }
      if (!ok) return netSendTo(cid);
      return apply(() => { S.votes = S.votes || {}; S.votes[slot] = d.v; });
    }
    // before a d20 check: any cadet can add a boost, toggle "play it safe", or volunteer to roll
    case 'boost': case 'unboost': case 'safe': case 'roller': {
      const c = S.cur;
      // Tackle it: any cadet can volunteer to roll
      if (d.t === 'roller' && S.phase === 'inject' && S.inject && S.inject.stage === 'tackle') {
        if (S.offline === slot || spinning()) return netSendTo(cid);
        return apply(() => { S.inject.roller = slot; setActor('tackle', slot); sfx('click'); });
      }
      if (S.phase !== 'node' || !c || c.step !== 'roll' || spinning() || S.offline === slot) return netSendTo(cid);
      if (c.type === 'spot' && slot !== c.slot) return netSendTo(cid); // spotlight: everyone else stays out of it
      if (d.t === 'boost') { if (!canBoost(d.v)) return netSendTo(cid); return apply(() => { c.boost = c.boost || {}; c.boost[d.v] = (c.boost[d.v] || 0) + 1; sfx('click'); }); }
      if (d.t === 'unboost') return apply(() => { c.boost = {}; });
      if (d.t === 'safe') return apply(() => { c.safe = !c.safe; sfx('click'); });
      if (c.spec.check.stat === 'LOYB' || c.type === 'spot') return netSendTo(cid);
      return apply(() => { c.roller = slot; sfx('click'); }); // "I'll roll"
    }
    case 'act': {
      // the cadet whose turn it is presses their roll/spin button
      if (!S.actor || S.actor.slot !== slot || S.actor.kind !== d.v || spinning() || !ACTOR_RUN[d.v]) return netSendTo(cid);
      return apply(() => { S.lastActor = slot; ACTOR_RUN[d.v](); });
    }
    case 'roll': {
      const c = S.cur;
      if (S.phase !== 'node' || !c || c.step !== 'roll' || (c.roller ?? S.tokenHolder) !== slot || spinning() || S.offline === slot) return netSendTo(cid);
      return apply(() => resolveRoll(slot, {}));
    }
    case 'bact': { // boss: this cadet's action for the round (null clears it)
      if (S.phase !== 'boss' || !S.boss || S.boss.stage !== 'act' || spinning()) return netSendTo(cid);
      if (d.v == null) return apply(() => { delete S.boss.acts[slot]; });
      const a = d.v && typeof d.v === 'object' ? { type: String(d.v.type), stat: d.v.stat, k: d.v.k, to: d.v.to != null ? +d.v.to : undefined, slot: d.v.slot } : null;
      if (!a || !bossActOk(slot, a)) return netSendTo(cid);
      Object.keys(a).forEach(k => a[k] === undefined && delete a[k]);
      return apply(() => { S.boss.acts[slot] = a; });
    }
    case 'team': { // any cadet can name the team while the party forms
      if (!['title', 'intro', 'party', 'perks', 'avatars'].includes(S.phase)) return netSendTo(cid);
      S.callsign = String(d.v || '').trim().slice(0, 14); save(); push(true); renderGM();
      return;
    }
    case 'req': {
      const kinds = { ability: 'use their ability' };
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
  const c = S.cur, u = unitObj();
  const v = {
    phase: S.phase, introPage: S.introPage, you: slot, room: roomCode(), spinning: spinning(),
    party: S.party.map((p, i) => ({ name: p.name, cls: p.cls, perk: p.perk, av: p.av, g: p.g || null, uni: p.uni || '', hair: p.hair || '', up: p.up, used: p.used,
      st: p.cls ? Object.fromEntries(STATS.map(x => [x, statOf(i, x)])) : null, perkUsed: !!(p.perk && S.flags['perkUsed_' + p.perk]) })),
    tokenHolder: S.tokenHolder, offline: S.offline, offlineNext: S.offlineNext, unit: S.unit, cc: S.cc, notice: S.notice || null,
    branch: !!S.branch, objectives: S.phase === 'intro' || S.phase === 'debrief',
    myGrade: slot != null && S.grades && S.grades[slot] && S.grades[slot].shown ? S.grades[slot] : null,
    ccInfo: u ? { pos: u.cc.pos, neg: u.cc.neg, negOff: !!S.flags.ccNegOff, intent: u.cc.intent } : null,
    meters: S.meters, items: S.items,
    npcs: (S.npcs || []).map(n => ({ slot: n.slot, rank: n.rank, name: n.name, pub: n.pub, loy: n.loy, out: n.out, broken: n.broken, ally: isAlly(n), trait: n.trait, done: !!(S.traitDone || {})[n.slot] })),
    unitPicked: !!S.unitRolled, benderTell: benderTell(S),
    map: S.map ? S.map.tiers.map(t => t.map(n => ({ type: n.type, done: n.done, visited: n.visited }))) : null, pos: S.pos, links: S.map ? S.map.links : null,
    avail: S.phase === 'map' ? available().map(([t, i]) => `${t},${i}`) : [],
    votes: S.votes || {}, voters: votingOpen(S) ? S.party.filter((_, i) => i !== S.offline && !(S.phase === 'map' && i === S.offlineNext)).length : 0,
    actor: S.actor || null, danger: dangerInfo(S), actorTable: S.actor && !spinning() ? actorTable(S) : null,
    usable: usableNow(S),
    itemInfo: (S.items || []).map(id => { const l = LOOT.find(x => x.id === id); return { id, icon: l.icon, name: l.name, text: fill(S, l.text), color: lootColor(l) }; }),
    ach: S.ach, final: S.final ? { g: S.final.grade.g, title: S.final.grade.title, total: S.final.total } : null,
    team: S.callsign || '', patch: patchOf(S), patches: S.phase === 'manifest' ? (PATCHES[S.unit] || []).map(p => ({ ...p, taken: !patchFree(S, p.id) })) : null, tie: voteTie(S) ? tieText(S) : null,
    result: resultReady(S) ? { head: resultHeadline(S), ...resultSummary(S) } : null,
    gameOver: S.gameOver,
  };
  if (S.phase === 'node' && c && (c.type === 'rest' || c.type === 'depot') && (c.step === 'choose' || c.step === 'who'))
    v.options = stopOptions().map(o => ({ key: o.key, html: mt(esc(o.label)), dis: !!o.dis }));
  if (c && S.phase === 'node') {
    v.cur = { type: c.type, step: c.step, choice: c.choice, roller: c.roller ?? S.tokenHolder, lead: c.lead ?? null, result: c.result || null, stars: c.stars || null,
      slot: c.type === 'spot' ? c.slot : null, trade: c.trade || null,
      roll: c.rollRes ? { d20: c.rollRes.d20, total: c.rollRes.total, dc: c.rollRes.dc, pass: c.rollRes.pass, nat: c.rollRes.nat, safe: !!c.rollRes.safe } : null,
      check: c.step === 'roll' && c.spec && c.spec.check ? { stat: c.spec.check.stat } : null };
    if (c.step === 'roll' && c.spec && c.spec.check) {
      const p = rollPreview(), st = c.spec.check.stat;
      Object.assign(v.cur, { boost: c.boost || {}, safe: !!c.safe, odds: rollOdds(p, c.safe), typ: !!c.typ,
        canBoost: Object.fromEntries(BOOST_METERS.map(k => [k, canBoost(k)])),
        stats: st && st !== 'LOYB' ? S.party.map((_, i) => rollBonus(i, st, c.spec.check.m)) : null,
        spec: st && st !== 'LOYB' ? S.party.map((_, i) => isSpec(i, c.spec.check.m)) : null });
    }
    if (m) v.mission = { title: m.title, icon: m.icon, sob: m.sob, text: fill(S, m.text), cc: !!m.cc,
      compartmented: arrowsHidden(S), choices: m.choices.map(ch => ({ t: fill(S, ch.t), show: arrowsHidden(S) ? null : ch.show || null, mic: !!ch.mic, intel: c.intel ? specText(S, ch) : null,
        req: ch.req || null, locked: !!(ch.req && !gateOpen(ch.req)), smell: !!(ch.trap && benderTell(S)) })) };
  }
  if (S.phase === 'inject' && S.inject) {
    const inj = S.inject, mm = inj.idx != null && !spinning() ? MURPHY[inj.idx] : null;
    v.inject = { stage: inj.stage, wheel: inj.filter ? INJECT_WHEELS[inj.filter] : null, name: mm ? mm.name : null, text: mm ? fill(S, mm.text || '') : '', note: inj.note ? fill(S, inj.note) : null, type: mm ? mm.type : null,
      effHtml: mm && !mm.options ? effHtml(effText(S, mm.eff)) : null,
      options: mm && mm.options ? mm.options.map(o => ({ t: fill(S, o.t), html: effHtml(effText(S, o.eff)) })).concat(mm.tackle && !inj.blocked
        ? [(() => { const r = bestRoller(mm.tackle.stat, mm.tackle.m), b = rollBonus(r, mm.tackle.stat, mm.tackle.m), need = Math.min(20, Math.max(2, mm.tackle.dc + DIFFICULTY.dcPlus - b));
            return { t: `Tackle it (${mm.tackle.stat} check)`, html: `${esc(cadetName(r))} rolls (${mm.tackle.stat} ${sign(b)}): need ${need}+ (${(21 - need) * 5}%). Pass: no loss. Fail: ${effHtml(effText(S, mm.tackle.fail || {}))}`, tackle: true }; })()] : []) : null,
      tackle: inj.stage === 'tackle' ? { stat: mm.tackle.stat, dc: mm.tackle.dc + DIFFICULTY.dcPlus, roller: inj.roller, m: mm.tackle.m,
        bonus: S.party.map((_, i) => rollBonus(i, mm.tackle.stat, mm.tackle.m)), spec: S.party.map((_, i) => isSpec(i, mm.tackle.m)) } : null };
  }
  if (S.boss) {
    const Bs = S.boss, others = Object.entries(Bs.acts).filter(([s2]) => +s2 !== slot).map(([, a]) => a);
    v.boss = { hp: Bs.hp, max: Bs.max, round: Bs.round, stage: Bs.stage, atk: Bs.atk, adverse: Bs.adverse, weak: Bs.weak, dc: examDC(Bs),
      roundName: Bs.round ? BOSS_ROUNDS[Bs.round - 1].name : null,
      who: Bs.p2.who, q: Bs.p2.who ? Bs.p2.q : null,
      my: slot != null ? Bs.acts[slot] || null : null, myText: slot != null && Bs.acts[slot] ? bossActText(slot, Bs.acts[slot]) : null,
      locked: S.party.map((_, i) => !!Bs.acts[i]),
      takenStats: others.filter(a => a.type === 'press').map(a => a.stat), allyTaken: others.some(a => a.type === 'ally'),
      allies: (S.npcs || []).filter(n => isAlly(n) && !Bs.allyUsed[n.slot]).map(n => ({ slot: n.slot, name: `${n.rank} ${n.name}` })),
      log: Bs.log.slice(-6), result: Bs.result || null };
  }
  return v;
}
function netSendTo(cid) {
  const conn = NET.conns[cid]; if (!conn || !conn.open) return;
  const real = S; S = shownState(); // mid-spin, phones see the state from before the spin (no spoilers)
  try { conn.send({ t: 'view', v: publicView(slotOf(cid)) }); } catch (e) { } finally { S = real; }
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
    ${spectators().map(([cid, c]) => `<div class="row warnline">👀 <b>${esc(c.name)}</b> is watching (new device). Move into seat: ${S.party.map((p, i) => p.name.trim() ? B('moveSeat', `P${i + 1} ${esc(rankName(p) || p.name)}`, { arg: `${i}|${cid}`, cls: 'sm go', title: 'Device transfer: this device takes over that cadet (the old device becomes a spectator)' }) : '').join(' ')}</div>`).join('')}
    ${reqs.map((r, k) => `<div class="row warnline">🙋 ${esc(r.text)} ${B('reqOk', 'Approve', { arg: k, cls: 'sm go' })} ${B('reqNo', 'Dismiss', { arg: k, cls: 'sm' })}</div>`).join('')}
    <div class="row">${B('newRoom', '🔄 New room code', { cls: 'sm' })} ${B('dropPhones', '📴 Disconnect all phones', { cls: 'sm' })}</div></div>`;
}
act('reqOk', k => {
  const r = (S.requests || [])[+k]; if (!r) return false;
  S.requests.splice(+k, 1);
  if (r.kind === 'ability') return useAbility(r.slot);
  if (r.kind.startsWith('item:')) { const k2 = S.items.indexOf(r.kind.slice(5)); if (k2 < 0) return alert('The team no longer has that item.'); return useItem(k2); }
  if (r.kind.startsWith('perk:')) return usePerk(r.slot);
});
// connected devices that aren't in a seat (joined late, a new phone, a private tab...)
function spectators() { return Object.entries(S.clients || {}).filter(([cid, c]) => c.slot == null && NET.conns[cid] && NET.conns[cid].open); }
// Device transfer: a spectator device takes over a cadet's seat; whatever device had it becomes a spectator
act('moveSeat', a => {
  const k = a.indexOf('|'), slot = +a.slice(0, k), cid = a.slice(k + 1), c = (S.clients || {})[cid], p = S.party[slot];
  if (!c || !p || !p.name.trim()) return false;
  for (const o in S.clients) if (S.clients[o].slot === slot) S.clients[o].slot = null;
  c.slot = slot; c.name = p.name;
  log('Device transfer', `${rankName(p) || p.name} moved to a new device`); toast('📱', 'DEVICE TRANSFER', `${rankName(p) || p.name} is back in the game`);
});
act('reqNo', k => { (S.requests || []).splice(+k, 1); });
act('newRoom', () => { if (!confirm('Make a new room code? Connected phones will need to rejoin.')) return false; netStop(); localStorage.removeItem('sq_room'); try { NET.peer.destroy(); } catch (e) { } NET.peer = null; setTimeout(netStart, 300); });
act('dropPhones', () => { if (!confirm('Disconnect every phone?')) return false; netStop(); S.clients = {}; });
act('kick', i => {
  const cid = Object.keys(S.clients || {}).find(k => S.clients[k].slot === +i);
  if (cid) { S.blocked = S.blocked || {}; S.blocked[cid] = true; delete S.clients[cid]; try { NET.conns[cid].send({ t: 'bye', why: 'removed' }); } catch (e) { } }
  S.party[+i] = { name: '', cls: '', perk: '', up: '', used: 0, av: null };
});
