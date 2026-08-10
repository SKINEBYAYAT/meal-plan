---
name: PWA service worker caching
description: Why users saw stale builds on phones and the rule for the tracker's custom SW
---

Rule: the pregnancy-tracker custom service worker must stay **network-first with cache fallback** for same-origin GET requests, and `CACHE_NAME` (pnt-vN) must be bumped whenever cached content needs a forced purge.

**Why:** The original cache-first SW served an old bundle on the user's iPhone forever — they saw "No meals planned" for days even though the code was fixed and verified in preview. Cache-first for HTML/JS makes deploys invisible to installed PWAs.

**How to apply:** Any edit to `src/sw.ts` fetch logic must preserve network-first for HTML/JS. If a stale-client report comes in ("app doesn't show my changes on my phone"), suspect the SW cache first, not the app logic — verify via preview screenshot before touching data code.

Related: the user's meal data is bundled in `src/data/defaultMeals.ts` and must always render regardless of localStorage state (defaults are authoritative; no tombstones — deleting a default meal resets it).
