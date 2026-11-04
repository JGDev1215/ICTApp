# ICT Entry Desk — static browser journal

This directory is a GitHub Pages compatible static site. It serves only HTML,
CSS and JavaScript. The entry flow uses the current manual Entry screen, NQ/ES/CL
selection, manual swept and target liquidity, buy and sell draw fields, the four
established models and the illustrative iFVG exercise, checklist, outcome and
History views. It does not fetch market prices or update observations.

Trades are saved in IndexedDB for the current browser profile and site origin.
Other devices and browsers have separate histories; GitHub Pages does not receive
trade data from this app. Clearing site data, using private browsing, or losing
the device can remove the history. Use **Export backup** to download a JSON copy
to the device. **Import backup** adds missing entries and leaves existing entries
and outcomes intact. Keep backup files private. There is no account or sync.

After the first successful online visit, a service worker caches the static
files for offline reload on that same browser and site origin. The journal
continues to save locally while offline. A first visit still needs the site to
load, and browser cache/site-data clearing removes the offline copy.

The browser database retains its original `ictapp-pages-test-v1` name so the
previous static test's history remains available on the same origin. Existing
schema-1 and schema-2 entries remain readable. New manual reviews use schema 4
for draw fields. The private Mac SQLite journal is separate and is not migrated
or changed by this site.

Build from the project root with `python3 hosting/ictapp-pages/prepare.py`.
For a local preview, serve this directory with a static HTTP server, for example
`python3 -m http.server 8899 --directory hosting/ictapp-pages`, then open
<http://127.0.0.1:8899/>. Browser storage at this local URL is separate from
the GitHub Pages URL. The public Pages site changes only after an authorized
publish of this directory; this local build does not publish it.

The source maps describe the scope and limits of the checklists. The app records
self-reported reviews and outcomes; it does not place trades or validate price
action. No underlying private teaching files are included.
