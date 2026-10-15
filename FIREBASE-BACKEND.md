# Firebase backend: the shared leaderboard

Practicum Adventure is a static site (GitHub Pages) with no server of its own. The one piece that needs a backend is the **high-score leaderboard**, so every computer that runs the GM console sees the same board. That backend is a **Google Firebase Cloud Firestore** database.

Everything else (the game itself, phones, grades, saved runs) works without Firebase. If Firebase is unreachable, the game keeps working and catches up when it reconnects.

## At a glance

| | |
|---|---|
| Service | Google Firebase, Cloud Firestore (NoSQL document database) |
| Project | `practicum-adventure` (owned by the instructor's personal Google account) |
| Console | [console.firebase.google.com/project/practicum-adventure/firestore](https://console.firebase.google.com/project/practicum-adventure/firestore) |
| Plan | **Spark (free, no billing account).** It can't run up charges; at the daily limit it stops until the next day. |
| Database | `(default)`, one collection: `leaderboard` |
| Config in the code | [`cloud.js`](cloud.js), the `CLOUD` block at the top |
| Security rules | [`firestore.rules`](firestore.rules) (a copy of what's published in the console) |
| Setup steps | [`HOW-TO-RUN.md`](HOW-TO-RUN.md), "Shared leaderboard" |

## How it works

```
 GM console (browser)                         Firebase Cloud Firestore
 ┌────────────────────────┐   HTTPS (REST)   ┌──────────────────────────┐
 │ localStorage           │ ───── upload ──▶ │ leaderboard/             │
 │  sq_leaderboard (copy) │ ◀──── pull ───── │   20261015T200000000Z    │
 │ cloud.js keeps them    │                  │   20261016T143012345Z    │
 │ in sync                │                  │   ...one doc per run     │
 └────────────────────────┘                  └──────────────────────────┘
```

- The game talks to Firestore's REST API with plain `fetch` calls. No Firebase SDK is loaded.
- Each browser still keeps its own copy of the board in `localStorage` (`sq_leaderboard`). `cloud.js` merges that copy with the cloud.
- **Upload:** when a run finishes, it's saved locally and uploaded right away. If the upload fails (no internet), the run waits in a queue (`sq_board_pending`) and retries automatically. The GM console's leaderboard card shows how many runs are waiting.
- **Pull:** the board is pulled when the console opens, after every save, and every 5 minutes while a screen that uses it is up (title, org chart, results, debrief). It does not poll during missions.
- **Saving the same run again** (for example after fixing the team name) updates the same document instead of adding a second one. Each document is named after the run's save time, so the name is the same on every computer.
- **Runs saved before Firebase was set up** are uploaded the first time that browser syncs.
- **Deletes:** a run deleted in the Firebase console disappears from every GM console on its next pull and is not re-uploaded. Each browser remembers which runs it has already seen in the cloud (`sq_board_synced`).
- **Test builds stay out of it:** on `localhost` (`Play-Locally.bat`) or a `file://` copy, sync is off unless the address ends in `?cloud=1`, so test runs don't land on the real board.

## What's stored

One document per finished run in `leaderboard/`, with exactly these fields:

| Field | Type | Example | Meaning |
|---|---|---|---|
| `callsign` | string | `JET JOCKEYS` | Team name (from the team patch) |
| `unit` | string | `4TH AMXS` | Squadron played |
| `grade` | string | `A` | The game's letter grade for the run |
| `score` | number | `610` | Final score |
| `low` | number | `5` | Lowest meter at the end (tie-breaker) |
| `stars` | number | `9` | Total acting stars |
| `ach` | number | `4` | Achievements earned |
| `gameOver` | boolean | `false` | True if the run ended in an integrity Game Over |
| `cadets` | string | `Capt Snuffy, MSgt Helle` | The party's ranks and names as typed in |
| `date` | string | `2026-10-15T20:00:00.000Z` | When the run was saved (also the document's name) |
| `patch` | string | `✈️` | Team patch icon |
| `patchKey` | string | `wk:jet` | Squadron + patch id, so another team can't take the same patch |

**Not stored in Firebase:** the GM's grading rubric scores and notes, saved runs in progress, the NPC roster, and anything typed on phones. Those stay in the GM's browser. Keep using **Export leaderboard + grades (JSON)** and **Export grades CSV** after each practicum day.

**Privacy note:** the board can be read by anyone who has the game's address, since the API key is in the public code. That's the same visibility as the leaderboard on the projector, but it includes the cadet names typed into each run. If you'd rather not keep names online, enter call signs or last initials instead of names when setting up the party.

## Security

- The `apiKey` in `cloud.js` is **meant to be public.** Firebase web keys only identify the project; they don't grant access. What protects the data is [`firestore.rules`](firestore.rules).
- The rules allow:
  - **Reading** the leaderboard (anyone)
  - **Adding or updating** a run, but only with exactly the fields above, each type- and size-checked (for example, a score must be between −5000 and 5000)
- The rules block:
  - **Deleting** anything from the game
  - **Any other collection** in the database
- These were tested on the live database during setup. A 999,999 score, an extra field, a delete and a write to another collection were all refused.
- **Limitation:** someone determined could still add a fake run with believable values, since the game has no login. If that ever happens, delete it in the console. If it becomes a pattern, Firebase **App Check** (offered in the console) or a GM sign-in would be the next step.

## Managing it

- **Delete a run:** Firebase console → **Firestore Database → Data → leaderboard** → click the run → **⋮** in the document's column → **Delete document**. Gone from every GM console within about 5 minutes.
- **Start a new season / clear the board:** export a backup from the GM console first, then delete the `leaderboard` collection in the console (**⋮** on the collection → **Delete collection**). Every GM console drops those runs on its next pull, and the next saved run recreates the collection. The only runs that would come back are ones a browser saved while offline and hasn't uploaded yet.
- **Back up:** the GM console's **💾 Export leaderboard + grades (JSON)** downloads the whole board. **📂 Import JSON** in another browser merges a backup and uploads anything the cloud is missing.
- **Change the rules:** edit [`firestore.rules`](firestore.rules), paste it into **Firestore Database → Rules**, and click **Publish**. Keep the file and the console in step.
- **Turn the shared board off:** blank out `projectId` and `apiKey` in `cloud.js` and push. The game goes back to a per-browser leaderboard.
- **Hand it off to another instructor:** in the Firebase console, **⚙️ Project settings → Users and permissions → Add member** with the Owner role.

## Usage limits (free Spark plan)

| Limit per day | Free amount | What uses it |
|---|---|---|
| Document reads | 50,000 | Each pull reads every run on the board once |
| Document writes | 20,000 | One per saved run |
| Stored data | 1 GiB total | About 300 bytes per run |

A typical practicum day uses a small fraction of this: a pull every 5 minutes while the board is on screen, a few hundred runs on the board at most. If the limit were ever hit, the board would show "can't reach it right now" until the next day, uploads would queue, and the game itself would keep working. Usage is shown under **Firestore Database → Usage**.

## Troubleshooting

The GM console's leaderboard card shows the sync status in its **☁️** line.

| Status | Meaning / fix |
|---|---|
| ☁️ Shared leaderboard: synced just now | Working. |
| ☁️ Shared leaderboard is not set up | `projectId` or `apiKey` is blank in `cloud.js`. |
| ☁️ Test build: the shared leaderboard is off here | You're on `localhost` or a file copy. Expected. Add `?cloud=1` to test sync. |
| can't reach it right now (Failed to fetch) | No internet, or a network blocks `firestore.googleapis.com`. Runs queue and upload later. |
| can't reach it right now (download 403 / upload 403) | The rules in the console don't match `firestore.rules`, or a run has a field the rules reject. Republish the rules. |
| can't reach it right now (download 400 / 404) | The `apiKey` (400) or `projectId` (403 / 404) in `cloud.js` is wrong. |
| can't reach it right now (… 429) | The daily free limit was reached. It resets the next day; nothing is lost. |

## Code map

- [`cloud.js`](cloud.js) holds all the Firebase code: the config, converting rows to and from Firestore's format, upload and pull, the merge, the retry queue and the status line.
- [`app.js`](app.js):
  - `saveToBoard()` calls `cloudQueue()` after saving a run.
  - `initGM()` calls `cloudStart()`.
  - The GM title screen shows `cloudStatus()` and hides **Clear leaderboard** while sync is on.
  - Importing a JSON backup triggers `cloudSync()`.
- [`index.html`](index.html) loads `cloud.js` after `app.js`. Phones (`join.html`) and the Field Guide don't load it.
- [`firestore.rules`](firestore.rules) is the published security rules.
