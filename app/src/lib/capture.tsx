import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from './store';
import { detectPlatform } from './platforms';
import { ensureContentScript, getActiveTab, getTab, sendToTab } from './chrome';
import { toSnapshot, type RawChat } from './snapshot';
import type { ConversationSnapshot } from './types';

export { toSnapshot, blocksFromMarkdown, normalizeRole } from './snapshot';
export type { RawChat, RawMessage } from './snapshot';

export type CaptureError = 'NO_TAB' | 'UNSUPPORTED_PAGE' | 'NO_CONTENT_SCRIPT' | 'NO_MESSAGES' | 'COLLECT_FAILED' | 'EXTENSION_ONLY';

export interface CaptureOutcome {
  ok: boolean;
  snapshot: ConversationSnapshot | null;
  error: CaptureError | null;
  detail?: string;
  tabId: number | null;
  pageUrl: string;
}

/** Captures the conversation of one known tab. */
export async function captureFromTab(tabId: number, pageUrl: string): Promise<CaptureOutcome> {
  const det = detectPlatform(pageUrl);
  if (det.state === 'unsupported' || det.state === 'invalid') {
    return { ok: false, snapshot: null, error: 'UNSUPPORTED_PAGE', tabId, pageUrl };
  }
  const alive = await ensureContentScript(tabId);
  if (!alive) return { ok: false, snapshot: null, error: 'NO_CONTENT_SCRIPT', tabId, pageUrl };

  // Full-history capture may wait for the site's conversation API, so allow
  // well beyond the default messaging timeout.
  const response = await sendToTab<{ ok?: boolean; chatData?: RawChat; error?: string }>(tabId, { type: 'AM_COLLECT' }, 15000);
  if (!response || !response.ok || !response.chatData) {
    return { ok: false, snapshot: null, error: 'COLLECT_FAILED', detail: response?.error, tabId, pageUrl };
  }
  const snapshot = toSnapshot(response.chatData, pageUrl);
  if (!snapshot) return { ok: false, snapshot: null, error: 'NO_MESSAGES', tabId, pageUrl };
  return { ok: true, snapshot, error: null, tabId, pageUrl };
}

/** Captures whichever tab the user is looking at right now. */
export async function captureActiveTab(): Promise<CaptureOutcome> {
  const tab = await getActiveTab();
  if (!tab) return { ok: false, snapshot: null, error: 'NO_TAB', tabId: null, pageUrl: '' };
  const det = detectPlatform(tab.url);
  // The studio / settings pages live on the extension origin; fall back to the
  // tab that was remembered when the studio was opened.
  if (det.state === 'unsupported' || det.state === 'invalid') {
    return { ok: false, snapshot: null, error: 'UNSUPPORTED_PAGE', tabId: tab.id, pageUrl: tab.url };
  }
  return captureFromTab(tab.id, tab.url);
}

export async function captureTabById(tabId: number): Promise<CaptureOutcome> {
  const tab = await getTab(tabId);
  if (!tab) return { ok: false, snapshot: null, error: 'NO_TAB', tabId, pageUrl: '' };
  return captureFromTab(tab.id, tab.url);
}

/* --------------------------- provider ---------------------------- */

type CaptureState = 'idle' | 'loading' | 'ready' | 'error';

export interface CaptureApi {
  state: CaptureState;
  error: CaptureError | null;
  pageUrl: string;
  tabId: number | null;
  run: () => Promise<ConversationSnapshot | null>;
}

const Ctx = createContext<CaptureApi | null>(null);
export const useCapture = () => {
  const value = useContext(Ctx);
  if (!value) throw new Error('capture');
  return value;
};

export function CaptureProvider({ children, auto = true, tabId: fixedTabId = null }: { children: ReactNode; auto?: boolean; tabId?: number | null }) {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  const [state, setState] = useState<CaptureState>('idle');
  const [error, setError] = useState<CaptureError | null>(null);
  const [pageUrl, setPageUrl] = useState('');
  const [tabId, setTabId] = useState<number | null>(fixedTabId);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return null;
    running.current = true;
    setState('loading');
    setError(null);
    try {
      const outcome = fixedTabId ? await captureTabById(fixedTabId) : await captureActiveTab();
      setPageUrl(outcome.pageUrl || '');
      if (outcome.tabId != null) setTabId(outcome.tabId);
      if (!outcome.ok || !outcome.snapshot) {
        setError(outcome.error);
        setState('error');
        return null;
      }
      const snap = outcome.snapshot;
      storeRef.current.setCurrent(snap);
      if (storeRef.current.settings.autoCacheEnabled) storeRef.current.saveSnapshot(snap);
      setState('ready');
      return snap;
    } finally {
      running.current = false;
    }
  }, [fixedTabId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fixedTabId) {
        const tab = await getActiveTab();
        if (!cancelled && tab) {
          setPageUrl(tab.url);
          setTabId(tab.id);
        }
      }
      if (!cancelled && auto) await run();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Ctx.Provider value={{ state, error, pageUrl, tabId, run }}>{children}</Ctx.Provider>;
}
