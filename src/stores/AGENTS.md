# Pinia State Stores

## OVERVIEW

4 Pinia stores managing Vue 3 application state: authentication, endpoints, notifications.

## WHERE TO LOOK

| File | Purpose |
|------|---------|
| `account.ts` | User auth state: token, username, login/logout |
| `endpoint.ts` | Login endpoints: CRUD, export/import, current selection |
| `notification.ts` | Toast notifications queue |
| `index.ts` | Store exports aggregator |

## PATTERNS

All stores use composition API:
```typescript
export const useXxxStore = defineStore('xxx', () => {
  const state = ref(...)
  async function action() { ... }
  return { state, action }
})
```

## IPC INTEGRATION

Async actions wrap IPC calls:
```typescript
async function loadEndpoints() {
  loading.value = true
  try {
    endpoints.value = await endpointApi.list()
  } finally {
    loading.value = false
  }
}
```

## STATE SHAPE

- `account`: `{ token, username, isAuthenticated }`
- `endpoint`: `{ endpoints[], currentEndpoint, loading, error }`
- `notification`: `{ toasts[] }`

## ANTI-PATTERNS

- **DO NOT** store sensitive data in localStorage directly - use IPC to backend
- **DO NOT** mutate state outside store actions
- **DO NOT** forget to handle loading/error states in async actions