# Product Roadmap

| Milestone | Status | Outcome |
| --- | --- | --- |
| `D-001` | Complete | Windows x64 Electron shell, user-profile runtime paths, graceful shutdown, unsigned installer, and `0.1.1` browser-link fix passed installed-app acceptance. |
| `D-002` | Complete | SQLite runtime, schema, repositories, one-source transactional JSON import, production cutover, settings migration workflow, and installed upgrade acceptance. |
| `D-003` | Complete | Electron safeStorage, Schema v2 encrypted Cookie/model keys, legacy plaintext cleanup, credential-security status, and installed upgrade acceptance. |
| `D-004` | Complete | Schema v3 extension pairing, authenticated Cookie sync, local API hardening, stable packaged extension resources, and the dedicated Edge fallback passed installed acceptance through D-004.1. |
| `D-004.1` | Complete | Electron/browser status separation, remaining pairing-attempt feedback, account-status clarification, and the unsigned `0.4.1` installer passed installed acceptance. |
| `D-005` | Awaiting installed acceptance | Automatic/manual SQLite backups, verified full-database restore, and credential-free migration packages passed automated release verification; installed upgrade and restore checks remain. |
| `D-006` | Pending separate approval | Production artwork, Windows signing, and fleet distribution acceptance. |

Only one milestone may be implemented at a time. Later milestones must not be pulled into `D-001` as incidental work.
