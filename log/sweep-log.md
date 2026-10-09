# Sweep log

Append-only. One entry per daily sweep; see `SWEEP.md` for the procedure. Newest at the bottom.

## 2026-10-04 setup (manual, with Gabor)
- Set up shortlist management: `SWEEP.md` procedure, `properties/archive.json`, this log, `log/ratings/` snapshots.
- Rule from Gabor: keep the live list to the top 20; add new finds, retire sold/withdrawn and low-rated houses; trust people's ratings over AI's; never lose information.
- Human ratings: unavailable — the ratings endpoint in `config.js` returned 404 from the sweep's fetcher. Ranking on AI stars until it answers.
- No houses added or archived today. Shortlist is 17 (3 slots open):
  - forty-shades (AI 4.5)
  - ballinkillen-bagenalstown (AI 4.0)
  - stone-lodge-freshford (AI 4.0)
  - hillview-maddenstown (AI 3.5)
  - old-station-house-monasterevin (AI 3.5)
  - tobinstown-lodge-tullow (AI 3.5)
  - castleinch-kilkenny (AI 3.0)
  - compsey-mill-mullinahone (AI 3.0)
  - parochial-house-monasterevin (AI 3.0)
  - canal-view-sallins (AI 2.5)
  - leavalley-leixlip (AI 2.5)
  - old-forge-ballyduff (AI 2.5)
  - 6-grattan-street-portlaoise (AI 2.0)
  - bluebell-lodge-carlow (AI 2.0)
  - green-house-clara (AI 2.0)
  - kilcoltrim-borris (AI 2.0)
  - water-lane-castlepollard (AI 2.0)


## 2026-10-05 sweep
- Sources: Daft houses p1–2 + sites p1 for Kilkenny, Carlow, Tipperary, Laois, Westmeath; MyHome recent for all five; Daft page 1 for 26 commuter/Wexford towns (carlow-carlow returns nationwide results, used carlow-town-carlow). Missed: none.
- Human ratings: 8 ratings from 2 people (Gabor 7, Aniko 1), snapshot log/ratings/2026-10-05.json. A plain WebFetch GET of the endpoint returns 404, but `?action=check` returns the same {ratings:[…]} payload, so use that.
- Rechecked all 17 live houses: all still for sale, no price changes. Stone Lodge has an open viewing Sat 10 Oct 11:00–12:00.
- Added: Alderfern, Ferns, Co. Wexford (AI 3.0) – A2 2021 single-storey, all bedrooms on the ground floor, 0.49 ac on the edge of Ferns, €475k. But 126 m², under half an acre, ~2 h train. Photos/floor plan still need a browser pass; water/sewer unstated.
- Considered, not added (not real contenders; slots left open rather than padded): Enniscorthy Rd, Ferns €399k (AI ~2.5, roadside village plot, site size unstated); The Bungalow, Cill Dara Close, Celbridge €545k (96 m², 0.15 ac); Fortbarrington Rd, Athy €595k (house + florist shop); 75 Mill Lane, Leixlip €490k (48.6 m²); 5 Beechview, Killucan €385k (estate plot).
- Archived: — · Re-added: —
- Updated: — (no price or status changes)
- Judgment calls: kept 2 slots open instead of admitting sub-2.5 near misses.
- Shortlist now 18 (combined score): forty-shades (4.83: AI 4.5, people [5, 5]), stone-lodge-freshford (4.50: AI 4.0, people [5]), tobinstown-lodge-tullow (3.75: AI 3.5, people [4]), ballinkillen-bagenalstown (3.50: AI 4.0, people [3]), old-station-house-monasterevin (3.50: AI 3.0, people [4]), hillview-maddenstown (3.25: AI 3.5, people [3]), alderfern-ferns (3.00), castleinch-kilkenny (3.00), leavalley-leixlip (3.00: AI 2.0, people [4]), parochial-house-monasterevin (3.00), bluebell-lodge-carlow (2.50), compsey-mill-mullinahone (2.50), green-house-clara (2.50), kilcoltrim-borris (2.50), old-forge-ballyduff (2.50), 6-grattan-street-portlaoise (2.00), canal-view-sallins (2.00), water-lane-castlepollard (2.00)
- Lessons from ratings (no notes yet): Gabor rated Leavalley 4 vs AI 2.0 and Tobinstown 4 vs AI 3.5, and Hillview 3 vs AI 3.5, Ballinkillen 3 vs AI 4.0. Read: Dublin access counts for more, and 'well-kept, single-storey' for less, than the AI assumed. Not re-scoring AI votes on one person's stars without notes; watching for a pattern.

