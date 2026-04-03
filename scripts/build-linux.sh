#!/bin/bash
# Linux 构建脚本
# 在 Linux 环境中运行此脚本构建 deb 包

set -e

echo "=========================================="
echo "账号管理器 - Linux 构建脚本"
echo "=========================================="

# 检查依赖
echo "检查构建依赖..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
fi

# 检查构建工具
if ! command -v make &> /dev/null; then
    echo "安装构建工具..."
    sudo apt-get update
    sudo apt-get install -y build-essential python3 libsqlite3-dev
fi

# 检查 fpm (用于构建 deb)
if ! command -v fpm &> /dev/null; then
    echo "安装 fpm..."
    sudo apt-get install -y ruby ruby-dev
    sudo gem install fpm
fi

# 进入项目目录
cd "$(dirname "$0")/.."

# 安装依赖
echo ""
echo "安装 npm 依赖..."
npm install

# 构建
echo ""
echo "构建 Linux 安装包..."
npm run build:linux

echo ""
echo "=========================================="
echo "构建完成！"
echo "=========================================="
echo ""
echo "输出文件："
ls -la release/*.deb release/*.tar.gz 2>/dev/null || ls -la release/