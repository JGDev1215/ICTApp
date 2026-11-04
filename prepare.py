"""Prepare the static test bundle from the current local UI, without publishing."""
from pathlib import Path
import hashlib
import os
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = Path(os.environ.get("ICT_ENTRY_SOURCE", ROOT / "entry-model-dashboard"))
source = (SOURCE / "app.js").read_text()
transport = re.compile(r'async function fetchEntriesJSON\([^\n]*\)\{[\s\S]*?\n\}')
replacement = '''async function fetchEntriesJSON(options,url="/api/entries"){
  return window.entryBrowserLog(options,url);
}'''
prepared, count = transport.subn(lambda _: replacement, source)
if count != 1:
    raise SystemExit("Expected exactly one local API transport")
# Fail closed if a retained historical/price handler is ever reached. The
# manual static flow has no network transport.
prepared = prepared.replace('"use strict";\n', '"use strict";\nconst fetch=()=>Promise.reject(new Error("Network access disabled in static app"));\n', 1)
# The static bundle runs the current manual-entry screen and schema-4 draw
# snapshot without asking the Mac server for its capability endpoint.
prepared, count = re.subn(r'let phase2PersistentLocal=false;', 'let phase2PersistentLocal=true;', prepared)
if count != 1:
    raise SystemExit("Expected one private-mode flag")
prepared, count = re.subn(r'async function loadPhase2Capability\(\)\{[\s\S]*?\n\}',
                          'async function loadPhase2Capability(){ /* Static manual mode. */ }', prepared, count=1)
if count != 1:
    raise SystemExit("Expected one capability loader")
prepared = prepared.replace('restoreDraft();\nloadPhase2Capability();',
                            "restoreDraft();\nif(!state.marketInstrument)state.marketInstrument='NQ_continuous_provisional';\nloadPhase2Capability();", 1)
# Static Pages has no local dashboard server. Keep storage recovery guidance
# specific to browser storage without changing the private Mac UI source.
storage_messages = {
    'Connecting to the local entry log…': "Opening this browser's journal…",
    'Local entry log unavailable. Start the dashboard server to save.':
        'Browser journal unavailable. Check site storage and free space, close other ICT Entry Desk tabs, then refresh.',
}
for old, new in storage_messages.items():
    if prepared.count(old) != 1:
        raise SystemExit(f"Expected exactly one static storage message: {old}")
    prepared = prepared.replace(old, new, 1)
# Keep source provenance in the packaged map. Local knowledge-tree files are not
# published with this static test site, so do not expose dead navigation links.
prepared, models = re.subn(r'sources:\[[^\n]*?\](?=\})', 'sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]', prepared)
if models != 5:
    raise SystemExit("Expected exactly five model source lists")
prepared, illustrative_link = re.subn(
    r'(\{id:"ifvg",[^\n]*?)sources:\[\{label:"Checklist source notes",href:"SOURCE_MAP.md"\}\]',
    lambda match: match.group(1) + 'sources:[{label:"Illustrative iFVG scope · v2026-11-03.3",href:"SOURCE_MAP_IFVG_2026-11-03.3.md"},{label:"Earlier source map · v2026-11-03.2",href:"SOURCE_MAP.md"}]',
    prepared,
)
if illustrative_link != 1:
    raise SystemExit("Expected exactly one illustrative iFVG source link")
prepared = re.sub(r'^const (referenceHref|scopeHref|ep6Href|lecture8Href|lecture13Href) = .*;\n', '', prepared, flags=re.M)
source_digest = hashlib.sha256(source.encode()).hexdigest()
worker_template = re.sub(
    r"const CACHE='ict-entry-desk-static-[^']+';",
    "const CACHE='ict-entry-desk-static-VERSION';",
    (HERE / "sw.js").read_text(),
)
bundle = hashlib.sha256()
for path in (
    HERE / "prepare.py",
    SOURCE / "app.js", SOURCE / "styles.css", SOURCE / "index.html",
    SOURCE / "SOURCE_MAP.md", SOURCE / "SOURCE_MAP_IFVG_2026-11-03.3.md",
    HERE / "browser-log.js", HERE / "backup-ui.js", HERE / "offline.js",
):
    bundle.update(str(path.relative_to(HERE) if path.is_relative_to(HERE) else path.name).encode())
    bundle.update(b"\0")
    bundle.update(path.read_bytes())
    bundle.update(b"\0")
