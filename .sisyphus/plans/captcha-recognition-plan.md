# 验证码识别操作步骤 — 设计方案

## 1. 概述

**关键约束：应用仅限内网部署，识别不可使用联网服务。**

所有识别逻辑必须在本地完成，无外部 API 调用。这排除了商业打码平台和云端 AI API。

在自动化登录流程中新增**验证码识别**操作步骤。用户选择一个验证码图片元素，系统截图该元素 → 本地识别服务 → 输出识别文本 → 后续步骤可引用此值填入输入框。

## 2. 技术方案对比（验证码识别 — 仅限本地方案）

### 方案 A: Tesseract.js 本地 OCR（主推方案）

| 维度 | 评估 |
|------|------|
| 原理 | `sharp` 预处理（灰度/锐化/降噪/放大/二值化）+ `tesseract.js` 本地 OCR 引擎识别 |
| 成本 | 免费，纯本地运行，无任何网络请求 |
| 准确率 | 简单数字/字母验证码 60-85%；充分预处理后可达 80-90% |
| 速度 | ~1-3s（取决于预处理和图片大小） |
| 依赖 | `tesseract.js` (~40MB language data), `sharp` (libvips) |
| 优点 | 离线可用，零费用，隐私安全，社区成熟 |
| 缺点 | 对抗性验证码效果差，语言数据包增大打包体积，`sharp` 原生模块可能带来构建问题 |
| 适用场景 | **内网简单验证码**（纯数字/字母、轻度扭曲）✅ |

### 方案 B: OpenCV.js 传统计算机视觉

| 维度 | 评估 |
|------|------|
| 原理 | 使用 OpenCV.js 进行图像处理（轮廓检测、模板匹配、字符分割）后逐一识别 |
| 成本 | 免费，纯本地运行 |
| 准确率 | 简单规则验证码 70-90%；依赖字符分割质量 |
| 速度 | 0.5-2s |
| 依赖 | `opencv.js` (wasm, ~8MB) |
| 优点 | 轻量，无原生依赖（纯 WASM），可控性高 |
| 缺点 | 实现复杂，需针对不同验证码样式定制规则，泛化能力差 |
| 适用场景 | **固定样式的内网验证码**，可针对性调优 |

### 方案 C: 本地 ONNX 视觉模型推理

| 维度 | 评估 |
|------|------|
| 原理 | 使用 ONNX Runtime 加载预训练 OCR 小模型（如 CRNN + CTC）本地推理 |
| 成本 | 免费，纯本地运行 |
| 准确率 | 90-95%（针对训练数据覆盖的验证码类型） |
| 速度 | 0.5-2s（GPU 可用时更快） |
| 依赖 | `onnxruntime-node` (~20MB native), 模型文件 (~5-50MB) |
| 优点 | 准确率高，可针对特定验证码训练微调，GPU 加速支持 |
| 缺点 | 需要训练/转换模型，原生依赖打包复杂，维护成本高 |
| 适用场景 | **验证码样式固定且量大的内网系统**，愿意投入模型训练 |

### 方案 D: 混合策略（Tesseract + OpenCV 预处理增强）

| 维度 | 评估 |
|------|------|
| 原理 | OpenCV 做高级预处理（自适应阈值、轮廓提取、字符分割、透视校正）→ Tesseract 识别 |
| 成本 | 免费，纯本地运行 |
| 准确率 | 简单 80-90%（比纯 Tesseract 高 10-15%） |
| 速度 | 1-3s |
| 依赖 | 方案 A + 方案 B 依赖 |
| 优点 | 显著提升 Tesseract 准确率，无需训练，纯本地 |
| 缺点 | 实现复杂度中等，对不同验证码需调整预处理参数 |
| 适用场景 | **内网简单～中等验证码**，最推荐方案 |

**推荐：方案 D（Tesseract + OpenCV）**。
- 主路径：OpenCV.js WASM 做预处理 + Tesseract.js 做 OCR
- 纯本地，零网络，零费用
- 对比纯 Tesseract 可提升 10-15% 准确率
- OpenCV.js 无原生依赖（WASM），避免 `sharp` 的构建兼容问题
- 如果验证码极简单（纯数字、无干扰），简化为纯 Tesseract.js 即可

### 方案对比汇总

