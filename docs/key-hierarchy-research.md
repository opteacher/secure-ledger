# 层级密钥管理研究报告

> **需求**: 根密钥可解密所有子密钥加密的密文，适用于本地离线环境

---

## 一、需求分析

| 需求 | 说明 |
|------|------|
| 根密钥 | 用户掌控的主密钥，可解密一切 |
| 子密钥 | 每个登录端独立的密钥对 |
| 解密安全 | 子私钥必须绝对安全存储 |
| 加密简便 | 子公钥可以简单存储 |
| 根密钥恢复 | 根密钥可解密任意子密钥加密的密文 |
| 运行环境 | 本地离线，无云端 KMS |

---

## 二、现成方案概览

| 方案 | 根密钥解密能力 | 复杂度 | 标准 | 推荐度 |
|------|:---:|:---:|------|:---:|
| **A. 密钥包装 (Key Wrapping)** | ✅ 完全 | 低 | RFC 3394, NIST SP 800-38F | ⭐⭐⭐⭐⭐ |
| **B. HKDF 确定性派生** | ✅ 完全 | 中 | RFC 5869, NIST SP 800-108 | ⭐⭐⭐⭐ |
| **C. BIP32 式层级派生** | ✅ 完全 | 高 | BIP32/BIP44 | ⭐⭐⭐ |
| **D. PGP 子密钥体系** | ❌ 不支持 | - | RFC 4880 | ❌ |
| **E. NaCl/Libsodium crypto_kdf** | ⚠️ 部分 | 低 | — | ⭐⭐ |

---

## 三、方案详解

### 方案 A: 密钥包装 (Key Wrapping) — **强烈推荐**

**原理**: 根密钥（AES-256）加密每个子密钥对的私钥部分，存储时保存 `加密后的子私钥` + `子公钥`。

```
┌─────────────────────────────────────────────────────┐
│                    根密钥 (AES-256)                    │
│         存储于: OS Keyring (DPAPI/Keychain)            │
└──────────┬──────────────┬──────────────┬─────────────┘
           │              │              │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌───▼──────────┐
    │  端点 #1     │ │  端点 #2   │ │  端点 #3      │
    │              │ │            │ │               │
    │ RSA-2048     │ │ RSA-2048   │ │ RSA-2048      │
    │ 公钥: 明文   │ │ 公钥: 明文 │ │ 公钥: 明文    │
    │ 私钥: E(root)│ │ 私钥:E(root)│ │ 私钥: E(root) │
    └──────────────┘ └────────────┘ └───────────────┘
```

**加密流程**:
```
1. endpoint.create():
   生成 RSA-2048 密钥对 (SubPub, SubPriv)
   EK = AES-256-GCM(RootKey, SubPriv)  // 根密钥加密子私钥
   存储: { subPublicKey: SubPub, encryptedSubPrivateKey: EK }

2. slot.encrypt(plaintext):
   hybridEncrypt(plaintext, SubPub)  // 用子公钥加密（现有逻辑）
   → 存储到数据库

3. slot.decrypt(ciphertext):
   SubPriv = AES-256-GCM-Decrypt(RootKey, EK)  // 根密钥解密子私钥
   hybridDecrypt(ciphertext, SubPriv)           // 用子私钥解密
```

**根密钥恢复能力**: 根密钥 → 解密 `EK` → 获得 `SubPriv` → 解密任何 slot 密文 ✅

**安全特性**:
- 子私钥永不明文存储（被根密钥加密）
- 子公钥明文存储（用于加密，泄露无害）
- 根密钥离线存储于 OS Keyring（DPAPI/Keychain/Secret Service）
- 每个端点独立密钥对 → 单端点泄露不影响其他端点

**实现依赖**: 仅需 AES-256-GCM + 现有 RSA 基础设施，**零额外依赖**。

**参考标准**:
- RFC 3394: AES Key Wrap Algorithm
- NIST SP 800-38F: Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping
- NIST SP 800-57 Part 1: Recommendation for Key Management

---

### 方案 B: HKDF 确定性派生

**原理**: 根密钥作为 HKDF 的输入密钥材料 (IKM)，通过不同的 info 参数派生出每个端点的子密钥。

