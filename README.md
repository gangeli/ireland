# House Days

"A day in the life" pages for Irish property listings: the ledger of pros and cons, the plot from above, and ride-along Street View drives to the school, shops, hospital, Dublin and Cork.

- Live: https://gangeli.github.io/ireland/ (map and list of the shortlist) and `property.html?p=<id>` for each house
- Add a house: write `properties/<id>.json` (copy `forty-shades.json`) and add the id to `properties/index.json`. The `house-days` skill in `.claude/skills/` does this end to end.
- Setup: `./setup/gcp-setup.sh` (idempotent; creates/links the GCP project, enables APIs, syncs a referrer-restricted browser key, sets a budget, writes `config.js`)
- Everything live (places, traffic-aware drive times, Street View frames) is fetched in the browser. Resolved trips are cached in localStorage for a week.
