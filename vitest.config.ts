import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'dist-electron', 'tests/unit/frontend/**'],
    setupFiles: ['tests/helpers/setup.ts'],
    // forks 池：每个测试文件独立子进程，避免 WASM (sql.js) 在 worker_threads 中卡死
    pool: 'forks',
    // 超时保护，避免测试无限挂起
    testTimeout: 30000,
    hookTimeout: 30000,
    // sql.js 是 WASM 模块，需内联避免 Vite 预处理导致加载失败
    deps: {
      inline: ['sql.js'],
    },
    // vitest 4.x 的 server.deps 已废弃，使用 deps.optimizer
    // 处理 import.meta.url 等 CJS/ESM 混合特性
    server: {
      deps: {
        fallbackCJS: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: 'tests/reports/coverage',
      include: ['electron/backend/**/*.ts'],
      exclude: [
        'electron/backend/**/*.d.ts',
        'dist-electron/**',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
