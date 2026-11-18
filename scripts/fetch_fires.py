"""Pull California wildfire incident records (2020-2025) from the NIFC WFIGS
Incident Locations feature service and write data/raw/fires.jsonl (gitignored)."""
import json, os, time, urllib.parse, urllib.request

URL = ("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
       "WFIGS_Incident_Locations/FeatureServer/0/query")
FIELDS = ["UniqueFireIdentifier", "IncidentName", "FireDiscoveryDateTime",
          "ContainmentDateTime", "ControlDateTime", "FireOutDateTime",
          "DiscoveryAcres", "InitialResponseAcres", "InitialResponseDateTime",
          "IncidentSize", "FinalAcres", "FireCauseGeneral", "FireCause",
          "POOCounty", "POOFips", "POOProtectingAgency", "POOJurisdictionalAgency",
          "POOLandownerCategory", "POOPredictiveServiceAreaID", "GACC",
          "PrimaryFuelModel", "PredominantFuelGroup", "InitialLatitude",
          "InitialLongitude", "IsValid", "IncidentTypeKind", "IsCpxChild"]
WHERE = ("POOState='US-CA' AND IncidentTypeCategory='WF' AND "
         "FireDiscoveryDateTime >= DATE '{a}' AND FireDiscoveryDateTime < DATE '{b}'")

def get(params):
    q = urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(URL + "?" + q, timeout=60) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 + attempt * 3)
    raise RuntimeError("request failed")

os.makedirs("data/raw", exist_ok=True)
n = 0
with open("data/raw/fires.jsonl", "w") as out:
    for y in range(2020, 2026):
        for m in range(1, 13):
            a = f"{y}-{m:02d}-01"
            b = f"{y + (m == 12)}-{(m % 12) + 1:02d}-01"
            off = 0
            while True:
                d = get({"where": WHERE.format(a=a, b=b), "outFields": ",".join(FIELDS),
                         "returnGeometry": "false", "orderByFields": "OBJECTID",
                         "resultOffset": off, "resultRecordCount": 2000, "f": "json"})
                feats = d.get("features", [])
                for f in feats:
                    out.write(json.dumps(f["attributes"]) + "\n")
                n += len(feats)
                if not d.get("exceededTransferLimit") and len(feats) < 2000:
                    break
                off += len(feats)
        print(y, n, flush=True)
print("total", n)
