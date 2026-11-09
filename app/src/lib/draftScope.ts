/**
 * Draft scoping shared by the UI surfaces.
 *
 * The in-page adapter (`src/shared/draft-scope.js`) is the single source of
 * truth for live drafts. This module mirrors its rules so the popup can
 * compare a stored draft against the active tab's scope — and still recognise
 * drafts written by 1.1, whose identity was the raw URL.
 *
 * Keep `RULES` in sync with `CONVERSATION_RULES` in draft-scope.js; the test
 * harness compares both copies against the same URL corpus.
 */
import type { PromptDraft } from './types';

interface ScopeRule {
  domains: string[];
  path: RegExp;
}

const RULES: ScopeRule[] = [
  { domains: ['chatgpt.com', 'chat.openai.com'], path: /(?:^|\/)c\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['claude.ai'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['gemini.google.com'], path: /^(?:\/u\/\d+)?\/app\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['grok.com'], path: /^\/(?:chat|c)\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['chat.deepseek.com'], path: /^\/a\/chat\/s\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['perplexity.ai'], path: /^\/search\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['chat.qwen.ai', 'qianwen.com', 'tongyi.aliyun.com'], path: /^\/c\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['kimi.com', 'kimi.ai', 'kimi.moonshot.cn'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['copilot.microsoft.com', 'copilot.com'], path: /^\/chats\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['m365.cloud.microsoft'], path: /^\/(?:chat|chats)\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['github.com'], path: /^\/copilot\/c\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['poe.com'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['aistudio.google.com'], path: /^\/(?:app\/)?prompts?\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['notebooklm.google.com', 'notebook.google.com'], path: /^\/notebook\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['x.com'], path: /^\/i\/grok\/(?:chat|c)\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['chat.mistral.ai'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['huggingface.co'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['doubao.com'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
  { domains: ['yuanbao.tencent.com'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ },
];

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function conversationIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  for (const rule of RULES) {
    if (!rule.domains.some(domain => hostMatches(host, domain))) continue;
    const match = parsed.pathname.match(rule.path);
    if (match && match[1]) return match[1].slice(0, 128);
  }
  return null;
}

export function conversationIdFromPath(pathname: string): string | null {
  const path = String(pathname || '');
  for (const rule of RULES) {
    const match = path.match(rule.path);
    if (match && match[1]) return match[1].slice(0, 128);
  }
  return null;
}

export const scopeFromUrl = (url: string, tabId = 'unknown'): string => {
  const id = conversationIdFromUrl(url);
  return id ? `conv:${id}` : `tab:${tabId}`;
};

export interface DraftScopeContext {
  ok?: boolean;
  platformId?: string | null;
  scope: string;
  conversationKey?: string | null;
  url?: string | null;
  title?: string | null;
  hasDraft?: boolean;
}

/** A draft belongs to the active tab only when its stored scope matches. */
export function draftMatchesScope(
  draft: Pick<PromptDraft, 'platformId' | 'canonicalConversationKey' | 'url'>,
  ctx: DraftScopeContext,
): boolean {
  if (!draft || !ctx || !ctx.scope) return false;
  if (ctx.platformId && draft.platformId && draft.platformId !== ctx.platformId) return false;
  const key = String(draft.canonicalConversationKey || '').trim();
  if (!key) return false;
  if (key === ctx.scope) return true;
  // Another conversation or another tab: keep it out of this tab's card.
  if (/^(conv|tab):/.test(key)) return false;
  // 1.1 identity was the URL (or pathname). Only a conversation scope can
  // match it; never treat a legacy URL as a per-tab "new chat" draft.
  if (!ctx.scope.startsWith('conv:')) return false;
  const id = /^https?:\/\//i.test(key)
    ? conversationIdFromUrl(key)
    : key.startsWith('/') ? conversationIdFromPath(key) : null;
  return Boolean(id) && ctx.scope === `conv:${id}`;
}

/** Short id shown next to a vault draft so conversations are distinguishable. */
export function draftConversationLabel(draft: Pick<PromptDraft, 'canonicalConversationKey' | 'url'>): string | null {
  const key = String(draft.canonicalConversationKey || '');
  const scoped = /^conv:(.+)$/.exec(key);
  const id = scoped
    ? scoped[1]
    : draft.url
      ? conversationIdFromUrl(draft.url)
      : (/\/c\/([^/?#]+)/.exec(key) || [])[1] || null;
  if (!id) return null;
  return id.length > 10 ? id.slice(-8) : id;
}
