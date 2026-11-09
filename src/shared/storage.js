/*!
 * A.max — Crash-Proof Dual-Layer Storage & Settings Manager
 * Created by Arash Makki | Released under the MIT License
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});

  const KEYS = {
    SETTINGS: 'am_tool_settings_v1',
    LIVE_DRAFTS: 'am_tool_live_drafts_v1',
    PROMPT_HISTORY: 'am_tool_prompt_history_v1',
    PROMPT_TEMPLATES: 'am_tool_prompt_templates_v1',
    AGGREGATION: 'am_tool_sidepanel_aggregation_v1',
    CHAT_CACHE: 'am_tool_chat_cache_v1',
    LAST_PREVIEW_DATA: 'am_tool_last_preview_data_v1',
    LOCAL_EMERGENCY_PREFIX: '__am_tool_emergency_draft__'
  };

  const DEFAULT_SETTINGS = {
    language: 'fa',
    uiTheme: 'dark', // 'system' | 'light' | 'dark'
    // Export & Style Config (compatible with all Chat Exporter 4.6.1 features)
    exportFilenameFormat: 'ai_title_datetime',
    includeThinkingContent: true,
    showMessageTimestamp: true,
    includeSourceUrl: true,
    appendBranding: true,
    customBrandingText: 'Created with A.max by Arash Makki',
    markdownImageExportMode: 'originalUrl', // 'originalUrl' | 'embeddedBase64'
    exportTheme: 'light', // 'light' | 'dark' | 'note' | 'old_paper' | 'sakura' | 'blue_mist' | 'fresh_green' | 'lavender'
    exportWidth: '820px',
    exportFontSize: 'medium', // 'small' | 'medium' | 'large'
    exportFontFamily: 'Vazirmatn, Tahoma, system-ui, sans-serif',
    exportTableStyle: 'solid', // 'solid' | 'dashed' | 'none'
    pdfFormat: 'A4', // 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal'
    pdfOrientation: 'portrait', // 'portrait' | 'landscape'
    pdfMarginTop: 10,
    pdfMarginRight: 10,
    pdfMarginBottom: 14,
    pdfMarginLeft: 10,
    pdfScale: 1,
    pdfShowPageNumbers: true,
    pdfWatermarkText: 'A.max • Arash Makki',
    showSingleExportBtn: true,
    showFloatingDock: true,
    showContextMenuBtn: true,
    cacheRetentionDays: 30,
    autoSavePrompts: false, // opt-in on fresh installs; existing saved preference is preserved
    autoShowRecoveryBanner: true,
    autoFillEmptyInputOnCrashRecovery: false,
    maxPromptHistoryItems: 250,
    autoFixPersianBiDi: true,
    autoFixInputDirection: true,
    applyPersianFontOnPage: true,
    autoNormalizePersianWhileTyping: false
  };

  const DEFAULT_TEMPLATES = [
    {
      id: 'tpl_1',
      title: 'خلاصه‌سازی دقیق و ساختاریافته متن',
      content: 'لطفاً متن زیر را به زبان فارسی روان و با ساختار بولت‌پوینت خلاصه کن. نکات کلیدی، اعداد مهم و نتیجه‌گیری نهایی را جداگانه مشخص کن:\n\n',
      createdAt: Date.now()
    },
    {
      id: 'tpl_2',
      title: 'بازبینی کد و رفع باگ (Code Review)',
      content: 'کد زیر را از نظر عملکرد، امنیت، خوانایی و موارد مرزی (Edge Cases) بررسی کن و نسخه بهینه‌شده را به همراه توضیح تغییرات ارائه بده:\n\n',
      createdAt: Date.now()
    },
    {
      id: 'tpl_3',
      title: 'ترجمه تخصصی با حفظ اصطلاحات فنی',
      content: 'متن زیر را به فارسی سلیس و تخصصی ترجمه کن. اصطلاحات مهم فنی را در پرانتز به انگلیسی حفظ کن تا مفهوم دقیق جملات از بین نرود:\n\n',
      createdAt: Date.now()
    }
  ];

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  async function rawGet(key, fallback) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([key], (res) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve(fallback);
              return;
            }
            resolve(res && res[key] !== undefined ? res[key] : fallback);
          });
        } catch (e) {
          resolve(fallback);
        }
      });
    }
    try {
      const raw = global.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  async function rawSet(key, value) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [key]: value }, () => resolve(!chrome.runtime?.lastError));
        } catch (e) {
          resolve(false);
        }
      });
    }
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  async function getSettings() {
    const saved = await rawGet(KEYS.SETTINGS, {});
    return Object.assign({}, DEFAULT_SETTINGS, saved || {});
  }

  async function updateSettings(patch) {
    const current = await getSettings();
    const updated = Object.assign({}, current, patch || {});
    if (!(await rawSet(KEYS.SETTINGS, updated))) throw new Error('Unable to persist settings');
    return updated;
  }

  // Never write private drafts into the host website's localStorage.
  // Legacy emergency drafts remain readable only for an explicit migration UI.
  function saveEmergencyLocalDraft() { return false; }
  function getEmergencyLocalDraft(platformId) {
    try {
      const text = global.localStorage?.getItem(KEYS.LOCAL_EMERGENCY_PREFIX + (platformId || 'unknown'));
      return text ? JSON.parse(text) : null;
    } catch (_) { return null; }
  }
  function clearEmergencyLocalDraft(platformId) {
    try { global.localStorage?.removeItem(KEYS.LOCAL_EMERGENCY_PREFIX + (platformId || 'unknown')); } catch (_) {}
  }

  /**
   * A draft belongs to one scope: `conv:<conversationId>` or `tab:<tabId>`.
   * The full URL is only a legacy fallback (1.1 records and pre-scope drafts),
   * never the primary identity — otherwise every "new chat" tab collides on
   * `https://chatgpt.com/`.
   */
  function draftIdentity(item) {
    const scope = String(item.conversationKey || '').trim();
    const url = String(item.url || '').split('#')[0];
    return [item.platformId || 'unknown', scope || url || item.sessionKey || 'unscoped', item.inputKey || 'main'].join('::');
  }

  // Serial writer avoids read-modify-write races between rapid input events inside this JS context.
  let draftWrite = Promise.resolve();
  async function saveLiveDraft(draftObj) {
    if (!draftObj || !draftObj.platformId) return false;
    const settings = await getSettings();
    if (!settings.autoSavePrompts) return false;
    const key = draftIdentity(draftObj);
    const conversationKey = String(draftObj.conversationKey || '').trim();
    const entry = {
      id: key, platformId: draftObj.platformId,
      platformName: draftObj.platformName || draftObj.platformId,
      url: draftObj.url || '', title: draftObj.title || '',
      conversationKey,
      inputKey: draftObj.inputKey || 'main',
      content: String(draftObj.content || ''), updatedAt: Date.now(), type: 'draft'
    };
    draftWrite = draftWrite.catch(() => {}).then(async () => {
      const drafts = await rawGet(KEYS.LIVE_DRAFTS, {});
      if (!entry.content.trim()) delete drafts[key]; else drafts[key] = entry;
      if (!(await rawSet(KEYS.LIVE_DRAFTS, drafts))) throw new Error('Draft write failed');
      if (entry.content.trim()) await upsertPromptHistory({ ...entry, id: 'hist_' + key });
    });
    return draftWrite.then(() => true);
  }

  async function getLiveDrafts() { return await rawGet(KEYS.LIVE_DRAFTS, {}); }

  /**
   * Removes the draft for one scope. `legacyUrl` also clears the URL-keyed
   * identity used by 1.1, so a draft saved before the upgrade cannot resurface
   * after the prompt was sent.
   */
  async function clearLiveDraft(platformId, conversationKey, inputKey, legacyUrl) {
    await draftWrite.catch(() => {});
    const drafts = await rawGet(KEYS.LIVE_DRAFTS, {});
    const targets = new Set();
    if (conversationKey) targets.add(draftIdentity({ platformId, conversationKey, inputKey }));
    if (legacyUrl) targets.add(draftIdentity({ platformId, url: legacyUrl, inputKey }));
    for (const key of Object.keys(drafts)) {
      if (targets.has(key) || (!targets.size && (key === platformId || drafts[key]?.platformId === platformId))) delete drafts[key];
    }
    if (!(await rawSet(KEYS.LIVE_DRAFTS, drafts))) throw new Error('Draft delete failed');
    return true;
  }

  /**
   * Re-keys a draft when the site turns a "new chat" tab into a conversation
   * without a reload (SPA navigation). The caller only moves a draft that is
   * still present in the composer, so text is never transplanted into a
   * conversation the user did not carry it into.
   */
  async function moveLiveDraft(platformId, fromScope, toScope, inputKey, url, title) {
    if (!platformId || !fromScope || !toScope || fromScope === toScope) return false;
    let moved = false;
    draftWrite = draftWrite.catch(() => {}).then(async () => {
      const drafts = await rawGet(KEYS.LIVE_DRAFTS, {});
      const fromKey = draftIdentity({ platformId, conversationKey: fromScope, inputKey });
      const item = drafts[fromKey];
      if (!item) return;
      const toKey = draftIdentity({ platformId, conversationKey: toScope, inputKey });
      delete drafts[fromKey];
      drafts[toKey] = Object.assign({}, item, {
        id: toKey,
        conversationKey: toScope,
        url: url || item.url || '',
        title: title || item.title || '',
        updatedAt: Date.now()
      });
      if (!(await rawSet(KEYS.LIVE_DRAFTS, drafts))) throw new Error('Draft move failed');
      moved = true;
    });
    await draftWrite;
    return moved;
  }

  async function upsertPromptHistory(item) {
    if (!item || !item.content || !item.content.trim()) return;
    const settings = await getSettings();
    const maxItems = settings.maxPromptHistoryItems || 250;
    const list = await rawGet(KEYS.PROMPT_HISTORY, []);
    const existingIdx = list.findIndex(
      (x) => x.id === item.id
    );
    const record = {
      id: item.id || 'prompt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      platformId: item.platformId || 'unknown',
      platformName: item.platformName || item.platformId || 'AI',
      url: item.url || '',
      title: item.title || '',
      conversationKey: item.conversationKey || '',
      content: item.content,
      updatedAt: item.updatedAt || Date.now(),
      type: item.type || 'draft' // 'draft' | 'sent'
    };
    if (existingIdx >= 0) {
      list.splice(existingIdx, 1);
    }
    list.unshift(record);
    if (list.length > maxItems) {
      list.length = maxItems;
    }
    await rawSet(KEYS.PROMPT_HISTORY, list);
    return list;
  }

  async function getPromptHistory() {
    return await rawGet(KEYS.PROMPT_HISTORY, []);
  }

  async function deletePromptHistoryItem(id) {
    const list = await rawGet(KEYS.PROMPT_HISTORY, []);
    const filtered = list.filter((x) => x.id !== id);
    await rawSet(KEYS.PROMPT_HISTORY, filtered);
    return filtered;
  }

  async function clearPromptHistory() {
    await rawSet(KEYS.PROMPT_HISTORY, []);
    await rawSet(KEYS.LIVE_DRAFTS, {});
    return [];
  }

  async function getTemplates() {
    const list = await rawGet(KEYS.PROMPT_TEMPLATES, null);
    if (!list) {
      await rawSet(KEYS.PROMPT_TEMPLATES, DEFAULT_TEMPLATES);
      return DEFAULT_TEMPLATES;
    }
    return list;
  }

  async function addTemplate(title, content) {
    const list = await getTemplates();
    const item = {
      id: 'tpl_' + Date.now(),
      title: (title || '').trim() || 'پرامپت بدون عنوان',
      content: (content || '').trim(),
      createdAt: Date.now()
    };
    list.unshift(item);
    await rawSet(KEYS.PROMPT_TEMPLATES, list);
    return list;
  }

  async function deleteTemplate(id) {
    const list = await getTemplates();
    const filtered = list.filter((x) => x.id !== id);
    await rawSet(KEYS.PROMPT_TEMPLATES, filtered);
    return filtered;
  }

  async function getAggregatedChats() {
    return await rawGet(KEYS.AGGREGATION, []);
  }

  async function addChatToAggregation(chatData) {
    if (!chatData || !Array.isArray(chatData.messages) || chatData.messages.length === 0) return [];
    const list = await getAggregatedChats();
    if (list.some(x => x.platformId === chatData.platformId && x.url && x.url === chatData.url)) return list;
    const entry = {
      id: 'agg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      platformId: chatData.platformId || 'ai',
      platformName: chatData.platformName || 'AI',
      title: chatData.title || 'گفتگوی بدون عنوان',
      url: chatData.url || '',
      addedAt: Date.now(),
      messages: chatData.messages
    };
    list.push(entry);
    await rawSet(KEYS.AGGREGATION, list);
    return list;
  }

  async function moveAggregatedChat(id, direction) {
    const list = await getAggregatedChats();
    const from = list.findIndex(x => x.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return list;
    const [item] = list.splice(from, 1); list.splice(to, 0, item);
    if (!(await rawSet(KEYS.AGGREGATION, list))) throw new Error('Reorder failed');
    return list;
  }

  async function removeAggregatedChat(id) {
    const list = await getAggregatedChats();
    const filtered = list.filter((x) => x.id !== id);
    await rawSet(KEYS.AGGREGATION, filtered);
    return filtered;
  }

  async function clearAggregatedChats() {
    await rawSet(KEYS.AGGREGATION, []);
    return [];
  }

  async function cacheConversation(chatData) {
    if (!chatData || !Array.isArray(chatData.messages) || chatData.messages.length === 0) return;
    const settings = await getSettings();
    const retentionMs = (settings.cacheRetentionDays || 30) * 86400000;
    const now = Date.now();
    let list = await rawGet(KEYS.CHAT_CACHE, []);
    list = list.filter((item) => now - (item.updatedAt || 0) < retentionMs);

    const cacheKey = (chatData.platformId || 'ai') + '::' + (chatData.url || chatData.title || now);
    const existingIdx = list.findIndex((x) => x.cacheKey === cacheKey);
    const record = {
      id: existingIdx >= 0 ? list[existingIdx].id : 'cache_' + now,
      cacheKey,
      platformId: chatData.platformId || 'ai',
      platformName: chatData.platformName || 'AI',
      title: chatData.title || 'گفتگوی ذخیره‌شده',
      url: chatData.url || '',
      messageCount: chatData.messages.length,
      messages: chatData.messages,
      updatedAt: now
    };
    if (existingIdx >= 0) {
      list.splice(existingIdx, 1);
    }
    list.unshift(record);
    if (list.length > 100) list.length = 100;
    await rawSet(KEYS.CHAT_CACHE, list);
  }

  async function getCachedConversations() {
    const list = await rawGet(KEYS.CHAT_CACHE, []);
    const settings = await getSettings();
    const filtered = list.filter(item => Date.now() - (item.updatedAt || 0) < (settings.cacheRetentionDays || 30) * 86400000);
    if (filtered.length !== list.length) await rawSet(KEYS.CHAT_CACHE, filtered);
    return filtered;
  }

  async function deleteCachedConversation(id) {
    const list = await rawGet(KEYS.CHAT_CACHE, []);
    const filtered = list.filter((x) => x.id !== id);
    await rawSet(KEYS.CHAT_CACHE, filtered);
    return filtered;
  }

  async function clearCachedConversations() {
    await rawSet(KEYS.CHAT_CACHE, []);
    return [];
  }

  async function setLastPreviewData(data) {
    const id = 'preview_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    if (!(await rawSet(id, data))) throw new Error('Unable to open preview');
    await rawSet(KEYS.LAST_PREVIEW_DATA, data); // fallback for v1 callers
    return id;
  }

  async function getLastPreviewData(id) {
    if (id && /^preview_[0-9]+_[a-z0-9]+$/.test(id)) return await rawGet(id, null);
    return await rawGet(KEYS.LAST_PREVIEW_DATA, null);
  }

  AMTool.storage = {
    KEYS,
    DEFAULT_SETTINGS,
    getSettings,
    updateSettings,
    saveEmergencyLocalDraft,
    getEmergencyLocalDraft,
    clearEmergencyLocalDraft,
    saveLiveDraft,
    getLiveDrafts,
    clearLiveDraft,
    moveLiveDraft,
    upsertPromptHistory,
    getPromptHistory,
    deletePromptHistoryItem,
    clearPromptHistory,
    getTemplates,
    addTemplate,
    deleteTemplate,
    getAggregatedChats,
    addChatToAggregation,
    moveAggregatedChat,
    removeAggregatedChat,
    clearAggregatedChats,
    cacheConversation,
    getCachedConversations,
    deleteCachedConversation,
    clearCachedConversations,
    setLastPreviewData,
    getLastPreviewData
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
