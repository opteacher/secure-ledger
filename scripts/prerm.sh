#!/bin/bash
# DEB 包卸载前脚本

set -e

echo "密钥终端正在卸载..."

# 不卸载 sshpass，因为可能是系统安装的其他包依赖
# 如果需要卸载，用户可以手动执行: sudo apt remove sshpass

exit 0