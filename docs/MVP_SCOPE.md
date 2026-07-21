# MVP Scope

## Current Milestone

`D-002` replaces the desktop pilot's JSON persistence with a local SQLite database while preserving the existing React, Express, AI, content review, and dedicated Edge login workflows.

## In Scope

- SQLite runtime lifecycle, versioned schema migrations, WAL, foreign keys, and busy timeout.
- Domain repositories for all existing JSON-backed business data.
- Transactional import of one legacy JSON data directory without modifying its files.
- A minimal migration status, preview, and execute workflow in the existing settings surface.
- Built-in `node:sqlite` runtime validation in Node and packaged Electron, plus Windows x64 installer validation.
- Existing browser development and production server commands remain available.

## Out of Scope

- Account management, roles, cloud deployment, or shared data.
- Credential encryption, extension pairing, general backup/restore, automatic updates, code signing, or custom application artwork.
- Multi-source data merging or long-term JSON/SQLite dual writes.
- Changes to HTTP routes, response contracts, business rules, or React interactions.

## Success Criteria

- All legacy JSON collections migrate with IDs, ordering, and relationships preserved.
- Production services no longer import `LocalStore`; new writes go only to `app.db`.
- Import failures roll back without modifying legacy JSON or exposing credentials.
- Existing API contracts, automated tests, typecheck, web build, and Windows installer build pass.
- An installed `0.2.0` upgrades a `0.1.1` data directory and safely persists new data across restarts.
