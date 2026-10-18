// Isolated VM: no browser saves, rooms, leaderboard, network, or real timers.
// node tools/run-balance.cjs [runs per policy] [seed] [output JSON] [strong]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const count = Number(process.argv[2] || 1000);
const seed = Number(process.argv[3] || 34103410) >>> 0;
let rng = seed;
const math = Object.create(Math);
math.random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
const memory = new Map();
const ctx = {console, Math:math, Date, location:{hash:'',search:'',protocol:'http:',href:'http://localhost/index.html'},
  localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},
  document:{createElement:()=>({getContext:()=>({fillRect(){}}),toDataURL:()=> 'data:'})},
  Image:class {}, setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  addEventListener(){},alert(){},prompt:(_m,d)=>d,confirm:()=>true};
ctx.window = ctx;
vm.createContext(ctx);
for (const file of ['data.js','app.js','sim.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
vm.runInContext('renderGM=()=>{}; push=()=>{}; save=()=>{}; saveToBoard=()=>{};',ctx);
if (process.argv[5] === 'examples') {
  const found = {};
  for (let attempt = 1; attempt <= 500 && (!found.loss || !found.victory); attempt++) {
    const outcome = vm.runInContext("simRun('informed', {stops:7})",ctx);
    const state = JSON.parse(vm.runInContext('JSON.stringify(S)',ctx));
    const kind = state.gameOver && state.boss ? 'loss' : !state.gameOver && state.boss?.hp === 0 && state.boss?.stage === 'done' ? 'victory' : null;
    if (!kind || found[kind]) continue;
    fs.writeFileSync(path.join(root,`tools/report-example-${kind}-state.json`),JSON.stringify(state));
    found[kind] = {attempt, grade:outcome.g, score:outcome.total, hp:outcome.hp, phase:outcome.phase, reasons:outcome.reasons};
  }
  console.log(JSON.stringify(found,null,2));
  process.exit(found.loss && found.victory ? 0 : 1);
}
if (process.argv[5] === 'example') {
  const outcome = vm.runInContext("simRun('informed', {stops:7})",ctx);
  const state = vm.runInContext('JSON.stringify(S)',ctx);
  const target = path.resolve(root,process.argv[4] || 'tools/report-example-state.json');
  fs.writeFileSync(target,state);
  console.log(JSON.stringify(outcome,null,2));
  console.log('Completed state:',target);
  process.exit(outcome.stuck || outcome.g === 'ERR' ? 1 : 0);
}
const options = process.argv[5] === 'strong' ? {stars:[.05,.35,.6]} : {stars:[.2,.5,.3]};
const results = vm.runInContext(`simBatch(${count},${JSON.stringify(options)})`,ctx);
const report = {seed,runsPerPolicy:count,options,results};
const target = path.resolve(root,process.argv[4] || 'tools/balance-results.json');
fs.writeFileSync(target,JSON.stringify(report,null,2));
for (const [policy, result] of Object.entries(results)) {
  const {runs,...summary} = result; console.log(policy, JSON.stringify(summary,null,2));
}
console.log('Report:',target);
