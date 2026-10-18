/* Standalone, print-friendly team handouts. No individual academic rubric scores. */
const TEAM_REPORTS_KEY = 'sq_team_reports_v1';
function teamReportModel(state) {
  if (!state?.final) return null;
  const patch = patchOf(state), unit = UNITS.find(u => u.id === state.unit);
  const members = (state.npcs || []).filter(n => !n.gone);
  const allies = members.filter(isAlly).length;
  const meters = METERS.map(m => ({ key: m.k, name: m.label, value: state.meters[m.k] }));
  const weakest = meters.slice().sort((a,b) => a.value-b.value)[0];
  const violations = TRAP_FLAGS.filter(f => state.flags?.[f]).map(f => FLAG_TEXT[f] || f);
  const average = state.micCount ? (state.starsTotal / state.micCount).toFixed(1) : null;
  const victory = bossDefeatScore(state);
  const crises = state.gameOver && state.gameOverKind === 'crisis' ? Math.max(2,state.crises || 0) : (state.crises || 0);
  const observations = [
    ['Integrity First', violations.length ? `Recorded integrity findings: ${violations.join('; ')}.` : 'No recorded integrity violations.'],
    ['Service Before Self', `${allies} of ${members.length} present unit members finished as Allies.${state.micCount ? ` Roleplay: ${state.starsTotal} stars across ${state.micCount} scenes (${average}/3 average).` : ''}`],
    ['Excellence In All We Do', `${meters.filter(m => m.value >= 5).length} of 4 meters finished at 5+. Lowest: ${weakest.name}, ${weakest.value}/10.${crises ? ` ${crises} crisis event${crises === 1 ? '' : 's'} recorded.` : ' No crisis events recorded.'}`]
  ];
  return {
    version: 1, id: state.boardDate || String(state.final.at || Date.now()), date: state.boardDate || state.final.at || Date.now(),
    patchName: patch?.name || state.callsign || 'Your Flight', patchIcon: patch?.icon || '🎖️',
    squadron: unit?.sq || unit?.name || 'Squadron not selected', squadronIcon: unit?.icon || '', practice: !!state.practice,
    squadronPenalty: unit ? squadPenaltyText(unit.id, state) : '',
    grade: state.final.grade.g, gradeTitle: state.final.grade.title, strat: state.final.grade.strat,
    score: state.final.total, parts: displayScoreParts(state.final.parts).map(p => [p[0],p[1]]),
    bossDefeated: !!victory, failureKind: state.gameOver ? state.gameOverKind || 'integrity' : null,
    inspection: state.boss?.result || (state.gameOver ? 'Run ended before inspection completion' : 'Inspection not completed'),
    bossOutcome: victory ? `IG defeated in Phase ${victory.phase}. Victory bonus: 30 ×${victory.multiplier} = ${victory.points} points.`
      : state.boss ? `IG remaining HP: ${state.boss.hp}/${state.boss.max}.` : 'The team did not reach the Inspector General.',
    ended: state.gameOver ? (state.gameOverReasons || []).join('; ') : '',
    roster: state.party.filter(p => p.name).map(p => {
      const c = CLASS[p.cls], insignia = INSIGNIA[rankOf(p)];
      const selectedPerk = c?.perks.find(k => k.id === p.perk);
      const upgrade = c?.ups.find(k => k.id === p.up);
      return { name: p.name, rank: c?.rank || '', position: c?.name || 'Unassigned', avatar: avatarOf(p),
        abilities: [c?.ability, selectedPerk, upgrade && { ...upgrade, icon: upgrade.icon || '⬆️' }].filter(Boolean).map(k => ({icon:k.icon,name:k.name})),
        rankFile: insignia ? `insignia/${insignia[0]}.svg` : '', fired: !!p.fired,
        relieved: !!(state.gameOver && state.gameOverKind === 'crisis') };
    }),
    commander: state.cc ? { name: state.cc, avatar: avatar(state.cc), rankFile: 'insignia/LtCol.svg', intent: METER[state.intent]?.label || '', intentValue: state.meters[state.intent],
      positive: unit?.cc.pos, negative: unit?.cc.neg, negativeDisabled: confidantIdx(state) >= 0 } : null,
    unitMembers: (state.npcs || []).map(n => ({ name: n.name, rank: n.rank, avatar: avatar(n.name+n.rank),
      trait: TRAIT[n.trait] ? { icon: TRAIT[n.trait].icon, name: TRAIT[n.trait].name, description: TRAIT[n.trait].what } : null,
      rankFile: INSIGNIA[n.rank] ? `insignia/${INSIGNIA[n.rank][0]}.svg` : '', loyalty: n.loy,
      status: n.deceased ? 'Deceased' : n.gone ? (state.unit === 'ch' && n.slot === 'D' ? 'Deployed' : 'Left unit') : isAlly(n) ? 'Ally' : n.broken ? 'Broken' : 'Unit member', gone: !!(n.gone || n.deceased || n.deployed) })),
    meters, observations,
    objectives: OBJECTIVES.map(o => ({ name: o.name, count: objEvents(state,o.id).length }))
  };
}
function loadTeamReports() {
  try { const reports = JSON.parse(localStorage.getItem(TEAM_REPORTS_KEY) || '[]'); return Array.isArray(reports) ? reports.filter(r => r?.version === 1 && r.id && Array.isArray(r.roster)) : []; }
  catch (_) { return []; }
}
function saveTeamReport(state) {
  if (state.practice) return;
  const report = teamReportModel(state); if (!report) return;
  const reports = loadTeamReports().filter(r => r.id !== report.id);
  reports.push(report);
  try { localStorage.setItem(TEAM_REPORTS_KEY, JSON.stringify(reports.slice(-50))); }
  catch (_) { notice('🖨️', 'REPORT NOT ARCHIVED', 'Browser storage is full. Open the current team results sheet and save it as a PDF before starting a new run.'); }
}
function teamReportsCard() {
  const reports = loadTeamReports().slice().reverse();
  if (!reports.length) return '';
  return `<div class="gcard"><h3>🖨️ Team results sheets</h3><p class="note">The last 50 completed teams, saved in this browser. Open a sheet to print or save as PDF.</p>${reports.map(r => `<div class="row"><b>${esc(r.patchName)}</b><span class="note">${new Date(r.date).toLocaleDateString()} · ${esc(r.grade)} · ${r.score} pts</span>${B('printSavedTeam', '🖨️ Open sheet', {arg:r.id,cls:'sm'})}</div>`).join('')}</div>`;
}
function openTeamReport(report) {
  if (!report) return alert('Complete the run before opening a team results sheet.');
  const tab = window.open('', '_blank');
  if (!tab) return alert('Allow pop-ups for this site to open the print-ready results sheet.');
  tab.document.open(); tab.document.write(renderTeamReport(report)); tab.document.close();
  prepareTeamReport(tab.document);
}
async function prepareTeamReport(doc) {
  const button = doc.querySelector('[data-print-report]');
  if (button) button.disabled = true;
  await Promise.allSettled([...doc.images].map(async img => {
    if (img.dataset.embedSrc) {
      const response = await fetch(img.dataset.embedSrc); if (!response.ok) throw new Error('Report art unavailable');
      const svg = await response.text(); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    await img.decode();
    if (img.classList.contains('avatar')) {
      // Expand the actual pixels before printing; CSS image-rendering alone is
      // ignored by some print drivers. 384 is an integer multiple of 8 and 12.
      const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 384;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
      context.drawImage(img,0,0,384,384); img.src = canvas.toDataURL('image/png'); await img.decode();
    }
  }));
  await doc.fonts.ready;
  if (button) button.disabled = false;
}
act('printTeam', () => { saveTeamReport(S); openTeamReport(teamReportModel(S)); return false; });
act('printSavedTeam', id => { openTeamReport(loadTeamReports().find(r => r.id === String(id))); return false; });