```
RootKey (256-bit)
    │
    ├── HKDF(info="endpoint:1:encrypt") → AES256_Key_1  (加密用)
    ├── HKDF(info="endpoint:2:encrypt") → AES256_Key_2  (加密用)
    └── HKDF(info="endpoint:N:encrypt") → AES256_Key_N  (加密用)
```

**优点**:
- 子密钥不需要存储（根密钥可随时重派生）
- 无状态，实现极简
- 标准 HKDF（RFC 5869），Node.js 原生支持 `crypto.hkdfSync()`

**缺点**:
- 失去非对称加密能力（全对称，无 RSA）
- 无法分享公钥给其他系统（加密=解密，同一把密钥）
- 如需要非对称，需改用 RSA 确定性生成（复杂且非标准）

**根密钥恢复能力**: 根密钥 → `HKDF(info="endpoint:N")` → 重派生子密钥 → 解密 ✅

**适用场景**: 纯本地加密，不需要对外分享公钥的场景。

---

### 方案 C: BIP32 式层级确定性密钥

**原理**: 借鉴比特币 HD 钱包 (BIP32)，从根种子生成密钥树。

```
Master Seed (256-bit)
    │
    └── m/0 (endpoint #1 key pair)
    └── m/1 (endpoint #2 key pair)
    └── m/N (endpoint #N key pair)
```

**问题**:
- BIP32 设计用于 ECDSA/secp256k1（签名），非 RSA 加密
- 将 HMAC-SHA512 链式派生适配为 RSA 密钥生成需要自定义 PRNG 种子化 → 非标准
- 实践中无人用 BIP32 做 RSA 加密层级管理
- 可以考虑改用 EC 密钥（如 X25519 + Ed25519），但需要重写现有 RSA 加密层

**根密钥恢复能力**: 根种子 → 重派生子密钥对 → 解密 ✅（理论上，但实现复杂）

**结论**: 方案过度设计，不推荐用于此场景。

---

### 方案 D: PGP/GPG 子密钥 — **不适用**

PGP 的 primary key → subkey 体系存在根本性限制：
- PGP subkey 加密的数据只能用 subkey 的私钥解密
- Primary key **不能**解密 subkey 加密的数据
- Primary key 只能签署/撤销 subkey，不能用于解密

**结论**: PGP 不满足"根密钥解密一切"的需求。

---

### 方案 E: Libsodium crypto_kdf — **部分适用**

Libsodium 的 `crypto_kdf_derive_from_key` 提供确定性密钥派生：

```c
crypto_kdf_derive_from_key(subkey, sizeof subkey, context, "app-name", master_key);
```

- 可从 master_key 派生任意数量的 256-bit 子密钥
- 但子密钥是**对称密钥**（AES-256 / XSalsa20）
- 无内置非对称支持
- 无内置密钥包装

**结论**: 可作为 HKDF 的替代实现，但功能等价于方案 B。

---

## 四、生产环境参考

### 1Password 密钥层级

```
用户密码 + Secret Key
    ↓ (PBKDF2-SHA256, 100000轮)
Master Unlock Key (AES-256)
    ↓ 解密
Vault Key (AES-256)
    ↓ 解密
Item Keys (AES-256, 每个条目独立)
    ↓ 解密
Item Data
```

**关键设计**: 每层密钥加密下一层密钥（密钥包装），而非派生。用户密码能解开一切。

### Bitwarden 密钥层级

```
Master Password
    ↓ (PBKDF2-SHA256, 600000轮)
Master Key (256-bit)
    ↓ 派生
Symmetric Key (AES-256-CBC)
    ↓ 加密
Vault Data
```

**关键设计**: 单层，无子密钥隔离。更换密码需要全量重加密。

### Apple Secure Enclave 层级

```
Hardware Root Key (Secure Enclave, 不可导出)
    ↓ 派生 (HKDF + device-specific)
Class Keys (per protection class)
    ↓ 包装
File Keys (per file, AES-256)
    ↓ 加密
File Data
```

