#!/bin/bash
# ttyd、plink 和 sshpass 下载脚本
# 如果 curl 下载失败，请手动从以下地址下载：
# ttyd: https://github.com/tsl0922/ttyd/releases/tag/1.7.7
# plink: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
# sshpass: 见下方说明

TTYD_VERSION="1.7.7"
BASE_URL="https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}"

echo "========================================"
echo " Secure Ledger - SSH 工具下载脚本"
echo "========================================"
echo ""

# ttyd 下载文件列表
files=(
  "ttyd.x86_64"
  "ttyd.aarch64"
  "ttyd.win32.exe"
)

echo "[1/4] 下载 ttyd ${TTYD_VERSION}..."

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file 已存在，跳过"
  else
    echo "下载 $file ..."
    curl -L -o "$file" "${BASE_URL}/${file}"
    if [ $? -eq 0 ]; then
      chmod +x "$file"
      echo "✓ $file 下载成功"
    else
      echo "✗ $file 下载失败"
    fi
  fi
done

# 下载 plink.exe (Windows)
echo ""
echo "[2/4] 下载 plink.exe (Windows)..."
if [ -f "plink.exe" ]; then
  echo "✓ plink.exe 已存在，跳过"
else
  curl -L -o plink.exe "https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe"
  if [ $? -eq 0 ]; then
    echo "✓ plink.exe 下载成功"
  else
    echo "✗ plink.exe 下载失败"
  fi
fi

# 下载 sshpass 静态版本
echo ""
echo "[3/4] 下载 sshpass..."
echo ""

# 尝试从 xhcoding/sshpass-static 下载
SSH_PASS_STATIC_URL="https://github.com/xhcoding/sshpass-static/releases/download/v1.0.0"

if [ ! -f "sshpass.linux" ]; then
  echo "下载 sshpass.linux (Linux x64)..."
  curl -L -o sshpass.linux "${SSH_PASS_STATIC_URL}/sshpass-linux-amd64"
  if [ $? -eq 0 ] && [ -s "sshpass.linux" ]; then
    chmod +x sshpass.linux
    echo "✓ sshpass.linux 下载成功"
  else
    rm -f sshpass.linux 2>/dev/null
    echo "✗ sshpass.linux 下载失败"
    echo ""
    echo "请手动下载或安装："
    echo "  方式1 - 系统安装: sudo apt install sshpass"
    echo "  方式2 - 手动下载: https://github.com/xhcoding/sshpass-static/releases"
    echo "           下载 sshpass-linux-amd64 并重命名为 sshpass.linux"
  fi
else
  echo "✓ sshpass.linux 已存在，跳过"
fi

if [ ! -f "sshpass.darwin" ]; then
  echo ""
  echo "下载 sshpass.darwin (macOS)..."
  curl -L -o sshpass.darwin "${SSH_PASS_STATIC_URL}/sshpass-darwin-amd64"
  if [ $? -eq 0 ] && [ -s "sshpass.darwin" ]; then
    chmod +x sshpass.darwin
    echo "✓ sshpass.darwin 下载成功"
  else
    rm -f sshpass.darwin 2>/dev/null
    echo "✗ sshpass.darwin 下载失败"
    echo ""
    echo "macOS 用户建议使用密钥文件登录，或通过 Homebrew 安装:"
    echo "  brew install sshpass"
  fi
else
  echo "✓ sshpass.darwin 已存在，跳过"
fi

echo ""
echo "[4/4] 验证文件..."

echo ""
echo "========================================"
echo " 下载完成！文件列表："
echo "========================================"
ls -la ttyd.* plink.exe sshpass.* 2>/dev/null

echo ""
echo "========================================"
echo " 打包文件说明"
echo "========================================"
echo "Windows 用户："
echo "  ttyd.win32.exe  - SSH 终端服务 (必需)"
echo "  plink.exe       - SSH 密码认证工具 (密码登录必需)"
echo ""
echo "Linux 用户："
echo "  ttyd.x86_64     - x64 系统 SSH 终端服务"
echo "  ttyd.aarch64    - ARM64 系统 SSH 终端服务"
echo "  sshpass.linux   - SSH 密码认证工具 (密码登录必需)"
echo ""
echo "macOS 用户："
echo "  sshpass.darwin  - SSH 密码认证工具 (可选，建议使用密钥)"
echo ""
echo "注意：这些文件会被打包到安装程序中，无需用户额外安装。"