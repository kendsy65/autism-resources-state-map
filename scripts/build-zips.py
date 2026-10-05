"""Build data/<STATE>/zips.json from the GeoNames US postal code file.

Source: https://download.geonames.org/export/zip/US.zip (CC BY 4.0, credit geonames.org)
Usage:  python3 scripts/build-zips.py path/to/US.txt
Output: {"01060": ["Northampton", "Hampshire", 42.3251, -72.6412], ...}  (place, county, lat, lon)
"""
import csv, json, sys
from pathlib import Path

STATES = ["CT", "MA", "NY"]
src = sys.argv[1]
out = {s: {} for s in STATES}
for r in csv.reader(open(src, encoding="utf-8"), delimiter="\t"):
    if r[4] in out:
        out[r[4]][r[1]] = [r[2], r[5], round(float(r[9]), 4), round(float(r[10]), 4)]
for s, z in out.items():
    p = Path(__file__).resolve().parent.parent / "data" / s / "zips.json"
    p.write_text(json.dumps(dict(sorted(z.items())), separators=(",", ":")))
    print(s, len(z), "ZIPs ->", p)
