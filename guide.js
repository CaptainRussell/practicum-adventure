/* =====================================================================
   PRACTICUM ADVENTURE - Field Guide (guide.html)
   Built from data.js so it always matches the game. Spoiler-free: no
   missions or trap answers.
   ===================================================================== */
function initGuide() {
  document.body.className = 'guide';
  const sec = (id, title, body) => `<section id="${id}"><h2>${title}</h2>${body}</section>`;
  const nav = [['play', 'How to play'], ['meters', 'Meters & icons'], ['classes', 'Positions'], ['units', 'Squadrons'], ['dice', 'Dice'], ['route', 'The route'], ['boss', 'The IG'], ['score', 'Scoring'], ['ach', 'Achievements']];
  $('#app').innerHTML = `
  <header class="g-top"><div class="logo" style="font-size:26px">PRACTICUM ADVENTURE</div><div class="g-sub">FIELD GUIDE · AS300 PRACTICUM</div>
    <nav>${nav.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>
    <a class="g-join" href="join.html">📱 Join a game</a></header>
  <main class="g-main">
  ${sec('play', '🎮 How to play', `<div class="g-steps">${INTRO_STEPS.map(([ic, h, t], i) => `<div class="g-card"><div class="g-ic">${ic}</div><div><b>${i + 1}. ${esc(h)}</b><p>${esc(t)}</p></div></div>`).join('')}</div>
    <p class="g-win">${esc(INTRO_WIN)}</p><p class="g-lose">${esc(INTRO_LOSE)}</p>
    <p>A run takes about 20 minutes: pick character icons and positions → choose your squadron → 5 to 7 stops → the Inspector General → results → debrief. Your practicum grade comes from the debrief (reflection, engagement, concepts), not from the game score.</p>`)}
  ${sec('meters', '📊 Meters & icons', `<p>Your team shares four meters, each from 0 to 10. Almost every choice raises some and lowers others. If a meter hits <b>0</b>, a Crisis Event strikes as soon as the current event is resolved, and it takes something for good: an Airman, your Flight Commander, your gear. <b>A second Crisis Event = GAME OVER.</b></p>
    <div class="g-legend">${LEGEND.map(([ic, h, t]) => `<div class="g-card"><div class="g-ic">${ic}</div><div><b>${esc(h)}</b><p>${esc(t)}</p></div></div>`).join('')}</div>`)}
  ${sec('classes', '🎖️ Positions', `<p>Each cadet picks a different position. The Flight Commander is optional: without one, the cadet with the best CMD holds the 👑 tie-break. Each position has a specialty meter, 4 stats that add to its dice rolls, an ability, and two perks (you pick one of the two after positions are locked; each is usable once per game). After stop 3 everyone levels up and picks an upgrade.</p>
    <p class="g-small">Stats: <b>CMD</b> command, decisions, accountability · <b>CHA</b> persuade, counsel, motivate · <b>INS</b> read people, spot problems, plan · <b>GRIT</b> endure, execute, stretch resources.</p>
    ${CLASSES.map(c => `<div class="g-class"><h3>${c.icon} ${c.name}</h3><div class="g-small">Rank: <b>${c.rankLong} (${c.rank})</b> · Specialty: ${mt(c.guards)}</div>
      <div class="stats">${STATS.map(s => `<div>${s}<b>+${c.stats[s]}</b></div>`).join('')}</div>
      <p><b>${c.ability ? '⚡ ' + esc(c.ability.name) : '👑 Command'}:</b> ${mt(esc(c.ability ? c.ability.text : c.abilityText))}</p>
      <p><b>🎁 Perks (pick one):</b></p><ul>${c.perks.map(p => `<li>${p.icon} <b>${esc(p.name)}</b>: ${mt(esc(p.text))}</li>`).join('')}</ul>
      <p><b>Level-up upgrades (pick one):</b></p><ul>${c.ups.map(u => `<li><b>${esc(u.name)}</b>: ${mt(esc(u.text))}</li>`).join('')}</ul></div>`).join('')}`)}
  ${sec('units', '🏢 Squadrons', `<p>The team <b>votes for its squadron</b> (the Flight Commander breaks ties). Every squadron starts with different meters and has its own Unit members. The <b>commander</b> has a 👍 perk, a 👎 perk and an <b>intent</b>: a priority meter that is worth +${DIFFICULTY.intent} points at 7+ and −${DIFFICULTY.intent} under 4 at the end. Each squadron also has a <b>tendency</b>: a weak spot that drains one meter by 1 after every ${DIFFICULTY.drainEvery} stops.</p>
    ${UNITS.map((u, i) => `<div class="g-class"><h3>${i + 1}. ${u.icon} ${u.name}</h3><div class="g-small">${u.sq}</div>
      <div class="stats">${METERS.map(m => `<div>${m.icon}<b>${u.start[m.k]}</b></div>`).join('')}</div>
      <p><b>🎯 Intent:</b> ${meterTag(u.cc.intent)} · <b>👍 ${esc(u.cc.pos.name)}:</b> ${mt(esc(u.cc.pos.text))} · <b>👎 ${esc(u.cc.neg.name)}:</b> ${mt(esc(u.cc.neg.text))}</p>
      <p><b>⚠️ Tendency, ${esc(u.drain.name)}:</b> ${esc(u.drain.text)}. ${meterTag(u.drain.k)} −1 every ${DIFFICULTY.drainEvery} stops.</p></div>`).join('')}`)}
  ${sec('dice', '🎲 Dice & checks', `<ul>
      <li>Risky choices call for a <b>d20 check</b>: d20 + the roller's stat vs a target. <b>Normal ${DC_NORMAL}</b>, <b>Hard ${DC_HARD}</b>. Elite stops add +3.</li>
      <li><b>Specialist +1:</b> when the check's meter is your position's specialty (for example the First Sergeant on ❤️).</li>
      <li><b>Who rolls:</b> the team votes on their phones (each cadet's bonus is shown), then the GM locks in the roller. ★ means the number includes the +1 specialist bonus.</li>
      <li>If the meter tied to the check is <b>8 or higher: +2</b>. If it's <b>2 or lower: −2</b>.</li>
      <li><b>Natural 20 = critical:</b> good effects double, plus loot. <b>Natural 1 = fumble.</b></li>
      <li>🔐 choices need someone on the team with that stat at +3 or better.</li>
      <li>🎤 choices are acted out: a wheel picks who talks, the GM plays the other side and rates you <b>1-3 stars</b>. 3 stars = specific, respectful, sets expectations and listens.</li>
      <li>👑 <b>Command Token: Rock, Paper, Rank.</b> When a team vote ties, the Flight Commander decides. That is the token's only power.</li></ul>`)}
  ${sec('route', '🗺️ The route', `<p>The route: <b>5 to 7 stops (the GM sets it), then the Inspector General.</b> Each stop has 1 to 3 options, and the paths branch and merge differently every run. You can only move along the lines, so choosing a path is a commitment. Later stops hold more elites. The team votes on their phones; on a tie, the Flight Commander decides. A cadet pulled into a meeting can't vote on the route. After every ${DIFFICULTY.injectEvery === 1 ? '' : DIFFICULTY.injectEvery === 2 ? 'other ' : DIFFICULTY.injectEvery + 'th '}stop an inject hits: a d6 picks the wheel (${INJECT_ORDER.map(t => `${injectRange(t)} = ${INJECT_WHEELS[t].icon} ${INJECT_WHEELS[t].name}`).join(', ')}), then someone spins it. Most injects let the team <b>vote on how to respond</b>, and every Wheel of Failure inject can be <b>💪 tackled</b> with a stat check instead.</p>
    <div class="g-legend">${['crisis', 'elite', 'spot', 'rest', 'depot', 'unknown'].map(k => `<div class="g-card"><div class="g-ic">${NODE_TYPES[k].icon}</div><div><b>${NODE_TYPES[k].name}</b><p>${{ crisis: 'A leadership situation with 4 choices.', elite: 'A harder situation: checks +3, good effects doubled, guaranteed loot.', spot: 'A wheel picks a cadet who has not been in the spotlight yet. They decide alone, using their own stats. Everyone else stays silent.', rest: `Pick one: +${DIFFICULTY.restMain} to a meter and +${DIFFICULTY.restOthers} to the rest, recharge an ability, or +1 loyalty to the whole Unit.`, depot: 'One purchase: pizza for the flight, coffee for the Group CC, study guides, a DEOCS Survey, a favor, the Saturday detail, or overtime. Read the fine print.', unknown: 'Nothing is decided until you arrive: roll a d6. Anything can happen.' }[k]}</p></div></div>`).join('')}</div>
    <p>Your Unit has 4 members. Everyone's <b>trait</b> is on the org chart (ORG tab on your phone), so lead to it. At loyalty 5 a member becomes an <b>Ally</b>; at 0 they hit a <b>Breaking Point</b>.</p>
    <p><b>Loot</b> drops from elite stops, crits, and a d4 roll after each scenario (3 or 4 = loot). The team can carry 3 items.</p>`)}
  ${sec('boss', '👹 The Inspector General', `<p><b>${BOSS.name}</b> has ${BOSS.hp} HP. If your ⭐ is 7+, your commander vouches for you (−${DIFFICULTY.vouch} HP); at 3 or less they throw you under the bus (+${DIFFICULTY.vouch}). Broken Unit members testify against you (+${DIFFICULTY.witnessHp} HP each).</p><ol>
      <li><b>The Audit:</b> any integrity violation = Game Over. Strong meters (5+) deal damage.</li>
      <li><b>Three rounds</b> (${BOSS_ROUNDS.map(r => r.name).join(', ')}). Each round the IG telegraphs an attack on a meter (−${DIFFICULTY.bossAttack}). Every cadet picks ONE action on their phone:
        <ul><li>🗡️ <b>Press</b>: d20 + your best stat vs ${DIFFICULTY.examDC}. Hit = 2 damage, natural 20 = 4.</li>
        <li>🛡️ <b>Defend</b>: block 2 of the IG's attack.</li></ul></li>
      <li>Every <b>Ally</b> (loyalty 5) vouches for you when the IG arrives: 2 damage each.</li>
      <li>Round 2 starts with the <b>Interview</b>: the two lowest d20 rolls answer the IG's questions; each star is 1 damage.</li>
      <li>If a meter hits 0 during the fight it's an <b>Adverse Finding</b>: the IG heals ${DIFFICULTY.adverseHeal} and every roll is −1 for the rest of the fight. It counts as a Crisis Event: if you already had one, it's GAME OVER.</li></ol>
    <p>Perks work in the fight too.</p>`)}
  ${sec('score', '🏆 Scoring', `<ul><li>Meters total ×3</li><li><b>Lowest meter ×10</b> (balance matters most)</li><li>Commander's intent: +${DIFFICULTY.intent} at 7+, −${DIFFICULTY.intent} under 4</li><li>Inspection result: +60 (IG at 0 HP), +35, +10, or −15 if the IG still has more than 10 HP</li><li>🎤 stars ×5 · Unit Allies ×10 · achievements by difficulty: ${ACHIEVEMENTS.filter(a => a.pts).map(a => `${a.icon} ${a.pts}`).join(' · ')} (a lucky natural 20 earns no points)</li><li><b>Unused items and perks score nothing:</b> use your tools.</li><li>Grades: S ${GRADES[0].min}+ · A ${GRADES[1].min}+ · B ${GRADES[2].min}+ · C ${GRADES[3].min}+</li></ul>
    <div class="g-legend">${GRADES.map(g => `<div class="g-card"><div class="g-ic" style="color:${g.color};font-family:var(--pixel)">${g.g}</div><div><b>${g.title}</b><p>${g.min > 0 ? g.min + '+ points' : 'below 120'}</p></div></div>`).join('')}</div>
    <p>The <b>top 3 teams</b> on the class leaderboard earn extra credit. Integrity Game Overs aren't eligible.</p>`)}
  ${sec('ach', '🏅 Achievements', `<p>Worth +10 points each. Some are secret.</p><div class="g-legend">${ACHIEVEMENTS.filter(a => !a.hidden).map(a => `<div class="g-card"><div class="g-ic">${a.icon}</div><div><b>${esc(a.name)}</b><p>${esc(a.text)}</p></div></div>`).join('')}
    <div class="g-card"><div class="g-ic">🕵️</div><div><b>??? × ${ACHIEVEMENTS.filter(a => a.hidden).length}</b><p>Hidden achievements. Lead well and you might find them.</p></div></div></div>`)}
  </main>`;
}
