#!/bin/bash
# 系统诊断脚本
# 帮助诊断 GLIBC 兼容性问题

echo "=========================================="
echo "系统诊断报告"
echo "=========================================="
echo ""

# 操作系统信息
echo "操作系统:"
cat /etc/os-release 2>/dev/null | grep -E "^NAME=|^VERSION=" || echo "未知"
echo ""

# GLIBC 版本
echo "GLIBC 版本:"
ldd --version | head -1
echo ""

# 内核版本
echo "内核版本:"
uname -r
echo ""

# CPU 架构
echo "CPU 架构:"
uname -m
echo ""

# 检查 Node.js
echo "Node.js:"
if command -v node &> /dev/null; then
    node --version
else
    echo "未安装"
fi
echo ""

# 检查构建工具
echo "构建工具:"
echo -n "gcc: "
which gcc 2>/dev/null && gcc --version | head -1 || echo "未安装"

echo -n "make: "
which make 2>/dev/null && echo "已安装" || echo "未安装"

echo -n "python3: "
which python3 2>/dev/null && python3 --version || echo "未安装"
echo ""

# 检查 SQLite
echo "SQLite 开发库:"
dpkg -l | grep libsqlite3-dev || echo "未安装"
echo ""

# 检查应用目录
echo "应用目录:"
if [ -d "/opt/账号管理器" ]; then
    echo "已安装: /opt/账号管理器"
    ls -la /opt/账号管理器/ 2>/dev/null | head -10
else
    echo "未找到"
fi
echo ""

# 检查 better-sqlite3 二进制
echo "better-sqlite3 二进制:"
SQLITE3_NODE="/opt/账号管理器/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if [ -f "$SQLITE3_NODE" ]; then
    echo "文件存在: $SQLITE3_NODE"
    echo "依赖检查:"
    ldd "$SQLITE3_NODE" 2>&1 | grep -E "GLIBC|not found" || echo "依赖正常"
else
    echo "文件不存在"
fi
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="