/*!
 * A.max — Persian RTL, BiDi Isolation & Orthography Utilities
 * Created by Arash Makki | Released under the MIT License
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});

  const PERSIAN_CHAR_REGEX = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const PERSIAN_GLOBAL_REGEX = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const LATIN_GLOBAL_REGEX = /[A-Za-z]/g;

  // Detect whether a block of text should be right-aligned RTL even when it begins with an English technical term.
  function isPersianDominantOrMixed(text) {
    if (!text || typeof text !== 'string') return false;
    const stripped = text.replace(/```[\s\S]*?```/g, '').replace(/https?:\/\/\S+/g, '');
    const faMatches = stripped.match(PERSIAN_GLOBAL_REGEX);
    if (!faMatches || faMatches.length === 0) return false;
    const enMatches = stripped.match(LATIN_GLOBAL_REGEX);
    const faCount = faMatches.length;
    const enCount = enMatches ? enMatches.length : 0;
    // Any sentence with at least 2 Persian characters or >= 15% Persian ratio is treated as an RTL Persian sentence.
    return faCount >= 2 && (enCount === 0 || faCount / (faCount + enCount) >= 0.12);
  }

  function hasPersian(text) {
    return PERSIAN_CHAR_REGEX.test(text || '');
  }

  // Convert Arabic Yeh/Kaf variants and tatweel to standard Persian Unicode characters.
  function normalizeYeKe(text) {
    if (!text) return '';
    return text
      .replace(/[\u064A\u0649\u06CC\uFEF1\uFEF2]/g, '\u06CC') // ی
      .replace(/[\u0643\u06A9\uFED9\uFEDA]/g, '\u06A9')       // ک
      .replace(/\u06C0/g, '\u0647\u0654')                     // هٔ
      .replace(/\u200C{2,}/g, '\u200C');                      // collapse duplicate ZWNJ
  }

  // Insert Zero-Width Non-Joiner (ZWNJ / نیم‌فاصله) in common Persian verb prefixes and plural/comparative suffixes.
  function fixPersianHalfSpaces(text) {
    if (!text) return '';
    let out = normalizeYeKe(text);
    out = out.replace(/(^|[\s،؛.؟!«(])(ن?می)\s+([\u0600-\u06FF]{2,})/g, '$1$2\u200C$3');
    out = out.replace(/([\u0600-\u06FF])\s+(ها(?:ی(?:ی|م|ت|ش|مان|تان|شان)?)?)(?=[\s،؛.؟!»):]|$)/g, '$1\u200C$2');
    out = out.replace(/([\u0600-\u06FF])\s+(تری?ن?)(?=[\s،؛.؟!»):]|$)/g, '$1\u200C$2');
    out = out.replace(/(ه)\s+(ام|ای|ایم|اید|اند)(?=[\s،؛.؟!»):]|$)/g, '$1\u200C$2');
    out = out.replace(/\s+([،؛؟!])/g, '$1');
    return out;
  }

  function toPersianDigits(text) {
    if (text === null || text === undefined) return '';
    const faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(text)
      .replace(/[0-9]/g, (d) => faDigits[Number(d)])
      .replace(/[\u0660-\u0669]/g, (d) => faDigits[d.charCodeAt(0) - 0x0660]);
  }

  function toEnglishDigits(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  }

  // Wrap inline Latin/technical tokens inside a Persian line with Unicode Left-to-Right Isolate (LRI \u2066 ... PDI \u2069)
  // so English words with punctuation, versions (v4.6.1), or paths (/api/v1) never invert surrounding Persian words.
  function isolateBiDiTextForExport(text) {
    if (!text || !hasPersian(text)) return text || '';
    const lines = text.split('\n');
    let inCodeFence = false;
    return lines
      .map((line) => {
        if (/^\s*```/.test(line)) {
          inCodeFence = !inCodeFence;
          return line;
        }
        if (inCodeFence) return line;
        if (!hasPersian(line)) return line;
        return line.replace(/(`[^`]+`|[A-Za-z0-9_./:@+-]*[A-Za-z][A-Za-z0-9_./:@+-]*)/g, (match) => {
          return '\u2066' + match + '\u2069';
        });
      })
      .join('\n');
  }

  // Apply non-destructive DOM attributes and CSS classes to fix mixed Persian/English layout in AI chat pages.
  function fixElementBiDi(rootEl, options) {
    if (!rootEl || rootEl.nodeType !== 1) return 0;
    const opts = Object.assign({ applyFont: true }, options);
    let fixedCount = 0;

    const codeBlocks = rootEl.querySelectorAll('pre, pre code, .katex, .katex-display, mjx-container, .math-block, .cm-editor');
    codeBlocks.forEach((el) => {
      if (el.getAttribute('data-am-ltr') !== '1') {
        el.setAttribute('dir', 'ltr');
        el.setAttribute('data-am-ltr', '1');
        fixedCount++;
      }
    });

    const inlineCodes = rootEl.querySelectorAll(':not(pre) > code, kbd, samp');
    inlineCodes.forEach((el) => {
      if (el.getAttribute('data-am-inline-code') !== '1') {
        el.setAttribute('dir', 'ltr');
        el.setAttribute('data-am-inline-code', '1');
        fixedCount++;
      }
    });

    const blocks = rootEl.querySelectorAll(
      'p, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, td, th, dd, dt, [data-message-author-role], .markdown, .prose, .ds-markdown, .query-text, .model-response-text'
    );
    blocks.forEach((el) => {
      if (el.closest('pre, code, .katex, mjx-container, [data-am-ui="1"]')) return;
      const text = el.textContent || '';
      if (!text.trim()) return;

      if (isPersianDominantOrMixed(text)) {
        if (el.getAttribute('data-am-bidi') !== 'rtl') {
          el.setAttribute('dir', 'rtl');
          el.setAttribute('data-am-bidi', 'rtl');
          if (opts.applyFont) {
            el.classList.add('am-persian-typography');
          }
          fixedCount++;
        }
      } else if (!hasPersian(text) && el.getAttribute('data-am-bidi') !== 'ltr') {
        el.setAttribute('dir', 'ltr');
        el.setAttribute('data-am-bidi', 'ltr');
      }
    });

    return fixedCount;
  }

  AMTool.persian = {
    hasPersian,
    isPersianDominantOrMixed,
    normalizeYeKe,
    fixPersianHalfSpaces,
    toPersianDigits,
    toEnglishDigits,
    isolateBiDiTextForExport,
    fixElementBiDi
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
