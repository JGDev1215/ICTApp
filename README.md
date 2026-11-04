# ICT Entry Desk — static browser journal

This directory is a GitHub Pages compatible static site. It serves only HTML,
CSS and JavaScript. The entry flow uses the current manual Entry screen, NQ/ES/CL
selection, manual swept and target liquidity, buy and sell draw fields, the four
established models and the illustrative iFVG exercise, checklist, outcome and
History views. It does not fetch market prices or update observations.

Trades are saved in IndexedDB for the current browser profile and site origin.
Other devices and browsers have separate histories; this static app does not send
journal entries to GitHub Pages. Clearing site data, using private browsing, or
losing the device can remove the history. Use **Export backup** to download a
JSON copy to the device. Backups are readable and unencrypted: keep them private.
Large exports are split into numbered files; verify that every part downloaded
and import every part when restoring. Import adds missing entries and leaves
existing entries and outcomes intact; each imported file is limited to 50 MiB.
Unknown checklist versions can be retained in a backup even when their details
cannot be displayed by this version of the app. There is no account or sync.
On a phone, test a backup and restore in an isolated browser profile before
relying on it.

After a successful online visit and service-worker installation, static files
can be cached for offline reload on that same browser and site origin. The
journal can continue to save locally while offline if browser storage remains
available. A first visit needs a connection; cache eviction or clearing site
data removes the offline copy. Test an offline reload on the intended phone
before depending on it.

The browser database retains its original ictapp-pages-test-v1 name and
database version 2; this release does not migrate or clear existing entries.
Existing snapshot schemas 1, 2 and 4 remain readable. New manual reviews use
snapshot schema 5, which stores the selected NQ, ES or CL instrument alongside
the buy-side and sell-side draw fields. Older snapshots without an instrument
show **Instrument not recorded**; the app does not infer one from old entries.
The private Mac SQLite journal is separate and is not migrated or changed by
this site.

Build from the full project source root with
python3 hosting/ictapp-pages/prepare.py. For a local preview, run
python3 -m http.server 8899 --directory hosting/ictapp-pages and open
<http://127.0.0.1:8899/>. Browser storage at this local URL is separate from
the GitHub Pages URL. This repository contains the generated static site;
the full project source root also contains the test scripts. With
fake-indexeddb installed and available on NODE_PATH, run the following
from that source root:

    node tests/test_entry_pages.js
    node tests/test_entry_state.js
    node tests/test_six_model_journey.js
    node tests/test_instrument_schema5.js
    node tests/test_backup_recovery.js
    node tests/test_static_deployment.js

The build should be repeatable: rebuilding an isolated copy should leave the
generated files byte-identical. Check that the five versioned asset URLs in
index.html match the cache version in sw.js, then test the published assets
and save/backup/offline flow in a fresh browser profile with synthetic data.
The public Pages site changes only after an authorized publish; a local build
does not publish it.

The source maps describe the scope and limits of the checklists. The app records
self-reported reviews and outcomes; it does not place trades or validate price
action. No underlying private teaching files are included.
