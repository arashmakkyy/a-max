/*!
 * A.max — Background Service Worker (Manifest V3)
 * Created by Arash Makki | Released under the MIT License
 */
importScripts(
  '../shared/platforms.js',
  '../shared/i18n.js',
  '../shared/persian-utils.js',
  '../shared/storage.js'
);

const MENU_IDS = {
  ROOT: 'am_tool_root',
  EXPORT_PDF: 'am_tool_export_pdf',
  EXPORT_WORD: 'am_tool_export_word',
  EXPORT_MD: 'am_tool_export_md',
  EXPORT_PNG: 'am_tool_export_png',
  OPEN_PREVIEW: 'am_tool_open_preview',
  ADD_SIDEPANEL: 'am_tool_add_sidepanel',
  FIX_PERSIAN_BIDI: 'am_tool_fix_persian_bidi'
};

/**
 * One Studio tab per hand-off: the id selects the record this tab may read and
 * the tab id lets Studio offer "recapture" for dock-triggered previews.
 */
function studioUrl(handoffId, tabId) {
  const params = new URLSearchParams();
  const id = String(handoffId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (id) params.set('id', id);
  if (Number.isInteger(tabId) && tabId >= 0) params.set('tab', String(tabId));
  const suffix = params.toString() ? '?' + params.toString() : '';
  return chrome.runtime.getURL('dist/index.html#studio' + suffix);
}

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IDS.ROOT,
      title: 'A.max — جعبه ابزار هوش مصنوعی (Arash Makki)',
      contexts: ['page', 'selection', 'editable']
    });
    chrome.contextMenus.create({
      id: MENU_IDS.OPEN_PREVIEW,
      parentId: MENU_IDS.ROOT,
      title: 'پیش‌نمایش زنده و انتخاب پیام‌ها (Custom Export)',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: MENU_IDS.EXPORT_PDF,
      parentId: MENU_IDS.ROOT,
      title: 'خروجی سریع PDF از کل گفتگو',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: MENU_IDS.EXPORT_WORD,
      parentId: MENU_IDS.ROOT,
      title: 'خروجی سریع Word (Docx) از کل گفتگو',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: MENU_IDS.EXPORT_MD,
      parentId: MENU_IDS.ROOT,
      title: 'خروجی سریع Markdown از کل گفتگو',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: MENU_IDS.EXPORT_PNG,
      parentId: MENU_IDS.ROOT,
      title: 'ذخیره کل گفتگو به صورت تصویر (PNG)',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: MENU_IDS.ADD_SIDEPANEL,
      parentId: MENU_IDS.ROOT,
      title: 'افزودن گفتگو به پنل تجمیع (SidePanel)',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: MENU_IDS.FIX_PERSIAN_BIDI,
      parentId: MENU_IDS.ROOT,
      title: 'اصلاح فوری راست‌چین، دوجهته و نیم‌فاصله فارسی',
      contexts: ['page', 'selection', 'editable']
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  setupContextMenus();
  const settings = await self.AMTool.storage.getSettings();
  await self.AMTool.storage.updateSettings(settings);
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) return;
    const actionMap = {
      [MENU_IDS.OPEN_PREVIEW]: 'OPEN_PREVIEW_STUDIO',
      [MENU_IDS.EXPORT_PDF]: 'QUICK_EXPORT_PDF',
      [MENU_IDS.EXPORT_WORD]: 'QUICK_EXPORT_WORD',
      [MENU_IDS.EXPORT_MD]: 'QUICK_EXPORT_MD',
      [MENU_IDS.EXPORT_PNG]: 'QUICK_EXPORT_PNG',
      [MENU_IDS.ADD_SIDEPANEL]: 'ADD_TO_SIDEPANEL',
      [MENU_IDS.FIX_PERSIAN_BIDI]: 'FIX_PERSIAN_NOW'
    };
    const cmd = actionMap[info.menuItemId];
    if (cmd) {
      chrome.tabs.sendMessage(tab.id, { type: cmd }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === 'AM_DOWNLOAD') {
    const base64 = String(msg.base64 || '');
    if (!base64) {
      sendResponse({ ok: false, error: 'EMPTY_FILE' });
      return false;
    }
    const filename = String(msg.filename || 'a-max-export')
      .split('/')
      .pop()
      .replace(/[\\/:*?"<>|]+/g, '-');
    const dataUrl = `data:${msg.mime || 'application/octet-stream'};base64,${base64}`;
    chrome.downloads.download({ url: dataUrl, filename, saveAs: false }, (id) => {
      const error = chrome.runtime.lastError;
      sendResponse(error ? { ok: false, error: error.message } : { ok: true, id });
    });
    return true;
  }

  if (msg.type === 'AM_OPEN_PRINT_TAB') {
    const key = String(msg.key || '');
    if (!key) {
      sendResponse({ ok: false, error: 'MISSING_KEY' });
      return false;
    }
    const url = chrome.runtime.getURL('src/print/print.html') + '?key=' + encodeURIComponent(key);
    chrome.tabs.create({ url }).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }

  if (msg.type === 'OPEN_PREVIEW_PAGE') {
    chrome.tabs.create({ url: studioUrl(msg.handoffId, sender?.tab?.id) });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'AM_OPEN_STUDIO') {
    chrome.tabs.create({ url: studioUrl(msg.handoffId, sender?.tab?.id) }).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }

  if (msg.type === 'OPEN_SIDEPANEL') {
    if (chrome.sidePanel && chrome.sidePanel.open && sender?.tab?.windowId) {
      chrome.sidePanel
        .open({ windowId: sender.tab.windowId })
        .then(() => sendResponse({ ok: true }))
        .catch(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL('dist/index.html#sidepanel') });
          sendResponse({ ok: true });
        });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('dist/index.html#sidepanel') });
      sendResponse({ ok: true });
    }
    return true;
  }

  if (msg.type === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'PROMPT_DRAFT_UPDATED') {
    if (sender?.tab?.id && chrome.action && chrome.action.setBadgeText) {
      const hasDraft = Boolean(msg.hasDraft);
      chrome.action.setBadgeText({
        tabId: sender.tab.id,
        // A small dot marks "a draft is stored for this tab"; the full word
        // covered the icon and implied the export had already finished.
        text: hasDraft ? '●' : ''
      });
      if (hasDraft) {
        chrome.action.setBadgeBackgroundColor({
          tabId: sender.tab.id,
          color: '#0F766E'
        });
        if (chrome.action.setBadgeTextColor) {
          chrome.action.setBadgeTextColor({ tabId: sender.tab.id, color: '#FFFFFF' });
        }
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
