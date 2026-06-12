const TOKEN_STORAGE_KEY = "araris.auth.tokens";

let memoryTokens = null;

function getLocalStorage() {
  if (typeof globalThis === "undefined") {
    return null;
  }

  return globalThis.localStorage ?? null;
}

export async function saveTokens(tokens) {
  memoryTokens = tokens;

  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }
}

export async function getTokens() {
  const storage = getLocalStorage();
  if (!storage) {
    return memoryTokens;
  }

  const rawTokens = storage.getItem(TOKEN_STORAGE_KEY);
  if (!rawTokens) {
    return memoryTokens;
  }

  try {
    memoryTokens = JSON.parse(rawTokens);
    return memoryTokens;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function clearTokens() {
  memoryTokens = null;

  const storage = getLocalStorage();
  if (storage) {
    storage.removeItem(TOKEN_STORAGE_KEY);
  }
}
