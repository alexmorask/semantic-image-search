# Data

## `sample_images.json`
Placeholder photos (from picsum.photos) with themed captions so the pipeline runs and the
naive search returns something. The images are not semantically matched to their captions,
so use this only to smoke-test the end-to-end path.

Schema (one object per image):
```
{ "id": "img-10", "url": "https://...", "description": "a photo of mountain", "keywords": ["mountain","peak",...] }
```

## Real dataset: Unsplash Lite
25,000 photos with real keywords, cleared for commercial and noncommercial use.
- Source: https://github.com/unsplash/datasets  (direct: https://unsplash.com/data/lite/latest, ~700MB)
- Unzip it, then: `UNSPLASH_DIR=./unsplash-lite make dataset` (see `scripts/fetch_unsplash.py`).
  This writes `data/unsplash_sample.json`, which is git-ignored.
- Load it with `make ingest`, which calls `POST /images` for every image.
- Never commit the sample: the dataset terms forbid publishing or redistributing any portion of it.

Alternatives: COCO val2017 (~5k images with captions, files included) or Flickr8k (8k images, five captions each).