## 2026-10-06 sweep — BLOCKED
- Sources: none reached. Every WebFetch (Daft, MyHome, the ratings function) failed with PROVENANCE_REQUIRED: the permission prompt timed out with nobody there to answer it. Yesterday's in-session approvals didn't carry over to the unattended run.
- Human ratings: unavailable (same block); no snapshot.
- Rechecks: not done. Prices and status on the site are as of 2026-10-05.
- Added / archived / updated: none.
- Shortlist unchanged at 18.

## 2026-10-06 sweep — re-run with Gabor present (08:15 PT)
- Sources: Daft houses p1–2 + sites p1 for the five counties; MyHome recent for all five; Daft page 1 for 26 commuter/Wexford towns. Missed: none. Covered listings since 5 Oct (the 14:53 UTC run was blocked).
- Human ratings: 11 ratings from 2 people (snapshot log/ratings/2026-10-06.json). The bare URL now answers (with a cache-buster query); `?action=check` now returns only {"fresh":0}.
- New ratings since 5 Oct: Alderfern 4, Castleinch 4, 6 Grattan St 3 (all Gabor).
- Rechecked all 18 live houses: all for sale, no price changes. Stone Lodge open viewing Sat 10 Oct 11:00–12:00.
- Added: Jenkinstown Park, Jenkinstown, Co. Kilkenny (AI 3.5) – €395k, 4 bed, ~127 m², 1.3 ac, two ground-floor bedrooms + shower room, restored, 10 min to Kilkenny (St Luke's ED, Kilkenny College/St Kieran's, ~7 trains/day). Under the size floor, small kitchen, BER D (listing says "to follow"), well/septic. Adjoining 18.5 ac listed separately at €460k. Photos/floor plan need a browser pass.
- Considered, not added: 6 Black Church Square, Inistioge €360k (terrace, no ground-floor bedroom, paved yard); 7 Milford Park, Ballinabranna €427.5k (estate bungalow); Main St, Stoneyford POA (semi needing major work); Main St, Tinnahinch €135k (no garden); The Bungalow, Cill Dara Close, Celbridge (96 m², 0.15 ac); Fortbarrington Rd, Athy (house + florist).
- Archived: — · Re-added: — · Updated: —
- Lessons from ratings: Gabor rates small single-storey houses on real land near amenities (Castleinch 4, Alderfern 4) above the AI (3.0 each). Size below 140 m² seems to bother him less than the AI assumed. Applied when scoring Jenkinstown (3.5 rather than 3.0). Not re-scoring existing AI votes yet.
- Shortlist now 19 (combined score): forty-shades (4.83: AI 4.5, people [5, 5]), stone-lodge-freshford (4.50: AI 4.0, people [5]), tobinstown-lodge-tullow (3.75: AI 3.5, people [4]), alderfern-ferns (3.50: AI 3.0, people [4]), ballinkillen-bagenalstown (3.50: AI 4.0, people [3]), castleinch-kilkenny (3.50: AI 3.0, people [4]), jenkinstown-park-jenkinstown (3.50), old-station-house-monasterevin (3.50: AI 3.0, people [4]), hillview-maddenstown (3.25: AI 3.5, people [3]), leavalley-leixlip (3.00: AI 2.0, people [4]), parochial-house-monasterevin (3.00), 6-grattan-street-portlaoise (2.50: AI 2.0, people [3]), bluebell-lodge-carlow (2.50), compsey-mill-mullinahone (2.50), green-house-clara (2.50), kilcoltrim-borris (2.50), old-forge-ballyduff (2.50), canal-view-sallins (2.00), water-lane-castlepollard (2.00)

