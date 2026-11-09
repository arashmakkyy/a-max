export type PlatformId =
  | 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'deepseek'
  | 'perplexity' | 'qwen' | 'kimi' | 'copilot' | 'm365copilot'
  | 'githubcopilot' | 'poe' | 'googleaistudio' | 'notebooklm'
  | 'xgrok' | 'mistral' | 'huggingchat' | 'doubao' | 'yuanbao'
  | 'googlesearch' | 'import';

export type CaptureStatus = 'complete' | 'partial' | 'unknown' | 'failed';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';
export type BlockType = 'paragraph' | 'code' | 'thinking';

export interface ContentBlock {
  id: string;
  type: BlockType;
  text: string;
  language?: string | null;
}

export interface CapturedMessage {
  id: string;
  index: number;
  role: MessageRole;
  sentAt: string | null;
  blocks: ContentBlock[];
  plainText: string;
  captureWarnings: string[];
}

export interface ConversationSnapshot {
  schemaVersion: 1;
  id: string;
  platformId: PlatformId;
  externalConversationId: string | null;
  canonicalURL: string | null;
  title: string;
  /** `generated` means the real conversation title was unavailable and a fallback was used. */
  titleSource?: 'conversation' | 'generated';
  capturedAt: string;
  captureStatus: CaptureStatus;
  completenessReason?: string | null;
  messages: CapturedMessage[];
  warnings: string[];
  adapterVersion: string;
  pinned?: boolean;
  demo?: boolean;
}

export interface CollectionItem { snapshotId: string; order: number; selectedMessageIds?: string[]; }
export interface ConversationCollection {
  schemaVersion: 1; id: string; title: string; createdAt: string; updatedAt: string; items: CollectionItem[];
}

export interface PromptDraft {
  schemaVersion: 1; id: string; platformId: PlatformId; canonicalConversationKey: string; composerKey: string;
  /** Real page URL when known; the scope key is kept in canonicalConversationKey. */
  url?: string | null;
  text: string; revision: number; createdAt: string; updatedAt: string; persistedAt: string | null;
  state: 'draft' | 'saved' | 'submitted' | 'discarded';
}
export interface PromptHistoryItem {
  schemaVersion: 1; id: string; platformId: PlatformId; text: string; createdAt: string;
  submittedAt: string | null; confirmedSubmitted: boolean; canonicalConversationKey: string | null; pinned?: boolean;
}
export interface PromptTemplate {
  schemaVersion: 1; id: string; title: string; category: string | null; body: string; createdAt: string; updatedAt: string;
}

export type ExportFormat = 'pdf' | 'docx' | 'md' | 'txt' | 'png' | 'json' | 'html' | 'csv';
export type DocTheme = 'light' | 'dark' | 'note' | 'oldpaper' | 'sakura' | 'bluemist' | 'freshgreen' | 'lavender';
export type FileNamePattern = 'ai_title_date' | 'title_date' | 'ai_title' | 'date_title';

export interface ExportOptions {
  format: ExportFormat;
  theme: DocTheme;
  fontSize: 'small' | 'medium' | 'large';
  tableStyle: 'solid' | 'dashed' | 'borderless';
  includeRoles: boolean;
  includeSource: boolean;
  includeTimestamps: boolean;
  includeThinking: boolean;
  brandingEnabled: boolean;
  brandingText: string;
  paperSize: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: 'small' | 'medium' | 'large';
  pageNumbers: boolean;
  pngMode: 'single' | 'split';
  fileNamePattern: FileNamePattern;
  includeTitle: boolean;
  separators: boolean;
}

export interface Settings {
  uiLanguage: 'fa' | 'en';
  uiTheme: 'dark' | 'light' | 'system';
  dockEnabled: boolean;
  singleMessageMenuEnabled: boolean;
  autoCacheEnabled: boolean;
  cacheTTLDays: number;
  promptGuardEnabled: boolean;
  promptGuardConsentVersion: number | null;
  recoveryBannerEnabled: boolean;
  autoRestoreEnabled: boolean;
  maxPromptHistory: number;
  draftTTLDays: number;
  autoBidi: boolean;
  autoInputDirection: boolean;
  persianFontEnabled: boolean;
  defaultExportOptions: ExportOptions;
  platformOverrides: Partial<Record<PlatformId, { enabled: boolean }>>;
  lastPopupTab: 'export' | 'guard' | 'persian' | 'sites';
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'md', theme: 'light', fontSize: 'medium', tableStyle: 'solid',
  includeRoles: true, includeSource: true, includeTimestamps: true, includeThinking: false,
  brandingEnabled: false, brandingText: '', paperSize: 'A4', orientation: 'portrait', margins: 'medium',
  pageNumbers: true, pngMode: 'split', fileNamePattern: 'ai_title_date', includeTitle: true, separators: true,
};

export const DEFAULT_SETTINGS: Settings = {
  uiLanguage: 'fa', uiTheme: 'dark', dockEnabled: true, singleMessageMenuEnabled: true,
  autoCacheEnabled: false, cacheTTLDays: 30, promptGuardEnabled: false, promptGuardConsentVersion: null,
  recoveryBannerEnabled: true, autoRestoreEnabled: false, maxPromptHistory: 300, draftTTLDays: 30,
  autoBidi: true, autoInputDirection: true, persianFontEnabled: true,
  defaultExportOptions: DEFAULT_EXPORT_OPTIONS, platformOverrides: {}, lastPopupTab: 'export',
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export const nowISO = () => new Date().toISOString();
