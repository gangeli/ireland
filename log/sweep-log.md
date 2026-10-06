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