**关键设计**: 硬件根密钥永不离开 Secure Enclave，派生和包装在芯片内完成。

---

## 五、推荐方案

### ✅ 强烈推荐: 方案 A — 密钥包装

**理由**:

1. **满足所有需求**: 根密钥可解密一切，子密钥独立，子私钥安全存储
2. **零额外依赖**: 仅需 Node.js 内置 `crypto` 模块（AES-256-GCM + RSA-2048）
3. **兼容现有架构**: 当前已使用 RSA + AES 混合加密，只需增加一层密钥包装
4. **工业标准**: RFC 3394 / NIST SP 800-38F 标准化多年，经过充分审计
5. **实现简单**: 核心代码约 50 行
6. **1Password 同样用此模式**: Master Unlock Key 包装 Vault Key 等

### 🥈 备选: 方案 B — HKDF 确定性派生

**适用于**: 如果愿意放弃 RSA 非对称特性，改用纯对称加密，方案 B 更简洁（无需存储子密钥）。

---

## 六、实现方案（修正版）

> **关键纠正**：根密钥由管理员离线持有，不存储在本地。机器上只有子密钥对 + 根公钥。

### 6.0 架构概览

```
管理员离线持有:
  ┌──────────────────────────────┐
  │ 根密钥 (RSA-4096 私钥)        │
  │ 或 AES-256 对称密钥           │
  │ 仅在子密钥丢失/失效时使用      │
  └──────────────────────────────┘
                │ 配对
                ▼
机器本地存储 (应用目录):
  ┌─────────────────────────────────────┐
  │ 根公钥 (明文存储, 管理员部署时写入)    │
  │                                     │
  │ 端点 #1:                             │
  │  ├── 子公钥 (明文) ──▶ 加密 slot     │
  │  ├── 子私钥 (OS Keyring 保护) ──▶ 解密 slot │
  │  └── 子私钥备份: RSA(根公钥, 子私钥)  │ ← 管理员可用根私钥恢复
  │                                     │
  │ 端点 #2: ...                         │
  └─────────────────────────────────────┘

日常解密:
  子私钥 (本地 OS Keyring) → slot 明文  (根密钥不需要在线)

紧急恢复:
  管理员带入根私钥 → 解密"子私钥备份" → 获得子私钥 → 解密所有 slot
```

### 6.1 根密钥（管理员离线生成）

```bash
# 管理员在自己的安全环境生成
openssl genpkey -algorithm RSA -out root_private.pem \
    -pkeyopt rsa_keygen_bits:4096
openssl rsa -pubout -in root_private.pem -out root_public.pem
```

或使用 AES-256 对称密钥：

```bash
# 对称密钥更简洁（256-bit）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 输出: a1b2c3... (64 hex chars, 管理员手写保存)
```

**部署**：管理员将 `root_public.pem`（或 AES 密钥的 hex）写入应用的 keys 目录。

### 6.2 子密钥生成与存储

```typescript
interface EndpointKeys {
  subPublicKey: string             // RSA-2048 公钥 (PEM, 明文)
  subPrivateKey: string            // RSA-2048 私钥 (OS Keyring 保护)
  backupEncryptedSubPrivateKey: string  // RSA(根公钥, 子私钥) — 紧急恢复用
  keyId: string                    // UUID
}
```

**存储位置**：
- `subPublicKey` → `endpoint_key` 表，明文
- `subPrivateKey` → Electron safeStorage 加密（DPAPI/Keychain/Secret Service）
- `backupEncryptedSubPrivateKey` → `endpoint_key` 表，用根公钥加密

### 6.3 加密流程

```
// 创建登录端时生成子密钥对
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

// 根密钥加密子私钥
const iv = crypto.randomBytes(16)
const cipher = crypto.createCipheriv('aes-256-gcm', wrapKey, iv)
let encrypted = cipher.update(Buffer.from(privateKey, 'utf-8'))
encrypted = Buffer.concat([encrypted, cipher.final()])
const authTag = cipher.getAuthTag()

const encryptedSubPrivateKey = Buffer.concat([iv, authTag, encrypted]).toString('base64')

// 存储
saveEndpointKeys({ subPublicKey: publicKey, encryptedSubPrivateKey, keyId: uuid() })

// 加密 credential（与现有 hybridEncrypt 完全相同，但用子公钥代替全局公钥）
const ciphertext = hybridEncryptWithKey(plaintext, publicKey)
```

