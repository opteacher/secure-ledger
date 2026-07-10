/**
 * 测试报告生成脚本
 * 
 * 读取 test-results 和 coverage 数据，生成完整的测试报告
 * 用法: node scripts/generate-test-report.js
 */
const fs = require('fs')
const path = require('path')

const REPORTS_DIR = path.resolve(__dirname, '..', 'tests', 'reports')
const COVERAGE_DIR = path.join(REPORTS_DIR, 'coverage')
const E2E_REPORT_DIR = path.join(REPORTS_DIR, 'e2e-report')

function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch (e) {
    console.warn(`Warning: Could not read ${filePath}: ${e.message}`)
  }
  return null
}

function collectCoverage() {
  const summaryPath = path.join(COVERAGE_DIR, 'coverage-summary.json')
  const summary = readJsonSafe(summaryPath)
  if (!summary) {
    // Try to read from vitest json-summary output
    const altPath = path.join(COVERAGE_DIR, 'coverage-final.json')
    return readJsonSafe(altPath) || null
  }
  return summary
}

function collectUnitTestResults() {
  const resultsPath = path.join(REPORTS_DIR, 'unit-test-results.json')
  return readJsonSafe(resultsPath)
}

function collectE2EResults() {
  const resultsPath = path.join(E2E_REPORT_DIR, '.report.json')
  return readJsonSafe(resultsPath)
}

function formatCoverageTable(coverage) {
  if (!coverage) return '覆盖率数据未找到'

  let total = { statements: { pct: 0 }, branches: { pct: 0 }, functions: { pct: 0 }, lines: { pct: 0 } }
  let totalCount = 0

  const rows = []
  for (const [filePath, data] of Object.entries(coverage)) {
    if (filePath === 'total') {
      total = data
      continue
    }
    if (!data.lines || data.lines.total === 0) continue

    totalCount++
    const relPath = filePath.replace(/\\/g, '/').replace(/^.*?electron\/backend\//, 'electron/backend/')
    const module = relPath.split('/')[2] || 'other'
    
    rows.push({
      module,
      file: relPath,
      statements: `${(data.statements?.pct || 0).toFixed(1)}%`,
      branches: `${(data.branches?.pct || 0).toFixed(1)}%`,
      functions: `${(data.functions?.pct || 0).toFixed(1)}%`,
      lines: `${(data.lines?.pct || 0).toFixed(1)}%`,
    })
  }

  let table = `| 文件 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 | 行覆盖率 |\n`
  table += `|------|-----------|-----------|-----------|---------|\n`

  // Group by module
  const byModule = {}
  for (const row of rows) {
    if (!byModule[row.module]) byModule[row.module] = []
    byModule[row.module].push(row)
  }

  for (const [module, files] of Object.entries(byModule)) {
    if (module !== 'other') {
      table += `| **${module}** | | | | |\n`
    }
    for (const file of files) {
      table += `| ${file.file} | ${file.statements} | ${file.branches} | ${file.functions} | ${file.lines} |\n`
    }
  }

  table += `\n**总计**: ${(total.statements?.pct || 0).toFixed(1)}% 语句, ${(total.branches?.pct || 0).toFixed(1)}% 分支, ${(total.functions?.pct || 0).toFixed(1)}% 函数, ${(total.lines?.pct || 0).toFixed(1)}% 行`

  return table
}

function formatTestResults(results) {
  if (!results) return '测试结果数据未找到'

  const { numTotalTests, numPassedTests, numFailedTests, numPendingTests } = results
  return `${numPassedTests || 0}/${numTotalTests || 0} 通过 (${numFailedTests || 0} 失败, ${numPendingTests || 0} 跳过)`
}

function generateReport() {
  const coverage = collectCoverage()
  const unitResults = collectUnitTestResults()
  const e2eResults = collectE2EResults()

  const now = new Date().toISOString()
  const commit = process.env.GIT_COMMIT || ''
  const branch = process.env.GIT_BRANCH || ''

  let report = `# Secure Ledger 测试报告\n\n`
  report += `> 生成日期: ${now}\n`
  report += `> 提交: ${commit}\n`
  report += `> 分支: ${branch}\n\n`

  report += `---\n\n## 测试概述\n\n`
  report += `| 项目 | 后端单元测试 | 前端 E2E 测试 |\n`
  report += `|------|------------|--------------|\n`
  report += `| 测试框架 | Vitest | Playwright |\n`
  report += `| 测试范围 | 白盒测试 (electron/backend/) | 黑盒测试 (Vue 3 UI) |\n`
  report += `| 测试环境 | Node.js | Chromium (headless) |\n`
  report += `| 覆盖率目标 | ≥70% 语句覆盖率 | 功能完整度 |\n\n`

  report += `## 测试执行结果\n\n`
  report += `- 后端单元测试: ${formatTestResults(unitResults)}\n`
  report += `- E2E 测试: ${formatTestResults(e2eResults)}\n\n`

  report += `## 覆盖率报告\n\n`
  report += `${formatCoverageTable(coverage)}\n\n`

  report += `## 检查清单\n\n`
  report += `- [ ] 所有后端测试通过\n`
  report += `- [ ] 覆盖率满足目标 (语句≥70%, 分支≥60%, 函数≥70%)\n`
  report += `- [ ] 所有 E2E 测试通过\n`
  report += `- [ ] 无严重/阻塞性问题\n\n`

  report += `---\n\n*报告由脚本自动生成*\n`

  const reportPath = path.join(REPORTS_DIR, 'TEST_REPORT.md')
  fs.writeFileSync(reportPath, report, 'utf-8')
  console.log(`测试报告已生成: ${reportPath}`)
}

generateReport()
