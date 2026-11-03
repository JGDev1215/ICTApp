"""Prepare the static test bundle from the current local UI, without publishing."""
from pathlib import Path
import hashlib
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = ROOT / "entry-model-dashboard"
source = (SOURCE / "app.js").read_text()
transport = re.compile(r'async function fetchEntriesJSON\([^\n]*\)\{[\s\S]*?\n\}')
replacement = '''async function fetchEntriesJSON(options,url="/api/entries"){
  return window.entryBrowserLog(options,url);
}'''
prepared, count = transport.subn(lambda _: replacement, source)
if count != 1:
    raise SystemExit("Expected exactly one local API transport")
# Keep source provenance in the packaged map. Local knowledge-tree files are not
# published with this static test site, so do not expose dead navigation links.
prepared, models = re.subn(r'sources:\[[^\n]*?\](?=\})', 'sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]', prepared)
if models != 5:
    raise SystemExit("Expected exactly five model source lists")
prepared = re.sub(r'^const (referenceHref|scopeHref|ep6Href|lecture8Href|lecture13Href) = .*;\n', '', prepared, flags=re.M)
digest = hashlib.sha256(source.encode()).hexdigest()
(HERE / "app.js").write_text('// Local UI SHA-256: ' + digest + '\n' + prepared)
css = (SOURCE / "styles.css").read_text() + '\n.test-notice{margin:0;padding:10px 20px;background:#fff5df;color:#675019;font-size:12px;line-height:1.5;text-align:center}\n'
(HERE / "styles.css").write_text(css)
html = (SOURCE / "index.html").read_text().replace('<script src="app.js" defer></script>', '<script src="browser-log.js" defer></script>\n  <script src="app.js" defer></script>')
html = html.replace('<main id="screen"', '<p class="test-notice">Browser test · History stays in this browser.<br>No sync. Clearing website data removes it.</p>\n    <main id="screen"')
(HERE / "index.html").write_text(html)
source_map = (SOURCE / "SOURCE_MAP.md").read_text()
source_map = re.sub(r'\[([^\]]+)\]\((?:\.\./)[^)]*\)', r'\1', source_map)
(HERE / "SOURCE_MAP.md").write_text(source_map + "\nThis test site includes source summaries only. The underlying local study material is not published here. Entries are self-reported observations, not automated market validation.\n")
print('Prepared static UI; local app SHA-256:', digest)
