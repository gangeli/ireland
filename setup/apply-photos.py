#!/usr/bin/env python3
"""Apply curated Daft photo picks to property files.

Input: a picks file with blocks like
  # <property-id>
  role|image-key|signature|gravity(e/w)|watermark-size
  |image-key|signature|e|3          (no role = extra photo)
Daft image URLs are base64 settings + a signature, so they're rebuilt from the short form.
The listing's photos are replaced by the picks, in order: roled photos first, then extras.
"""
import base64, json, sys, pathlib

def daft_url(key, sig, grav, small="3", w=1440, h=960):
    o = {"bucket": "mediamaster-s3eu", "edits": {"overlayWith": {"bucket": "mediamaster-s3eu",
         "options": {"gravity": "southeast" if grav == "e" else "southwest"},
         "key": f"watermark-daft-logo-small{small}-v4.png"}, "resize": {"fit": "cover", "width": w, "height": h}},
         "outputFormat": "jpeg", "key": key}
    s = json.dumps(o, separators=(",", ":")).replace("/", "\\/")
    return "https://media.daft.ie/" + base64.b64encode(s.encode()).decode() + "?signature=" + sig

root = pathlib.Path(__file__).resolve().parent.parent
blocks, cur = {}, None
for line in open(sys.argv[1]):
    line = line.strip()
    if not line: continue
    if line.startswith("#"): cur = line[1:].strip(); blocks[cur] = []; continue
    role, key, sig, grav, small = line.split("|")
    blocks[cur].append({"url": daft_url(key, sig, grav, small), **({"role": role} if role else {})})
for pid, photos in blocks.items():
    p = root / "properties" / f"{pid}.json"
    d = json.loads(p.read_text())
    d["photos"] = sorted(photos, key=lambda x: 0 if x.get("role") else 1)
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    print(pid, [x.get("role", "extra") for x in d["photos"]])
