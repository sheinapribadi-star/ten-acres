"""Build data/bundle.json from data/raw/fires.jsonl.

Cohort: California wildfires (WFIGS IncidentTypeCategory = WF) discovered
2022-01-01 to 2025-12-31 Pacific time that carry a recorded size
(FinalAcres, else IncidentSize). "Escaped" means final size above 10 acres.
Also prints a holdout check of the precedent ladder (fit 2022-2024, score 2025).
"""
import json, math, collections as C, datetime as D
from zoneinfo import ZoneInfo

LA = ZoneInfo("America/Los_Angeles")
MIN_N = 30
FED = {"USFS", "BLM", "NPS", "BIA", "USFWS", "DOD", "BOR", "OthFed"}
LOCAL = {"State", "City", "County", "OthLoc"}
CONTRACT = {"Kern", "Los Angeles", "Marin", "Orange", "Santa Barbara", "Ventura"}

def size_band(a):
    if a is None: return 4
    if a < 0.25: return 0
    if a < 1: return 1
    if a <= 10: return 2
    return 3

def land(c):
    if c == "Private": return 0
    if c in FED: return 1
    if c in LOCAL: return 2
    return 3

rows = []
for line in open("data/raw/fires.jsonl"):
    r = json.loads(line)
    s = r["FinalAcres"] if r["FinalAcres"] is not None else r["IncidentSize"]
    if s is None:
        continue
    t = D.datetime.fromtimestamp(r["FireDiscoveryDateTime"] / 1000, LA)
    if not 2022 <= t.year <= 2025:
        continue
    rows.append(dict(id=r["UniqueFireIdentifier"], name=(r["IncidentName"] or "").strip().title(),
                     t=t, s=float(s), county=r["POOCounty"] or "Unknown",
                     band=size_band(r["DiscoveryAcres"]), land=land(r["POOLandownerCategory"]),
                     disc=r["DiscoveryAcres"]))
rows.sort(key=lambda r: r["t"])
for r in rows:
    r["e"] = int(r["s"] > 10)
    r["m"] = r["t"].month - 1
    r["h"] = r["t"].hour // 3

counties = sorted({r["county"] for r in rows})
ci = {c: i for i, c in enumerate(counties)}

def wilson(k, n, z=1.96):
    if n == 0: return (0, 0, 1)
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (p, max(0, c - h), min(1, c + h))

N = len(rows); K = sum(r["e"] for r in rows)
acres = sum(r["s"] for r in rows); esc_acres = sum(r["s"] for r in rows if r["e"])

years = []
for y in range(2022, 2026):
    g = [r for r in rows if r["t"].year == y]
    years.append(dict(year=y, n=len(g), held=sum(1 - r["e"] for r in g),
                      acres=round(sum(r["s"] for r in g)),
                      escAcres=round(sum(r["s"] for r in g if r["e"]))))

heat = [[[0, 0] for _ in range(8)] for _ in range(12)]
for r in rows:
    heat[r["m"]][r["h"]][0] += 1
    heat[r["m"]][r["h"]][1] += r["e"]

big = sorted(rows, key=lambda r: -r["s"])
top = [dict(name=r["name"], date=r["t"].strftime("%Y-%m-%d"), county=r["county"], acres=round(r["s"]))
       for r in big[:10]]
conc = {str(n): round(sum(r["s"] for r in big[:n]) / acres, 4) for n in (1, 10, 100, K)}

# columnar compact rows for the in-browser precedent ladder
enc = lambda v: "".join(chr(48 + x) for x in v)
cols = dict(c=enc([ci[r["county"]] for r in rows]), m=enc([r["m"] for r in rows]),
            h=enc([r["h"] for r in rows]), z=enc([r["band"] for r in rows]),
            l=enc([r["land"] for r in rows]), e=enc([r["e"] for r in rows]))
