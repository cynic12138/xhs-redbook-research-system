# MVP Scope

## Current Milestone

`D-003` protects the installed desktop pilot's Xiaohongshu Cookie and AI model API keys with Electron `safeStorage` and SQLite while preserving the existing React, Express, AI, content review, and dedicated Edge login workflows.

## In Scope

- SQLite Schema v2 `secure_credentials` storage for encrypted credential blobs.
- Electron `safeStorage` encryption and decryption through a single injected credential vault.
- Automatic, idempotent migration of `XHS_COOKIE_STRING` and AI model keys from the desktop `.env.local`.
- Preservation of comments, UTF-8 text, blank lines, and non-sensitive configuration during plaintext cleanup.
- Credential-security status and retry controls in the existing model settings surface.
- Existing browser development mode continues to use `.env.local`.
- Windows x64 credential smoke, packaging, installer, and upgrade validation.

## Out of Scope

- Account management, roles, cloud deployment, or shared data.
- Extension pairing, general backup/restore, automatic updates, code signing, or custom application artwork.
- Multi-source data merging or long-term JSON/SQLite dual writes.
- Cloud sync, accounts, roles, whole-database encryption, or cross-Windows-user credential portability.
- Changes to existing business HTTP routes, response contracts, status codes, or business rules.

## Success Criteria

- Installed desktop Cookie and AI model keys are stored only as Electron-encrypted SQLite blobs.
- Successful migration removes only credential lines from `.env.local` and is safe to repeat.
- Encryption or verification failure does not modify the plaintext source; cleanup failure remains visible and retryable without plaintext fallback.
- Unreadable copied credentials require reconfiguration while business data remains available.
- Existing API contracts, D-002 storage workflows, automated tests, typecheck, web build, credential smoke, and Windows installer build pass.
- An installed `0.3.0` upgrades a validated `0.2.0` installation without losing business data or non-sensitive configuration.