### 6.3 加密流程（日常创建 endpoint）

```
// 创建登录端时生成子密钥对
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

// 子私钥 → OS Keyring 保护（DPAPI/Keychain）
safeStorage.encryptString(Buffer.from(privateKey))

// 备份：根公钥加密子私钥（供管理员紧急恢复）
const backup = crypto.publicEncrypt(
  { key: rootPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
  Buffer.from(privateKey)
).toString('base64')

// 存储
saveEndpointKeys({
  subPublicKey: publicKey,
  subPrivateKeyEncrypted: encryptedPrivateKey, // safeStorage 加密的
  backupEncryptedSubPrivateKey: backup,         // 根公钥加密的备份
  keyId: uuid()
})

// 加密 credential（用子公钥）
const ciphertext = hybridEncryptWithKey(plaintext, publicKey)
```

### 6.4 解密流程（日常使用 — 不需要根密钥）

```
function decryptSlot(endpointId: number, ciphertext: string): string {
  const keys = loadEndpointKeys(endpointId)
  
  // OS Keyring 解密子私钥（日常路径）
  const subPrivateKey = safeStorage.decryptString(keys.subPrivateKeyEncrypted)
  
  return hybridDecryptWithKey(ciphertext, subPrivateKey)
}
// 根密钥全程不参与！
```

### 6.5 紧急恢复（管理员使用根密钥）

```
function emergencyRecover(endpointId: number, rootPrivateKey: string): string {
  const keys = loadEndpointKeys(endpointId)
  
  // 用根私钥解密备份中的子私钥
  const subPrivateKey = crypto.privateDecrypt(
    { key: rootPrivateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(keys.backupEncryptedSubPrivateKey, 'base64')
  ).toString('utf-8')
  
  // 用恢复的子私钥解密所有 slot
  return hybridDecryptWithKey(ciphertext, subPrivateKey)
}
```

### 6.6 安全存储层级（修正版）

```
管理员离线持有:
└── 根私钥 (RSA-4096 / AES-256)
    仅在紧急恢复时临时导入
    ├── 物理介质 (USB Key / 加密硬盘)
    └── 绝对不存储在应用机器上

机器本地:
├── 根公钥 (明文, 无敏感性)
│    └── 仅用于: 加密子私钥的备份副本
│
├── 子私钥 (端点日常解密)
│    └── OS 级保护:
│        ├── Windows: DPAPI (CryptProtectData, CurrentUser)
│        ├── macOS:   Keychain (SecItemAdd)
│        └── Linux:   Secret Service (gnome-keyring / libsecret)
│
├── 子私钥备份 (紧急恢复用)
│    └── RSA(根公钥, 子私钥) → 仅管理员根私钥可解密
│
└── Slot 数据
     └── 子公钥加密 → 子私钥解密 (日常, 根密钥不参与)
```

---

## 七、安全性分析

| 威胁 | 缓解措施 |
|------|---------|
| 根密钥泄露 | 管理员离线物理保管，不在客户机上存储 |
| 子私钥泄露 | OS Keyring 保护（DPAPI/Keychain/Secret Service） |
| 单端点泄露 | 独立密钥对，不影响其他端点 |
| 管理员权限滥用 | 需要物理接触客户机 + 根私钥双重条件 |
| 暴力破解 | RSA-2048 + AES-256-GCM，目前计算不可行 |
| 侧信道攻击 | Electron 安全策略（contextIsolation, sandbox） |
| OS 重装导致数据丢失 | 子私钥备份由根公钥加密存储，管理员可用根私钥恢复 |

---

## 八、结论

**有现成的成熟解决方案。** 密钥包装（Key Wrapping）模式是工业标准（RFC 3394 / NIST SP 800-38F），1Password 等顶级密码管理器均采用此架构。

核心原理极简：**根密钥加密子私钥，子公钥加密数据**。根密钥可解密所有子私钥，因此可解密所有数据。

