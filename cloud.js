/* =====================================================================
   PRACTICUM ADVENTURE - shared leaderboard (Firebase Firestore)
   The leaderboard still lives in this browser (localStorage), but when
   CLOUD below is filled in, the GM console also keeps it in sync with a
   Firestore database, so every computer sees the same high scores.
   - Finished runs upload right away (and retry later if you're offline).
   - The board is pulled from the cloud on load, after every save, and every
     5 minutes while a screen that uses it is up (title, org chart, results,
     debrief). Each pull costs one Firestore read per run on the board, and the
     free plan allows 50,000 reads a day, so it doesn't poll during missions.
   - Runs saved before cloud sync was set up are uploaded on the first sync.
   - Test runs on localhost / file:// stay local unless the URL has ?cloud=1.
   How it all works: FIREBASE-BACKEND.md. Setup steps: HOW-TO-RUN.md. Security rules: firestore.rules
   ===================================================================== */
const CLOUD = {
  projectId: 'practicum-adventure',               // Firebase project ID
  apiKey: 'AIzaSyA0sOXZBDgq4zgbyFrBkTx90t10d4Bt5L8', // Firebase web API key (safe to publish; firestore.rules limits what it can do)
  collection: 'leaderboard',
  pullEvery: 5 * 60000,
  // screens that show or use the board (the org chart checks which patches are taken)
  boardPhases: ['title', 'patch', 'manifest', 'results', 'debrief'],
};
const CLOUD_FIELDS = ['callsign', 'unit', 'grade', 'score', 'low', 'stars', 'ach', 'gameOver', 'cadets', 'date', 'patch', 'patchKey'];
const CL = { last: 0, tried: 0, err: '', busy: false, timer: null }; // last = last good sync, tried = last attempt

