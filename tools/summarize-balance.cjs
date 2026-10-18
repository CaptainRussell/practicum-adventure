const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const load = name => JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const normal = [load('balance-results.json'),load('balance-validation.json')];
const strong = load('balance-strong-roleplay.json');
const policies = ['passive','proactive','informed'];
const pool = p => normal.flatMap(r => r.results[p].runs);
const pct = (runs, fn) => (100*runs.filter(fn).length/runs.length).toFixed(2)+'%';
const tiers = ['S','A','B','C','D','F'];
const grade = r => r.gameOver ? 'F' : r.total >= 450 ? 'S' : r.total >= 340 ? 'A' : r.total >= 245 ? 'B' : r.total >= 190 ? 'C' : 'D';
let md = '# Balance simulation — October 18, 2026\n\n';
md += '21,000 complete simulated games: 6,000 per policy across two independent seeded batches, plus 1,000 per policy with stronger roleplay. All use the current game engine in an isolated VM. No real saves, rooms or leaderboard entries are touched.\n\n';
md += '## Assumptions\n\n- Four random distinct positions, random perks and upgrades, random squadron and route choices. Every team gets its DEOCS item.\n- Passive: random non-trap responses; no items or active perks; random eligible roller.\n- Proactive: random non-trap scenario responses, best roller, useful items/perks, low-meter rest, survival-aware Attack/Defend.\n- Informed: proactive plus weighted expected-value scenario choices using exact hidden effect values. This is an optimistic information model, not an optimal strategy. It cannot predict random rolls or future events.\n- Ordinary roleplay: 20% one star, 50% two stars, 30% three stars. Strong-roleplay sensitivity: 5%, 35%, 60%. Items can raise these ratings using the real engine.\n- Integrity traps are deliberately avoided. F still includes crisis failures and consequences. Random route/build selection does not model coordinated expert builds. These are balance estimates, not measured student success rates.\n\n';
md += '## Previous grade distribution (S 310, A 265, B 200, C 140)\n\n| Policy | '+tiers.join(' | ')+' | Errors/stalls |\n|---|'+tiers.map(()=>'---:').join('|')+'|---:|\n';
for(const p of policies){const a=pool(p);md+='| '+p+' | '+tiers.map(g=>pct(a,r=>r.g===g)).join(' | ')+' | '+a.filter(r=>r.g==='ERR'||r.g==='?').length+' |\n';}
md += '\n## Applied calibration (S 450, A 340, B 245, C 190)\n\nExisting scores regraded; no game outcomes or point awards changed. Targets for strong informed play: approximately 10% S, 20% A, 35% B, 25% C, remaining completed games D. Game-over runs are always F. Integer score ties prevent exact percentages.\n\n| Policy | '+tiers.join(' | ')+' |\n|---|'+tiers.map(()=>'---:').join('|')+'|\n';
for (const p of policies) { const a=pool(p); md+='| '+p+' | '+tiers.map(g=>pct(a,r=>grade(r)===g)).join(' | ')+' |\n'; }
md+='| Informed, stronger roleplay | '+tiers.map(g=>pct(strong.results.informed.runs,r=>grade(r)===g)).join(' | ')+' |\n';
md += '\n## Candidate S cutoffs\n\nPercent of all runs earning S (game-over runs always stay F).\n\n| S cutoff | Passive | Proactive | Informed | Informed, stronger roleplay |\n|---:|---:|---:|---:|---:|\n';
for(const t of [310,400,425,450,475,500,525,550,575]){
  md+='| '+t+' | '+policies.map(p=>pct(pool(p),r=>!r.gameOver&&r.parts&&r.total>=t)).join(' | ')+' | '+pct(strong.results.informed.runs,r=>!r.gameOver&&r.parts&&r.total>=t)+' |\n';
}
md += '\n## Victory phases\n\n| Policy | Audit (3) | Records (4) | Interview (5) | Exercise (6) | No victory |\n|---|---:|---:|---:|---:|---:|\n';
for(const p of policies){const a=pool(p);md+='| '+p+' | '+[3,4,5,6].map(v=>pct(a,r=>r.phase===v)).join(' | ')+' | '+pct(a,r=>!r.phase)+' |\n';}
md += '\n## Sample sizes and reproducibility\n\n';
for(const report of [...normal,strong]) md+=`- Seed ${report.seed}: ${report.runsPerPolicy} games per policy.\n`;
md += '\nCommands (from the project folder):\n\n```powershell\nnode tools/run-balance.cjs 3000 34103410 tools/balance-results.json\nnode tools/run-balance.cjs 3000 107182026 tools/balance-validation.json\nnode tools/run-balance.cjs 1000 9003410 tools/balance-strong-roleplay.json strong\nnode tools/summarize-balance.cjs\n```\n\nThe saved raw reports retain the grades assigned at simulation time, before this calibration. The applied-calibration table regrades their unchanged scores with the new thresholds. Raw reports include every run, score component, final meters, failure reasons, squadron and victory phase.\n';
fs.writeFileSync(path.join(root,'BALANCE-REVIEW.md'),md);
console.log(md);
