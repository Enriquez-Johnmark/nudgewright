# Roadmap

Where Nudgewright stands and what comes next, in one page. What each release changed is in `CHANGELOG.md`. Updated 2026-10-25.

## Where we are

**v0.4.0** (2026-10-24). The engine runs Kompleto (pinned at v0.2.0) and Balanse (v0.4.0):

| Release | What it brought |
|---|---|
| v0.1.0 | The engine split out of Kompleto: outbox, approval and sending exactly once, mail providers, inbound replies and delivery events, encrypted files and virus scanning, the AI client and cost log, jobs, audit log, tenant erasure, clock, signed links, typed IDs |
| v0.2.0 | Renamed from Loopwright (trademark clash) |
| v0.3.0 | `accounts` (login links, sessions, staff, sign-up, closing) and `sheets` (CSV and sandboxed Excel), moved from Kompleto for Balanse |
| v0.4.0 | A deferred message stays approved, so it expires and can be cancelled; `CheckFailed::NotUntil` holds a message until a time; a Draft deadline for approval only |

Release tags are signed from v0.2.0 on; the owner pushes each tag from a bundle (the build environment can't push tags).

## Next

Engine work is driven by what the products need; nothing is built for a product that doesn't exist yet.

1. **For Balanse M2–M5:** whatever the Debtor page, proof files, delivery events and retention turn out to need that isn't product-specific. Candidates so far: none confirmed.
2. **The outbox refuses address lists:** `to_address` with a comma or semicolon is refused by the engine itself, not only by each product's pre-send check.
3. **Kompleto moves onto `accounts`:** no engine change expected; if the move finds one, it's a patch release.
4. **Delivery events in the engine** stay as they are until a second product needs more than Kompleto's bounce and complaint handling.

## Rules that don't change

- Semantic versions; while `0.x`, a breaking change bumps the minor number.
- A released migration is never edited; products pin a release by the commit its tag points to.
- The engine never names a product (CI fails if `src/` or `migrations/` mention one).
