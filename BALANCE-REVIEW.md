# Balance simulation — October 18, 2026

21,000 complete simulated games: 6,000 per policy across two independent seeded batches, plus 1,000 per policy with stronger roleplay. All use the current game engine in an isolated VM. No real saves, rooms or leaderboard entries are touched.

## Assumptions

- Four random distinct positions, random perks and upgrades, random squadron and route choices. Every team gets its DEOCS item.
- Passive: random non-trap responses; no items or active perks; random eligible roller.
- Proactive: random non-trap scenario responses, best roller, useful items/perks, low-meter rest, survival-aware Attack/Defend.
- Informed: proactive plus weighted expected-value scenario choices using exact hidden effect values. This is an optimistic information model, not an optimal strategy. It cannot predict random rolls or future events.
- Ordinary roleplay: 20% one star, 50% two stars, 30% three stars. Strong-roleplay sensitivity: 5%, 35%, 60%. Items can raise these ratings using the real engine.
- Integrity traps are deliberately avoided. F still includes crisis failures and consequences. Random route/build selection does not model coordinated expert builds. These are balance estimates, not measured student success rates.

## Previous grade distribution (S 310, A 265, B 200, C 140)

| Policy | S | A | B | C | D | F | Errors/stalls |
|---|---:|---:|---:|---:|---:|---:|---:|
| passive | 1.87% | 1.45% | 11.35% | 27.17% | 27.23% | 30.93% | 0 |
| proactive | 15.73% | 7.52% | 29.38% | 28.68% | 10.42% | 8.27% | 0 |
| informed | 27.80% | 11.70% | 33.07% | 21.27% | 5.62% | 0.55% | 0 |

## Applied calibration (S 450, A 340, B 245, C 190)

Existing scores regraded; no game outcomes or point awards changed. Targets for strong informed play: approximately 10% S, 20% A, 35% B, 25% C, remaining completed games D. Game-over runs are always F. Integer score ties prevent exact percentages.

| Policy | S | A | B | C | D | F |
|---|---:|---:|---:|---:|---:|---:|
| passive | 0.22% | 1.17% | 3.37% | 13.58% | 50.73% | 30.93% |
| proactive | 2.93% | 9.33% | 17.63% | 29.08% | 32.75% | 8.27% |
| informed | 7.22% | 15.18% | 26.05% | 29.05% | 21.95% | 0.55% |
| Informed, stronger roleplay | 9.60% | 20.60% | 34.80% | 25.90% | 8.60% | 0.50% |

## Candidate S cutoffs

Percent of all runs earning S (game-over runs always stay F).

| S cutoff | Passive | Proactive | Informed | Informed, stronger roleplay |
|---:|---:|---:|---:|---:|
| 310 | 1.87% | 15.73% | 27.80% | 38.10% |
| 400 | 0.47% | 5.57% | 12.38% | 17.90% |
| 425 | 0.30% | 3.98% | 9.38% | 14.00% |
| 450 | 0.22% | 2.93% | 7.22% | 9.60% |
| 475 | 0.13% | 1.88% | 5.02% | 7.10% |
| 500 | 0.08% | 1.17% | 3.25% | 4.50% |
| 525 | 0.03% | 0.63% | 1.80% | 2.70% |
| 550 | 0.02% | 0.15% | 0.78% | 1.60% |
| 575 | 0.00% | 0.05% | 0.17% | 0.60% |

## Victory phases

| Policy | Audit (3) | Records (4) | Interview (5) | Exercise (6) | No victory |
|---|---:|---:|---:|---:|---:|
| passive | 0.03% | 0.13% | 1.25% | 1.20% | 97.38% |
| proactive | 0.80% | 1.38% | 8.52% | 6.33% | 82.97% |
| informed | 1.68% | 3.08% | 14.48% | 7.68% | 73.07% |

## Sample sizes and reproducibility

- Seed 34103410: 3000 games per policy.
- Seed 107182026: 3000 games per policy.
- Seed 9003410: 1000 games per policy.

Commands (from the project folder):

```powershell
node tools/run-balance.cjs 3000 34103410 tools/balance-results.json
node tools/run-balance.cjs 3000 107182026 tools/balance-validation.json
node tools/run-balance.cjs 1000 9003410 tools/balance-strong-roleplay.json strong
node tools/summarize-balance.cjs
```

The saved raw reports retain the grades assigned at simulation time, before this calibration. The applied-calibration table regrades their unchanged scores with the new thresholds. Raw reports include every run, score component, final meters, failure reasons, squadron and victory phase.
