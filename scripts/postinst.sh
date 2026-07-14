#!/bin/bash
# DEB 包安装后脚本
# 注意：sshpass 已通过 deb 依赖自动安装

# 不使用 set -e，手动处理错误

echo "========================================"
echo " 账号管理器 - 安装完成"
echo "========================================"

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