/**
 * Thin, promise-based wrappers around the extension APIs used by the UI.
 *
 * Every helper degrades gracefully so the same React bundle can also be opened
 * as a plain web page (useful while designing or testing).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const chromeApi = (): any => (globalThis as any).chrome;
export const isExtension = () => Boolean(chromeApi()?.runtime?.id);

/** Files that make up the in-page adapter; kept in the manifest's load order. */
export const CONTENT_SCRIPTS = [
  'src/shared/platforms.js',
  'src/shared/i18n.js',
  'src/shared/persian-utils.js',
  'src/engine/util.js',
  'src/engine/extract.js',
  'src/engine/sites.js',
  'src/engine/format.js',
  'src/engine/zip.js',
  'src/engine/docx.js',
  'src/engine/image.js',
  'src/engine/bundle.js',
  'src/shared/draft-scope.js',
  'src/shared/storage.js',
  'src/shared/exporters.js',
  'src/vendor/zip-store.js',
  'src/shared/exporters-v2.js',
  'src/shared/engine-bridge.js',
  'src/shared/history.js',
  'src/content/content.js',
];

export const CONTENT_STYLES = ['src/content/content.css', 'src/content/theme-content.css'];

export type TabInfo = { id: number; url: string; title: string };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function extensionUrl(path: string): string {
  const api = chromeApi();
  if (api?.runtime?.getURL) return api.runtime.getURL(path);
  return path;
}

export async function getActiveTab(): Promise<TabInfo | null> {
  const api = chromeApi();
  if (!api?.tabs?.query) return null;
  try {
    const tabs: any[] = await api.tabs.query({ active: true, currentWindow: true });
    const tab = (tabs || []).find(t => t && typeof t.id === 'number');
    if (!tab) return null;
    return { id: tab.id, url: String(tab.url || tab.pendingUrl || ''), title: String(tab.title || '') };
  } catch {
    return null;
  }
}

export async function getTab(tabId: number): Promise<TabInfo | null> {
  const api = chromeApi();
  if (!api?.tabs?.get) return null;
  try {
    const tab = await api.tabs.get(tabId);
    if (!tab || typeof tab.id !== 'number') return null;
    return { id: tab.id, url: String(tab.url || tab.pendingUrl || ''), title: String(tab.title || '') };
  } catch {
    return null;
  }
}

export function sendToTab<T = any>(tabId: number, message: Record<string, unknown>, timeoutMs = 3500): Promise<T | null> {
  const api = chromeApi();
  if (!api?.tabs?.sendMessage) return Promise.resolve(null);
  return new Promise<T | null>(resolve => {
    let settled = false;
    const done = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      api.tabs.sendMessage(tabId, message, (response: T) => {
        void api.runtime?.lastError;
        done(response ?? null);
      });
    } catch {
      done(null);
    }
    // A content script that never answers must not hang the popup. Deep
    // captures read the site's API first, so callers can extend this.
    setTimeout(() => done(null), timeoutMs);
  });
}

/** Makes sure the in-page adapter is alive, injecting it on demand. */
export async function ensureContentScript(tabId: number): Promise<boolean> {
  const ping = await sendToTab<{ ok?: boolean }>(tabId, { type: 'AM_PING' });
  if (ping?.ok) return true;

  const api = chromeApi();
  if (!api?.scripting?.executeScript) return false;

  try {
    await api.scripting.insertCSS({ target: { tabId }, files: CONTENT_STYLES });
  } catch {
    /* CSS may already be present */
  }
  try {
    await api.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS, injectImmediately: true });
  } catch {
    return false;
  }
  await sleep(180);
  const again = await sendToTab<{ ok?: boolean }>(tabId, { type: 'AM_PING' });
  return Boolean(again?.ok);
}

/* ----------------------------- storage ----------------------------- */

