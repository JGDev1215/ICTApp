# ICTApp — browser test build

This static bundle includes the complete entry flow: optional Liquidity before Model, all five entry models and their existing source-linked examples, saved entry-time answers, independent trade outcomes, and an all-time History scoreboard. The local source is `entry-model-dashboard`; `prepare.py` copies it and changes only its storage transport and packaged source links.

The public [ICTApp browser test](https://jgdev1215.github.io/ICTApp/) is built from this folder. This candidate includes the dealing-range extension, swept-liquidity columns and illustrative iFVG wording. A commit to the configured Pages branch triggers publication; check the deployed asset hashes before treating the site as updated. Real-browser acceptance of this revision is still pending. Browser records remain local to each visitor.

## Storage and scoring

Records stay in IndexedDB in the current browser. No accounts, cloud sync, local-server connection or database upload. Clearing site data removes this history; unfinished reviews and uncertain-save metadata use tab-session storage.

The database retains its original `ictapp-pages-test-v1` name and upgrades its version without deleting the original object store or retry index. Old entries keep Met / Not met and show detailed quality as unavailable. New entries store immutable checklist answers and optional liquidity/dealing-range context in snapshot schema 2. Schema-1 entries keep their original content and show range as Not recorded. Outcomes update the same record without altering its original snapshot.

Win points count Wins. Win rate includes Win, Loss and Break-even. Quality is the average of each eligible review's unrounded required-check percentage; full-checklist rate counts exactly complete reviews. All-time totals cover every entry, even though the list displays the newest 50. Missing denominators display unavailable. Skipping Liquidity has no scoring effect.

Entry creation and request-key lookup share one transaction. Retries after a lost response/reload return the original record; changed contents under the same key conflict. The frozen checklist ruleset remains available for historical retries. Known committed requests from other versions remain confirmable; new unsupported payloads are rejected rather than silently relabelled.

## Preparing and testing

From the project root:

```sh
python3 hosting/ictapp-pages/prepare.py
node --check hosting/ictapp-pages/app.js
node --check hosting/ictapp-pages/browser-log.js
NODE_PATH=/tmp/ictapp-pages-test-tools/node_modules node tests/test_entry_pages.js
```

The browser-store tests require `fake-indexeddb` as a test-only dependency. The test command uses the isolated installation available in this work session; another environment must install that package and supply its module path. Tests use new in-memory databases, never the user's real website history.

For a local preview, serve only this folder with an HTTP static server. Do not mistake its browser log for the local Python/SQLite log.

This build preserves checklist version `2026-11-03.2` for the original models and older iFVG records. New iFVG reviews use illustrative version `2026-11-03.3`; its six self-reported checks remain in checklist-quality aggregates, while trade-outcome scoring is unchanged. See `SOURCE_MAP.md` and `SOURCE_MAP_IFVG_2026-11-03.3.md` for the separate scopes. This build does not place trades or verify market observations. Mobile viewport checks do not establish physical-iPhone or VoiceOver validation.
