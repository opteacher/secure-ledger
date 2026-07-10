# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-10
**Commit:** 0d8e9ce
**Branch:** master

## OVERVIEW

Electron desktop app for credential management and automation login. Vue 3 + Pinia frontend, TypeScript backend with RSA/AES encryption, Puppeteer automation, SSH support.

## STRUCTURE

```
secure-ledger/
├── electron/                 # Main process backend
│   ├── main.ts               # Electron entry - window lifecycle, IPC init
│   ├── preload.ts            # ContextBridge IPC API exposure
│   └── backend/
│       ├── services/         # 21 business services (account, automation, ssh...)
│       ├── crypto/           # RSA/hybrid encryption, key storage
│       ├── ipc/              # 756-line IPC handler registry
│       └── database/         # sql.js SQLite wrapper
├── src/                      # Renderer (Vue 3)
│   ├── main.ts               # Vue app bootstrap
│   ├── apis/                 # IPC client wrappers
│   ├── stores/               # Pinia state (endpoint, account)
│   ├── views/                # 5 page views (Home, Login, Setup...)
│   ├── components/           # 9 Vue components
│   └── router/               # Vue Router config
├── scripts/                  # Build prep, test user creation
├── public/                   # Static assets, icons
├── ttyd/                     # Bundled ttyd binaries (non-standard)
└── win7-build/               # Win7 compatibility build (non-standard)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add IPC handler | `electron/backend/ipc/index.ts` | Register in `registerAllIPCHandlers()` |
| Add backend service | `electron/backend/services/` | Import in ipc/index.ts statically |
| Add encryption logic | `electron/backend/crypto/` | Use `publicEncrypt/privateDecrypt` |
| Add frontend API | `src/apis/index.ts` | Wrap `window.ipc.invoke()` |
| Add Pinia store | `src/stores/` | Use composition API pattern |
| Add Vue component | `src/components/` | Tailwind styling, no scoped CSS |
| Add page view | `src/views/` | Router entry in `src/router/index.ts` |
| Database schema change | `electron/backend/database/init.ts` | Add migration in `initTables()` |

## CONVENTIONS

- **IPC Pattern**: All handlers in `ipc/index.ts`, services statically imported
- **Response Format**: `{ success: boolean, data?: T, error?: string }`
- **Encryption**: RSA-2048 public encrypt/private decrypt (see `crypto/rsa.ts`)
- **Styling**: TailwindCSS, primary-500 accent, neutral-900 dark
- **Formatting**: Prettier - single quotes, no semicolons, 100 char width, LF
- **TypeScript**: Strict mode, ES2020, bundler resolution, `@/*` alias for `src/`

## ANTI-PATTERNS

- **DO NOT** use `privateEncrypt/publicDecrypt` (deprecated, only for migration)
- **DO NOT** suppress type errors (`as any`, `@ts-ignore`)
- **DO NOT** commit binaries (`ttyd/` folder - should be build artifacts)
- **DO NOT** use dynamic import in IPC handlers (causes race conditions)
- **DO NOT** store plaintext passwords in database (use RSA encryption)

## UNIQUE STYLES

- Chinese UI language (账号管理器 = "Account Manager")
- Splash screen on startup with progress updates
- Security key storage via OS keyring (Linux: gnome-keyring, Windows: DPAPI)
- Scheduled RSA key rotation (7-day default)
- Token-based endpoint sharing with JWT restrictions

## COMMANDS

```bash
npm run dev           # Start Electron + Vite dev server
npm run build:win     # Build Windows installer
npm run build:linux   # Build Linux deb/tar.gz
npm run type-check    # TypeScript validation
npm run create-test-user  # Create test accounts (test/admin/demo)
```

## NOTES

- No ESLint configured (only Prettier)
- No CI/CD workflows (`.github/` absent)
- No test suite (test directory absent)
- `win7-build/` and `ttyd/` are packaging artifacts, not core code
- `release/` contains build outputs (clean before commits)
- LSP TypeScript not installed globally - use `npm run type-check` for validation