function localFallback() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export async function storageGetAll(): Promise<Record<string, any>> {
  const api = chromeApi();
  if (!api?.storage?.local?.get) {
    const ls = localFallback();
    const out: Record<string, any> = {};
    if (!ls) return out;
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (!key) continue;
      try {
        out[key] = JSON.parse(ls.getItem(key) as string);
      } catch {
        /* ignore */
      }
    }
    return out;
  }
  try {
    return (await api.storage.local.get(null)) || {};
  } catch {
    return {};
  }
}

export async function storageGet<T = any>(key: string): Promise<T | undefined> {
  const api = chromeApi();
  if (!api?.storage?.local?.get) {
    const ls = localFallback();
    try {
      const raw = ls?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }
  try {
    const result = await api.storage.local.get(key);
    return result ? (result[key] as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function storageSet(items: Record<string, any>): Promise<void> {
  const api = chromeApi();
  if (!api?.storage?.local?.set) {
    const ls = localFallback();
    if (!ls) return;
    for (const [key, value] of Object.entries(items)) ls.setItem(key, JSON.stringify(value));
    return;
  }
  await api.storage.local.set(items);
}

export async function storageRemove(key: string): Promise<void> {
  const api = chromeApi();
  if (!api?.storage?.local?.remove) {
    localFallback()?.removeItem(key);
    return;
  }
  await api.storage.local.remove(key);
}

/* ------------------------- session hand-off ------------------------- */

export async function sessionSet(key: string, value: any): Promise<void> {
  const api = chromeApi();
  if (api?.storage?.session?.set) {
    try {
      await api.storage.session.set({ [key]: value });
      return;
    } catch {
      /* fall through */
    }
  }
  await storageSet({ [key]: value });
}

export async function sessionGet<T = any>(key: string): Promise<T | undefined> {
  const api = chromeApi();
  if (api?.storage?.session?.get) {
    try {
      const result = await api.storage.session.get(key);
      if (result && result[key] !== undefined) return result[key] as T;
    } catch {
      /* fall through */
    }
  }
  return storageGet<T>(key);
}

export async function sessionRemove(key: string): Promise<void> {
  const api = chromeApi();
  if (api?.storage?.session?.remove) {
    try {
      await api.storage.session.remove(key);
    } catch {
      /* fall through */
    }
  }
  await storageRemove(key);
}

/* --------------------------- navigation ---------------------------- */

export async function openStudioTab(handoffId?: string, tabId?: number | null): Promise<void> {
  const api = chromeApi();
  const params = new URLSearchParams();
  if (handoffId) params.set('id', handoffId);
  if (tabId != null) params.set('tab', String(tabId));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const url = extensionUrl(`dist/index.html#studio${suffix}`);
  if (api?.tabs?.create) {
    await api.tabs.create({ url });
    return;
  }
  globalThis.open(url, '_blank');
}

export async function openSettingsPage(): Promise<void> {
  const api = chromeApi();
  if (api?.runtime?.openOptionsPage) {
    try {
      await api.runtime.openOptionsPage();
      return;
    } catch {
      /* fall through */
    }
  }
  const url = extensionUrl('dist/index.html#settings');
  if (api?.tabs?.create) await api.tabs.create({ url });
}

export async function openSidePanel(): Promise<boolean> {
  const api = chromeApi();
  if (!api?.sidePanel?.open) return false;
  try {
    const win = await api.windows.getCurrent();
    await api.sidePanel.open({ windowId: win.id });
    return true;
  } catch {
    return false;
  }
}

/* ----------------------------- print ------------------------------- */

export async function openPrintTab(html: string, filename: string): Promise<boolean> {
  const api = chromeApi();
  const key = `am_print_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await storageSet({ [key]: { html, filename, at: Date.now() } });
  const url = extensionUrl(`src/print/print.html?key=${encodeURIComponent(key)}`);
  try {
    if (api?.tabs?.create) {
      await api.tabs.create({ url });
      return true;
    }
  } catch {
    return false;
  }
  globalThis.open(url, '_blank');
  return true;
}
