/**
 * Bridges the 1.0/1.1 storage schema used by the in-page adapter with the
 * v2 schema used by the React surfaces.
 *
 * Rules:
 *  - nothing the user saved is dropped; both stores are unioned,
 *  - every importer tolerates corrupt records individually,
 *  - ids are stable so repeated runs cannot create duplicates,
 *  - legacy settings are only applied when v2 has never stored its own.
 */
import { platformName } from './platforms';
import { toSnapshot, toIsoOrNull, cleanConversationTitle } from './snapshot';
import {
  DEFAULT_SETTINGS, nowISO,
  type ConversationCollection, type DocTheme, type PlatformId, type PromptDraft,
  type PromptHistoryItem, type PromptTemplate, type Settings, type ConversationSnapshot,
} from './types';

export const LEGACY_KEYS = {
  SETTINGS: 'am_tool_settings_v1',
  LIVE_DRAFTS: 'am_tool_live_drafts_v1',
  HISTORY: 'am_tool_prompt_history_v1',
  TEMPLATES: 'am_tool_prompt_templates_v1',
  AGGREGATION: 'am_tool_sidepanel_aggregation_v1',
  CACHE: 'am_tool_chat_cache_v1',
} as const;

const PLATFORM_IDS = new Set<string>([
  'chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity', 'qwen', 'kimi',
  'copilot', 'm365copilot', 'githubcopilot', 'poe', 'googleaistudio', 'notebooklm',
  'xgrok', 'mistral', 'huggingchat', 'doubao', 'yuanbao', 'googlesearch', 'import',
]);

const safePlatform = (value: unknown): PlatformId => {
  const id = String(value || '').trim().toLowerCase();
  return (PLATFORM_IDS.has(id) ? id : 'import') as PlatformId;
};
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

const ENGINE_TO_UI_THEME: Record<string, DocTheme> = {
  light: 'light', dark: 'dark', note: 'note', old_paper: 'oldpaper', oldpaper: 'oldpaper',
  sakura: 'sakura', blue_mist: 'bluemist', bluemist: 'bluemist', fresh_green: 'freshgreen',
  freshgreen: 'freshgreen', lavender: 'lavender',
};

/* ------------------------------- settings ------------------------------- */

/** Maps the flat 1.x settings record onto the v2 settings model. */
export function legacySettingsToSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const legacy = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  if (!legacy) return base;
  const o = base.defaultExportOptions;
  const theme = ENGINE_TO_UI_THEME[str(legacy.exportTheme)] || o.theme;
  const fontSize = str(legacy.exportFontSize);
  const tableStyle = str(legacy.exportTableStyle);
  const paper = str(legacy.pdfFormat);
  const orientation = str(legacy.pdfOrientation);
  const format = str(legacy.defaultExportFormat);
  const knownFormats = ['pdf', 'docx', 'md', 'txt', 'png', 'json', 'html', 'csv'];
  return {
    ...base,
    uiLanguage: str(legacy.language) === 'en' ? 'en' : 'fa',
    uiTheme: ['dark', 'light', 'system'].includes(str(legacy.uiTheme)) ? str(legacy.uiTheme) as Settings['uiTheme'] : base.uiTheme,
    dockEnabled: bool(legacy.showFloatingDock, base.dockEnabled),
    singleMessageMenuEnabled: bool(legacy.showSingleExportBtn, base.singleMessageMenuEnabled),
    cacheTTLDays: num(legacy.cacheRetentionDays, base.cacheTTLDays),
    // `autoSavePrompts` was the explicit opt-in of the previous release; keep it
    // enabled only when the user had already switched it on.
    promptGuardEnabled: bool(legacy.autoSavePrompts, base.promptGuardEnabled),
    promptGuardConsentVersion: bool(legacy.autoSavePrompts, false) ? (base.promptGuardConsentVersion ?? 1) : base.promptGuardConsentVersion,
    recoveryBannerEnabled: bool(legacy.autoShowRecoveryBanner, base.recoveryBannerEnabled),
    autoRestoreEnabled: bool(legacy.autoFillEmptyInputOnCrashRecovery, base.autoRestoreEnabled),
    maxPromptHistory: num(legacy.maxPromptHistoryItems, base.maxPromptHistory),
    autoBidi: bool(legacy.autoFixPersianBiDi, base.autoBidi),
    autoInputDirection: bool(legacy.autoFixInputDirection, base.autoInputDirection),
    persianFontEnabled: bool(legacy.applyPersianFontOnPage, base.persianFontEnabled),
    defaultExportOptions: {
      ...o,
      theme,
      fontSize: ['small', 'medium', 'large'].includes(fontSize) ? fontSize as typeof o.fontSize : o.fontSize,
      tableStyle: tableStyle === 'none' ? 'borderless' : (['solid', 'dashed', 'borderless'].includes(tableStyle) ? tableStyle as typeof o.tableStyle : o.tableStyle),
      includeThinking: bool(legacy.includeThinkingContent, o.includeThinking),
      includeTimestamps: bool(legacy.showMessageTimestamp, o.includeTimestamps),
      includeSource: bool(legacy.includeSourceUrl, o.includeSource),
      brandingEnabled: bool(legacy.appendBranding, o.brandingEnabled),
      brandingText: str(legacy.customBrandingText) || o.brandingText,
      paperSize: ['A4', 'A3', 'A5', 'Letter', 'Legal'].includes(paper) ? paper as typeof o.paperSize : o.paperSize,
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      pageNumbers: bool(legacy.pdfShowPageNumbers, o.pageNumbers),
      format: knownFormats.includes(format) ? format as typeof o.format : o.format,
    },
  };
}

