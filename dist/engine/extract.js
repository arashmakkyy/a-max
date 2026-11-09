/*!
 * Arash Chat Exporter — DOM → Markdown extractor
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.extract) return;

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "SVG",
    "PATH",
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "OPTION",
    "CANVAS",
    "VIDEO",
    "AUDIO",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "META",
    "LINK",
    "HEAD",
    "TITLE",
    "BASE",
    "SOURCE",
    "TRACK",
    "MAP",
    "AREA",
  ]);

  const SKIP_PATTERN =
    /(^|[\s_-])(copy|copybutton|copy-code|clipboard|toolbar|actions?|action-bar|feedback|thumb|thumbs|avatar|icon|icons|badge|sr-only|screen-reader|visually-hidden|katex-html|mathml|visuallyhidden)([\s_-]|$)/i;

  const THINKING_PATTERN = /(think|thinking|reason|reasoning|thought|chain-of-thought|cot|تفکر|استدلال|فرایند فکر|فرآیند فکر)/i;

  const LABEL_PATTERN =
    /^(you said|chatgpt said|you|assistant|user|claude|gemini|copilot|grok|deepseek|perplexity|qwen|kimi|mistral|model|system)\s*:?\s*$/i;

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hidden) return true;
    if (el.getAttribute("aria-hidden") === "true") return true;
    if (el.hasAttribute("data-ax-skip")) return true;
    const style = el.getAttribute("style") || "";
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return true;

    const className = typeof el.className === "string" ? el.className : "";
    const id = el.id || "";
    const testId = el.getAttribute("data-testid") || "";
    const ariaLabel = el.getAttribute("aria-label") || "";
    const role = el.getAttribute("role") || "";

    if (SKIP_PATTERN.test(className) || SKIP_PATTERN.test(id)) return true;
    if (/(copy|feedback|thumb|share|action)/i.test(testId)) return true;
    if (/^(copy|copy code|edit|share|read aloud|good response|bad response)/i.test(ariaLabel)) return true;
    if (role === "button" && !el.querySelector("img")) return true;
    if (role === "toolbar" || role === "navigation" || role === "menu" || role === "tablist") return true;
    return false;
  }

  function mathOf(el) {
    if (!el || el.nodeType !== 1) return "";
    const classList = el.classList;
    if (classList && (classList.contains("katex") || classList.contains("katex-display"))) {
      const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
      const tex = annotation && annotation.textContent ? annotation.textContent.trim() : "";
      if (tex) {
        const display = classList.contains("katex-display");
        return display ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
      }
    }
    if (el.tagName === "MJX-CONTAINER" || el.tagName === "MATH" || el.tagName === "MATH-FIELD") {
      const annotation = el.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="TeX"]');
      const tex = annotation && annotation.textContent ? annotation.textContent.trim() : "";
      if (tex) {
        const display =
          el.getAttribute("display") === "block" ||
          (el.closest && !!el.closest('[display="block"], .katex-display'));
        return display ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
      }
    }
    return "";
  }

  function escapeText(value) {
    const collapsed = String(value == null ? "" : value).replace(/\s+/g, " ");
    if (!collapsed.trim()) return collapsed ? " " : "";
    return collapsed
      .replace(/\\/g, "\\\\")
      .replace(/([`*_[\]<>])/g, "\\$1")
      .replace(/^(\s*)(#{1,6}\s)/, "$1\\$2")
      .replace(/^(\s*)([-+]|\d+\.)(\s)/, "$1\\$2$3");
  }

  function inlineCode(value) {
    const text = String(value || "").replace(/\n/g, " ");
    const runs = text.match(/`+/g) || [];
    const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
    const fence = "`".repeat(longest + 1);
    const needsPad = /^\s|\s$/.test(text) || text.startsWith("`") || text.endsWith("`");
    return fence + (needsPad ? " " : "") + text + (needsPad ? " " : "") + fence;
  }

  function imageMarkdown(el, opts) {
    if (opts && opts.images === false) return "";
    const src = el.currentSrc || el.src || el.getAttribute("src") || "";
    const alt = (el.getAttribute("alt") || "").replace(/[\[\]]/g, "");
    if (!src) return "";
    if (src.startsWith("data:") && opts && opts.dataImages === false) return "";
    const title = el.getAttribute("title");
    return `![${alt}](${src}${title ? ` "${title.replace(/"/g, "'")}"` : ""})`;
  }

  function renderPre(pre) {
    const codeEl = pre.querySelector("code") || pre;
    const raw = codeEl.innerText || codeEl.textContent || "";
    const text = raw.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
    let language = "";
    const classText = `${codeEl.className || ""} ${pre.className || ""}`;
    const match =
      classText.match(/language-([\w#+.-]+)/i) ||
      classText.match(/lang-([\w#+.-]+)/i) ||
      classText.match(/highlight-source-([\w#+.-]+)/i);
    if (match) language = match[1];
    if (!language) {
      language =
        pre.getAttribute("data-language") ||
        codeEl.getAttribute("data-language") ||
        pre.getAttribute("data-lang") ||
        "";
    }
    if (!language) {
      const header = pre.parentElement && pre.parentElement.querySelector('[class*="language"], [class*="header"]');
      const label = header ? (header.innerText || "").trim() : "";
      if (label && label.length < 20 && /^[a-z][\w#+.-]*$/i.test(label)) language = label;
    }
    language = String(language || "").replace(/[^\w#+.-]/g, "");
    const fence = text.includes("```") ? "~~~" : "```";
    return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
  }

  function renderList(listEl, ctx) {
    const ordered = listEl.tagName === "OL";
    const start = parseInt(listEl.getAttribute("start") || "1", 10) || 1;
    const items = Array.from(listEl.children).filter((child) => child.tagName === "LI");
    const lines = [];

    items.forEach((li, index) => {
      const marker = ordered ? `${start + index}. ` : "- ";
      const indent = " ".repeat(marker.length);
      let content = "";
      const nested = [];
      const checkbox = li.querySelector(':scope > input[type="checkbox"]');
      for (const child of li.childNodes) {
        if (child.nodeType === 1 && (child.tagName === "UL" || child.tagName === "OL")) {
          nested.push(child);
          continue;
        }
        content += renderNode(child, ctx);
      }
      const prefix = checkbox ? (checkbox.checked ? "[x] " : "[ ] ") : "";
      const normalized = content
        .replace(/\n{2,}/g, "\n")
        .replace(/^\n+|\n+$/g, "")
        .trimEnd();
      const parts = normalized.split("\n");
      lines.push(marker + prefix + (parts[0] || ""));
      for (let i = 1; i < parts.length; i += 1) {
        lines.push(indent + parts[i]);
      }
      for (const nestedList of nested) {
        const sub = renderList(nestedList, ctx)
          .replace(/^\n+|\n+$/g, "")
          .split("\n")
          .map((line) => indent + line)
          .join("\n");
        if (sub.trim()) lines.push(sub);
      }
    });

    if (!lines.length) return "";
    return `\n\n${lines.join("\n")}\n\n`;
  }

  function renderTable(table) {
    const rows = Array.from(table.rows || []);
    if (!rows.length) return "";
    const grid = rows.map((row) =>
      Array.from(row.cells || []).map((cell) => {
        const text = (cell.innerText || cell.textContent || "")
          .replace(/\s+/g, " ")
          .replace(/\|/g, "\\|")
          .trim();
        const span = parseInt(cell.getAttribute("colspan") || "1", 10) || 1;
        return [text, ...Array(Math.max(0, span - 1)).fill("")];
      })
    );
    const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
    if (!width) return "";
    const normalized = grid.map((row) => {
      const next = row.slice();
      while (next.length < width) next.push("");
      return next;
    });
    const hasHeader = rows[0].querySelector("th") || (table.tHead && table.tHead.rows.length);
    const header = hasHeader ? normalized[0] : normalized[0].map(() => "");
    const body = hasHeader ? normalized.slice(1) : normalized;
    const line = (cells) => `| ${cells.map((c) => c || " ").join(" | ")} |`;
    const output = [line(header), line(header.map(() => "---")), ...body.map(line)];
    return `\n\n${output.join("\n")}\n\n`;
  }

  function blockquote(content) {
    const text = content.replace(/^\n+|\n+$/g, "");
    if (!text.trim()) return "";
    const quoted = text
      .split("\n")
      .map((line) => (line.trim() ? `> ${line}` : ">"))
      .join("\n");
    return `\n\n${quoted}\n\n`;
  }

  function renderDetails(el, ctx) {
    const summary = el.querySelector(":scope > summary");
    const label = summary ? (summary.innerText || "").trim() : "";
    const body = Array.from(el.childNodes)
      .filter((child) => child !== summary)
      .map((child) => renderNode(child, ctx))
      .join("");
    const isThinking = THINKING_PATTERN.test(`${label} ${typeof el.className === "string" ? el.className : ""}`);
    if (isThinking && ctx.opts.includeThinking === false) return "";
    const heading = label || (isThinking ? "تفکر" : "");
    const head = heading ? `**${escapeText(heading)}**\n\n` : "";
    return blockquote(head + body);
  }

  function renderNode(node, ctx) {
    if (!node) return "";
    if (node.nodeType === 3) return escapeText(node.nodeValue);
    if (node.nodeType !== 1) return "";

    const el = node;
    const math = mathOf(el);
    if (math) return math;
    if (shouldSkip(el)) return "";

    const tag = el.tagName;
    switch (tag) {
      case "BR":
        return "  \n";
      case "HR":
        return "\n\n---\n\n";
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        const level = Number(tag.slice(1));
        const content = renderChildren(el, ctx).trim();
        return content ? `\n\n${"#".repeat(level)} ${content}\n\n` : "";
      }
      case "P":
      case "DD":
      case "DT":
      case "FIGCAPTION": {
        const content = renderChildren(el, ctx).trim();
        return content ? `\n\n${content}\n\n` : "";
      }
      case "PRE":
        return renderPre(el);
      case "CODE":
        return el.closest("pre") ? escapeText(el.textContent || "") : inlineCode(el.textContent || "");
      case "KBD":
      case "SAMP":
        return inlineCode(el.textContent || "");
      case "STRONG":
      case "B": {
        const content = renderChildren(el, ctx).trim();
        return content ? `**${content}**` : "";
      }
      case "EM":
      case "I": {
        const content = renderChildren(el, ctx).trim();
        return content ? `_${content}_` : "";
      }
      case "DEL":
      case "S":
      case "STRIKE": {
        const content = renderChildren(el, ctx).trim();
        return content ? `~~${content}~~` : "";
      }
      case "MARK": {
        const content = renderChildren(el, ctx).trim();
        return content ? `==${content}==` : "";
      }
      case "SUP": {
        const content = renderChildren(el, ctx).trim();
        return content ? `^${content}` : "";
      }
      case "SUB": {
        const content = renderChildren(el, ctx).trim();
        return content ? `~${content}` : "";
      }
      case "A": {
        const href = el.getAttribute("href") || "";
        const content = renderChildren(el, ctx).replace(/\s+/g, " ").trim();
        if (!href || /^javascript:/i.test(href)) return content;
        if (!content) return "";
        if (content === href) return `<${href}>`;
        const safeHref = href.replace(/\)/g, "%29").replace(/\s/g, "%20");
        return `[${content}](${safeHref})`;
      }
      case "IMG":
        return imageMarkdown(el, ctx.opts);
      case "PICTURE": {
        const img = el.querySelector("img");
        return img ? imageMarkdown(img, ctx.opts) : "";
      }
      case "FIGURE": {
        const img = el.querySelector("img");
        const caption = el.querySelector("figcaption");
        const image = img ? imageMarkdown(img, ctx.opts) : "";
        const captionText = caption ? renderChildren(caption, ctx).trim() : "";
        if (!image && !captionText) return renderChildren(el, ctx);
        return `\n\n${image}${captionText ? `\n\n${captionText}` : ""}\n\n`;
      }
      case "UL":
      case "OL":
        return renderList(el, ctx);
      case "LI":
        return renderChildren(el, ctx);
      case "TABLE":
        return renderTable(el);
      case "BLOCKQUOTE":
        return blockquote(renderChildren(el, ctx));
      case "DETAILS":
        return renderDetails(el, ctx);
      case "SUMMARY":
        return "";
      case "BUTTON": {
        const images = Array.from(el.querySelectorAll("img"));
        return images.map((img) => imageMarkdown(img, ctx.opts)).join("");
      }
      case "TR":
      case "TD":
      case "TH":
      case "THEAD":
      case "TBODY":
      case "TFOOT":
        return renderChildren(el, ctx);
      default: {
        const content = renderChildren(el, ctx);
        const className = typeof el.className === "string" ? el.className : "";
        if (THINKING_PATTERN.test(className) && ctx.opts.includeThinking === false) return "";
        return content;
      }
    }
  }

  function renderChildren(el, ctx) {
    let out = "";
    const nodes = el.childNodes;
    for (let i = 0; i < nodes.length; i += 1) out += renderNode(nodes[i], ctx);
    return out;
  }

  function tidy(markdown) {
    let out = String(markdown || "").replace(/\r\n?/g, "\n");
    out = out.replace(/\n[ \t]+\n/g, "\n\n");
    out = out.replace(/\n{3,}/g, "\n\n");
    out = out
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, (spaces) => (spaces.length >= 2 ? "  " : "")))
      .join("\n");
    out = out.replace(/\*\*\s*\*\*/g, "").replace(/~~\s*~~/g, "").replace(/__\s*__/g, "");
    out = out.replace(/\[\s*\]\([^)]*\)/g, "");
    return out.replace(/^\n+|\n+$/g, "").trim();
  }

  function cleanMessage(markdown) {
    const lines = String(markdown || "").split("\n");
    while (lines.length && (!lines[0].trim() || LABEL_PATTERN.test(lines[0].trim()))) lines.shift();
    while (lines.length && (!lines[lines.length - 1].trim() || LABEL_PATTERN.test(lines[lines.length - 1].trim()))) {
      lines.pop();
    }
    return tidy(lines.join("\n"));
  }

  function renderElement(el, options) {
    const opts = { includeThinking: true, images: true, dataImages: true, ...(options || {}) };
    const ctx = { opts };
    return tidy(renderNode(el, ctx));
  }

  function findTimestamp(el) {
    const time = el.querySelector("time[datetime]");
    if (time) return time.getAttribute("datetime") || "";
    const withStamp = el.querySelector("[data-timestamp], [data-message-timestamp], [data-created-at]");
    if (withStamp) {
      return (
        withStamp.getAttribute("data-timestamp") ||
        withStamp.getAttribute("data-message-timestamp") ||
        withStamp.getAttribute("data-created-at") ||
        ""
      );
    }
    return "";
  }

  function toPlain(markdown) {
    let out = String(markdown || "").replace(/\r\n?/g, "\n");
    out = out.replace(/```[\w#+.-]*\n([\s\S]*?)```/g, (match, code) => code.replace(/\n+$/, ""));
    out = out.replace(/~~~[\w#+.-]*\n([\s\S]*?)~~~/g, (match, code) => code.replace(/\n+$/, ""));
    out = out.replace(/^#{1,6}\s+/gm, "");
    out = out.replace(/^>\s?/gm, "");
    out = out.replace(/^\s*[-*+]\s+/gm, "• ");
    out = out.replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + " ");
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "[تصویر: $1] $2");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
    out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
    out = out.replace(/__([^_]+)__/g, "$1");
    out = out.replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$)/g, "$1$2");
    out = out.replace(/~~([^~]+)~~/g, "$1");
    out = out.replace(/`([^`]+)`/g, "$1");
    out = out.replace(/\\\|/g, "|");
    out = out.replace(/\\/g, "");
    out = out.replace(/\n{3,}/g, "\n\n");
    return out.trim();
  }

  function toPlainLine(el) {
    return String((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  AX.extract = {
    renderElement,
    renderNode,
    cleanMessage,
    findTimestamp,
    toPlain,
    toPlainLine,
    tidy,
    shouldSkip,
  };
})();