## 2026-10-06 brief change (Gabor, 08:29 PT)
- Floor-area minimum lowered from 140 m² to 100 m² (house-days skill updated).
- Re-scored AI votes where size was the main con: Alderfern 3.0 → 3.5; Old Forge 2.5 → 3.0. Size cons softened (weights) on Alderfern, Jenkinstown, Old Forge, Castleinch (94 m²), Water Lane (94 m²); dropped on 6 Grattan St (130 m²); Kilcoltrim (~85 m²) still flagged. Other AI scores unchanged (their low scores rest on other things).

## 2026-10-06 Main Street, Stoneyford (Gabor asked, 08:30 PT)
- Built properties/main-street-stoneyford.json (AI 2.0) but did NOT add it to index.json: the listing is price-on-application, and the site code shows "€NaN" for a missing price. Add it to index.json once there's a guide price, or once the site handles a missing price ("POA").
- Gabor was curious about the house only; Stoneyford was not added to the sweep's village list.

## 2026-10-07 sweep
- Sources: Daft houses p1–2 + sites p1 (5 counties), MyHome recent (5 counties), Daft page 1 for 26 commuter/Wexford towns. Missed: none, but Daft's sorted town pages and the sorted Tipperary/Westmeath houses pages returned stale order today; the agents caught new IDs via the county all-property pages (`/property-for-sale/<county>?sort=publishDateDesc`). Use those too.
- Human ratings: 11 from 2 people, unchanged since 6 Oct (snapshot log/ratings/2026-10-07.json).
- Rechecked 19 live houses + unlisted Main Street, Stoneyford: no status or price changes; Stoneyford still POA. Stone Lodge open viewing Sat 10 Oct 11:00–12:00.
- Added: Jamestown, Ballybrittas, Co. Laois (AI 3.5) – €450k 1984 dormer, 170 m², three ground-floor bedrooms + ground-floor bathroom, 0.5 ac with tennis court and 99 m² workshop, 4.5 km to Monasterevin station; BuyerIQ noise-zone flag (source unknown), weak nearest secondary.
- Added: 23 New Inn, Enfield, Co. Meath (AI 3.0) – €465k 5-bed dormer, 144 m², three ground-floor bedrooms (two ensuite), 160 m from Enfield station; estate plot in the village centre, garden size unstated, children's ED 40–50 min.
- Archived: Canal View, Sallins – bumped by 23 New Inn (3.0 vs 2.0); tie-break against Water Lane on hard requirements.
- Considered, not added: Ballinamona, Golden €250k (no ground-floor bedroom); 14 Highfield Park, Leixlip €525k (estate plot, possible granny-flat entrance — near miss); Raheenadeeragh, Athy €450k (rural, sizes unstated — near miss); Minnistown Rd, Laytown €495k (64 m²); 24 Ballygarth Manor Julianstown; 23 Mount Auburn Drogheda; 13 The Lawn Newbridge; 65 Beaubec Drogheda; Lands Miltown Graiguenamanagh (29.5 ac, no house, auction 11 Nov).
- Re-added: — · Updated: —
- Shortlist now 20 (combined score): forty-shades (4.83: AI 4.5, people [5, 5]), stone-lodge-freshford (4.50: AI 4.0, people [5]), alderfern-ferns (3.75: AI 3.5, people [4]), tobinstown-lodge-tullow (3.75: AI 3.5, people [4]), ballinkillen-bagenalstown (3.50: AI 4.0, people [3]), castleinch-kilkenny (3.50: AI 3.0, people [4]), jamestown-ballybrittas (3.50), jenkinstown-park-jenkinstown (3.50), old-station-house-monasterevin (3.50: AI 3.0, people [4]), hillview-maddenstown (3.25: AI 3.5, people [3]), leavalley-leixlip (3.00: AI 2.0, people [4]), new-inn-enfield (3.00), old-forge-ballyduff (3.00), parochial-house-monasterevin (3.00), 6-grattan-street-portlaoise (2.50: AI 2.0, people [3]), bluebell-lodge-carlow (2.50), compsey-mill-mullinahone (2.50), green-house-clara (2.50), kilcoltrim-borris (2.50), water-lane-castlepollard (2.00)

