const SESSION_KEYS_STORAGE_KEY = 'ai-quiz:session-keys'
const ACTIVE_SESSION_KEY_STORAGE_KEY = 'ai-quiz:active-session-key'

export function getStoredSessionKeys(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SESSION_KEYS_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : []
  } catch {
    return []
  }
}

export function setStoredSessionKeys(sessionKeys: string[]) {
  localStorage.setItem(SESSION_KEYS_STORAGE_KEY, JSON.stringify(sessionKeys))
}

export function addStoredSessionKey(sessionKey: string) {
  const sessionKeys = getStoredSessionKeys()
  if (!sessionKeys.includes(sessionKey)) setStoredSessionKeys([...sessionKeys, sessionKey])
}

export function removeStoredSessionKey(sessionKey: string) {
  setStoredSessionKeys(getStoredSessionKeys().filter((key) => key !== sessionKey))
  if (getActiveSessionKey() === sessionKey) {
    localStorage.removeItem(ACTIVE_SESSION_KEY_STORAGE_KEY)
  }
}

export function getActiveSessionKey() {
  return localStorage.getItem(ACTIVE_SESSION_KEY_STORAGE_KEY)
}

export function setActiveSessionKey(sessionKey: string) {
  localStorage.setItem(ACTIVE_SESSION_KEY_STORAGE_KEY, sessionKey)
}
