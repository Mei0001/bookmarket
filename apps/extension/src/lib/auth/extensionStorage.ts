function isChromeStorageAvailable(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

function isLocalStorageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

export async function storageGet<T>(key: string): Promise<T | null> {
  if (isChromeStorageAvailable()) {
    const result = await chrome.storage.local.get(key);
    return (result?.[key] as T | undefined) ?? null;
  }
  if (isLocalStorageAvailable()) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  if (isChromeStorageAvailable()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  if (isLocalStorageAvailable()) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export async function storageRemove(key: string): Promise<void> {
  if (isChromeStorageAvailable()) {
    await chrome.storage.local.remove(key);
    return;
  }
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(key);
  }
}

