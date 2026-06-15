const browserApi = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser

export const extensionRuntime = browserApi ?? chrome
