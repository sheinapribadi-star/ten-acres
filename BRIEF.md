# Ten Acres: research and design brief

## The prompt

[ContainOS](https://devpost.com/software/containos) won in the OpenAI Artificial Intelligence Track at [TreeHacks 2026](https://treehacks-2026.devpost.com/) (February 2026). The team (Maanit Goel, Kyle Tianshi, Grace Yan, Nathan Zhou) built a copilot for the first hours of a wildfire: four GPT-4o agents reason about fire behavior, risk, alerts and a recommendation, and every output is checked against a deterministic physics baseline. If an agent contradicts the physics, it is sent back with feedback, and after three tries the system falls back with a confidence of zero. Their write-up also mentions a historical component that surfaces "relevant precedents and escalation patterns from past incidents."

Two ideas from that project are worth pulling on:

1. **The first hours decide the fire.** ContainOS calls initial attack the most critical window.
2. **Generative reasoning should be bounded by something it cannot argue with.** For ContainOS that is physics.

## The question

What does the public record say about the first hour, and can it serve as a second, plainer bound on an AI copilot?

CAL FIRE states its goal as keeping 95% of wildfires contained at 10 acres or less ([What We Do](https://www.fire.ca.gov/what-we-do)). That goal is a clean operating metric: a fire either stays inside it or it does not. So the unit of analysis is the fire, and the outcome is whether it got past 10 acres.

## Data

- **Source:** NIFC WFIGS Incident Locations (the interagency IRWIN record), public ArcGIS feature service. Pulled November 18, 2026.
- **Pull:** every California incident typed as a wildfire (`IncidentTypeCategory = 'WF'`), discovered 2020 to 2025. 77,645 records.
- **Cohort:** 2022 to 2025, Pacific time, with a recorded size (FinalAcres, else IncidentSize). 30,849 fires. 2020 and 2021 are left out because far fewer small fires carry sizes in those years.
- **Why sized only:** 42,970 records in the pull never got a size. Almost all are dispatch records from local government and contract units with a placeholder discovery size of 0.01 or 0.1 acres. Their outcome is unknown, so counting them as "held" would flatter the metric.

## What I found before designing

- 95.3% of sized fires stayed at 10 acres or less. 1,451 escaped, and they burned 99.3% of the 2.14 million acres.
- By year: 96.7% (2022), 96.6% (2023), 94.0% (2024), 94.1% (2025).
- The Park Fire (Butte County, July 2024) alone is 20% of all acres. The ten largest are 52%.
- Escapes cluster in summer afternoons. Fires reported noon to 3 pm escape at 7.3%; midnight to 6 am at about 2%.
- Size at first report is mostly placeholder, but fires first sized at 3 to 10 acres escape about a quarter of the time.

## The build

A long single page in six short sections: the ledger (the goal by year), the concentration (fires vs acres), a month by hour heat grid, a **precedent desk**, a **copilot check**, and an honest holdout result.

**Precedent desk.** The user describes a new fire with facts known at the first call: county, month, time reported, first size, land owner. Each fact narrows the pool of past fires, shown as a ladder of rates with 95% Wilson intervals. When fewer than 30 precedents remain, the desk stops and says so. The deepest pool lists its most recent escapes by name, date and final size, all real records.

**Copilot check.** A slider stands in for an AI copilot's claim ("chance this passes 10 acres"). The claim is compared to the deepest precedent pool: inside the interval reads as consistent, within 3x of it asks for a stated reason, and beyond that is an extraordinary claim. The page says plainly that the thresholds are a design choice and that a copilot with live wind data can be right to depart from the record. The point is that it should have to say why.

## Honest test

Precedent rates built from 2022 to 2024, then every 2025 fire scored by the same ladder (all five facts, stop below 30). AUC 0.63. The riskiest tenth escaped at 12.2% against a 5.9% base and held 21% of escapes. Variants (shrinkage toward the parent rung, a minimum of 50, other filter orders) all landed between 0.63 and 0.65, so the ceiling is the data, not the tuning. That is the finding: facts at the first call explain a little; wind, fuel moisture, slope and response time explain the rest, and that is the job for live data.

## Design direction

A fire lookout's logbook rather than a dashboard. Pale sage paper, forest-green ink, and one accent, ember orange, which only ever means "escaped." Barlow Condensed for headings (it reads like routed park signage), Source Serif 4 for text, Spline Sans Mono for figures. Decorative topographic lines in the masthead are generated from a seeded noise field (scripts/contours.py) and are labeled in code as not data. No cards with shadows, no gradients, no icons.

## Metric that would show it works

For a tool like this used alongside a copilot: the share of copilot recommendations flagged "extraordinary" that come with a stated live-condition reason, and whether flagged-and-justified calls were better calibrated (lower Brier score) than flagged-and-unjustified ones over a fire season. For the desk alone: each new season, the riskiest tenth by precedent rate should still escape at 2x or more the base rate.

## Out of scope

Live weather, fuel or perimeter data. Any operational use. Causes (the `FireCause` field is mostly "Undetermined").
