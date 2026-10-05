# House Days

"A day in the life" pages for Irish property listings: the ledger of pros and cons, the plot from above, and ride-along Street View drives to the school, shops, hospital, Dublin and Cork.

- Live: https://gangeli.github.io/ireland/ (map and list of the shortlist) and `property.html?p=<id>` for each house
- Add a house: write `properties/<id>.json` (copy `forty-shades.json`) and add the id to `properties/index.json`. The `house-days` skill in `.claude/skills/` does this end to end.
- Setup: `./setup/gcp-setup.sh` (idempotent; creates/links the GCP project, enables APIs, syncs a referrer-restricted browser key, sets a budget, writes `config.js`)
- Everything live (places, traffic-aware drive times, Street View frames) is fetched in the browser. Resolved trips are cached in localStorage for a week.

## Ratings

Anyone on the site can rate a house (1–5 stars and a note) under a name. Ratings sync through a small public Cloud Function backed by Firestore; set it up with `bash setup/ratings-setup.sh` (idempotent). Until it's deployed, ratings are kept in each browser and pushed up automatically once the service answers.

## Daily sweep

A scheduled Claude sweep keeps the shortlist to the top 20 houses: it adds new finds, updates prices and status, and retires sold or low-rated houses to `properties/archive.json` (house files are never deleted). People's ratings outrank the AI score. Every run is logged in `log/sweep-log.md`, and a raw snapshot of the ratings goes to `log/ratings/`. The procedure is in `SWEEP.md`.
