#!/usr/bin/env python3
"""
Generate image embeddings for data/sample_images.json -> data/embeddings.json
({ "<id>": [float, ...] }).

This is a starting point. Swap in whatever model or API your design calls for.
Default uses CLIP via sentence-transformers over the image URLs.

  pip install sentence-transformers pillow requests
  python3 scripts/generate_embeddings.py

Then wire these vectors into backend/handler.js and embed the query the same way.
"""
import io, json, os, sys

HERE = os.path.dirname(__file__)
IN = os.path.join(HERE, "..", "data", "sample_images.json")
OUT = os.path.join(HERE, "..", "data", "embeddings.json")

try:
    import requests
    from PIL import Image
    from sentence_transformers import SentenceTransformer
except ImportError:
    sys.exit("Install deps first: pip install sentence-transformers pillow requests")

items = json.load(open(IN, encoding="utf-8"))
model = SentenceTransformer("clip-ViT-B-32")  # text and image share an embedding space

vectors = {}
for i, it in enumerate(items):
    try:
        img = Image.open(io.BytesIO(requests.get(it["url"], timeout=20).content)).convert("RGB")
        vectors[it["id"]] = model.encode(img).tolist()
    except Exception as e:
        print(f"skip {it['id']}: {e}")
    if (i + 1) % 25 == 0:
        print(f"{i + 1}/{len(items)}")

json.dump(vectors, open(OUT, "w"), indent=0)
print(f"wrote {len(vectors)} embeddings to {OUT}")
print("Query side: model.encode('your text query') gives a comparable vector; rank by cosine similarity.")
