@echo off
REM ttyd、plink 和 sshpass 下载脚本 (Windows)
REM 如果下载失败，请手动从以下地址下载：
REM ttyd: https://github.com/tsl0922/ttyd/releases/tag/1.7.7
REM plink: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
REM sshpass: https://github.com/xhcoding/sshpass-static/releases

set TTYD_VERSION=1.7.7
set BASE_URL=https://github.com/tsl0922/ttyd/releases/download/%TTYD_VERSION%
set SSH_PASS_URL=https://github.com/xhcoding/sshpass-static/releases/download/v1.0.0

echo ========================================
echo  Secure Ledger - SSH 工具下载脚本
echo ========================================
echo.

echo [1/4] 下载 ttyd %TTYD_VERSION%...

REM Windows exe
if not exist "ttyd.win32.exe" (
    echo 下载 ttyd.win32.exe (Windows)...
    curl -L -o ttyd.win32.exe %BASE_URL%/ttyd.win32.exe
    if exist "ttyd.win32.exe" (
        echo √ ttyd.win32.exe 下载成功
    ) else (
        echo × ttyd.win32.exe 下载失败
    )
) else (
    echo √ ttyd.win32.exe 已存在，跳过
)

REM Linux x64
if not exist "ttyd.x86_64" (
    echo 下载 ttyd.x86_64 (Linux x64)...
    curl -L -o ttyd.x86_64 %BASE_URL%/ttyd.x86_64
    if exist "ttyd.x86_64" (
        echo √ ttyd.x86_64 下载成功
    ) else (
        echo × ttyd.x86_64 下载失败
    )
) else (
    echo √ ttyd.x86_64 已存在，跳过
)

REM Linux ARM64
if not exist "ttyd.aarch64" (
    echo 下载 ttyd.aarch64 (Linux ARM64)...
    curl -L -o ttyd.aarch64 %BASE_URL%/ttyd.aarch64
    if exist "ttyd.aarch64" (
        echo √ ttyd.aarch64 下载成功
    ) else (
        echo × ttyd.aarch64 下载失败
    )
) else (
    echo √ ttyd.aarch64 已存在，跳过
)

echo.
echo [2/4] 下载 plink.exe (Windows)...
if not exist "plink.exe" (
    curl -L -o plink.exe https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe
    if exist "plink.exe" (
        echo √ plink.exe 下载成功
    ) else (
        echo × plink.exe 下载失败
        echo 请手动下载: https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe
    )
) else (
    echo √ plink.exe 已存在，跳过
)

echo.
echo [3/4] 下载 sshpass (Linux/macOS)...

REM sshpass for Linux
if not exist "sshpass.linux" (
    echo 下载 sshpass.linux (Linux x64)...
    curl -L -o sshpass.linux %SSH_PASS_URL%/sshpass-linux-amd64
    if exist "sshpass.linux" (
        echo √ sshpass.linux 下载成功
    ) else (
        del sshpass.linux 2>nul
        echo × sshpass.linux 下载失败
        echo.
        echo 请手动下载:
        echo   https://github.com/xhcoding/sshpass-static/releases
        echo   下载 sshpass-linux-amd64 并重命名为 sshpass.linux
    )
) else (
    echo √ sshpass.linux 已存在，跳过
)

REM sshpass for macOS
if not exist "sshpass.darwin" (
    echo 下载 sshpass.darwin (macOS)...
    curl -L -o sshpass.darwin %SSH_PASS_URL%/sshpass-darwin-amd64
    if exist "sshpass.darwin" (
        echo √ sshpass.darwin 下载成功
    ) else (
        del sshpass.darwin 2>nul
        echo × sshpass.darwin 下载失败
        echo.
        echo macOS 用户建议使用密钥文件登录，或通过 Homebrew 安装:
        echo   brew install sshpass
    )
) else (
    echo √ sshpass.darwin 已存在，跳过
)

echo.
echo [4/4] 验证文件...

echo.
echo ========================================
echo  下载完成！文件列表：
echo ========================================
dir /b ttyd.* plink.exe sshpass.* 2>nul

echo.
echo ========================================
echo  打包文件说明
echo ========================================
echo Windows 用户：
echo   ttyd.win32.exe  - SSH 终端服务 (必需)
echo   plink.exe       - SSH 密码认证工具 (密码登录必需)
echo.
echo Linux 用户：
echo   ttyd.x86_64     - x64 系统 SSH 终端服务
echo   ttyd.aarch64    - ARM64 系统 SSH 终端服务
echo   sshpass.linux   - SSH 密码认证工具 (密码登录必需)
echo.
echo macOS 用户：
echo   sshpass.darwin  - SSH 密码认证工具 (可选，建议使用密钥)
echo.
echo 注意：这些文件会被打包到安装程序中，无需用户额外安装。
echo.
pause