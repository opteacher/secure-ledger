import { platform } from 'os'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

// 终端工具信息
export interface TerminalTool {
  id: string
  name: string
  path: string
  icon?: string
}

// 检测 Windows 终端工具
function detectWindowsTerminals(): TerminalTool[] {
  const terminals: TerminalTool[] = []
  
  // Windows Terminal
  try {
    const wtPath = execSync('where wt', { encoding: 'utf-8' }).trim().split('\n')[0]
    if (wtPath) {
      terminals.push({ id: 'wt', name: 'Windows Terminal', path: wtPath })
    }
  } catch {}
  
  // PowerShell
  try {
    const psPath = execSync('where powershell', { encoding: 'utf-8' }).trim().split('\n')[0]
    if (psPath) {
      terminals.push({ id: 'powershell', name: 'PowerShell', path: psPath })
    }
  } catch {}
  
  // Command Prompt
  try {
    const cmdPath = execSync('where cmd', { encoding: 'utf-8' }).trim().split('\n')[0]
    if (cmdPath) {
      terminals.push({ id: 'cmd', name: '命令提示符', path: cmdPath })
    }
  } catch {}
  
  // Git Bash
  try {
    const gitBashPath = execSync('where bash', { encoding: 'utf-8' }).trim().split('\n')[0]
    if (gitBashPath && gitBashPath.toLowerCase().includes('git')) {
      terminals.push({ id: 'git-bash', name: 'Git Bash', path: gitBashPath })
    }
  } catch {}
  
  // PuTTY
  const puttyPaths = [
    'C:\\Program Files\\PuTTY\\putty.exe',
    'C:\\Program Files (x86)\\PuTTY\\putty.exe'
  ]
  for (const p of puttyPaths) {
    if (existsSync(p)) {
      terminals.push({ id: 'putty', name: 'PuTTY', path: p })
      break
    }
  }
  
  // MobaXterm
  const mobaxtermPaths = [
    'C:\\Program Files\\MobaXterm\\MobaXterm.exe',
    'C:\\Program Files (x86)\\MobaXterm\\MobaXterm.exe'
  ]
  for (const p of mobaxtermPaths) {
    if (existsSync(p)) {
      terminals.push({ id: 'mobaxterm', name: 'MobaXterm', path: p })
      break
    }
  }
  
  return terminals
}

// 检测 macOS 终端工具
function detectMacTerminals(): TerminalTool[] {
  const terminals: TerminalTool[] = []
  
  // Terminal.app
  if (existsSync('/System/Applications/Utilities/Terminal.app')) {
    terminals.push({ id: 'terminal', name: 'Terminal', path: '/System/Applications/Utilities/Terminal.app' })
  }
  
  // iTerm2
  if (existsSync('/Applications/iTerm.app')) {
    terminals.push({ id: 'iterm2', name: 'iTerm2', path: '/Applications/iTerm.app' })
  }
  
  return terminals
}

// 检测 Linux 终端工具
function detectLinuxTerminals(): TerminalTool[] {
  const terminals: TerminalTool[] = []
  const terminalApps = [
    { cmd: 'gnome-terminal', name: 'GNOME Terminal' },
    { cmd: 'konsole', name: 'Konsole' },
    { cmd: 'xterm', name: 'XTerm' },
    { cmd: 'terminator', name: 'Terminator' },
    { cmd: 'alacritty', name: 'Alacritty' },
    { cmd: 'kitty', name: 'Kitty' },
    { cmd: 'xfce4-terminal', name: 'XFCE Terminal' },
    { cmd: 'deepin-terminal', name: 'Deepin Terminal' },
  ]
  
  for (const app of terminalApps) {
    try {
      const path = execSync(`which ${app.cmd}`, { encoding: 'utf-8' }).trim()
      if (path) {
        terminals.push({ id: app.cmd, name: app.name, path })
      }
    } catch {}
  }
  
  return terminals
}

// 检测终端工具
export function detectTerminals(): TerminalTool[] {
  const currentPlatform = platform()
  
  switch (currentPlatform) {
    case 'win32':
      return detectWindowsTerminals()
    case 'darwin':
      return detectMacTerminals()
    case 'linux':
      return detectLinuxTerminals()
    default:
      return []
  }
}

