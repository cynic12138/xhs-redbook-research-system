# D-003 Credential Security Design

## Goal

Release version `0.3.0` so the installed Windows desktop application stores the Xiaohongshu Cookie and AI model API keys as Electron `safeStorage` encrypted blobs in SQLite. Browser development mode continues to use `.env.local`.

## Architecture

- `CredentialCipher` isolates Electron `safeStorage` from server business code.
- `CredentialVault` is the only credential boundary used by authentication, model management, AI reports, content review, Goal, and tool-calling workflows.
- SQLite Schema v2 adds `secure_credentials`; it does not affect business-data emptiness or legacy JSON import checks.
- Electron configures runtime paths and the cipher after `app.whenReady()` and before importing the Express application.
- Desktop startup migrates legacy plaintext credentials before HTTP listening or background job recovery.

## Migration and Failure Rules

- Only `XHS_COOKIE_STRING` and keys matching `AI_MODEL_[A-Z0-9_]+_KEY` are migrated.
- Existing decryptable ciphertext wins over legacy plaintext.
- Migration encrypts all selected values, writes them transactionally, verifies decryption, and only then atomically removes matching plaintext lines.
- Non-sensitive settings, comments, blank lines, and UTF-8 content are preserved. No plaintext backup is created.
- Encryption or verification failure aborts desktop startup and leaves the source file unchanged.
- Cleanup failure leaves encrypted credentials active, disables plaintext fallback, reports `cleanup-required`, and allows retry.
- Unreadable ciphertext reports `reconfiguration-required`; users may overwrite it by reconnecting or entering a new key.

## Compatibility and Security

- Existing business API paths, fields, status codes, and error semantics remain unchanged.
- The new status API returns only modes, booleans, and counts. It never returns credential names, plaintext, ciphertext, or secrets.
- Model `hasApiKey` and masks reflect decryptable vault values rather than stale metadata.
- Deleting a model deletes its credential.
- Logs, errors, artifacts, exports, fixtures, and package contents must not expose credentials.

## Verification

- TDD covers Schema v1-to-v2 migration, vault behavior, key rotation, legacy cleanup, failure states, model deletion, all credential consumers, status APIs, UI state, and development compatibility.
- Release verification runs Vitest, TypeScript typecheck, web build, Electron credential smoke, desktop package, Windows installer build, and package-content inspection.
- Manual acceptance upgrades an installed `0.2.0`, validates Cookie/model/AI workflows, restarts, reconfiguration on another Windows user, and confirms plaintext credentials are absent from `.env.local`.
