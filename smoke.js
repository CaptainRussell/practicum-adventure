// Run with `node smoke.js` to check the route handoff, phone controls, and a full game.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const memory = new Map();
let randomState = 0x34103410;
const gameMath = Object.create(Math);
gameMath.random = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
};
const context = {
  console, Math: gameMath, Date,
  location: { hash: '', protocol: 'http:', href: 'http://localhost/index.html' },
  localStorage: {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key),
  },
  window: { addEventListener() {} },
  document: { createElement: () => ({ getContext: () => ({ fillRect() {} }), toDataURL: () => 'data:' }) },
  Image: class {},
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  alert() {}, prompt: (_message, initial) => initial, confirm: () => true,
};
vm.createContext(context);
for (const file of ['data.js', 'app.js', 'net.js', 'phone.js', 'player.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
vm.runInContext('renderGM = () => {};', context);

const opening = vm.runInContext(`
  (() => {
  S = newState();
  P.join = { url: 'http://localhost/join.html?room=TEST', code: 'TEST', live: true };
  _qr[P.join.url] = 'data:image/png;base64,test';
  const first = renderMain(S);
  S.party[0].name = 'Able'; S.clients = { client: { name: 'Able', slot: 0 } };
  startRun(); ACT.startBriefing();
  const phase = S.phase, second = renderMain(S), retainedSeat = S.clients.client.slot === 0;
  ACT.beginBriefing();
  const nextPhase = S.phase, duplicateStart = ACT.beginBriefing();
  return { first, second, phase, nextPhase, retainedSeat, duplicateStart };
  })();
`, context);
assert.match(opening.first, /class="jqr"/);
assert.ok(!opening.first.includes('CLICK TO START'), 'the first QR screen has no start overlay');
assert.match(opening.second, /CLICK TO START/);
assert.equal(opening.phase, 'welcome');
assert.equal(opening.nextPhase, 'intro');
assert.ok(opening.retainedSeat, 'cadets who joined on the first QR screen retain their seats');
assert.equal(opening.duplicateStart, false, 'duplicate start messages cannot advance the briefing twice');

const result = vm.runInContext(`
  S = newState();
  S.party = [
    { name: 'Able', cls: 'shirt', perk: 'resiliency', up: '', used: 0, av: null },
    { name: 'Baker', cls: 'fc', perk: 'hold', up: '', used: 0, av: null },
  ];
  pickUnit('wk');
  S.phase = 'mapRoll';
  S.mapSeed = 1234; S.map = genMap(S.mapSeed);
  S.pos = { tier: -1, idx: null };
  const rolling = phGame(publicView(0), publicView(0).party[0]);
  S.phase = 'map'; S.mapLocked = true;
  const view = publicView(0);
  const route = phGame(view, view.party[0]);
  const projector = renderMap(S);
  const availableBefore = usableNow(S).some(u => u.req === 'perk:resiliency' && u.who === 0);
  S.requests = [{ slot: 0, kind: 'perk:resiliency', text: 'request' }];
  usePerk(0);
  const used = S.flags.perkUsed_resiliency;
  const availableAfter = usableNow(S).some(u => u.req === 'perk:resiliency' && u.who === 0);
  S.clients = { client: { name: 'Able', slot: 0 } };
  NET.conns.client = { open: true, send() {} };
  onClient(NET.conns.client, { cid: 'client', t: 'req', v: 'perk:resiliency' });
  const usedKit = phKit(publicView(0), publicView(0).party[0]);
  ({ rolling, route, projector, count: view.avail.length, availableBefore, used,
     availableAfter, requests: S.requests.length, usedKit });
`, context);
assert.match(result.rolling, /GENERATING YOUR ROUTE/);
assert.ok(result.count > 0 && result.route.includes('data-a="0,'), 'first route vote appears on the phone');
assert.match(result.projector, /FINAL ROUTE SEED/);
assert.ok(result.availableBefore && result.used && !result.availableAfter, 'used perk is unavailable');
assert.equal(result.requests, 0, 'used perk request clears');
assert.match(result.usedKit, /USED/);

const briefing = vm.runInContext(`
  S.phase = 'intro'; S.introPage = 2;
  const integrity = renderIntro(S);
  ACT.introNext(); const loyalty = renderIntro(S);
  ACT.introNext(); const meters = renderIntro(S);
  ACT.introNext();
  ({ integrity, loyalty, meters, lastPage: S.introPage, gm: gmIntro() });
`, context);
assert.match(briefing.integrity, /JOB 1 · INTEGRITY FIRST/);
assert.match(briefing.loyalty, /JOB 2 · LOYALTY &amp; UNIT COHESION/);
assert.match(briefing.loyalty, /alt="Example Unit member portrait"/);
assert.equal((briefing.loyalty.match(/<i class="on">/g) || []).length, 3);
assert.match(briefing.loyalty, /LOYALTY: 3 \/ 5/);
assert.match(briefing.meters, /JOB 3/);
for (const band of ['STRONG · 7–10', 'STEADY · 3–6', 'DANGER · 0–2']) assert.ok(briefing.meters.includes(band));
assert.equal(briefing.lastPage, 4, 'briefing ends on the meter page');
assert.match(briefing.gm, /Go to position select/);
const setupOrder = vm.runInContext(`
  S.phase = 'intro'; S.introPage = 0;
  ACT.introNext(); const iconPhase = S.phase;
  S.party.forEach((p, i) => { p.av = i; });
  ACT.avDone(); const overview = S.phase === 'intro' && S.introPage === 1;
  S.introPage = INTRO_PAGE_COUNT - 1; ACT.toParty(); const positions = S.phase;
  S.party[0].av = null; ACT.toParty(); const lateIconPhase = S.phase;
  S.party[0].av = 0; ACT.avDone();
  ({ iconPhase, overview, positions, lateIconPhase, latePositions: S.phase });
`, context);
assert.equal(setupOrder.iconPhase, 'avatars');
assert.ok(setupOrder.overview, 'icon selection returns to the job overview');
assert.equal(setupOrder.positions, 'party', 'position selection follows the briefing');
assert.equal(setupOrder.lateIconPhase, 'avatars', 'late joiners can still choose icons');
assert.equal(setupOrder.latePositions, 'party', 'late icon selection returns to positions');

let mapTick;
context.setInterval = callback => { mapTick = callback; return 1; };
vm.runInContext(`renderGM = () => {}; S.phase = 'manifest'; beginMapGeneration();`, context);
for (let i = 0; i < 13; i++) mapTick();
const rolled = vm.runInContext(`({ phase: S.phase, firstStopCount: publicView(0).avail.length,
  phone: phGame(publicView(0), publicView(0).party[0]) })`, context);
assert.equal(rolled.phase, 'map');
assert.ok(rolled.firstStopCount > 0 && rolled.phone.includes('data-p="vote"'), 'rolled map opens first vote');
const acceptedVote = vm.runInContext(`const first = publicView(0).avail[0];
  onClient(NET.conns.client, { cid: 'client', t: 'vote', v: first });
  S.votes[0] === first`, context);
assert.ok(acceptedVote, 'GM receives the first-stop vote');

const squadron = vm.runInContext(`
  S = newState();
  S.party = [{ name: 'Able', cls: 'shirt', perk: 'resiliency', up: '', used: 0, av: null }];
  prepareFssPreview(); pickUnit('ch');
  S.phase = 'node'; S.cur = { type: 'depot', step: 'who', trade: 'favor' };
  const deployedDisabled = stopOptions().find(o => o.key === 'who:D').dis;
  S = newState(); S.party = [{ name: 'Able', cls: 'shirt', perk: 'resiliency', up: '', used: 0, av: null }];
  pickUnit('sr'); S.map = genMap(1234); S.pos = { tier: S.map.tiers.length - 1, idx: 0 };
  S.phase = 'node'; S.cur = { type: 'rest', step: 'choose' };
  const choice = restOptions().find(o => o.key === 'mis').label;
  const before = S.meters.mis; ACT.restMeter('mis');
  ({ deployedDisabled, choice, gained: S.meters.mis - before });
`, context);
assert.ok(squadron.deployedDisabled, 'deployed member cannot take a BX task');
assert.match(squadron.choice, /\+1 🎯/);
assert.equal(squadron.gained, 1, 'Time Crunch halves the chosen meter gain');

const scenario = code => JSON.parse(JSON.stringify(vm.runInContext(`
  S = newState(); hist = []; FX = [];
  S.party = [
    { name: 'Able', cls: 'chief', perk: 'pcs', up: '', used: 0, av: null },
    { name: 'Baker', cls: 'shirt', perk: 'rally', up: '', used: 0, av: null },
  ];
  pickUnit('wk'); S.notice = null; S.noticeQ = []; S.phase = 'node';
  (() => { ${code} })();
`, context)));

assert.deepEqual(scenario(`
  S.cur = { type: 'depot', step: 'choose' }; S.meters.res = 0;
  const paidDisabled = depotOptions().find(o => o.key === 'pizza').dis;
  S.party[0].cls = 'plans'; S.party[0].perk = 'prepo';
  const free = depotOptions().find(o => o.key === 'pizza');
  ACT.depotPick('pizza');
  return { paidDisabled, freeEnabled: !free.dis && free.label.includes('FREE'), resources: S.meters.res, done: S.cur.step };
`), { paidDisabled: true, freeEnabled: true, resources: 0, done: 'done' }, 'BX affordability and free purchase');

assert.deepEqual(scenario(`
  startBoss(); S.boss.stage = 'hotseat'; bossHotSeat(); save();
  const rolls = JSON.stringify(S.boss.p2.rolls);
  S = newState(); ACT.resume();
  const ready = S.gmNext.ready && S.spinUntil === 0;
  ACT.gmNext();
  return { ready, selected: S.boss.p2.who.length === 1, sameRolls: JSON.stringify(S.boss.p2.rolls) === rolls, held: !!S.gmNext };
`), { ready: true, selected: true, sameRolls: true, held: false }, 'resume recovers the held hot-seat result without rerolling');

scenario(`S.phase = 'mapRoll'; save(); S = newState(); ACT.resume(); return S.phase;`);
for (let i = 0; i < 13; i++) mapTick();
assert.equal(vm.runInContext('S.phase', context), 'map', 'resume restarts interrupted map generation');

assert.deepEqual(scenario(`
  npc('B').gone = true; enterNode('spot');
  const consistent = S.cur.slot === S.spotlit[S.spotlit.length - 1];
  const choice = curMission().choices.findIndex(ch => !ch.trap && !ch.req);
  choose(choice);
  return { consistent, fallback: !!S.cur.mid, stars: S.cur.step === 'stars' };
`), { consistent: true, fallback: true, stars: true }, 'spotlight fallback remains playable after a member departs');

assert.deepEqual(scenario(`
  S.meters = { mis: 10, mor: 10, tru: 10, res: 10 }; startBoss();
  S.boss.stage = 'act'; S.boss.round = 1; S.boss.atk = { k: 'mis', n: 4, name: 'Test' };
  S.boss.votes = { 0: 'press', 1: 'press' };
  ACT.bossAction('defend'); bossResolve();
  return { action: S.boss.teamAction, damage: S.boss.attackDamage };
`), { action: 'defend', damage: 2 }, 'GM boss action overrides opposing phone votes');

assert.deepEqual(scenario(`
  S.phase = 'inject'; S.inject = { stage: 'murphy', filter: 'mixed' };
  S.actor = { kind: 'murphy', slot: 0, label: 'Spin' };
  S.gmNext = { steps: [6200], ready: true };
  S.clients = { client: { name: 'Able', slot: 0 } }; NET.conns.client = { open: true, send() {} };
  onClient(NET.conns.client, { cid: 'client', t: 'act', v: 'murphy' });
  const blocked = S.inject.stage === 'murphy' && S.gmNext.steps.length === 1;
  const hidden = publicView(0).actor === null && publicView(0).spinning;
  ACT.gmNext();
  onClient(NET.conns.client, { cid: 'client', t: 'act', v: 'murphy' });
  return { blocked, hidden, resumed: S.inject.stage === 'result' };
`), { blocked: true, hidden: true, resumed: true }, 'phone progression waits for the GM result dismissal');

assert.deepEqual(scenario(`
  crisisLoss('tru');
  return { fired: S.party.map(p => !!p.fired), crown: crownIdx(S) };
`), { fired: [true, false], crown: -1 }, 'Trust crisis relieves the senior lead without granting tie authority');

assert.deepEqual(scenario(`
  S.cur = { type: 'spot', sid: SPOTLIGHTS[0].id, slot: 0, step: 'stars', spec: { stars: [{}, {}, { mis: 1 }] } };
  S.items = ['helpdesk']; S.pending.star = 'helpdesk'; rateStars(2, 0);
  return { stars: S.cur.stars, loot: S.cur.lootEarned, itemConsumed: S.items.length === 0, actor: S.actor.kind };
`), { stars: 3, loot: true, itemConsumed: true, actor: 'loot' }, 'boosted three-star spotlight earns loot');

assert.deepEqual(scenario(`
  S.traitDone.A = true; const replacement = pcsReplace(npc('A'));
  const fresh = !S.traitDone.A; S.meters.mis = 5;
  traitReward(replacement, 'New member reward', { mis: 1 });
  traitReward(replacement, 'Must not repeat', { mis: 1 });
  return { fresh, mission: S.meters.mis, spent: S.traitDone.A };
`), { fresh: true, mission: 6, spent: true }, 'replacement receives their own one-time trait reward');

assert.deepEqual(scenario(`
  const m = MISSIONS.find(m => m.choices.some(ch => ch.kind === 'fx' && !ch.ifClass && ch.eff?.mis > 0));
  const index = m.choices.findIndex(ch => ch.kind === 'fx' && !ch.ifClass && ch.eff?.mis > 0);
  S.cur = { type: 'elite', mid: m.id, step: 'brief' };
  const shown = choiceShow(m.choices[index]).find(([key]) => key === 'mis')[1];
  const preview = encounterChoice(S, m.choices[index]); choose(index);
  const matched = JSON.stringify(preview.check) === JSON.stringify(S.cur.spec.check);
  S.gmNext = null; S.cur = { type: 'spot', mid: m.id, slot: 0, step: 'brief' };
  const stars = choiceShow(m.choices[index]).find(([key]) => key === 'mis')[1];
  return { shown, matched, stars, checkLabel: choiceCheckLabel(S, m.choices[index]) };
`), { shown: '?', matched: true, stars: '?', checkLabel: '' }, 'elite and acting previews match the executed outcomes');

vm.runInContext(fs.readFileSync('sim.js', 'utf8'), context, { filename: 'sim.js' });
for (let i = 0; i < 36; i++) {
  vm.runInContext(`S.stops = ${5 + Math.floor(i / 12)};`, context);
  const run = context.window.simRun(i % 2 === 0);
  assert.ok(run.g !== '?' && run.g !== 'ERR', `full game ${i + 1} stalled: ${JSON.stringify(run)}`);
}

vm.runInContext(fs.readFileSync('cloud.js', 'utf8'), context, { filename: 'cloud.js' });
context.location.hostname = 'example.com';
context.location.search = '';
const date = '2026-10-17T00:00:00.000Z';
const run = { date, callsign: 'TEST', unit: '4TH AMXS', grade: 'A', score: 99 };
const remoteFields = vm.runInContext(`toFields({ date: '${date}', callsign: 'TEST', unit: '4TH AMXS', grade: 'B', score: 50 })`, context);
let uploadedScore = null;
context.fetch = async (_url, options) => {
  if (options && options.method === 'PATCH') {
    uploadedScore = Number(JSON.parse(options.body).fields.score.integerValue);
    return { ok: true };
  }
  return { ok: true, json: async () => ({ documents: [{ fields: remoteFields }] }) };
};
vm.runInContext(`saveBoard(${JSON.stringify([run])}); setCloudPending(['${date}']); setCloudSeen(['${date}']);`, context);
vm.runInContext('cloudSync()', context).then(async () => {
  assert.equal(uploadedScore, 99, 'edited leaderboard run replaces its cloud copy');
  assert.equal(vm.runInContext('cloudPending().length', context), 0);

  let releaseUpload, uploadStarted;
  const gate = new Promise(resolve => { releaseUpload = resolve; });
  const started = new Promise(resolve => { uploadStarted = resolve; });
  const remote = new Map(), scoresSent = [];
  let delayFirst = true;
  context.fetch = async (_url, options) => {
    if (!options) return { ok: true, json: async () => ({ documents: [...remote.values()].map(fields => ({ fields })) }) };
    const fields = JSON.parse(options.body).fields;
    scoresSent.push(Number(fields.score.integerValue));
    if (delayFirst) { delayFirst = false; uploadStarted(); await gate; }
    remote.set(fields.date.stringValue, fields);
    return { ok: true };
  };
  const newerDate = '2026-10-17T00:01:00.000Z';
  vm.runInContext(`saveBoard([${JSON.stringify({ ...run, score: 50 })}]); setCloudPending(['${date}']);`, context);
  const syncing = vm.runInContext('cloudSync()', context);
  await started;
  vm.runInContext(`saveBoard(${JSON.stringify([run, { ...run, date: newerDate, score: 77 }])}); cloudQueue('${date}'); cloudQueue('${newerDate}');`, context);
  releaseUpload();
  await syncing;
  assert.equal(vm.runInContext('loadBoard()[0].score', context), 99, 'edit during upload remains in the local board');
  assert.equal(Number(remote.get(date).score.integerValue), 99, 'edit during upload reaches the cloud');
  assert.equal(Number(remote.get(newerDate).score.integerValue), 77, 'new run queued during upload reaches the cloud');
  assert.deepEqual(scoresSent, [50, 99, 77], 'only the uploaded versions are acknowledged');
  assert.equal(vm.runInContext('cloudPending().length', context), 0);
  console.log('Smoke checks passed: all ten review regressions, route handoff, perk use, 36 full games across 5/6/7 stops, and concurrent leaderboard saves.');
}).catch(error => { console.error(error); process.exitCode = 1; });