/* -------------------------------- drafts -------------------------------- */

export function legacyDraftsToPromptDrafts(raw: unknown): PromptDraft[] {
  const bag = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const out: PromptDraft[] = [];
  for (const [key, value] of Object.entries(bag)) {
    try {
      const item = value && typeof value === 'object' ? value as Record<string, unknown> : null;
      if (!item) continue;
      const text = str(item.content) || str(item.text);
      if (!text.trim()) continue;
      const updatedAt = toIsoOrNull(item.updatedAt as string | number) || nowISO();
      out.push({
        schemaVersion: 1,
        id: str(item.id) || key,
        platformId: safePlatform(item.platformId),
        // New records carry an explicit scope (`conv:<id>` / `tab:<id>`).
        // Records from 1.1 only have the URL, which stays the legacy identity.
        canonicalConversationKey: str(item.conversationKey) || str(item.url) || str(item.sessionKey) || key.split('::')[1] || '',
        url: str(item.url) || null,
        composerKey: str(item.inputKey) || 'main',
        text,
        revision: Math.max(1, num(item.revision, 1)),
        createdAt: toIsoOrNull(item.createdAt as string | number) || updatedAt,
        updatedAt,
        persistedAt: updatedAt,
        state: 'saved',
      });
    } catch {
      /* skip one corrupt draft, keep the rest */
    }
  }
  return out;
}

const draftKey = (d: Pick<PromptDraft, 'platformId' | 'canonicalConversationKey' | 'composerKey'>) =>
  [d.platformId || 'unknown', d.canonicalConversationKey || 'unscoped', d.composerKey || 'main'].join('::');

export function mergeDrafts(a: PromptDraft[], b: PromptDraft[]): PromptDraft[] {
  const byIdentity = new Map<string, PromptDraft>();
  for (const draft of [...a, ...b]) {
    if (!draft || !draft.id || draft.state === 'submitted' || draft.state === 'discarded') continue;
    const identity = draftKey(draft);
    const current = byIdentity.get(identity);
    if (!current) { byIdentity.set(identity, draft); continue; }
    const pickNewer = String(draft.updatedAt || '') >= String(current.updatedAt || '') ? draft : current;
    byIdentity.set(identity, { ...pickNewer, id: current.id });
  }
  return [...byIdentity.values()].sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
}

/** Serialises drafts into the shape the content script still expects. */
export function draftsToLegacy(drafts: PromptDraft[]): Record<string, unknown> {
  const bag: Record<string, unknown> = {};
  for (const draft of drafts) {
    if (!draft || draft.state === 'submitted' || draft.state === 'discarded') continue;
    const key = draft.canonicalConversationKey || '';
    const scoped = /^(conv|tab):/.test(key);
    bag[draftKey(draft)] = {
      id: draft.id,
      platformId: draft.platformId,
      platformName: platformName(draft.platformId),
      url: draft.url || (scoped ? '' : key),
      conversationKey: scoped ? key : '',
      title: '',
      inputKey: draft.composerKey || 'main',
      content: draft.text,
      updatedAt: Date.parse(draft.updatedAt) || Date.now(),
      type: 'draft',
    };
  }
  return bag;
}

/* -------------------------------- history ------------------------------- */

export function legacyHistoryToItems(raw: unknown): PromptHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptHistoryItem[] = [];
  for (const value of raw) {
    try {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const text = str(item.content) || str(item.text);
      if (!text.trim()) continue;
      const updatedAt = toIsoOrNull(item.updatedAt as string | number) || toIsoOrNull(item.createdAt as string | number) || nowISO();
      out.push({
        schemaVersion: 1,
        id: str(item.id) || `hist_${updatedAt}`,
        platformId: safePlatform(item.platformId),
        text,
        createdAt: toIsoOrNull(item.createdAt as string | number) || updatedAt,
        submittedAt: item.type === 'sent' ? updatedAt : null,
        confirmedSubmitted: item.type === 'sent',
        canonicalConversationKey: str(item.url) || null,
      });
    } catch {
      /* skip one corrupt record */
    }
  }
  return out;
}

