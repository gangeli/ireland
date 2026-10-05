---
name: house-days
description: Build or update a "day in the life" page for an Irish property listing on Gabor's shortlist site (gangeli/ireland on GitHub Pages). Use when the property sweep finds a house worth a look, when Gabor asks for a page for a Daft/MyHome listing, or to change a listed house's status.
---

# House Days: a page per shortlisted house

The site lives in the public repo `gangeli/ireland`, served by GitHub Pages:

- Index (map and list of every house): https://gangeli.github.io/ireland/
- One house: https://gangeli.github.io/ireland/property.html?p=<id>

Each house is a single data file, `properties/<id>.json`, plus its id in `properties/index.json`. The page code (`property.html`, `app.js`, `index.html`, `index.js`, `style.css`) is shared; don't edit it to add a house. Everything live (places, traffic-aware drive times, Street View ride-alongs) is fetched by the viewer's browser with the referrer-locked key in `config.js`. You only write data.

Your workspace usually cannot reach Google Maps or Daft directly from the shell. Use WebFetch/WebSearch for research and git for publishing.

## 1. Get the repo

Call `add_repo` with owner `gangeli`, repo `ireland`, access `push`, then clone it once:
`git clone --depth 1 https://github.com/gangeli/ireland /home/claude/ireland`.
If the clone already exists, `git -C /home/claude/ireland pull --ff-only`.

## 2. Read the listing

WebFetch the Daft or MyHome URL. Pull out:

- name (the house name, or the first line of the address), full address, Eircode
- lat/lng: on Daft, from the "Satellite View" link (`google.com/maps?t=k&q=<lat>,<lng>`); otherwise geocode the Eircode with a web search. Get this right; every trip starts here.
- price, type, beds (+ any convertible room), baths, floor area m², land (ha and acres; 1 ha = 2.471 ac), BER and kWh/m²/yr, heating, date listed, views
- stamp duty: 1% of price up to €1m
- photos: see "Pick the photos and floor plan" below.
- the agent's email address, if the listing or the agency's site shows it publicly (`agentEmail`).

## 2b. Pick the photos and floor plan (in a browser)

Daft only shows its lead photo to a plain fetch, and its image host is blocked from the cloud workspace. So photo picking runs in a browser on Gabor's computer: the built-in browser if its tools are present, otherwise Claude in Chrome. Read that browser's skill first. If no browser is available (for example in an unattended cloud run), keep the og:image as the only photo with `role: "facade"`, note in your report that photos and the floor plan still need a browser pass, and carry on.

1. Open the Daft listing. The full gallery is in the page's data: `JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps.listing.media.images`. Each item has `size1440x960`, `size1200x1200` and `size360x240` URLs. A "View Floor Plan" button on the page means the listing has a plan, usually among the last images.
2. Build a contact sheet so you can look at every photo at once: overlay a fixed full-screen grid of the `size360x240` thumbnails, each labelled with its index, wait about 4 seconds for them to load, and screenshot it. Render any thumbnail that looks blank, or any candidate you're unsure about, at full size (`size1200x1200`) before deciding.
3. Choose by eye, one per role:
   - `facade`: the front of the house, in daylight, the whole building visible.
   - `garden`: the grounds or back garden, ideally showing how much land there is.
   - `interior`: the one room that best represents the house (usually the main living room or the kitchen).
   - `floorplan`: every floor-plan sheet, in floor order (ground first).
   - `siteplan`: a boundary map or marked-up aerial, if there is one.
   - Two or three extras without a role (an aerial, the kitchen, an outbuilding).
   Skip agent promo images (stock trains, schools, logos) and anything labelled as a projection or a CGI.
4. Read the floor plan, not just the listing text, for the ground-floor bedroom question. The plans have overturned the listing more than once (Kilcoltrim and Bluebell Lodge both turned out to have one).
5. Daft image URLs are base64 settings plus a signature. To keep them short, read back each pick as `role|key|signature|gravity|size`, where `key` is the decoded `key`, gravity is the 6th letter of the watermark gravity (`e` or `w`) and size is the digit in `watermark-daft-logo-small<N>`. In page JavaScript:
   `const m=JSON.parse(atob(u.slice(22).split('?')[0])); [role, m.key, u.split('signature=')[1], m.edits.overlayWith.options.gravity[5], m.edits.overlayWith.key.match(/small(\d)/)[1]].join('|')`
   Write the lines into a picks file under a `# <id>` header and run `python3 setup/apply-photos.py <picks-file>`, which rebuilds the exact URLs and writes them into the property file.

