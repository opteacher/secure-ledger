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
│       ├── services/         # 22 business services (account, automation, captcha, ssh...)
│       │                     # captcha.ts: OCR-based captcha recognition using Tesseract.js + sharp preprocessing. Singleton worker, lazy init. Pure local, no network.
│       ├── crypto/           # RSA/hybrid encryption, key storage
│       ├── ipc/              # 756-line IPC handler registry
│       └── database/         # sql.js SQLite wrapper
├── src/                      # Renderer (Vue 3)
│   ├── main.ts               # Vue app bootstrap
│   ├── apis/                 # IPC client wrappers
│   ├── stores/               # Pinia state (endpoint, account)
│   ├── views/                # 5 page views (Home, Login, Setup...)
│   ├── components/           # 12 Vue components
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
| Add endpoint icon | `src/components/IconPickerModal.vue` / `IconEditor.vue` / `EndpointIcon.vue` | Modal picker (Ant Design + Iconfont + upload) → editor → display |
| Add endpoint grouping | `src/views/Home.vue` (groupedEndpoints computed + DnD) / EndpointEdit.vue (datalist combo) | `group_name` column on endpoint table |
| Add captcha recognition | `electron/backend/services/captcha.ts` | Uses Tesseract.js + sharp + optional muggle_ocr |
| Resolve template variables | `electron/backend/services/templateVars.ts` | `{{key}}` substitution in slot values |
| Change OCR method | `electron/backend/services/ocrConfig.ts` | `system_config` key `ocr_method` |
| Setup portable Python | `scripts/setup-python-runtime.js` | Downloads & installs muggle_ocr runtime |
| muggle_ocr offline setup | `docs/muggle-ocr-setup.md` | 内网部署完整指南 |
| Resolve template variables | `electron/backend/services/templateVars.ts` | `{{key}}` substitution in slot values |

## CONVENTIONS

- **IPC Pattern**: All handlers in `ipc/index.ts`, services statically imported
- **Response Format**: `{ success: boolean, data?: T, error?: string }`
- **Encryption**: RSA-2048 public encrypt/private decrypt (see `crypto/rsa.ts`)
- **Styling**: TailwindCSS, primary-500 accent, neutral-900 dark
- **Formatting**: Prettier - single quotes, no semicolons, 100 char width, LF
- **TypeScript**: Strict mode, ES2020, bundler resolution, `@/*` alias for `src/`
- **Template Variables**: `{{output_key}}` syntax in slot values references captcha recognition outputs from previous steps. Resolved at execution time via `templateVars.resolveTemplateVars()`.

## CAPTCHA RECOGNITION

- **action_type**: `'captcha'` — automation step type for captcha recognition
- **output_key**: slot field storing variable name for captcha output
- **Dependencies**: `tesseract.js` (OCR), `sharp` (image preproc), `muggle_ocr` (optional Python ML)
- **Tessdata**: bundled at `resources/tessdata/eng.traineddata`, shipped via electron-builder `extraResources`
- **Execution**: Puppeteer mode only (screenshots element → OCR → stores in varStore). Webview preview skips captcha steps.
- **Variable syntax**: `{{variable_name}}` in subsequent input step values (resolved by `templateVars.ts`)

### OCR Engines

| Engine | Type | Accuracy | Requirements |
|--------|------|----------|-------------|
| **Tesseract.js** | Local WASM OCR | Medium (60-90%) | None (bundled) |
| **muggle_ocr** | Python ML | High (85%+) | Portable Python runtime (bundled) or system Python 3 + muggle_ocr |

Switch in **Settings → General → 验证码识别方案**. Falls back to Tesseract if muggle_ocr unavailable.

### Configuration

- **Storage**: `system_config` table, key `ocr_method` (`'tesseract'` | `'muggle'`)
- **Service**: `electron/backend/services/ocrConfig.ts` — `getOcrMethod()`, `setOcrMethod()`
- **IPC**: `captcha:getConfig`, `captcha:setConfig`
- **Python script**: `resources/python/muggleOCR.py` — muggle_ocr bridge

### Portable Python Runtime (内网部署)

- **Bundle**: `resources/python-runtime/` — embeddable Python 3.10 + muggle_ocr + TensorFlow
- **Setup**: `scripts/setup-python-runtime.js` — automated download & install
- **Manual setup**: Download embeddable Python 3.10 → enable pip → clone [litongjava/muggle_ocr](https://github.com/litongjava/muggle_ocr) → `pip install` deps
- **Packaging**: `electron-builder.yml` includes `resources/python-runtime → python-runtime` for production builds
- **Detection**: `ocrConfig.getBundledPythonPath()` checks bundled Python first, falls back to system Python

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
npm run mock-server   # Start mock login website (http://localhost:3456)
npm run mock-register # Register mock endpoint in database
npm run test          # Run all unit tests
npm run setup-python   # Setup portable Python runtime for muggle_ocr
```

## NOTES

- No ESLint configured (only Prettier)
- No CI/CD workflows (`.github/` absent)
- No test suite (test directory absent)
- `win7-build/` and `ttyd/` are packaging artifacts, not core code
- `release/` contains build outputs (clean before commits)
- LSP TypeScript not installed globally - use `npm run type-check` for validation