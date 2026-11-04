# ICT Entry Desk — cloud release candidate

This candidate connects the static GitHub Pages app to the selected Supabase
project through its public browser key and Supabase Auth. A restrictive database
policy permits only the designated owner's Auth ID, in addition to row ownership.
Public signup and anonymous sign-in are disabled. No admin credentials are bundled.

Reviews are saved to `public.entry_reviews` only after sign-in and server
acknowledgement. Refresh on another signed-in device to retrieve changes. There
is no offline upload queue, automatic local fallback or automatic data migration.
Saved checklist details are immutable; only outcomes can be updated, using
revision checks to prevent stale edits.

The old `ictapp-pages-test-v1` IndexedDB journal remains intact as an archive.
After signing in, use **Export old local archive** or **Export cloud backup** as
appropriate. Keep JSON backups private. Imports preserve request keys and stop
on conflicts. An unfinished review remains a draft in its original browser tab.

The pinned Supabase JavaScript SDK is version 2.119.0. Only static same-origin
assets are cached; Supabase Auth and journal responses are never cached by the
service worker. Checklists and source maps retain their existing scope. This app
records self-reported reviews; it does not fetch prices or place trades.

This branch is a draft release. The owner browser sign-in/save, two-browser
refresh and live backup checks must pass before merging to the Pages branch.
Existing real journal data has not been migrated. Republish the old local app
only after reconciling any cloud-only writes and outcome edits.
