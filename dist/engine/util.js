/*!
 * Arash Chat Exporter — shared utilities
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.util) return;

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string" && value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  /** 2026-11-03_14-05-09 */
  function dateStamp(value, withTime) {
    const d = toDate(value);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (withTime === false) return date;
    return `${date}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  }

  /** ISO date without timezone noise */
  function isoStamp(value) {
    const d = toDate(value);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())}`;
  }

  /** Human readable, localized (Persian by default) */
  function humanDate(value, locale) {
    const d = toDate(value);
    try {
      return d.toLocaleString(locale || "fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStamp(d);
    }
  }

  function relativeTime(value) {
    const then = toDate(value).getTime();
    const diff = Date.now() - then;
    if (!Number.isFinite(diff)) return "";
    const min = Math.round(diff / 60000);
    if (min < 1) return "همین حالا";
    if (min < 60) return `${min} دقیقه پیش`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `${hours} ساعت پیش`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} روز پیش`;
    return humanDate(then);
  }

  const INVALID_FILENAME = /[\\/:*?"<>|\u0000-\u001F]/g;
  const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  function slugify(text, max) {
    const limit = max || 70;
    let out = String(text == null ? "" : text)
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(INVALID_FILENAME, "-")
      .replace(/\s+/g, " ")
      .replace(/^[\s.\-]+|[\s.\-]+$/g, "")
      .slice(0, limit)
      .trim();
    if (!out) out = "conversation";
    if (RESERVED_NAMES.test(out)) out = `_${out}`;
    return out;
  }

  function ensureExtension(filename, ext) {
    const suffix = ext.startsWith(".") ? ext : `.${ext}`;
    return filename.toLowerCase().endsWith(suffix.toLowerCase()) ? filename : filename + suffix;
  }

  function guessTitleFromUrl(url) {
    try {
      const u = new URL(url);
      const last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
      return last.length > 2 ? last.replace(/[-_]+/g, " ") : u.hostname.replace(/^www\./, "");
    } catch {
      return "conversation";
    }
  }

  function safeFolder(folder) {
    return String(folder || "")
      .split(/[\\/]+/)
      .map((part) => slugify(part, 40))
      .filter(Boolean)
      .join("/");
  }

  function debounce(fn, wait) {
    let timer = null;
    let lastArgs = null;
    const wrapped = function (...args) {
      lastArgs = args;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(this, lastArgs);
      }, wait);
    };
    wrapped.flush = function () {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        fn.apply(this, lastArgs || []);
      }
    };
    wrapped.cancel = function () {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    return wrapped;
  }

  function throttle(fn, wait) {
    let last = 0;
    let timer = null;
    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          last = Date.now();
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  function deepMerge(base, patch) {
    if (Array.isArray(base)) return Array.isArray(patch) ? patch.slice() : base;
    if (base && typeof base === "object") {
      const out = { ...base };
      if (patch && typeof patch === "object" && !Array.isArray(patch)) {
        for (const key of Object.keys(patch)) {
          out[key] = key in base ? deepMerge(base[key], patch[key]) : patch[key];
        }
      }
      return out;
    }
    return patch === undefined ? base : patch;
  }

  let uidCounter = 0;
  function uid(prefix) {
    uidCounter = (uidCounter + 1) % 10000;
    return `${prefix || "id"}_${Date.now().toString(36)}${uidCounter.toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = globalThis.getComputedStyle ? getComputedStyle(el) : null;
    if (style) {
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    }
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (rect && (rect.width === 0 || rect.height === 0)) return false;
    return true;
  }

  const textOf = (el) => (el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : "");

  function sortByDocumentOrder(nodes) {
    return nodes.slice().sort((a, b) => {
      if (a === b) return 0;
      const relation = a.compareDocumentPosition(b);
      if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through to legacy path */
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
      (document.body || document.documentElement).appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  /**
   * Saves a text file. In extension pages the downloads API is used so the
   * configured sub-folder is respected; inside content scripts (where the
   * downloads API is unavailable) a blob anchor is used instead.
   */
  async function download(content, filename, mime) {
    const type = mime || "text/plain;charset=utf-8";
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const chromeApi = globalThis.chrome;

    if (chromeApi && chromeApi.downloads && chromeApi.downloads.download) {
      try {
        const id = await new Promise((resolve, reject) => {
          chromeApi.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
            const error = chromeApi.runtime && chromeApi.runtime.lastError;
            if (error) reject(new Error(error.message));
            else resolve(downloadId);
          });
        });
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return { ok: true, id, filename };
      } catch {
        /* fall back to the anchor below */
      }
    }

    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename.split("/").pop() || filename;
      anchor.rel = "noopener";
      anchor.style.display = "none";
      (document.body || document.documentElement).appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    return { ok: true, id: null, filename };
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function truncate(text, limit) {
    const value = String(text || "");
    if (value.length <= limit) return value;
    return value.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
  }

  function countWords(text) {
    const value = String(text || "").trim();
    if (!value) return 0;
    return value.split(/\s+/).length;
  }

  function byteSize(text) {
    try {
      return new Blob([text]).size;
    } catch {
      return String(text || "").length;
    }
  }

  function formatBytes(bytes) {
    const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"];
    let value = Number(bytes) || 0;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    const fixed = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${fixed} ${units[unit]}`;
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  AX.util = {
    escapeHtml,
    toDate,
    dateStamp,
    isoStamp,
    humanDate,
    relativeTime,
    slugify,
    ensureExtension,
    guessTitleFromUrl,
    safeFolder,
    debounce,
    throttle,
    deepMerge,
    uid,
    isVisible,
    textOf,
    sortByDocumentOrder,
    copyText,
    download,
    sleep,
    truncate,
    countWords,
    byteSize,
    formatBytes,
    escapeRegExp,
  };
})();
