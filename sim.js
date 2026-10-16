/* =====================================================================
   PRACTICUM ADVENTURE - balance simulator (GM console only; not loaded by the game)
   Paste into the GM console's DevTools, or load with:  await import('./sim.js')
   then:  simBatch(200)  → grade spread for a PASSIVE team vs a PROACTIVE team.
   Passive  = random legal choices, never uses items / perks / abilities.
   Proactive = picks the best roller, uses items, perks and abilities when they help,
               rests on the lowest meter, smarter boss play (Defend / Ally / Support).
   Both teams avoid integrity traps (Game Over is a separate lesson) and act out 🎤
   scenes at the same average quality.
   ===================================================================== */
(function () {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const starRoll = () => { const r = Math.random(); return r < 0.2 ? 1 : r < 0.7 ? 2 : 3; };
  const lowest = () => METERS.slice().sort((a, b) => S.meters[a.k] - S.meters[b.k])[0].k;

  function useTools(active) {
    if (!active) return;
    // abilities and perks the game itself flags as useful right now
    for (const u of usableNow(S)) {
      if (u.req === 'ability' && u.who != null && (u.hot || Math.random() < 0.5)) try { useAbility(u.who); S.notice = null; } catch (e) { }
      else if (u.req.startsWith('perk:') && u.who != null && (u.hot || Math.random() < 0.4)) try { usePerk(u.who); S.notice = null; } catch (e) { }
      else if (u.req.startsWith('item:') && u.hot) { const k = S.items.indexOf(u.req.slice(5)); if (k >= 0) try { useItem(k); } catch (e) { } }
    }
  }
  function doActor() {
    let g = 0;
    while (S.actor && g++ < 10) { const k = S.actor.kind; S.actor && (S.lastActor = S.actor.slot); ACTOR_RUN[k](); S.spinUntil = 0; }
  }

  function playNode(active) {
    const c = S.cur;
    if ((c.type === 'rest' || c.type === 'depot') && c.step !== 'choose') { doActor(); afterNode(); return; }
    if (c.type === 'rest') { ACT.restMeter(active ? lowest() : pick(METERS).k); return; }
    if (c.type === 'depot') {
      if (active && S.meters.res >= 4 && S.meters.tru <= 4) ACT.depotPick('coffee');
      else if (active && S.meters.mor >= 5 && S.meters.res <= 3) ACT.depotPick('overtime');
      else ACT.depotPick('skip');
      return;
    }
    if (c.type === 'unknown') { ACT.spinMystery(); S.spinUntil = 0; ACT.mysteryGo(); return; }
    const m = curMission(); if (!m) return;
    if (c.step === 'brief') {
      const ok = m.choices.map((ch, i) => i).filter(i => !m.choices[i].trap && !(m.choices[i].req && !gateOpen(m.choices[i].req)));
      useTools(active);
      if (S.cur !== c || S.cur.step !== 'brief') return;
      choose(pick(ok.length ? ok : [0]));
      return;
    }
    if (c.step === 'roll') {
      if (active) useTools(active);
      if (!c.rollerLocked) { c.roller = active ? bestRoller(c.spec.check.stat, c.spec.check.m) : pick(S.party.map((_, i) => i).filter(i => !isOut(S, i))); c.rollerLocked = true; }
      resolveRoll(c.roller, {}); S.spinUntil = 0; return;
    }
    if (c.step === 'stars') { if (c.lead == null) { doActor(); } rateStars(starRoll(), S.cur.lead ?? 0); S.spinUntil = 0; return; }
    if (c.step === 'done') {
      doActor();
      if (active && memoTarget(S)) { const i = S.party.findIndex(p => p.perk === 'mti'); if (i >= 0 && perkWhen(S, S.party[i], i)) { usePerk(i); S.notice = null; return; } }
      afterNode(); return;
    }
  }

  function playInject(active) {
    const inj = S.inject;
    if (inj.stage === 'trigger' || inj.stage === 'murphy') { useTools(active); if (S.inject && (S.inject.stage === 'trigger' || S.inject.stage === 'murphy')) { doActor(); } S.spinUntil = 0; return; }
    if (inj.stage === 'result') {
      const m = MURPHY[inj.idx];
      if (!m.options) { applyInject(0); return; }
      let ch = pick(m.options.map((_, i) => i));
      if (active) { // pick the option that costs the least overall (or tackle it with a good roller)
        ch = m.options.map((o, i) => [i, effSum(o.eff)]).sort((a, b) => b[1] - a[1])[0][0];
        if (m.tackle) { const r = bestRoller(m.tackle.stat, m.tackle.m); if (rollBonus(r, m.tackle.stat, m.tackle.m) >= 3 && m.type === 'bad') ch = m.options.length; }
      } else if (m.tackle && Math.random() < 0.3) ch = m.options.length;
      applyInject(ch); return;
    }
    if (inj.stage === 'tackle') { if (!inj.rollerLocked) { inj.roller = bestRoller(MURPHY[inj.idx].tackle.stat, MURPHY[inj.idx].tackle.m); inj.rollerLocked = true; setActor('tackle', inj.roller); } doActor(); S.spinUntil = 0; return; }
    if (inj.stage === 'done') {
      if (active && MURPHY[inj.idx].type === 'bad' && !inj.cancelled) {
        const k = S.items.findIndex(id => LOOT.find(l => l.id === id).use.type === 'cancel');
        const ch = S.party.findIndex(p => p.perk === 'beenthere');
        if (k >= 0 && effSum(MURPHY[inj.idx].options ? {} : {}) <= 0) { useItem(k); return; }
        if (ch >= 0 && perkWhen(S, S.party[ch], ch)) { usePerk(ch); S.notice = null; return; }
      }
      closeInject(); S.spinUntil = 0; return;
    }
  }

  function playBoss(active) {
    const Bs = S.boss;
    if (Bs.stage === 'intro' || Bs.stage === 'resolved') { useTools(active); if (bossNext() === false) return 'stuck'; return; }
    if (Bs.stage === 'hotseat') {
      if (!Bs.p2.who) { bossHotSeat(); S.spinUntil = 0; return; }
      Bs.p2.stars = [starRoll(), starRoll()]; bossStarsDone(); return;
    }
    if (Bs.stage === 'act') {
      useTools(active);
      S.party.forEach((_, i) => { if (isOut(S, i)) return; Bs.acts[i] = active && i === S.party.length - 1 && S.meters[Bs.atk.k] <= 4 ? { type: 'defend' } : { type: 'press' }; });
      bossResolve(); S.spinUntil = 0; return;
    }
    if (Bs.stage === 'done') { finishGame(); return; }
  }

  window.simRun = function (active) {
    startRun();
    const classes = shuffle(CLASSES.map(c => c.id).filter(id => id !== 'fc')).slice(0, 3);
    S.party = ['fc', ...classes].map((cls, i) => ({ name: 'Sim' + i, cls, perk: pick(CLASS[cls].perks).id, up: '', used: 0, av: i }));
    S.tokenHolder = 0; pickUnit(pick(UNITS).id); S.patch = PATCHES[S.unit][0].id; S.callsign = 'SIM';
    S.map = genMap(); S.mapLocked = true; S.phase = 'map'; S.pos = { tier: -1, idx: null };
    for (let g = 0; g < 400 && S.phase !== 'results'; g++) {
      S.spinUntil = 0; S.notice = null; FX = [];
      if (S.phase === 'map') { useTools(active); const w = wpOptions(); if (w.length) { takeWaypoint(pick(w).key); continue; } const av = available(); chooseNode(...pick(av)); }
      else if (S.phase === 'node') playNode(active);
      else if (S.phase === 'inject') playInject(active);
      else if (S.phase === 'levelup') { S.party.forEach(p => { p.up = pick(CLASS[p.cls].ups).id; }); ACT.confirmLevel(); }
      else if (S.phase === 'boss') { if (playBoss(active) === 'stuck') break; }
    }
    return S.final ? { g: S.final.grade.g, total: S.final.total, parts: Object.fromEntries(S.final.parts.map(p => [p[0].split(' (')[0], p[1]])), hp: S.boss && S.boss.hp } : { g: '?', total: 0, stuck: S.phase };
  };

  window.simBatch = function (n = 200) {
    const keep = { S, saveToBoard: window.saveToBoard, afterSpin: window.afterSpin, alert: window.alert, prompt: window.prompt, confirm: window.confirm };
    window.alert = () => { }; window.prompt = (m, d) => d; window.confirm = () => true;
    saveToBoard = () => { }; afterSpin = () => { };
    const out = {};
    for (const active of [false, true]) {
      const runs = []; for (let i = 0; i < n; i++) { try { runs.push(simRun(active)); } catch (e) { runs.push({ g: 'ERR', err: String(e && e.stack || e).slice(0, 200) }); } }
      const dist = {}; runs.forEach(r => { dist[r.g] = (dist[r.g] || 0) + 1; });
      const avg = k => Math.round(runs.filter(r => r.parts).reduce((a, r) => a + (r.parts[k] || 0), 0) / runs.filter(r => r.parts).length);
      const keys = runs.find(r => r.parts) ? Object.keys(runs.find(r => r.parts).parts) : [];
      const tot = runs.filter(r => r.parts).map(r => r.total).sort((a, b) => a - b);
      out[active ? 'proactive' : 'passive'] = { grades: dist, median: tot[Math.floor(tot.length / 2)], p10: tot[Math.floor(tot.length * 0.1)], p90: tot[Math.floor(tot.length * 0.9)],
        avgParts: Object.fromEntries(keys.map(k => [k, avg(k)])), bossHpLeft: Math.round(runs.filter(r => r.hp != null).reduce((a, r) => a + r.hp, 0) / runs.filter(r => r.hp != null).length),
        errors: runs.filter(r => r.g === 'ERR' || r.g === '?').slice(0, 3) };
    }
    saveToBoard = keep.saveToBoard; afterSpin = keep.afterSpin; window.alert = keep.alert; window.prompt = keep.prompt; window.confirm = keep.confirm;
    S = keep.S; hist = []; FX = []; push();
    return out;
  };
})();
