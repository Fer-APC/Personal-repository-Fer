# Training Tracker

An installable web app that plans a 2–3 day gym week around the training you already
do — runs and beach volley — logs what you actually lift, and adapts the next week
from it.

No account, no server, no network. Everything lives in the browser and works offline.

## What it does

**Plans the week.** Picks which days you lift (spacing them away from hard runs and
volley), picks a split, then fills each session exercise by exercise from what your
body still needs that week.

**Works around your sport.** Runs and volley aren't ignored, they're modelled. A week
with intervals and a long run trims calf and quad volume but protects hamstrings and
glutes, because that's what runners tear. A week of beach volley cuts overhead pressing
and raises rear delt and rotator cuff work to balance the shoulder. Lifting the day
before a hard session caps the heavy, knee-stressful work so you arrive fresh.

**Follows your goals.** Slide hypertrophy, strength, calisthenics, resistance and
longevity against each other in any mix. The blend drives rep ranges, rest, set counts,
which exercises get picked, and how weekly volume is split across muscles. Change it
any week and the plan follows.

**Takes your session shape.** Say what each day looks like — 7 exercises as 3 singles
plus 2 supersets, or 2 singles plus a superset and a triset, whatever you want. The
planner fills exactly that shape, puts the heaviest work in the first block, and never
stacks the same muscle inside one superset.

**Keeps the week balanced.** The Balance tab shows every muscle's planned sets against
its target, separating direct work from assistance, and flags anything under-served,
over-served, or missing entirely.

**Adapts within the week, not just between weeks.** Save a session and the days you
haven't trained yet are rebuilt around what you actually did. Skip the lat work and it
reappears later in the week; do an extra chest session and the remaining days stop
prescribing chest. Sessions you've already trained are never touched. Days that have
passed lock in place, and whatever they didn't cover rolls forward.

**Takes sessions you did off-plan.** Log anything — a session at another gym, an
improvised one, work you added on top — by searching the exercise database. It counts
toward the week the same as a planned session.

**Tells you where you stand.** "Where you are" shows sessions done, sets logged, the
share of your weekly volume covered, and which muscles will still end the week short
once your remaining sessions are accounted for.

**Adapts between weeks too.** Loads progress by double progression — fill the rep range,
then add weight. Calisthenics ladders move up a step when you clear the top of the range
clean. Volume you missed carries into next week; muscles you flag as sore get less
immediately and again next week; three hard sessions in a row triggers a deload, as does
your chosen cadence.

## Getting to it

**Hosted, right now** — open the published build on any device and use it as-is. Data
stays in that browser.

**Installed on your phone (recommended)** — enable GitHub Pages for this repo
(Settings → Pages → Source: GitHub Actions). The workflow in
`.github/workflows/deploy.yml` builds and publishes on every push to the app branch.
Open the resulting URL on your phone and use "Add to Home Screen": you get an offline
app icon, no browser chrome, and a service worker that keeps it working on the gym's
dead wifi.

**Locally** — see below.

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm run preview    # serve the production build
npm test           # planner test suite
npm run build:single   # one self-contained HTML file in dist-single/
```

`dist/` is a static site — host it anywhere. `npm run build:single` instead produces a
single self-contained HTML file with everything inlined, for hosts that supply their own
page skeleton; that build has no service worker, since there are no separate asset URLs
left to cache.

## How the planner works

The pipeline lives in `src/domain/` and runs in this order:

| Step | Module | What happens |
| --- | --- | --- |
| 1 | `activities.ts` | Runs and volley become per-muscle fatigue, systemic load, impact and overhead exposure |
| 2 | `volume.ts` | Weekly per-muscle set targets from goals and experience, then adjusted by that sport load |
| 3 | `schedule.ts` | Best gym days by spacing and conflict, a split to match, and per-day joint/systemic budgets |
| 4 | `planner.ts` | Fills each session slot by slot, greedily picking whatever best serves what's still owed |
| 5 | `progression.ts` | Turns your logs into load suggestions, deficits, ladder steps and deload calls |
| 6 | `progress.ts` | Scores the week in flight: what's logged, what's still scheduled, what will fall short |

Replanning runs the same pipeline with the trained days pinned. Their logged volume is
subtracted from the weekly targets first, so the remaining sessions are built against
what is genuinely still owed — and set counts shrink when a muscle's work is already
banked, rather than the session silently repeating volume you don't need.

A week you join partway through only plans the days still ahead of it, with targets
scaled to match, so joining on a Thursday doesn't report you as behind on sessions that
were never possible.

Exercise selection scores each candidate on the muscle demand still outstanding, goal
fit, movement-pattern needs, superset legality, joint budgets and variety — then
subtracts what it picked from the demand vector, so the next slot sees an updated
picture. Constraints relax in a defined order rather than leaving a slot empty.

Every number that shapes a plan is a named constant in these modules — recovery windows
in `muscles.ts`, volume baselines in `volume.ts`, sport signatures in `activities.ts`,
goal profiles in `goals.ts`. They're meant to be edited.

## Adding exercises

`src/domain/exercises.ts` holds the database. Each entry declares its muscles, movement
pattern, equipment, joint costs and per-goal fit; the planner picks it up automatically.
Calisthenics progressions chain through `progression` and `progressionStep`.

## Your data

Stored in `localStorage` under `training-tracker/v1`, never sent anywhere. Setup → Export
JSON writes a backup; Reset everything clears it.
