# Demo queries

The fixed query set for development checks, `/finalize`, and the demo. Results are from 406 images: the
400-image Unsplash sample (`make dataset` samples with a fixed seed, so it reproduces) plus 6 hand-picked
images. Each was judged by looking at the images, not the captions. Queries are embedded as typed (decision 9).

| # | Shows | Query | Top 3 (score, caption) | What to say |
| --- | --- | --- | --- | --- |
| 1 | Object | `a dog` | 0.275 a dog laying in the snow with a stick · 0.261 medium-coated tan dog · 0.261 white and black dog on snow field | 5 of the top 5 are dogs. |
| 2 | Scene | `snowy mountains` | 0.302 snow covered mountain with pine trees · 0.300 Craggy mountains against cloudy sky · 0.298 snow covered trees | 5 of 5 are snowy mountains. |
| 3 | Mood | `a cozy moment` | 0.270 brown short coated dog on gray textile · 0.251 coffee · 0.247 Bible with flowers, tea, heart, and candle | A feeling, not an object: a dog in a blanket, a steaming mug, tea and a book. |
| 4 | Paraphrase | `man's best friend` | 0.287 person holding dog · 0.278 medium-coated tan dog · 0.278 a dog laying in the snow with a stick | 5 of 5 are dogs, and no top-5 caption or keyword shares a word with the query. Keyword search returns nothing here. |
| 5 | No good match | `a spaceship cockpit` | 0.244 rainy day · 0.237 blue sky with stars during night time · 0.227 blue galaxy | Ranking is relative, so the closest images still return: a car windshield, then night skies. Real matches score about 0.27–0.30, so the gap is small, which is why `minScore` needs calibration (decision 12). |
| 6 | CLIP weakness | `a beach with no people` | 0.282 Stopped on the way home from Palo Alto · 0.276 Ust-Barguzin, Republic of Buryatia · 0.274 person walking on beach viewing island | Negation fails: 2 of the top 5 show a person. CLIP folds "no people" into one vector that still contains *people*. A fix would parse the negation or re-rank. |

Optional extra scene: `where the land meets the sea` (5 of 5 coastlines).

**Avoid in the demo:** `a city skyline`, `a city street at night`, `a hot drink`, `something to eat for dinner`. The
sample holds few such images, so results after the first one or two drift off-topic.

## Prompt template test (decision 9)

Fifteen queries were run raw and as `"a photo of " + query`. The template raised every score, including the
no-match query, so scores aren't comparable across variants; only the ranking was judged. The template was
better on 1 query (`a city skyline`), worse on 2 (`something to eat for dinner` lost its only relevant image;
`waves on the sand` swapped a wave for plain sand), and tied on 12. Queries stay raw.
