/* =====================================================================
   PRACTICUM ADVENTURE - balance simulator (not loaded by the game)
   Run safely without a live GM session: node tools/run-balance.cjs 3000
   Uses the actual game engine in an isolated VM; see BALANCE-REVIEW.md.
   Passive  = random legal choices, never uses items / perks / abilities.
   Proactive = picks the best roller, uses items, perks and abilities when they help,
               rests on the lowest meter, chooses Attack or Defend against the IG.
   Informed = proactive plus weighted scenario choices using exact effect values.
   All policies avoid explicit integrity traps and use the same roleplay distribution.
   ===================================================================== */
(function () {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let starOdds = [.2, .5, .3];
  const starRoll = () => { const r = Math.random(); return r < starOdds[0] ? 1 : r < starOdds[0] + starOdds[1] ? 2 : 3; };
  const lowest = () => METERS.slice().sort((a, b) => S.meters[a.k] - S.meters[b.k])[0].k;
  // Informed policy is an optimistic benchmark: it knows exact effect values.
  // It never looks ahead at a random roll or at future inject/scenario draws.
  function valueEff(e = {}) {
    let value = 0;
    METERS.forEach(({ k }) => {
      const current = S.meters[k], delta = Math.max(-current, Math.min(10-current, e[k] || 0));
      value += delta * (current <= 2 ? 5 : current <= 4 ? 3 : 1);
      if (delta < 0 && current + delta <= 0) value -= 25;
    });
    Object.entries(e.loy || {}).forEach(([slot, n]) => {
      const member = npc(slot); if (!member || member.gone) return;
      value += Math.max(-member.loy, Math.min(5-member.loy, n)) * 2;
      if (n > 0 && member.loy < 5 && member.loy + n >= 5) value += 5;
    });
    if (e.ach && !S.ach.includes(e.ach)) value += (ACH[e.ach]?.pts || 0) / 5;
    return value;
  }
  function choiceValue(choice) {
    const c = encounterChoice(S, choice);
    let v = valueEff(c.pre);
    if (c.kind === 'fx') return v + valueEff(c.eff);
    if (c.kind === 'stars') return v + .2*valueEff(c.stars[0]) + .5*valueEff(c.stars[1]) + .3*valueEff(c.stars[2]);
    const check = c.check, i = bestRoller(check.stat, check.m);
    const bonus = check.stat === 'LOYB' ? npc('B').loy : rollBonus(i, check.stat, check.m) + leanBonus(S);
    const chance = Math.max(.05, Math.min(.95, (21 - (check.dc + DIFFICULTY.dcPlus - bonus)) / 20));
    return v + chance*valueEff(check.pass) + (1-chance)*valueEff(check.fail);
  }

  function useTools(active) {
    if (!active) return;
    // abilities and perks the game itself flags as useful right now
    for (const u of usableNow(S)) {
      if (u.req === 'ability' && u.who != null && (u.hot || Math.random() < 0.5)) try { useAbility(u.who); S.notice = null; } catch (e) { }
      else if (u.req.startsWith('perk:') && u.who != null && (u.hot || Math.random() < 0.4)) try { usePerk(u.who); S.notice = null; } catch (e) { }
      else if (u.req.startsWith('item:')) {
        const k = S.items.indexOf(u.req.slice(5)), item = LOOT.find(l => l.id === u.req.slice(5));
        const helpful = item && (item.use.type === 'meter' && valueEff(item.use.eff) >= 2 || item.use.type === 'anyMeter' && S.meters[lowest()] <= 7 || ['loyAll','loyOne'].includes(item.use.type));
        if (k >= 0 && (u.hot || helpful)) useItem(k);
      }
    }
  }
  function doActor() {
    let g = 0;
    while (S.actor && g++ < 10) { const k = S.actor.kind; S.actor && (S.lastActor = S.actor.slot); ACTOR_RUN[k](); S.spinUntil = 0; }
  }

  function playNode(active) {
    const c = S.cur;
    if ((c.type === 'rest' || c.type === 'depot') && c.step !== 'choose') { doActor(); if (S.phase === 'itemAward') return; afterNode(); return; }
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
      const ok = m.choices.map((ch, i) => i).filter(i => !m.choices[i].trap);
      useTools(active);
      if (S.cur !== c || S.cur.step !== 'brief') return;
      const options = ok.length ? ok : [0];
      choose(active === 'informed' ? options.sort((a,b) => choiceValue(m.choices[b])-choiceValue(m.choices[a]))[0] : pick(options));
      return;
    }
    if (c.step === 'roll') {
      if (active) useTools(active);
      if (!c.rollerLocked) { c.roller = active ? bestRoller(c.spec.check.stat, c.spec.check.m) : pick(S.party.map((_, i) => i).filter(i => !isOut(S, i))); c.rollerLocked = true; }
      resolveRoll(c.roller, {}); S.spinUntil = 0; return;
    }
    if (c.step === 'stars') { if (c.lead == null) { doActor(); } useTools(active); rateStars(starRoll(), S.cur.lead ?? 0); S.spinUntil = 0; return; }
    if (c.step === 'done') {
      doActor();
      if (S.phase === 'itemAward') return;
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
        if (k >= 0 && effSum(MURPHY[inj.idx].options ? {} : {}) <= 0) { useItem(k); return; }
      }
      closeInject(); S.spinUntil = 0; return;
    }
  }

  function playBoss(active) {
    const Bs = S.boss;
    if (Bs.stage === 'opening') { bossNext(); return; }
    if (Bs.stage === 'vouch') { bossVouchNext(); return; }
    if (['intro', 'auditResult', 'intent', 'interviewResult', 'playerResult', 'enemy', 'resolved'].includes(Bs.stage)) { useTools(active); if (bossNext() === false) return 'stuck'; return; }
    if (Bs.stage === 'hotseat') {
      if (!Bs.p2.who) {
        S.party.forEach((p, i) => { if (!p.fired) { bossHotSeat(i); acknowledgeDice(Bs.p2.rollIds[i]); } });
        return;
      }
      Bs.p2.stars = [starRoll()]; useTools(active); bossStarsDone(); return;
    }
    if (Bs.stage === 'act') {
      useTools(active);
      const attack = bossAttackPreview(S), lethal = Bs.hp <= 2;
      const action = active && !lethal && S.meters[Bs.atk.k] <= Bs.atk.n && attack?.chance < 70 ? 'defend' : 'press';
      S.party.forEach((_, i) => { if (!isOut(S, i)) Bs.votes[i] = action; });
      bossResolve(); S.spinUntil = 0; return;
    }
    if (Bs.stage === 'done') { finishGame(); return; }
  }

  window.simRun = function (active, options = {}) {
    startRun();
    if ([5,6,7].includes(options.stops)) S.stops = options.stops;
    const classes = shuffle(CLASSES.map(c => c.id)).slice(0, 4); // the Flight Commander is optional
    S.party = classes.map((cls, i) => ({ name: 'Sim' + i, cls, perk: pick(CLASS[cls].perks).id, up: '', used: 0, av: i }));
    S.tokenHolder = 0; S.crown = fcIdx() >= 0 ? null : nextInChain(S); pickUnit(pick(UNITS).id); S.patch = PATCHES[S.unit][0].id; S.callsign = 'SIM';
    S.items.push('deocs'); // Every team receives this item with its patch.
    S.map = genMap(); S.mapLocked = true; S.phase = 'map'; S.pos = { tier: -1, idx: null };
    for (let g = 0; g < 400 && S.phase !== 'results'; g++) {
      S.spinUntil = 0; S.notice = null; S.noticeQ = []; FX = [];
      if (S.gmNext) {
        const q = S.gmNext;
        // The headless projector completes the current animation, then follows
        // the same automatic attack -> IG response transition as the live game.
        if (q.after === 'bossResponse') finishBossTeamAction(q);
        else { q.ready = true; ACT.gmNext(); }
        continue;
      }
      if (S.phase === 'itemAward') { ACT.itemAwardOk(); continue; }
      if (S.phase === 'map') { useTools(active); const w = wpOptions(); if (w.length) { takeWaypoint(pick(w).key); continue; } if (S.bossReady) { startBoss(); continue; } const av = available(); chooseNode(...pick(av)); }
      else if (S.phase === 'node') playNode(active);
      else if (S.phase === 'inject') playInject(active);
      else if (S.phase === 'levelup') { S.party.forEach(p => { p.up = pick(CLASS[p.cls].ups).id; }); ACT.confirmLevel(); }
      else if (S.phase === 'boss') { if (playBoss(active) === 'stuck') break; }
    }
    return S.final ? { g: S.final.grade.g, total: S.final.total, unit: S.unit, gameOver: S.gameOver, reasons: S.gameOverReasons, phase: S.boss?.defeatedPhase, parts: Object.fromEntries(S.final.parts), hp: S.boss?.hp, meters: { ...S.meters }, stars: S.starsTotal || 0 } : { g: '?', total: 0, stuck: S.phase, step: S.cur?.step, bossStage: S.boss?.stage };
  };

  window.simBatch = function (n = 200, options = {}) {
    starOdds = options.stars || [.2,.5,.3];
    const keep = { S, saveToBoard: window.saveToBoard, afterSpin: window.afterSpin, alert: window.alert, prompt: window.prompt, confirm: window.confirm };
    window.alert = () => { }; window.prompt = (m, d) => /which meter/.test(m) ? lowest() : d; window.confirm = () => true;
    saveToBoard = () => { }; afterSpin = () => { };
    const out = {};
    for (const active of [false, true, 'informed']) {
      const runs = []; for (let i = 0; i < n; i++) { try { runs.push(simRun(active)); } catch (e) { runs.push({ g: 'ERR', err: String(e && e.stack || e).slice(0, 200) }); } }
      const dist = {}; runs.forEach(r => { dist[r.g] = (dist[r.g] || 0) + 1; });
      const avg = k => Math.round(runs.filter(r => r.parts).reduce((a, r) => a + (r.parts[k] || 0), 0) / runs.filter(r => r.parts).length);
      const keys = runs.find(r => r.parts) ? Object.keys(runs.find(r => r.parts).parts) : [];
      const tot = runs.filter(r => r.parts).map(r => r.total).sort((a, b) => a - b);
      out[active === 'informed' ? 'informed' : active ? 'proactive' : 'passive'] = { grades: dist, median: tot[Math.floor(tot.length / 2)], p10: tot[Math.floor(tot.length * 0.1)], p90: tot[Math.floor(tot.length * 0.9)],
        p95: tot[Math.floor(tot.length * .95)], p99: tot[Math.floor(tot.length * .99)],
        victories: runs.filter(r => r.phase).length,
        victoryPhases: Object.fromEntries([3,4,5,6].map(p => [p, runs.filter(r => r.phase === p).length])),
        thresholds: Object.fromEntries([310,350,375,400,425,450,475,500,525,550,575,600].map(t => [t, runs.filter(r => !r.gameOver && r.parts && r.total >= t).length])),
        runs,
        avgParts: Object.fromEntries([...new Set(runs.flatMap(r => Object.keys(r.parts || {})))].map(k => [k, avg(k)])), bossHpLeft: Math.round(runs.filter(r => r.hp != null).reduce((a, r) => a + r.hp, 0) / runs.filter(r => r.hp != null).length),
        errors: runs.filter(r => r.g === 'ERR' || r.g === '?').slice(0, 3) };
    }
    saveToBoard = keep.saveToBoard; afterSpin = keep.afterSpin; window.alert = keep.alert; window.prompt = keep.prompt; window.confirm = keep.confirm;
    S = keep.S; hist = []; FX = []; push();
    return out;
  };
})();
