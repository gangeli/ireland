# Daily sweep: keeping the shortlist at the top 20

The scheduled daily sweep, a Claude task that runs at 14:53 UTC, keeps this site's shortlist current. It finds new listings, updates the ones already here, retires anything that has sold or that people rated low, and keeps the live list to the **top 20** houses. This file is the procedure. Every run follows it and records what it did in `log/sweep-log.md`. **Where this file and the scheduled prompt disagree, this file wins**: it is newer (for example, the report now links houses to their site pages, not to Daft).

## Files

| File | What it holds |
|---|---|
| `properties/index.json` | The live shortlist, **at most 20 ids**, all still on the market. The map and list show only these. |
| `properties/<id>.json` | One file per house, **never deleted**. It stays even after the house leaves the shortlist. |
| `properties/archive.json` | Every house that left the shortlist: when it left, why, and its last price, AI stars and human ratings. The sweep checks this so it never re-adds a house it already dropped. |
| `log/sweep-log.md` | An append-only, human-readable log, one entry per run, newest at the bottom. |
| `log/ratings/<YYYY-MM-DD>.json` | A raw snapshot of the shared human ratings, saved each run when the service answers. People's stars and notes are kept even if the ratings database is lost. |
| `log/known-listings.txt` | Every listing already named to Gabor (on the site or rejected), for dedupe. Read it before judging new finds and append each run's rejects. |

## Each run

1. **Sync.** Run `git -C /home/claude/ireland pull --ff-only`. If the clone is missing, call `add_repo` (gangeli/ireland, push) and clone it as the house-days skill describes.
2. **Read the people.** WebFetch `HOUSE_DAYS_RATINGS_URL` from `config.js`. It returns `{ratings:[{property, person, stars, note, updated}]}`. (Add a cache-buster such as `?t=<YYYYMMDD>`: the bare URL has returned 404 to WebFetch. `?action=check` now only triggers alerts and returns `{"fresh":N}`, not ratings.) Save it verbatim to `log/ratings/<today>.json`. If it fails, note "human ratings unavailable" in the log and rank on AI stars alone. Read the notes too: a note like "too far from Dublin" is a preference to apply when scoring similar houses. Record any lesson like that in the log.
3. **Recheck every live house** (plus any archived house marked `recheck: true`) on Daft or MyHome. Look for:
   - Sale agreed, sold, withdrawn, or a listing that 404s: set `status` to `"Sale agreed"` (or `"Passed"` for withdrawn), move the id to the archive with the reason, and set `recheck: true`. Sales do fall through, so recheck archived sale-agreed houses about weekly for 6 weeks.
   - Price change: update `price` and `stampDuty`, add a pro or con ("Price cut from €X to €Y on <date>"), and revisit `ai.stars`.
   - New facts, such as a floor plan confirming a ground-floor bedroom: update the ledger and revisit `ai.stars`.
4. **Find new candidates**, using the sources and criteria in the scheduled prompt. Build a page for each real contender with the house-days skill. Score it with `ai: {stars, why}`, where stars run 1–5 in steps of 0.5 and `why` is one plain sentence.
5. **Rank and trim to 20** (rules below), then edit `index.json` and `archive.json`.
6. **Validate, log, commit, push** (below).
7. **Nudge the alerts.** After the push, WebFetch `HOUSE_DAYS_RATINGS_URL + "?action=check"`. The function compares the live list with every house it has seen and sends a browser notification to everyone who opted in (the bell on the shortlist). It also runs by itself every 30 minutes, so a failure here only delays alerts; note it in the log and move on.

## Linking in the report

In the write-up, **every house links to its page on this site**, `https://gangeli.github.io/ireland/property.html?p=<id>`, not to Daft or MyHome. The site page already links to the listing. Only a house mentioned without a page (a near miss) gets a listing link. Close with the shortlist link, `https://gangeli.github.io/ireland/`.

## Ranking

**The score is one average in which the AI counts as one vote and each person counts as one vote.** The site sorts and labels houses the same way.