// 获取 plink 路径 (Windows) - 使用 ttyd.ts 中的统一函数
async function getPlinkPath(): Promise<string | null> {
  const { getAvailablePlinkPath } = await import('./ttyd')
  return getAvailablePlinkPath()
}

// 获取 sshpass 路径 (Linux/macOS) - 使用 ttyd.ts 中的统一函数
async function getSshpassPath(): Promise<string | null> {
  const { getAvailableSshpassPath } = await import('./ttyd')
  return getAvailableSshpassPath()
}

// 启动 SSH 终端
export async function launchSSHTerminal(
  terminal: TerminalTool,
  host: string,
  port: number,
  username?: string,
  keyfilePath?: string,
  password?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { exec } = require('child_process')
    const currentPlatform = platform()
    
    // 构建 SSH 目标
    const sshTarget = username ? `${username}@${host}` : host
    
    let cmdStr: string
    
    if (currentPlatform === 'win32') {
      // ========== Windows ==========
      // 如果有密码且没有密钥文件，使用 plink
      if (password && !keyfilePath) {
        const plinkPath = await getPlinkPath()
        if (!plinkPath) {
          return { success: false, message: '未找到 PuTTY 的 plink 工具，请安装 PuTTY 或使用密钥文件登录' }
        }
        
        // 转义密码中的特殊字符（双引号需要转义为两个双引号）
        const escapedPassword = password.replace(/"/g, '""')
        
        // 根据用户选择的终端启动 plink（直接使用 plink 命令，假设已在 PATH 中）
        switch (terminal.id) {
          case 'wt':
            // Windows Terminal - 使用 cmd 执行
            cmdStr = `wt new-tab cmd /k "plink -ssh ${sshTarget} -P ${port} -pw "${escapedPassword}""`
            break
          case 'powershell':
            // PowerShell - 使用 Start-Process 启动新窗口
            cmdStr = `powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', 'plink -ssh ${sshTarget} -P ${port} -pw \\"${escapedPassword}\\"'"`
            break
          case 'cmd':
            // CMD - 打开新窗口
            cmdStr = `cmd /c start "" cmd /k "plink -ssh ${sshTarget} -P ${port} -pw "${escapedPassword}""`
            break
          case 'git-bash':
            // Git Bash
            cmdStr = `start "" "${terminal.path}" -c "plink -ssh ${sshTarget} -P ${port} -pw '${password}'"`
            break
          default:
            // 默认用 cmd 打开新窗口
            cmdStr = `cmd /c start "" cmd /k "plink -ssh ${sshTarget} -P ${port} -pw "${escapedPassword}""`
        }
        
        // 不记录包含密码的命令
      } else {
        // 使用 OpenSSH ssh 命令
        const sshArgs = ['-p', String(port)]
        if (keyfilePath) {
          sshArgs.push('-i', keyfilePath)
        }
        sshArgs.push(sshTarget)
        
        switch (terminal.id) {
          case 'wt':
            cmdStr = `wt new-tab ssh ${sshArgs.join(' ')}`
            break
          case 'powershell':
            cmdStr = `powershell -NoExit -Command "ssh ${sshArgs.join(' ')}"`
            break
          case 'cmd':
            cmdStr = `cmd /c start "" cmd /k "ssh ${sshArgs.join(' ')}"`
            break
          case 'git-bash':
            cmdStr = `start "" "${terminal.path}" -c "ssh ${sshArgs.join(' ')}"`
            break
          case 'putty':
            cmdStr = `start "" "${terminal.path}" -ssh ${sshTarget} -P ${port}${keyfilePath ? ` -i "${keyfilePath}"` : ''}`
            break
          case 'mobaxterm':
            cmdStr = `start "" "${terminal.path}" -newtab "ssh ${sshArgs.join(' ')}"`
            break
          default:
            cmdStr = `cmd /c start "" cmd /k "ssh ${sshArgs.join(' ')}"`
        }
        
        console.log('Windows: Using OpenSSH ssh command')
      }
    } else if (currentPlatform === 'linux') {
      // ========== Linux ==========
      const sshArgs = ['-p', String(port)]
      if (keyfilePath) {
        sshArgs.push('-i', keyfilePath)
      }
      sshArgs.push(sshTarget)
      
      // 如果有密码且没有密钥文件，使用 sshpass
      if (password && !keyfilePath) {
        const sshpassPath = await getSshpassPath()
        if (!sshpassPath) {
          return { success: false, message: '未找到 sshpass 工具，请安装 sshpass 或使用密钥文件登录' }
        }
        
        const escapedPassword = password.replace(/'/g, "'\\''")
        const sshpassCmd = `sshpass -p '${escapedPassword}' ssh ${sshArgs.join(' ')}`
        
        switch (terminal.id) {
          case 'gnome-terminal':
            cmdStr = `gnome-terminal -- ${sshpassCmd}`
            break
          case 'konsole':
            cmdStr = `konsole -e bash -c '${sshpassCmd}'`
            break
          case 'xterm':
            cmdStr = `xterm -e '${sshpassCmd}'`
            break
          case 'terminator':
            cmdStr = `terminator -e '${sshpassCmd}'`
            break
          case 'alacritty':
            cmdStr = `alacritty -e bash -c '${sshpassCmd}'`
            break
          case 'kitty':
            cmdStr = `kitty bash -c '${sshpassCmd}'`
            break
          case 'xfce4-terminal':
            cmdStr = `xfce4-terminal -e '${sshpassCmd}'`
            break
          case 'deepin-terminal':
            cmdStr = `deepin-terminal -e "${sshpassCmd}"`
            break
          default:
            cmdStr = `"${terminal.path}" -e '${sshpassCmd}'`
        }
      } else {
        switch (terminal.id) {
          case 'gnome-terminal':
            cmdStr = `gnome-terminal -- ssh ${sshArgs.join(' ')}`
            break
          case 'konsole':
            cmdStr = `konsole -e ssh ${sshArgs.join(' ')}`
            break
          case 'xterm':
            cmdStr = `xterm -e ssh ${sshArgs.join(' ')}`
            break
          case 'terminator':
            cmdStr = `terminator -e "ssh ${sshArgs.join(' ')}"`
            break
          case 'alacritty':
            cmdStr = `alacritty -e ssh ${sshArgs.join(' ')}`
            break
          case 'kitty':
            cmdStr = `kitty ssh ${sshArgs.join(' ')}`
            break
          case 'xfce4-terminal':
            cmdStr = `xfce4-terminal -e "ssh ${sshArgs.join(' ')}"`
            break
          case 'deepin-terminal':
            cmdStr = `deepin-terminal -e ssh ${sshArgs.join(' ')}`
            break
          default:
            cmdStr = `"${terminal.path}" -e ssh ${sshArgs.join(' ')}`
        }
        
        console.log('Linux: Using OpenSSH ssh command')
      }
    } else if (currentPlatform === 'darwin') {
      // ========== macOS ==========
      const sshArgs = ['-p', String(port)]
      if (keyfilePath) {
        sshArgs.push('-i', keyfilePath)
      }
      sshArgs.push(sshTarget)
      
      // macOS 没有 sshpass，只能用密钥文件或手动输入密码
      switch (terminal.id) {
        case 'terminal':
          cmdStr = `open -a Terminal --args ssh ${sshArgs.join(' ')}`
          break
        case 'iterm2':
          cmdStr = `open -a iTerm --args ssh ${sshArgs.join(' ')}`
          break
        default:
          cmdStr = `open -a Terminal --args ssh ${sshArgs.join(' ')}`
      }
      
      console.log('macOS: Using OpenSSH ssh command')
    } else {
      return { success: false, message: `不支持的平台: ${currentPlatform}` }
    }
    
    // 不记录包含密码的命令
    
    exec(cmdStr, (error: Error | null) => {
      if (error) {
        console.error('Failed to start process:', error)
      }
    })
    
    return { success: true, message: '终端已启动' }
  } catch (error: any) {
    console.error('Failed to start terminal:', error)
    return { success: false, message: `启动终端失败: ${error.message}` }
  }
}