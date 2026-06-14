import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_STORAGE_KEY = "araris.auth.tokens";

let memoryTokens = null;

function getLocalStorage() {
  if (typeof globalThis === "undefined") {
    return null;
  }

  return globalThis.localStorage ?? null;
}

function shouldUseSecureStore() {
  return Platform.OS !== "web";
}

export async function saveTokens(tokens) {
  memoryTokens = tokens;

  if (shouldUseSecureStore()) {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    return;
  }

  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }
}

export async function getTokens() {
  if (shouldUseSecureStore()) {
    const rawSecureTokens = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    if (!rawSecureTokens) {
      return memoryTokens;
    }

    try {
      memoryTokens = JSON.parse(rawSecureTokens);
      return memoryTokens;
    } catch {
      await clearTokens();
      return null;
    }
  }

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

  if (shouldUseSecureStore()) {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    return;
  }

  const storage = getLocalStorage();
  if (storage) {
    storage.removeItem(TOKEN_STORAGE_KEY);
  }
}
