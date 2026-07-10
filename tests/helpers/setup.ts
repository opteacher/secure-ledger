/**
 * Global test setup
 * - Mocks Electron APIs before all test runs
 * - Sets up test environment variables
 */
import { vi } from 'vitest'
import './electron-mock'

// Set test environment
process.env.NODE_ENV = 'test'
