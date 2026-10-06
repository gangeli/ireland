---
name: house-days
description: Build or update a "day in the life" page for an Irish property listing on Gabor's shortlist site (gangeli/ireland on GitHub Pages). Use when the property sweep finds a house worth a look, when Gabor asks for a page for a Daft/MyHome listing, or to change a listed house's status.
---

# House Days: a page per shortlisted house

The site lives in the public repo `gangeli/ireland`, served by GitHub Pages:

- Index (map and list of every house): https://gangeli.github.io/ireland/
- One house: https://gangeli.github.io/ireland/property.html?p=<id>

Each house is a single data file, `properties/<id>.json`, plus its id in `properties/index.json`. The page code (`property.html`, `app.js`, `index.html`, `index.js`, `ratings.js`, `alerts.js`, `style.css`) is shared; don't edit it to add a house. Everything live (places, traffic-aware drive times, Street View ride-alongs, the hero map to the nearest city, ratings) is fetched by the viewer's browser. You only write data.

The page does these on its own from your data, so you don't need to do anything for them: the hero (house photo + map zoomed to the nearest major city), the stats strip, the ledger balance bar, the floor-plan section and lightbox, the services panel, the trip cards with ride-alongs, the "Email the agent" draft, the index pin colours and labels, and new-house alerts to people who opted in.

Your workspace usually cannot reach Google Maps or Daft from the shell. Use WebFetch/WebSearch for research, the browser for Daft's own data, and git for publishing.

## 1. Get the repo

Call `add_repo` with owner `gangeli`, repo `ireland`, access `push`, then clone it once:
`git clone --depth 1 https://github.com/gangeli/ireland /home/claude/ireland`.
If the clone already exists, `git -C /home/claude/ireland pull --ff-only`. If this file in the repo (`.claude/skills/house-days/SKILL.md`) is newer than the installed skill, follow the repo copy.

## 2. Read the listing

The reliable source is Daft's own page data, not a WebFetch summary. **WebFetch summaries drop the features list**, which is where Daft listings state water, septic, heating and broadband. In the overnight critique, three subagents "corrected" Forty Shades and Stone Lodge to "services not stated" when the features list stated them plainly. So:

