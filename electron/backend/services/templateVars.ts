/** Regex matching `{{variable_name}}` where variable_name is `\w+`. */
export const TEMPLATE_VAR_REGEX = /\{\{(\w+)\}\}/g

export function createVarStore(): {
  set: (key: string, value: string) => void
  get: (key: string) => string | undefined
  has: (key: string) => boolean
  clear: () => void
  entries: () => [string, string][]
} {
  const store = new Map<string, string>()

  return {
    set(key: string, value: string): void {
      store.set(key, value)
    },
    get(key: string): string | undefined {
      return store.get(key)
    },
    has(key: string): boolean {
      return store.has(key)
    },
    clear(): void {
      store.clear()
    },
    entries(): [string, string][] {
      return Array.from(store.entries())
    },
  }
}

/** Unknown keys keep literal `{{key}}`; malformed syntax like `{{ }}` is not matched. */
export function resolveTemplateVars(
  input: string | null | undefined,
  store: { get(key: string): string | undefined },
): string {
  if (input == null || input === '') return ''

  return input.replace(TEMPLATE_VAR_REGEX, (match, key: string) => {
    const value = store.get(key)
    return value !== undefined ? value : match
  })
}