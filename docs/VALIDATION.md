# Validation and release checklist

## Automated checks

The GitHub `Verify pilot workflows` workflow runs on pull requests and the work branch:

- Domain tests: geography, duplicate compatibility, priority, credits, capacity/route sequencing, correct matrix indexing after filtering, driving-time deferrals and variable-length forecast history.
- API integration tests using a real isolated MongoDB replica set: role enforcement, corrupt-image rejection, metadata stripping, server-owned evidence, report ownership, idempotency, geographic validation, duplicate consolidation, household privacy, e-waste exclusions, reviewed support priority, stale route rejection, assignment, closure proof, specialist handoff, reopening/credit reversal and explicit road-service failure.
- TypeScript and Vite production build.
- Browser workflow: mobile citizen registration and GPS household reporting → desktop operator verification → evidence-backed receiving-service handoff → citizen status visibility → reopening.

External road responses in integration tests are controlled local fixtures. Browser GPS is a test coordinate. These prove application behavior, not the availability of your deployed providers, a real collection fleet or a recycler partnership. Test images/accounts are isolated from deployment data.

Local environment limitation during development: MongoDB process startup returned `Operation not permitted`, and the browser download was unavailable. The first API/database/build CI run passed in GitHub Actions; use the latest run on the PR to determine the final tested commit. Browser screenshots are uploaded as CI artifacts.

## Manual checks on the actual deployed site

| Action | Expected result |
|---|---|
| Register citizen; sign out/in | Persistent account, citizen permissions |
| Try operator route as citizen | Access denied / citizen redirect |
| Upload real JPEG/PNG/WebP | Persistent uploaded photo; no placeholder on error |
| Reject GPS permission | Clear message; map pin still available |
| Tap/drag pin; confirm coordinates | Actual chosen position; boundary validated |
| Choose household mode | Item/quantity requested; no public location leakage |
| Repeat submit after network interruption | Same request, no extra event/credits |
| Second account supports matching event | One event; pending evidence; no priority boost until reviewed |
| Operator verifies category/severity/weight | Auditable status transition and priority breakdown |
| Configure actual vehicle/depot | Real saved capacity and supported stream |
| Preview ordinary route | Only compatible verified stops; actual road-service geometry and estimates |
| Change a stop after preview, then assign old preview | Stale plan rejected; fresh preview required |
| View e-waste/household request | Separate handoff workflow; not on normal truck route |
| Resolve without evidence/reference | Rejected where required |
| Record an actual completion/handoff | Photo, note, status and reference visible to its reporter |
| Reopen unresolved completion | Back to operator review; completion credits revoked |
| Restart API/reload app | Records/photos retained |
| Open forecast on fresh database | Insufficient history, no synthetic hotspots |
| Lose network/routing service | Error or retry state; no false success |
| Inspect a second citizen's private report URL | No access |

## What is not certified by these checks

This suite does not certify municipal adoption, recycler authorization, independent receipt validation, production-scale load, service-level uptime, identity uniqueness, legal compliance or actual environmental savings. Those require operating agreements, deployment controls and field evidence.
