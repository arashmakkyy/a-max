import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_EXPORT_OPTIONS, DEFAULT_SETTINGS, nowISO, uid,
  type ConversationCollection, type ConversationSnapshot, type PromptDraft,
  type PromptHistoryItem, type PromptTemplate, type Settings, type PlatformId,
} from './types';
import { chromeApi, storageGet, storageGetAll, storageSet } from './chrome';
import {
  LEGACY_KEYS, draftsToLegacy, historyToLegacy, legacyChatsToSnapshots, legacyDraftsToPromptDrafts,
  legacyHistoryToItems, legacySettingsToSettings, legacyTemplatesToTemplates, mergeDrafts,
  mergeHistory, mergeTemplates, templatesToLegacy,
} from './migrate';

/** Storage namespace owned by A.max (never the host page's keys in the extension build). */
const NS = 'amtool:v2:';
const MIGRATION_KEY = `${NS}migration`;
const MIGRATION_VERSION = 2;
const LEGACY_SETTINGS_KEY = LEGACY_KEYS.SETTINGS;

const emptyCollection = (): ConversationCollection => ({ schemaVersion: 1, id: uid(), title: '', createdAt: nowISO(), updatedAt: nowISO(), items: [] });

const UI_THEME_TO_ENGINE: Record<string, string> = {
  light: 'light', dark: 'dark', note: 'note', oldpaper: 'old_paper', sakura: 'sakura',
  bluemist: 'blue_mist', freshgreen: 'fresh_green', lavender: 'lavender',
};

/**
 * The in-page adapter (content script) reads its own settings record. Mirroring
 * the shared switches keeps the dock, prompt guard and RTL fixes in sync.
 */
function legacySettingsPatch(settings: Settings): Record<string, unknown> {
  const o = settings.defaultExportOptions;
  return {
    language: settings.uiLanguage,
    uiTheme: settings.uiTheme,
    showFloatingDock: settings.dockEnabled,
    showSingleExportBtn: settings.singleMessageMenuEnabled,
    includeThinkingContent: o.includeThinking,
    showMessageTimestamp: o.includeTimestamps,
    includeSourceUrl: o.includeSource,
    appendBranding: o.brandingEnabled,
    customBrandingText: o.brandingText,
    exportTheme: UI_THEME_TO_ENGINE[o.theme] || 'light',
    exportFontSize: o.fontSize,
    exportTableStyle: o.tableStyle === 'borderless' ? 'none' : o.tableStyle,
    pdfFormat: o.paperSize,
    pdfOrientation: o.orientation,
    pdfShowPageNumbers: o.pageNumbers,
    cacheRetentionDays: settings.cacheTTLDays,
    autoSavePrompts: settings.promptGuardEnabled,
    autoShowRecoveryBanner: settings.recoveryBannerEnabled,
    autoFillEmptyInputOnCrashRecovery: settings.autoRestoreEnabled,
    maxPromptHistoryItems: settings.maxPromptHistory,
    autoFixPersianBiDi: settings.autoBidi,
    autoFixInputDirection: settings.autoInputDirection,
    applyPersianFontOnPage: settings.persianFontEnabled,
  };
}

export type SaveState = 'clean' | 'saving' | 'saved' | 'failed';
export type Toast = { id: string; kind: 'success' | 'error' | 'info' | 'warning'; text: string };

const SEED_TEMPLATES = (lang: 'fa' | 'en'): PromptTemplate[] => {
  const t = nowISO();
  const fa = [
    ['خلاصه ساختاریافته', 'نگارش', 'متن زیر را در سه بخش «نکات کلیدی»، «جزئیات» و «اقدام‌های بعدی» خلاصه کن. زبان خروجی فارسی روان باشد.'],
    ['بازبینی کد', 'برنامه‌نویسی', 'این کد را بازبینی کن: باگ‌های احتمالی، مشکلات کارایی و پیشنهاد اصلاح را با مثال کوتاه بیان کن.'],
    ['ترجمه دقیق فا/en', 'ترجمه', 'متن را به انگلیسی طبیعی ترجمه کن؛ اصطلاحات فنی را حفظ کن و در پایان واژه‌نامه کوتاهی بده.'],
  ];
  const en = [
    ['Structured summary', 'Writing', 'Summarize the text below in three sections: Key points, Details, Next actions.'],
    ['Code review', 'Programming', 'Review this code: likely bugs, performance issues and suggested fixes with short examples.'],
    ['Accurate translation', 'Translation', 'Translate the text into natural Persian; keep technical terms and add a short glossary.'],
  ];
  return (lang === 'fa' ? fa : en).map(([title, category, body]) => ({ schemaVersion: 1, id: uid(), title, category, body, createdAt: t, updatedAt: t }));
};