| 方案 | 网络需求 | 费用 | 简单验证码准确率 | 实现复杂度 | 原生依赖 | 推荐 |
|------|---------|------|-----------------|-----------|---------|------|
| A: Tesseract.js | ❌ 不需要 | 免费 | 60-85% | 低 | `sharp` | ⭐⭐⭐ |
| B: OpenCV.js | ❌ 不需要 | 免费 | 70-90% | 高 | 无(WASM) | ⭐⭐ |
| C: ONNX 模型 | ❌ 不需要 | 免费 | 90-95% | 很高 | onnxruntime | ⭐ |
| **D: Tesseract+OpenCV** | **❌ 不需要** | **免费** | **80-90%** | **中** | **无(WASM)** | **⭐⭐⭐推荐** |
| ~~云端 AI API~~ | ❌ 需联网 | ❌ 不可用 | - | - | - | ❌ 排除 |
| ~~第三方打码~~ | ❌ 需联网 | ❌ 不可用 | - | - | - | ❌ 排除 |

## 3. 输出变量引用系统设计

验证码识别与其他操作不同：它是**生产值**的操作，而不是消费值。需要新增变量引用机制。

### 3.1 slot 表变更

在 `slot` 表新增字段：

```sql
ALTER TABLE slot ADD COLUMN output_key TEXT DEFAULT '';
-- output_key 非空表示该步骤产出值，后续步骤可通过 {{output_key}} 引用
```

### 3.2 值引用语法

后续 `input` 步骤的 `value` 字段中支持模板语法：

```
值填写: "{{captcha_code}}" 
```

执行引擎解析流程：
1. 遍历 slots，维护 `context: Map<string, string>` 上下文
2. 如果 slot 有 `output_key`，执行后将输出值存入 `context[output_key]`
3. 如果 slot 的 `value` 包含 `{{key}}` 模式，从 `context` 中替换

### 3.3 前端 UI

- captcha 步骤展示"输出变量名"输入框（默认 `captcha_result`）
- input 步骤的值输入框旁添加"插入变量"按钮，列出所有可用 output_key
- 变量引用在输入框中高亮显示

## 4. 需修改文件清单

### 4.1 数据库层

| 文件 | 修改内容 |
|------|---------|
| `electron/backend/database/init.ts:88` | `action_type CHECK` 添加 `'captcha'` |
| `electron/backend/database/init.ts` | 新增 migration: `ALTER TABLE slot ADD COLUMN output_key` |

### 4.2 后端类型 + 服务

| 文件 | 修改内容 |
|------|---------|
| `electron/backend/database/init.ts:33-44` | `Slot` 接口添加 `output_key?: string` |
| `electron/backend/services/slot.ts:13,137` | `action_type` 联合类型添加 `'captcha'`；`createSlot/updateSlot` 处理 `output_key` |
| `electron/backend/services/slot.ts:7` | `RawSlot` 添加 `output_key` |

### 4.3 后端执行引擎

| 文件 | 修改内容 |
|------|---------|
| `electron/backend/services/automation.ts:193-252` | `switch(slot.action_type)` 添加 `case 'captcha'`：截图元素 → 调用识别服务 → 存入上下文 |
| `electron/backend/services/webview-execution.ts:23,55-76` | `WebviewActionType` 添加 `'captcha'`；`buildWaitAndActJs` 添加 captcha case（返回截图 base64） |
| `electron/backend/services/automation.ts` | 添加值模板替换函数 `resolveTemplateVars(value, context)` |

### 4.4 验证码识别服务（新增）

| 文件 | 内容 |
|------|------|
| `electron/backend/services/captcha.ts` | **新文件**。封装本地识别逻辑：`recognizeCaptcha(imageBuffer: Buffer): Promise<string>` |
| | - 核心：Tesseract.js 本地 OCR |
| | - 图片预处理（OpenCV.js WASM 或 sharp）：灰度 → 降噪 → 二值化 → 放大 → 去边框 |
| | - 数字/字母后处理（去空格、大小写归一化） |
| | - 纯本地执行，零网络请求 |
| | - 可选：对特定验证码模板的预处理配置（可扩展） |

### 4.5 IPC 层

| 文件 | 修改内容 |
|------|---------|
| `electron/backend/ipc/index.ts` | 注册新 handler: `captcha:recognize`（供前端预览识别） |
| | 接收 base64 图片 → 调用 captcha.ts 本地识别 → 返回文本 |
| | 无需配置 API Key（纯本地） |

### 4.6 前端 API

| 文件 | 修改内容 |
|------|---------|
| `src/apis/index.ts:36-48` | `Slot` 接口 `action_type` 添加 `'captcha'`；添加 `output_key` |
| `src/apis/index.ts` | 添加 `captchaApi.recognize(imageData)` |

### 4.7 前端 UI