If Daft has no floor plan, check the same house on MyHome and the agent's own site before giving up. The page shows an "Ask the agent" card when there's no plan.

## 3. Write the ledger against the brief

Read the memory file for the Ireland property search for the current brief. As of Oct 2026, the brief covers:
- budget
- land for the dogs
- strong schools nearby
- 24-hour ED access
- train to Dublin
- 140–280 m²
- a ground-floor bedroom for Gabor's parents
- a walkable village, or properly rural
- rental use when the family's away

Write 5–8 pros and 5–8 cons. Each one gets:
- `text`: a short headline
- `weight`: 1–3, for how much it matters to the brief
- `detail`: one sentence with the specific numbers

Rules for the ledger:
- Be honest. Flag unknowns as cons: water/septic, ground-floor bedroom unconfirmed, flood history, planning.
- Label rough cost estimates as rough.
- Quantify: km, minutes, €, m².
- No hype words.

## 4. Pick the trips

Use these 11 trips, in this order, with these ids, categories and kinds. Every house needs both grocery trips: the nearest small shop (often a Centra, Spar, Londis or Mace, and in many villages at the filling station) and the nearest proper supermarket. For each one, search the village name with shop, Centra, Spar, Londis, Mace, Costcutter and filling station before concluding it has no shop. Research the `candidates`. Each candidate is a Google Places text query, specific enough to land on the right place (for example `SuperValu Thomastown`, not `supermarket`). Include the brand and the town, and the county if the town name is common (for example `Mace Inver Freshford, Co. Kilkenny`). If none of your candidates match, the page falls back to a map search for the nearest place of the right type, but named candidates give better results. The page tries every candidate and keeps the fastest drive, so give 1–3.