interface Store {
  settings: Settings; setSettings: (patch: Partial<Settings>) => void; settingsSave: SaveState; resetExportDefaults: () => void;
  lang: 'fa' | 'en'; theme: 'dark' | 'light';
  snapshots: ConversationSnapshot[]; saveSnapshot: (s: ConversationSnapshot) => void; deleteSnapshots: (ids: string[]) => void; togglePin: (id: string) => void;
  current: ConversationSnapshot | null; setCurrent: (s: ConversationSnapshot | null) => void;
  collections: ConversationCollection[]; activeCollection: ConversationCollection; addToCollection: (s: ConversationSnapshot, mode?: 'ask' | 'replace' | 'version') => 'added' | 'duplicate' | 'replaced' | 'versioned';
  removeFromCollection: (snapshotId: string) => void; moveInCollection: (snapshotId: string, dir: -1 | 1) => void; clearCollection: () => void; renameCollection: (t: string) => void;
  drafts: PromptDraft[]; upsertDraft: (platformId: PlatformId, key: string, composerKey: string, text: string) => Promise<PromptDraft | null>;
  deleteDraft: (id: string) => void; markSubmitted: (id: string) => void; draftSave: SaveState; lastDraftSavedAt: string | null;
  history: PromptHistoryItem[]; deleteHistory: (id: string) => void; clearHistory: () => void; togglePinHistory: (id: string) => void;
  templates: PromptTemplate[]; upsertTemplate: (t: Partial<PromptTemplate> & { title: string; body: string }) => void; deleteTemplate: (id: string) => void;
  toasts: Toast[]; toast: (kind: Toast['kind'], text: string) => void; dismissToast: (id: string) => void;
  importBackup: (json: string, mode: 'merge' | 'replace') => { ok: boolean; report: string };
  exportBackup: () => string; clearAll: () => void; storageBytes: number;
  migratedFromLegacy: number;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => { const s = useContext(Ctx); if (!s) throw new Error('store'); return s; };

/** Normalises the stored settings object without losing newer defaults. */
function readSettings(raw: unknown): Settings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    defaultExportOptions: { ...DEFAULT_EXPORT_OPTIONS, ...(value.defaultExportOptions || {}) },
    platformOverrides: { ...(value.platformOverrides || {}) },
  };
}

