---
name: Vercel deploy gotchas
description: Rules for deploying pregnancy-tracker from GitHub to Vercel
---

Rule: patterns in `.vercelignore` follow gitignore semantics — a bare `lib` matches ANY folder named lib at any depth, including `src/lib` inside apps. Always anchor root-only excludes with a leading slash (`/lib`).

**Why:** A bare `lib` entry made Vercel delete the tracker's `src/lib` (utils/storage/notifications) before building, failing the build with ENOENT while the local build passed.

**How to apply:** Any Vercel build error about a missing file that exists locally and in git → check `.vercelignore` first. Also: the tracker must not carry tsconfig references or workspace deps on `/lib` packages, since Vercel excludes them.
