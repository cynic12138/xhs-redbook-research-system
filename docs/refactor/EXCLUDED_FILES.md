# Excluded Files

These files and directories are excluded from Git and from behavior-changing refactor edits unless the user explicitly changes the scope.

| Path | Reason |
| --- | --- |
| `.env` | Local secret/config file. |
| `.env.local` | Local secret/config file. |
| `.env.*` except `.env.example` | Local environment configuration. |
| `data/` | Local data, logs, media cache, scrape/runtime output. |
| `output/` | Runtime logs and Playwright output. |
| `dist/` | Build output. |
| `build/` | Build output. |
| `coverage/` | Coverage output. |
| `node_modules/` | Third-party dependency directory. |
| `.playwright-cli/` | Local Playwright runtime/tool cache. |
| `.cache/` | Local cache. |
| `uploads/` | User/runtime uploaded files. |
| `downloads/` | Runtime downloaded files. |
| `media-cache/` | Runtime media cache. |
| `*.pem`, `*.key`, `*.p12` | Private key/certificate material. |
| `credentials*`, `secrets*`, `token*`, `cookie*` | Secret-bearing file names. |
| `*.db`, `*.sqlite`, `*.sqlite3` | Local databases. |
| `*.log` | Logs. |
| `.vscode/`, `.idea/` | IDE private configuration. |

`.env.example` is tracked intentionally as example configuration.