实现只需现有的 Node.js `crypto` 模块，与当前 RSA + AES 混合加密架构完全兼容，增加代码量约 50-100 行。

---

## 九、实施注意事项（Oracle 审查补充）

以下是在现有代码库中实施本方案时必须解决的 8 个关键问题。

### 9.1 根密钥管理（管理员离线持有）

**部署流程**：

```
管理员:
  1. 在安全机器上生成根密钥对
     openssl genpkey -algorithm RSA -out root_private.pem -pkeyopt rsa_keygen_bits:4096
     openssl rsa -pubout -in root_private.pem -out root_public.pem
  
  2. 将 root_public.pem 部署到所有客户机
     (复制到应用的 keys/ 目录)
  
  3. 将 root_private.pem 离线保管
     (加密 USB / 硬件安全模块 / 纸质 QR 码)

客户机:
  - 拥有根公钥 → 用于生成子私钥的备份副本
  - 无法获取根私钥 → 无法恢复数据
  - 子私钥在本地 OS Keyring 中正常使用

紧急恢复:
  管理员携带 root_private.pem → 客户机
    → 解密 backupEncryptedSubPrivateKey
    → 获得子私钥 → 解密所有 slot 数据
```

⚡ **日常解密不需要根密钥。根密钥仅在子密钥丢失/损坏/轮换失败时使用。**

### 9.2 现有代码适配（Critical）

**问题**：当前 `hybrid.ts` 的 `hybridEncrypt(plaintext)` 硬编码使用全局 `cachedPublicKey`，不支持指定子公钥。`hybridEncryptWithKey(plaintext, publicKey)` **不存在**。

**需要新增函数**：
```typescript
// hybrid.ts — 新增带密钥参数的加密函数
export function hybridEncryptWithKey(plaintext: string, publicKey: string): string {
  // 与现有 hybridEncrypt 逻辑相同，但使用传入的 publicKey 代替 loadPublicKey()
  if (!plaintext) return plaintext
  
  const buffer = Buffer.from(plaintext, 'utf-8')
  if (buffer.length <= RSA_MAX_SIZE) {
    return publicEncryptWithKey(plaintext, publicKey) || plaintext
  }
  
  const aesKey = crypto.randomBytes(AES_KEY_SIZE)
  const iv = crypto.randomBytes(AES_IV_SIZE)
  const cipher = crypto.createCipheriv(AES_ALGORITHM, aesKey, iv)
  let encrypted = cipher.update(buffer)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const authTag = cipher.getAuthTag()
  
  const encryptedAesKey = publicEncryptWithKey(aesKey.toString('hex'), publicKey)
  if (!encryptedAesKey) return plaintext
  
  return `${encryptedAesKey}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function hybridDecryptWithKey(ciphertext: string, privateKey: string): string {
  // 同理，使用传入的 privateKey
}
```

**slot.ts 需要修改**：`hybridEncrypt(value)` → `hybridEncryptWithKey(value, endpointPublicKey)`。

### 9.3 包装算法：AES-GCM vs RFC 3394

**澄清**：报告中"密钥包装"是**概念层级**的描述。实际实现有两种选择：

| 方案 | 算法 | IV | 完整性验证 | Node.js |
|------|------|:--:|:----------:|---------|
| AES-GCM 包装 | `aes-256-gcm` | 随机 12 字节 | Auth Tag (16字节) | `createCipheriv('aes-256-gcm',...)` |
| RFC 5649 KWP | `id-aes256-wrap-pad` | RFC 5649 AIV | 内置（算法内置） | `createCipheriv('id-aes256-wrap-pad',...)` |

**推荐 AES-256-GCM**：
- 更广泛使用，审计更充分
- 所有主流库均支持
- 与现有 hybridEncrypt 一致

若需要严格符合 NIST 密钥管理标准，使用 RFC 5649 KWP。

### 9.4 数据库迁移

需要新增 `endpoint_key` 表：

```sql
CREATE TABLE endpoint_key (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER NOT NULL UNIQUE,
  sub_public_key TEXT NOT NULL,           -- RSA 公钥 (PEM, 明文)
  encrypted_sub_private_key TEXT NOT NULL, -- AES-GCM(根密钥, 子私钥)
  key_id TEXT NOT NULL,                    -- UUID 标识符
  created_at TEXT NOT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES endpoint(id) ON DELETE CASCADE
);
```

**迁移策略**（一次性）：
```
1. 生成新的 endpoint 子密钥对（每端点独立）
2. 用全局旧私钥解密所有 slot
3. 用子公钥重新加密 slot（hybridEncryptWithKey）
4. 丢弃全局旧私钥，切换到子密钥体系
```

### 9.5 密钥轮换策略

| 场景 | 操作 | 影响范围 |
|------|------|---------|
| 根密钥轮换 | 重新包装所有子私钥 | 不触及 slot 数据 |
| 子密钥轮换 | 解密该端点所有 slot → 重新加密 | 仅影响单个端点 |
| 定期轮换（7天） | 建议仅轮换子密钥，根密钥保持稳定 | — |

根密钥轮换代价低（只重新包装，不重新加密数据），但需要 BIP39 助记词不变（重派生根密钥）。

### 9.6 用户交互模型（修正版）

**日常使用**（不需要管理员介入）：
```
用户:
  1. 打开应用 → 输入主密码
  2. 主密码 → OS Keyring 解锁 → 加载子私钥
  3. 解密 credential slot → 正常使用
  4. 加密新 credential → 用子公钥加密
  
