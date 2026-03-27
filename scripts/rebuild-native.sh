#!/bin/bash
# 在 Linux 上重新编译原生模块
# 用于解决 GLIBC 版本不兼容问题

set -e

echo "=========================================="
echo "密钥终端 - 原生模块重新编译脚本"
echo "=========================================="
echo ""

# 显示当前 GLIBC 版本
echo "当前系统 GLIBC 版本:"
ldd --version | head -1
echo ""

# 获取应用安装目录
APP_DIR="/opt/密钥终端"
if [ ! -d "$APP_DIR" ]; then
    echo "错误: 未找到应用目录 $APP_DIR"
    echo "请确认应用已正确安装"
    exit 1
fi

# 检查必要工具
echo "检查系统环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js"
    echo ""
    echo "请先安装 Node.js 20:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
    echo "  sudo apt install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "Node.js 版本: $NODE_VERSION"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm"
    exit 1
fi

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "安装 Python3..."
    sudo apt-get update && sudo apt-get install -y python3
fi

# 检查构建工具
if ! command -v make &> /dev/null; then
    echo "安装构建工具..."
    sudo apt-get update && sudo apt-get install -y build-essential
fi

# 安装 SQLite 开发库
echo "检查 SQLite 开发库..."
if ! dpkg -l | grep -q libsqlite3-dev; then
    echo "安装 SQLite 开发库..."
    sudo apt-get update && sudo apt-get install -y libsqlite3-dev
fi

# 进入应用目录
echo ""
echo "应用目录: $APP_DIR"
cd "$APP_DIR"

# 检查 app.asar.unpacked 目录
UNPACKED_DIR="$APP_DIR/resources/app.asar.unpacked"
if [ ! -d "$UNPACKED_DIR" ]; then
    echo "错误: 未找到 $UNPACKED_DIR"
    echo "尝试查找其他位置..."
    
    # 尝试其他可能的位置
    if [ -d "$APP_DIR/resources/app.asar.unpacked" ]; then
        UNPACKED_DIR="$APP_DIR/resources/app.asar.unpacked"
        echo "找到: $UNPACKED_DIR"
    else
        echo "错误: 找不到 app.asar.unpacked 目录"
        exit 1
    fi
fi

cd "$UNPACKED_DIR"
echo "工作目录: $(pwd)"
echo ""

# 检查 better-sqlite3 目录
SQLITE3_DIR="node_modules/better-sqlite3"
if [ ! -d "$SQLITE3_DIR" ]; then
    echo "错误: 未找到 better-sqlite3 模块"
    ls -la node_modules/ 2>/dev/null || echo "node_modules 目录不存在"
    exit 1
fi

echo "重新编译 better-sqlite3..."
echo ""

# 进入 better-sqlite3 目录
cd "$SQLITE3_DIR"

# 清理旧的构建文件
echo "清理旧构建..."
rm -rf build

# 安装 node-gyp (如果不存在)
if ! command -v node-gyp &> /dev/null; then
    echo "安装 node-gyp..."
    sudo npm install -g node-gyp
fi

# 从源码重新编译
echo ""
echo "从源码编译 (这可能需要几分钟)..."
echo ""

# 设置编译环境
export npm_config_build_from_source=true

# 使用 node-gyp 直接编译
node-gyp rebuild --release

# 验证编译结果
if [ -f "build/Release/better_sqlite3.node" ]; then
    echo ""
    echo "=========================================="
    echo "编译成功！"
    echo "=========================================="
    echo ""
    echo "编译产物: $(pwd)/build/Release/better_sqlite3.node"
    ls -la build/Release/better_sqlite3.node
    
    # 检查依赖
    echo ""
    echo "检查二进制依赖:"
    ldd build/Release/better_sqlite3.node | head -5
    
    echo ""
    echo "现在可以正常启动应用了。"
    echo "运行: $APP_DIR/secure-ledger"
else
    echo ""
    echo "=========================================="
    echo "编译失败！"
    echo "=========================================="
    echo ""
    echo "请检查上面的错误信息。"
    echo ""
    echo "如果问题持续，请尝试:"
    echo "1. 确保已安装所有依赖: sudo apt install -y build-essential python3 libsqlite3-dev"
    echo "2. 确保 Node.js 版本兼容: node --version (推荐 v20.x)"
    echo "3. 手动编译:"
    echo "   cd $UNPACKED_DIR/node_modules/better-sqlite3"
    echo "   node-gyp rebuild --release"
    exit 1
fi