export function mergeHistory(a: PromptHistoryItem[], b: PromptHistoryItem[]): PromptHistoryItem[] {
  const byId = new Map<string, PromptHistoryItem>();
  for (const item of [...a, ...b]) {
    if (!item || !item.id || !String(item.text || '').trim()) continue;
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((x, y) => String(y.submittedAt || y.createdAt).localeCompare(String(x.submittedAt || x.createdAt)));
}

export function historyToLegacy(history: PromptHistoryItem[]): unknown[] {
  return history.map(item => ({
    id: item.id,
    platformId: item.platformId,
    platformName: platformName(item.platformId),
    url: item.canonicalConversationKey || '',
    title: '',
    content: item.text,
    updatedAt: Date.parse(item.submittedAt || item.createdAt) || Date.now(),
    type: item.submittedAt ? 'sent' : 'draft',
  }));
}

/* ------------------------------- templates ------------------------------ */

export function legacyTemplatesToTemplates(raw: unknown): PromptTemplate[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptTemplate[] = [];
  for (const value of raw) {
    try {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const body = str(item.content) || str(item.body);
      const title = str(item.title).trim();
      if (!body.trim() || !title) continue;
      const createdAt = toIsoOrNull(item.createdAt as string | number) || toIsoOrNull(item.updatedAt as string | number) || nowISO();
      out.push({
        schemaVersion: 1,
        id: str(item.id) || `tpl_${createdAt}`,
        title,
        category: str(item.category) || null,
        body,
        createdAt,
        updatedAt: toIsoOrNull(item.updatedAt as string | number) || createdAt,
      });
    } catch {
      /* skip one corrupt template */
    }
  }
  return out;
}

export function mergeTemplates(a: PromptTemplate[], b: PromptTemplate[]): PromptTemplate[] {
  const byId = new Map<string, PromptTemplate>();
  for (const item of [...a, ...b]) {
    if (!item || !item.id || !String(item.body || '').trim()) continue;
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

export function templatesToLegacy(templates: PromptTemplate[]): unknown[] {
  return templates.map(item => ({
    id: item.id,
    title: item.title,
    content: item.body,
    category: item.category || '',
    createdAt: Date.parse(item.createdAt) || Date.now(),
  }));
}

/* ----------------------------- conversations ---------------------------- */

function snapshotFromLegacyEntry(entry: Record<string, unknown>, prefix: string, lang: 'fa' | 'en'): ConversationSnapshot | null {
  const messages = Array.isArray(entry.messages) ? entry.messages : [];
  if (!messages.length) return null;
  const url = str(entry.url);
  const rawChat = {
    platformId: str(entry.platformId),
    platformName: str(entry.platformName),
    title: str(entry.title),
    url,
    capturedAt: toIsoOrNull(entry.updatedAt as string | number) || toIsoOrNull(entry.addedAt as string | number) || nowISO(),
    messages: messages.map((message, index) => {
      const item = message && typeof message === 'object' ? message as Record<string, unknown> : {};
      return {
        id: str(item.id) || `msg_${index + 1}`,
        role: str(item.role),
        content: str(item.content),
        markdown: str(item.markdown) || str(item.content),
        thinking: str(item.thinking),
        sentAt: (item.sentAt as string | number | null) ?? (item.timestamp as string | number | null) ?? (item.createdAt as string | number | null) ?? null,
        timestamp: null,
      };
    }),
  };
  const snapshot = toSnapshot(rawChat, url, lang);
  if (!snapshot) return null;
  const id = str(entry.id) || `${prefix}_${snapshot.id}`;
  const explicit = cleanConversationTitle(str(entry.title), str(entry.platformName));
  return {
    ...snapshot,
    id: `${prefix}:${id}`,
    title: explicit || snapshot.title,
    titleSource: explicit ? 'conversation' : snapshot.titleSource,
  };
}

/**
 * Turns the old chat cache + side-panel aggregation into snapshots plus one
 * collection, keeping the order the user chose in the side panel.
 */
export function legacyChatsToSnapshots(
  cacheRaw: unknown,
  aggregationRaw: unknown,
  lang: 'fa' | 'en',
): { snapshots: ConversationSnapshot[]; items: ConversationCollection['items'] } {
  const snapshots: ConversationSnapshot[] = [];
  const seen = new Set<string>();
  const push = (list: unknown, prefix: string) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      try {
        if (!entry || typeof entry !== 'object') continue;
        const record = entry as Record<string, unknown>;
        const fingerprint = [str(record.platformId), str(record.url), str(record.title)].join('|');
        if (seen.has(fingerprint)) continue;
        const snapshot = snapshotFromLegacyEntry(record, prefix, lang);
        if (!snapshot) continue;
        seen.add(fingerprint);
        snapshots.push(snapshot);
      } catch {
        /* skip one corrupt conversation */
      }
    }
  };
  // Aggregation is what the user explicitly collected; cache is only history.
  push(aggregationRaw, 'agg');
  push(cacheRaw, 'cache');
  return { snapshots, items: snapshots.map((snapshot, order) => ({ snapshotId: snapshot.id, order })) };
}