| id | category | kind | how to choose |
|---|---|---|---|
| school | Schools | Primary school | Nearest national school (Daft's "Local schools" table gives distance and pupils). Name 1–2 fallbacks in the note. |
| shop | Groceries | Village shop | Nearest village shop/post office or Centra/Spar/Londis. |
| bigshop | Groceries | Supermarket | Nearest SuperValu/Dunnes/Tesco/Lidl/Aldi; 2–3 candidates. |
| dinner | Eating out | Restaurant | Best-reviewed food pub or restaurant nearby (Tripadvisor). |
| hospital | Health | Emergency department | The two nearest 24-hour EDs. Check ED status with a search when unsure. Candidates include St Luke's Kilkenny, University Hospital Waterford, Tipperary University Hospital Clonmel, University Hospital Limerick, Midland Regional Hospital Tullamore, Midland Regional Hospital Portlaoise, Regional Hospital Mullingar, Naas General, Wexford General, Our Lady of Lourdes Drogheda, and the Dublin hospitals. |
| town | Towns and cities | Small town | Nearest proper market town. |
| city | Towns and cities | City | Nearest city (Kilkenny, Waterford, Limerick, Carlow…); give 2 if close. |
| dublin | Towns and cities | Capital | `St Stephen's Green, Dublin` |
| cork | Towns and cities | City | `English Market, Cork` |
| train | Getting away | Station | Nearest station with direct Dublin trains. Put the line and train time in the note. |
| airport | Getting away | Airport | `Dublin Airport` |

Each trip also has:
- `when` ("HH:MM"): a realistic departure time, used only for the traffic forecast. Use 08:20 school, 09:15 shop, 10:30 bigshop, 12:30 town, 15:00 city, 19:00 dinner, 03:00 hospital, 07:15 train, 06:00 airport, 09:30 dublin/cork.
- `group`: `weekday`, `further` or `night`. Use `night` for hospital and `further` for train/airport/dublin/cork.
- `day`: optional, `friday` or `saturday`. Use friday for airport and saturday for dublin/cork.
- `title`: a friendly name shown before the place resolves.
- `label`: a short purpose, such as "School run".
- `note`: one sentence. Leave it empty rather than padding it.

## 5. Write the file

`id` is a lowercase slug of the house name plus the townland or village, for example `forty-shades` or `old-station-house-monasterevin`. Copy the shape of `properties/forty-shades.json` exactly, with these top-level keys:

`id, name, address, eircode, lat, lng, listingUrl, status, added, area, agent, agentEmail, agentPhone, questions[], ai, services, groundFloorBedroom, price, type, beds, bedsNote, baths, floorM2, atticM2, landHa, landAcres, ber, berKwh, heating, listed, views, stampDuty, tagline, photos[], pros[], cons[], trips[], categories[]`

Notes on the keys:
- `status`: `Considering` for any house that's still on the market, or `Sale agreed` / `Passed` once it isn't. The index works out Front-runner, Strong contender, Considering and Long shot itself, from the AI score and people's ratings, so don't set those.
- `added`: today's date, as YYYY-MM-DD.
- `area`: "Village, Co. County".
- Leave out keys you don't have, such as `atticM2` or `views`, rather than inventing them.
- `tagline`: one plain sentence on what the house is and where.
- `categories`: always `["Schools","Groceries","Eating out","Health","Towns and cities","Getting away"]`.
- `questions`: 3–5 questions for the agent that are specific to this house: the unknowns and risks in your cons, such as floor area, site boundaries, ground-floor bedroom, BER, protected-structure status or radon. The page's "Email the agent" button opens a draft with these first, followed by a standard set: availability and offers, water and septic, broadband, title and planning, flooding, and a remote viewing. So don't repeat those.
- `agentEmail` and `agentPhone`: optional; include them when the listing or the agency's site shows them publicly.
- `services`: one entry each for `electricity`, `water`, `sewer` and `internet`, as `{ "status": ..., "detail": ... }`. Status is `ok` (stated and good: mains, fibre, connected), `check` (stated but worth checking: septic tank, private well), `likely` (not stated but strongly implied, such as mains in a town centre) or `unknown`. Start `detail` with the conclusion, because the page shows its first phrase: "Mains", "Own septic tank", "Eir fibre, 1 Gb", "Probably mains; not stated (town centre)", "Unknown; not stated". Search the listing description and features for mains, well, septic, treatment unit, drainage, broadband, fibre, ESB and solar; the features list often has them even when the description doesn't.
- `groundFloorBedroom`: `{ "status": "ok" | "check" | "issue" | "unknown", "detail": "one sentence naming the room" }`. `ok` = a real bedroom downstairs (or a single-storey annex), `check` = a room that could convert, `issue` = nothing workable, `unknown` = no plan and the listing doesn't say.
- `ai`: `{ "stars": 1–5 in half steps, "why": "one or two short sentences" }`. This is your own judgement of fit with the brief, shown on the index next to the people's average, so make it comparable across houses. Read a few existing files to calibrate: Forty Shades is 4.5, the shortlist's benchmark; a house that badly misses the size or the ground-floor bedroom requirement scores 2–2.5.

Then add the id to `properties/index.json`, keeping existing ids and never duplicating one.

Validate before committing:
```bash
cd /home/claude/ireland
python3 -c "import json,sys; d=json.load(open('properties/<id>.json')); assert d['id']=='<id>' and d['lat'] and d['lng'] and len(d['trips'])==11 and set(d['services'])=={'electricity','water','sewer','internet'} and d['groundFloorBedroom']['status']; json.load(open('properties/index.json')); print('ok')"
```

## 6. Publish

```bash
cd /home/claude/ireland
git add properties/
git commit -m "Add <name>, <area>" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin HEAD:main
git ls-remote --exit-code origin gh-pages >/dev/null 2>&1 && git push -f origin HEAD:gh-pages
```
If the push is rejected, `git pull --rebase origin main` and push again. Pages rebuilds in about a minute.

## 7. Report

Give the house link (`https://gangeli.github.io/ireland/property.html?p=<id>`) and the index link, plus one line on the ledger: for/against weights and the biggest con. When this runs inside the property sweep, the site page is **the** link for that house in the write-up. Don't link Daft or MyHome for a house that has a page; the page links to the listing itself. Only near misses without a page get a listing link.

People who turned on the bell on the shortlist get a browser notification about each new house automatically (the ratings function checks `index.json` every 30 minutes). After pushing, WebFetch `<HOUSE_DAYS_RATINGS_URL>?action=check` to send it straight away; if that fails, say so and move on.

## Updating a house

- Sale agreed, price change, or Gabor passes on it: edit `status` (and `price`, adding a con such as "Price cut from €X" or a pro if relevant), then commit "Update <name>: <what>".
- Never delete a house's file. `Passed` keeps it on the map, greyed, so it isn't re-found.

## Ratings

People rate houses on the site itself, and those ratings sync through a small Cloud Function (`setup/ratings-setup.sh`). There's nothing to do for them when adding a house. To read the current ratings, use the URL in `config.js`; GET returns them all.

## Don'ts

- Don't edit `app.js`, `index.js`, `style.css` or the HTML to add a house. If you ever do change those, run `setup/stamp.sh` before committing, so browsers don't mix cached old scripts with the new page.
- Don't commit any key other than the browser key already in `config.js`.
- Don't copy listing photos into the repo.
- Don't guess coordinates.
