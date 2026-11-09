/*!
 * A.max — Content Script (Zero-Click Prompt Auto-Save, Persian BiDi Engine & Multi-Platform Chat Exporter)
 * Created by Arash Makki | Released under the MIT License
 */
(function () {
  'use strict';

  const AMTool = window.AMTool || {};
  if (window.__AM_TOOL_CONTENT_INITIALIZED__) return;
  window.__AM_TOOL_CONTENT_INITIALIZED__ = true;

  let currentPlatform = AMTool.detectPlatform(window.location.href);
  if (!currentPlatform) return; // Do not activate on ordinary GitHub/X/Google pages.
  let currentSettings = Object.assign({}, AMTool.storage.DEFAULT_SETTINGS);
  let lastSavedDraftText = '';
  let asyncSaveTimer = null;
  let currentDraftScope = '';
  let lastKnownHref = window.location.href;
  let recoveryBannerDismissedForScope = '';
  let suppressDraftReSaveUntil = 0;

  function getPlatformInfo() {
    currentPlatform = AMTool.detectPlatform(window.location.href);
    if (currentPlatform) return currentPlatform;
    return {
      id: window.location.hostname.replace(/^www\./, ''),
      name: window.location.hostname.replace(/^www\./, ''),
      nameFa: window.location.hostname.replace(/^www\./, ''),
      inputSelectors: ['textarea', 'div[contenteditable="true"]', '[role="textbox"]'],
      sendButtonSelectors: ['button[type="submit"]'],
      turnSelectors: ['article', '[data-message-author-role]', '.message', '.prose', '.markdown'],
      userSelectors: ['[data-message-author-role="user"]', '.user-message'],
      assistantSelectors: ['[data-message-author-role="assistant"]', '.assistant-message', '.prose', '.markdown'],
      actionToolbarSelectors: []
    };
  }

  function showToast(message) {
    const existing = document.querySelector('.am-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'am-toast';
    toast.setAttribute('data-am-ui', '1');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2800);
  }

  // Locate the active prompt input element on the current AI platform.
  function findPromptInputElement() {
    const platform = getPlatformInfo();
    const selectors = [
      ...(platform.inputSelectors || []),
      '#prompt-textarea',
      'div.ProseMirror[contenteditable="true"]',
      'rich-textarea .ql-editor[contenteditable="true"]',
      'textarea#chat-input',
      'textarea[placeholder]',
      'div[contenteditable="true"][role="textbox"]',
      'main textarea',
      'main div[contenteditable="true"]'
    ];
    for (const sel of selectors) {
      try {
        const candidates = Array.from(document.querySelectorAll(sel));
        for (const el of candidates) {
          if (el.closest('[data-am-ui="1"]')) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 80 && rect.height > 16) {
            return el;
          }
        }
      } catch (e) {}
    }
    return null;
  }

  function readInputElementText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value || '';
    }
    return el.innerText || el.textContent || '';
  }

  // Set text into either a standard <textarea> or rich-text contenteditable (ProseMirror / Quill / Lexical).
  function writeInputElementText(el, text) {
    if (!el) return false;
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    if (el.isContentEditable) {
      // Clear and insert via execCommand first so React/ProseMirror state updates cleanly.
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
        if (!document.execCommand('insertText', false, text)) {
          el.innerHTML = '';
          text.split('\n').forEach((line) => {
            const p = document.createElement('p');
            p.textContent = line || '\u200B';
            el.appendChild(p);
          });
        }
      } catch (e) {
        el.textContent = text;
      }
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      return true;
    }
    return false;
  }

  /**
   * The scope a draft belongs to. `conv:<id>` for a conversation page,
   * `tab:<id>` for a new chat / composer-only page (per tab, never shared).
   */
  function draftScope() {
    if (!currentDraftScope) {
      currentDraftScope = AMTool.draftScope
        ? AMTool.draftScope.scopeFor(window.location.href)
        : (window.location.pathname || 'unscoped');
    }
    return currentDraftScope;
  }

  function readComposerText() {
    const inputEl = findPromptInputElement();
    return inputEl ? readInputElementText(inputEl).trim() : '';
  }

  /** True only when this stored draft was written for the given scope. */
  function draftMatchesScope(draft, scope) {
    if (!draft) return false;
    const key = String(draft.conversationKey || '').trim();
    if (key) return key === scope;
    // 1.1 records only stored the URL (or a pathname). They may match a real
    // conversation, but never a per-tab scope: that URL fallback is exactly
    // what used to leak one tab's prompt into another tab's "new chat".
    if (!AMTool.draftScope || !AMTool.draftScope.isConversationScope(scope)) return false;
    const legacy = String(draft.url || draft.sessionKey || '').trim();
    if (!legacy) return false;
    const absolute = /^https?:/i.test(legacy) ? legacy : window.location.origin + legacy;
    return AMTool.draftScope.scopeFor(absolute, 'legacy') === scope;
  }

  /**
   * Re-keys the draft when the site changes the URL without a reload. A draft
   * whose text is still in the composer follows the navigation; a draft whose
   * composer was cleared stays with the page the user left.
   */
  function syncDraftScope() {
    const href = window.location.href;
    if (href === lastKnownHref && currentDraftScope) return currentDraftScope;
    lastKnownHref = href;
    const next = AMTool.draftScope
      ? AMTool.draftScope.scopeFor(href)
      : (window.location.pathname || 'unscoped');
    if (!currentDraftScope) {
      currentDraftScope = next;
      return next;
    }
    if (next === currentDraftScope) return currentDraftScope;

    const previous = currentDraftScope;
    currentDraftScope = next;
    recoveryBannerDismissedForScope = '';
    // A banner from the conversation we just left must not linger over the
    // new one; recovery is re-evaluated below for the new scope.
    document.querySelectorAll('.am-recovery-banner').forEach((node) => node.remove());
    const platform = getPlatformInfo();
    const text = readComposerText();
    const carried = Boolean(text) && text === String(lastSavedDraftText || '').trim();
    if (carried) {
      AMTool.storage.moveLiveDraft(platform.id, previous, next, 'main', href, document.title).catch(() => {});
    } else {
      lastSavedDraftText = '';
    }
    try {
      chrome.runtime.sendMessage({ type: 'PROMPT_DRAFT_UPDATED', hasDraft: Boolean(text) });
    } catch (e) {}
    updateDockStatus(Boolean(text));
    if (text) persistCurrentInputDraft(text);
    setTimeout(() => {
      checkAndShowCrashRecovery();
    }, 600);
    return next;
  }

  // Zero-click automatic prompt persistence: writes synchronously to localStorage and asynchronously to chrome.storage.local.
  function persistCurrentInputDraft(rawText) {
    if (!currentSettings.autoSavePrompts) return;
    // Do not resurrect a prompt that was just sent while the site clears its
    // composer asynchronously.
    if (Date.now() < suppressDraftReSaveUntil) return;
    const platform = getPlatformInfo();
    const text = (rawText || '').trim();

    if (text === lastSavedDraftText) return;
    lastSavedDraftText = text;
    const scope = draftScope();

    if (asyncSaveTimer) clearTimeout(asyncSaveTimer);
    asyncSaveTimer = setTimeout(() => {
      AMTool.storage.saveLiveDraft({
        platformId: platform.id,
        platformName: platform.name,
        url: window.location.href,
        title: document.title,
        content: rawText,
        conversationKey: scope,
        sessionKey: window.location.pathname,
        inputKey: 'main'
      }).catch(() => showToast(AMTool.i18n.t('toast.draftSaveFailed')));
      try {
        chrome.runtime.sendMessage({
          type: 'PROMPT_DRAFT_UPDATED',
          hasDraft: Boolean(text)
        });
      } catch (e) {}
      updateDockStatus(Boolean(text));
    }, 180);
  }

  // Record submitted prompt into history and clear the unsent draft marker.
  function handlePromptSubmitted(submittedText) {
    const text = (submittedText || lastSavedDraftText || '').trim();
    if (!text || !currentSettings.autoSavePrompts) return;
    const platform = getPlatformInfo();
    const scope = draftScope();
    const scopeNow = AMTool.draftScope
      ? AMTool.draftScope.scopeFor(window.location.href)
      : scope;
    // Adopt the post-send URL immediately; the heartbeat would otherwise keep
    // reporting the pre-send scope for up to 1.5s.
    currentDraftScope = scopeNow;
    lastKnownHref = window.location.href;
    lastSavedDraftText = '';
    document.querySelectorAll('.am-recovery-banner').forEach((node) => node.remove());
    suppressDraftReSaveUntil = Date.now() + 2500;
    // Clear the conversation the user sent from and, if the site already
    // navigated, the conversation it navigated to. `window.location.href` also
    // removes the URL-keyed identity written by 1.1.
    AMTool.storage.clearLiveDraft(platform.id, scope, 'main', window.location.href).catch(() => {});
    if (scopeNow !== scope) {
      AMTool.storage.clearLiveDraft(platform.id, scopeNow, 'main').catch(() => {});
    }
    AMTool.storage.upsertPromptHistory({
      id: 'sent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      platformId: platform.id,
      platformName: platform.name,
      url: window.location.href,
      title: document.title,
      content: text,
      updatedAt: Date.now(),
      type: 'sent'
    });
    try {
      chrome.runtime.sendMessage({ type: 'PROMPT_DRAFT_UPDATED', hasDraft: false });
    } catch (e) {}
  }

  // Check if an unsent prompt survived a power outage or tab crash and offer 1-click restoration.
  async function checkAndShowCrashRecovery() {
    if (!currentSettings.autoSavePrompts || !currentSettings.autoShowRecoveryBanner) return;
    const scope = draftScope();
    if (recoveryBannerDismissedForScope === scope) return;

    const platform = getPlatformInfo();
    const liveDrafts = await AMTool.storage.getLiveDrafts();
    const candidate = Object.values(liveDrafts)
      .filter(d => d.platformId === platform.id && draftMatchesScope(d, scope))
      .sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))[0];

    if (!candidate || !candidate.content || !candidate.content.trim()) return;

    // The vault already holds a draft for this tab's conversation; reflect it
    // on the toolbar badge even before the user types again.
    try {
      chrome.runtime.sendMessage({ type: 'PROMPT_DRAFT_UPDATED', hasDraft: true });
    } catch (e) {}

    const inputEl = findPromptInputElement();
    const currentInputText = readInputElementText(inputEl).trim();
    if (currentInputText && currentInputText === candidate.content.trim()) return;

    if (currentSettings.autoFillEmptyInputOnCrashRecovery && inputEl && !currentInputText) {
      writeInputElementText(inputEl, candidate.content);
      applyInputBoxDirection(inputEl);
      showToast(AMTool.i18n.t('toast.restored'));
      return;
    }

    renderRecoveryBanner(candidate);
  }

  function renderRecoveryBanner(draft) {
    if (document.querySelector('.am-recovery-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'am-recovery-banner';
    banner.setAttribute('data-am-ui', '1');

    const timeStr = new Date(draft.updatedAt || Date.now()).toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    banner.innerHTML = `
      <div class="am-recovery-header">
        <div class="am-recovery-title">
          <span class="am-dock-status-dot"></span>
          <span>${AMTool.i18n.t('promptGuard.recoveryBannerMsg', { time: timeStr })}</span>
        </div>
        <span style="font-size:11px;color:#9BA3AE;">A.max • Arash Makki</span>
      </div>
      <div class="am-recovery-preview"></div>
      <div class="am-recovery-actions">
        <button type="button" class="am-btn-dismiss">${AMTool.i18n.t('promptGuard.recoveryDismiss')}</button>
        <button type="button" class="am-btn-restore">${AMTool.i18n.t('promptGuard.recoveryRestore')}</button>
      </div>
    `;

    banner.querySelector('.am-recovery-preview').textContent = draft.content;

    banner.querySelector('.am-btn-restore').addEventListener('click', () => {
      const inputEl = findPromptInputElement();
      if (inputEl) {
        writeInputElementText(inputEl, draft.content);
        applyInputBoxDirection(inputEl);
        showToast(AMTool.i18n.t('toast.restored'));
      } else {
        AMTool.exporters.copyToClipboard(draft.content);
        showToast(AMTool.i18n.t('toast.copied'));
      }
      banner.remove();
    });

    banner.querySelector('.am-btn-dismiss').addEventListener('click', () => {
      recoveryBannerDismissedForScope = draftScope();
      // Dismiss is non-destructive. The draft remains in the vault for later recovery.
      banner.remove();
    });

    document.body.appendChild(banner);
  }

  // Keep the prompt input box right-aligned when typing Persian, or left-aligned for English.
  function applyInputBoxDirection(inputEl) {
    if (!inputEl || !currentSettings.autoFixInputDirection) return;
    const text = readInputElementText(inputEl);
    if (!text.trim()) {
      inputEl.setAttribute('dir', 'auto');
      return;
    }
    const isRtl = AMTool.persian.isPersianDominantOrMixed(text);
    inputEl.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    inputEl.style.textAlign = isRtl ? 'right' : 'left';
    inputEl.style.unicodeBidi = 'plaintext';
  }

  // High-fidelity extraction powered by the ported Arash Chat Exporter engine.
  /** A page title that is only the platform name is not a conversation title. */
  function hasRealConversationTitle(title, platformName) {
    const value = String(title || '').replace(/\s+/g, ' ').trim();
    if (!value) return false;
    const bare = /^(chatgpt|claude|gemini|grok|deepseek|perplexity|qwen|kimi|poe|copilot|microsoft copilot|google ai studio|mistral|huggingchat|doubao|yuanbao|ai studio)$/i;
    if (bare.test(value)) return false;
    if (platformName && value.toLowerCase() === String(platformName).trim().toLowerCase()) return false;
    return true;
  }

  function engineConversation() {
    const AX = window.AX;
    const bridge = AMTool.engine;
    if (!AX || !AX.sites || !AX.extract || !bridge || typeof bridge.chatFromEngine !== 'function') {
      return null;
    }
    let adapter = null;
    try {
      adapter = AX.sites.detect();
    } catch (e) {
      adapter = null;
    }
    if (!adapter) return null;
    try {
      const conversation = AX.sites.getConversation(adapter, { includeThinking: true });
      if (!conversation || !conversation.messages || !conversation.messages.length) return null;
      const chat = bridge.chatFromEngine(conversation);
      if (!chat) return null;
      const platform = getPlatformInfo();
      if (platform) {
        chat.platformId = platform.id || chat.platformId;
        chat.platformName = platform.name || chat.platformName;
      }
      // The engine falls back to `document.title`; when that is only the site
      // name the capture has no real title, so mark it as generated and use the
      // first user message instead of exporting "ChatGPT" as the title.
      if (!hasRealConversationTitle(chat.title, chat.platformName)) {
        const firstUser = chat.messages.find(m => m.role === 'user');
        chat.title = (firstUser && (firstUser.content || firstUser.markdown) ? (firstUser.content || firstUser.markdown) : '')
          .slice(0, 60).replace(/\s+/g, ' ').trim() || AMTool.i18n.t('common.aiConversation');
        chat.titleSource = 'generated';
      } else {
        chat.titleSource = 'conversation';
      }
      return chat;
    } catch (e) {
      console.warn('A.max: engine extraction failed, using fallback.', e);
      return null;
    }
  }

  // Extract all conversation messages from the current AI chat page.
  function extractConversation() {
    const fromEngine = engineConversation();
    if (fromEngine && fromEngine.messages.length) return fromEngine;
    return legacyExtractConversation();
  }

  /**
   * Full-history capture.
   *
   * A chat page only renders the turns the user has scrolled to. Like the
   * reference exporter, this reads the conversation from the site's own
   * authenticated API first, merges it with whatever the DOM already has (so
   * rendered code blocks and images survive), and only then falls back to
   * walking a virtualised list to force lazy turns to mount.
   *
   * Never rejects: any failure degrades to the plain DOM capture.
   */
  let historyToastTimer = null;

  function beginHistoryFeedback() {
    if (historyToastTimer) clearTimeout(historyToastTimer);
    historyToastTimer = setTimeout(() => {
      historyToastTimer = null;
      showToast(AMTool.i18n.t('history.fetching'));
    }, 700);
    return () => {
      if (historyToastTimer) {
        clearTimeout(historyToastTimer);
        historyToastTimer = null;
      }
    };
  }

  function statusForMessages(messages, fallback) {
    if (!messages || !messages.length) return 'unsupported';
    return messages.some((message) => message.role === 'unknown') ? 'partial' : fallback || 'complete';
  }

  async function captureConversation(options) {
    const opts = Object.assign({ deep: true, hydrate: true, feedback: false }, options || {});
    const platform = getPlatformInfo();
    const domChat = extractConversation();
    const endFeedback = opts.feedback ? beginHistoryFeedback() : null;
    try {
      if (!opts.deep || !AMTool.history) {
        return Object.assign({}, domChat, { historySource: 'dom' });
      }

      // Never let the popup wait on a stalled endpoint: 9s cap, then DOM.
      let apiTimer = null;
      const api = await Promise.race([
        AMTool.history.fetchFull(platform.id, location.href),
        new Promise((resolve) => { apiTimer = setTimeout(() => resolve(null), 9000); })
      ]);
      if (apiTimer) clearTimeout(apiTimer);
      if (api && Array.isArray(api.messages) && api.messages.length) {
        const messages = AMTool.history.mergeMessages(api.messages, domChat.messages || []);
        if (messages.length) {
          const apiTitle = hasRealConversationTitle(api.title, platform.name) ? api.title : '';
          return Object.assign({}, domChat, {
            title: apiTitle || domChat.title,
            titleSource: apiTitle ? 'conversation' : domChat.titleSource,
            messages,
            extractionStatus: statusForMessages(messages, 'complete'),
            historySource: 'api',
            capturedAt: new Date().toISOString()
          });
        }
      }

      if (opts.hydrate) {
        const beforeCount = (domChat.messages || []).length;
        const hydrated = await AMTool.history.hydrateDom();
        if (hydrated && hydrated.added > 0) {
          const afterChat = extractConversation();
          if ((afterChat.messages || []).length > beforeCount) {
            const messages = AMTool.history.mergeMessages(afterChat.messages || [], domChat.messages || []);
            if (messages.length > beforeCount) {
              return Object.assign({}, afterChat, {
                messages,
                extractionStatus: statusForMessages(messages, afterChat.extractionStatus),
                historySource: 'dom+scroll',
                capturedAt: new Date().toISOString()
              });
            }
          }
        }
      }

      return Object.assign({}, domChat, { historySource: 'dom' });
    } catch (error) {
      console.info('A.max: deep capture failed, using DOM capture.', error);
      return Object.assign({}, domChat, { historySource: 'dom' });
    } finally {
      if (endFeedback) endFeedback();
    }
  }

  function legacyExtractConversation() {
    const platform = getPlatformInfo();
    const messages = [];
    const seenNodes = new Set();

    function extractThinkingFromElement(el) {
      const thinkSelectors = [
        'details',
        '[class*="thinking"]',
        '[class*="reasoning"]',
        '[data-testid*="thought"]',
        'ms-thought-chunk'
      ];
      for (const sel of thinkSelectors) {
        const node = el.querySelector(sel);
        if (node && node.textContent && node.textContent.trim().length > 5) {
          return node.textContent.trim();
        }
      }
      return '';
    }

    function cleanCloneTextAndMarkdown(el) {
      const clone = el.cloneNode(true);
      clone
        .querySelectorAll(
          'script, style, .am-single-export-wrap, [data-am-ui="1"], button[aria-label*="Copy" i], details'
        )
        .forEach((n) => n.remove());
      const content = (clone.innerText || clone.textContent || '').trim();
      const markdown = AMTool.exporters.htmlToMarkdown(clone.innerHTML, content);
      return { content, markdown };
    }

    const roleNodes = Array.from(
      document.querySelectorAll('[data-message-author-role], [data-turn-role], [data-message-role]')
    );
    if (roleNodes.length > 0) {
      roleNodes.forEach((node, idx) => {
        if (seenNodes.has(node)) return;
        seenNodes.add(node);
        const rawRole = (
          node.getAttribute('data-message-author-role') ||
          node.getAttribute('data-turn-role') ||
          node.getAttribute('data-message-role') ||
          ''
        ).toLowerCase();
        const role = rawRole.includes('user') || rawRole.includes('human') ? 'user' : rawRole.includes('assistant') || rawRole.includes('model') ? 'assistant' : 'unknown';
        const thinking = role === 'assistant' ? extractThinkingFromElement(node) : '';
        const { content, markdown } = cleanCloneTextAndMarkdown(node);
        if (!content) return;
        messages.push({
          id: node.getAttribute('data-message-id') || 'turn_' + (idx + 1),
          role,
          thinking,
          content,
          markdown,
          timestamp: null, sentAt: null, capturedAt: new Date().toISOString()
        });
      });
    }

    if (messages.length === 0) {
      const combined = [];
      (platform.userSelectors || []).forEach((sel) => {
        try {
          document.querySelectorAll(sel).forEach((el) => combined.push({ el, role: 'user' }));
        } catch (e) {}
      });
      (platform.assistantSelectors || []).forEach((sel) => {
        try {
          document.querySelectorAll(sel).forEach((el) => combined.push({ el, role: 'assistant' }));
        } catch (e) {}
      });

      // Deduplicate nested elements and sort by DOM position
      const filtered = combined.filter(
        (item, idx, arr) =>
          !arr.some((other, oIdx) => oIdx !== idx && other.el !== item.el && other.el.contains(item.el))
      );
      filtered.sort((a, b) => {
        if (a.el === b.el) return 0;
        return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      filtered.forEach((item, idx) => {
        if (seenNodes.has(item.el)) return;
        seenNodes.add(item.el);
        const thinking = item.role === 'assistant' ? extractThinkingFromElement(item.el) : '';
        const { content, markdown } = cleanCloneTextAndMarkdown(item.el);
        if (!content) return;
        messages.push({
          id: 'msg_' + (idx + 1),
          role: item.role,
          thinking,
          content,
          markdown,
          timestamp: null, sentAt: null, capturedAt: new Date().toISOString()
        });
      });
    }

    if (messages.length === 0) {
      const fallbackBlocks = Array.from(
        document.querySelectorAll('main article, main .prose, main .markdown, main .ds-markdown')
      );
      fallbackBlocks.forEach((el, idx) => {
        const { content, markdown } = cleanCloneTextAndMarkdown(el);
        if (!content || content.length < 2) return;
        messages.push({
          id: 'fallback_' + (idx + 1),
          role: 'unknown',
          thinking: '',
          content,
          markdown,
          timestamp: null, sentAt: null, capturedAt: new Date().toISOString()
        });
      });
    }

    const rawTitle = (document.title || '')
      .replace(/\s*[-|•]\s*(ChatGPT|Claude|Gemini|Grok|DeepSeek|Perplexity|Qwen|Kimi|Poe|Copilot).*$/i, '')
      .trim();
    const fallbackTitle =
      messages.find((m) => m.role === 'user')?.content?.slice(0, 60)?.replace(/\n+/g, ' ') ||
      AMTool.i18n.t('common.aiConversation');

    const chatData = {
      platformId: platform.id,
      platformName: platform.name,
      title: rawTitle || fallbackTitle,
      titleSource: rawTitle ? 'conversation' : 'generated',
      url: window.location.href,
      createdAt: Date.now(),
      messages
    };

    chatData.capturedAt = new Date().toISOString();
    chatData.extractionStatus = messages.length ? (messages.some(m => m.role === 'unknown') ? 'partial' : 'complete') : 'unsupported';
    return chatData;
  }

  function formatCurrentTimeShort() {
    try {
      return new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return new Date().toTimeString().slice(0, 5);
    }
  }

  /* --------------------- In-chat single-message export ---------------------- */

  const SINGLE_EXPORT_MENU_ID = 'am-single-export-menu';

  const SINGLE_MENU_ICONS = {
    pdf: '<path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M9 13h6M9 17h4"/>',
    word: '<path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="m8.5 12 1.1 5L11 13.6 12.4 17l1.1-5"/>',
    markdown: '<path d="M9.5 4 8 20M16 4l-1.5 16M5.5 9h13M4.5 15h13"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.4"/><path d="m21 15.5-4.3-4.2L9 19"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    copyImage: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.4"/><path d="m21 15.5-4.3-4.2L9 19"/><path d="M9 21v-2.5"/>',
    sidepanel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14 4.5v15"/><path d="M6.5 9h4M6.5 13h4"/>'
  };

  const SINGLE_MENU_ITEMS = [
    { format: 'pdf', label: 'single.pdf', tag: 'PDF', icon: 'pdf' },
    { format: 'word', label: 'single.word', tag: 'DOCX', icon: 'word' },
    { format: 'markdown', label: 'single.markdown', tag: 'MD', icon: 'markdown' },
    { format: 'image', label: 'single.image', tag: 'PNG', icon: 'image' },
    { format: 'copyImage', label: 'single.copyImage', tag: 'CLIP', icon: 'copyImage' },
    { format: 'copy', label: 'single.copy', tag: 'TEXT', icon: 'copy' },
    { format: 'sidepanel', label: 'single.sidepanel', tag: '+', icon: 'sidepanel', divider: true }
  ];

  let openSingleMenuState = null;

  function svgIcon(paths) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  }

  /** Best-effort read of the surface colour so the popover matches the host theme. */
  function detectSurfaceTheme(element) {
    let node = element;
    for (let depth = 0; depth < 8 && node; depth += 1) {
      try {
        const value = getComputedStyle(node).backgroundColor;
        const match = value && value.match(/rgba?\(([^)]+)\)/);
        if (match) {
          const parts = match[1].split(',').map((part) => Number(part.trim()));
          const alpha = parts.length > 3 ? parts[3] : 1;
          if (alpha > 0.5 && parts.length >= 3) {
            const luminance = 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
            return luminance > 150 ? 'light' : 'dark';
          }
        }
      } catch (e) { /* ignore */ }
      node = node.parentElement;
    }
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function closeSingleMenu(options) {
    if (!openSingleMenuState) return;
    const state = openSingleMenuState;
    openSingleMenuState = null;
    state.detach();
    state.menu.classList.remove('am-open');
    state.trigger.setAttribute('aria-expanded', 'false');
    const menu = state.menu;
    setTimeout(() => menu.remove(), 160);
    if (options && options.restoreFocus) {
      try { state.trigger.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function placeSingleMenu(menu, trigger) {
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!vw || !vh) return;
    if (rect.bottom < 0 || rect.top > vh) {
      closeSingleMenu({});
      return;
    }
    const margin = 8;
    const menuRect = menu.getBoundingClientRect();
    const width = Math.min(menuRect.width || 252, Math.max(120, vw - margin * 2));
    const height = Math.min(menuRect.height || 240, Math.max(120, vh - margin * 2));
    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, vw - margin - width));
    const spaceAbove = rect.top - margin;
    const spaceBelow = vh - rect.bottom - margin;
    const placeAbove = spaceAbove >= height || spaceAbove >= spaceBelow;
    let top = placeAbove ? rect.top - height - 8 : rect.bottom + 8;
    top = Math.max(margin, Math.min(top, vh - margin - height));
    // `important` keeps host-page rules for `[class*="menu"]` or `div` from
    // displacing the popover; the CSS deliberately does not reset `inset`.
    menu.style.setProperty('left', `${Math.round(left)}px`, 'important');
    menu.style.setProperty('top', `${Math.round(top)}px`, 'important');
    menu.style.transformOrigin = placeAbove ? 'bottom center' : 'top center';
    menu.setAttribute('data-placement', placeAbove ? 'top' : 'bottom');
  }

  function openSingleMenu(trigger, container) {
    closeSingleMenu({});
    const language = AMTool.i18n.getLanguage ? AMTool.i18n.getLanguage() : 'fa';
    const dir = AMTool.i18n.getDirection ? AMTool.i18n.getDirection() : 'rtl';
    const role = messageRoleFor(container);
    const raf = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback) => setTimeout(callback, 16);
    const caf = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : (handle) => clearTimeout(handle);

    const menu = document.createElement('div');
    menu.className = 'am-single-export-menu';
    menu.id = SINGLE_EXPORT_MENU_ID;
    menu.setAttribute('data-am-ui', '1');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('dir', dir);
    menu.lang = language;
    menu.dataset.theme = detectSurfaceTheme(trigger);
    menu.innerHTML = `
      <div class="am-single-menu-head">
        <span class="am-single-menu-title">${AMTool.i18n.t('single.menuTitle')}</span>
        <span class="am-single-menu-chip">${AMTool.i18n.t(role === 'user' ? 'single.roleUser' : 'single.roleAssistant')}</span>
      </div>
      ${SINGLE_MENU_ITEMS.map(
        (item) => `
        ${item.divider ? '<div class="am-single-menu-sep" role="separator"></div>' : ''}
        <button type="button" class="am-single-menu-item" role="menuitem" tabindex="-1" data-format="${item.format}">
          <span class="am-single-menu-icon">${svgIcon(SINGLE_MENU_ICONS[item.icon])}</span>
          <span class="am-single-menu-label">${AMTool.i18n.t(item.label)}</span>
          <span class="am-single-menu-tag" aria-hidden="true">${item.tag}</span>
        </button>`
      ).join('')}
      <div class="am-single-menu-foot" aria-hidden="true">A.max</div>
    `;

    document.body.appendChild(menu);
    placeSingleMenu(menu, trigger);
    trigger.setAttribute('aria-expanded', 'true');

    let frame = 0;
    const reposition = () => {
      if (frame) return;
      frame = raf(() => {
        frame = 0;
        if (!menu.isConnected) return;
        placeSingleMenu(menu, trigger);
      });
    };
    const onOutside = (event) => {
      const target = event.target;
      if (menu.contains(target) || trigger.contains(target)) return;
      closeSingleMenu({});
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('pointerdown', onOutside, true);

    const detach = () => {
      if (frame) caf(frame);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('pointerdown', onOutside, true);
    };

    const items = Array.from(menu.querySelectorAll('.am-single-menu-item'));
    menu.addEventListener('keydown', (event) => {
      const index = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = index < 0 ? (delta > 0 ? 0 : items.length - 1) : (index + delta + items.length) % items.length;
        items[next].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        items[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeSingleMenu({ restoreFocus: true });
      } else if (event.key === 'Tab') {
        closeSingleMenu({});
      }
    });

    items.forEach((item) => {
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        const format = item.getAttribute('data-format');
        closeSingleMenu({});
        handleSingleMessageExport(format, container);
      });
    });

    openSingleMenuState = { menu, trigger, detach };
    // A short delay keeps the opening transition from being skipped by the same frame.
    raf(() => {
      if (!menu.isConnected) return;
      menu.classList.add('am-open');
      const first = menu.querySelector('.am-single-menu-item');
      if (first) {
        try { first.focus({ preventScroll: true }); } catch (e) {}
      }
    });
  }

  function messageRoleFor(container) {
    const holder =
      (container.closest && container.closest('[data-message-author-role], [data-turn-role], [data-message-role]')) ||
      container;
    const raw = String(
      (holder.getAttribute && (holder.getAttribute('data-message-author-role') || holder.getAttribute('data-turn-role') || holder.getAttribute('data-message-role'))) ||
      ''
    ).toLowerCase();
    if (raw.includes('user') || raw.includes('human')) return 'user';
    if (raw.includes('assistant') || raw.includes('model')) return 'assistant';
    const hint = `${(holder.className && String(holder.className)) || ''} ${(holder.getAttribute && holder.getAttribute('data-testid')) || ''}`;
    if (/user|human|query/i.test(hint)) return 'user';
    return 'assistant';
  }

  /** The rendered node that holds this turn's text, for an unambiguous export. */
  function messageElementFor(container) {
    // A role-tagged wrapper is the most precise answer on ChatGPT/Claude.
    const explicitHolder =
      container.closest && container.closest('[data-message-author-role], [data-turn-role], [data-message-role]');
    if (explicitHolder) return explicitHolder;

    // Otherwise walk outwards from the action bar (never matching the bar
    // itself, whose class often contains "turn") to the turn wrapper.
    let node = container.parentElement;
    for (let depth = 0; depth < 7 && node; depth += 1) {
      if (
        node.matches &&
        node.matches(
          'article, [data-testid^="conversation-turn-"], [data-turn-key], model-response, .font-claude-message, [class*="message-row"], [class*="turn-container"]'
        )
      ) {
        const body =
          node.querySelector &&
          node.querySelector('[data-message-author-role], [data-turn-role], [data-message-role], .prose, .markdown, .ds-markdown, .font-claude-message');
        if (body && !container.contains(body)) return body;
        return node;
      }
      node = node.parentElement;
    }
    return container.parentElement || container;
  }

  function messageFromElement(element, role) {
    if (!element) return null;
    const clone = element.cloneNode(true);
    clone
      .querySelectorAll('script, style, .am-single-export-wrap, [data-am-ui="1"], button[aria-label*="Copy" i], details, [data-am-export-injected="1"]')
      .forEach((node) => node.remove());
    const content = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    if (!content) return null;
    let markdown = content;
    try {
      markdown = AMTool.exporters.htmlToMarkdown(clone.innerHTML, content) || content;
    } catch (e) { /* plain text is still a valid export */ }
    return {
      id: 'single_' + Date.now().toString(36),
      role,
      thinking: '',
      content,
      markdown,
      timestamp: null,
      sentAt: null,
      capturedAt: new Date().toISOString()
    };
  }

  /** Fallback when the action bar cannot be mapped to a message node. */
  function matchMessageFromCapture(chatData, container) {
    const messages = (chatData && chatData.messages) || [];
    const turn =
      (container.closest && container.closest('article, [data-turn-key], model-response, [id^="response"], .font-claude-message')) ||
      container.parentElement;
    const turnText = turn ? String(turn.innerText || '').trim() : '';
    if (!turnText) return null;
    const haystack = turnText.replace(/\s+/g, ' ').toLowerCase();
    let best = null;
    let bestScore = 0;
    let runnerUp = 0;
    messages.forEach((message) => {
      const text = String(message.content || message.markdown || '').replace(/\s+/g, ' ').toLowerCase();
      if (!text) return;
      const probe = text.slice(0, 120);
      let score = 0;
      if (haystack.includes(probe)) score = Math.min(1, probe.length / 120) + 0.5;
      else {
        const words = probe.split(' ').filter((word) => word.length > 3).slice(0, 12);
        if (words.length) {
          const hits = words.filter((word) => haystack.includes(word)).length;
          score = hits / words.length;
        }
      }
      if (score > bestScore) {
        runnerUp = bestScore;
        bestScore = score;
        best = message;
      } else if (score > runnerUp) {
        runnerUp = score;
      }
    });
    if (!best || bestScore < 0.7 || bestScore - runnerUp < 0.15) return null;
    return best;
  }

  async function handleSingleMessageExport(format, container) {
    const chatData = extractConversation();
    const role = messageRoleFor(container);
    const message = messageFromElement(messageElementFor(container), role) || matchMessageFromCapture(chatData, container);
    if (!message) {
      showToast(AMTool.i18n.t('single.notIdentified'));
      return { ok: false, error: 'NO_MESSAGE' };
    }
    const singleChatData = Object.assign({}, chatData, {
      messages: [message],
      extractionStatus: message.role === 'unknown' ? 'partial' : 'complete'
    });
    return executeExportAction(format, singleChatData);
  }

  // Inject the single-message export button into AI response action bars.
  let singleExportLanguage = null;

  function injectSingleMessageExportButtons() {
    if (!currentSettings.showSingleExportBtn) return;
    if (openSingleMenuState && !openSingleMenuState.trigger.isConnected) closeSingleMenu({});
    const language = AMTool.i18n.getLanguage ? AMTool.i18n.getLanguage() : 'fa';
    if (singleExportLanguage && singleExportLanguage !== language) {
      closeSingleMenu({});
      document.querySelectorAll('.am-single-export-wrap').forEach((node) => node.remove());
      document.querySelectorAll('[data-am-export-injected]').forEach((node) => node.removeAttribute('data-am-export-injected'));
    }
    singleExportLanguage = language;
    const platform = getPlatformInfo();
    const selectors = [
      ...(platform.actionToolbarSelectors || []),
      '[data-turn-key] .turn-action-controls',
      'article [data-testid*="copy-turn-action-button"]',
      '[data-cds="MessageActions"]',
      'message-actions div[class*="buttons-container"]'
    ];

    selectors.forEach((sel) => {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(sel));
      } catch (e) {}
      nodes.forEach((node) => {
        const container = node.tagName === 'BUTTON' ? node.parentElement : node;
        if (!container || container.getAttribute('data-am-export-injected') === '1') return;
        container.setAttribute('data-am-export-injected', '1');

        const wrap = document.createElement('span');
        wrap.className = 'am-single-export-wrap';
        wrap.setAttribute('data-am-ui', '1');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'am-single-export-btn';
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', SINGLE_EXPORT_MENU_ID);
        button.title = AMTool.i18n.t('export.singleMessageBtn');
        button.setAttribute('aria-label', AMTool.i18n.t('export.singleMessageBtn'));
        button.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/></svg>';

        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (openSingleMenuState && openSingleMenuState.trigger === button) {
            closeSingleMenu({ restoreFocus: true });
            return;
          }
          openSingleMenu(button, container);
        });
        button.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowDown' && !(openSingleMenuState && openSingleMenuState.trigger === button)) {
            event.preventDefault();
            openSingleMenu(button, container);
          }
        });

        wrap.appendChild(button);
        container.appendChild(wrap);
      });
    });
  }

  const DOCK_POSITION_KEY = 'am_tool_dock_position_v1';
  // Closing the dock is a global decision: the flag lives in storage so every
  // tab hides it, including tabs opened later, until the popup re-enables it.
  const DOCK_DISMISSED_KEY = 'am_tool_dock_dismissed_v1';
  let dockMinimized = false;
  let dockClosed = false;
  let dockDismissed = false;
  let dockPosition = null;
  let dockDragState = null;

  function setDockDismissed(value) {
    dockDismissed = Boolean(value);
    try {
      chrome.storage.local.set({ [DOCK_DISMISSED_KEY]: dockDismissed }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (e) {}
  }

  function clampDock(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function applyDockPosition(dock) {
    if (!dockPosition || !dock.isConnected) return;
    const maxLeft = Math.max(8, window.innerWidth - dock.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - dock.offsetHeight - 8);
    dock.style.left = clampDock(dockPosition.left, 8, maxLeft) + 'px';
    dock.style.top = clampDock(dockPosition.top, 8, maxTop) + 'px';
    dock.style.bottom = 'auto';
  }

  function saveDockPosition(dock) {
    const rect = dock.getBoundingClientRect();
    dockPosition = { left: Math.round(rect.left), top: Math.round(rect.top) };
    try {
      chrome.storage.local.set({ [DOCK_POSITION_KEY]: dockPosition }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (e) {}
  }

  function setDockMinimized(dock, value) {
    dockMinimized = Boolean(value);
    dock.classList.toggle('am-dock-min', dockMinimized);
    const button = dock.querySelector('[data-dock-action="minimize"]');
    if (button) {
      button.textContent = dockMinimized ? '+' : '−';
      button.title = AMTool.i18n.t(dockMinimized ? 'dock.expand' : 'dock.collapse');
      button.setAttribute('aria-label', button.title);
    }
  }

  function bindDockInteractions(dock) {
    const handle = dock.querySelector('.am-dock-brand');
    if (!handle) return;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const rect = dock.getBoundingClientRect();
      dockDragState = {
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pointerId: event.pointerId
      };
      dock.classList.add('am-dock-dragging');
      try { handle.setPointerCapture(event.pointerId); } catch (e) {}
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!dockDragState || dockDragState.pointerId !== event.pointerId) return;
      if (Math.abs(event.clientX - dockDragState.startX) + Math.abs(event.clientY - dockDragState.startY) > 3) {
        dockDragState.moved = true;
      }
      const maxLeft = Math.max(8, window.innerWidth - dock.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - dock.offsetHeight - 8);
      dock.style.left = clampDock(event.clientX - dockDragState.dx, 8, maxLeft) + 'px';
      dock.style.top = clampDock(event.clientY - dockDragState.dy, 8, maxTop) + 'px';
      dock.style.bottom = 'auto';
    });
    const endDrag = (event) => {
      if (!dockDragState) return;
      const moved = dockDragState.moved;
      const pointerId = dockDragState.pointerId;
      dockDragState = null;
      dock.classList.remove('am-dock-dragging');
      try { handle.releasePointerCapture(pointerId); } catch (e) {}
      if (moved) saveDockPosition(dock);
      void event;
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    dock.querySelector('[data-dock-action="minimize"]')?.addEventListener('click', () => {
      setDockMinimized(dock, !dockMinimized);
    });
    dock.querySelector('[data-dock-action="close"]')?.addEventListener('click', () => {
      dockClosed = true;
      setDockDismissed(true);
      dock.remove();
      showToast(AMTool.i18n.t('dock.closed'));
    });
  }

  function renderFloatingDock() {
    const language = AMTool.i18n.getLanguage ? AMTool.i18n.getLanguage() : 'fa';
    const existing = document.querySelector('.am-floating-dock');
    if (!currentSettings.showFloatingDock || dockClosed || dockDismissed) {
      existing?.remove();
      return;
    }
    // Rebuild when the UI language changes so dock labels follow it.
    if (existing && existing.getAttribute('data-am-lang') !== language) existing.remove();
    const current = document.querySelector('.am-floating-dock');
    if (current) {
      current.setAttribute('dir', AMTool.i18n.getDirection ? AMTool.i18n.getDirection() : 'rtl');
      applyDockPosition(current);
      setDockMinimized(current, dockMinimized);
      updateDockStatus(Boolean(lastSavedDraftText));
      return;
    }

    const dock = document.createElement('div');
    dock.className = 'am-floating-dock';
    dock.setAttribute('data-am-ui', '1');
    dock.setAttribute('data-am-lang', language);
    dock.setAttribute('dir', AMTool.i18n.getDirection ? AMTool.i18n.getDirection() : 'rtl');
    dock.innerHTML = `
      <div class="am-dock-brand" title="A.max — Created by Arash Makki (MIT License) · ${AMTool.i18n.t('dock.dragHint')}">
        <span class="am-dock-status-dot" id="am-dock-dot"></span>
        <span class="am-dock-name">A.max</span>
      </div>
      <span class="am-dock-sep" aria-hidden="true" data-dock-collapsible="1"></span>
      <button type="button" class="am-dock-btn am-dock-primary" data-dock-action="preview" data-dock-collapsible="1" title="${AMTool.i18n.t('dock.previewTitle')}">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M8 12h8M12 8v8"/></svg>
        <span>${AMTool.i18n.t('dock.preview')}</span>
      </button>
      <button type="button" class="am-dock-btn" data-dock-action="fix-bidi" data-dock-collapsible="1" title="${AMTool.i18n.t('dock.bidiTitle')}">${AMTool.i18n.t('dock.bidi')}</button>
      <button type="button" class="am-dock-btn" data-dock-action="fix-input" data-dock-collapsible="1" title="${AMTool.i18n.t('dock.inputTitle')}">${AMTool.i18n.t('dock.input')}</button>
      <button type="button" class="am-dock-icon" data-dock-action="minimize" title="${AMTool.i18n.t('dock.collapse')}" aria-label="${AMTool.i18n.t('dock.collapse')}">−</button>
      <button type="button" class="am-dock-icon" data-dock-action="close" title="${AMTool.i18n.t('dock.close')}" aria-label="${AMTool.i18n.t('dock.close')}">×</button>
    `;

    dock.querySelector('[data-dock-action="preview"]').addEventListener('click', () => {
      openPreviewStudio();
    });

    dock.querySelector('[data-dock-action="fix-bidi"]').addEventListener('click', () => {
      AMTool.persian.fixElementBiDi(document.body, {
        applyFont: currentSettings.applyPersianFontOnPage
      });
      showToast(AMTool.i18n.t('toast.rtlFixed'));
    });

    dock.querySelector('[data-dock-action="fix-input"]').addEventListener('click', () => {
      normalizeActivePromptInput();
    });

    document.body.appendChild(dock);
    bindDockInteractions(dock);
    setDockMinimized(dock, dockMinimized);
    updateDockStatus(Boolean(lastSavedDraftText));
    try {
      chrome.storage.local.get(DOCK_POSITION_KEY, (result) => {
        void (chrome.runtime && chrome.runtime.lastError);
        const saved = result && result[DOCK_POSITION_KEY];
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
          dockPosition = { left: saved.left, top: saved.top };
          applyDockPosition(dock);
        }
      });
    } catch (e) {}
  }

  function updateDockStatus(hasDraft) {
    const dot = document.getElementById('am-dock-dot');
    if (!dot) return;
    const guard = Boolean(currentSettings.autoSavePrompts);
    dot.style.background = !guard ? '#6B7280' : hasDraft ? '#14B8A6' : '#22C55E';
    dot.style.boxShadow = !guard
      ? '0 0 0 3px rgba(107, 114, 128, 0.16)'
      : hasDraft
        ? '0 0 0 3px rgba(20, 184, 166, 0.18)'
        : '0 0 0 3px rgba(34, 197, 94, 0.14)';
  }

  function normalizeActivePromptInput() {
    const inputEl = findPromptInputElement();
    if (!inputEl) {
      showToast(AMTool.i18n.t('toast.noInput'));
      return false;
    }
    const raw = readInputElementText(inputEl);
    if (!raw.trim()) return false;
    const fixed = AMTool.persian.fixPersianHalfSpaces(raw);
    writeInputElementText(inputEl, fixed);
    applyInputBoxDirection(inputEl);
    persistCurrentInputDraft(fixed);
    showToast(AMTool.i18n.t('toast.inputFixed'));
    return true;
  }

  async function openPreviewStudio() {
    const chatData = await captureConversation({ feedback: true });
    if (!chatData.messages || chatData.messages.length === 0) {
      showToast(AMTool.i18n.t('toast.noMessages'));
      return false;
    }
    // Hand the raw capture to one specific Studio tab. A per-instance key means
    // a second Studio window opened from another tab can never read this data.
    const handoffId = 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set(
          { ['amtool:studio:handoff:raw:' + handoffId]: { chatData, pageUrl: location.href, at: Date.now() } },
          () => {
            void (chrome.runtime && chrome.runtime.lastError);
            resolve();
          }
        );
      });
    } catch (error) {
      console.warn('A.max: studio hand-off failed.', error);
    }
    chrome.runtime.sendMessage({ type: 'AM_OPEN_STUDIO', handoffId });
    return true;
  }

  async function executeExportAction(format, customChatData) {
    const chatData = customChatData || (await captureConversation({ feedback: true }));
    if (!chatData.messages || chatData.messages.length === 0) {
      showToast(AMTool.i18n.t('toast.noMessages'));
      return { ok: false, error: 'NO_MESSAGES' };
    }
    const settings = await AMTool.storage.getSettings();

    const ENGINE_FORMATS = {
      pdf: 'pdf',
      word: 'docx',
      docx: 'docx',
      markdown: 'markdown',
      md: 'markdown',
      image: 'png',
      png: 'png',
      json: 'json',
      text: 'txt',
      txt: 'txt',
      html: 'html',
      csv: 'csv'
    };
    const engine = AMTool.engine;
    if (format === 'copyImage') {
      if (!engine || typeof engine.copyImage !== 'function') {
        showToast(AMTool.i18n.t('toast.copyImageFailed'));
        return { ok: false, error: 'ENGINE_UNAVAILABLE' };
      }
      try {
        const copied = await engine.copyImage(chatData, settings);
        if (!copied || copied.ok === false) {
          showToast(AMTool.i18n.t(copied && copied.error === 'MULTI_PART' ? 'toast.copyImageMulti' : 'toast.copyImageFailed'));
          return { ok: false, error: (copied && copied.error) || 'COPY_FAILED' };
        }
        showToast(AMTool.i18n.t('toast.imageCopied'));
        return { ok: true, count: chatData.messages.length };
      } catch (error) {
        showToast(AMTool.i18n.t('toast.copyImageFailed'));
        return { ok: false, error: String((error && error.message) || error) };
      }
    }
    if (engine && engine.available && ENGINE_FORMATS[format]) {
      try {
        const result = await engine.exportAs(ENGINE_FORMATS[format], chatData, settings);
        if (result && result.ok === false) {
          throw new Error(result.error || AMTool.i18n.t('toast.exportFailed'));
        }
        if (format === 'pdf') {
          showToast(AMTool.i18n.t('toast.pdfOpened'));
        } else {
          showToast(AMTool.i18n.t('toast.exported'));
        }
        return { ok: true, count: chatData.messages.length, filename: result && result.filename };
      } catch (error) {
        console.warn('A.max: engine export failed, using legacy exporter.', error);
      }
    }

    try { switch (format) {
      case 'pdf':
        await AMTool.exporters.exportPDF(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'word':
        await AMTool.exporters.exportWordDocx(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'markdown':
        await AMTool.exporters.exportMarkdown(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'image':
        await AMTool.exporters.exportPNGImage(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'json':
        await AMTool.exporters.exportJSON(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'text':
        await AMTool.exporters.exportText(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'html':
        await AMTool.exporters.exportHTML(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'csv':
        await AMTool.exporters.exportCSV(chatData, settings);
        showToast(AMTool.i18n.t('toast.exported'));
        break;
      case 'copy':
      case 'copyMd': {
        const md = AMTool.exporters.toMarkdown(chatData, settings);
        await AMTool.exporters.copyToClipboard(md);
        showToast(AMTool.i18n.t('toast.copied'));
        break;
      }
      case 'copyJson': {
        const json = AMTool.exporters.toJSON(chatData, settings);
        await AMTool.exporters.copyToClipboard(json);
        showToast(AMTool.i18n.t('toast.copied'));
        break;
      }
      case 'copyText': {
        const txt = AMTool.exporters.toPlainText(chatData, settings);
        await AMTool.exporters.copyToClipboard(txt);
        showToast(AMTool.i18n.t('toast.copied'));
        break;
      }
      case 'sidepanel':
        await AMTool.storage.addChatToAggregation(chatData);
        await AMTool.storage.cacheConversation(chatData);
        showToast(AMTool.i18n.t('toast.addedToSidepanel'));
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
        break;
    }
    return { ok: true, count: chatData.messages.length };
    } catch (error) {
      console.error('A.max export failed:', error);
      showToast(AMTool.i18n.t('toast.actionFailed') + (error && error.message ? `: ${error.message}` : ''));
      return { ok: false, error: String(error.message || error) };
    }
  }

  // Set up listeners for zero-click prompt auto-save, Enter/Send detection, and DOM BiDi observation.
  function setupEventListeners() {
    document.addEventListener(
      'input',
      (e) => {
        const target = e.target;
        if (!target || target.closest?.('[data-am-ui="1"]')) return;
        const inputEl = findPromptInputElement();
        if (inputEl && (target === inputEl || inputEl.contains(target))) {
          const text = readInputElementText(inputEl);
          applyInputBoxDirection(inputEl);
          persistCurrentInputDraft(text);
        }
      },
      true
    );

    document.addEventListener(
      'keydown',
      (e) => {
        const inputEl = findPromptInputElement();
        if (!inputEl) return;
        if (e.target === inputEl || inputEl.contains(e.target)) {
          if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            const currentText = readInputElementText(inputEl);
            if (currentText && currentText.trim()) {
              setTimeout(() => {
                const afterText = readInputElementText(inputEl).trim();
                if (!afterText) {
                  handlePromptSubmitted(currentText);
                }
              }, 300);
            }
          }
        }
      },
      true
    );

    document.addEventListener(
      'click',
      (e) => {
        if (!e.target.closest?.('.am-single-export-wrap, .am-single-export-menu')) {
          closeSingleMenu({});
        }
        const btn = e.target.closest?.('button, div[role="button"]');
        if (btn && !btn.closest('[data-am-ui="1"]') && lastSavedDraftText) {
          const inputEl = findPromptInputElement();
          const snapshot = lastSavedDraftText;
          setTimeout(() => {
            const remaining = readInputElementText(inputEl).trim();
            if (!remaining && snapshot) {
              handlePromptSubmitted(snapshot);
            }
          }, 350);
        }
      },
      true
    );

    // Periodic heartbeat handles rich-text editors (ProseMirror, Quill) that mutate state without standard input events.
    setInterval(() => {
      // Single-page apps change the conversation URL without firing input
      // events; re-key the draft scope before reading the composer.
      syncDraftScope();
      const inputEl = findPromptInputElement();
      if (inputEl) {
        const text = readInputElementText(inputEl);
        if (text.trim()) {
          persistCurrentInputDraft(text);
          applyInputBoxDirection(inputEl);
        }
      }
    }, 1500);

    window.addEventListener('popstate', () => syncDraftScope());
    window.addEventListener('hashchange', () => syncDraftScope());

    let mutationTimer = null;
    const observer = new MutationObserver(() => {
      if (mutationTimer) return;
      mutationTimer = setTimeout(() => {
        mutationTimer = null;
        if (currentSettings.autoFixPersianBiDi) {
          AMTool.persian.fixElementBiDi(document.body, {
            applyFont: currentSettings.applyPersianFontOnPage
          });
        }
        injectSingleMessageExportButtons();
      }, 220);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    chrome.storage?.onChanged?.addListener(async (changes, area) => {
      if (area !== 'local' || !changes[AMTool.storage.KEYS.SETTINGS]) return;
      currentSettings = await AMTool.storage.getSettings();
      if (!currentSettings.showSingleExportBtn) {
        closeSingleMenu({});
        document.querySelectorAll('.am-single-export-wrap').forEach(n => n.remove());
        document.querySelectorAll('[data-am-export-injected]').forEach(n => n.removeAttribute('data-am-export-injected'));
      } else injectSingleMessageExportButtons();
      // Turning Prompt Guard off must also remove the toolbar badge for this tab.
      if (!currentSettings.autoSavePrompts) {
        try {
          chrome.runtime.sendMessage({ type: 'PROMPT_DRAFT_UPDATED', hasDraft: false });
        } catch (e) {}
      }
      renderFloatingDock();
      // The status dot reflects the guard state, so refresh it for an existing dock.
      updateDockStatus(Boolean(lastSavedDraftText));
    });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return false;

    if (msg.type === 'AM_PING') {
      sendResponse({ ok: true, alive: true, platformId: getPlatformInfo().id });
      return false;
    }

    if (msg.type === 'AM_DRAFT_CONTEXT') {
      // Single source of truth for "which conversation is this tab showing".
      // The popup filters its draft list by this scope; it never guesses from
      // the tab URL alone (new-chat tabs all share the same URL).
      const scope = syncDraftScope();
      const inputEl = findPromptInputElement();
      const typed = readInputElementText(inputEl).trim();
      sendResponse({
        ok: true,
        platformId: getPlatformInfo().id,
        scope,
        conversationKey: scope,
        isConversation: AMTool.draftScope ? AMTool.draftScope.isConversationScope(scope) : false,
        url: window.location.href,
        title: document.title,
        hasDraft: Boolean(typed || lastSavedDraftText)
      });
      return false;
    }

    if (msg.type === 'AM_SHOW_DOCK') {
      if (!currentSettings.showFloatingDock) {
        sendResponse({ ok: false, error: 'DOCK_DISABLED' });
        return false;
      }
      setDockDismissed(false);
      dockClosed = false;
      dockMinimized = false;
      renderFloatingDock();
      const dock = document.querySelector('.am-floating-dock');
      if (dock) {
        setDockMinimized(dock, false);
        updateDockStatus(Boolean(lastSavedDraftText));
      }
      sendResponse({ ok: Boolean(dock) });
      return false;
    }

    if (msg.type === 'AM_COLLECT') {
      captureConversation({ deep: msg.deep !== false })
        .then((chatData) => sendResponse({ ok: true, chatData }))
        .catch((error) => sendResponse({ ok: false, error: String((error && error.message) || error) }));
      return true;
    }

    if (msg.type === 'GET_PAGE_STATUS') {
      const platform = getPlatformInfo();
      const inputEl = findPromptInputElement();
      const liveText = readInputElementText(inputEl);
      const chatData = extractConversation();
      sendResponse({
        ok: true,
        platformId: platform.id,
        platformName: platform.name,
        platformNameFa: platform.nameFa,
        url: window.location.href,
        title: chatData.title,
        messageCount: chatData.messages.length,
        extractionStatus: chatData.extractionStatus,
        liveDraft: liveText || lastSavedDraftText || '',
        scope: draftScope()
      });
      return false;
    }

    if (msg.type === 'EXTRACT_CONVERSATION') {
      captureConversation({ deep: msg.deep !== false })
        .then((chatData) => sendResponse({ ok: true, chatData }))
        .catch((error) => sendResponse({ ok: false, error: String((error && error.message) || error) }));
      return true;
    }

    if (msg.type === 'OPEN_PREVIEW_STUDIO') {
      openPreviewStudio().then((ok) => sendResponse({ ok }));
      return true;
    }

    if (msg.type === 'QUICK_EXPORT_PDF') {
      executeExportAction('pdf').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'QUICK_EXPORT_WORD') {
      executeExportAction('word').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'QUICK_EXPORT_MD') {
      executeExportAction('markdown').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'QUICK_EXPORT_PNG') {
      executeExportAction('image').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'QUICK_EXPORT_JSON') {
      executeExportAction('json').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'QUICK_EXPORT_TXT') {
      executeExportAction('text').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'QUICK_EXPORT_HTML') {
      executeExportAction('html').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'QUICK_EXPORT_CSV') {
      executeExportAction('csv').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'COPY_MARKDOWN') {
      executeExportAction('copyMd').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'COPY_JSON') {
      executeExportAction('copyJson').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'COPY_TEXT') {
      executeExportAction('copyText').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }
    if (msg.type === 'ADD_TO_SIDEPANEL') {
      executeExportAction('sidepanel').then(sendResponse).catch(error => sendResponse({ok:false,error:String(error)}));
      return true;
    }

    if (msg.type === 'RESTORE_PROMPT_TO_INPUT') {
      const inputEl = findPromptInputElement();
      if (inputEl && msg.content) {
        const existing = readInputElementText(inputEl).trim();
        if (existing && existing !== String(msg.content).trim() && !window.confirm(AMTool.i18n.t('confirm.replaceInput'))) {
          sendResponse({ ok: false, error: 'REPLACEMENT_CANCELLED' });
          return false;
        }
        writeInputElementText(inputEl, msg.content);
        applyInputBoxDirection(inputEl);
        persistCurrentInputDraft(msg.content);
        showToast(AMTool.i18n.t('toast.restored'));
        sendResponse({ ok: true });
      } else {
        AMTool.exporters.copyToClipboard(msg.content || '');
        showToast(AMTool.i18n.t('toast.copied'));
        sendResponse({ ok: false, copiedFallback: true });
      }
      return false;
    }

    if (msg.type === 'NORMALIZE_CURRENT_INPUT') {
      const ok = normalizeActivePromptInput();
      sendResponse({ ok });
      return false;
    }

    if (msg.type === 'FIX_PERSIAN_NOW') {
      const count = AMTool.persian.fixElementBiDi(document.body, {
        applyFont: currentSettings.applyPersianFontOnPage
      });
      const inputEl = findPromptInputElement();
      if (inputEl) applyInputBoxDirection(inputEl);
      showToast(AMTool.i18n.t('toast.rtlFixed'));
      sendResponse({ ok: true, count });
      return false;
    }

    return false;
  });

  async function init() {
    currentSettings = await AMTool.storage.getSettings();
    AMTool.i18n.setLanguage(currentSettings.language || 'fa');
    currentDraftScope = draftScope();
    lastKnownHref = window.location.href;

    // Restore the global dock state before the first render so a tab opened
    // after the user closed the dock never flashes it on screen.
    try {
      const stored = await new Promise((resolve) => {
        chrome.storage.local.get([DOCK_POSITION_KEY, DOCK_DISMISSED_KEY], (result) => {
          void (chrome.runtime && chrome.runtime.lastError);
          resolve(result || {});
        });
      });
      dockDismissed = Boolean(stored[DOCK_DISMISSED_KEY]);
      const savedPosition = stored[DOCK_POSITION_KEY];
      if (savedPosition && Number.isFinite(savedPosition.left) && Number.isFinite(savedPosition.top)) {
        dockPosition = { left: savedPosition.left, top: savedPosition.top };
      }
    } catch (e) {}

    if (currentSettings.autoFixPersianBiDi) {
      AMTool.persian.fixElementBiDi(document.body, {
        applyFont: currentSettings.applyPersianFontOnPage
      });
    }

    renderFloatingDock();
    injectSingleMessageExportButtons();
    setupEventListeners();

    setTimeout(() => {
      checkAndShowCrashRecovery();
    }, 900);

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(async (changes) => {
        if (changes && Object.prototype.hasOwnProperty.call(changes, DOCK_DISMISSED_KEY)) {
          const next = Boolean(changes[DOCK_DISMISSED_KEY].newValue);
          dockDismissed = next;
          if (!next) {
            dockClosed = false;
            dockMinimized = false;
          }
        }
        currentSettings = await AMTool.storage.getSettings();
        AMTool.i18n.setLanguage(currentSettings.language || 'fa');
        renderFloatingDock();
        if (currentSettings.autoFixPersianBiDi) {
          AMTool.persian.fixElementBiDi(document.body, {
            applyFont: currentSettings.applyPersianFontOnPage
          });
        }
      });
    }
  }

  init();
})();
