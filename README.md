# ICT Entry Desk — private cloud journal

This static GitHub Pages app saves signed-in reviews to the DS Legal Supabase
project. The browser contains only the project's public key. Database row
security restricts access to the designated owner and that owner's rows.
Public signup and anonymous sign-in are disabled.

A review is saved only when **Saved to cloud** appears. Refresh on another
signed-in device to retrieve it. There is no offline upload queue, automatic
local fallback, or automatic migration. An unfinished review is only a draft
in its original browser tab. The app records self-reported reviews and
outcomes; it does not fetch market prices or place trades.

The previous `ictapp-pages-test-v1` IndexedDB journal remains on the same
device and browser origin as an archive. After signing in, use **Export old
local archive** to download it. **Export cloud backup** downloads the cloud
journal. Backups are readable JSON; store them privately and keep every
numbered part. Import preserves request keys and stops on conflicts. Existing
browser-only trades do not appear in the cloud automatically.

The pinned Supabase JavaScript SDK is version 2.119.0. The service worker
caches only static site files; it does not cache Supabase Auth or journal
responses. Offline drafts cannot be considered cloud-saved. Password recovery
email delivery has not been verified for the owner account. Keep the current
password securely and do not rely on email reset until that path is tested.

The checklists and source maps retain their existing scope. To build a new
static release, use the reviewed `build_cloud.py` in the private source
workspace, verify its output and publish only the static runtime allowlist.
Do not publish build scripts, SQL, test fixtures, credentials, private
backups or journal data. Existing real browser-only records have not been
migrated. Reverting to the old local app after cloud writes requires a
separate cloud export and explicit reconciliation.
