/*!
 * A.max — Draft Scope Resolver (per-conversation, per-tab prompt isolation)
 * Created by Arash Makki | Released under the MIT License
 *
 * A prompt draft must belong to exactly one conversation, never to "whatever
 * tab wrote last". Conversation pages get a stable `conv:<id>` key; every
 * other page (new chat, search page, composer-only view) gets a per-tab
 * `tab:<id>` key kept in sessionStorage, which survives reloads and SPA
 * navigation inside the same tab but is never shared with another tab.
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});
  const TAB_SCOPE_KEY = 'am_tab_scope_v1';

  // `www.` is stripped from hostnames before matching the domain list.
  const CONVERSATION_RULES = [
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
    { domains: ['yuanbao.tencent.com'], path: /^\/chat\/([A-Za-z0-9][A-Za-z0-9_-]*)/ }
  ];

  let fallbackTabId = '';

  function hostMatches(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  }

  function parse(url) {
    try {
      return new URL(String(url || ''), (global.location && global.location.href) || 'https://example.invalid/');
    } catch (e) {
      return null;
    }
  }

  function idFromPath(pathname) {
    const path = String(pathname || '');
    for (const rule of CONVERSATION_RULES) {
      const match = path.match(rule.path);
      if (match && match[1]) return match[1].slice(0, 128);
    }
    return null;
  }

  /** Conversation id for a full URL, or null for "new chat"/non-chat pages. */
  function conversationId(url) {
    const parsed = parse(url);
    if (!parsed) return null;
    const host = String(parsed.hostname || '').replace(/^www\./, '').toLowerCase();
    for (const rule of CONVERSATION_RULES) {
      if (!rule.domains.some((domain) => hostMatches(host, domain))) continue;
      const match = parsed.pathname.match(rule.path);
      if (match && match[1]) return match[1].slice(0, 128);
    }
    return null;
  }

  /**
   * Per-tab id. sessionStorage is partitioned per tab by the browser, so two
   * ChatGPT tabs on the same "new chat" URL never receive the same id. Chrome
   * also restores sessionStorage after a crash or tab restore, so the draft is
   * still recoverable in the tab that wrote it.
   */
  function tabId() {
    try {
      const storage = global.sessionStorage;
      if (storage) {
        const existing = storage.getItem(TAB_SCOPE_KEY);
        if (existing && /^[A-Za-z0-9_-]{4,64}$/.test(existing)) return existing;
        const next = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        storage.setItem(TAB_SCOPE_KEY, next);
        return next;
      }
    } catch (e) {
      /* private mode / blocked storage: use the in-memory id below */
    }
    if (!fallbackTabId) {
      fallbackTabId = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    return fallbackTabId;
  }

  function scopeFor(url, tabIdOverride) {
    const id = conversationId(url);
    if (id) return 'conv:' + id;
    return 'tab:' + (String(tabIdOverride || '') || tabId());
  }

  function isConversationScope(scope) {
    return /^conv:/.test(String(scope || ''));
  }

  AMTool.draftScope = {
    TAB_SCOPE_KEY,
    CONVERSATION_RULES,
    conversationId,
    idFromPath,
    tabId,
    scopeFor,
    isConversationScope
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
