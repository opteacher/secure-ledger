/**
 * 下载 Chrome for Testing 便携版脚本
 * 下载 Windows/Linux/macOS 三个平台的 Chrome
 * 
 * 使用方法: npx tsx scripts/download-chromium.ts
 * 
 * Chrome for Testing 是 Puppeteer 22+ 使用的版本
 * 参考: https://googlechromelabs.github.io/chrome-for-testing/
 */

import * as https from 'https'
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'

// Chrome for Testing 版本号
// 可从 https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json 获取最新版本
const CHROME_VERSION = '127.0.6533.88'

// 输出目录
const OUTPUT_DIR = join(__dirname, '..', 'chromiums')

// Chrome for Testing 下载配置
const DOWNLOADS = [
  {
    platform: 'win32-x64',
    url: `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/win64/chrome-win64.zip`,
    fileName: 'chromium-win64.zip'
  },
  {
    platform: 'linux-x64',
    url: `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chrome-linux64.zip`,
    fileName: 'chromium-linux64.zip'
  },
  {
    platform: 'darwin-x64',
    url: `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/mac-x64/chrome-mac-x64.zip`,
    fileName: 'chromium-darwin-x64.zip'
  },
  {
    platform: 'darwin-arm64',
    url: `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/mac-arm64/chrome-mac-arm64.zip`,
    fileName: 'chromium-darwin-arm64.zip'
  }
]

// 下载文件
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`  下载: ${url}`)
    
    const file = createWriteStream(destPath)
    let totalSize = 0
    let downloadedSize = 0
    let lastPercent = 0
    
    const request = (url: string) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307 || response.statusCode === 308) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            console.log(`  重定向到: ${redirectUrl}`)
            request(redirectUrl)
            return
          }
        }
        
        if (response.statusCode !== 200) {
          file.close()
          unlinkSync(destPath)
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }
        
        totalSize = parseInt(response.headers['content-length'] || '0', 10)
        console.log(`  文件大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          if (totalSize > 0) {
            const percent = Math.round((downloadedSize / totalSize) * 100)
            if (percent !== lastPercent && percent % 10 === 0) {
              console.log(`  进度: ${percent}%`)
              lastPercent = percent
            }
          }
        })
        
        response.pipe(file)
        
        file.on('finish', () => {
          file.close()
          console.log(`  完成: ${destPath}`)
          resolve()
        })
      }).on('error', (err) => {
        file.close()
        try { unlinkSync(destPath) } catch {}
        reject(err)
      })
    }
    
    request(url)
  })
}

// 主函数
async function main() {
  console.log('========================================')
  console.log('Chrome for Testing 下载脚本')
  console.log(`版本: ${CHROME_VERSION}`)
  console.log('========================================\n')
  
  // 创建输出目录
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`创建目录: ${OUTPUT_DIR}\n`)
  }
  
  // 下载每个平台
  for (const item of DOWNLOADS) {
    console.log(`\n[${item.platform}] ${item.fileName}`)
    const destPath = join(OUTPUT_DIR, item.fileName)
    
    // 检查是否已存在且有内容
    if (existsSync(destPath)) {
      const stats = await import('fs').then(fs => fs.statSync(destPath))
      if (stats.size > 1000000) { // 大于 1MB 认为是完整文件
        console.log(`  已存在 (${(stats.size / 1024 / 1024).toFixed(2)} MB)，跳过下载`)
        continue
      } else {
        console.log(`  文件不完整，重新下载...`)
        unlinkSync(destPath)
      }
    }
    
    try {
      await downloadFile(item.url, destPath)
    } catch (error: any) {
      console.error(`  下载失败: ${error.message}`)
    }
  }
  
  console.log('\n========================================')
  console.log('下载完成!')
  console.log(`文件保存在: ${OUTPUT_DIR}`)
  console.log('========================================')
}

main().catch(console.error)