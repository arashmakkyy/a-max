/*!
 * A.max — Export Engine Bridge
 * Bridges A.max's chat model to the full-fidelity exporter engine
 * (DOM extraction, Markdown/HTML/PDF, real OOXML .docx, long-image PNG).
 * Created by Arash Makki | Released under the MIT License
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});
  const AX = global.AX;

  const THEME_MAP = {
    light: 'light',
    dark: 'dark',
    note: 'note',
    old_paper: 'old-paper',
    sakura: 'sakura',
    blue_mist: 'blue-mist',
    fresh_green: 'fresh-green',
    lavender: 'lavender'
  };

  /**
   * The adapter only forwards evidence it actually found. Anything else stays
   * `unknown` all the way into the exported file; roles are never guessed from
   * the message order and are never coerced to `assistant`.
   */
  const ROLE_MAP = {
    user: 'user',
    human: 'user',
    me: 'user',
    assistant: 'assistant',
    ai: 'assistant',
    model: 'assistant',
    bot: 'assistant',
    system: 'system',
    tool: 'tool',
    function: 'tool',
    unknown: 'unknown',
    '': 'unknown'
  };

  function normalizeRole(role) {
    const key = String(role == null ? '' : role).trim().toLowerCase();
    return ROLE_MAP[key] || 'unknown';
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function engineDoc(chat) {
    const messages = (chat && chat.messages) || [];
    return {
      title: (chat && chat.title) || 'گفتگوی هوش مصنوعی',
      url: (chat && chat.url) || '',
      site: (chat && (chat.platformName || chat.platformId)) || 'AI',
      siteId: (chat && chat.platformId) || 'ai',
      model: (chat && chat.model) || '',
      createdAt: (chat && chat.createdAt) || '',
      exportedAt: nowIso(),
      messages: messages.map((msg, index) => ({
        index,
        role: normalizeRole(msg.role),
        markdown: String(msg.markdown || msg.content || ''),
        text: String(msg.content || msg.markdown || ''),
        model: msg.model || '',
        createdAt: msg.sentAt || msg.timestamp || ''
      }))
    };
  }

  function chatFromEngine(conversation) {
    if (!conversation) return null;
    const messages = (conversation.messages || []).map((msg, index) => ({
      id: msg.id || 'msg_' + (index + 1),
      role: normalizeRole(msg.role),
      content: String(msg.text || msg.markdown || ''),
      markdown: String(msg.markdown || msg.text || ''),
      thinking: msg.thinking || '',
      timestamp: msg.createdAt || null,
      sentAt: msg.createdAt || null,
      capturedAt: conversation.exportedAt || nowIso()
    }));
    return {
      platformId: conversation.siteId || 'ai',
      platformName: conversation.site || 'AI',
      title: conversation.title || 'گفتگوی هوش مصنوعی',
      url: conversation.url || '',
      model: conversation.model || '',
      createdAt: Date.now(),
      capturedAt: conversation.exportedAt || nowIso(),
      extractionStatus: messages.length
        ? (messages.some((message) => message.role === 'unknown') ? 'partial' : 'complete')
        : 'unsupported',
      messages
    };
  }

  function options(settings) {
    const cfg = settings || {};
    const language = cfg.language === 'en' ? 'en' : 'fa';
    return {
      language,
      includeMeta: true,
      includeTimestamps: cfg.showMessageTimestamp !== false,
      includeModel: true,
      includeNumbers: true,
      includeIcons: true,
      includeThinking: cfg.includeThinkingContent !== false,
      frontMatter: false,
      filenameTemplate: '{site}-{title}-{date}',
      subfolder: 'A.max Exports',
      theme: THEME_MAP[cfg.exportTheme] || 'light',
      customPrefix: '',
      pdf: {
        pageSize: cfg.pdfFormat || 'A4',
        orientation: cfg.pdfOrientation === 'landscape' ? 'landscape' : 'portrait',
        marginTop: 12,
        marginRight: 12,
        marginBottom: 14,
        marginLeft: 12,
        scale: Math.round((Number(cfg.pdfScale) || 1) * 100),
        pageNumbers: cfg.pdfShowPageNumbers !== false,
        printBackground: true,
        watermark: false,
        watermarkText: cfg.pdfWatermarkText || ''
      }
    };
  }

  function imageOptions(settings) {
    const cfg = settings || {};
    return {
      theme: THEME_MAP[cfg.exportTheme] || 'light',
      width: 980,
      fontSize: 16,
      scale: 1.5,
      includeMeta: true,
      showNumbers: true
    };
  }

  function normalizeFilename(name) {
    return String(name || 'a-max-export').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  }

  // Engine filenames may include a download subfolder; keep only the file name
  // because chrome.downloads already receives a flat name from this bridge.
  function basename(name) {
    const last = String(name || '').split('/').pop();
    return normalizeFilename(last || 'a-max-export');
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsDataURL(blob);
    });
  }

  async function downloadBlob(blob, filename, mime) {
    const name = normalizeFilename(String(filename || 'export').split('/').pop());
    const type = mime || blob.type || 'application/octet-stream';
    const chromeApi = global.chrome;

    const canUseDownloads = Boolean(chromeApi && chromeApi.downloads && chromeApi.downloads.download);

    // Extension pages (popup / preview / side panel) download through the API
    // using a data URL, so the file survives the popup being closed.
    if (canUseDownloads && blob.size <= 64 * 1024 * 1024) {
      try {
        const base64 = await blobToBase64(blob);
        const dataUrl = `data:${type};base64,${base64}`;
        await new Promise((resolve, reject) => {
          chromeApi.downloads.download({ url: dataUrl, filename: name, saveAs: false }, (id) => {
            const error = chromeApi.runtime && chromeApi.runtime.lastError;
            if (error) reject(new Error(error.message));
            else resolve(id);
          });
        });
        return { ok: true, filename: name };
      } catch (error) {
        /* fall through to the service-worker / anchor paths */
      }
    }

    // Content scripts ask the service worker to perform the download.
    if (chromeApi && chromeApi.runtime && chromeApi.runtime.id) {
      try {
        if (blob.size < 16 * 1024 * 1024) {
          const base64 = await blobToBase64(blob);
          const response = await new Promise((resolve) => {
            chromeApi.runtime.sendMessage(
              { type: 'AM_DOWNLOAD', base64, mime: type, filename: name },
              (res) => {
                void (chromeApi.runtime && chromeApi.runtime.lastError);
                resolve(res || null);
              }
            );
          });
          if (response && response.ok) return { ok: true, filename: name };
        }
      } catch (error) {
        /* fall back to the anchor below */
      }
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    (document.body || document.documentElement).appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { ok: true, filename: name };
  }

  /**
   * `exportAs` may only report success when the file was actually handed to the
   * browser. A failed download is returned as a failure so the UI can offer a
   * retry instead of showing a success toast.
   */
  async function saveOrFail(blob, filename, mime) {
    const result = await downloadBlob(blob, filename, mime);
    if (!result || result.ok === false) {
      return { ok: false, error: (result && result.error) || 'DOWNLOAD_FAILED', filename };
    }
    return { ok: true, filename };
  }

  async function openPrint(html, filename) {
    const key = 'am_print_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const payload = { html, filename: normalizeFilename(filename), at: Date.now() };
    const chromeApi = global.chrome;

    if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
      await new Promise((resolve) => {
        chromeApi.storage.local.set({ [key]: payload }, () => {
          void (chromeApi.runtime && chromeApi.runtime.lastError);
          resolve();
        });
      });
      const url = chromeApi.runtime.getURL('src/print/print.html?key=' + encodeURIComponent(key));
      if (chromeApi.tabs && chromeApi.tabs.create) {
        await chromeApi.tabs.create({ url });
        return { ok: true, printTab: true };
      }
      if (chromeApi.runtime && chromeApi.runtime.id) {
        const response = await new Promise((resolve) => {
          chromeApi.runtime.sendMessage({ type: 'AM_OPEN_PRINT_TAB', key }, (res) => {
            void (chromeApi.runtime && chromeApi.runtime.lastError);
            resolve(res || null);
          });
        });
        if (response && response.ok) return { ok: true, printTab: true };
      }
      global.open(url, '_blank');
      return { ok: true, printTab: true };
    }

    const win = global.open('', '_blank');
    if (!win) return { ok: false, error: 'POPUP_BLOCKED' };
    win.document.open();
    win.document.write(html);
    win.document.close();
    return { ok: true, printTab: true };
  }

  async function exportAs(format, chat, settings) {
    if (!AX || !AX.format) throw new Error('موتور خروجی بارگذاری نشده است');
    const doc = engineDoc(chat);
    if (!doc.messages.length) throw new Error('پیامی برای خروجی پیدا نشد');
    const opts = options(settings);

    if (format === 'word' || format === 'docx') {
      if (!AX.docx || !AX.zip) throw new Error('موتور DOCX بارگذاری نشده است');
      const bytes = AX.docx.build(doc, {
        language: opts.language,
        includeMeta: opts.includeMeta,
        includeModel: opts.includeModel
      });
      const filename = basename(AX.format.filename(doc, opts, '.docx'));
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      return saveOrFail(blob, filename, blob.type);
    }

    if (format === 'pdf' || format === 'print') {
      const rendered = AX.format.render(doc, 'pdf', opts);
      const printHtml = String(rendered.content || '').replace(/<script>[\s\S]*?<\/script>/gi, '');
      const pdfName = basename(rendered.filename).replace(/\.html$/i, '.pdf');
      const result = await openPrint(printHtml, pdfName);
      return Object.assign({ filename: pdfName }, result);
    }

    if (format === 'image' || format === 'png') {
      if (!AX.image) throw new Error('موتور تصویر بارگذاری نشده است');
      const rendered = await AX.image.render(doc, imageOptions(settings));
      const base = AX.format
        .filename(doc, opts, '.png')
        .split('/')
        .pop()
        .replace(/\.png$/i, '');
      if (rendered.blobs.length === 1) {
        return saveOrFail(rendered.blobs[0], base + '.png', 'image/png');
      }
      const buffers = await Promise.all(rendered.blobs.map((blob) => blob.arrayBuffer()));
      const entries = buffers.map((buffer, index) => ({
        name: `${base}-${String(index + 1).padStart(3, '0')}.png`,
        data: new Uint8Array(buffer)
      }));
      const bytes = AX.zip.create(entries);
      return saveOrFail(new Blob([bytes], { type: 'application/zip' }), base + '-all-pages.zip', 'application/zip');
    }

    const kindMap = {
      markdown: 'markdown',
      md: 'markdown',
      md_images: 'markdown',
      text: 'text',
      txt: 'text',
      html: 'html',
      json: 'json',
      csv: 'csv'
    };
    const kind = kindMap[format] || 'markdown';
    const rendered = AX.format.render(doc, kind, opts);
    const mime = rendered.mime || 'text/plain;charset=utf-8';
    let filename = basename(rendered.filename);
    if (format === 'md_images' && AX.bundle) {
      const bundle = await AX.bundle.markdownBundle(doc, opts, 'zip');
      const bundleName = basename(bundle.filename);
      return saveOrFail(bundle.blob, bundleName, 'application/zip');
    }
    const blob = new Blob(['\uFEFF' + String(rendered.content || '')], { type: mime });
    return saveOrFail(blob, filename, mime);
  }

  function renderPreview(chat, settings) {
    if (!AX || !AX.format) return '';
    return AX.format.html(engineDoc(chat), options(settings));
  }

  /**
   * Renders the conversation to one PNG and puts it on the clipboard.
   * Multi-part conversations cannot be a single clipboard image, so the caller
   * gets a clear MULTI_PART result instead of silently copying only part of it.
   */
  async function copyImage(chat, settings) {
    if (!AX || !AX.image) throw new Error('موتور تصویر بارگذاری نشده است');
    const doc = engineDoc(chat);
    if (!doc.messages.length) throw new Error('پیامی برای خروجی پیدا نشد');
    const rendered = await AX.image.render(doc, imageOptions(settings));
    if (!rendered || !rendered.blobs || !rendered.blobs.length) {
      return { ok: false, error: 'RENDER_FAILED' };
    }
    if (rendered.blobs.length > 1) return { ok: false, error: 'MULTI_PART' };
    await AX.image.copyToClipboard(rendered.blobs[0]);
    return { ok: true, parts: 1 };
  }

  AMTool.engine = {
    available: Boolean(AX && AX.format),
    engineDoc,
    chatFromEngine,
    options,
    renderPreview,
    exportAs,
    copyImage,
    downloadBlob,
    openPrint
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