escapes = [[i, r["name"], r["t"].strftime("%Y-%m-%d %H:%M"), round(r["s"], 1)]
           for i, r in enumerate(rows) if r["e"]]

bundle = dict(
    meta=dict(pulled="2026-11-18", source="NIFC WFIGS Incident Locations", n=N, escaped=K,
              acres=round(acres), escAcres=round(esc_acres), minN=MIN_N,
              rawTotal=sum(1 for _ in open("data/raw/fires.jsonl"))),
    counties=counties, contract=sorted(CONTRACT), years=years, heat=heat, top=top, conc=conc,
    cols=cols, escapes=escapes)

# ---------- holdout: ladder fit on 2022-2024, scored on 2025 ----------
ORDER = ["county", "m", "h", "band", "land"]
train = [r for r in rows if r["t"].year < 2025]; test = [r for r in rows if r["t"].year == 2025]

def ladder(pool, r):
    cur = pool; p = sum(x["e"] for x in cur) / len(cur)
    for f in ORDER:
        nxt = [x for x in cur if x[f] == r[f]]
        if len(nxt) < MIN_N: break
        cur = nxt; p = sum(x["e"] for x in cur) / len(cur)
    return p

# speed: index by full keys progressively via dict caches
cache = {}
def fast(r):
    key = tuple(r[f] for f in ORDER)
    if key not in cache: cache[key] = ladder(train, r)
    return cache[key]
pred = [(fast(r), r["e"]) for r in test]
base = sum(r["e"] for r in train) / len(train)

def auc(pairs):
    pairs = sorted(pairs, key=lambda x: x[0])
    ranks = {}; i = 0
    while i < len(pairs):
        j = i
        while j < len(pairs) and pairs[j][0] == pairs[i][0]: j += 1
        for k in range(i, j): ranks[k] = (i + j + 1) / 2
        i = j
    pos = [ranks[k] for k, (_, y) in enumerate(pairs) if y]
    npos = len(pos); nneg = len(pairs) - npos
    return (sum(pos) - npos * (npos + 1) / 2) / (npos * nneg)

brier = sum((p - y) ** 2 for p, y in pred) / len(pred)
brier0 = sum((base - y) ** 2 for _, y in pred) / len(pred)
srt = sorted(pred, key=lambda x: -x[0]); d = len(srt) // 10
topd = srt[:d]
print(f"cohort {N} fires, {K} escaped ({K/N:.2%}), escapes burned {esc_acres/acres:.2%} of {acres:,.0f} acres")
print("years", years)
print("top", top[:5], conc)
print(f"holdout 2025: n={len(test)} esc={sum(y for _,y in pred)} AUC={auc(pred):.3f} "
      f"Brier={brier:.4f} vs base {brier0:.4f}; top decile rate {sum(y for _,y in topd)/d:.3f} "
      f"(pred {sum(p for p,_ in topd)/d:.3f}) captures {sum(y for _,y in topd)/sum(y for _,y in pred):.1%} of escapes; base {sum(y for _,y in pred)/len(pred):.3f}")
# deciles calibration
for q in range(10):
    g = srt[q*d:(q+1)*d] if q < 9 else srt[9*d:]
    print(q, round(sum(p for p,_ in g)/len(g),3), round(sum(y for _,y in g)/len(g),3))

bundle["meta"]["holdout"] = dict(n=len(test), escaped=sum(y for _, y in pred), auc=round(auc(pred), 3),
    trainRate=round(base, 4), testRate=round(sum(y for _, y in pred) / len(pred), 4),
    topRate=round(sum(y for _, y in topd) / d, 4), topPred=round(sum(p for p, _ in topd) / d, 4),
    topCapture=round(sum(y for _, y in topd) / sum(y for _, y in pred), 4),
    brier=round(brier, 5), brierBase=round(brier0, 5))
json.dump(bundle, open("data/bundle.json", "w"), separators=(",", ":"))
print("wrote data/bundle.json", bundle["meta"]["holdout"])
