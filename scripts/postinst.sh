#!/bin/bash
# DEB 包安装后脚本
# 注意：sshpass 已通过 deb 依赖自动安装

# 不使用 set -e，手动处理错误

echo "========================================"
echo " 密钥终端 - 安装完成"
echo "========================================"

# 检测 sshpass（应该已通过依赖安装）
if command -v sshpass &> /dev/null; then
    echo "✓ sshpass 已安装"
else
    echo "⚠ sshpass 未安装，SSH 密码登录功能将不可用"
    echo "  请手动安装: sudo apt install sshpass"
fi

# 检测 ttyd（可选）
if command -v ttyd &> /dev/null; then
    echo "✓ ttyd 已安装"
else
    echo "ℹ ttyd 未安装，应用已内置 ttyd"
fi

echo ""
echo "========================================"
echo " 感谢使用密钥终端!"
echo "========================================"

exit 0