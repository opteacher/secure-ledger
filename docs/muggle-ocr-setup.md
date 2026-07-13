# muggle_ocr 便携 Python 运行时部署指南

## 目录结构

```
resources/
├── python/                      # 安装素材
│   ├── python-3.10.11-embed-amd64.zip   # Python 3.10 embeddable
│   ├── get-pip.py                        # pip 安装脚本
│   ├── muggle_ocr-main.zip               # muggle_ocr 源码
│   ├── muggleOCR.py                      # 桥接脚本（已内置）
│   └── whls/                             # 离线依赖包
│       ├── tensorflow-2.21.0-cp310-cp310-win_amd64.whl
│       ├── numpy-2.2.6-cp310-cp310-win_amd64.whl
│       ├── pillow-12.3.0-cp310-cp310-win_amd64.whl
│       ├── opencv_python-5.0.0.93-cp37-abi3-win_amd64.whl
│       ├── pyyaml-6.0.3-cp310-cp310-win_amd64.whl
│       ├── muggle_ocr-1.0.3-py3-none-any.whl
│       └── ...（其余传递依赖）
└── python-runtime/              # 部署后的便携 Python 运行时
    └── python.exe
```

## 一次性部署步骤（机器首次需要）

在项目根目录 `D:\Projects\secure-ledger` 执行：

```powershell
# 1. 解压便携 Python
New-Item -Force -ItemType Directory resources\python-runtime
Expand-Archive resources\python\python-3.10.11-embed-amd64.zip resources\python-runtime -Force

# 2. 启用 site 模块（编辑 python310._pth）
@"
python310.zip
.
Lib\site-packages

import site
"@ | Set-Content resources\python-runtime\python310._pth

# 3. 安装 pip
resources\python-runtime\python.exe resources\python\get-pip.py

# 4. 离线安装所有依赖
resources\python-runtime\python.exe -m pip install --no-index --find-links resources\python\whls numpy pillow opencv-python pyyaml tensorflow muggle_ocr

# 5. 验证
resources\python-runtime\python.exe -c "import muggle_ocr; print('OK')"
```

输出 `OK` 即部署成功。

## 更新依赖（需联网）

如需更新 whl 包，在有网的机器上：

```powershell
# 删除旧 whl
Remove-Item resources\python\whls\*.whl -Force

# 用便携 Python 重新下载
resources\python-runtime\python.exe -m pip download -d resources\python\whls numpy pillow opencv-python pyyaml tensorflow

# 重新打包 muggle_ocr
Expand-Archive resources\python\muggle_ocr-main.zip temp\muggle_ocr -Force
resources\python-runtime\python.exe -m pip wheel -w resources\python\whls temp\muggle_ocr\

# 清理多余版本（只保留 cp310）
Remove-Item resources\python\whls\*cp313*.whl -Force
```

## 一键安装脚本

也可用项目自带脚本：

```bash
npm run setup-python -- --offline
```

## 注意事项

- 便携 Python 仅限 Windows amd64（`python-3.10.11-embed-amd64.zip`）
- 所有 whl 必须为 `cp310` 标签（Python 3.10），不要混入其他 Python 版本
- tensorflow 约 335MB，确保磁盘空间充足
- 内网部署时只需复制 `resources/python/` 和空白的 `resources/python-runtime/` 目录即可
