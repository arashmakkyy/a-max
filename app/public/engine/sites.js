/*!
 * Arash Chat Exporter — site adapters
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.sites) return;

  const U = AX.util;
  const X = AX.extract;

  const qs = (selector, root) => (root || document).querySelector(selector);
  const qsa = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const USER_HINT =
    /(^|[-_ ])(user|human|me|self|query|question|prompt|sent|outgoing)([-_ ]|$)|usermessage|humanmessage|user-message|message-user|querytext/i;
  const AI_HINT =
    /(^|[-_ ])(assistant|bot|ai|model|answer|response|reply|incoming|agent)([-_ ]|$)|assistantmessage|aimessage|bot-message|assistant-message|message-assistant/i;

  const SITES = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      hosts: ["chatgpt.com", "chat.openai.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*ChatGPT.*$/i, "").trim();
      },
      messages() {
        return qsa("[data-message-author-role]").map((el) => ({
          el,
          // Only the attribute value is evidence; an unrecognised value is unknown.
          role: guessRole(el) || "unknown",
        }));
      },
      composer() {
        return (
          qs("#prompt-textarea") ||
          qs('div[contenteditable="true"][data-lexical-editor="true"]') ||
          qs('form [contenteditable="true"]') ||
          qs('form textarea')
        );
      },
      model() {
        return (
          U.textOf(qs('[data-testid="model-switcher-dropdown"]')) ||
          U.textOf(qs('button[aria-label*="model" i]')) ||
          ""
        );
      },
      conversationId() {
        const match = location.pathname.match(/\/c\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "claude",
      name: "Claude",
      hosts: ["claude.ai"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*Claude.*$/i, "").trim();
      },
      messages() {
        return qsa('[data-testid="user-message"], .font-claude-message, [data-testid="assistant-message"]').map((el) => ({
          el,
          role: el.matches('[data-testid="user-message"]')
            ? "user"
            : el.matches('[data-testid="assistant-message"], .font-claude-message')
              ? "assistant"
              : "unknown",
        }));
      },
      composer() {
        return qs('div[contenteditable="true"].ProseMirror') || qs('fieldset div[contenteditable="true"]');
      },
      model() {
        return U.textOf(qs('[data-testid="model-selector-dropdown"]')) || "";
      },
      conversationId() {
        const match = location.pathname.match(/\/chat\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "gemini",
      name: "Gemini",
      hosts: ["gemini.google.com"],
      title() {
        const node = qs(".conversation-title") || qs("h1");
        return (U.textOf(node) || document.title || "").replace(/\s*[-–|]\s*Gemini.*$/i, "").trim();
      },
      messages() {
        return qsa("user-query, model-response").map((el) => ({
          el,
          role: el.tagName === "USER-QUERY" ? "user" : el.tagName === "MODEL-RESPONSE" ? "assistant" : "unknown",
        }));
      },
      composer() {
        return qs("rich-textarea .ql-editor") || qs('div[contenteditable="true"][role="textbox"]') || qs("rich-textarea");
      },
      model() {
        return U.textOf(qs(".gds-mode-switch-button")) || "";
      },
      conversationId() {
        const match = location.pathname.match(/\/app\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "aistudio",
      name: "Google AI Studio",
      hosts: ["aistudio.google.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*Google AI Studio.*$/i, "").trim();
      },
      messages() {
        const turns = qsa("ms-chat-turn, .chat-turn-container");
        if (!turns.length) return [];
        return turns.map((el) => ({
          el,
          role: guessRole(el) || "unknown",
        }));
      },
      composer() {
        return qs("ms-prompt-input textarea") || qs('textarea[aria-label*="prompt" i]') || qs("textarea");
      },
      model() {
        return U.textOf(qs("ms-model-selector, .model-selector")) || "";
      },
      conversationId() {
        const match = location.pathname.match(/\/prompts?\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "grok",
      name: "Grok",
      hosts: ["grok.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*Grok.*$/i, "").trim();
      },
      messages() {
        return qsa(".message-bubble").map((el) => ({
          el,
          role: guessRole(el) || (el.closest('[class*="items-end"]') ? "user" : "unknown"),
        }));
      },
      composer() {
        return qs("form textarea") || qs('div[contenteditable="true"]');
      },
      conversationId() {
        const match = location.pathname.match(/\/chat\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "copilot",
      name: "Copilot",
      hosts: ["copilot.com", "copilot.microsoft.com", "m365.cloud.microsoft"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*(Microsoft )?Copilot.*$/i, "").trim();
      },
      messages() {
        return qsa('[data-content="user-message"], [data-content="ai-message"], [data-testid="user-message"], [data-testid="ai-message"]').map(
          (el) => ({
            el,
            role: /user/i.test(el.getAttribute("data-content") || el.getAttribute("data-testid") || "")
              ? "user"
              : /ai|assistant/i.test(el.getAttribute("data-content") || el.getAttribute("data-testid") || "")
                ? "assistant"
                : guessRole(el) || "unknown",
          })
        );
      },
      composer() {
        return qs('textarea[data-testid="composer-input"]') || qs("#userInput") || qs("form textarea");
      },
      conversationId() {
        const match = location.pathname.match(/\/(?:chats?|conversations?)\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "perplexity",
      name: "Perplexity",
      hosts: ["www.perplexity.ai", "perplexity.ai"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*Perplexity.*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs('div[contenteditable="true"]') || qs("textarea");
      },
      conversationId() {
        const match = location.pathname.match(/\/search\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "poe",
      name: "Poe",
      hosts: ["poe.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*Poe.*$/i, "").trim();
      },
      messages() {
        return qsa('[class*="ChatMessage_messageRow"]').map((el) => ({
          el,
          role: (() => {
            const hay = `${el.className || ""} ${el.closest('[class*="ChatMessage"]')?.className || ""}`;
            if (/human|user/i.test(hay)) return "user";
            if (AI_HINT.test(hay) || /botmessage|bot_message/i.test(hay)) return "assistant";
            return guessRole(el) || "unknown";
          })(),
        }));
      },
      composer() {
        return qs("textarea") || qs('div[contenteditable="true"]');
      },
      conversationId() {
        const match = location.pathname.match(/\/(?:chat|search)\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      hosts: ["chat.deepseek.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*DeepSeek.*$/i, "").trim();
      },
      messages() {
        return qsa('[class*="ds-message"], [data-role="user"], [data-role="assistant"]').map((el) => ({
          el,
          role: guessRole(el) || "unknown",
        }));
      },
      composer() {
        return qs("#chat-input") || qs("textarea");
      },
      conversationId() {
        const match = location.pathname.match(/\/a\/chat\/s\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "qwen",
      name: "Qwen",
      hosts: ["chat.qwen.ai", "www.qianwen.com", "tongyi.aliyun.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*(Qwen|Tongyi|通义).*$/i, "").trim();
      },
      messages() {
        return qsa('[class*="chat-message"], [class*="message-item"], [class*="user-message"], [class*="assistant-message"]').map(
          (el) => ({
            el,
            role: guessRole(el) || "unknown",
          })
        );
      },
      composer() {
        return qs("textarea") || qs('div[contenteditable="true"]');
      },
      conversationId() {
        const match = location.pathname.match(/\/c\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "kimi",
      name: "Kimi",
      hosts: ["kimi.com", "www.kimi.com", "kimi.ai", "www.kimi.ai", "kimi.moonshot.cn"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*Kimi.*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs('div[contenteditable="true"]') || qs("textarea");
      },
      conversationId() {
        const match = location.pathname.match(/\/chat\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "mistral",
      name: "Mistral",
      hosts: ["chat.mistral.ai"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*(Le Chat|Mistral).*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs("textarea") || qs('div[contenteditable="true"]');
      },
      conversationId() {
        const match = location.pathname.match(/\/(?:chat|conversations?)\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "notebooklm",
      name: "NotebookLM",
      hosts: ["notebooklm.google.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*NotebookLM.*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs("textarea") || qs('div[contenteditable="true"]');
      },
      conversationId() {
        const match = location.pathname.match(/\/notebook\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "doubao",
      name: "Doubao",
      hosts: ["www.doubao.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*(豆包|Doubao).*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs("textarea") || qs('div[contenteditable="true"]');
      },
      conversationId() {
        const match = location.pathname.match(/\/chat\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "yuanbao",
      name: "Yuanbao",
      hosts: ["yuanbao.tencent.com"],
      title() {
        return (document.title || "").replace(/\s*[-–|]\s*(腾讯元宝|Yuanbao).*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs("textarea") || qs('div[contenteditable="true"]');
      },
      conversationId() {
        const match = location.pathname.match(/\/(?:chat|conversation)\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "x",
      name: "X (Grok)",
      hosts: ["x.com"],
      title() {
        return (document.title || "").replace(/\s*\/\s*X.*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs('div[contenteditable="true"][data-testid^="tweetTextarea"]') || qs("textarea");
      },
      conversationId() {
        const match = location.pathname.match(/\/i\/grok\/([\w-]+)/);
        return match ? match[1] : "";
      },
    },
    {
      id: "github",
      name: "GitHub Copilot",
      hosts: ["github.com"],
      title() {
        return (document.title || "").replace(/\s*·\s*GitHub.*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs('textarea[placeholder*="Copilot" i]') || qs("textarea");
      },
      conversationId() {
        return "";
      },
    },
    {
      id: "google",
      name: "Google",
      hosts: ["www.google.com", "www.google.co.uk", "www.google.com.hk"],
      kind: "search",
      title() {
        const input = qs('textarea[name="q"], input[name="q"]');
        return (input && input.value) || (document.title || "").replace(/\s*[-–]\s*Google.*$/i, "").trim();
      },
      messages() {
        return [];
      },
      composer() {
        return qs('textarea[name="q"], input[name="q"]');
      },
      conversationId() {
        return "";
      },
    },
  ];

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function detect(url) {
    const target = url || (typeof location !== "undefined" ? location.href : "");
    let host = "";
    try {
      host = new URL(target).hostname;
    } catch {
      host = "";
    }
    const bare = host.replace(/^www\./, "");
    const match = SITES.find((site) => site.hosts.some((h) => h === host || h.replace(/^www\./, "") === bare));
    if (!match) return null;
    if (match.kind === "search") {
      let pathname = "";
      try {
        pathname = new URL(target).pathname;
      } catch {
        pathname = "";
      }
      if (!/^\/(search|webhp)/.test(pathname)) return null;
    }
    return match;
  }

  function findComposer(adapter) {
    if (adapter && typeof adapter.composer === "function") {
      try {
        const el = adapter.composer();
        if (el && U.isVisible(el)) return el;
      } catch {
        /* ignore */
      }
    }
    const candidates = qsa('textarea, [contenteditable="true"], [role="textbox"]').filter((el) => {
      if (!U.isVisible(el)) return false;
      if (el.closest("header, nav, [role='navigation']")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 20) return false;
      const placeholder = `${el.getAttribute("placeholder") || ""} ${el.getAttribute("aria-label") || ""}`;
      if (/search|جستجو|جست‌وجو/i.test(placeholder) && !/ask|prompt|message|پیام|بپرس/i.test(placeholder)) return false;
      return true;
    });
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.bottom + rb.width / 10 - (ra.bottom + ra.width / 10);
    });
    return candidates[0];
  }

  function findSendButton(composer) {
    if (!composer) return null;
    const root = composer.closest("form") || composer.parentElement || document;
    const buttons = qsa("button", root).filter((button) => {
      if (!U.isVisible(button)) return false;
      if (button.type === "submit") return true;
      const label = `${button.getAttribute("data-testid") || ""} ${button.getAttribute("aria-label") || ""} ${button.getAttribute(
        "title"
      ) || ""}`;
      return /send|submit|ارسال|بفرست/i.test(label);
    });
    return buttons[buttons.length - 1] || null;
  }

  function guessRole(el) {
    const attributeRole =
      el.getAttribute("data-message-author-role") ||
      el.getAttribute("data-role") ||
      el.getAttribute("data-author") ||
      el.getAttribute("data-sender") ||
      "";
    if (attributeRole) {
      if (/user|human/i.test(attributeRole)) return "user";
      if (/assistant|ai|bot|model/i.test(attributeRole)) return "assistant";
    }
    const haystack = [
      typeof el.className === "string" ? el.className : "",
      el.id || "",
      el.getAttribute("data-testid") || "",
      el.getAttribute("aria-label") || "",
    ].join(" ");
    if (USER_HINT.test(haystack)) return "user";
    if (AI_HINT.test(haystack)) return "assistant";
    return "";
  }

  function signatureOf(el) {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] || "" : "";
    return `${el.tagName}|${cls}`;
  }

  function looksLikeMessage(el) {
    if (!U.isVisible(el)) return false;
    if (el.closest("pre, code, table, ul, ol, nav, header, footer, form, select")) return false;
    const text = (el.innerText || "").trim();
    if (!text && !el.querySelector("img, pre")) return false;
    if (text.length < 12 && !el.querySelector("pre, img")) return false;
    return Boolean(el.querySelector("p, pre, ul, ol, h1, h2, h3, h4, table, blockquote, img") || text.length > 60);
  }

  function genericFindMessages(root) {
    const scope = root || qs("main") || qs('[role="main"]') || document.body;
    if (!scope) return [];
    let best = { score: 0, nodes: [] };
    const parents = Array.from(scope.querySelectorAll("div, section, article, li, [role='article']"));
    let scanned = 0;

    for (const parent of parents) {
      if (scanned > 9000) break;
      scanned += 1;
      if (!parent.children || parent.children.length < 2) continue;
      if (parent.children.length > 200) continue;
      if (/^(PRE|CODE|TABLE|UL|OL|NAV|HEADER|FOOTER|FORM|SELECT)$/.test(parent.tagName)) continue;

      const groups = new Map();
      for (const child of parent.children) {
        if (child.nodeType !== 1) continue;
        if (!looksLikeMessage(child)) continue;
        const key = signatureOf(child);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(child);
      }

      for (const nodes of groups.values()) {
        if (nodes.length < 2) continue;
        const total = nodes.reduce((sum, node) => sum + (node.innerText || "").length, 0);
        if (total < 80) continue;
        const hinted = nodes.filter((node) => guessRole(node)).length;
        const score = total * Math.min(nodes.length, 24) * (hinted ? 1.8 : 1);
        if (score > best.score) best = { score, nodes };
      }
    }

    if (!best.nodes.length) {
      const single = Array.from(scope.querySelectorAll("article, [role='article'], .markdown, .prose")).filter(U.isVisible);
      if (single.length) return single.slice(0, 80);
      return [];
    }
    return best.nodes;
  }

  function dedupeNested(items) {
    return items.filter((item, index) => {
      return !items.some((other, otherIndex) => {
        if (index === otherIndex) return false;
        return other.el !== item.el && other.el.contains(item.el);
      });
    });
  }

  function fillRoles(items) {
    // Roles are only accepted when the page (or the site adapter) provided
    // evidence for them. Alternating user/assistant or inheriting the previous
    // role fabricates data, so an unresolved role stays `unknown` and the
    // export is marked partial instead.
    items.forEach((item) => {
      item.role =
        item.role === "user" || item.role === "assistant" || item.role === "system" || item.role === "tool"
          ? item.role
          : "unknown";
    });
    return items;
  }

  function collectMessages(adapter) {
    let items = [];
    let usedFallback = false;

    if (adapter && typeof adapter.messages === "function") {
      try {
        items = adapter.messages() || [];
      } catch {
        items = [];
      }
    }
    items = items.filter((item) => item && item.el && item.el.isConnected);

    if (!items.length) {
      usedFallback = true;
      const nodes = genericFindMessages();
      items = nodes.map((el) => ({ el, role: guessRole(el) }));
    }

    items = dedupeNested(items);
    items = items.filter((item) => {
      // A.max: fall back to textContent for environments where innerText is
      // unavailable (older engines, offscreen documents, tests).
      const text = (item.el.innerText || item.el.textContent || "").trim();
      return text.length > 0 || item.el.querySelector("img, pre");
    });
    items = U.sortByDocumentOrder(items.map((item) => item.el)).map(
      (el) => items.find((item) => item.el === el) || { el, role: "" }
    );
    items = fillRoles(items);
    return { items, usedFallback };
  }

  function collectSearchResults() {
    const blocks = qsa("#search div.g, #search div[data-hveid], #rso div.g").filter(U.isVisible);
    const seen = new Set();
    const results = [];
    for (const block of blocks) {
      const anchor = block.querySelector("a[href^='http']");
      const heading = block.querySelector("h3");
      if (!anchor || !heading) continue;
      const url = anchor.href;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const snippetNode = block.querySelector('[data-sncf], .VwiC3b, [class*="snippet"]');
      const snippet = snippetNode ? U.textOf(snippetNode) : U.textOf(block).slice(0, 320);
      results.push({ title: U.textOf(heading), url, snippet });
    }
    return results;
  }

  function getConversation(adapter, options) {
    const opts = { includeThinking: true, ...(options || {}) };
    const site = adapter || { id: hostOf(location.href) || "web", name: hostOf(location.href) || "Web" };

    if (site.kind === "search") {
      const results = collectSearchResults();
      const query = site.title ? site.title() : document.title;
      return {
        title: query || "Google search",
        url: location.href,
        site: site.name,
        siteId: site.id,
        model: "",
        createdAt: "",
        exportedAt: new Date().toISOString(),
        messages: results.map((result, index) => ({
          index,
          role: "assistant",
          markdown: `### [${result.title}](${result.url})\n\n${result.snippet}`,
          text: `${result.title}\n${result.url}\n${result.snippet}`,
          model: "",
          createdAt: "",
        })),
      };
    }

    const { items, usedFallback } = collectMessages(site);
    const built = items.map((item, index) => {
      const markdown = X.cleanMessage(X.renderElement(item.el, { includeThinking: opts.includeThinking }));
      return {
        el: item.el,
        message: {
          index,
          role: item.role,
          markdown,
          text: X.toPlain(markdown),
          model: item.model || "",
          createdAt: X.findTimestamp(item.el),
        },
      };
    });
    const usable = built.filter((entry) => entry.message.markdown.trim().length > 0);
    usable.forEach((entry, index) => {
      entry.message.index = index;
    });

    let title = "";
    try {
      title = (site.title && site.title()) || "";
    } catch {
      title = "";
    }
    if (!title) title = (document.title || "").trim();
    if (!title) title = U.guessTitleFromUrl(location.href);
    title = title.replace(/\s+/g, " ").trim().slice(0, 140);

    let model = "";
    try {
      model = (site.model && site.model()) || "";
    } catch {
      model = "";
    }

    const conversation = {
      title,
      url: location.href,
      site: site.name,
      siteId: site.id,
      model: model || "",
      createdAt: "",
      exportedAt: new Date().toISOString(),
      usedFallback,
      messages: usable.map((entry) => entry.message),
    };
    if (opts.withElements) {
      Object.defineProperty(conversation, "elements", {
        value: usable.map((entry) => entry.el),
        enumerable: false,
        configurable: true,
      });
    }
    return conversation;
  }

  AX.sites = {
    list: () => SITES,
    detect,
    hostOf,
    findComposer,
    findSendButton,
    genericFindMessages,
    collectMessages,
    collectSearchResults,
    getConversation,
  };
})();
