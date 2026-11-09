/*!
 * Arash Chat Exporter — output formats
 * Markdown, HTML, JSON, plain text, CSV, Word and print/PDF.
 *
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.format) return;

  /** One version string for every generated artifact (JSON, HTML, DOCX, …). */
  const APP_VERSION = "1.2.0";
  AX.version = APP_VERSION;
  AX.generator = "A.max " + APP_VERSION;

  const U = AX.util;

  const LABELS = {
    fa: {
      user: "کاربر",
      assistant: "دستیار",
      system: "سیستم",
      tool: "ابزار",
      unknown: "نامشخص",
      source: "منبع",
      model: "مدل",
      link: "لینک",
      exportedAt: "تاریخ خروجی",
      messages: "تعداد پیام",
      title: "عنوان",
      noMessages: "پیامی برای خروجی پیدا نشد.",
      exportedBy: "خروجی گرفته‌شده با A.max — ساختهٔ Arash Makki",
    },
    en: {
      user: "User",
      assistant: "Assistant",
      system: "System",
      tool: "Tool",
      unknown: "Unknown",
      source: "Source",
      model: "Model",
      link: "Link",
      exportedAt: "Exported",
      messages: "Messages",
      title: "Title",
      noMessages: "No messages were found to export.",
      exportedBy: "Exported with A.max by Arash Makki",
    },
  };

  const ICONS = { user: "🧑", assistant: "🤖", system: "⚙️", tool: "🛠️", unknown: "❔" };

  function labelsFor(language) {
    return LABELS[language] || LABELS.fa;
  }

  function options(overrides) {
    return {
      language: "fa",
      includeMeta: true,
      includeTimestamps: true,
      includeModel: true,
      includeNumbers: true,
      includeIcons: true,
      includeThinking: true,
      frontMatter: false,
      filenameTemplate: "{title}-{date}",
      subfolder: "AmToolExports",
      theme: "light",
      ...(overrides || {})
    };
  }

  // An unresolved role must stay visibly unresolved; falling back to
  // "Assistant" would invent authorship that was never detected.
  const roleLabel = (role, labels) => labels[role] || labels.unknown || role || "Unknown";

  function escapeInline(text) {
    return String(text || "").replace(/([\\`*_[\]<>])/g, "\\$1");
  }

  /**
   * Only allows link and image schemes that are safe inside an exported file.
   * The markdown text comes from web pages, so `javascript:` and `data:` URLs
   * must never reach an href/src attribute unchecked.
   */
  function safeUrl(raw, isImage) {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
    if (isImage && /^data:image\/(?:png|jpe?g|gif|webp);/i.test(value)) return value;
    if (/^(?:\.{0,2}\/|#)/.test(value)) return value;
    return "";
  }

  /* ----------------------------------------------------------------------- */
  /* Markdown                                                                */
  /* ----------------------------------------------------------------------- */

  function markdown(doc, overrides) {
    const opts = options(overrides);
    const labels = labelsFor(opts.language);
    const lines = [];

    if (opts.frontMatter) {
      lines.push("---");
      lines.push(`title: ${JSON.stringify(doc.title || "")}`);
      lines.push(`source: ${doc.url || ""}`);
      lines.push(`site: ${doc.site || ""}`);
      if (doc.model) lines.push(`model: ${doc.model}`);
      lines.push(`exported: ${U.isoStamp(doc.exportedAt)}`);
      lines.push(`messages: ${doc.messages.length}`);
      lines.push(`generator: ${AX.generator}`);
      lines.push("---", "");
    }

    lines.push(`# ${escapeInline(doc.title || labels.title)}`, "");

    if (opts.includeMeta) {
      const meta = [];
      if (doc.site) meta.push(`**${labels.source}:** ${doc.site}`);
      if (doc.model && opts.includeModel) meta.push(`**${labels.model}:** ${doc.model}`);
      if (doc.url) meta.push(`**${labels.link}:** <${doc.url}>`);
      meta.push(`**${labels.exportedAt}:** ${U.isoStamp(doc.exportedAt)}`);
      meta.push(`**${labels.messages}:** ${doc.messages.length}`);
      lines.push(meta.join("  \n"), "");
    }

    if (!doc.messages.length) {
      lines.push(`> ${labels.noMessages}`);
      return lines.join("\n");
    }

    doc.messages.forEach((message, index) => {
      const parts = [];
      if (opts.includeNumbers) parts.push(`${index + 1}.`);
      if (opts.includeIcons) parts.push(ICONS[message.role] || ICONS.unknown);
      parts.push(roleLabel(message.role, labels));
      if (opts.includeModel && message.model) parts.push(`· ${message.model}`);
      if (opts.includeTimestamps && message.createdAt) parts.push(`· ${U.isoStamp(message.createdAt)}`);
      lines.push(`## ${parts.join(" ")}`, "", (message.markdown || "").trim(), "");
      if (index < doc.messages.length - 1) lines.push("---", "");
    });

    lines.push("", `<!-- ${labels.exportedBy} -->`);
    return lines.join("\n").trim() + "\n";
  }

  /* ----------------------------------------------------------------------- */
  /* Markdown → HTML                                                         */
  /* ----------------------------------------------------------------------- */

  function inlineToHtml(text) {
    let out = U.escapeHtml(text);
    const codes = [];

    out = out.replace(/`([^`]+)`/g, (match, code) => {
      codes.push(code);
      return `\u0001${codes.length - 1}\u0001`;
    });

    out = out.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      (match, alt, src, title) => {
        const safe = safeUrl(src, true);
        if (!safe) return alt;
        return `<img src="${safe}" alt="${alt}"${title ? ` title="${title}"` : ""} loading="lazy">`;
      }
    );
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
      const safe = safeUrl(href, false);
      return safe ? `<a href="${safe}" target="_blank" rel="noreferrer noopener">${label}</a>` : label;
    });
    out = out.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noreferrer noopener">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])__([^_]+)__(?=[\s).،؛:!?]|$)/g, "$1<strong>$2</strong>");
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).،؛:!?]|$)/g, "$1<em>$2</em>");
    out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).،؛:!?]|$)/g, "$1<em>$2</em>");
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    out = out.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    out = out.replace(/\u0001(\d+)\u0001/g, (match, index) => `<code>${codes[Number(index)]}</code>`);
    out = out.replace(/\\([\\`*_{}\[\]()#+\-.!|<>~=])/g, "$1");
    return out;
  }

  const indentOf = (line) => (line.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "  ").length;

  function splitTableRow(row) {
    return row
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
  }

  function mdToHtml(markdownText) {
    const lines = String(markdownText || "").replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let index = 0;

    const flush = () => {
      if (!paragraph.length) return;
      const joined = paragraph.slice();
      paragraph = [];
      let body = "";
      joined.forEach((line, i) => {
        const hardBreak = / {2}$/.test(line);
        body += inlineToHtml(line.replace(/ {2}$/, ""));
        if (i < joined.length - 1) body += hardBreak ? "<br>" : " ";
      });
      if (body.trim()) html.push(`<p>${body}</p>`);
    };

    while (index < lines.length) {
      const line = lines[index];

      const fence = line.match(/^\s*(```|~~~)(.*)$/);
      if (fence) {
        flush();
        const marker = fence[1];
        const language = (fence[2] || "").trim().split(/\s+/)[0];
        const buffer = [];
        index += 1;
        while (index < lines.length && !lines[index].trim().startsWith(marker)) {
          buffer.push(lines[index]);
          index += 1;
        }
        index += 1;
        html.push(
          `<pre><code${language ? ` class="language-${U.escapeHtml(language)}"` : ""}>${U.escapeHtml(
            buffer.join("\n")
          )}</code></pre>`
        );
        continue;
      }

      if (!line.trim()) {
        flush();
        index += 1;
        continue;
      }

      const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (heading) {
        flush();
        const level = heading[1].length;
        html.push(`<h${level}>${inlineToHtml(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
        flush();
        html.push("<hr>");
        index += 1;
        continue;
      }

      if (/^\s*>/.test(line)) {
        flush();
        const quoted = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) {
          quoted.push(lines[index].replace(/^\s*>\s?/, ""));
          index += 1;
        }
        html.push(`<blockquote>${mdToHtml(quoted.join("\n"))}</blockquote>`);
        continue;
      }

      if (/\|/.test(line) && index + 1 < lines.length && /^\s*\|?[\s:*-]+\|[\s:*-|]*$/.test(lines[index + 1])) {
        flush();
        const rows = [];
        while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim()) {
          rows.push(lines[index]);
          index += 1;
        }
        const header = splitTableRow(rows[0]);
        const aligns = splitTableRow(rows[1]).map((cell) => {
          if (/^:-+:$/.test(cell)) return "center";
          if (/^-+:$/.test(cell)) return "right";
          if (/^:-+$/.test(cell)) return "left";
          return "";
        });
        const bodyRows = rows.slice(2).map(splitTableRow);
        let table = "<table><thead><tr>";
        header.forEach((cell, i) => {
          table += `<th${aligns[i] ? ` style="text-align:${aligns[i]}"` : ""}>${inlineToHtml(cell)}</th>`;
        });
        table += "</tr></thead><tbody>";
        bodyRows.forEach((row) => {
          table += "<tr>";
          header.forEach((cell, i) => {
            table += `<td${aligns[i] ? ` style="text-align:${aligns[i]}"` : ""}>${inlineToHtml(row[i] || "")}</td>`;
          });
          table += "</tr>";
        });
        table += "</tbody></table>";
        html.push(`<div class="table-wrap">${table}</div>`);
        continue;
      }

      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+/);
      if (listMatch) {
        flush();
        const baseIndent = indentOf(line);
        const ordered = /\d+\./.test(listMatch[2]);
        const items = [];
        while (index < lines.length) {
          const current = lines[index];
          if (!current.trim()) {
            const next = lines[index + 1];
            if (next && indentOf(next) > baseIndent) {
              items.push("");
              index += 1;
              continue;
            }
            break;
          }
          const currentIndent = indentOf(current);
          const marker = current.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
          if (marker && currentIndent === baseIndent) {
            items.push({ content: [marker[3]] });
            index += 1;
            continue;
          }
          if (currentIndent > baseIndent && items.length) {
            const last = items[items.length - 1];
            if (typeof last === "string") {
              items[items.length - 1] = { content: [current.trim()] };
            } else {
              last.content.push(current.replace(new RegExp(`^[ \\t]{0,${baseIndent + 3}}`), ""));
            }
            index += 1;
            continue;
          }
          break;
        }
        let list = ordered ? "<ol>" : "<ul>";
        for (const item of items) {
          if (typeof item === "string") continue;
          const task = item.content[0].match(/^\[( |x|X)\]\s+([\s\S]*)$/);
          let body;
          if (task) {
            const rest = item.content.slice();
            rest[0] = task[2];
            body = mdToHtml(rest.join("\n")).replace(/^<p>([\s\S]*?)<\/p>$/, "$1");
            list += `<li class="task"><label><input type="checkbox" disabled${
              task[1].toLowerCase() === "x" ? " checked" : ""
            }> ${body}</label></li>`;
          } else {
            body = mdToHtml(item.content.join("\n")).replace(/^<p>([\s\S]*?)<\/p>$/, "$1");
            list += `<li>${body}</li>`;
          }
        }
        list += ordered ? "</ol>" : "</ul>";
        html.push(list);
        continue;
      }

      paragraph.push(line);
      index += 1;
    }

    flush();
    return html.join("\n");
  }

  /* ----------------------------------------------------------------------- */
  /* HTML                                                                    */
  /* ----------------------------------------------------------------------- */

  const BASE_CSS = `
    :root {
      --ax-bg: #f5f6fa;
      --ax-card: #ffffff;
      --ax-card-user: #eef2ff;
      --ax-text: #16181d;
      --ax-muted: #6b7280;
      --ax-border: #e3e6ec;
      --ax-accent: #4f46e5;
      --ax-accent-soft: #eef0ff;
      --ax-code-bg: #0f172a;
      --ax-code-text: #e6edf7;
      --ax-inline-code: #f1f2f6;
      color-scheme: light;
    }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      padding: 40px 20px 72px;
      background: var(--ax-bg);
      color: var(--ax-text);
      font-family: "Vazirmatn", "Vazir", "Segoe UI", Tahoma, "Iranian Sans", "Noto Naskh Arabic", sans-serif;
      font-size: 16px;
      line-height: 2;
      direction: rtl;
    }
    .ax-page { max-width: 900px; margin: 0 auto; }
    .ax-header {
      background: var(--ax-card);
      border: 1px solid var(--ax-border);
      border-radius: 20px;
      padding: 26px 28px;
      margin-bottom: 26px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
    }
    .ax-title { margin: 0 0 8px; font-size: 26px; line-height: 1.5; font-weight: 800; }
    .ax-subtitle { margin: 0 0 16px; color: var(--ax-muted); font-size: 14px; }
    .ax-meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .ax-meta li {
      background: var(--ax-accent-soft);
      color: var(--ax-accent);
      border-radius: 999px;
      padding: 3px 12px;
      font-size: 12.5px;
      line-height: 1.9;
    }
    .ax-meta li a { color: inherit; }
    .ax-msg {
      position: relative;
      background: var(--ax-card);
      border: 1px solid var(--ax-border);
      border-radius: 18px;
      padding: 22px 24px 18px;
      margin: 18px 0;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
    }
    .ax-msg[data-role="user"] { background: var(--ax-card-user); border-color: #dfe4ff; }
    .ax-msg-head {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
      font-size: 13px;
      color: var(--ax-muted);
    }
    .ax-role {
      font-weight: 800;
      font-size: 13.5px;
      color: var(--ax-accent);
      background: var(--ax-accent-soft);
      border-radius: 999px;
      padding: 2px 12px;
    }
    .ax-msg[data-role="user"] .ax-role { color: #0f766e; background: #ecfdf5; }
    .ax-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: .5; }
    .ax-body { unicode-bidi: plaintext; text-align: start; overflow-wrap: anywhere; }
    .ax-body > :first-child { margin-top: 0; }
    .ax-body > :last-child { margin-bottom: 0; }
    .ax-body p { margin: 0 0 12px; }
    .ax-body h1, .ax-body h2, .ax-body h3, .ax-body h4, .ax-body h5, .ax-body h6 {
      margin: 22px 0 10px; line-height: 1.6; font-weight: 800;
    }
    .ax-body h1 { font-size: 24px; }
    .ax-body h2 { font-size: 21px; }
    .ax-body h3 { font-size: 18px; }
    .ax-body h4, .ax-body h5, .ax-body h6 { font-size: 16px; }
    .ax-body a { color: var(--ax-accent); text-decoration: underline; text-underline-offset: 3px; }
    .ax-body strong { font-weight: 800; }
    .ax-body ul, .ax-body ol { margin: 0 0 12px; padding-inline-start: 26px; }
    .ax-body li { margin: 4px 0; }
    .ax-body li.task { list-style: none; margin-inline-start: -22px; }
    .ax-body blockquote {
      margin: 14px 0;
      padding: 10px 16px;
      border-inline-start: 3px solid var(--ax-accent);
      background: rgba(79, 70, 229, 0.05);
      border-radius: 10px;
      color: #33384a;
    }
    .ax-body blockquote > :last-child { margin-bottom: 0; }
    .ax-body hr { border: 0; border-top: 1px solid var(--ax-border); margin: 22px 0; }
    .ax-body code {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: "JetBrains Mono", "Cascadia Code", Consolas, monospace;
      font-size: 0.88em;
      background: var(--ax-inline-code);
      border: 1px solid var(--ax-border);
      border-radius: 6px;
      padding: 1px 5px;
    }
    .ax-body pre {
      direction: ltr;
      text-align: left;
      unicode-bidi: isolate;
      background: var(--ax-code-bg);
      color: var(--ax-code-text);
      padding: 16px 18px;
      border-radius: 12px;
      overflow-x: auto;
      margin: 14px 0;
      line-height: 1.7;
      tab-size: 2;
    }
    .ax-body pre code { background: none; border: 0; color: inherit; padding: 0; font-size: 13.5px; }
    .ax-body img { max-width: 100%; height: auto; border-radius: 12px; margin: 8px 0; }
    .ax-table-wrap, .table-wrap { overflow-x: auto; margin: 14px 0; }
    .ax-body table { border-collapse: collapse; width: 100%; font-size: 14px; }
    .ax-body th, .ax-body td { border: 1px solid var(--ax-border); padding: 8px 12px; text-align: start; }
    .ax-body th { background: #f0f2f8; font-weight: 700; }
    .ax-body mark { background: #fef08a; padding: 0 2px; border-radius: 3px; }
    .ax-footer { margin-top: 34px; text-align: center; color: var(--ax-muted); font-size: 12.5px; }
    .ax-empty {
      background: var(--ax-card); border: 1px dashed var(--ax-border);
      border-radius: 16px; padding: 28px; text-align: center; color: var(--ax-muted);
    }
    @media print {
      body { background: #fff; padding: 0; font-size: 12pt; }
      .ax-page { max-width: none; }
      .ax-header, .ax-msg { box-shadow: none; border-radius: 8px; page-break-inside: avoid; }
      .ax-msg { border: 1px solid #d9dce5; }
      .ax-body pre { background: #f6f7fb; color: #10131c; border: 1px solid #dfe3ee; }
      .ax-footer { color: #888; }
      a { color: inherit; text-decoration: none; }
    }
    @media (prefers-color-scheme: dark) {
      body.ax-auto-theme { --ax-bg: #0b0f19; --ax-card: #131926; --ax-card-user: #101a2c; --ax-text: #e7ebf3; --ax-muted: #9aa3b2; --ax-border: #232b3b; --ax-inline-code: #1a2233; --ax-code-bg: #0a0f1a; }
      body.ax-auto-theme .ax-body th { background: #182031; }
      body.ax-auto-theme .ax-body blockquote { color: #c8d1e0; }
    }
  `;

  const PAGE_SIZES = { A4: "A4", A5: "A5", A3: "A3", Letter: "Letter", Legal: "Legal" };

  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function watermarkHtml(text) {
    const label = U.escapeHtml(String(text || "A.max").slice(0, 60));
    const cells = Array.from({ length: 12 }, () => `<span>${label}</span>`).join("");
    return `<div class="ax-watermark" aria-hidden="true">${cells}</div>`;
  }

  /**
   * Print/PDF layout comes from the user's settings: page size, orientation,
   * margins, zoom, page numbers, background graphics and an optional watermark.
   */
  function printCss(pdf) {
    const cfg = pdf || {};
    const size = PAGE_SIZES[cfg.pageSize] || "A4";
    const orientation = cfg.orientation === "landscape" ? "landscape" : "portrait";
    const top = clampNumber(cfg.marginTop, 12, 0, 45);
    const right = clampNumber(cfg.marginRight, 12, 0, 45);
    const bottom = clampNumber(cfg.marginBottom, 12, 0, 45);
    const left = clampNumber(cfg.marginLeft, 12, 0, 45);
    const scale = clampNumber(cfg.scale, 100, 50, 150) / 100;
    const numbers = cfg.pageNumbers !== false;
    return `
    @page {
      size: ${size} ${orientation};
      margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;
      ${numbers ? `@bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #6b7280; }` : ""}
    }
    .ax-watermark { display: none; }
    @media print {
      html { ${cfg.printBackground === false ? "" : "print-color-adjust: exact; -webkit-print-color-adjust: exact;"} }
      body { zoom: ${scale}; }
      .ax-watermark {
        display: grid;
        position: fixed;
        inset: 0;
        grid-template-columns: repeat(2, 1fr);
        align-content: space-around;
        justify-items: center;
        gap: 46px 70px;
        transform: rotate(-28deg) scale(1.25);
        opacity: 0.06;
        z-index: 9999;
        pointer-events: none;
        font-size: 21pt;
        font-weight: 800;
        color: #111827;
      }
    }`;
  }

  function htmlDocument(doc, overrides, flags) {
    const opts = options(overrides);
    const labels = labelsFor(opts.language);
    const autoTheme = opts.theme === "auto";
    const bodyClass = autoTheme ? "ax-auto-theme" : "";
    const printable = flags && flags.print;
    const printStyle = printable ? printCss(opts.pdf) : "";
    const watermark = printable && opts.pdf && opts.pdf.watermark ? watermarkHtml(opts.pdf.watermarkText) : "";

    const metaItems = [];
    if (doc.site) metaItems.push(`<li>${U.escapeHtml(labels.source)}: ${U.escapeHtml(doc.site)}</li>`);
    if (doc.model && opts.includeModel) metaItems.push(`<li>${U.escapeHtml(labels.model)}: ${U.escapeHtml(doc.model)}</li>`);
    if (doc.url) {
      metaItems.push(
        `<li><a href="${U.escapeHtml(doc.url)}" target="_blank" rel="noreferrer noopener">${U.escapeHtml(labels.link)}</a></li>`
      );
    }
    metaItems.push(`<li>${U.escapeHtml(labels.exportedAt)}: ${U.escapeHtml(U.isoStamp(doc.exportedAt))}</li>`);
    metaItems.push(`<li>${U.escapeHtml(labels.messages)}: ${doc.messages.length}</li>`);

    const messagesHtml = doc.messages.length
      ? doc.messages
          .map((message) => {
            const head = [];
            head.push(`<span class="ax-role">${U.escapeHtml(roleLabel(message.role, labels))}</span>`);
            if (opts.includeModel && message.model) {
              head.push(`<span class="ax-dot"></span><span>${U.escapeHtml(message.model)}</span>`);
            }
            if (opts.includeTimestamps && message.createdAt) {
              head.push(`<span class="ax-dot"></span><span>${U.escapeHtml(U.isoStamp(message.createdAt))}</span>`);
            }
            if (opts.includeNumbers) {
              head.push(`<span class="ax-dot"></span><span>#${message.index + 1}</span>`);
            }
            return `<article class="ax-msg" data-role="${U.escapeHtml(message.role)}">
  <div class="ax-msg-head">${head.join("")}</div>
  <div class="ax-body" dir="auto">${mdToHtml(message.markdown || "")}</div>
</article>`;
          })
          .join("\n")
      : `<div class="ax-empty">${U.escapeHtml(labels.noMessages)}</div>`;

    const title = U.escapeHtml(doc.title || "Chat");

    return `<!DOCTYPE html>
<html lang="${opts.language === "en" ? "en" : "fa"}" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${AX.generator} (Arash Makki)">
<title>${title}</title>
<style>${BASE_CSS}${printStyle}</style>
</head>
<body class="${bodyClass}">
${watermark}
<main class="ax-page">
  <header class="ax-header">
    <h1 class="ax-title">${title}</h1>
    ${opts.includeMeta ? `<ul class="ax-meta">${metaItems.join("")}</ul>` : ""}
  </header>
  ${messagesHtml}
  <footer class="ax-footer">${U.escapeHtml(labels.exportedBy)}${
      printable ? "" : " · © Arash Makki"
    }</footer>
</main>
</body>
</html>`;
  }

  function wordDocument(doc, overrides) {
    const opts = options(overrides);
    const labels = labelsFor(opts.language);
    const meta = [doc.site, doc.model, doc.url, U.isoStamp(doc.exportedAt), `${doc.messages.length} ${labels.messages}`]
      .filter(Boolean)
      .map((item) => U.escapeHtml(item))
      .join(" — ");
    const messages = doc.messages
      .map(
        (message) => `<div class="msg ${U.escapeHtml(message.role)}">
  <p class="role">${U.escapeHtml(roleLabel(message.role, labels))}${
          message.model ? ` — ${U.escapeHtml(message.model)}` : ""
        }</p>
  <div class="body">${mdToHtml(message.markdown || "")}</div>
</div>`
      )
      .join("\n");

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${U.escapeHtml(doc.title || "Chat")}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page { size: A4; margin: 2.2cm; }
body { font-family: Tahoma, "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.9; direction: rtl; }
h1 { font-size: 18pt; }
.meta { color: #555; font-size: 9pt; margin-bottom: 18pt; }
.msg { border: 1px solid #ddd; padding: 10pt 12pt; margin: 10pt 0; }
.msg.user { background: #f2f5ff; }
.role { font-weight: bold; color: #3730a3; margin: 0 0 6pt; font-size: 9.5pt; }
.body p { margin: 0 0 8pt; }
pre { direction: ltr; text-align: left; background: #f4f5f8; border: 1px solid #e2e5ee; padding: 8pt; font-family: Consolas, monospace; font-size: 9pt; }
code { font-family: Consolas, monospace; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #ccc; padding: 4pt 6pt; text-align: right; }
blockquote { border-right: 3px solid #4f46e5; margin: 6pt 0; padding: 4pt 10pt; background: #f7f8ff; }
img { max-width: 100%; }
</style>
</head>
<body>
<h1>${U.escapeHtml(doc.title || "Chat")}</h1>
<p class="meta">${meta}</p>
${messages}
<p class="meta">${U.escapeHtml(labels.exportedBy)} — Arash Makki</p>
</body>
</html>`;
  }

  /* ----------------------------------------------------------------------- */
  /* JSON / TXT / CSV                                                        */
  /* ----------------------------------------------------------------------- */

  function json(doc, overrides) {
    const opts = options(overrides);
    const payload = {
      schema: "arash-chat-exporter/v1",
      generator: AX.generator,
      author: "Arash Makki",
      exportedAt: new Date(doc.exportedAt || Date.now()).toISOString(),
      title: doc.title || "",
      url: doc.url || "",
      site: doc.site || "",
      siteId: doc.siteId || "",
      model: doc.model || "",
      language: opts.language,
      messageCount: doc.messages.length,
      messages: doc.messages.map((message) => ({
        index: message.index + 1,
        role: message.role,
        model: message.model || "",
        createdAt: message.createdAt || "",
        content: message.markdown || "",
        text: message.text || message.markdown || "",
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  function text(doc, overrides) {
    const opts = options(overrides);
    const labels = labelsFor(opts.language);
    const lines = [];
    lines.push(doc.title || labels.title, "=".repeat(Math.min(64, (doc.title || "").length || 24)), "");
    if (opts.includeMeta) {
      if (doc.site) lines.push(`${labels.source}: ${doc.site}`);
      if (doc.model && opts.includeModel) lines.push(`${labels.model}: ${doc.model}`);
      if (doc.url) lines.push(`${labels.link}: ${doc.url}`);
      lines.push(`${labels.exportedAt}: ${U.isoStamp(doc.exportedAt)}`);
      lines.push(`${labels.messages}: ${doc.messages.length}`, "");
    }
    const plainOf = AX.extract && AX.extract.toPlain ? AX.extract.toPlain : (value) => value;
    doc.messages.forEach((message, index) => {
      const head = [`[${index + 1}]`, roleLabel(message.role, labels)];
      if (opts.includeModel && message.model) head.push(`(${message.model})`);
      if (opts.includeTimestamps && message.createdAt) head.push(`- ${U.isoStamp(message.createdAt)}`);
      lines.push(head.join(" "), "-".repeat(48), plainOf(message.markdown || ""), "");
    });
    lines.push(labels.exportedBy);
    return lines.join("\n").trim() + "\n";
  }

  function csvCell(value) {
    let textValue = String(value == null ? "" : value);
    // Spreadsheet apps evaluate a cell that starts with =, +, -, @, TAB or CR,
    // even inside quotes (CSV injection). Prefixing an apostrophe keeps user
    // text as text without dropping any content.
    if (/^[\t\r=+\-@]/.test(textValue)) textValue = "'" + textValue;
    return `"${textValue.replace(/"/g, '""')}"`;
  }

  function csv(doc, overrides) {
    const opts = options(overrides);
    const labels = labelsFor(opts.language);
    const rows = [["index", "role", "role_label", "model", "created_at", "content"].map(csvCell).join(",")];
    doc.messages.forEach((message) => {
      rows.push(
        [
          message.index + 1,
          message.role,
          roleLabel(message.role, labels),
          message.model || "",
          message.createdAt || "",
          message.text || message.markdown || "",
        ]
          .map(csvCell)
          .join(",")
      );
    });
    return "\uFEFF" + rows.join("\r\n");
  }

  /* ----------------------------------------------------------------------- */
  /* File naming and dispatcher                                              */
  /* ----------------------------------------------------------------------- */

  function filename(doc, overrides, ext) {
    const opts = options(overrides);
    const stamp = U.dateStamp(doc.exportedAt || Date.now());
    const [datePart, timePart] = stamp.split("_");
    const template = opts.filenameTemplate || "{title}-{date}";
    const name = template
      .replace(/\{title\}/g, doc.title || "chat")
      .replace(/\{site\}/g, doc.site || "")
      .replace(/\{model\}/g, doc.model || "")
      .replace(/\{date\}/g, datePart)
      .replace(/\{time\}/g, (timePart || "").replace(/-/g, ""))
      .replace(/\{messages\}/g, String(doc.messages.length));
    const rawPrefix = String(opts.customPrefix || "").trim();
    const prefix = rawPrefix ? U.slugify(rawPrefix, 30) : "";
    const base = U.slugify(name, 90) || U.slugify(doc.title || "chat", 60);
    const folder = U.safeFolder(opts.subfolder || "");
    return `${folder ? `${folder}/` : ""}${U.ensureExtension(prefix ? `${prefix}-${base}` : base, ext)}`;
  }

  const FORMATS = {
    markdown: { ext: ".md", mime: "text/markdown;charset=utf-8", label: "Markdown" },
    html: { ext: ".html", mime: "text/html;charset=utf-8", label: "HTML" },
    json: { ext: ".json", mime: "application/json;charset=utf-8", label: "JSON" },
    text: { ext: ".txt", mime: "text/plain;charset=utf-8", label: "Text" },
    csv: { ext: ".csv", mime: "text/csv;charset=utf-8", label: "CSV" },
    word: { ext: ".doc", mime: "application/msword;charset=utf-8", label: "Word" },
    pdf: { ext: ".html", mime: "text/html;charset=utf-8", label: "Print / PDF" },
  };

  function render(doc, format, overrides) {
    const opts = options(overrides);
    const kind = FORMATS[format] ? format : "markdown";
    let content = "";
    switch (kind) {
      case "html":
        content = htmlDocument(doc, opts);
        break;
      case "pdf":
        content = htmlDocument(doc, opts, { print: true });
        break;
      case "json":
        content = json(doc, opts);
        break;
      case "text":
        content = text(doc, opts);
        break;
      case "csv":
        content = csv(doc, opts);
        break;
      case "word":
        content = wordDocument(doc, opts);
        break;
      default:
        content = markdown(doc, opts);
    }
    return {
      content,
      mime: FORMATS[kind].mime,
      ext: FORMATS[kind].ext,
      format: kind,
      filename: filename(doc, opts, FORMATS[kind].ext),
    };
  }

  AX.format = {
    FORMATS,
    LABELS,
    markdown,
    html: (doc, opts) => htmlDocument(doc, opts),
    mdToHtml,
    json,
    text,
    csv,
    word: wordDocument,
    render,
    filename,
  };
})();