```
score = (ai.stars + sum of human stars) / (1 + number of human ratings)
```

With no ratings, the score is the AI's stars. One person at 2 against an AI 4 gives 3.0. Three people at 2 give 2.5. The more people rate, the less the AI matters, and that's the whole "trust people over AI" rule. No extra overrides are needed.

1. **Live list = the 20 highest scores** among houses still on the market. Off-market houses (sale agreed, sold, withdrawn) leave regardless of score.
2. **A new house** starts with only the AI vote, so it gets in only if its AI stars beat the current #20's score (or there's room). Be honest with the AI stars: don't inflate a new find to get it on the list.
3. **Keep the AI vote current.** Re-score a house's `ai.stars` when facts change (a price cut, a confirmed floor plan), or when people's notes reveal a preference the AI was missing ("too far from Dublin", "need fenced land"). Apply those lessons to similar houses too, and log them. The AI's vote should get smarter. It shouldn't get louder.
4. **Ties and near-ties** (within 0.25) go to the house that fits more hard requirements: a ground-floor bedroom (or a room that can convert), land for the dogs, school and ED access, and budget. Note each such call in the log.
5. **Fill to 20.** When slots open, the best new or archived-but-still-for-sale house comes back. Log it as a re-add.

## Archive entry shape

```json
{ "id": "kilcoltrim-borris", "name": "Kilcoltrim", "left": "2026-10-05",
  "reason": "Dropped for Old Mill, Inistioge (AI 4.0 vs 2.0); no human ratings",
  "lastPrice": 225000, "aiStars": 2.0, "human": {"n": 0, "avg": null},
  "listingUrl": "https://…", "recheck": false }
```

`reason` is one of:
- `sale agreed` / `sold` / `withdrawn` (set `recheck: true` for sale agreed)
- `bumped by <new house>` (give both scores and the ratings behind them)
- `passed by Gabor`

## Log entry shape (append to `log/sweep-log.md`)

```markdown
## 2026-10-05 sweep
- Sources: Daft (5 counties + sites + commuter towns), MyHome recent; missed: none
- Human ratings: 6 ratings from 2 people (snapshot log/ratings/2026-10-05.json)
- Added: The Old Mill, Inistioge (AI 4.0) – why
- Updated: Forty Shades – price €475k → €450k; AI 4.5 → 4.5
- Archived: Kilcoltrim, Borris – bumped by The Old Mill (AI 2.0, no ratings)
- Re-added: —
- Judgment calls: near-tie at #20, kept X over Y (ground-floor bedroom confirmed)
- Lessons from notes: "dogs need fenced land" → weighting fencing/enclosure higher
- Shortlist now 20: forty-shades (score 4.5: AI 4.5, no ratings), … (top-to-bottom)
```

Every run writes an entry, even "no changes", so a gap in the log means a run failed.

## Validate and publish

```bash
cd /home/claude/ireland
python3 - <<'EOF'
import json, os
idx = json.load(open('properties/index.json'))['properties']
arc = json.load(open('properties/archive.json'))['archived']
assert len(idx) <= 20, f"{len(idx)} live houses; cap is 20"
assert len(idx) == len(set(idx)), "duplicate id in index"
assert not set(idx) & {a['id'] for a in arc}, "id is both live and archived"
for i in idx + [a['id'] for a in arc]:
    assert os.path.exists(f'properties/{i}.json'), f"missing properties/{i}.json"
for i in idx:
    d = json.load(open(f'properties/{i}.json'))
    assert d['id'] == i and d['lat'] and d['lng'] and len(d['trips']) >= 11, i
    assert not __import__('re').search('sale agreed|sold|passed', d.get('status',''), 2), f"{i} is off-market but live"
print('ok', len(idx), 'live,', len(arc), 'archived')
EOF
git add -A properties log
git commit -m "Sweep <date>: +N added, -M archived, K updated"   # plus the session's attribution lines
git push origin HEAD:main && git push -f origin HEAD:gh-pages
```

If the push is rejected, run `git pull --rebase origin main` and push again. Never force-push `main`.
