import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAccountStore } from '@/stores/account'

const mockInvoke = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  ;(window as any).ipc = { invoke: mockInvoke, on: vi.fn(), send: vi.fn() }
  localStorage.clear()
})

describe('account store', () => {
  // ─── checkAuth ────────────────────────────────────────────────
  describe('checkAuth', () => {
    it('returns false when no token in state', async () => {
      const store = useAccountStore()
      const result = await store.checkAuth()
      expect(result).toBe(false)
    })

    it('returns true and sets username when token is valid', async () => {
      localStorage.setItem('token', 'valid-token')
      setActivePinia(createPinia())
      const store = useAccountStore()

      mockInvoke.mockResolvedValue({ valid: true, username: 'testuser' })

      const result = await store.checkAuth()

      expect(result).toBe(true)
      expect(store.username).toBe('testuser')
      expect(mockInvoke).toHaveBeenCalledWith('account:verify', 'valid-token')
    })

    it('returns false and calls logout when token is invalid', async () => {
      localStorage.setItem('token', 'bad-token')
      localStorage.setItem('username', 'some-user')
      setActivePinia(createPinia())
      const store = useAccountStore()

      mockInvoke.mockResolvedValue({ valid: false })

      const result = await store.checkAuth()

      expect(result).toBe(false)
      expect(store.token).toBeNull()
      expect(store.username).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('username')).toBeNull()
    })

    it('returns false and calls logout when verify API throws', async () => {
      localStorage.setItem('token', 'some-token')
      setActivePinia(createPinia())
      const store = useAccountStore()

      mockInvoke.mockRejectedValue(new Error('network error'))

      const result = await store.checkAuth()

      expect(result).toBe(false)
      expect(store.token).toBeNull()
      expect(store.username).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
    })
  })

  // ─── checkHasAccount ──────────────────────────────────────────
  describe('checkHasAccount', () => {
    it('returns true when account exists', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue(true)

      const result = await store.checkHasAccount()

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('account:hasAccount')
    })

    it('returns false when no account exists', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue(false)

      const result = await store.checkHasAccount()

      expect(result).toBe(false)
    })

    it('returns false when API throws', async () => {
      const store = useAccountStore()
      mockInvoke.mockRejectedValue(new Error('db error'))

      const result = await store.checkHasAccount()

      expect(result).toBe(false)
    })
  })

  // ─── login ────────────────────────────────────────────────────
  describe('login', () => {
    it('sets token and username in state and localStorage on success', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue({ token: 'new-token', username: 'new-user' })

      const result = await store.login('new-user', 'password123')

      expect(result).toBe(true)
      expect(store.token).toBe('new-token')
      expect(store.username).toBe('new-user')
      expect(localStorage.getItem('token')).toBe('new-token')
      expect(localStorage.getItem('username')).toBe('new-user')
      expect(mockInvoke).toHaveBeenCalledWith('account:login', {
        username: 'new-user',
        password: 'password123',
      })
    })

    it('sets error and returns false on API rejection', async () => {
      const store = useAccountStore()
      mockInvoke.mockRejectedValue(new Error('invalid credentials'))

      const result = await store.login('bad', 'wrong')

      expect(result).toBe(false)
      expect(store.error).toBe('invalid credentials')
      expect(store.token).toBeNull()
      expect(store.username).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('clears previous error on new login attempt', async () => {
      const store = useAccountStore()
      store.error = 'previous error'
      mockInvoke.mockResolvedValue({ token: 't', username: 'u' })

      await store.login('u', 'p')

      expect(store.error).toBeNull()
    })

    it('sets loading to true during invocation', async () => {
      const store = useAccountStore()

      mockInvoke.mockImplementation(() => {
        expect(store.loading).toBe(true)
        return Promise.resolve({ token: 't', username: 'u' })
      })

      await store.login('u', 'p')

      expect(store.loading).toBe(false)
    })

    it('sets loading to false even when API rejects', async () => {
      const store = useAccountStore()
      mockInvoke.mockRejectedValue(new Error('fail'))

      await store.login('u', 'p')

      expect(store.loading).toBe(false)
    })
  })

  // ─── createAccount ────────────────────────────────────────────
  describe('createAccount', () => {
    it('creates account then calls login on success, returning login result', async () => {
      const store = useAccountStore()

      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'account:create') {
          return Promise.resolve({ success: true, message: 'ok' })
        }
        if (channel === 'account:login') {
          return Promise.resolve({ token: 'new-tok', username: 'new-user' })
        }
        return Promise.resolve(null)
      })

      const result = await store.createAccount('new-user', 'password123')

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('account:create', {
        username: 'new-user',
        password: 'password123',
      })
      expect(store.token).toBe('new-tok')
      expect(store.username).toBe('new-user')
    })

    it('returns false when create succeeds but login fails', async () => {
      const store = useAccountStore()

      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'account:create') {
          return Promise.resolve({ success: true, message: 'ok' })
        }
        if (channel === 'account:login') {
          return Promise.reject(new Error('auto-login failed'))
        }
        return Promise.resolve(null)
      })

      const result = await store.createAccount('user', 'pass')

      expect(result).toBe(false)
      expect(store.error).toBe('auto-login failed')
    })

    it('returns false when create API returns success:false, no login called', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue({ success: false, message: 'username taken' })

      const result = await store.createAccount('exist', 'pass')

      expect(result).toBe(false)
      // login should not have been invoked
      const loginCalls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'account:login',
      )
      expect(loginCalls).toHaveLength(0)
      expect(store.token).toBeNull()
    })

    it('sets error and returns false when create API throws', async () => {
      const store = useAccountStore()
      mockInvoke.mockRejectedValue(new Error('db corrupt'))

      const result = await store.createAccount('user', 'pass')

      expect(result).toBe(false)
      expect(store.error).toBe('db corrupt')
    })

    it('sets loading to false after completion', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue({ success: false, message: 'no' })

      await store.createAccount('u', 'p')

      expect(store.loading).toBe(false)
    })
  })

  // ─── logout ───────────────────────────────────────────────────
  describe('logout', () => {
    it('clears token, username, and localStorage', () => {
      localStorage.setItem('token', 'some-token')
      localStorage.setItem('username', 'some-user')
      setActivePinia(createPinia())
      const store = useAccountStore()

      expect(store.token).toBe('some-token')
      expect(store.username).toBe('some-user')

      store.logout()

      expect(store.token).toBeNull()
      expect(store.username).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('username')).toBeNull()
    })

    it('is a no-op when already logged out', () => {
      const store = useAccountStore()

      store.logout()

      expect(store.token).toBeNull()
      expect(store.username).toBeNull()
    })
  })

  // ─── changePassword ───────────────────────────────────────────
  describe('changePassword', () => {
    it('returns true on success', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue({ success: true })

      const result = await store.changePassword('old', 'new')

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('account:changePassword', {
        oldPassword: 'old',
        newPassword: 'new',
      })
    })

    it('returns false when API returns success:false, does not set error', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue({ success: false })

      const result = await store.changePassword('old', 'new')

      expect(result).toBe(false)
      // error is only set on thrown exceptions, not on falsy result.success
      expect(store.error).toBeNull()
    })

    it('sets error and returns false when API throws', async () => {
      const store = useAccountStore()
      mockInvoke.mockRejectedValue(new Error('wrong old password'))

      const result = await store.changePassword('old', 'new')

      expect(result).toBe(false)
      expect(store.error).toBe('wrong old password')
    })

    it('sets loading to false after completion', async () => {
      const store = useAccountStore()
      mockInvoke.mockResolvedValue({ success: true })

      await store.changePassword('old', 'new')

      expect(store.loading).toBe(false)
    })

    it('clears previous error on new attempt', async () => {
      const store = useAccountStore()
      store.error = 'previous error'
      mockInvoke.mockResolvedValue({ success: true })

      await store.changePassword('old', 'new')

      expect(store.error).toBeNull()
    })
  })

  // ─── edge cases ───────────────────────────────────────────────
  describe('edge cases', () => {
    it('stale token in localStorage is cleared by checkAuth', async () => {
      localStorage.setItem('token', 'stale-token')
      localStorage.setItem('username', 'stale-user')
      setActivePinia(createPinia())
      const store = useAccountStore()

      mockInvoke.mockResolvedValue({ valid: false })

      await store.checkAuth()

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('username')).toBeNull()
      expect(store.token).toBeNull()
      expect(store.username).toBeNull()
    })

    it('isLoggedIn computed reflects token state', () => {
      const store = useAccountStore()

      expect(store.isLoggedIn).toBe(false)

      store.token = 'some-token'
      expect(store.isLoggedIn).toBe(true)

      store.token = null
      expect(store.isLoggedIn).toBe(false)
    })

    it('isLoggedIn returns true with just token set (no username)', () => {
      const store = useAccountStore()
      store.token = 'token-only'
      store.username = null

      expect(store.isLoggedIn).toBe(true)
    })

    it('checkAuth with valid token but missing username still succeeds', async () => {
      localStorage.setItem('token', 'valid-token')
      setActivePinia(createPinia())
      const store = useAccountStore()

      mockInvoke.mockResolvedValue({ valid: true })

      const result = await store.checkAuth()

      expect(result).toBe(true)
      // username stays null if not in response
      expect(store.username).toBeNull()
    })

    it('createAccount clears previous error', async () => {
      const store = useAccountStore()
      store.error = 'old error'
      mockInvoke.mockResolvedValue({ success: false, message: 'nope' })

      await store.createAccount('u', 'p')

      // error cleared in try block, not re-set because no exception thrown
      expect(store.error).toBeNull()
    })

    it('changePassword clears previous error on success', async () => {
      const store = useAccountStore()
      store.error = 'old error'
      mockInvoke.mockResolvedValue({ success: true })

      await store.changePassword('old', 'new')

      expect(store.error).toBeNull()
    })
  })
})
