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
- photo URLs: the og:image (1440 wide) first, then any gallery images the fetch returns. Hotlink them; never copy listing photos into the repo.

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

Use these 11 trips, in this order, with these ids, categories and kinds. Research the `candidates`. Each candidate is a Google Places text query, specific enough to land on the right place (for example `SuperValu Thomastown`, not `supermarket`). The page tries every candidate and keeps the fastest drive, so give 1–3.

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

`id, name, address, eircode, lat, lng, listingUrl, status, added, area, agent, price, type, beds, bedsNote, baths, floorM2, atticM2, landHa, landAcres, ber, berKwh, heating, listed, views, stampDuty, tagline, photos[], pros[], cons[], trips[], categories[]`

Notes on the keys:
- `status`: one of `Front-runner`, `Considering`, `Sale agreed`, `Passed`. New houses start as `Considering`.
- `added`: today's date, as YYYY-MM-DD.
- `area`: "Village, Co. County".
- Leave out keys you don't have, such as `atticM2` or `views`, rather than inventing them.
- `tagline`: one plain sentence on what the house is and where.
- `categories`: always `["Schools","Groceries","Eating out","Health","Towns and cities","Getting away"]`.

Then add the id to `properties/index.json`, keeping existing ids and never duplicating one.

Validate before committing:
```bash
cd /home/claude/ireland
python3 -c "import json,sys; d=json.load(open('properties/<id>.json')); assert d['id']=='<id>' and d['lat'] and d['lng'] and len(d['trips'])==11; json.load(open('properties/index.json')); print('ok')"
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

Give the house link (`https://gangeli.github.io/ireland/property.html?p=<id>`) and the index link, plus one line on the ledger: for/against weights and the biggest con. When this runs inside the property sweep, put the link in that house's write-up.

## Updating a house

- Sale agreed, price change, or Gabor passes on it: edit `status` (and `price`, adding a con such as "Price cut from €X" or a pro if relevant), then commit "Update <name>: <what>".
- Never delete a house's file. `Passed` keeps it on the map, greyed, so it isn't re-found.

## Don'ts

- Don't edit `app.js`, `index.js`, `style.css` or the HTML to add a house.
- Don't commit any key other than the browser key already in `config.js`.
- Don't copy listing photos into the repo.
- Don't guess coordinates.
