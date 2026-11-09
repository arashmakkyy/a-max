import { detectPlatform } from './platforms';
import { APP_NAME, APP_VERSION } from './version';
import {
  uid, type CapturedMessage, type ContentBlock, type ConversationSnapshot,
  type MessageRole, type PlatformId,
} from './types';

export interface RawMessage {
  id?: string;
  role?: string;
  content?: string;
  markdown?: string;
  thinking?: string;
  sentAt?: string | number | null;
  timestamp?: string | number | null;
  model?: string;
}

export interface RawChat {
  platformId?: string;
  platformName?: string;
  title?: string;
  url?: string;
  model?: string;
  messages?: RawMessage[];
  extractionStatus?: string;
  capturedAt?: string;
  titleSource?: 'conversation' | 'generated';
}

const ROLE_MAP: Record<string, MessageRole> = {
  user: 'user', human: 'user', me: 'user',
  assistant: 'assistant', ai: 'assistant', model: 'assistant', bot: 'assistant',
  system: 'system', tool: 'tool', function: 'tool',
  unknown: 'unknown', '': 'unknown',
};

/** Only explicit role evidence is accepted; nothing is guessed from order. */
export function normalizeRole(role?: string | null): MessageRole {
  const key = String(role ?? '').trim().toLowerCase();
  return ROLE_MAP[key] ?? 'unknown';
}

/** Splits captured markdown into paragraph/code/thinking blocks the UI understands. */
export function blocksFromMarkdown(markdown: string, thinking?: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const think = String(thinking || '').trim();
  if (think) blocks.push({ id: uid(), type: 'thinking', text: think });

  const text = String(markdown || '').replace(/\r\n/g, '\n');
  const fence = /```([\w+#.-]*)\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text))) {
    const before = text.slice(last, match.index).trim();
    if (before) blocks.push({ id: uid(), type: 'paragraph', text: before });
    blocks.push({ id: uid(), type: 'code', text: match[2].replace(/\n$/, ''), language: match[1] || null });
    last = match.index + match[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) blocks.push({ id: uid(), type: 'paragraph', text: tail });
  if (!blocks.length) blocks.push({ id: uid(), type: 'paragraph', text: '' });
  return blocks;
}

export function conversationIdFromUrl(url: string): string | null {
  const match = String(url || '').match(/\/(?:c|chat|conversation|app|search|notebook|prompts)\/([\w-]{6,})/i);
  return match ? match[1] : null;
}

/**
 * Timestamps are only surfaced when the source really provided one. A numeric
 * value is treated as a Unix millisecond timestamp; anything else that cannot
 * be parsed becomes `null` — the capture time is never substituted.
 */
export function toIsoOrNull(value?: string | number | null): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{10,13}$/.test(raw)) {
    const numeric = Number(raw);
    const ms = raw.length === 10 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const PLATFORM_TITLE_WORDS = [
  'ChatGPT', 'Chat', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Perplexity', 'Qwen',
  'Kimi', 'Poe', 'Copilot', 'Mistral', 'HuggingChat', 'Doubao', 'Yuanbao',
  'NotebookLM', 'Google AI Studio', 'Microsoft Copilot', 'GitHub Copilot',
];

const SUFFIX_RE = new RegExp(`^(.*?)\\s*[-–—|•·]\\s*(?:${PLATFORM_TITLE_WORDS.join('|')})\\s*$`, 'i');
const PREFIX_RE = new RegExp(`^(?:${PLATFORM_TITLE_WORDS.join('|')})\\s*[-–—|•·]\\s*(.*)$`, 'i');
const GENERIC_TITLES = new Set([
  '', 'chat', 'new chat', 'new conversation', 'untitled', 'untitled chat',
  'گفتگوی جدید', 'گفتگو', 'گفتگوی هوش مصنوعی', 'چت جدید', 'بدون عنوان',
]);

/** Removes the platform suffix/prefix and rejects placeholder titles. */
export function cleanConversationTitle(raw: string, platformName = ''): string {
  let title = String(raw || '').replace(/\s+/g, ' ').trim();
  for (let pass = 0; pass < 3; pass += 1) {
    const suffix = title.match(SUFFIX_RE);
    if (suffix && suffix[1].trim()) { title = suffix[1].trim(); continue; }
    const prefix = title.match(PREFIX_RE);
    if (prefix && prefix[1].trim()) { title = prefix[1].trim(); continue; }
    break;
  }
  title = title.replace(/^["“”'«»]+|["“”'«»]+$/g, '').trim();
  if (title.length > 120) title = `${title.slice(0, 117).trimEnd()}…`;
  const lower = title.toLowerCase();
  if (GENERIC_TITLES.has(lower)) return '';
  if (platformName && lower === platformName.toLowerCase()) return '';
  return title;
}

function fallbackTitle(messages: CapturedMessage[], lang: 'fa' | 'en'): string {
  const firstUser = messages.find(message => message.role === 'user' && message.plainText.trim());
  const seed = (firstUser?.plainText || messages.find(message => message.plainText.trim())?.plainText || '')
    .replace(/\s+/g, ' ').trim();
  if (seed) return seed.length > 60 ? `${seed.slice(0, 57).trimEnd()}…` : seed;
  return lang === 'fa' ? 'گفتگوی هوش مصنوعی' : 'AI conversation';
}

/** Converts the in-page adapter payload into the PRD conversation model. */
export function toSnapshot(chat: RawChat, pageUrl: string, lang: 'fa' | 'en' = 'fa'): ConversationSnapshot | null {
  if (!chat) return null;
  const det = detectPlatform(pageUrl || chat.url || '');
  const platformId = (chat.platformId as PlatformId) || det.platform?.id || 'import';
  const messages: CapturedMessage[] = (chat.messages || []).map((message, index) => {
    const markdown = String(message.markdown || message.content || '');
    return {
      id: message.id || `msg_${index + 1}`,
      index,
      role: normalizeRole(message.role),
      sentAt: toIsoOrNull(message.sentAt ?? message.timestamp),
      blocks: blocksFromMarkdown(markdown, message.thinking),
      plainText: String(message.content || markdown),
      captureWarnings: [],
    };
  });

  if (!messages.length) return null;

  const unknownRoles = messages.some(message => message.role === 'unknown');
  const rawStatus = String(chat.extractionStatus || 'complete');
  const captureStatus = rawStatus === 'unsupported' ? 'failed' : unknownRoles || rawStatus === 'partial' ? 'partial' : 'complete';
  const partialReason = unknownRoles ? 'role_markers_missing' : 'partial_capture';
  // A title the page itself marked as generated must not be treated as the
  // real conversation title, otherwise the "auto title" badge would be lost.
  const rawTitle = chat.titleSource === 'generated' ? '' : (chat.title || '');
  const explicit = cleanConversationTitle(rawTitle, det.platform?.name || chat.platformName || '');
  const title = explicit || fallbackTitle(messages, lang);

  return {
    schemaVersion: 1,
    id: uid(),
    platformId,
    externalConversationId: conversationIdFromUrl(pageUrl),
    canonicalURL: pageUrl || chat.url || null,
    title,
    titleSource: explicit ? 'conversation' : 'generated',
    capturedAt: toIsoOrNull(chat.capturedAt) || new Date().toISOString(),
    captureStatus,
    completenessReason: captureStatus === 'partial' ? partialReason : null,
    messages,
    warnings: captureStatus === 'partial' ? [partialReason] : [],
    adapterVersion: `${APP_NAME} ${APP_VERSION}`,
  };
}