- With a browser (built-in browser, else Claude in Chrome; read that browser's skill first), open any daft.ie page and run in page JavaScript:
  `const h=await fetch('<listing path>').then(r=>r.text()); const L=JSON.parse(h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]).props.pageProps.listing;`
  Then read `L.description`, `L.features`, `L.ber` (`rating`, `epi`), `L.floorArea`, `L.price`, `L.media.images`, `L.point`.
- Without a browser, WebFetch the listing and ask it to **quote the features list verbatim**, not summarise it. Treat "not stated" from a summary as unverified.

Pull out:
- name (the house name, or the first line of the address), full address, Eircode
- lat/lng: on Daft, from the "Satellite View" link (`google.com/maps?t=k&q=<lat>,<lng>`) or `L.point`; otherwise geocode the Eircode. Get this right; every trip starts here.
- price, type, beds (+ any convertible room), baths, floor area m², land (ha and acres; 1 ha = 2.471 ac), BER letter **and** kWh/m²/yr, heating, date listed (`listed`, YYYY-MM-DD; the index shows "listed 12d ago"), views
- stamp duty: 1% of price up to €1m
- the agent's email/phone if shown publicly.

Sanity checks on the numbers (each of these was wrong on a live page):
- **An implausible m² is usually sq ft.** Castleinch's "1,015 m²" bungalow is 1,015 sq ft ≈ 94 m². Divide by 10.76.
- **Derive the BER band from the kWh figure** and check the letter: 200–225 kWh/m²/yr is C3. Tobinstown was filed as B; the listing said C3.
- **No floor area stated?** Sum the room dimensions and use that one number everywhere (ledger, AI blurb, questions). Kilcoltrim said 75 m² in one place and 85 m² in another.
- **Read room sizes, not just m².** A 2.7 × 2.1 m kitchen (Old Forge) changes the budget.
- **"Wired for cable television" is boilerplate**, not broadband.
- **BER "Exempt" on a house for sale nearly always means a protected structure.** Search buildingsofireland.ie (NIAH) for the house name and town. A Regional rating usually means it's on the county Record of Protected Structures. Put it in the cons and the questions.
- "Zoned residential" or "designated for development" in the listing means the fields around it are probably zoned too. Check the Local Area Plan before praising the open setting (Leavalley sits by Leixlip's planned 1,350-home Confey development).
- BuyerIQ (`buyeriq.ie/property/<address-eircode>`) gives a free flood-zone distance, plus broadband and radon flags, per address. Fetch it for every house.

## 2b. Pick the photos and floor plan (in a browser)

Daft only shows its lead photo to a plain fetch, and its image host is blocked from the cloud workspace. If no browser is available (for example in an unattended cloud run), keep the og:image as the only photo with `role: "facade"`, say in your report that photos and the floor plan still need a browser pass, and carry on.

1. The full gallery is `L.media.images`. Each item has `size1440x960`, `size1200x1200` and `size360x240` URLs. A "View Floor Plan" button means the listing has a plan, usually among the last images.
2. Build a contact sheet: overlay a fixed full-screen grid of the `size360x240` thumbnails, each labelled with its index, wait about 4 seconds, and screenshot it. Render any blank-looking thumbnail (they're often just slow) or uncertain candidate at full size before deciding.
3. Choose by eye, one per role:
   - `facade`: the front of the house, in daylight, the whole building visible.
   - `garden`: the grounds or back garden, ideally showing how much land there is.
   - `interior`: the room that best represents the house (usually the living room or kitchen).
   - `floorplan`: every floor-plan sheet, in floor order (ground first).
   - `siteplan`: a boundary map or marked-up aerial, if there is one.
   - Two or three extras without a role (an aerial, the kitchen, an outbuilding).
   Skip agent promo images (stock trains, schools, logos) and anything labelled as a projection or a CGI.
4. Read the floor plan, not just the listing text, for the ground-floor bedroom question. The plans have overturned the listing more than once (Kilcoltrim and Bluebell Lodge both turned out to have one).
5. Daft image URLs are base64 settings plus a signature. Read each pick back as `role|key|signature|gravity|size`:
   `const m=JSON.parse(atob(u.slice(22).split('?')[0])); [role, m.key, u.split('signature=')[1], m.edits.overlayWith.options.gravity[5], m.edits.overlayWith.key.match(/small(\d)/)[1]].join('|')`
   Write the lines into a picks file under a `# <id>` header and run `python3 setup/apply-photos.py <picks-file>`.

If Daft has no floor plan, check the same house on MyHome and the agent's own site. The page shows an "Ask the agent" card when there's no plan.

## 2c. Judge the setting from above

Gabor's setting test is **space around the house**: lot size, open land beside it, how close the neighbours are. It is **not** "rural" for its own sake. A house on the edge of a town with fields around it is fine; dense estate suburbia is what he dislikes. Never write a con like "suburban edge, not rural" or "neither village nor deep rural" from the address alone.

Look at it from above before writing any setting pro or con. Use the listing's aerial photos, or in the browser on `https://gangeli.github.io/ireland/` (its Maps key is referrer-locked to that origin) run:
`const w=document.createElement('div');w.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:99999';document.body.append(w);const d=document.createElement('div');d.style.cssText='width:100%;height:100%';w.append(d);new google.maps.Map(d,{center:{lat,lng},zoom:17,mapTypeId:'satellite',disableDefaultUI:true});`
(Put the map in an inner div; Maps overrides the outer element's position.) Screenshot at zoom 17 and 18, then write what you see: "fields on three sides, nearest neighbour ~80 m", "terraces on both sides", "a commercial yard next door". Busy roads at the gate, railways, building sites and yards are the things to flag.

## 3. Write the ledger against the brief

Read the memory file for the Ireland property search for the current brief. As of Oct 2026, the brief covers:
- budget (roughly under €500k; up to ~€650–700k only for something special near a Dublin train)
- land for the dogs (ideally ~1 acre; at least a big private garden)
- strong schools nearby, for two young boys
- 24-hour ED access **that takes children**
- train to Dublin
- 100–280 m² (lowered from 140 by Gabor on 6 Oct 2026; compact is fine if the layout works)
- a ground-floor bedroom for Gabor's parents (or a room that can convert)
- space around the house (see 2c)
- rental use when the family's away

Write 5–8 pros and 5–8 cons. Each one gets:
- `text`: a short headline
- `weight`: 1–3, for how much it matters to the brief
- `detail`: one sentence with the specific numbers

Rules for the ledger:
- Be honest. Flag unknowns as cons: water/septic, ground-floor bedroom unconfirmed, flood history, planning, protected status.
- Don't restate one benefit as two pros (Bluebell had the cottage annex twice at weight 3); the weights double-count.
- Label rough cost estimates as rough. Quantify: km, minutes, €, m².
- Use the listing's own distances when it gives them (it said ~800 m to the station; the ledger said "5-minute walk").
- Check the things listings bury: a pond or river on site (with small boys), road frontage, a former pub or commercial use, overhead lines, pylons, quarries, motorway noise, a live railway platform next door.
- No hype words.

## 4. Pick the trips

Trips are grouped by category on the page. Use these ids, in this order:

| id | category | kind | how to choose |
|---|---|---|---|
| school | Schools | Primary school | Nearest primary **that takes boys through 6th class** (see Schools below). |
| school-good | Schools | Good primary school | Only if `school` isn't rated Good/Strong: the nearest primary that is. |
| secondary | Schools | Secondary school | Nearest boys' or mixed secondary. |
| secondary-good | Schools | Good secondary school | Only if `secondary` isn't Good/Strong: the nearest that is (≤45 km). |
| shop | Groceries | Village shop | Nearest small grocery (Centra/Spar/Londis/Mace/Costcutter/Gala, often at the filling station). |
| bigshop | Groceries | Supermarket | Nearest SuperValu/Dunnes/Tesco/Lidl/Aldi; 2–3 candidates. |
| dinner | Eating out | Restaurant | Best-reviewed food pub or restaurant nearby, **that serves food and is still open**. |
| hospital | Health | Emergency department | Nearest 24-hour ED **that takes children** (see Health below). |
| town | Towns and cities | Small town | Nearest proper market town. |
| city | Towns and cities | City | Nearest city (Kilkenny, Waterford, Limerick, Carlow…); give 2 if close. |
| dublin | Towns and cities | Capital | `St Stephen's Green, Dublin` |
| cork | Towns and cities | City | `English Market, Cork` |
| train | Getting away | Station | Nearest station with direct Dublin trains. Put the line, trains per weekday and time in the note. |
| airport | Getting away | Airport | `Dublin Airport` |

Each trip has: `id`, `category`, `kind`, `title` (the place's name, shown before it resolves), `label` (a short purpose, such as "School run"), `candidates` (1–3 Google Places text queries: name + town + county, e.g. `Mace Inver Freshford, Co. Kilkenny`; the page tries each and keeps the fastest drive, and falls back to a nearby-type search if all fail), `note` (one sentence or empty), `when` ("HH:MM" departure for the traffic forecast: 08:20 primary, 08:05 secondary, 09:15 shop, 10:30 bigshop, 12:30 town, 15:00 city, 19:00 dinner, 03:00 hospital, 07:15 train, 06:00 airport, 09:30 dublin/cork), `group` (`weekday`, `further` or `night`: `night` for hospital, `further` for train/airport/dublin/cork), optional `day` (`friday` for airport, `saturday` for dublin/cork). School trips also carry `rating` (below).

### Groceries: be rigorous and pragmatic
Every house needs both a small shop and a big supermarket. Before concluding a village has no shop, search the village name with shop, Centra, Spar, Londis, Mace, Costcutter, Gala, Daybreak and filling station. Then sanity-check against the map: a house 5 km from a town of 2,000+ people almost certainly has a supermarket there; a "Little Shop" 3 km away is rarely the right answer when a Mace sits in the next village. (Gabor caught Ballinkillen pointing at the wrong shop.) Prefer the shop people actually use, not the nearest thing Google calls a store.

### Schools: all levels, judged on quality
- **Gender first.** Many older Irish towns have single-sex primaries despite "NS" names: Convent and Scoil Bhríde are often girls-only; St Francis/Brothers schools are boys; some take boys only up to senior infants (St Evin's, Monasterevin), and some are senior-only (Bishop Foley, Carlow). Check enrolment by gender on scoilscout.ie or schooldays.ie before naming a school. Never name a girls-only secondary.
- **Daft's school lists are straight-line and stale.** They list merged schools by old names (Callan CBS + St Brigid's are now Coláiste Abhainn Rí), schools that have moved (St Paul's Monasterevin), and sometimes primaries under "secondary". Verify each one.
- **Rating** on each school trip: `"rating": {"level": "Strong"|"Good"|"Average"|"Below average"|"Unknown", "basis": "one sentence on the evidence"}`. The page shows it as a coloured chip.
  - Secondaries: the Irish Times / Sunday Times feeder-school tables (progression to third level), inspection reports and reputation. The Irish Times pages render their numbers through charts WebFetch can't read; local news roundups (KFM, KCLR, Midlands 103, Offaly Express) quote them.
  - Primaries: Department of Education inspection reports (Whole-School Evaluation, curriculum evaluations). The report PDFs are on `assets.gov.ie` and **WebFetch reads them**. But gov.ie's search and report pages sit behind a human-verification check, and WebSearch doesn't index the PDFs. Never try to get past the check. A browser where Gabor has passed the check once can list a school's reports at `https://www.gov.ie/en/school-reports/?roll_number=<roll>` (the parameter is `roll_number`, not `school_roll_number`). Open a report page, take its `assets.gov.ie` PDF link, and WebFetch it. Without that, rate primaries `Unknown` with an honest basis (enrolment, DEIS status, trend from scoilscout). Don't guess.
  - DEIS status (disadvantage scheme) is a flag worth stating, not a verdict by itself.
- If `school` is Unknown or below Good, still look for `school-good`.

### Health: an ED that takes the boys
Naas General and Connolly (Blanchardstown) EDs take **ages 16+ only**. Never make them the title hospital for this family. Children's 24-hour EDs in Dublin are CHI Crumlin, Temple Street and Tallaght. All-ages EDs nearby include St Luke's Kilkenny, University Hospital Waterford, Tipperary University Hospital Clonmel, University Hospital Limerick, Midland Regional Tullamore, Midland Regional Portlaoise (open 24 h with a paediatric extension since May 2026; downgrade talk recurs, so check the news), Regional Mullingar, Wexford General and Our Lady of Lourdes Drogheda.

### Restaurants and trains
- Hotels get renamed. Check that two "different" candidates aren't the same venue (Hotel Castlepollard is now the Castle Varagh Hotel, home of Tom's Bistro), and that a pub actually serves food.
- Count trains per weekday from the timetable, not memory: Muine Bheag ~7, Carlow ~10, Gorey ~5 (fastest 1h43). Kildare-line towns have 20+.

## 5. Services

`services` has one entry each for `electricity`, `water`, `sewer` and `internet`: `{ "status": ..., "detail": ... }`. Status is `ok` (stated: mains, fibre, connected), `check` (stated but worth checking: septic tank, private well), `likely` (not stated but strongly implied) or `unknown`. Start `detail` with the conclusion, because the page shows its first phrase.

Internet also needs what Gabor would actually get, shown as "type · speed · provider":
- `type`: `Fibre`, `Cable`, `DSL`, `Fixed wireless`, `Satellite` or `Mobile 4G/5G`
- `speed`: e.g. `up to 1 Gb`, `~500 Mb`, `~30 Mb`
- `provider`: short, e.g. `Eir`, `Siro`, `Virgin Media`, `NBI`, `open eir / NBI`, `Starlink`

Evidence order: the listing's features, then BuyerIQ, then National Broadband Ireland announcements. NBI announces by deployment area (e.g. "Curragh Camp"), which covers the townlands around it, so search the area name, not the townland. Towns usually have open eir FTTH or Siro; Virgin Media cable is in larger towns (Carlow, Portlaoise, Kilkenny, Leixlip, Naas/Sallins, Newbridge).

## 6. Write the file

`id` is a lowercase slug of the house name plus the townland or village, for example `forty-shades` or `old-station-house-monasterevin`. Top-level keys:

`id, name, address, eircode, lat, lng, listingUrl, status, added, area, agent, agentEmail, agentPhone, questions[], ai, services, groundFloorBedroom, price, type, beds, bedsNote, baths, floorM2, atticM2, landHa, landAcres, ber, berKwh, heating, listed, views, stampDuty, tagline, photos[], pros[], cons[], trips[], categories[]`

Notes on the keys:
- `status`: `Considering` while on the market, or `Sale agreed` / `Passed`. The index works out Front-runner, Strong contender, Considering and Long shot itself from the ratings, so don't set those.
- `added`: today's date. `listed`: the listing date from Daft.
- `area`: "Village, Co. County". `tagline`: one plain sentence on what the house is and where.
- Leave out keys you don't have rather than inventing them.
- `categories`: always `["Schools","Groceries","Eating out","Health","Towns and cities","Getting away"]`.
- `questions`: 3–5 questions for the agent, specific to this house's unknowns and risks (floor area, boundaries, ground-floor bedroom, BER, protected status, flood zone, radon). Don't ask what the listing already answers ("Is it a protected structure?" when it says it is); ask the next question instead. The page adds a standard set after these.
- `groundFloorBedroom`: `{ "status": "ok" | "check" | "issue" | "unknown", "detail": "one sentence naming the room" }`.
- `ai`: `{ "stars": 1–5 in half steps, "why": "one or two short sentences" }`. Your judgement of fit with the brief, comparable across houses. Forty Shades is 4.5, the benchmark (pretty 1.6 ac bungalow near a village, €475k). A house that badly misses size or the ground-floor bedroom scores 2–2.5. Keep `why` consistent with the ledger.

Then add the id to `properties/index.json` (respecting the sweep's top-20 rules in `SWEEP.md`), never duplicating one.

Validate before committing:
```bash
cd /home/claude/ireland
python3 - <<'EOF'
import json
i = '<id>'
d = json.load(open(f'properties/{i}.json'))
ids = [t['id'] for t in d['trips']]
assert d['id'] == i and d['lat'] and d['lng'] and len(ids) == len(set(ids)) and len(ids) >= 11
assert {'school', 'secondary', 'shop', 'bigshop', 'hospital', 'train'} <= set(ids)
assert all(t.get('candidates') for t in d['trips'])
assert all(t.get('rating', {}).get('level') for t in d['trips'] if t['category'] == 'Schools')
assert set(d['services']) == {'electricity', 'water', 'sewer', 'internet'} and d['services']['internet'].get('type')
assert d['groundFloorBedroom']['status'] and d.get('listed')
json.load(open('properties/index.json')); print('ok')
EOF
```

## 7. Publish

```bash
cd /home/claude/ireland
git add properties/
git commit -m "Add <name>, <area>"   # plus the session's attribution lines
git push origin HEAD:main && git push -f origin HEAD:gh-pages
```
If the push is rejected, `git pull --rebase origin main` and push again. Pages rebuilds in about a minute; the site revalidates data files on every load.

## 8. Report

Give the house link (`https://gangeli.github.io/ireland/property.html?p=<id>`) and the index link, plus one line on the ledger: for/against weights and the biggest con. When this runs inside the property sweep, the site page is **the** link for that house in the write-up. Don't link Daft or MyHome for a house that has a page; the page links to the listing itself. Only near misses without a page get a listing link.

People who turned on the bell on the shortlist get a browser notification about each new house automatically (the ratings function checks `index.json` every 30 minutes). After pushing, WebFetch `<HOUSE_DAYS_RATINGS_URL>?action=check` to send it straight away; if that fails, say so and move on.

## Updating a house

- Sale agreed, price change, or Gabor passes on it: edit `status` (and `price`, adding a con such as "Price cut from €X" or a pro if relevant), then commit "Update <name>: <what>".
- Never delete a house's file. `Passed` keeps it on the map, greyed, so it isn't re-found.

## Ratings and alerts

People rate houses on the site, synced through a small Cloud Function (`setup/ratings-setup.sh`, which also runs the new-house alerts). There's nothing to do for them when adding a house. GET the URL in `config.js` for the current ratings.

## Working with subagents

Fanning research out to subagents works (four batches of four houses took about eight minutes), but:
- Give them the brief explicitly (budget, dogs, two boys, parents, space-not-rural) and have them write results to scratch files, not the repo. Merge yourself.
- **Check any "the listing doesn't say X" claim against Daft's own data in the browser** before applying it (see section 2).
- WebSearch has a session-wide budget (about 200) shared with all subagents. Budget searches per house.

## Don'ts

- Don't edit the site code to add a house. If you ever change it, run `setup/stamp.sh` before committing so browsers don't mix cached old scripts with the new page.
- Don't commit any key other than the browser key already in `config.js`.
- Don't copy listing photos into the repo.
- Don't guess coordinates, school quality or services.
- Don't try to get past a human-verification check on any site.
