#!/usr/bin/env python3
"""
Sample the Unsplash Lite dataset into data/sample_images.json.

1) Download Unsplash Lite (~700MB) and unzip it:
     https://github.com/unsplash/datasets  (direct: https://unsplash.com/data/lite/latest)
   You'll get TSV files including photos.tsv000 and keywords.tsv000.
2) Point DATA_DIR at the unzipped folder and run:  python3 scripts/fetch_unsplash.py
"""
import csv, json, os, random, sys
from collections import defaultdict

DATA_DIR = os.environ.get("UNSPLASH_DIR", "./unsplash-lite")
SAMPLE_N = int(os.environ.get("SAMPLE_N", "400"))
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "sample_images.json")

photos_path = os.path.join(DATA_DIR, "photos.tsv000")
keywords_path = os.path.join(DATA_DIR, "keywords.tsv000")
if not os.path.exists(photos_path):
    sys.exit(f"Could not find {photos_path}. Download Unsplash Lite and set UNSPLASH_DIR.")

kw = defaultdict(list)
if os.path.exists(keywords_path):
    with open(keywords_path, encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            pid = row.get("photo_id")
            k = row.get("keyword")
            if pid and k and len(kw[pid]) < 12:
                kw[pid].append(k)

rows = []
with open(photos_path, encoding="utf-8") as f:
    for row in csv.DictReader(f, delimiter="\t"):
        pid = row.get("photo_id")
        url = row.get("photo_image_url")
        if not pid or not url:
            continue
        desc = row.get("photo_description") or row.get("ai_description") or ""
        rows.append({
            "id": pid,
            # request a reasonable size from the Unsplash image URL
            "url": url + "?w=400&h=300&fit=crop",
            "description": desc.strip(),
            "keywords": kw.get(pid, []),
        })

random.seed(42)
sample = random.sample(rows, min(SAMPLE_N, len(rows)))
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(sample, f, indent=2)
print(f"wrote {len(sample)} images to {OUT}")
