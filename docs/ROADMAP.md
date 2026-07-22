# Product Roadmap

| Milestone | Status | Outcome |
| --- | --- | --- |
| `D-001` | Complete | Windows x64 Electron shell, user-profile runtime paths, graceful shutdown, unsigned installer, and `0.1.1` browser-link fix passed installed-app acceptance. |
| `D-002` | Complete | SQLite runtime, schema, repositories, one-source transactional JSON import, production cutover, settings migration workflow, and installed upgrade acceptance. |
| `D-003` | Complete | Electron safeStorage, Schema v2 encrypted Cookie/model keys, legacy plaintext cleanup, credential-security status, and installed upgrade acceptance. |
| `D-004` | Installed acceptance issues found | Automated verification passed; D-004.1 must resolve Electron extension detection, remaining-attempt feedback, and account/pairing status clarity before installed acceptance completes. |
| `D-004.1` | Awaiting installed acceptance | Automated verification and the unsigned `0.4.1` installer are complete; the three recorded fixes still require the installed checklist before merge or push. |
| `D-005` | Pending separate approval | Automatic backups, restore, and credential-free migration packages. |
| `D-006` | Pending separate approval | Production artwork, Windows signing, and fleet distribution acceptance. |

Only one milestone may be implemented at a time. Later milestones must not be pulled into `D-001` as incidental work.
