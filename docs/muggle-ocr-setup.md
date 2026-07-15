# muggle_ocr 离线部署指南

## 用户准备

### `resources/python/`（按需准备）

| 文件 | 适用平台 | 来源 |
|------|----------|------|
| `python-3.10.11-embed-amd64.zip` | **Windows / Win7** | [python.org](https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip) |
| `cpython-3.10.15-x86_64-linux.tar.gz` | **Linux** | [indygreg/python-build-standalone](https://github.com/indygreg/python-build-standalone/releases/download/20241002/cpython-3.10.15+20241002-x86_64-unknown-linux-gnu-install_only.tar.gz) |
| `get-pip.py` | **通用** | [bootstrap.pypa.io](https://bootstrap.pypa.io/get-pip.py) |

### `resources/` 根目录

| 文件 | 来源 |
|------|------|
| `muggle_ocr-main.zip` | [litongjava/muggle_ocr](https://github.com/litongjava/muggle_ocr) → Code → Download ZIP |

## 构建

```bash
npm run build:win         # Windows
npm run build:win7        # Windows 7
npm run build:linux:deb   # Linux .deb
npm run build:linux:tar   # Linux tar.gz
```

构建时 `prepare-build.js` 自动完成：解压 Python → pip → 国内源下载 whl → 打包 muggle_ocr → 复制到安装包。

> 构建机需联网（下载 whl）。内网构建机可从外网机器拷贝 `resources/python/whls/`。

## 安装时自动部署

| 平台 | 方式 |
|------|------|
| Windows / Win7 | 首次调 muggle_ocr 时自动部署到 `%APPDATA%` |
| Linux | `postinst.sh` 安装时部署 |

## 验证

启动应用 → 设置 → 通用 → 验证码识别方案 → Muggle 按钮可点击 = 成功。
