/* =====================================================================
   PRACTICUM ADVENTURE - Field Guide (guide.html)
   Built from data.js so it always matches the game. Spoiler-free: no
   missions, hidden traits or trap answers.
   ===================================================================== */
function initGuide() {
  document.body.className = 'guide';
  const sec = (id, title, body) => `<section id="${id}"><h2>${title}</h2>${body}</section>`;
  const nav = [['play', 'How to play'], ['meters', 'Meters & icons'], ['classes', 'Classes'], ['dice', 'Dice'], ['route', 'The route'], ['boss', 'The IG'], ['score', 'Scoring'], ['ach', 'Achievements']];
  $('#app').innerHTML = `
  <header class="g-top"><div class="logo" style="font-size:26px">PRACTICUM ADVENTURE</div><div class="g-sub">FIELD GUIDE · AS300 PRACTICUM</div>
    <nav>${nav.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>
    <a class="g-join" href="join.html">📱 Join a game</a></header>
  <main class="g-main">
  ${sec('play', '🎮 How to play', `<div class="g-steps">${INTRO_STEPS.map(([ic, h, t], i) => `<div class="g-card"><div class="g-ic">${ic}</div><div><b>${i + 1}. ${esc(h)}</b><p>${esc(t)}</p></div></div>`).join('')}</div>
    <p class="g-win">${esc(INTRO_WIN)}</p><p class="g-lose">${esc(INTRO_LOSE)}</p>
    <p>A run takes about 20 minutes: pick classes and pilots → roll your squadron → 6 stops → the Inspector General → results → debrief. Your practicum grade comes from the debrief (reflection, engagement, concepts), not from the game score.</p>`)}
  ${sec('meters', '📊 Meters & icons', `<p>Your team shares four meters, each from 0 to 10. Almost every choice raises some and lowers others. If a meter hits <b>0</b>, a Crisis Event strikes before the next stop.</p>
    <div class="g-legend">${LEGEND.map(([ic, h, t]) => `<div class="g-card"><div class="g-ic">${ic}</div><div><b>${esc(h)}</b><p>${esc(t)}</p></div></div>`).join('')}</div>`)}
  ${sec('classes', '🧙 Classes', `<p>Each cadet picks a different class. <b>Someone must be the Flight Commander.</b> Each class has a specialty meter, 4 stats that add to its dice rolls, an ability (once per run), and two secret perks (you pick one after classes are locked, so choose your class for the class, not the perk). After stop 3 everyone levels up and picks an upgrade.</p>
    <p class="g-small">Stats: <b>CMD</b> command, decisions, accountability · <b>CHA</b> persuade, counsel, motivate · <b>INS</b> read people, spot problems, plan · <b>GRIT</b> endure, execute, stretch resources.</p>
    ${CLASSES.map(c => `<div class="g-class"><h3>${c.icon} ${c.name}</h3><div class="g-small">Rank: <b>${c.rankLong} (${c.rank})</b> · Specialty: ${mt(c.guards)}</div>
      <div class="stats">${STATS.map(s => `<div>${s}<b>+${c.stats[s]}</b></div>`).join('')}</div>
      <p><b>${c.ability ? '⚡ ' + esc(c.ability.name) : '👑 Command'}:</b> ${mt(esc(c.ability ? c.ability.text : c.abilityText))}</p>
      <p><b>🎁 Perks:</b> 2 secret perks, revealed in the game once every class is locked in. Pick one.</p>
      <p><b>Level-up upgrades (pick one):</b></p><ul>${c.ups.map(u => `<li><b>${esc(u.name)}</b>: ${mt(esc(u.text))}</li>`).join('')}</ul></div>`).join('')}`)}
  ${sec('dice', '🎲 Dice & checks', `<ul>
      <li>Risky choices call for a <b>d20 check</b>: d20 + the roller's stat vs a target. <b>Normal 13</b>, <b>Hard 16</b>. Elite stops add +3.</li>
      <li>The team decides <b>who rolls</b>. Use the right person for the job.</li>
      <li>If the meter tied to the check is <b>8 or higher: +2</b>. If it's <b>2 or lower: −2</b>.</li>
      <li><b>Natural 20 = critical:</b> good effects double, plus loot. <b>Natural 1 = fumble.</b></li>
      <li>🎤 choices are acted out instead: the GM plays the NPC and rates you <b>1-3 stars</b>. 3 stars = specific, respectful, sets expectations and listens.</li>
      <li>🔒 choices can only be made by the <b>Command Token</b> holder (👑). The holder can delegate the token, but if a delegated check fails, the Flight Commander still loses ${meterTag('tru')}.</li></ul>`)}
  ${sec('route', '🗺️ The route', `<p>Two paths: <b>6 stops, then the Inspector General.</b> At every stop the team votes on their phones between two options (top or bottom path). After each stop, a d10 inject check decides whether Murphy strikes (1-6 = inject). Injects can be good, bad or weird.</p>
    <div class="g-legend">${['crisis', 'elite', 'rest', 'depot', 'unknown'].map(k => `<div class="g-card"><div class="g-ic">${NODE_TYPES[k].icon}</div><div><b>${NODE_TYPES[k].name}</b><p>${{ crisis: 'A leadership situation with 4 choices.', elite: 'A harder situation: checks +3, good effects doubled, guaranteed loot.', rest: 'Pick one: +2 to a meter, recharge an ability, or +1 loyalty to every NPC.', depot: 'One trade: buy loot, convert a meter into Resources, or buy back a token.', unknown: 'Roll a d6. Anything can happen.' }[k]}</p></div></div>`).join('')}</div>
    <p>Your crew (4 NPCs) each has a public trait and a <b>hidden trait</b>. Ask good questions to find out what's really going on. At loyalty 5 an NPC becomes an <b>Ally</b>; at 0 they hit a <b>Breaking Point</b>.</p>
    <p><b>Loot</b> drops from elite stops, crits, and a d4 roll after each crisis. The team can carry 3 items.</p>`)}
  ${sec('boss', '👹 The Inspector General', `<p><b>${BOSS.name}</b> has ${BOSS.hp} HP. Every phase, the IG attacks your <b>weakest meter</b> (−2), so balanced teams survive.</p><ol>
      <li><b>The Audit:</b> the IG checks your record. Strong meters (5+) deal damage. Any integrity violation found here = Game Over.</li>
      <li><b>The Interview:</b> everyone rolls a d20; the two lowest rolls answer the IG's questions. Each star = 1 damage.</li>
      <li><b>No-Notice Exercise:</b> each cadet picks a different stat and rolls. Pass = 2 damage, natural 20 = 4.</li></ol>`)}
  ${sec('score', '🏆 Scoring', `<ul><li>Meters total ×3</li><li><b>Lowest meter ×10</b> (balance matters most)</li><li>Inspection result: up to +50</li><li>🎤 stars ×5 · achievements ×10 · NPC allies ×5 · unused items and tokens ×5</li></ul>
    <div class="g-legend">${GRADES.map(g => `<div class="g-card"><div class="g-ic" style="color:${g.color};font-family:var(--pixel)">${g.g}</div><div><b>${g.title}</b><p>${g.min > 0 ? g.min + '+ points' : 'below 120'}</p></div></div>`).join('')}</div>
    <p>The <b>top 3 teams</b> on the class leaderboard earn extra credit. Integrity Game Overs aren't eligible.</p>`)}
  ${sec('ach', '🏅 Achievements', `<p>Worth +10 points each. Some are secret.</p><div class="g-legend">${ACHIEVEMENTS.filter(a => !a.hidden).map(a => `<div class="g-card"><div class="g-ic">${a.icon}</div><div><b>${esc(a.name)}</b><p>${esc(a.text)}</p></div></div>`).join('')}
    <div class="g-card"><div class="g-ic">🕵️</div><div><b>??? × ${ACHIEVEMENTS.filter(a => a.hidden).length}</b><p>Hidden achievements. Lead well and you might find them.</p></div></div></div>`)}
  </main>`;
}
