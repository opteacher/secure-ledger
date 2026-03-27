#!/bin/bash
# UOS/Deepin 系统专用修复脚本
# 解决 GLIBC 2.28 兼容性问题

set -e

echo "=========================================="
echo "密钥终端 - UOS/Deepin 系统修复脚本"
echo "=========================================="
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
    echo "请使用 sudo 运行此脚本"
    echo "用法: sudo bash $0"
    exit 1
fi

echo "系统信息:"
cat /etc/os-release 2>/dev/null | grep -E "^NAME=|^VERSION=" || true
echo ""
echo "GLIBC 版本:"
ldd --version | head -1
echo ""

# 1. 安装编译依赖
echo "=========================================="
echo "步骤 1: 安装编译依赖"
echo "=========================================="

apt update
apt install -y build-essential python3 libsqlite3-dev curl

echo ""

# 2. 安装 Node.js 20
echo "=========================================="
echo "步骤 2: 安装 Node.js 20"
echo "=========================================="

if command -v node &> /dev/null; then
    echo "Node.js 已安装: $(node --version)"
else
    echo "正在安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    echo "Node.js 安装完成: $(node --version)"
fi

echo ""

# 3. 安装 node-gyp
echo "=========================================="
echo "步骤 3: 安装 node-gyp"
echo "=========================================="

if command -v node-gyp &> /dev/null; then
    echo "node-gyp 已安装"
else
    echo "正在安装 node-gyp..."
    npm install -g node-gyp
fi

echo ""

# 4. 检查应用目录
echo "=========================================="
echo "步骤 4: 检查应用目录"
echo "=========================================="

APP_DIR="/opt/密钥终端"
if [ ! -d "$APP_DIR" ]; then
    echo "错误: 未找到应用目录 $APP_DIR"
    echo "请确认应用已正确安装"
    exit 1
fi

UNPACKED_DIR="$APP_DIR/resources/app.asar.unpacked"
if [ ! -d "$UNPACKED_DIR" ]; then
    echo "错误: 未找到 $UNPACKED_DIR"
    exit 1
fi

echo "应用目录: $APP_DIR"
echo "解压目录: $UNPACKED_DIR"

# 5. 重新编译 better-sqlite3
echo ""
echo "=========================================="
echo "步骤 5: 重新编译 better-sqlite3"
echo "=========================================="

SQLITE3_DIR="$UNPACKED_DIR/node_modules/better-sqlite3"
if [ ! -d "$SQLITE3_DIR" ]; then
    echo "错误: 未找到 better-sqlite3 模块"
    ls -la "$UNPACKED_DIR/node_modules/" 2>/dev/null || true
    exit 1
fi

cd "$SQLITE3_DIR"
echo "工作目录: $(pwd)"
echo ""

# 清理旧构建
echo "清理旧构建..."
rm -rf build

# 从源码编译
echo ""
echo "从源码编译 (请耐心等待)..."
echo ""

node-gyp rebuild --release 2>&1 || {
    echo ""
    echo "编译失败！尝试安装额外依赖..."
    
    # 安装可能的缺失依赖
    apt install -y python3-dev || true
    
    # 再次尝试
    echo ""
    echo "重新编译..."
    node-gyp rebuild --release
}

# 6. 验证结果
echo ""
echo "=========================================="
echo "步骤 6: 验证结果"
echo "=========================================="

if [ -f "build/Release/better_sqlite3.node" ]; then
    echo "✓ 编译成功！"
    echo ""
    echo "文件信息:"
    ls -la build/Release/better_sqlite3.node
    
    echo ""
    echo "依赖检查:"
    ldd build/Release/better_sqlite3.node 2>&1 | grep -E "GLIBC|not found" && {
        echo ""
        echo "警告: 仍然存在 GLIBC 依赖问题"
        echo "请将上面的信息反馈给开发者"
    } || echo "✓ 依赖检查通过"
    
    echo ""
    echo "=========================================="
    echo "修复完成！"
    echo "=========================================="
    echo ""
    echo "现在可以启动应用了:"
    echo "  $APP_DIR/secure-ledger"
    echo ""
    echo "或者在应用菜单中找到 '密钥终端'"
else
    echo ""
    echo "=========================================="
    echo "编译失败"
    echo "=========================================="
    echo ""
    echo "请检查上面的错误信息"
    exit 1
fi