# MVP Scope

## Current Internal Release

`0.5.0` is the accepted internal Windows release. D-001 through D-005 are complete, and there is no active productization milestone.

## Accepted Baseline

- Live SQLite backups through the built-in `node:sqlite.backup()` API.
- One daily backup per local date, unlimited manual backups, and bounded daily/safety retention.
- A versioned gzip data-package format with SHA-256, SQLite integrity, foreign-key, Schema, and count validation.
- Full local restore that first creates a safety backup, stops background work, closes SQLite, performs recoverable replacement, and restarts Electron.
- Credential-free migration packages that retain business data and model configuration while removing machine-bound credentials, pairing, and account state.
- Minimal backup, migration, file-dialog, fixed-directory, and prepared-restore controls in the existing data-storage settings.

## Out of Scope

- Account management, roles, cloud deployment, or shared data.
- Native Messaging, extension-store publishing, enterprise extension policy, cloud backup, automatic updates, code signing, or custom application artwork. These are intentionally deferred and are not release blockers for internal use.
- Multi-source data merging or long-term JSON/SQLite dual writes.
- Cloud sync, accounts, roles, whole-database encryption, or cross-Windows-user credential portability.
- Changes to existing business HTTP routes, response contracts, status codes, or business rules.
- Selective data merging, password-protected packages, whole-database encryption, or a new database migration.

## Success Criteria

- Daily and manual backups are consistent under WAL writes and never package partial database copies.
- Local restore retains same-user encrypted credentials and can recover the prior database after an interrupted or failed replacement.
- Migration packages contain no encrypted credentials, pairing hash, or saved account state while preserving business IDs, ordering, and relations.
- Corrupt, changed, incompatible, or non-sanitized packages are rejected before the live database is closed.
- Existing business APIs, SQLite Schema v3, safeStorage, extension pairing, dedicated Edge login, content review, automated tests, typecheck, build, credential smoke, and Windows installer remain compatible.
