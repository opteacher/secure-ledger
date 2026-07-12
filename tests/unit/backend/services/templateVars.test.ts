/**
 * templateVars 服务单元测试 — 变量存储与模板解析
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createVarStore, resolveTemplateVars, TEMPLATE_VAR_REGEX } from '../../../../electron/backend/services/templateVars'

describe('templateVars 服务', () => {
  describe('createVarStore', () => {
    it('返回包含 set/get/has/clear/entries 方法的对象', () => {
      const store = createVarStore()
      expect(typeof store.set).toBe('function')
      expect(typeof store.get).toBe('function')
      expect(typeof store.has).toBe('function')
      expect(typeof store.clear).toBe('function')
      expect(typeof store.entries).toBe('function')
    })

    it('set/get 往返工作正常', () => {
      const store = createVarStore()
      store.set('key1', 'value1')
      expect(store.get('key1')).toBe('value1')
    })

    it('has() 对已存在键返回 true', () => {
      const store = createVarStore()
      store.set('exists', 'yes')
      expect(store.has('exists')).toBe(true)
    })

    it('has() 对不存在键返回 false', () => {
      const store = createVarStore()
      expect(store.has('missing')).toBe(false)
    })

    it('clear() 移除所有条目', () => {
      const store = createVarStore()
      store.set('a', '1')
      store.set('b', '2')
      store.clear()
      expect(store.has('a')).toBe(false)
      expect(store.has('b')).toBe(false)
      expect(store.entries()).toHaveLength(0)
    })

    it('entries() 返回所有键值对', () => {
      const store = createVarStore()
      store.set('a', '1')
      store.set('b', '2')
      const entries = store.entries()
      expect(entries).toHaveLength(2)
      expect(entries).toContainEqual(['a', '1'])
      expect(entries).toContainEqual(['b', '2'])
    })

    it('get() 对不存在键返回 undefined', () => {
      const store = createVarStore()
      expect(store.get('missing')).toBeUndefined()
    })

    it('set() 覆盖已有值', () => {
      const store = createVarStore()
      store.set('key', 'old')
      store.set('key', 'new')
      expect(store.get('key')).toBe('new')
    })
  })

  describe('resolveTemplateVars', () => {
    it('解析 {{key}} 为对应值', () => {
      const store = createVarStore()
      store.set('key', 'value')
      expect(resolveTemplateVars('{{key}}', store)).toBe('value')
    })

    it('未知键保留字面量 {{key}}', () => {
      const store = createVarStore()
      expect(resolveTemplateVars('{{unknown}}', store)).toBe('{{unknown}}')
    })

    it('多个变量同时解析', () => {
      const store = createVarStore()
      store.set('a', '1')
      store.set('b', '2')
      expect(resolveTemplateVars('{{a}}{{b}}', store)).toBe('12')
    })

    it('空字符串返回空字符串', () => {
      const store = createVarStore()
      expect(resolveTemplateVars('', store)).toBe('')
    })

    it('无模板的字符串原样返回', () => {
      const store = createVarStore()
      expect(resolveTemplateVars('plain text', store)).toBe('plain text')
    })

    it('{{ }} 带空白不被匹配（保留原样）', () => {
      const store = createVarStore()
      store.set('key', 'value')
      // 正则 \w+ 不匹配空格，所以 {{ }} 不会被替换
      expect(resolveTemplateVars('{{ }}', store)).toBe('{{ }}')
    })

    it('混合文本与模板变量', () => {
      const store = createVarStore()
      store.set('user', 'admin')
      expect(resolveTemplateVars('Hello {{user}}!', store)).toBe('Hello admin!')
    })

    it('同一变量多次出现均被替换', () => {
      const store = createVarStore()
      store.set('x', '42')
      expect(resolveTemplateVars('{{x}}-{{x}}-{{x}}', store)).toBe('42-42-42')
    })

    it('部分变量已知部分未知', () => {
      const store = createVarStore()
      store.set('known', 'yes')
      expect(resolveTemplateVars('{{known}}-{{unknown}}', store)).toBe('yes-{{unknown}}')
    })
  })

  describe('TEMPLATE_VAR_REGEX', () => {
    it('匹配 {{key}} 格式', () => {
      const matches = '{{key}}'.match(TEMPLATE_VAR_REGEX)
      expect(matches).not.toBeNull()
      expect(matches).toHaveLength(1)
    })

    it('全局匹配多个变量', () => {
      const matches = '{{a}}{{b}}{{c}}'.match(TEMPLATE_VAR_REGEX)
      expect(matches).toHaveLength(3)
    })

    it('不匹配带空白的 {{ }}', () => {
      const matches = '{{ }}'.match(TEMPLATE_VAR_REGEX)
      expect(matches).toBeNull()
    })
  })
})