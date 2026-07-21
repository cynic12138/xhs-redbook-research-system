# MVP Scope

## Current Milestone

`D-001` delivers an unsigned Windows x64 Electron pilot that runs the existing React, Express, JSON storage, AI, content review, and dedicated Edge login workflows as a local desktop application.

## In Scope

- Electron main process and single-instance desktop lifecycle.
- Runtime paths rooted in the Windows user profile for packaged builds.
- Reusable Express application/server startup and graceful shutdown.
- Electron Forge and Squirrel.Windows packaging.
- Existing browser development and production server commands remain available.

## Out of Scope

- SQLite or any database migration.
- Account management, roles, cloud deployment, or shared data.
- Credential encryption, extension pairing, backup/restore, automatic updates, code signing, or custom application artwork.
- Changes to HTTP routes, response contracts, business rules, or React interactions.

## Success Criteria

- The existing automated suite, typecheck, and web production build pass.
- A Windows x64 package and unsigned Setup.exe can be generated.
- The installed app stores runtime files under the current Windows user's application data directory.
- A second launch focuses the existing app instead of starting a second server.
- Running jobs are safely paused before an approved application exit.
