# Training Tracker

An installable web app that plans a 2–3 day gym week around the training you already
do — runs and beach volley — logs what you actually lift, and adapts the next week
from it.

No account, no server, no network. Everything lives in the browser and works offline.

## What it does

**Plans the week.** Picks which days you lift (spacing them away from hard runs and
volley), picks a split, then fills each session exercise by exercise from what your
body still needs that week.

**Works around your sport.** Runs and volley aren't ignored, they're modelled. Sport load
compresses onto a 0-1 scale that saturates smoothly rather than clipping, so a couple of
sessions a week and a marathon block are never treated as the same "maximum" — more sport
always means a little less asked of the legs in the gym. A week
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

**Measures you against your own week.** The per-muscle volume targets start from an
unconstrained ideal — the volume your goal mix would use with unlimited days — and are
then scaled to what the days and exercises you actually chose can hold. So 100% means a
full week as you set it up, not a compromise, and completing your sessions reads as done.
How your week compares with that ideal, and what another day or two more exercises per
session would add, is stated as information rather than a warning.

Two different gaps are reported separately: work you missed by skipping sessions, and
muscles your session shape cannot reach at all — the second closes only by changing the
shape, never by training harder.

**Keeps the week balanced.** Training drifts without you noticing — you press more than
you pull, or the legs quietly disappear because you already run. The Balance tab is the
check: every muscle, what you have actually trained so far, what the sessions you have
left will add, and the target. A week whose gym days have all passed still reports what
was done rather than blanking.

**Adapts within the week, not just between weeks.** Save a session and the days you
haven't trained yet are rebuilt around what you actually did. Skip the lat work and it
reappears later in the week; do an extra chest session and the remaining days stop
prescribing chest. Sessions you've already trained are never touched. Days that have
passed lock in place, and whatever they didn't cover rolls forward.

**Takes sessions you did off-plan.** Log anything — a session at another gym, an
improvised one, work you added on top — by searching the exercise database. It counts
toward the week the same as a planned session.

**Has a browsable exercise library.** Every exercise grouped by the muscle it targets,
ranked for your goal mix, with the top two in each group marked as staples and every
rating explained: how well it fits your goals, how much muscle it trains per set, and how
much room you have left to progress on it. Externally loaded lifts never run out;
bodyweight work runs out when its ladder does.

**Respects the room you train in.** Setup → Work around has a switch for a gym with no
space to walk with weight; carries and travelling lunges are then never prescribed.
Supersets prefer partners that use kit you already have in your hands, so a superset does
not send you across the floor and back.

**Answers "someone is on that machine".** Every exercise — in the library, on the plan,
and inside a session you are logging — offers stand-ins that train the same muscles,
keep the same movement pattern where possible, and need none of the same equipment. If
the pulldown station is taken it offers pull-ups, not a row.

**Takes dictation.** Tap the microphone and talk: "on Monday I did squats five sets of
five at a hundred kilos, bench press three by eight at sixty, my hamstrings are sore,
more calisthenics". It logs the sets against Monday, records the soreness, and shifts the
goal mix — but it always shows what it understood and waits for you to confirm, because
speech recognition misfires and a wrong weight in your log is worse than no log at all.
Anything it could not parse is listed rather than guessed at.

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

## On a phone

The app is built for a phone held in one hand mid-workout, so the layout is checked
against a 360×660 CSS viewport (a Galaxy S24 with the browser chrome accounted for):

- every control is at least 44×44px, including the set-done cell, which is a 56×52
  target rather than a bare checkbox
- number inputs are 16px, which stops mobile browsers zooming when a field is focused
- the next session opens expanded at the top of the week with its action above the fold;
  other days collapse to a heading, and per-exercise reasoning is behind a toggle

`scripts/mobile-audit.mjs` measures all of this against a running preview — page height
in screenfuls, sub-44px tap targets, text under 12.5px, horizontal overflow — and is
worth re-running after any layout change.

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
| 7 | `voice.ts` / `apply.ts` | Turns spoken sentences into typed commands, then applies them to the state |
| 8 | `library.ts` | Rates and groups the exercise database, and finds stand-ins for busy equipment |

Ratings blend goal fit (which leads, so the best side-delt movement is a lateral raise
rather than whatever lists the most muscles), progression headroom, muscle worked per
set, and what the current week is short of. Stand-ins additionally weigh how much of the
original they replace and whether they keep the same movement pattern, and show one rung
per progression ladder so the list is six options rather than one ladder four times.

Dictation is parsed in the browser, with no model and no network call: `voice.ts` maps
speech to a `Command[]`, and `apply.ts` is a pure function from `(state, commands)` to a
new state, so every branch is testable without a browser. Speech arrives without
punctuation, so a run of instructions is cut at exercise-name boundaries — keeping each
set attached to the lift it was spoken with, rather than combining one exercise's name
with another's numbers.

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
JSON shows it in full to copy, and saves it as a file where the browser allows downloads.

Stored data carries a `version`, and `migrate` in `src/domain/store.ts` upgrades older
shapes on load. Plans are derived data and are repaired from whatever they still carry;
logged sessions and settings are never discarded. Data that cannot be parsed at all is
moved aside under `training-tracker/v1.unreadable` rather than overwritten.

**If you change the shape of anything stored, add a migration and a case to
`tests/migration.test.ts`.** Every release has to open the previous release's data — a
missing field crashes the app on load, and a local-first app that won't render is one
you cannot get your history out of. `scripts/upgrade-smoke.mjs` drives that upgrade in a
real browser. As a backstop, any render error shows a recovery screen offering the raw
data to copy before anything is cleared.