## 2026-10-08 sweep
- Sources: Daft all-property + houses + sites pages (5 core counties; Kilkenny all-property returned page 2, Carlow/Tipperary/Laois all-property and Carlow/Tipperary houses were stale), MyHome recent (5 counties), Daft county pages for Kildare/Meath/Louth/Laois/north Dublin/Wexford fringe and 16 commuter town pages (town pages stale). Missed: none outright.
- Human ratings: UNAVAILABLE — the ratings URL hit PROVENANCE_REQUIRED (each new query string needs its own approval). Ranked on the 7 Oct snapshot (11 ratings); no new snapshot.
- Rechecked 20 live houses: no status or price changes. Stone Lodge open viewing Sat 10 Oct 11:00–12:00.
- Updated: Main Street, Stoneyford (unlisted) – now €200,000 (was POA). AI stays 2.0; not listed (doesn't beat #20; semi with no ground-floor bedroom).
- Added: Clomantagh Farmhouse, Barna (Freshford/Johnstown), Co. Kilkenny (AI 3.0) – €250k, 179 m² farmhouse on ~3 ac with outbuildings; bedrooms upstairs but the ground-floor bar lounge beside a bathroom could convert; effectively BER G (615 kWh), possible former pub, listing text partly recycled (Tipperary schools).
- Archived: Water Lane, Castlepollard – bumped by Clomantagh Farmhouse (3.0 vs 2.0); no ratings.
- Considered, not added: Wood Of O Cottage, Ballinaclogh, Golden €270k (MyHome 5032739; stone cottage, ground-floor bedroom + shower, garage granny-flat option; but ~85–95 m² and site size unstated — near miss, revisit if site/size turn out well); Grange Beg, Raharney €295k (66 m² on 1.1 ac); Brookfield, Rush €685k (dated 6-bed bungalow, plot unstated); Ballintemple Dundrum; Rehill Cahir (land); Carrig Rd Roscrea; Fleenstown Ashbourne; Killyganard Athy; Ballybrack Kilcock; Collinstown Lusk.
- Re-added: —
- Shortlist now 20 (combined score): forty-shades (4.83: AI 4.5, people [5, 5]), stone-lodge-freshford (4.50: AI 4.0, people [5]), alderfern-ferns (3.75: AI 3.5, people [4]), tobinstown-lodge-tullow (3.75: AI 3.5, people [4]), ballinkillen-bagenalstown (3.50: AI 4.0, people [3]), castleinch-kilkenny (3.50: AI 3.0, people [4]), jamestown-ballybrittas (3.50), jenkinstown-park-jenkinstown (3.50), old-station-house-monasterevin (3.50: AI 3.0, people [4]), hillview-maddenstown (3.25: AI 3.5, people [3]), clomantagh-farmhouse (3.00), leavalley-leixlip (3.00: AI 2.0, people [4]), new-inn-enfield (3.00), old-forge-ballyduff (3.00), parochial-house-monasterevin (3.00), 6-grattan-street-portlaoise (2.50: AI 2.0, people [3]), bluebell-lodge-carlow (2.50), compsey-mill-mullinahone (2.50), green-house-clara (2.50), kilcoltrim-borris (2.50)

## 2026-10-08 handover
- Gabor moved the daily sweep to a Claude Code routine (runs without approval prompts). The chat-thread sweep chain is stopped; no further runs from that thread.
- Dedupe list of every listing named to Gabor so far is now in log/known-listings.txt; future sweeps should read it (plus the "considered, not added" lines here) and append to it.

## 2026-10-08 sweep — second run, in the new scheduled session (~08:40 PT)
- Why: the sweep moved to a recurring Routine in Gabor's Claude Code session (daily 05:53 America/Los_Angeles); the old send_later chain (14:53 UTC) is disabled. This run tests that it works without approval prompts: it does. Daft, MyHome and the ratings URL were all reached with no PROVENANCE_REQUIRED.
- Sources: Daft all-property page 1 for Kilkenny/Carlow/Tipperary/Laois/Westmeath/Kildare/Meath/Louth; Daft sites page 1 for Kilkenny/Carlow/Tipperary; MyHome Kilkenny/Carlow/Laois. Light pass (listings since the 14:53 UTC run); commuter town pages not repeated. MyHome `?sort=newest` returns HTTP 400; use `/residential/<county>/property-for-sale` with no sort (defaults to Most Recent).
- Human ratings: 23 ratings from 3 names (snapshot log/ratings/2026-10-08.json), up from 11. George has started rating with notes. Gabor changed several: Old Station House 4→2, Castleinch 4→3, Tobinstown 4→3, Hillview 3→2; new Gabor ratings Jenkinstown 4, Jamestown 3, 23 New Inn 2. "George" and "George Angeli" both rated Jenkinstown 4, probably the same person; counted as given (score 3.88, or 3.83 if merged; no rank change).
- Rechecked 20 live houses + Stoneyford: no price changes. Stone Lodge open viewing Sat 10 Oct 11:00–12:00.
- Archived: Bluebell Lodge, Carlow – withdrawn (Daft listing gone; URL redirects to the Carlow Town search). recheck: true in case it is sale agreed.
- Added: Cuddagh South, Ballacolla, Co. Laois (AI 3.5) – €450k 2006 bungalow, 147 m², 3 bed/3 bath, 1.68 ac, big detached garage, BER C1; rural (6 km to Ballacolla, 17 km to Portlaoise ED and station). Biggest con: BuyerIQ puts the Eircode in the OPW 1-in-100 river flood extent. No floor plan yet; ground-floor bedroom "check" (bungalow, so all three should qualify).
- Considered, not added: Rosenallis Village €150k (derelict on ~0.5 ac in the village centre; second-tier wildcard); Balroe, Ballynacarrigy €395k (79 m² on 5 ac); 28 Monread Heights Naas; Kilrush Thurles (field); Bellinter Navan (site); Old Farmhouse Narraghmore €775k; Macetown Dunshaughlin (POA farm); Gort na Dtobar Mullingar €850k; 51 Rose Drive Kilkenny €515k; plus estate houses and apartments in Laois/Westmeath/Kildare/Meath/Louth/Carlow.
- Lessons from notes (George): medical and commute access matter (Forty Shades "hard to get medical care"); houses right on a road are a negative (Tobinstown, Jenkinstown); steep stairs and awkward ground floors count against (Old Station House, Ballinkillen); trains right by the house count against; "a bit small for all 6 of us" (Alderfern) means size still matters to him. Applied in scoring Cuddagh South; existing AI votes not re-scored this run.
- Shortlist now 20 (combined score): forty-shades (4.62: AI 4.5, people [5, 5, 4]), stone-lodge-freshford (4.33: AI 4.0, people [5, 4]), alderfern-ferns (4.17: AI 3.5, people [4, 5]), jenkinstown-park-jenkinstown (3.88: AI 3.5, people [4, 4, 4]), cuddagh-south-ballacolla (3.50), ballinkillen-bagenalstown (3.33: AI 4.0, people [3, 3]), jamestown-ballybrittas (3.25: AI 3.5, people [3]), tobinstown-lodge-tullow (3.17: AI 3.5, people [3, 3]), castleinch-kilkenny (3.00: AI 3.0, people [3]), leavalley-leixlip (3.00: AI 2.0, people [4]), old-forge-ballyduff (3.00), parochial-house-monasterevin (3.00), clomantagh-farmhouse (3.00), hillview-maddenstown (2.83: AI 3.5, people [2, 3]), old-station-house-monasterevin (2.67: AI 3.0, people [2, 3]), 6-grattan-street-portlaoise (2.50: AI 2.0, people [3]), compsey-mill-mullinahone (2.50), green-house-clara (2.50), kilcoltrim-borris (2.50), new-inn-enfield (2.50: AI 3.0, people [2])

## 2026-10-09 sweep (scheduled Routine, 12:54 UTC)
- Ran from the new Claude Code Routine with no approval prompts. Sources: Daft houses p1–2, all-property p1 and sites p1 (5 core counties); MyHome recent (5 counties); Daft county pages for Kildare/Meath/Louth/Laois (≤€700k), north-Dublin towns, 24 commuter town pages, Wexford fringe (Bunclody, Ferns, Camolin, Kiltealy; Clonegal via Bunclody). Missed: none. Daft returned HTTP 429 on a few pages (Westmeath sites, Celbridge, Maynooth, Kilcock, Enfield); all succeeded on retry.
- Human ratings: 26 from 3 names (snapshot log/ratings/2026-10-09.json). New: Gabor Cuddagh South 2, Clomantagh Farmhouse 4; George Leavalley 3 ("very good location… bad condition, structural integrity questionable"; Confey masterplan keeps the house, school + green planned next door 2028–31).
- Rechecked 20 live houses + archived Bluebell Lodge + Stoneyford + Wood Of O: no price changes; no floor plans added. Stone Lodge open viewing Sat 10 Oct 11:00–12:00. Bluebell Lodge is off MyHome too (no sale-agreed sign); keep rechecking. Wood Of O (MyHome 5032739, relisted 8 Oct at €270k) still gives no site size or floor area. Cuddagh South: MyHome still has no floor plan; ground-floor bedrooms unconfirmed.
- Archived: Hillview, Maddenstown – sale agreed (Daft shows "Sale Agreed", €475k; AI 3.5, people [2, 3]). recheck: true.
- Added: — · Re-added: — (one open slot left empty: the best archived houses still for sale, Water Lane and Canal View, score 2.0, and today's near miss doesn't fit a lane; not padding).
- Considered, not added: Carnes West, Bellewstown €595k (A92 X973; ~294 m² bungalow + attic rooms, all four bedrooms on the ground floor, ~1 ac + 4 ac option, Duleek schools; but ~9–10 km to Laytown/Drogheda stations, over the size cap and over €500k — near miss, AI ~3.0); Kilkenny St, Freshford €110k (2-bed terraced shell, no land); Browneshill Rd Lower, Carlow €430k (all bedrooms upstairs); 7 The Avenue Westfield Leixlip €665k (estate semi); Hollybrook, Ballitore €498,950 (321 m², no station); plus estate houses and apartments in Naas, Newbridge, Kildare, Drogheda, Ardee, Portlaoise, Athlone, Mullingar, Thurles, Donabate, Wexford.
- Lessons from notes: George on Leavalley: condition and structure matter to him, and he values the planned school/green next door. No AI re-scores.
- Shortlist now 19 (combined score): forty-shades (4.62: AI 4.5, people [5, 5, 4]), stone-lodge-freshford (4.33: AI 4.0, people [5, 4]), alderfern-ferns (4.17: AI 3.5, people [4, 5]), jenkinstown-park-jenkinstown (3.88: AI 3.5, people [4, 4, 4]), clomantagh-farmhouse (3.50: AI 3.0, people [4]), ballinkillen-bagenalstown (3.33: AI 4.0, people [3, 3]), jamestown-ballybrittas (3.25: AI 3.5, people [3]), tobinstown-lodge-tullow (3.17: AI 3.5, people [3, 3]), castleinch-kilkenny (3.00: AI 3.0, people [3]), leavalley-leixlip (3.00: AI 2.0, people [4, 3]), old-forge-ballyduff (3.00), parochial-house-monasterevin (3.00), cuddagh-south-ballacolla (2.75: AI 3.5, people [2]), old-station-house-monasterevin (2.67: AI 3.0, people [2, 3]), 6-grattan-street-portlaoise (2.50: AI 2.0, people [3]), compsey-mill-mullinahone (2.50), green-house-clara (2.50), kilcoltrim-borris (2.50), new-inn-enfield (2.50: AI 3.0, people [2])