function cloudConfigured() { return !!(CLOUD.projectId && CLOUD.apiKey); }
// local test builds don't touch the real board unless asked to
function cloudOn() {
  if (IS_BOSS_PRACTICE) return false;
  if (!cloudConfigured()) return false;
  const local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  return !local || /[?&]cloud=1\b/.test(location.search);
}
const cloudBase = () => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(CLOUD.projectId)}/databases/(default)/documents/${CLOUD.collection}`;
// one document per run, named after its save time (the same id on every computer)
const cloudId = r => String(r.date || '').replace(/[^0-9A-Za-z]/g, '');

// runs saved here but not uploaded yet (by date)
function cloudPending() { try { return JSON.parse(localStorage.getItem('sq_board_pending') || '[]'); } catch (e) { return []; } }
function setCloudPending(a) { try { localStorage.setItem('sq_board_pending', JSON.stringify([...new Set(a)])); } catch (e) { } }
// runs this browser has seen in the cloud: if one later disappears there, the GM deleted it in the Firebase console
function cloudSeen() { try { return JSON.parse(localStorage.getItem('sq_board_synced') || '[]'); } catch (e) { return []; } }
function setCloudSeen(a) { try { localStorage.setItem('sq_board_synced', JSON.stringify([...new Set(a)])); } catch (e) { } }

/* ---- Firestore's typed JSON <-> plain leaderboard rows ---- */
// the exact types firestore.rules expects (an old or half-filled row must not fail the upload)
const CLOUD_NUM = ['score', 'low', 'stars', 'ach'];
function cleanRun(r) {
  const o = {};
  CLOUD_FIELDS.forEach(k => { o[k] = k === 'gameOver' ? !!r[k] : CLOUD_NUM.includes(k) ? (Math.round(Number(r[k])) || 0) : String(r[k] == null ? '' : r[k]); });
  o.low = Math.max(0, Math.min(10, o.low));
  return o;
}
function toFields(r) {
  const f = {}; r = cleanRun(r);
  CLOUD_FIELDS.forEach(k => {
    const v = r[k];
    if (typeof v === 'boolean') f[k] = { booleanValue: v };
    else if (typeof v === 'number' && isFinite(v)) f[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else f[k] = { stringValue: v == null ? '' : String(v) };
  });
  return f;
}
function fromFields(f) {
  const r = {};
  Object.keys(f || {}).forEach(k => {
    const v = f[k];
    r[k] = 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? +v.doubleValue : 'booleanValue' in v ? v.booleanValue : v.stringValue != null ? v.stringValue : null;
  });
  return r;
}

/* ---- sync ---- */
async function cloudUpload(r) {
  const res = await fetch(`${cloudBase()}/${cloudId(r)}?key=${encodeURIComponent(CLOUD.apiKey)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: toFields(r) }),
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
}
async function cloudFetchAll() {
  const out = []; let page = '';
  do {
    const res = await fetch(`${cloudBase()}?pageSize=300&key=${encodeURIComponent(CLOUD.apiKey)}${page ? '&pageToken=' + encodeURIComponent(page) : ''}`);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const d = await res.json();
    (d.documents || []).forEach(doc => out.push(fromFields(doc.fields)));
    page = d.nextPageToken || '';
  } while (page);
  return out;
}
// Pull the shared board, merge it into this browser's copy, then upload anything only we have.
async function cloudSync() {
  if (!cloudOn()) return;
  if (CL.busy) { CL.again = true; return; } // a save during a sync: run once more afterwards
  CL.busy = true; CL.again = false; CL.tried = Date.now();
  try {
    const remote = await cloudFetchAll(), pend = cloudPending();
    const local = loadBoard(), byDate = new Map(local.map(r => [r.date, r]));
    let changed = false;
    remote.forEach(r => { // the cloud copy wins, except for runs we changed and haven't uploaded yet
      if (!r.date || pend.includes(r.date)) return;
      const mine = byDate.get(r.date);
      if (!mine || JSON.stringify(CLOUD_FIELDS.map(k => mine[k])) !== JSON.stringify(CLOUD_FIELDS.map(k => r[k]))) { byDate.set(r.date, r); changed = true; }
    });
    const have = new Set(remote.map(r => r.date)), seen = new Set(cloudSeen());
    // Pending local edits go up even when an older cloud copy exists. Missing unseen runs upload;
    // a run deleted from the cloud after a prior sync stays deleted.
    const toSend = [];
    [...byDate.values()].forEach(r => {
      if (!r.date) return;
      if (pend.includes(r.date)) { toSend.push(r); return; }
      if (have.has(r.date)) return;
      if (!seen.has(r.date)) toSend.push(r);
      else { byDate.delete(r.date); seen.delete(r.date); changed = true; }
    });
    remote.forEach(r => r.date && seen.add(r.date));
    if (changed) saveBoard([...byDate.values()]);
    const left = [], uploaded = new Map();
    const fingerprint = r => JSON.stringify(toFields(r));
    for (const r of toSend) {
      const version = fingerprint(r);
      try { await cloudUpload(r); seen.add(r.date); uploaded.set(r.date, version); }
      catch (e) { left.push(r.date); CL.err = String(e.message || e); }
    }
    // Saves may arrive while an upload is in flight. Only acknowledge the exact
    // version sent; keep newer edits and newly queued runs for the next sync.
    const latest = new Map(loadBoard().map(r => [r.date, r]));
    cloudPending().forEach(date => {
      if (!uploaded.has(date) || (latest.has(date) && fingerprint(latest.get(date)) !== uploaded.get(date))) left.push(date);
    });
    setCloudSeen([...seen]); setCloudPending(left);
    if (!left.length) CL.err = '';
    CL.last = Date.now();
  } catch (e) { CL.err = String(e.message || e); }
  CL.busy = false;
  if (typeof push === 'function') push(true); // redraw the board, the projector and the status line
  if (CL.again) return cloudSync();
}
// a run was just saved: mark it for upload and sync now
function cloudQueue(date) { if (!cloudOn() || !date) return; setCloudPending(cloudPending().concat(date)); cloudSync(); }
function cloudStart() {
  if (!cloudOn()) return;
  cloudSync();
  // check every 30 s; at most one pull per 5 minutes, and only when the board is on screen
  // or runs are still waiting to upload (coming back online retries right away)
  clearInterval(CL.timer); CL.timer = setInterval(() => {
    const onBoard = typeof S !== 'undefined' && S && CLOUD.boardPhases.includes(S.phase);
    if ((onBoard || cloudPending().length) && Date.now() - CL.tried >= CLOUD.pullEvery) cloudSync();
  }, 30000);
  window.addEventListener('online', cloudSync);
}
// one line for the GM console's leaderboard card
function cloudStatus() {
  if (!cloudConfigured()) return '☁️ Shared leaderboard is not set up: this board lives in this browser only. See HOW-TO-RUN.md, "Shared leaderboard".';
  if (!cloudOn()) return '☁️ Test build: the shared leaderboard is off here, so test runs stay on this computer (add ?cloud=1 to the address to use it).';
  const n = cloudPending().length;
  if (CL.err) return `☁️ Shared leaderboard: can't reach it right now (${esc(CL.err)}).${n ? ` ${n} run${n === 1 ? '' : 's'} waiting to upload; they'll go up automatically.` : ''}`;
  if (!CL.last) return '☁️ Shared leaderboard: connecting...';
  const min = Math.round((Date.now() - CL.last) / 60000);
  return `☁️ Shared leaderboard: synced ${min ? min + ' min ago' : 'just now'}.${n ? ` ${n} waiting to upload.` : ''}`;
}
