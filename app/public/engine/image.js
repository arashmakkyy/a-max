/*!
 * Arash Chat Exporter — long image / share card renderer
 * Paints the conversation into PNG images using an SVG <foreignObject>, so
 * Persian shaping, tables and code blocks look exactly like the preview.
 * Images inside the chat are embedded as data URLs when the browser allows
 * reading them; otherwise a labelled placeholder is drawn.
 *
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.image) return;

  const U = AX.util;

  const THEMES = {
    light: {
      bg: "#f4f6fb",
      card: "#ffffff",
      user: "#eef4ff",
      text: "#16203a",
      muted: "#6b7280",
      border: "#dfe4f0",
      accent: "#4f46e5",
      accentSoft: "#eef0ff",
      codeBg: "#0f172a",
      codeText: "#e6edf7",
      tableHead: "#eef1f8",
    },
    dark: {
      bg: "#0b1020",
      card: "#141b2d",
      user: "#101a30",
      text: "#e8edf7",
      muted: "#9aa4b8",
      border: "#253049",
      accent: "#8b93ff",
      accentSoft: "#1d2540",
      codeBg: "#070c17",
      codeText: "#dbe6f5",
      tableHead: "#1b2439",
    },
    note: {
      bg: "#fbf7ea",
      card: "#fffdf4",
      user: "#fff8dd",
      text: "#2b2410",
      muted: "#8a7a52",
      border: "#e9dfc2",
      accent: "#b07d2b",
      accentSoft: "#fdf1d3",
      codeBg: "#2b2416",
      codeText: "#f3ead3",
      tableHead: "#f6ecd4",
    },
    sakura: {
      bg: "#fff1f5",
      card: "#ffffff",
      user: "#ffe4ec",
      text: "#3b1b28",
      muted: "#9c6b7e",
      border: "#f6cfdb",
      accent: "#d2568a",
      accentSoft: "#ffe3ec",
      codeBg: "#3a1c2a",
      codeText: "#ffeef4",
      tableHead: "#ffeaf1",
    },
    lavender: {
      bg: "#f4effc",
      card: "#ffffff",
      user: "#efe6fb",
      text: "#2a1f3d",
      muted: "#7d6f95",
      border: "#e0d5f2",
      accent: "#7c5cc4",
      accentSoft: "#efe6fb",
      codeBg: "#241a38",
      codeText: "#f0e9ff",
      tableHead: "#f1eafc",
    },
    "blue-mist": {
      bg: "#e8f0fb",
      card: "#ffffff",
      user: "#e4efff",
      text: "#12233a",
      muted: "#5b7594",
      border: "#cfe0f2",
      accent: "#2563eb",
      accentSoft: "#dbeafe",
      codeBg: "#0b1a2e",
      codeText: "#dbeafe",
      tableHead: "#e8f1fd",
    },
    "fresh-green": {
      bg: "#e9f7f0",
      card: "#ffffff",
      user: "#e4f8ee",
      text: "#10261c",
      muted: "#5c7a6b",
      border: "#cfe9db",
      accent: "#0f9f6e",
      accentSoft: "#d8f5e7",
      codeBg: "#0a2119",
      codeText: "#d9f5e8",
      tableHead: "#e6f6ee",
    },
    "old-paper": {
      bg: "#efe6d3",
      card: "#fbf6e9",
      user: "#f7eed7",
      text: "#3a2c14",
      muted: "#8b7550",
      border: "#ddccab",
      accent: "#8a5a1f",
      accentSoft: "#f2e4c8",
      codeBg: "#3a2c17",
      codeText: "#f3e7cd",
      tableHead: "#f0e3c9",
    },
  };

  const ROLE_LABEL = { user: "کاربر", assistant: "دستیار", system: "سیستم", tool: "ابزار" };
  const ROLE_ICON = { user: "🧑", assistant: "🤖", system: "⚙️", tool: "🛠️" };
  // Unresolved roles stay unresolved in the rendered image as well.
  ROLE_LABEL.unknown = "\u0646\u0627\u0645\u0634\u062e\u0635";
  ROLE_ICON.unknown = "\u2754";

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function css(theme, opts) {
    const size = opts.fontSize || 16;
    return `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: ${theme.bg};
      color: ${theme.text};
      width: ${opts.width}px;
      font-family: "Vazirmatn", "Vazir", "Segoe UI", Tahoma, "Iranian Sans", sans-serif;
      font-size: ${size}px;
      line-height: 1.95;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
    }
    .ax-card {
      width: ${opts.width}px;
      padding: 26px 26px 30px;
    }
    [data-part] { display: flow-root; }
    .ax-head {
      background: ${theme.card};
      border: 1px solid ${theme.border};
      border-radius: 22px;
      padding: 22px 24px;
      margin-bottom: 18px;
    }
    .ax-head h1 {
      margin: 0 0 10px;
      font-size: ${Math.round(size * 1.5)}px;
      line-height: 1.55;
      font-weight: 800;
      letter-spacing: -0.2px;
    }
    .ax-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .ax-chips li {
      background: ${theme.accentSoft};
      color: ${theme.accent};
      border-radius: 999px;
      padding: 2px 10px;
      font-size: ${Math.round(size * 0.78)}px;
      line-height: 1.9;
      white-space: nowrap;
    }
    .ax-msg {
      background: ${theme.card};
      border: 1px solid ${theme.border};
      border-radius: 18px;
      padding: 18px 20px 16px;
      margin-bottom: 14px;
    }
    .ax-msg[data-role="user"] { background: ${theme.user}; }
    .ax-msg-head {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
      margin-bottom: 8px;
      font-size: ${Math.round(size * 0.8)}px;
      color: ${theme.muted};
    }
    .ax-role {
      font-weight: 800;
      color: ${theme.accent};
      background: ${theme.accentSoft};
      border-radius: 999px;
      padding: 1px 10px;
    }
    .ax-body { unicode-bidi: plaintext; text-align: start; overflow-wrap: anywhere; }
    .ax-body > :first-child { margin-top: 0; }
    .ax-body > :last-child { margin-bottom: 0; }
    .ax-body p { margin: 0 0 10px; }
    .ax-body h1, .ax-body h2, .ax-body h3, .ax-body h4 {
      margin: 16px 0 8px; line-height: 1.6; font-weight: 800;
    }
    .ax-body h1 { font-size: ${Math.round(size * 1.35)}px; }
    .ax-body h2 { font-size: ${Math.round(size * 1.2)}px; }
    .ax-body h3 { font-size: ${Math.round(size * 1.08)}px; }
    .ax-body h4 { font-size: ${size}px; }
    .ax-body a { color: ${theme.accent}; text-decoration: underline; text-underline-offset: 2px; }
    .ax-body ul, .ax-body ol { margin: 0 0 10px; padding-inline-start: 24px; }
    .ax-body li { margin: 3px 0; }
    .ax-body li.task { list-style: none; margin-inline-start: -20px; }
    .ax-body blockquote {
      margin: 10px 0; padding: 8px 14px;
      border-inline-start: 3px solid ${theme.accent};
      background: ${theme.accentSoft};
      border-radius: 10px;
    }
    .ax-body hr { border: 0; border-top: 1px solid ${theme.border}; margin: 16px 0; }
    .ax-body code {
      direction: ltr; unicode-bidi: isolate;
      font-family: "JetBrains Mono", "Cascadia Code", Consolas, monospace;
      font-size: 0.86em;
      background: ${theme.tableHead};
      border: 1px solid ${theme.border};
      border-radius: 6px;
      padding: 1px 5px;
    }
    .ax-body pre {
      direction: ltr; text-align: left; unicode-bidi: isolate;
      background: ${theme.codeBg};
      color: ${theme.codeText};
      padding: 14px 16px;
      border-radius: 12px;
      margin: 10px 0;
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "JetBrains Mono", "Cascadia Code", Consolas, monospace;
      font-size: ${Math.round(size * 0.82)}px;
    }
    .ax-body pre code { background: none; border: 0; padding: 0; color: inherit; font-size: inherit; }
    .ax-body img { max-width: 100%; height: auto; border-radius: 12px; margin: 6px 0; display: block; }
    .ax-img-missing {
      border: 1px dashed ${theme.border};
      border-radius: 12px;
      padding: 14px;
      text-align: center;
      color: ${theme.muted};
      font-size: ${Math.round(size * 0.82)}px;
      background: ${theme.tableHead};
      margin: 6px 0;
    }
    .ax-body table { border-collapse: collapse; width: 100%; font-size: ${Math.round(size * 0.86)}px; margin: 10px 0; }
    .ax-body th, .ax-body td { border: 1px solid ${theme.border}; padding: 6px 10px; text-align: start; }
    .ax-body th { background: ${theme.tableHead}; font-weight: 700; }
    .ax-body mark { background: #fde68a; color: #3f2a05; padding: 0 2px; border-radius: 3px; }
    .ax-foot {
      display: flex; align-items: center; justify-content: space-between;
      color: ${theme.muted};
      font-size: ${Math.round(size * 0.76)}px;
      padding: 6px 4px 0;
    }
    `;
  }

  function headerHtml(doc, opts) {
    const chips = [];
    if (doc.site) chips.push(doc.site);
    if (doc.model) chips.push(doc.model);
    if (opts.includeMeta !== false) {
      if (doc.url) chips.push("لینک گفتگو");
      chips.push(`${doc.messages.length.toLocaleString("fa-IR")} پیام`);
      chips.push(U.isoStamp(doc.exportedAt));
    }
    return `<section class="ax-head"><h1>${U.escapeHtml(doc.title || "گفتگو")}</h1>${
      chips.length
        ? `<ul class="ax-chips">${chips.map((chip) => `<li>${U.escapeHtml(chip)}</li>`).join("")}</ul>`
        : ""
    }</section>`;
  }

  function messageHtml(message, index, opts) {
    const label = ROLE_LABEL[message.role] || ROLE_LABEL.unknown;
    const head = [`<span class="ax-role">${ROLE_ICON[message.role] || ROLE_ICON.unknown} ${label}</span>`];
    if (opts.showNumbers !== false) head.push(`<span>#${index + 1}</span>`);
    if (message.model) head.push(`<span>· ${U.escapeHtml(message.model)}</span>`);
    const body = AX.format.mdToHtml(message.markdown || message.text || "");
    return `<article class="ax-msg" data-role="${escapeAttr(message.role)}"><div class="ax-msg-head">${head.join(
      ""
    )}</div><div class="ax-body" dir="auto">${body}</div></article>`;
  }

  async function inlineImages(html) {
    const sources = Array.from(new Set((html.match(/<img[^>]+src="([^"]+)"/g) || []).map((tag) => {
      const match = tag.match(/src="([^"]+)"/);
      return match ? match[1] : "";
    }).filter(Boolean)));

    const resolved = new Map();
    for (const src of sources) {
      if (/^data:image\//i.test(src)) {
        resolved.set(src, src);
        continue;
      }
      if (!/^https?:\/\//i.test(src)) {
        resolved.set(src, null);
        continue;
      }
      try {
        const response = await fetch(src, { credentials: "omit", mode: "cors" });
        if (!response.ok) throw new Error("bad status");
        const blob = await response.blob();
        if (!/^image\//.test(blob.type)) throw new Error("not an image");
        if (blob.size > 3_000_000) throw new Error("too large");
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(blob);
        });
        resolved.set(src, dataUrl);
      } catch {
        resolved.set(src, null);
      }
    }

    let output = html;
    resolved.forEach((value, src) => {
      const pattern = new RegExp(`<img[^>]*src="${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "g");
      output = output.replace(
        pattern,
        value
          ? `<img src="${value}" alt="">`
          : `<div class="ax-img-missing">🖼 تصویر مهمان (برای درج در تصویر، دسترسی لازم است)</div>`
      );
    });
    return output;
  }

  function svgDocument(innerHtml, width, height, style) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">
      <style>${style}</style>
      ${innerHtml}
    </div>
  </foreignObject>
</svg>`;
  }

  const VOID_TAGS = "br|hr|wbr|col|area|base|embed|param|track|source|input|img|link|meta";

  /**
   * The conversation HTML is produced for a real page, so it contains HTML void
   * tags (`<br>`, `<img …>`). An SVG document is parsed as strict XML, and a
   * single unclosed tag makes the whole picture blank — so every node is
   * serialized through the XML serializer before it goes inside <foreignObject>.
   */
  function xmlSafe(html) {
    try {
      const template = document.createElement("template");
      template.innerHTML = html;
      const xdoc = document.implementation.createDocument("http://www.w3.org/1999/xhtml", "div", null);
      const wrapper = xdoc.documentElement;
      Array.from(template.content.childNodes).forEach((node) => {
        wrapper.appendChild(xdoc.importNode(node, true));
      });
      return new XMLSerializer()
        .serializeToString(wrapper)
        .replace(/^<div[^>]*>/, "")
        .replace(/<\/div>$/, "");
    } catch {
      return String(html).replace(new RegExp(`<(${VOID_TAGS})((?:[^>"']|"[^"]*"|'[^']*')*)>`, "gi"), "<$1$2/>");
    }
  }

  function measure(html, style, width, timeout) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:600px;border:0;visibility:hidden`;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("اندازه‌گیری تصویر زمان‌بر شد."));
      }, timeout || 6000);
      const cleanup = () => {
        clearTimeout(timer);
        frame.remove();
      };
      frame.srcdoc = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>${style}</style></head><body>${html}</body></html>`;
      frame.onload = () => {
        try {
          const doc = frame.contentDocument;
          const nodes = Array.from(doc.querySelectorAll("[data-part]"));
          const heights = nodes.map((node) => {
            const styleRef = doc.defaultView.getComputedStyle(node);
            return (
              node.getBoundingClientRect().height +
              (parseFloat(styleRef.marginTop) || 0) +
              (parseFloat(styleRef.marginBottom) || 0)
            );
          });
          resolve({ heights, total: doc.documentElement.scrollHeight });
        } catch (error) {
          reject(error);
        } finally {
          cleanup();
        }
      };
      frame.onerror = () => {
        cleanup();
        reject(new Error("اندازه‌گیری تصویر ناموفق بود."));
      };
      document.body.appendChild(frame);
    });
  }

  /**
   * Chrome 141+ treats an SVG loaded from a blob: URL as cross-origin, which
   * taints the canvas and makes toBlob() throw a SecurityError. A base64 data
   * URL keeps the image same-origin, so the PNG can be exported again.
   */
  function svgDataUrl(svg) {
    const bytes = new TextEncoder().encode(svg);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    }
    return "data:image/svg+xml;base64," + btoa(binary);
  }

  async function rasterize(svg, width, height, scale) {
    const image = new Image();
    image.decoding = "async";
    image.src = svgDataUrl(svg);
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("ساخت تصویر ناموفق بود."))), "image/png");
    });
  }

  /**
   * @returns {Promise<{blobs: Blob[], width:number, height:number, parts:number}>}
   */
  async function render(doc, options) {
    const opts = {
      theme: "light",
      width: 980,
      fontSize: 16,
      scale: 1.5,
      includeMeta: true,
      showNumbers: true,
      maxPartHeight: 8600,
      ...(options || {}),
    };
    const theme = THEMES[opts.theme] || THEMES.light;
    const style = css(theme, opts);

    const header = headerHtml(doc, opts);
    const messages = doc.messages.map((message, index) => messageHtml(message, index, opts));
    const footer = `<div class="ax-foot"><span>A.max</span><span>© Arash Makki</span></div>`;

    const rawBlocks = [header, ...messages, footer].map(
      (html) => `<div data-part>${html}</div>`
    );

    const prepared = await inlineImages(rawBlocks.join(""));
    const preparedBlocks = prepared.split(/(?=<div data-part>)/).filter(Boolean);
    const measured = await measure(preparedBlocks.join(""), style, opts.width);

    const groups = [];
    let current = [];
    let currentHeight = 0;
    preparedBlocks.forEach((block, index) => {
      const height = measured.heights[index] || 80;
      if (current.length && currentHeight + height > opts.maxPartHeight) {
        groups.push({ blocks: current, height: currentHeight });
        current = [];
        currentHeight = 0;
      }
      current.push(block);
      currentHeight += height;
    });
    if (current.length) groups.push({ blocks: current, height: currentHeight });

    const blobs = [];
    for (const group of groups) {
      const height = Math.max(200, Math.ceil(group.height) + 8);
      const inner = `<div class="ax-card">${group.blocks.join("")}</div>`;
      const svg = svgDocument(xmlSafe(inner), opts.width, height, style);
      // Chrome cannot allocate a canvas taller than 16384px: a single very long
      // message is scaled down instead of producing an empty picture.
      const scale = Math.max(0.75, Math.min(opts.scale, 16000 / height));
      const blob = await rasterize(svg, opts.width, height, scale);
      blobs.push(blob);
    }
    return {
      blobs,
      width: Math.round(opts.width * opts.scale),
      height: Math.round(groups.reduce((sum, group) => sum + group.height, 0) * opts.scale),
      parts: blobs.length,
    };
  }

  async function copyToClipboard(blob) {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error("مرورگر از کپی تصویر پشتیبانی نمی‌کند.");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  }

  AX.image = { THEMES, render, copyToClipboard, inlineImages, measure, xmlSafe, svgDataUrl };
})();