bundle.update(worker_template.encode())
digest = bundle.hexdigest()
(HERE / "app.js").write_text('// Local UI SHA-256: ' + source_digest + '\n' + prepared)
worker = (HERE / "sw.js").read_text()
worker, worker_count = re.subn(r"const CACHE='ict-entry-desk-static-[^']+';",
                              f"const CACHE='ict-entry-desk-static-{digest[:12]}';", worker, count=1)
if worker_count != 1:
    raise SystemExit("Expected one static cache version")
(HERE / "sw.js").write_text(worker)
css = (SOURCE / "styles.css").read_text() + '\n.test-notice{margin:0;padding:10px 20px;background:#fff5df;color:#675019;font-size:12px;line-height:1.5;text-align:center}.backup-actions{display:flex;gap:8px;flex-wrap:wrap;padding:8px 20px}.backup-actions button{min-height:44px}.backup-actions input{display:none}.load-status{margin:8px 20px;padding:10px 12px;border:1px solid #a34743;background:#fbe9e7;color:#6e2724;line-height:1.5}.load-status[hidden]{display:none}\n'
(HERE / "styles.css").write_text(css)
html = (SOURCE / "index.html").read_text().replace('<script src="app.js" defer></script>', '<script src="browser-log.js" defer></script>\n  <script src="app.js" defer></script>')
html = html.replace('  <script src="market-context.js" defer></script>\n', '')
html = html.replace('</head>', '''  <script>
    window.ictAssetLoadFailed=false;
    window.addEventListener('error',event=>{
      if(event.target instanceof HTMLScriptElement || event.target instanceof HTMLLinkElement)window.ictAssetLoadFailed=true;
    },true);
  </script>
</head>''')
html = html.replace('<main id="screen"', '<p class="test-notice">Trades stay in this browser on this device. Other browsers and devices have separate histories. Clearing site data can erase this one.</p>\n    <div class="backup-actions"><button id="export-backup" type="button">Export backup</button><button id="import-backup" type="button">Import backup</button><input id="backup-file" type="file" accept="application/json,.json" aria-label="Choose backup JSON"><span id="backup-status" role="status"></span></div>\n    <p id="asset-status" class="load-status" role="alert" hidden></p><p id="offline-status" class="load-status" role="status" hidden></p>\n    <main id="screen"')
html = html.replace('<main id="screen" class="screen"></main>', '<main id="screen" class="screen"><noscript><p class="load-status">ICT Entry Desk needs JavaScript to show reviews and access this browser\'s journal. Enable JavaScript, then reload.</p></noscript></main>')
html = html.replace('</body>', '''  <script>
    window.addEventListener('load',()=>{
      if(!window.ictAssetLoadFailed && typeof window.entryBrowserLog==='function' && document.querySelector('#screen h1'))return;
      const status=document.getElementById('asset-status');
      status.hidden=false;
      status.textContent='ICT Entry Desk did not finish loading. Reconnect and reload. If this continues, check site storage and use your downloaded backup.';
    });
  </script>
</body>''')
html = html.replace('<script src="app.js" defer></script>', '<script src="app.js" defer></script>\n  <script src="backup-ui.js" defer></script>')
html = html.replace('<script src="backup-ui.js" defer></script>', '<script src="backup-ui.js" defer></script>\n  <script src="offline.js" defer></script>')
for asset in ('styles.css', 'browser-log.js', 'app.js', 'backup-ui.js', 'offline.js'):
    html = html.replace(f'"{asset}"', f'"{asset}?v={digest[:12]}"')
(HERE / "index.html").write_text(html)
source_map = (SOURCE / "SOURCE_MAP.md").read_text()
source_map = re.sub(r'\[([^\]]+)\]\((?:\.\./)[^)]*\)', r'\1', source_map)
(HERE / "SOURCE_MAP.md").write_text(source_map + "\nThis test site includes source summaries only. The underlying local study material is not published here. Entries are self-reported observations, not automated market validation.\n")
ifvg_map = (SOURCE / "SOURCE_MAP_IFVG_2026-11-03.3.md").read_text()
ifvg_map = re.sub(r'\[([^\]]+)\]\((?:\.\./)[^)]*\)', r'\1', ifvg_map)
(HERE / "SOURCE_MAP_IFVG_2026-11-03.3.md").write_text(ifvg_map + "\nThis test site includes source summaries only. The underlying local study material is not published here.\n")
print('Prepared static UI; local app SHA-256:', source_digest, 'bundle version:', digest[:12])
