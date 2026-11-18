# Ten Acres

What the public record says about a wildfire's first hour, and how to tell when an AI copilot is claiming more than that record supports.

**Live:** https://sheinapribadi-star.github.io/ten-acres/

## The idea in plain English

CAL FIRE's stated goal is to keep 95% of wildfires at 10 acres or less. Most fires stay that small. The few that don't do almost all of the damage: in California from 2022 to 2025, 1,451 of 30,849 sized wildfires (4.7%) got past 10 acres, and they burned 99.3% of the 2.14 million acres.

Ten Acres turns that record into three things:

1. **A ledger** of the goal by year (met in 2022 and 2023, missed narrowly in 2024 and 2025 in this record), plus when in the day and year fires tend to escape.
2. **A precedent desk.** Describe a new fire the way it arrives on the radio (county, month, time reported, first size, land owner) and watch the pool of look-alike past fires narrow, with an escape rate and interval at every step. It stops when fewer than 30 precedents remain and lists the real fires in the pool that got away.
3. **A copilot check.** Enter what an AI copilot claims ("chance this passes 10 acres") and see whether it sits inside the record, needs a stated reason, or is an extraordinary claim.

## Where it came from

[ContainOS](https://devpost.com/software/containos), by Maanit Goel, Kyle Tianshi, Grace Yan and Nathan Zhou, won in the OpenAI Artificial Intelligence Track at [TreeHacks 2026](https://treehacks-2026.devpost.com/). It is a multi-agent copilot for wildfire initial attack whose language-model agents are not allowed to contradict a deterministic physics baseline. Ten Acres takes that idea of bounded reasoning and adds a second, plainer bound: the base rate from thousands of past fires. Full reasoning in [BRIEF.md](BRIEF.md).

## Data sources

| Source | Used for |
| --- | --- |
| [NIFC WFIGS Incident Locations](https://data-nifc.opendata.arcgis.com/datasets/nifc::wfigs-incident-locations) | 77,645 California wildfire records discovered 2020 to 2025, pulled November 18, 2026. The cohort is the 30,849 discovered 2022 to 2025 with a recorded size. |
| [CAL FIRE, What We Do](https://www.fire.ca.gov/what-we-do) | Wording of the 95% at 10 acres goal |
| [ContainOS on Devpost](https://devpost.com/software/containos) | The inspiration and the bounded-copilot framing |

Every number on the site is computed in the browser from `data/bundle.json`, which `scripts/build_data.py` builds from the pull. Fire names, dates and sizes in the precedent list are real public records. There is no example or made-up data. The topographic lines in the header are decorative and generated from noise.

## Method

- **Escaped** means final size (FinalAcres, else IncidentSize) above 10 acres.
- **Cohort** excludes the 42,970 records with no size at all. They are almost all local dispatch records with placeholder sizes, and their outcome is unknown.
- **Intervals** are 95% Wilson intervals.
- **Precedent ladder** filters in a fixed order (county, month, three-hour reporting band, first-size band, land owner) and stops before a pool drops below 30 fires.
- **Holdout test:** ladder rates built from 2022 to 2024, then every 2025 fire scored. AUC 0.63. The riskiest tenth escaped at 12.2% against a 5.9% base and held 21% of escapes; it was a little overestimated (15.0% predicted). Shrinkage, a minimum of 50, and other filter orders all gave 0.63 to 0.65.

## Design decisions

- **A logbook, not a dashboard.** Sage paper, forest ink, condensed signage type. It should feel like something kept at a lookout.
- **One color means one thing.** Ember orange is only ever "escaped."
- **Raw counts beside every rate.** "11 of 59" is easier to trust and to argue with than a model score.
- **Stop out loud.** When the record runs thin, the desk says it is stopping instead of quietly returning a noisy number.
- **Bound the copilot, don't veto it.** The check asks for a reason rather than blocking a claim, because a copilot that sees live wind can be right to depart from history. The thresholds are a stated design choice.
- **Say what the record can't do.** The holdout result is on the page, not buried here.
- **Static and keyless.** One JSON bundle, plain JavaScript, no tracking, served by GitHub Pages.

## The metric that would show it works

Paired with a real copilot over a fire season: the share of "extraordinary" recommendations that come with a stated live-condition reason, and whether justified departures are better calibrated (lower Brier score) than unjustified ones. For the desk alone, the guardrail is that each new season's riskiest tenth still escapes at 2x or more the base rate.

## Limits

This is the interagency record for all agencies, not CAL FIRE's own count, so it will not match CAL FIRE's figures. Many local responses never receive a size and drop out. Six contract counties (Kern, Los Angeles, Marin, Orange, Santa Barbara, Ventura) run their own fire departments and are thinly covered, so their rates lean high; the page flags them. First size is often a placeholder. Associations, not causes. Not for operational use.

## Rebuild

```
python3 scripts/fetch_fires.py     # about 30 seconds, writes data/raw/fires.jsonl (gitignored)
python3 scripts/build_data.py      # writes data/bundle.json and prints the holdout check
python3 scripts/contours.py        # regenerates the decorative header lines
python3 -m http.server             # then open http://localhost:8000
```

Python 3 standard library only.

## Credit

Built by [Sheina Pribadi](https://sheinapribadi-star.github.io/). Wildfire records from the National Interagency Fire Center. Inspired by the ContainOS team credited above. MIT licensed.
