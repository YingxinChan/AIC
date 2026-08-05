import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Node's own built-in `localStorage` global (stable in this Node version)
// shadows jsdom's window.localStorage in this Vitest version, leaving both
// `localStorage` and `window.localStorage` undefined in tests. Polyfill
// with a plain in-memory Storage so auth code (see lib/api.js, authApi.js,
// useAuth.jsx) has something real to read/write in tests.
class MemoryStorage {
  #store = new Map()
  getItem(key) { return this.#store.has(key) ? this.#store.get(key) : null }
  setItem(key, value) { this.#store.set(key, String(value)) }
  removeItem(key) { this.#store.delete(key) }
  clear() { this.#store.clear() }
}
vi.stubGlobal('localStorage', new MemoryStorage())
