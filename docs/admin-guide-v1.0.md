# 管理员操作手册 — 层级密钥管理 v1.0

> 管理员掌控根密钥，客户机日常使用子密钥，根密钥离线保管仅用于紧急恢复。

---

## 一、初次部署：生成根密钥对

在**安全离线环境**（推荐无网络的干净机器或加密U盘环境）执行：

### 方式 A：RSA-4096 密钥对（推荐）

```bash
# 生成根密钥对
openssl genpkey -algorithm RSA -out root_private.pem \
    -pkeyopt rsa_keygen_bits:4096

# 提取公钥
openssl rsa -pubout -in root_private.pem -out root_public.pem

# 验证
openssl rsa -in root_private.pem -check -noout
# 输出 "RSA key ok" 表示生成成功
```

### 方式 B：AES-256 对称密钥（更简单）

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > root_key.hex
# 输出示例: a1b2c3d4e5f6...（64个十六进制字符）
```

> 以下以方案 A（RSA-4096）为例。方案 B 用法类似，公钥即为 hex 文件本身。

---

## 二、部署根公钥到客户机

将 `root_public.pem` 复制到每台客户机的密钥目录：

### Windows
```cmd
copy root_public.pem "%APPDATA%\secure-ledger\keys\root_public.pem"
```

### Linux
```bash
cp root_public.pem ~/.config/secure-ledger/keys/root_public.pem
chmod 644 ~/.config/secure-ledger/keys/root_public.pem
```

### macOS
```bash
cp root_public.pem ~/Library/Application\ Support/secure-ledger/keys/root_public.pem
```

> ⚠️ `root_public.pem` 是公钥，泄露不危及数据安全。可以明文传输（U盘/内网共享/邮件）。

---

## 三、触发迁移（客户机自动完成）

客户机部署根公钥后，下次启动应用时会自动执行 v0→v1.0 迁移：

```
1. 检测 encryption_version 是否为 v1.0 → 已迁移则跳过
2. 加载 legacy 全局私钥（OS Keyring 中的 private.pem.enc）
3. 遍历所有登录端：
   a. 生成独立的 RSA-2048 子密钥对
   b. 子私钥存入 OS Keyring（DPAPI/Keychain/Secret Service）
   c. 子私钥备份用根公钥加密存入数据库
   d. 用 legacy 私钥解密所有 slot → 用子公钥重新加密
4. 标记 system_config.encryption_version = "v1.0"
5. legacy 全局密钥对可安全删除
```

> 客户机无需管理员干预，全自动完成。

---

## 四、紧急恢复

**触发条件**：
- 客户机 OS 重装导致 Keyring 丢失
- 子私钥损坏无法解密
- 用户忘记主密码且 Keyring 不可用

### 步骤

#### 1. 管理员携带根私钥到客户机

`root_private.pem` 必须通过**加密介质**携带（加密U盘 / 硬件安全模块）。

#### 2. 运行恢复命令

```bash
# 方式 A：使用解密工具（已有）
node scripts/decrypt-portable/decrypt.cjs \
    --db "%APPDATA%/secure-ledger/secure-ledger.db" \
    --keys "%APPDATA%/secure-ledger/keys" \
    --output recovered.json

# 方式 B：使用 v1.0 恢复 API（新增）
# 在应用设置中 → "紧急恢复" → 选择 root_private.pem
```

#### 3. 恢复流程

```
1. 导入 root_private.pem（一次性，用完即销毁）
2. 系统遍历所有 endpoint_key 记录
3. 用根私钥解密 backup_encrypted_key → 获得子私钥
4. 用子私钥解密所有 slot → 重建数据库
5. 将子私钥重新存入 OS Keyring
6. 擦除根私钥内存痕迹
7. 用户设置新主密码 → 正常使用
```

#### 4. 恢复后

```bash
# 确认根私钥已从客户机完全删除
del root_private.pem        # Windows
rm root_private.pem         # Linux/macOS

# 确认恢复成功：用户可用主密码正常登录并查看所有凭据
```

---

## 五、根密钥保管规范

### 最低要求

| 项目 | 要求 |
|------|------|
| 存储介质 | 加密 U 盘（如 Kingston IronKey）或硬件安全模块（HSM） |
| 备份数量 | ≥ 2 份，异地存放 |
| 访问控制 | 仅管理员本人可接触 |
| 传递方式 | 物理递交，禁止网络传输 |

### 推荐方案

```
主副本: 加密 U 盘，存放于保险柜
备副本: 纸质 QR 码（qrencode 生成），密封存放于异地
应急副本: Shamir 秘密共享（3-of-5），分发给可信人员

# 生成 QR 码备副本
qrencode -o root_private_qr.png < root_private.pem
# 打印 → 密封 → 异地保险柜
```

### Shamir 秘密共享（3-of-5 方案）

```bash
# 安装 sss 工具
sudo apt install ssss   # Linux
# 或使用 Node.js: npm install -g secrets.js

# 分割根密钥为 5 份，任意 3 份可恢复
ssss-split -t 3 -n 5 < root_private.pem > shares.txt

# 每份保存为独立文件，分发给不同保管人
split -l 1 shares.txt share-
```

---

## 六、根密钥轮换

当怀疑根密钥泄露或按合规要求定期轮换：

```bash
# 1. 生成新根密钥对
openssl genpkey -algorithm RSA -out root_private_v2.pem -pkeyopt rsa_keygen_bits:4096
openssl rsa -pubout -in root_private_v2.pem -out root_public_v2.pem

# 2. 分发新公钥到所有客户机（覆盖 root_public.pem）

# 3. 客户机启动时检测公钥变化 → 自动重新加密所有子私钥备份
#    （不需要重新加密 slot 数据，只更新 backup_encrypted_key）

# 4. 安全销毁旧根私钥
shred -u root_private.pem   # Linux
```

---

## 七、安全检查清单

- [ ] 根私钥生成于离线环境
- [ ] 根私钥从未接触网络
- [ ] 根私钥存储于加密介质
- [ ] 至少 2 份异地备份
- [ ] 所有客户机已部署根公钥
- [ ] 确认 `encryption_version = v1.0`
- [ ] 旧全局密钥对已删除（private.pem.enc + public.pem 旧文件）
- [ ] 紧急恢复流程经过演练
- [ ] Shamir 共享人员了解职责

---

## 八、常见问题

**Q: 根公钥丢失了怎么办？**
A: 不影响。根公钥可从根私钥重新提取：`openssl rsa -pubout -in root_private.pem -out root_public.pem`

**Q: 根私钥丢失了怎么办？**
A: 无法恢复。根私钥是解密所有备份子私钥的唯一方式。如果所有客户机正常运行（子私钥未损坏），不影响日常使用。但无法执行紧急恢复。**这就是为什么必须多份备份。**

**Q: 客户机 Keyring 损坏且根私钥也丢失？**
A: 数据永久不可恢复。这是安全设计的代价。

**Q: 能否跳过 v1.0 迁移？**
A: 可以。没有根公钥时，应用自动以 legacy 模式运行（使用原有全局密钥），功能不变。
