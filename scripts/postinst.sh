#!/bin/bash
# DEB 包安装后脚本
# 注意：sshpass 已通过 deb 依赖自动安装

# 不使用 set -e，手动处理错误

echo "========================================"
echo " 账号管理器 - 安装完成"
echo "========================================"

# Electron chrome-sandbox 需要 setuid 权限
APP_DIR="/opt/账号管理器"
SANDBOX="$APP_DIR/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
    chown root:root "$SANDBOX" 2>/dev/null
    chmod 4755 "$SANDBOX" 2>/dev/null
    echo "✓ chrome-sandbox 权限已设置"
else
    # Electron 29+ 可能使用不同的 sandbox 路径
    for sandbox in "$APP_DIR"/chrome-sandbox "$APP_DIR"/chrome_crashpad_handler; do
        if [ -f "$sandbox" ]; then
            chown root:root "$sandbox" 2>/dev/null
            chmod 4755 "$sandbox" 2>/dev/null
        fi
    done
fi

# 检测 sshpass（应该已通过依赖安装）
if command -v sshpass &> /dev/null; then
    echo "✓ sshpass 已安装"
else
    echo "⚠ sshpass 未安装，SSH 密码登录功能将不可用"
    echo "  请手动安装: sudo apt install sshpass"
fi

# 检测 FFmpeg 库（Electron 依赖，部分系统缺少）
FFMPEG_FOUND=0
# 搜索 libffmpeg.so 在各可能路径
for libdir in /usr/lib /usr/lib64 /usr/lib/x86_64-linux-gnu; do
    if find "$libdir" -name "libffmpeg.so" 2>/dev/null | grep -q .; then
        FFMPEG_FOUND=1
        echo "✓ FFmpeg 库已安装"
        break
    fi
done

if [ "$FFMPEG_FOUND" -eq 0 ]; then
    echo "⚠ FFmpeg 库未找到，尝试安装..."
    # 尝试 apt 安装
    if command -v apt-get &> /dev/null; then
        apt-get update -qq 2>/dev/null
        apt-get install -y -qq ffmpeg 2>/dev/null && echo "✓ ffmpeg 已安装" || {
            # 备选包名
            apt-get install -y -qq libavcodec-extra 2>/dev/null && echo "✓ libavcodec-extra 已安装" || {
                echo "⚠ FFmpeg 自动安装失败，请手动执行:"
                echo "   sudo apt update && sudo apt install ffmpeg"
            }
        }
    else
        echo "⚠ 未检测到 apt-get，请手动安装 ffmpeg"
    fi
fi

# 部署便携 Python 运行时 (muggle_ocr)
WHLS_DIR="$APP_DIR/resources/python/whls"
RUNTIME_DIR="$APP_DIR/resources/python-runtime"
PYTHON_TAR="$APP_DIR/resources/python/cpython-3.10.15-x86_64-linux.tar.gz"

# 解压便携 Python（如不存在）
if [ ! -f "$RUNTIME_DIR/bin/python3" ] && [ -f "$PYTHON_TAR" ]; then
    mkdir -p "$RUNTIME_DIR"
    tar xzf "$PYTHON_TAR" -C "$RUNTIME_DIR" --strip-components=1 2>/dev/null
fi

PYTHON="$RUNTIME_DIR/bin/python3"
[ -f "$PYTHON" ] || PYTHON=$(command -v python3)

if [ -d "$WHLS_DIR" ] && ls "$WHLS_DIR"/*.whl &>/dev/null && [ -n "$PYTHON" ]; then
    echo ""
    echo "========================================"
    echo " 部署 muggle_ocr"
    echo "========================================"

    "$PYTHON" -m pip --version &>/dev/null || "$PYTHON" -m ensurepip 2>/dev/null || apt-get install -y -qq python3-pip 2>/dev/null
    "$PYTHON" -m pip install --no-index --find-links "$WHLS_DIR" numpy pillow opencv-python pyyaml tensorflow muggle_ocr 2>/dev/null
    if "$PYTHON" -c "import muggle_ocr" 2>/dev/null; then
        echo "✓ muggle_ocr 安装成功"
    else
        echo "⚠ muggle_ocr 安装失败，使用 Tesseract.js"
    fi
else
    echo "ℹ muggle_ocr 素材未打包，跳过"
fi

# 检测 ttyd（可选）
if command -v ttyd &> /dev/null; then
    echo "✓ ttyd 已安装"
else
    echo "ℹ ttyd 未安装，应用已内置 ttyd"
fi

echo ""
echo "========================================"
echo " 感谢使用账号管理器!"
echo "========================================"

exit 0