# House Days

"A day in the life" pages for Irish property listings: the ledger of pros and cons, the plot from above, and ride-along Street View drives to the school, shops, hospital, Dublin and Cork.

- Live: https://gangeli.github.io/ireland/ (one page per property: `?p=<id>`, data in `properties/<id>.json`)
- Setup: `./setup/gcp-setup.sh` (idempotent; creates/links the GCP project, enables APIs, syncs a referrer-restricted browser key, sets a budget, writes `config.js`)
- Everything live (places, traffic-aware drive times, Street View frames) is fetched in the browser. Resolved trips are cached in localStorage for a week.
