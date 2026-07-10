Overview: Security-critical cryptography primitives used by the Electron backend crypto module.

WHERE TO LOOK
- rsa.ts: Exposes publicEncrypt/privateDecrypt as the CORRECT path for encryption/decryption. DEPRECATED path privateEncrypt/publicDecrypt exists only for migrating legacy data; new code must not use them. Tests cover migration scenarios.
- hybrid.ts: Implements hybrid encryption for large data. Flow: generate ephemeral symmetric key, encrypt data with symmetric cipher, then wrap the key with RSA and store/transport the bundle.
- simple.ts: PBKDF2-based password hashing with per-user salt and a configurable iteration count; derives strong keys for authentication/verification.
- secureKeyStorage.ts: OS keyring integration. Uses DPAPI on Windows and GNOME Keyring on Linux; enables secure storage of keys and credentials used by crypto operations.

Notes: Each module exposes a small, focused API surface with explicit input/output contracts to minimize surface area and risk.

CONVENTIONS
- Align with project-wide TypeScript strict mode, explicit error handling, and consistent export shapes.
- Use RSA-2048 where applicable; wrap cryptographic calls in small, testable units.
- Do not log sensitive material (keys, salts, ciphertext) in plaintext or via verbose logs.
- Favor asynchronous crypto operations to avoid blocking the UI/main thread.
- Keep keys in memory for the minimal required window; zeroize or discard when done.
- Documentation through JSDoc-like comments for exported functions and data structures.
- Tests and type checks: ensure modified modules compile cleanly and pass unit tests.

ANTI-PATTERNS
- DO NOT use privateEncrypt/privateDecrypt for new code. They are deprecated and reserved for migration only.
- Do not bypass secureKeyStorage; always persist sensitive material via OS keyring integrations.
- Do not implement ad-hoc crypto primitives or custom schemes; use the provided wrappers and standard primitives.
- Do not retain private keys in long-lived memory; release promptly after use.
- Do not expose salts, IVs, or derived keys through logs or error messages; treat them as confidential state.

Open questions or migration notes:
- When migrating legacy privateEncrypt/publicDecrypt usage, introduce gradual deprecation warnings and tests.

<!-- OMO_INTERNAL_INITIATOR -->