const snapshotKey = (s: ConversationSnapshot) => s.id;
function uniqueSnapshots(list: ConversationSnapshot[]): ConversationSnapshot[] {
  const seen = new Set<string>();
  const out: ConversationSnapshot[] = [];
  for (const item of list) {
    if (!item || !item.id || seen.has(snapshotKey(item)) || !Array.isArray(item.messages)) continue;
    seen.add(snapshotKey(item));
    out.push(item);
  }
  return out;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsSave, setSettingsSave] = useState<SaveState>('clean');
  const [snapshots, setSnapshots] = useState<ConversationSnapshot[]>([]);
  const [collections, setCollections] = useState<ConversationCollection[]>(() => [emptyCollection()]);
  const [drafts, setDrafts] = useState<PromptDraft[]>([]);
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [current, setCurrent] = useState<ConversationSnapshot | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [draftSave, setDraftSave] = useState<SaveState>('clean');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [storageBytes, setStorageBytes] = useState(0);
  const [migratedFromLegacy, setMigratedFromLegacy] = useState(0);

  /** JSON of what this window last wrote, so echoes are ignored. */
  const lastWritten = useRef<Record<string, string>>({});
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---- hydrate from chrome.storage.local (or localStorage when previewing as a web page) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await storageGetAll();
      if (cancelled) return;
      const pickArr = <T,>(key: string): T[] => (Array.isArray(all[NS + key]) ? (all[NS + key] as T[]) : []);

      // Settings: the v2 record wins; on a fresh upgrade the 1.x record is mapped.
      const storedSettings = readSettings(all[NS + 'settings']);
      const settingsFromLegacy = !storedSettings;
      const loadedSettings = storedSettings || legacySettingsToSettings(all[LEGACY_SETTINGS_KEY], DEFAULT_SETTINGS);

      // Prompt data: union of v2 and 1.x records; ids stay stable across runs.
      const legacyDrafts = legacyDraftsToPromptDrafts(all[LEGACY_KEYS.LIVE_DRAFTS]);
      const legacyHistory = legacyHistoryToItems(all[LEGACY_KEYS.HISTORY]);
      const legacyTemplates = legacyTemplatesToTemplates(all[LEGACY_KEYS.TEMPLATES]);
      const storedDrafts = pickArr<PromptDraft>('drafts');
      const storedHistory = pickArr<PromptHistoryItem>('history');
      const storedTemplates = pickArr<PromptTemplate>('templates');

      const loadedDrafts = mergeDrafts(storedDrafts, legacyDrafts);
      const loadedHistory = mergeHistory(storedHistory, legacyHistory);
      const loadedTemplates = legacyTemplates.length
        ? mergeTemplates(storedTemplates, legacyTemplates)
        : (all[NS + 'templates'] ? storedTemplates : SEED_TEMPLATES(loadedSettings.uiLanguage));

      // Conversations: the old cache + side-panel aggregation become snapshots
      // and a single collection, keeping the user's chosen order.
      const migratedChats = legacyChatsToSnapshots(all[LEGACY_KEYS.CACHE], all[LEGACY_KEYS.AGGREGATION], loadedSettings.uiLanguage);
      const loadedSnapshots = uniqueSnapshots([...pickArr<ConversationSnapshot>('snapshots'), ...migratedChats.snapshots]);

      const storedCollections = pickArr<ConversationCollection>('collections').filter(c => c && Array.isArray(c.items));
      const loadedCollections = storedCollections.length ? storedCollections : [emptyCollection()];
      if (migratedChats.items.length) {
        const first = loadedCollections[0];
        const known = new Set(first.items.map(item => item.snapshotId));
        const additions = migratedChats.items.filter(item => !known.has(item.snapshotId));
        if (additions.length) {
          loadedCollections[0] = {
            ...first,
            items: [...first.items, ...additions.map((item, index) => ({ ...item, order: first.items.length + index }))],
            updatedAt: nowISO(),
          };
        }
      }

      if (cancelled) return;
      setSettingsState(loadedSettings);
      setSnapshots(loadedSnapshots);
      setCollections(loadedCollections);
      setDrafts(loadedDrafts);
      setHistory(loadedHistory);
      setTemplates(loadedTemplates);
      setMigratedFromLegacy(legacyDrafts.length + legacyHistory.length + legacyTemplates.length + migratedChats.snapshots.length);

      // Persist the merged result immediately so both storage schemas agree
      // and a second run of the migration cannot duplicate anything.
      const payload: Record<string, unknown> = {
        [NS + 'settings']: loadedSettings,
        [NS + 'snapshots']: loadedSnapshots,
        [NS + 'collections']: loadedCollections,
        [NS + 'drafts']: loadedDrafts,
        [NS + 'history']: loadedHistory,
        [NS + 'templates']: loadedTemplates,
        [LEGACY_KEYS.LIVE_DRAFTS]: draftsToLegacy(loadedDrafts),
        [LEGACY_KEYS.HISTORY]: historyToLegacy(loadedHistory),
        [LEGACY_KEYS.TEMPLATES]: templatesToLegacy(loadedTemplates),
        [MIGRATION_KEY]: { version: MIGRATION_VERSION, at: nowISO(), settingsFromLegacy },
      };
      for (const [key, value] of Object.entries(payload)) lastWritten.current[key] = JSON.stringify(value);
      try {
        await storageSet(payload);
      } catch {
        /* keep the in-memory state; the next edit retries the write */
      }
      readyRef.current = true;
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  const theme = settings.uiTheme === 'system' ? (sysDark ? 'dark' : 'light') : settings.uiTheme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = settings.uiLanguage;
    document.documentElement.dir = settings.uiLanguage === 'fa' ? 'rtl' : 'ltr';
  }, [theme, settings.uiLanguage]);

  const recount = useCallback(async () => {
    const all = await storageGetAll();
    let n = 0;
    for (const [key, value] of Object.entries(all)) if (key.startsWith(NS)) n += JSON.stringify(value).length * 2;
    setStorageBytes(n);
  }, []);
  useEffect(() => { if (ready) void recount(); }, [ready, recount]);

  /** Writes v2 data plus the 1.x mirror the content script still reads. */
  const persist = useCallback((entries: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(entries)) lastWritten.current[key] = JSON.stringify(value);
    return storageSet(entries).then(recount).catch(() => { setSettingsSave('failed'); });
  }, [recount]);

  useEffect(() => { if (ready) void persist({ [NS + 'snapshots']: snapshots }); }, [snapshots, ready, persist]);
  useEffect(() => { if (ready) void persist({ [NS + 'collections']: collections }); }, [collections, ready, persist]);
  useEffect(() => {
    if (!ready) return;
    void persist({ [NS + 'drafts']: drafts, [LEGACY_KEYS.LIVE_DRAFTS]: draftsToLegacy(drafts) });
  }, [drafts, ready, persist]);
  useEffect(() => {
    if (!ready) return;
    void persist({ [NS + 'history']: history, [LEGACY_KEYS.HISTORY]: historyToLegacy(history) });
  }, [history, ready, persist]);
  useEffect(() => {
    if (!ready) return;
    void persist({ [NS + 'templates']: templates, [LEGACY_KEYS.TEMPLATES]: templatesToLegacy(templates) });
  }, [templates, ready, persist]);

  // Mirror the shared switches into the record the content script reads.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const existing = (await storageGet<Record<string, unknown>>(LEGACY_SETTINGS_KEY)) || {};
      const merged = { ...existing, ...legacySettingsPatch(settings) };
      if (JSON.stringify(merged) === lastWritten.current[LEGACY_SETTINGS_KEY]) return;
      await persist({ [LEGACY_SETTINGS_KEY]: merged });
    })();
  }, [ready, settings, persist]);

  /**
   * Two-way sync: other extension windows write the v2 records while the
   * content script writes the 1.x records. Both are folded into one state so a
   * draft saved inside ChatGPT is visible in the popup immediately.
   */
  useEffect(() => {
    const api = chromeApi();
    if (!api?.storage?.onChanged) return;
    const handler = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !readyRef.current) return;
      const change = (key: string) => changes[key]?.newValue;
      const wasEcho = (key: string, value: unknown) => JSON.stringify(value) === lastWritten.current[key];

      if (changes[NS + 'drafts']) {
        const value = change(NS + 'drafts');
        if (Array.isArray(value) && !wasEcho(NS + 'drafts', value)) {
          setDrafts(prev => (JSON.stringify(prev) === JSON.stringify(value) ? prev : value as PromptDraft[]));
        }
      }
      if (changes[NS + 'history']) {
        const value = change(NS + 'history');
        if (Array.isArray(value) && !wasEcho(NS + 'history', value)) {
          setHistory(prev => (JSON.stringify(prev) === JSON.stringify(value) ? prev : value as PromptHistoryItem[]));
        }
      }
      if (changes[NS + 'templates']) {
        const value = change(NS + 'templates');
        if (Array.isArray(value) && !wasEcho(NS + 'templates', value)) {
          setTemplates(prev => (JSON.stringify(prev) === JSON.stringify(value) ? prev : value as PromptTemplate[]));
        }
      }
      if (changes[NS + 'snapshots']) {
        const value = change(NS + 'snapshots');
        if (Array.isArray(value) && !wasEcho(NS + 'snapshots', value)) {
          setSnapshots(prev => (JSON.stringify(prev) === JSON.stringify(value) ? prev : uniqueSnapshots(value as ConversationSnapshot[])));
        }
      }
      if (changes[NS + 'collections']) {
        const value = change(NS + 'collections');
        if (Array.isArray(value) && !wasEcho(NS + 'collections', value)) {
          setCollections(prev => (JSON.stringify(prev) === JSON.stringify(value) ? prev : value as ConversationCollection[]));
        }
      }
      if (changes[NS + 'settings']) {
        const value = readSettings(change(NS + 'settings'));
        if (value && !wasEcho(NS + 'settings', change(NS + 'settings'))) {
          setSettingsState(prev => (JSON.stringify(prev) === JSON.stringify(value) ? prev : value));
        }
      }
      // The in-page adapter mirrors the shared switches back; adopt changes it
      // makes (for example when the user disables the guard from the page).
      if (changes[LEGACY_SETTINGS_KEY] && !wasEcho(LEGACY_SETTINGS_KEY, change(LEGACY_SETTINGS_KEY))) {
        const raw = change(LEGACY_SETTINGS_KEY) as Record<string, unknown> | undefined;
        if (raw && typeof raw === 'object') {
          setSettingsState(prev => {
            const next = {
              ...prev,
              uiLanguage: raw.language === 'en' ? 'en' as const : raw.language === 'fa' ? 'fa' as const : prev.uiLanguage,
              promptGuardEnabled: typeof raw.autoSavePrompts === 'boolean' ? raw.autoSavePrompts : prev.promptGuardEnabled,
            };
            return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
          });
        }
      }
      if (changes[LEGACY_KEYS.LIVE_DRAFTS] && !wasEcho(LEGACY_KEYS.LIVE_DRAFTS, change(LEGACY_KEYS.LIVE_DRAFTS))) {
        const incoming = legacyDraftsToPromptDrafts(change(LEGACY_KEYS.LIVE_DRAFTS));
        setDrafts(prev => {
          const incomingKeys = new Set(incoming.map(d => [d.platformId, d.canonicalConversationKey, d.composerKey].join('::')));
          const stillThere = prev.filter(d => incomingKeys.has([d.platformId, d.canonicalConversationKey, d.composerKey].join('::')));
          const merged = mergeDrafts(stillThere, incoming);
          return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged;
        });
        setLastDraftSavedAt(incoming.length ? nowISO() : lastDraftSavedAt);
      }
      if (changes[LEGACY_KEYS.HISTORY] && !wasEcho(LEGACY_KEYS.HISTORY, change(LEGACY_KEYS.HISTORY))) {
        const incoming = legacyHistoryToItems(change(LEGACY_KEYS.HISTORY));
        setHistory(prev => { const merged = mergeHistory(prev, incoming); return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged; });
      }
      if (changes[LEGACY_KEYS.TEMPLATES] && !wasEcho(LEGACY_KEYS.TEMPLATES, change(LEGACY_KEYS.TEMPLATES))) {
        const incoming = legacyTemplatesToTemplates(change(LEGACY_KEYS.TEMPLATES));
        if (incoming.length) setTemplates(prev => { const merged = mergeTemplates(prev, incoming); return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged; });
      }
    };
    api.storage.onChanged.addListener(handler);
    return () => api.storage.onChanged.removeListener(handler);
  }, [lastDraftSavedAt]);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = uid();
    setToasts(t => [...t, { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));

  const saveTimer = useRef<number | null>(null);
  const setSettings = useCallback((patch: Partial<Settings>) => {
    // Side effects stay outside the state updater: StrictMode may call an
    // updater twice, which would fire duplicate storage writes.
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettingsState(next);
    setSettingsSave('saving');
    void (async () => {
      try {
        lastWritten.current[NS + 'settings'] = JSON.stringify(next);
        await storageSet({ [NS + 'settings']: next });
        setSettingsSave('saved');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => setSettingsSave('clean'), 1500);
      } catch {
        setSettingsSave('failed');
      }
    })();
  }, []);
  const resetExportDefaults = () => setSettings({ defaultExportOptions: DEFAULT_SETTINGS.defaultExportOptions });

  // TTL cleanup for cache (not pinned) and drafts. Unparseable dates are kept
  // so a malformed record can never wipe real user data.
  useEffect(() => {
    if (!ready) return;
    const cutoff = Date.now() - settings.cacheTTLDays * 864e5;
    setSnapshots(s => {
      const next = s.filter(x => x.pinned || !Number.isFinite(Date.parse(x.capturedAt)) || Date.parse(x.capturedAt) > cutoff);
      return next.length === s.length ? s : next;
    });
    const dcut = Date.now() - settings.draftTTLDays * 864e5;
    setDrafts(d => {
      const next = d.filter(x => !Number.isFinite(Date.parse(x.updatedAt)) || Date.parse(x.updatedAt) > dcut);
      return next.length === d.length ? d : next;
    });
  }, [ready, settings.cacheTTLDays, settings.draftTTLDays]);

  const saveSnapshot = (s: ConversationSnapshot) => setSnapshots(prev => [s, ...prev.filter(x => x.id !== s.id)]);
  const deleteSnapshots = (ids: string[]) => {
    setSnapshots(prev => prev.filter(x => !ids.includes(x.id)));
    setCollections(cs => cs.map(c => ({ ...c, items: c.items.filter(i => !ids.includes(i.snapshotId)), updatedAt: nowISO() })));
  };
  const togglePin = (id: string) => setSnapshots(prev => prev.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x));

  const activeCollection = collections[0];
  const conversationFingerprint = (s: ConversationSnapshot) =>
    `${s.platformId}|${(s.canonicalURL || '').split('#')[0]}|${s.externalConversationId ?? ''}|${s.title}`;
  const addToCollection: Store['addToCollection'] = (s, mode = 'ask') => {
    const existingSnapshot = activeCollection.items
      .map(item => snapshots.find(x => x.id === item.snapshotId))
      .find((x): x is ConversationSnapshot => Boolean(x && conversationFingerprint(x) === conversationFingerprint(s)));
    if (existingSnapshot && mode === 'ask') return 'duplicate';
    saveSnapshot(s);
    setCollections(cs => cs.map((c, idx) => {
      if (idx !== 0) return c;
      let items = c.items;
      if (existingSnapshot && mode === 'replace') items = items.map(i => i.snapshotId === existingSnapshot.id ? { ...i, snapshotId: s.id } : i);
      else items = [...items, { snapshotId: s.id, order: items.length }];
      return { ...c, items: items.map((i, k) => ({ ...i, order: k })), updatedAt: nowISO() };
    }));
    if (existingSnapshot && mode === 'replace') setSnapshots(prev => prev.filter(x => x.id !== existingSnapshot.id));
    return existingSnapshot ? (mode === 'replace' ? 'replaced' : 'versioned') : 'added';
  };
  const removeFromCollection = (id: string) => setCollections(cs => cs.map((c, i) => i ? c : { ...c, items: c.items.filter(x => x.snapshotId !== id).map((x, k) => ({ ...x, order: k })), updatedAt: nowISO() }));
  const moveInCollection = (id: string, dir: -1 | 1) => setCollections(cs => cs.map((c, i) => {
    if (i) return c;
    const items = [...c.items];
    const idx = items.findIndex(x => x.snapshotId === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return c;
    [items[idx], items[j]] = [items[j], items[idx]];
    return { ...c, items: items.map((x, k) => ({ ...x, order: k })), updatedAt: nowISO() };
  }));
  const clearCollection = () => setCollections(cs => cs.map((c, i) => i ? c : { ...c, items: [], updatedAt: nowISO() }));
  const renameCollection = (title: string) => setCollections(cs => cs.map((c, i) => i ? c : { ...c, title, updatedAt: nowISO() }));

  const upsertDraft: Store['upsertDraft'] = async (platformId, key, composerKey, text) => {
    if (!settings.promptGuardEnabled || settings.promptGuardConsentVersion == null) return null;
    setDraftSave('saving');
    const t = nowISO();
    const existing = drafts.find(d => d.platformId === platformId && d.canonicalConversationKey === key && d.composerKey === composerKey && d.state !== 'submitted');
    const draft: PromptDraft = existing
      ? { ...existing, text, revision: existing.revision + 1, updatedAt: t, persistedAt: t, state: 'saved' }
      : { schemaVersion: 1, id: uid(), platformId, canonicalConversationKey: key, composerKey, text, revision: 1, createdAt: t, updatedAt: t, persistedAt: t, state: 'saved' };
    setDrafts(prev => [draft, ...prev.filter(x => x.id !== draft.id && !(x.platformId === platformId && x.canonicalConversationKey === key && x.composerKey === composerKey))]);
    try {
      await storageSet({ [NS + 'drafts-probe']: Date.now() });
      setDraftSave('saved');
      setLastDraftSavedAt(nowISO());
    } catch {
      setDraftSave('failed');
    }
    return draft;
  };
  const deleteDraft = (id: string) => setDrafts(p => p.filter(d => d.id !== id));
  const markSubmitted = (id: string) => {
    const draft = drafts.find(x => x.id === id);
    if (!draft) return;
    setDrafts(p => p.filter(x => x.id !== id));
    setHistory(h => [{
      schemaVersion: 1 as const, id: uid(), platformId: draft.platformId, text: draft.text,
      createdAt: draft.createdAt, submittedAt: nowISO(), confirmedSubmitted: true,
      canonicalConversationKey: draft.canonicalConversationKey,
    }, ...h].slice(0, settings.maxPromptHistory));
  };
  const deleteHistory = (id: string) => setHistory(h => h.filter(x => x.id !== id));
  const clearHistory = () => setHistory([]);
  const togglePinHistory = (id: string) => setHistory(h => h.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x));

  const upsertTemplate: Store['upsertTemplate'] = (t) => setTemplates(prev => {
    const now = nowISO();
    if (t.id && prev.some(p => p.id === t.id)) return prev.map(p => p.id === t.id ? { ...p, ...t, updatedAt: now } as PromptTemplate : p);
    return [{ schemaVersion: 1, id: uid(), title: t.title, body: t.body, category: t.category ?? null, createdAt: now, updatedAt: now }, ...prev];
  });
  const deleteTemplate = (id: string) => setTemplates(p => p.filter(t => t.id !== id));

  const exportBackup = () => JSON.stringify({ schemaVersion: 1, app: 'A.max', exportedAt: nowISO(), categories: { settings, snapshots, collections, drafts, history, templates } }, null, 2);
  const importBackup: Store['importBackup'] = (json, mode) => {
    try {
      const data = JSON.parse(json);
      if (!data || data.schemaVersion !== 1 || !data.categories) return { ok: false, report: 'invalid_schema' };
      const c = data.categories; const arr = (x: unknown) => Array.isArray(x) ? x : [];
      const merge = <T extends { id: string }>(cur: T[], inc: T[]) => mode === 'replace' ? inc : [...inc.filter(i => !cur.some(k => k.id === i.id)), ...cur];
      const s2 = merge(snapshots, arr(c.snapshots)), d2 = merge(drafts, arr(c.drafts)), h2 = merge(history, arr(c.history)), t2 = merge(templates, arr(c.templates));
      setSnapshots(uniqueSnapshots(s2)); setDrafts(d2); setHistory(h2); setTemplates(t2);
      if (arr(c.collections).length) setCollections(mode === 'replace' ? arr(c.collections) : [...collections, ...arr(c.collections).filter((x: ConversationCollection) => !collections.some(k => k.id === x.id))]);
      if (c.settings && mode === 'replace') setSettings({ ...DEFAULT_SETTINGS, ...c.settings });
      return { ok: true, report: `${arr(c.snapshots).length}/${arr(c.drafts).length}/${arr(c.history).length}/${arr(c.templates).length}` };
    } catch { return { ok: false, report: 'parse_error' }; }
  };
  const clearAll = () => {
    setSnapshots([]); setCollections([emptyCollection()]); setDrafts([]); setHistory([]); setTemplates([]); setCurrent(null);
    setSettingsState(DEFAULT_SETTINGS);
    const emptySettings = DEFAULT_SETTINGS;
    void persist({
      [NS + 'settings']: emptySettings,
      [NS + 'snapshots']: [],
      [NS + 'collections']: [],
      [NS + 'drafts']: [],
      [NS + 'history']: [],
      [NS + 'templates']: [],
      [LEGACY_KEYS.LIVE_DRAFTS]: {},
      [LEGACY_KEYS.HISTORY]: [],
      [LEGACY_KEYS.TEMPLATES]: [],
      [LEGACY_KEYS.CACHE]: [],
      [LEGACY_KEYS.AGGREGATION]: [],
    });
  };

  const value = useMemo<Store>(() => ({
    settings, setSettings, settingsSave, resetExportDefaults, lang: settings.uiLanguage, theme,
    snapshots, saveSnapshot, deleteSnapshots, togglePin, current, setCurrent,
    collections, activeCollection, addToCollection, removeFromCollection, moveInCollection, clearCollection, renameCollection,
    drafts, upsertDraft, deleteDraft, markSubmitted, draftSave, lastDraftSavedAt,
    history, deleteHistory, clearHistory, togglePinHistory, templates, upsertTemplate, deleteTemplate,
    toasts, toast, dismissToast, importBackup, exportBackup, clearAll, storageBytes, migratedFromLegacy,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settings, settingsSave, theme, snapshots, current, collections, drafts, draftSave, lastDraftSavedAt, history, templates, toasts, storageBytes, migratedFromLegacy]);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center bg-bg text-muted">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>{settings.uiLanguage === 'fa' ? 'در حال آماده‌سازی A.max…' : 'Preparing A.max…'}</span>
        </div>
      </div>
    );
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
