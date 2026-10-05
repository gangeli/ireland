# Daily sweep: keeping the shortlist at the top 20

The scheduled daily sweep, a Claude task that runs at 14:53 UTC, keeps this site's shortlist current. It finds new listings, updates the ones already here, retires anything that has sold or that people rated low, and keeps the live list to the **top 20** houses. This file is the procedure. Every run follows it and records what it did in `log/sweep-log.md`.

## Files

| File | What it holds |
|---|---|
| `properties/index.json` | The live shortlist, **at most 20 ids**, all still on the market. The map and list show only these. |
| `properties/<id>.json` | One file per house, **never deleted**. It stays even after the house leaves the shortlist. |
| `properties/archive.json` | Every house that left the shortlist: when it left, why, and its last price, AI stars and human ratings. The sweep checks this so it never re-adds a house it already dropped. |
| `log/sweep-log.md` | An append-only, human-readable log, one entry per run, newest at the bottom. |
| `log/ratings/<YYYY-MM-DD>.json` | A raw snapshot of the shared human ratings, saved each run when the service answers. People's stars and notes are kept even if the ratings database is lost. |

## Each run

1. **Sync.** Run `git -C /home/claude/ireland pull --ff-only`. If the clone is missing, call `add_repo` (gangeli/ireland, push) and clone it as the house-days skill describes.
2. **Read the people.** WebFetch `HOUSE_DAYS_RATINGS_URL` from `config.js`. It returns `{ratings:[{property, person, stars, note, updated}]}`. Save it verbatim to `log/ratings/<today>.json`. If it fails (as of 4 Oct 2026 it returned 404, so it may not be deployed), note "human ratings unavailable" in the log and rank on AI stars alone. Read the notes too: a note like "too far from Dublin" is a preference to apply when scoring similar houses. Record any lesson like that in the log.
3. **Recheck every live house** (plus any archived house marked `recheck: true`) on Daft or MyHome. Look for:
   - Sale agreed, sold, withdrawn, or a listing that 404s: set `status` to `"Sale agreed"` (or `"Passed"` for withdrawn), move the id to the archive with the reason, and set `recheck: true`. Sales do fall through, so recheck archived sale-agreed houses about weekly for 6 weeks.
   - Price change: update `price` and `stampDuty`, add a pro or con ("Price cut from €X to €Y on <date>"), and revisit `ai.stars`.
   - New facts, such as a floor plan confirming a ground-floor bedroom: update the ledger and revisit `ai.stars`.
4. **Find new candidates**, using the sources and criteria in the scheduled prompt. Build a page for each real contender with the house-days skill. Score it with `ai: {stars, why}`, where stars run 1–5 in steps of 0.5 and `why` is one plain sentence.
5. **Rank and trim to 20** (rules below), then edit `index.json` and `archive.json`.
6. **Validate, log, commit, push** (below).

## Ranking

Use the same blend the site uses, so the list and the labels agree:

```
n   = number of human ratings for the house
avg = mean human stars
blend = ai.stars                               if n == 0
      = avg                                    if no ai score
      = (1/(n+1))·ai.stars + (n/(n+1))·avg     otherwise
```

Rules, in order of precedence:

1. **People's judgment beats the AI's.** Drop a house when the people's average is ≤ 2, or when Gabor (or his family) rates it ≤ 2 with a reason. Don't argue it back in on AI stars.
2. **Never drop a house people rated ≥ 4** unless it's off the market. If such a house is the 21st, drop the lowest AI-only house instead.
3. **Mediocre human ratings (2.5–3.5) are a judgment call.** One lukewarm 3 is weak evidence. Weigh it against the facts, and against what the notes say people want. Explain the call in the log.
4. **Admit a new house only if its blend beats the current #20** (or there's room). A new house has no human ratings yet, so its AI stars are its blend. Be honest with them: don't inflate a new find to get it on the list.
5. **Fill to 20.** If dropping leaves room, the best-scoring new or archived-but-still-for-sale house can come back. Log it as a re-add.
6. **Ties go to the house that fits more hard requirements**: a ground-floor bedroom (or a room that can convert to one), land for the dogs, school and ED access, and budget.

Use judgment over arithmetic when they disagree, and say so in the log.

## Archive entry shape

```json
{ "id": "kilcoltrim-borris", "name": "Kilcoltrim", "left": "2026-10-05",
  "reason": "Dropped for Old Mill, Inistioge (AI 4.0 vs 2.0); no human ratings",
  "lastPrice": 225000, "aiStars": 2.0, "human": {"n": 0, "avg": null},
  "listingUrl": "https://…", "recheck": false }
```

`reason` is one of:
- `sale agreed` / `sold` / `withdrawn` (set `recheck: true` for sale agreed)
- `rated low by people` (quote the ratings)
- `bumped by <new house>`
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
- Judgment calls: kept Canal View over X despite lower AI because Gabor rated it 4
- Lessons from notes: "dogs need fenced land" → weighting fencing/enclosure higher
- Shortlist now 20: forty-shades (4.5), … (top-to-bottom with blend scores)
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
    assert d['id'] == i and d['lat'] and d['lng'] and len(d['trips']) == 11, i
    assert not __import__('re').search('sale agreed|sold|passed', d.get('status',''), 2), f"{i} is off-market but live"
print('ok', len(idx), 'live,', len(arc), 'archived')
EOF
git add -A properties log
git commit -m "Sweep <date>: +N added, -M archived, K updated"   # plus the session's attribution lines
git push origin HEAD:main && git push -f origin HEAD:gh-pages
```

If the push is rejected, run `git pull --rebase origin main` and push again. Never force-push `main`.