管理员:
  完全不需要参与
```

**紧急恢复**（管理员介入）：
```
场景: OS 重装 / Keyring 损坏 / 子私钥丢失

管理员操作:
  1. 携带 root_private.pem 到客户机
  2. 导入根私钥（一次性，用完即销毁）
  3. 解密 backupEncryptedSubPrivateKey → 恢复子私钥
  4. 将子私钥重新存入 OS Keyring
  5. 擦除根私钥痕迹
  
用户:
  设置新主密码 → 正常使用
```

**密钥生命周期**：
```
初始化部署:
  管理员生成根密钥对 → 部署根公钥到客户机
  
创建 endpoint:
  自动生成子密钥对 → 子私钥存 OS Keyring → 子私钥备份用根公钥加密存储
  
日常使用:
  子密钥对独立运作，根密钥不在线
  
子密钥轮换:
  生成新子密钥对 → 重新加密 slot → 更新备份
  
紧急恢复:
  管理员导入根私钥 → 恢复子私钥 → 重建 OS Keyring 绑定
```

### 9.7 内存安全与 Electron

**多层防御**：
1. `contextIsolation: true` — 渲染进程无法访问 Node.js API
2. `sandbox: true` — 渲染进程沙箱化
3. 私钥使用后立即 `clearPrivateKeyCache()`
4. 根密钥仅在需要解包子密钥时加载到内存，用完清空
5. 子私钥解包后缓存，空闲 5 分钟后清除

**Linux 特殊处理**：`safeStorage.isEncryptionAvailable()` 在无 GNOME Keyring 的环境返回 false。此时：
- 加密根密钥的 fallback：用主密码 + Argon2id 派生的对称密钥加密根密钥，存储到文件
- 安全性降低（从 OS Keyring → 文件加密），但保证了可用性

### 9.8 现有数据迁移

所有现有 slot 数据用全局 RSA 密钥对加密。迁移到子密钥体系：

```
Phase 1 - 共存期（新 endpoint 用子密钥）:
  - 新建 endpoint → 生成子密钥对，包装存储
  - 现有 endpoint → 仍用全局密钥解密

Phase 2 - 迁移（按需）:
  - 用户打开 endpoint → 检查是否有子密钥
  - 若无：生成子密钥，用全局私钥解密所有 slot，用子公钥重新加密
  - 完成后清除该 endpoint 的全局密钥引用

Phase 3 - 完成:
  - 所有 endpoint 已迁移
  - 全局 RSA 密钥对可安全删除

降级兼容:
  - 数据标记版本号 (v1=全局密钥, v2=子密钥)
  - slot 解密时先检查版本，选择对应解密路径
```
