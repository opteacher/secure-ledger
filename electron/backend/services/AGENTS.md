OVERVIEW
22 TypeScript services implementing the domain logic for accounts, endpoints, automation, SSH, browser automation, Chromium, captcha, key rotation, and token reception.

WHERE TO LOOK
- account.ts: Manages account lifecycle, persistence hooks, and encryption boundaries. Provides create/update/read helpers with strict input validation.
- endpoint.ts: Handles endpoint registration, validation, and mapping to account contexts. Centralizes endpoint policy and routing decisions.
- automation.ts: Encapsulates automation workflows, orchestration of tasks, and scheduling hooks for reproducible runs.
- ssh.ts: Manages SSH credential storage, key handling, and session lifecycle with secure storage and retrieval.
- browser.ts: Provides high-level browser automation orchestration (wrapper around chromium Puppeteer-like APIs) and clean error translation.
- captcha.ts: Tesseract.js OCR service for captcha image recognition. Uses sharp preprocessing (greyscale, normalize, 4x resize, sharpen, contrast boost). Singleton worker with Electron v5 fallback for local langPath. Pure offline, no network.
- chromium.ts: Configures and manages Chromium runtime, headless modes, and environment controls used by other services.
- keyRotation.ts: Implements cryptographic key rotation policies, re-encrypting stored data and updating references safely.
- tokenReceiver.ts: Accepts and validates tokens granted to accounts/endpoints, persists them, and emits appropriate events.
- Common pattern: All services are statically imported in electron/backend/ipc/index.ts to avoid race conditions and ensure deterministic startup behavior.

CONVENTIONS
- Follow project-wide TypeScript strict mode and ES2020 language features. Each service exports pure, testable functions with clear error propagation.
- Use centralized error types and consistent return shapes to simplify IPC translation.

ANTI-PATTERNS
- Do not perform heavy work at module import time. All heavy lifting must be triggered by IPC calls and executed asynchronously.
- Do not leak plaintext secrets through in-memory logs. Use encryption boundaries and redact sensitive fields in error messages.
- Do not access UI or DOM in services. Keep all business logic server-side and IPC-driven.
- Do not bypass transaction boundaries when updating related records across accounts/endpoints. Use explicit commit/rollback patterns where applicable.
- Do not hard-code environment specifics; rely on configuration and the existing crypto/database abstractions.
- Do not duplicate business rules in multiple services; centralize policy in a single well-documented module and reference it from each service.