| 文件 | 修改内容 |
|------|---------|
| `src/views/EndpointEdit.vue:334-338` | `<select>` 添加 `<option value="captcha">验证码识别</option>` |
| `src/views/EndpointEdit.vue:348` | 条件渲染添加 `slot.action_type === 'captcha'` 分支：显示 output_key 输入框 |
| `src/views/EndpointEdit.vue` | input 步骤值输入框旁添加"插入变量"按钮 |
| `src/utils/webview-execution.ts:23,55-76` | `WebviewActionType` 添加 `'captcha'`；`buildWaitAndActJs` 添加 captcha case |

### 4.8 webview 执行工具（两处同步修改）

| 文件 | 说明 |
|------|------|
| `electron/backend/services/webview-execution.ts` | 后端 webview 执行（与前端文件内容相同，需同步修改） |
| `src/utils/webview-execution.ts` | 前端 webview 执行 |

## 5. 执行流程

### 前端预览模式（webview）

```
executePages() 遍历 slots
  ├─ case 'captcha':
  │   ├─ 注入 JS: 等待 XPath 元素 → 截图元素 → 返回 base64
  │   ├─ 前端收到 base64 → 调用 captchaApi.recognize(base64)
  │   │   └─ IPC → 后端 captcha.ts → 本地 Tesseract OCR → 返回文本
  │   ├─ 存入 context[captcha_output_key]
  │   └─ 在 UI 上显示识别结果
  ├─ case 'input':
  │   ├─ 解析 value 中的 {{key}} 模板 → 从 context 替换
  │   └─ 注入 JS: 填入最终值
  └─ ...
```

### 后端 Puppeteer 模式（全自动）

```
automation.executeLogin()
  ├─ 遍历 pages → slots
  │   ├─ case 'captcha':
  │   │   ├─ const img = await page.waitForXPath(xpath)
  │   │   ├─ const buffer = await img.screenshot()  // Puppeteer 原生支持
  │   │   ├─ const text = await recognizeCaptcha(buffer)
  │   │   └─ context.set(output_key, text)
  │   ├─ case 'input':
  │   │   ├─ value = resolveTemplateVars(slot.value, context)
  │   │   └─ await locator.fill(value)
  │   └─ ...
```

## 6. 前端 UI 设计示意

### 验证码识别步骤配置

```
┌─ 操作步骤 ──────────────────────┐
│  (1) [验证码识别    ▼] [×]      │
│     XPath: //*[@id="captchaImg"] │
│     输出变量名: [captcha_code  ] │
│     识别结果预览: [ 等待执行... ] │
│     [ ] 加密                     │
└──────────────────────────────────┘
```

### 引用变量的输入步骤

```
┌─ 操作步骤 ──────────────────────┐
│  (2) [输入          ▼] [×]      │
│     XPath: //*[@id="captchaInput"]│
│     值: [{{captcha_code}}   ] [🔗]│
│     [√] 加密                     │
└──────────────────────────────────┘
```

## 7. 实施顺序

| 阶段 | 任务 | 预计工作量 |
|------|------|-----------|
| **1** | 数据库 migration（action_type + output_key） | 小 |
| **2** | 后端类型/服务扩展 captcha 支持 | 小 |
| **3** | 新增 `captcha.ts` 识别服务（Tesseract.js + OpenCV 预处理） | 中 |
| **4** | 执行引擎添加 captcha case + 模板变量解析 | 中 |
| **5** | 前端 API + IPC handler | 小 |
| **6** | 前端 UI 步骤编辑（captcha 配置面板） | 中 |
| **7** | 前端 webview 执行 captcha | 中 |
| **8** | 变量引用 UI（插入变量按钮 + 模板语法高亮） | 中 |
| **9** | 依赖处理：`tesseract.js` 语言数据打包 + OpenCV.js WASM 加载 | 中 |
| **10** | 集成测试 + 边界情况处理 | 中 |

## 8. 待确认事项

1. **识别方案**：纯 Tesseract.js（方案 A）vs Tesseract + OpenCV 预处理增强（方案 D）
2. **OpenCV 方式**：OpenCV.js WASM（免原生依赖）vs `sharp` 库（需编译原生模块）
3. **数字字母限制**：识别的验证码是否限定只输出字母和数字，还是可以包含符号
4. **大小写处理**：验证码是否区分大小写（识别结果转大写/小写/保留原始）
5. **变量语法**：`{{key}}` vs `${key}` vs 其他
6. **output_key 命名规则**：自动生成（如 `captcha_1`）vs 用户自定义
7. **超时处理**：captcha 识别超时时间设置
8. **重试策略**：识别失败是否自动重试；验证码图片是否会刷新
