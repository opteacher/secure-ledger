# 账号管理器 - Secure Ledger

一个基于 Electron 的本地凭证管理与自动化登录平台，支持自动化登录和 SSH 连接。

## 功能特性

- 🔐 **本地加密存储** - 所有敏感数据使用 AES-256 加密，密钥派生使用 PBKDF2
- 🚀 **自动化登录** - 支持网页自动化登录，预定义操作步骤
- 💻 **SSH 连接** - 支持 SSH 终端登录管理
- 📱 **多端点管理** - 可管理多个登录系统的凭证
- 🎨 **现代化界面** - 基于 Vue 3 + TailwindCSS 的响应式设计
- 🛡️ **安全隔离** - 使用 Electron 安全策略，防止 XSS 攻击

## 技术栈

### 前端
- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全的 JavaScript 超集
- **Pinia** - Vue 3 状态管理
- **Vue Router** - 单页面路由
- **TailwindCSS** - 原子化 CSS 框架
- **Vite** - 下一代前端构建工具

### 后端 (Electron)
- **Electron 29** - 跨平台桌面应用框架
- **better-sqlite3** - SQLite3 数据库
- **puppeteer-core** - 浏览器自动化
- **ssh2** - SSH2 协议客户端
- **uuid** - UUID 生成

## 快速开始

### 环境要求

- Node.js >= 18.x
- npm >= 9.x

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后将打开开发窗口，支持热重载。

### 构建应用

**Windows:**
```bash
npm run build:win
```

**Linux:**
```bash
npm run build:linux
```

**通用构建:**
```bash
npm run build
```

构建产物位于 `dist/` 和 `release/` 目录。

### 类型检查

```bash
npm run type-check
```

## 项目结构

```
secure-ledger/
├── electron/                    # Electron 主进程
│   ├── backend/
│   │   ├── crypto/             # 加密模块
│   │   ├── database/           # 数据库初始化与管理
│   │   ├── ipc/                # IPC 通信处理器
│   │   └── services/           # 业务服务层
│   │       ├── account.ts      # 账户服务
│   │       ├── endpoint.ts     # 登录端服务
│   │       ├── page.ts         # 步骤页服务
│   │       ├── slot.ts         # 操作槽服务
│   │       ├── automation.ts   # 自动化服务
│   │       ├── chrome.ts       # Chrome 服务
│   │       └── ssh.ts          # SSH 服务
│   ├── main.ts                 # 主进程入口
│   └── preload.ts              # 预加载脚本
├── src/                        # 渲染进程 (Vue 应用)
│   ├── apis/                   # API 接口层
│   ├── router/                 # 路由配置
│   ├── stores/                 # Pinia 状态管理
│   │   ├── account.ts          # 账户状态
│   │   └── endpoint.ts         # 登录端状态
│   └── main.ts                 # Vue 应用入口
├── scripts/                    # 工具脚本
│   └── create-test-user.ts     # 测试用户创建脚本
├── dist/                       # 构建输出
├── release/                    # 安装包输出
└── package.json
```

## 数据库结构

### account - 账户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名 (唯一) |
| password_hash | TEXT | 密码哈希 |
| master_key | TEXT | 加密的主密钥 |
| salt | TEXT | 密码盐值 |

### endpoint - 登录端表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 登录端名称 |
| icon | TEXT | 图标 |
| login_type | TEXT | 登录类型 (web/ssh) |

### page - 步骤页表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| endpoint_id | INTEGER | 外键 (endpoint) |
| order_index | INTEGER | 步骤顺序 |
| url | TEXT | 网址或 SSH 地址 |

### slot - 操作槽表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| page_id | INTEGER | 外键 (page) |
| order_index | INTEGER | 操作顺序 |
| element_xpath | TEXT | 元素 XPath |
| action_type | TEXT | 操作类型 (input/click/select) |
| value | TEXT | 值 (加密存储) |
| is_encrypted | INTEGER | 是否加密 |

## 测试用户

开发环境下可使用脚本创建测试用户:

```bash
# 需要 ts-node
npx ts-node scripts/create-test-user.ts
```

默认创建以下测试账户:

| 用户名 | 密码 |
|--------|------|
| test | test123 |
| admin | admin123 |
| demo | demo123 |

## 安全说明

### 加密方案
- **密码存储**: PBKDF2 + SHA256 哈希
- **主密钥加密**: AES-256-GCM
- **密钥派生**: PBKDF2 (100,000 轮迭代)
- **盐值**: 每账户唯一随机盐

### 安全策略
- 启用 `contextIsolation` 防止原型污染
- 禁用 `nodeIntegration` 防止 Node.js API 注入
- 启用 `sandbox` 限制渲染进程权限
- 所有敏感数据加密存储

## 开发指南

### 添加新的 IPC 处理器

1. 在 `electron/backend/ipc/` 创建新的处理器文件
2. 在 `index.ts` 中注册处理器
3. 在 `src/apis/` 添加对应的 API 调用方法
4. 在对应的 store 中封装状态管理

### 添加新的服务

1. 在 `electron/backend/services/` 创建服务文件
2. 实现 CRUD 方法
3. 通过 IPC 暴露给渲染进程

### 数据库迁移

修改 `electron/backend/database/init.ts` 中的表结构，注意向后兼容。

## 常见问题

### Q: 数据库存储在哪里？
A: 数据库文件位于用户数据目录:
- **Windows**: `%APPDATA%/secure-ledger/secure-ledger.db`
- **macOS**: `~/Library/Application Support/secure-ledger/secure-ledger.db`
- **Linux**: `~/.config/secure-ledger/secure-ledger.db`

### Q: 忘记密码怎么办？
A: 由于使用本地加密，忘记密码无法恢复。可删除数据库文件重新开始。

### Q: 自动化登录失败？
A: 检查 XPath 选择器是否正确，网页结构是否变化。

### Q: Linux 启动时报错 GLIBC 版本过低？
A: 应用需要 GLIBC 2.29 或更高版本。解决方案：

**方案一：升级系统**（推荐）
- Ubuntu 20.04+ / Debian 11+ / CentOS 9+ 自带 GLIBC 2.29+

**方案二：在目标系统上重新编译原生模块**

1. 安装依赖：
```bash
sudo apt install -y build-essential python3 libsqlite3-dev
```

2. 安装 Node.js 20：
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
```

3. 运行诊断脚本：
```bash
sudo /opt/账号管理器/resources/scripts/diagnose.sh
```

4. 运行重新编译脚本：
```bash
sudo /opt/账号管理器/resources/scripts/rebuild-native.sh
```

如果脚本失败，手动编译：
```bash
cd /opt/账号管理器/resources/app.asar.unpacked/node_modules/better-sqlite3
sudo npm install -g node-gyp
node-gyp rebuild --release
```

**方案三：从源码构建**
```bash
# 克隆仓库
git clone https://github.com/secure-ledger/secure-ledger.git
cd secure-ledger

# 安装依赖并构建
npm install
npm run build:linux
```

**方案四：使用 Docker 构建**（在任意系统上）
```bash
# 构建镜像
docker build -f Dockerfile.linux -t secure-ledger-builder .

# 构建并输出到当前目录
docker run --rm -v $(pwd)/output:/output secure-ledger-builder
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request!

---

**Secure Ledger Team** © 2026
