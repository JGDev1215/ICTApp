# ICTApp — browser test version

An iPhone-friendly ICT entry checklist with illustrative candlestick examples.

Entries are stored in IndexedDB in the current browser. No accounts, cloud sync or database upload. Clearing website data removes this test history. Unfinished reviews use tab-session storage.

Repeated save requests are deduplicated transactionally by their original request key, including after reload. Each intentionally new review receives a new key.

This is a test build of checklist version 2026-11-03.2. It does not place trades or verify market observations. See SOURCE_MAP.md for the supported interpretations.
