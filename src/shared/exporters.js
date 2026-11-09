/*!
 * A.max — Local Multi-Format Chat Export Engine (PDF, Word, Markdown, PNG, JSON, TXT, HTML, CSV, Notion)
 * Created by Arash Makki | Released under the MIT License
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});

  const THEMES = {
    light: {
      id: 'light',
      nameFa: 'روشن (Light)',
      nameEn: 'Light',
      bg: '#FFFFFF',
      pageBg: '#F6F5F1',
      cardUserBg: '#F0FDF9',
      cardAssistantBg: '#FFFFFF',
      text: '#15171A',
      textMuted: '#525860',
      border: '#DCD9D0',
      accent: '#0F766E',
      codeBg: '#16191D',
      codeText: '#E6EDF3'
    },
    dark: {
      id: 'dark',
      nameFa: 'تیره (Dark)',
      nameEn: 'Dark',
      bg: '#16191E',
      pageBg: '#0E1013',
      cardUserBg: '#162927',
      cardAssistantBg: '#1D2128',
      text: '#ECEEF2',
      textMuted: '#9BA3AE',
      border: '#2D333B',
      accent: '#14B8A6',
      codeBg: '#0B0D10',
      codeText: '#E6EDF3'
    },
    note: {
      id: 'note',
      nameFa: 'دفترچه یادداشت (Note)',
      nameEn: 'Note',
      bg: '#FFFEF5',
      pageBg: '#F5F2E4',
      cardUserBg: '#F7F3DF',
      cardAssistantBg: '#FFFEF8',
      text: '#1E293B',
      textMuted: '#64748B',
      border: '#E5DEC9',
      accent: '#B45309',
      codeBg: '#1E293B',
      codeText: '#F8FAFC'
    },
    old_paper: {
      id: 'old_paper',
      nameFa: 'کاغذ کاهی (Old Paper)',
      nameEn: 'Old Paper',
      bg: '#F4ECD8',
      pageBg: '#E8DEC3',
      cardUserBg: '#EADFC5',
      cardAssistantBg: '#F7F0DF',
      text: '#3B2816',
      textMuted: '#6E5236',
      border: '#D2C19E',
      accent: '#8B4513',
      codeBg: '#2C1E12',
      codeText: '#F4ECD8'
    },
    sakura: {
      id: 'sakura',
      nameFa: 'شکوفه (Sakura)',
      nameEn: 'Sakura',
      bg: '#FFF7FA',
      pageBg: '#FCE8EF',
      cardUserBg: '#FDECF2',
      cardAssistantBg: '#FFFFFF',
      text: '#4A1D2F',
      textMuted: '#834A60',
      border: '#F3C6D6',
      accent: '#BE185D',
      codeBg: '#2D121E',
      codeText: '#FCE7F3'
    },
    blue_mist: {
      id: 'blue_mist',
      nameFa: 'مه آبی (Blue Mist)',
      nameEn: 'Blue Mist',
      bg: '#F4F8FB',
      pageBg: '#E6EEF5',
      cardUserBg: '#E3EFF8',
      cardAssistantBg: '#FFFFFF',
      text: '#0F172A',
      textMuted: '#475569',
      border: '#CBD5E1',
      accent: '#0369A1',
      codeBg: '#0F172A',
      codeText: '#E2E8F0'
    },
    fresh_green: {
      id: 'fresh_green',
      nameFa: 'سبز ملایم (Fresh Green)',
      nameEn: 'Fresh Green',
      bg: '#F3FAF6',
      pageBg: '#E3F3EA',
      cardUserBg: '#E1F5EA',
      cardAssistantBg: '#FFFFFF',
      text: '#143323',
      textMuted: '#3F6852',
      border: '#BFE3CE',
      accent: '#15803D',
      codeBg: '#0F291C',
      codeText: '#DCFCE7'
    },
    lavender: {
      id: 'lavender',
      nameFa: 'اسطوخودوس (Lavender)',
      nameEn: 'Lavender',
      bg: '#F8F6FC',
      pageBg: '#EDE8F7',
      cardUserBg: '#EDE7F8',
      cardAssistantBg: '#FFFFFF',
      text: '#26183D',
      textMuted: '#5C4B78',
      border: '#D6CBEB',
      accent: '#6D28D9',
      codeBg: '#1C122E',
      codeText: '#EDE9FE'
    }
  };

  function sanitizeFilenameSegment(str) {
    if (!str) return '';
    return String(str)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function formatDateForFilename(ts) {
    const d = ts ? new Date(ts) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      '-' +
      pad(d.getHours()) +
      pad(d.getMinutes())
    );
  }

  function formatReadableDate(ts) {
    const d = ts ? new Date(ts) : new Date();
    try {
      return d.toLocaleString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  function buildExportFilename(chatData, ext, formatPattern) {
    const pattern = formatPattern || 'ai_title_datetime';
    const partsMap = {
      ai: sanitizeFilenameSegment(chatData?.platformName || chatData?.platformId || 'AI'),
      title: sanitizeFilenameSegment(chatData?.title || 'conversation'),
      datetime: formatDateForFilename(chatData?.createdAt || Date.now())
    };
    const tokens = pattern.split('_').map((k) => partsMap[k]).filter(Boolean);
    const base = tokens.length > 0 ? tokens.join('_') : 'A.max_export_' + partsMap.datetime;
    return ext ? base + '.' + ext.replace(/^\./, '') : base;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Convert rich HTML message content to clean Markdown while preserving code blocks, tables, links, and math.
  function htmlToMarkdown(html, rawTextFallback) {
    if (!html) return rawTextFallback || '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString('<div>' + html + '</div>', 'text/html');
      const root = doc.body.firstElementChild || doc.body;

      root.querySelectorAll('script, style, button, svg, .am-single-export-wrap').forEach((el) => el.remove());

      function walk(node) {
        if (!node) return '';
        if (node.nodeType === 3) {
          return node.nodeValue || '';
        }
        if (node.nodeType !== 1) return '';

        const tag = node.tagName.toLowerCase();

        if (tag === 'pre') {
          const codeEl = node.querySelector('code');
          const langClass = (codeEl?.className || node.className || '').match(/language-([a-zA-Z0-9_+-]+)/);
          const lang = langClass ? langClass[1] : '';
          const codeText = (codeEl || node).textContent || '';
          return '\n\n```' + lang + '\n' + codeText.replace(/\n$/, '') + '\n```\n\n';
        }

        if (tag === 'code') {
          const txt = node.textContent || '';
          return '`' + txt.replace(/`/g, '\\`') + '`';
        }

        if (tag === 'br') return '\n';
        if (tag === 'hr') return '\n\n---\n\n';

        if (/^h[1-6]$/.test(tag)) {
          const level = Number(tag[1]);
          const hashes = '#'.repeat(level);
          return '\n\n' + hashes + ' ' + childText(node).trim() + '\n\n';
        }

        if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
          const inner = childText(node).trim();
          if (!inner) return '';
          if (tag === 'p') return '\n\n' + inner + '\n\n';
          return '\n' + inner + '\n';
        }

        if (tag === 'strong' || tag === 'b') {
          const inner = childText(node).trim();
          return inner ? '**' + inner + '**' : '';
        }

        if (tag === 'em' || tag === 'i') {
          const inner = childText(node).trim();
          return inner ? '*' + inner + '*' : '';
        }

        if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          const label = childText(node).trim() || href;
          return href ? '[' + label + '](' + href + ')' : label;
        }

        if (tag === 'img') {
          const src = node.getAttribute('src') || '';
          const alt = node.getAttribute('alt') || 'image';
          return src ? '\n![' + alt + '](' + src + ')\n' : '';
        }

        if (tag === 'blockquote') {
          const lines = childText(node).trim().split('\n');
          return '\n\n' + lines.map((l) => '> ' + l).join('\n') + '\n\n';
        }

        if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(node.children).filter((c) => c.tagName.toLowerCase() === 'li');
          const rendered = items.map((li, idx) => {
            const prefix = tag === 'ol' ? idx + 1 + '. ' : '- ';
            return prefix + childText(li).trim().replace(/\n+/g, '\n   ');
          });
          return '\n\n' + rendered.join('\n') + '\n\n';
        }

        if (tag === 'table') {
          const rows = Array.from(node.querySelectorAll('tr'));
          if (rows.length === 0) return '';
          const matrix = rows.map((tr) =>
            Array.from(tr.querySelectorAll('th, td')).map((cell) =>
              childText(cell).trim().replace(/\|/g, '\\|').replace(/\n+/g, ' ')
            )
          );
          const colCount = Math.max(...matrix.map((r) => r.length), 1);
          const normalized = matrix.map((r) => {
            while (r.length < colCount) r.push('');
            return '| ' + r.join(' | ') + ' |';
          });
          const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
          normalized.splice(1, 0, sep);
          return '\n\n' + normalized.join('\n') + '\n\n';
        }

        return childText(node);
      }

      function childText(parent) {
        let out = '';
        parent.childNodes.forEach((c) => {
          out += walk(c);
        });
        return out;
      }

      const md = childText(root)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return md || rawTextFallback || '';
    } catch (e) {
      return rawTextFallback || '';
    }
  }

  // Convert Markdown/plain text into clean, BiDi-aware HTML for PDF, Word, HTML, and Image rendering.
  function renderMessageBodyHtml(msg, settings) {
    const persian = AMTool.persian;
    let bodyText = msg.markdown || msg.content || '';
    const isRtl = persian ? persian.isPersianDominantOrMixed(bodyText) : false;

    const codeBlocks = [];
    let safe = escapeHtml(bodyText);

    // Extract fenced code blocks first so they remain strictly LTR and untouched by inline replacements.
    safe = safe.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      const langBadge = lang ? `<div class="am-code-lang" dir="ltr">${lang}</div>` : '';
      codeBlocks.push(
        `<div class="am-code-wrap" dir="ltr">${langBadge}<pre class="am-code-pre" dir="ltr"><code dir="ltr">${code}</code></pre></div>`
      );
      return `@@AM_CODE_BLOCK_${idx}@@`;
    });

    // Inline code with BiDi isolation so English identifiers inside Persian sentences never invert word order.
    safe = safe.replace(/`([^`\n]+)`/g, '<code class="am-inline-code" dir="ltr">$1</code>');

    safe = safe
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" dir="ltr">$1</a>');

    const paragraphs = safe
      .split(/\n{2,}/)
      .map((para) => {
        const trimmed = para.trim();
        if (!trimmed) return '';
        if (/^@@AM_CODE_BLOCK_\d+@@$/.test(trimmed)) return trimmed;
        const pRtl = persian ? persian.isPersianDominantOrMixed(trimmed) : isRtl;
        const dirAttr = pRtl ? 'rtl' : 'ltr';
        if (/^<h[1-3]>/.test(trimmed)) {
          return `<div dir="${dirAttr}" class="am-heading-wrap">${trimmed}</div>`;
        }
        return `<p dir="${dirAttr}" class="am-msg-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('\n');

    let finalHtml = paragraphs;
    codeBlocks.forEach((blockHtml, idx) => {
      finalHtml = finalHtml.replace(`@@AM_CODE_BLOCK_${idx}@@`, blockHtml);
    });

    let thinkingHtml = '';
    if (settings?.includeThinkingContent && msg.thinking && msg.thinking.trim()) {
      const thinkRtl = persian ? persian.isPersianDominantOrMixed(msg.thinking) : false;
      thinkingHtml = `
        <details class="am-thinking-box" dir="${thinkRtl ? 'rtl' : 'ltr'}" open>
          <summary>${AMTool.i18n ? AMTool.i18n.t('preview.includeThinking') : 'Thinking Process'}</summary>
          <div class="am-thinking-body">${escapeHtml(msg.thinking).replace(/\n/g, '<br/>')}</div>
        </details>
      `;
    }

    return thinkingHtml + finalHtml;
  }

  function toMarkdown(chatData, settings) {
    const cfg = Object.assign({}, AMTool.storage?.DEFAULT_SETTINGS || {}, settings || {});
    const lines = [];
    const title = chatData?.title || 'AI Conversation';
    lines.push('# ' + title);
    lines.push('');

    const metaParts = [];
    if (chatData?.platformName) metaParts.push('**پلتفرم / Platform:** ' + chatData.platformName);
    if (cfg.showMessageTimestamp) {
      metaParts.push('**تاریخ / Date:** ' + formatReadableDate(chatData?.createdAt || Date.now()));
    }
    if (cfg.includeSourceUrl && chatData?.url) {
      metaParts.push('**منبع / Source:** ' + chatData.url);
    }
    if (metaParts.length > 0) {
      lines.push(metaParts.join(' | '));
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const messages = chatData?.messages || [];
    messages.forEach((msg, index) => {
      const roleTitle = msg.role === 'user' ? 'پرسش کاربر (User)' : 'پاسخ هوش مصنوعی (' + (chatData?.platformName || 'Assistant') + ')';
      const timeSuffix = cfg.showMessageTimestamp && msg.timestamp ? ` — *${msg.timestamp}*` : '';
      lines.push(`## ${index + 1}. ${roleTitle}${timeSuffix}`);
      lines.push('');
      if (cfg.includeThinkingContent && msg.thinking && msg.thinking.trim()) {
        lines.push('<details><summary>فرآیند تفکر مدل (Thinking Process)</summary>');
        lines.push('');
        lines.push(msg.thinking.trim());
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
      const rawBody = (msg.markdown || msg.content || '').trim();
      const body = AMTool.persian ? AMTool.persian.isolateBiDiTextForExport(rawBody) : rawBody;
      lines.push(body);
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    if (cfg.appendBranding) {
      lines.push(`*${cfg.customBrandingText || 'Exported with A.max — Created by Arash Makki (MIT License)'}*`);
    }

    return lines.join('\n');
  }

  function toPlainText(chatData, settings) {
    const cfg = Object.assign({}, AMTool.storage?.DEFAULT_SETTINGS || {}, settings || {});
    const lines = [];
    lines.push('==================================================');
    lines.push(chatData?.title || 'AI Conversation');
    if (chatData?.platformName) lines.push('Platform: ' + chatData.platformName);
    if (cfg.includeSourceUrl && chatData?.url) lines.push('URL: ' + chatData.url);
    lines.push('Date: ' + formatReadableDate(chatData?.createdAt || Date.now()));
    lines.push('==================================================');
    lines.push('');

    (chatData?.messages || []).forEach((msg, idx) => {
      const roleLabel = msg.role === 'user' ? '[کاربر / USER]' : '[هوش مصنوعی / ASSISTANT]';
      lines.push(`${idx + 1}. ${roleLabel}${cfg.showMessageTimestamp && msg.timestamp ? ' (' + msg.timestamp + ')' : ''}`);
      lines.push('--------------------------------------------------');
      if (cfg.includeThinkingContent && msg.thinking && msg.thinking.trim()) {
        lines.push('[فرآیند تفکر / Thinking]:');
        lines.push(msg.thinking.trim());
        lines.push('');
      }
      lines.push((msg.content || msg.markdown || '').trim());
      lines.push('');
    });

    if (cfg.appendBranding) {
      lines.push('--------------------------------------------------');
      lines.push(cfg.customBrandingText || 'Created with A.max by Arash Makki (MIT License)');
    }
    return lines.join('\n');
  }

  function toJSON(chatData, settings) {
    const cfg = Object.assign({}, AMTool.storage?.DEFAULT_SETTINGS || {}, settings || {});
    const payload = {
      generator: 'A.max',
      author: 'Arash Makki',
      license: 'MIT',
      exportedAt: new Date().toISOString(),
      platformId: chatData?.platformId || 'unknown',
      platformName: chatData?.platformName || 'AI',
      title: chatData?.title || 'Conversation',
      sourceUrl: cfg.includeSourceUrl ? chatData?.url || '' : undefined,
      messageCount: (chatData?.messages || []).length,
      messages: (chatData?.messages || []).map((m, i) => ({
        index: i + 1,
        id: m.id || 'msg_' + (i + 1),
        role: m.role,
        timestamp: cfg.showMessageTimestamp ? m.timestamp || null : undefined,
        thinking: cfg.includeThinkingContent && m.thinking ? m.thinking : undefined,
        content: m.content || '',
        markdown: m.markdown || m.content || ''
      }))
    };
    return JSON.stringify(payload, null, 2);
  }

  function toCSV(chatData, settings) {
    const cfg = Object.assign({}, AMTool.storage?.DEFAULT_SETTINGS || {}, settings || {});
    const escapeCsv = (val) => '"' + String(val || '').replace(/"/g, '""') + '"';
    const rows = [['Index', 'Role', 'Platform', 'Timestamp', 'Content']];
    (chatData?.messages || []).forEach((m, i) => {
      rows.push([
        i + 1,
        m.role,
        chatData?.platformName || chatData?.platformId || 'AI',
        cfg.showMessageTimestamp ? m.timestamp || '' : '',
        m.content || m.markdown || ''
      ]);
    });
    // Prepend UTF-8 BOM so Excel opens Persian characters properly.
    return '\uFEFF' + rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');
  }

  function toStyledHTML(chatData, settings, forPrintPdf) {
    const cfg = Object.assign({}, AMTool.storage?.DEFAULT_SETTINGS || {}, settings || {});
    const theme = THEMES[cfg.exportTheme] || THEMES.light;
    const fontSizeMap = { small: '13.5px', medium: '15px', large: '17px' };
    const baseFontSize = fontSizeMap[cfg.exportFontSize] || '15px';
    const tableBorderStyle =
      cfg.exportTableStyle === 'none'
        ? 'none'
        : cfg.exportTableStyle === 'dashed'
        ? '1px dashed ' + theme.border
        : '1px solid ' + theme.border;

    const persian = AMTool.persian;
    const titleIsRtl = persian ? persian.isPersianDominantOrMixed(chatData?.title || 'گفتگو') : true;

    const messagesHtml = (chatData?.messages || [])
      .map((msg, i) => {
        const isUser = msg.role === 'user';
        const roleBadge = isUser
          ? AMTool.i18n?.t('role.user') || 'کاربر'
          : chatData?.platformName || AMTool.i18n?.t('role.assistant') || 'هوش مصنوعی';
        const msgRtl = persian ? persian.isPersianDominantOrMixed(msg.content || msg.markdown || '') : true;
        const timeHtml =
          cfg.showMessageTimestamp && msg.timestamp
            ? `<span class="am-msg-time">${escapeHtml(msg.timestamp)}</span>`
            : '';

        return `
          <article class="am-msg-card ${isUser ? 'am-msg-user' : 'am-msg-assistant'}" dir="${msgRtl ? 'rtl' : 'ltr'}">
            <header class="am-msg-header">
              <span class="am-msg-role">${i + 1}. ${escapeHtml(roleBadge)}</span>
              ${timeHtml}
            </header>
            <div class="am-msg-body">
              ${renderMessageBodyHtml(msg, cfg)}
            </div>
          </article>
        `;
      })
      .join('\n');

    const watermarkText = escapeHtml(
      cfg.pdfWatermarkText || cfg.customBrandingText || 'A.max • Created by Arash Makki (MIT License)'
    );

    const printScript = forPrintPdf
      ? `<script>
          window.addEventListener('load', function() {
            setTimeout(function() { window.print(); }, 350);
          });
        </script>`
      : '';

    return `<!DOCTYPE html>
<html lang="${titleIsRtl ? 'fa' : 'en'}" dir="${titleIsRtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(chatData?.title || 'A.max Export')}</title>
  <style>
    @page {
      size: ${cfg.pdfFormat || 'A4'} ${cfg.pdfOrientation || 'portrait'};
      margin: ${cfg.pdfMarginTop ?? 10}mm ${cfg.pdfMarginRight ?? 10}mm ${cfg.pdfMarginBottom ?? 14}mm ${cfg.pdfMarginLeft ?? 10}mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: ${forPrintPdf ? '0' : '28px 16px'};
      background: ${forPrintPdf ? theme.bg : theme.pageBg};
      color: ${theme.text};
      font-family: ${cfg.exportFontFamily || "'Vazirmatn', 'IRANSansX', 'Tahoma', system-ui, -apple-system, sans-serif"};
      font-size: ${baseFontSize};
      line-height: 1.8;
    }
    .am-export-container {
      max-width: ${forPrintPdf ? '100%' : cfg.exportWidth || '840px'};
      margin: 0 auto;
      background: ${theme.bg};
      border: ${forPrintPdf ? 'none' : '1px solid ' + theme.border};
      border-radius: 8px;
      padding: ${forPrintPdf ? '8px' : '28px'};
      transform: scale(${forPrintPdf ? cfg.pdfScale || 1 : 1});
      transform-origin: top center;
    }
    .am-doc-header {
      border-bottom: 2px solid ${theme.accent};
      padding-bottom: 14px;
      margin-bottom: 22px;
    }
    .am-doc-title {
      margin: 0 0 8px 0;
      font-size: 1.45em;
      font-weight: 700;
      color: ${theme.text};
    }
    .am-doc-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      font-size: 0.82em;
      color: ${theme.textMuted};
    }
    .am-doc-meta a {
      color: ${theme.accent};
      text-decoration: none;
    }
    .am-msg-card {
      background: ${theme.cardAssistantBg};
      border: 1px solid ${theme.border};
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .am-msg-user {
      background: ${theme.cardUserBg};
      border-inline-start: 4px solid ${theme.accent};
    }
    .am-msg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid ${theme.border};
      font-size: 0.85em;
      font-weight: 600;
      color: ${theme.accent};
    }
    .am-msg-time {
      font-weight: 400;
      color: ${theme.textMuted};
      direction: ltr;
    }
    .am-msg-p {
      margin: 0 0 10px 0;
      unicode-bidi: plaintext;
    }
    .am-msg-p:last-child {
      margin-bottom: 0;
    }
    .am-inline-code {
      direction: ltr !important;
      unicode-bidi: isolate !important;
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(127, 127, 127, 0.15);
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      font-size: 0.88em;
    }
    .am-code-wrap {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: isolate !important;
      margin: 12px 0;
      border-radius: 6px;
      overflow: hidden;
      background: ${theme.codeBg};
      color: ${theme.codeText};
      border: 1px solid ${theme.border};
    }
    .am-code-lang {
      padding: 4px 12px;
      font-size: 11px;
      font-family: monospace;
      background: rgba(255, 255, 255, 0.06);
      color: #9BA3AE;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .am-code-pre {
      margin: 0;
      padding: 12px 14px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.86em;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .am-thinking-box {
      margin-bottom: 12px;
      padding: 10px 14px;
      border-radius: 6px;
      background: rgba(127, 127, 127, 0.08);
      border-inline-start: 3px solid ${theme.textMuted};
      font-size: 0.9em;
      color: ${theme.textMuted};
    }
    .am-thinking-box summary {
      cursor: pointer;
      font-weight: 600;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    th, td {
      border: ${tableBorderStyle};
      padding: 8px 10px;
    }
    .am-doc-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid ${theme.border};
      display: flex;
      justify-content: space-between;
      font-size: 0.78em;
      color: ${theme.textMuted};
    }
  </style>
</head>
<body>
  <div class="am-export-container">
    <header class="am-doc-header" dir="${titleIsRtl ? 'rtl' : 'ltr'}">
      <h1 class="am-doc-title">${escapeHtml(chatData?.title || 'گفتگوی هوش مصنوعی')}</h1>
      <div class="am-doc-meta">
        <span>پلتفرم: <strong>${escapeHtml(chatData?.platformName || 'AI')}</strong></span>
        <span>تعداد پیام‌ها: <strong>${(chatData?.messages || []).length}</strong></span>
        <span>تاریخ خروجی: <strong>${escapeHtml(formatReadableDate(Date.now()))}</strong></span>
        ${cfg.includeSourceUrl && chatData?.url ? `<a href="${escapeHtml(chatData.url)}" target="_blank" dir="ltr">${escapeHtml(chatData.url)}</a>` : ''}
      </div>
    </header>
    <main class="am-messages-list">
      ${messagesHtml}
    </main>
    ${
      cfg.appendBranding
        ? `<footer class="am-doc-footer" dir="ltr">
            <span>${watermarkText}</span>
<span>A.max v1.2.0 - Open Source (MIT)</span>
          </footer>`
        : ''
    }
  </div>
  ${printScript}
</body>
</html>`;
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }

  async function exportMarkdown(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const md = toMarkdown(chatData, cfg);
    const filename = buildExportFilename(chatData, 'md', cfg.exportFilenameFormat);
    const blob = new Blob(['\uFEFF' + md], { type: 'text/markdown;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return filename;
  }

  async function exportText(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const txt = toPlainText(chatData, cfg);
    const filename = buildExportFilename(chatData, 'txt', cfg.exportFilenameFormat);
    const blob = new Blob(['\uFEFF' + txt], { type: 'text/plain;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return filename;
  }

  async function exportJSON(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const json = toJSON(chatData, cfg);
    const filename = buildExportFilename(chatData, 'json', cfg.exportFilenameFormat);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return filename;
  }

  async function exportCSV(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const csv = toCSV(chatData, cfg);
    const filename = buildExportFilename(chatData, 'csv', cfg.exportFilenameFormat);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return filename;
  }

  async function exportHTML(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const html = toStyledHTML(chatData, cfg, false);
    const filename = buildExportFilename(chatData, 'html', cfg.exportFilenameFormat);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return filename;
  }

  // Generate a Word-compatible rich RTL/BiDi document (.doc / Word HTML with MSO RTL directives so Word opens mixed Persian/English cleanly).
  async function exportWordDocx(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const htmlBody = toStyledHTML(chatData, cfg, false);
    const wordXmlHeader =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml></head>';
    const wordDocContent = htmlBody.replace(/<!DOCTYPE html>\s*<html[^>]*>\s*<head>/i, wordXmlHeader);
    const filename = buildExportFilename(chatData, 'doc', cfg.exportFilenameFormat);
    const blob = new Blob(['\uFEFF' + wordDocContent], {
      type: 'application/msword;charset=utf-8'
    });
    triggerBlobDownload(blob, filename);
    return filename;
  }

  // Render full vector PDF locally via browser print engine with custom page size, margins, and Persian BiDi layout.
  async function exportPDF(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const html = toStyledHTML(chatData, cfg, true);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=960,height=800');
    if (!win) {
      // Fallback if popup blocked: use hidden iframe print
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {}
        setTimeout(() => iframe.remove(), 4000);
      }, 600);
    }
    return true;
  }

  // Render full conversation to a high-DPI PNG image using Canvas 2D with Persian RTL & BiDi support.
  async function exportPNGImage(chatData, settings) {
    const cfg = Object.assign({}, await AMTool.storage.getSettings(), settings || {});
    const theme = THEMES[cfg.exportTheme] || THEMES.light;
    const persian = AMTool.persian;

    const width = 860;
    const pad = 36;
    const contentWidth = width - pad * 2;
    const lineHeight = 28;

    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');
    const fontStack = "15px 'Vazirmatn', 'Tahoma', system-ui, sans-serif";
    const boldFontStack = "bold 16px 'Vazirmatn', 'Tahoma', system-ui, sans-serif";
    const titleFontStack = "bold 22px 'Vazirmatn', 'Tahoma', system-ui, sans-serif";

    function wrapTextLines(ctx, text, maxWidth, font) {
      ctx.font = font;
      const rawLines = String(text || '').split('\n');
      const wrapped = [];
      for (const rawLine of rawLines) {
        if (!rawLine.trim()) {
          wrapped.push('');
          continue;
        }
        const words = rawLine.split(' ');
        let current = '';
        for (const word of words) {
          const testLine = current ? current + ' ' + word : word;
          if (ctx.measureText(testLine).width > maxWidth && current) {
            wrapped.push(current);
            current = word;
          } else {
            current = testLine;
          }
        }
        if (current) wrapped.push(current);
      }
      return wrapped;
    }

    const blocks = (chatData?.messages || []).map((msg, idx) => {
      const roleLabel =
        (idx + 1) +
        '. ' +
        (msg.role === 'user'
          ? AMTool.i18n?.t('role.user') || 'کاربر'
          : chatData?.platformName || AMTool.i18n?.t('role.assistant') || 'هوش مصنوعی');
      const bodyText = (msg.content || msg.markdown || '').trim();
      const isRtl = persian ? persian.isPersianDominantOrMixed(bodyText) : true;
      const lines = wrapTextLines(mCtx, bodyText, contentWidth - 40, fontStack);
      const cardHeight = 46 + lines.length * lineHeight + 20;
      return {
        isUser: msg.role === 'user',
        roleLabel,
        timestamp: cfg.showMessageTimestamp ? msg.timestamp || '' : '',
        isRtl,
        lines,
        cardHeight
      };
    });

    const headerHeight = 96;
    const footerHeight = cfg.appendBranding ? 54 : 20;
    const totalCardsHeight = blocks.reduce((acc, b) => acc + b.cardHeight + 16, 0);
    const totalHeight = Math.min(16000, headerHeight + totalCardsHeight + footerHeight + pad * 2);

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, totalHeight);

    const titleRtl = persian ? persian.isPersianDominantOrMixed(chatData?.title || '') : true;
    ctx.font = titleFontStack;
    ctx.fillStyle = theme.text;
    ctx.direction = titleRtl ? 'rtl' : 'ltr';
    ctx.textAlign = titleRtl ? 'right' : 'left';
    ctx.fillText(
      (chatData?.title || 'گفتگوی هوش مصنوعی').slice(0, 75),
      titleRtl ? width - pad : pad,
      pad + 26
    );

    ctx.font = "13px 'Vazirmatn', 'Tahoma', sans-serif";
    ctx.fillStyle = theme.textMuted;
    const metaStr = `${chatData?.platformName || 'AI'} • ${(chatData?.messages || []).length} پیام • ${formatReadableDate(Date.now())}`;
    ctx.fillText(metaStr, titleRtl ? width - pad : pad, pad + 54);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, pad + 70);
    ctx.lineTo(width - pad, pad + 70);
    ctx.stroke();

    let y = pad + headerHeight;
    for (const block of blocks) {
      if (y + block.cardHeight > totalHeight - footerHeight) break;

      ctx.fillStyle = block.isUser ? theme.cardUserBg : theme.cardAssistantBg;
      ctx.strokeStyle = theme.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(pad, y, contentWidth, block.cardHeight, 8);
      } else {
        ctx.rect(pad, y, contentWidth, block.cardHeight);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = boldFontStack;
      ctx.fillStyle = theme.accent;
      ctx.direction = block.isRtl ? 'rtl' : 'ltr';
      ctx.textAlign = block.isRtl ? 'right' : 'left';
      ctx.fillText(
        block.roleLabel,
        block.isRtl ? width - pad - 18 : pad + 18,
        y + 28
      );

      ctx.font = fontStack;
      ctx.fillStyle = theme.text;
      let lineY = y + 58;
      for (const line of block.lines) {
        const lineRtl = persian ? persian.isPersianDominantOrMixed(line) : block.isRtl;
        ctx.direction = lineRtl ? 'rtl' : 'ltr';
        ctx.textAlign = lineRtl ? 'right' : 'left';
        ctx.fillText(line, lineRtl ? width - pad - 18 : pad + 18, lineY);
        lineY += lineHeight;
      }

      y += block.cardHeight + 16;
    }

    if (cfg.appendBranding) {
      ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = theme.textMuted;
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.fillText(
        cfg.customBrandingText || 'Exported with A.max — Created by Arash Makki (MIT License)',
        width / 2,
        totalHeight - 24
      );
    }

    const filename = buildExportFilename(chatData, 'png', cfg.exportFilenameFormat);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) triggerBlobDownload(blob, filename);
        resolve(filename);
      }, 'image/png');
    });
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  }

  AMTool.exporters = {
    THEMES,
    buildExportFilename,
    htmlToMarkdown,
    toMarkdown,
    toPlainText,
    toJSON,
    toCSV,
    toStyledHTML,
    exportMarkdown,
    exportText,
    exportJSON,
    exportCSV,
    exportHTML,
    exportWordDocx,
    exportPDF,
    exportPNGImage,
    copyToClipboard
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
