/*!
 * A.max — Full-history adapters
 * Reads the conversation directly from each site's own API (same session
 * cookies the page already uses) so an export is not limited to the messages
 * that happen to be rendered. Falls back to DOM scroll-hydration when an API
 * is unavailable or changes shape.
 *
 * Created by Arash Makki | Released under the MIT License
 */
(function (global) {
  'use strict';

  const AMTool = (global.AMTool = global.AMTool || {});
  if (AMTool.history) return;

  const ROLE = { user: 'user', assistant: 'assistant', system: 'system', tool: 'tool' };
  const nowISO = () => new Date().toISOString();

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function toISO(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
      const numeric = Number(value);
      if (Number.isFinite(numeric)) value = numeric;
      else return null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function normalizeRole(value) {
    const role = String(value || '').toLowerCase();
    if (!role) return 'unknown';
    if (role.includes('user') || role.includes('human')) return 'user';
    if (role.includes('assistant') || role.includes('ai') || role.includes('model')) return 'assistant';
    if (role.includes('system')) return 'system';
    if (role.includes('tool') || role.includes('function')) return 'tool';
    return ROLE[role] || 'unknown';
  }

  function joinParts(parts) {
    if (typeof parts === 'string') return parts;
    if (!Array.isArray(parts)) return '';
    const chunks = [];
    for (const part of parts) {
      if (part == null) continue;
      if (typeof part === 'string') {
        chunks.push(part);
        continue;
      }
      if (typeof part.text === 'string') {
        chunks.push(part.text);
        continue;
      }
      if (typeof part.content === 'string') {
        chunks.push(part.content);
        continue;
      }
      if (part.content_type === 'image_asset_pointer' || part.asset_pointer) {
        const pointer = part.asset_pointer || part.content || '';
        if (pointer) chunks.push(`\n\n![image](${String(pointer)})\n\n`);
      }
    }
    return chunks.join('');
  }

  function makeMessage(input) {
    const markdown = String(input.markdown == null ? input.content || '' : input.markdown).trim();
    const content = String(input.content == null ? markdown : input.content).trim();
    return {
      id: String(input.id || `api_${Math.random().toString(36).slice(2, 10)}`),
      role: normalizeRole(input.role),
      thinking: String(input.thinking || '').trim(),
      content,
      markdown: markdown || content,
      timestamp: input.timestamp || null,
      sentAt: input.sentAt || input.timestamp || null,
      capturedAt: nowISO(),
    };
  }

  /* ------------------------------- HTTP helpers ------------------------------ */

  async function requestJSON(url, options) {
    const opts = Object.assign({ credentials: 'include', headers: { Accept: 'application/json' } }, options || {});
    opts.headers = Object.assign({ Accept: 'application/json' }, (options && options.headers) || {});
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = setTimeout(() => controller && controller.abort(), Number(options && options.timeoutMs) || 8000);
    try {
      const response = await fetch(url, Object.assign({}, opts, controller ? { signal: controller.signal } : {}));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (error) {
        // Some endpoints prefix JSON with an anti-XSSI line.
        const start = text.indexOf('{');
        if (start > 0) return JSON.parse(text.slice(start));
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  function walkTree(mapping, currentNode) {
    const byId = new Map(Object.entries(mapping || {}));
    const chain = [];
    let node = byId.get(currentNode);
    const seen = new Set();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      chain.push(node);
      node = node.parent ? byId.get(node.parent) : null;
    }
    if (chain.length) return chain.reverse();
    // No current node: fall back to every message sorted by create_time.
    return [...byId.values()]
      .filter((entry) => entry && entry.message)
      .sort((a, b) => (a.message.create_time || 0) - (b.message.create_time || 0));
  }

  /* --------------------------------- ChatGPT -------------------------------- */

  function chatgptConversationId(url) {
    const match = String(url).match(/\/(?:c|g|gg|share)\/([a-zA-Z0-9-]{6,})/);
    return match ? match[1] : '';
  }

  function chatgptMessage(node) {
    const message = node && node.message;
    if (!message || !message.author) return null;
    const role = normalizeRole(message.author.role);
    if (role === 'unknown' && message.author.role === 'tool') return null;
    const contentType = message.content && message.content.content_type;
    const parts = message.content && message.content.parts;
    let markdown = joinParts(parts);
    if (!markdown && message.content && typeof message.content.text === 'string') markdown = message.content.text;
    if (!markdown.trim()) return null;
    const metadata = message.metadata || {};
    let thinking = '';
    if (Array.isArray(metadata.thoughts)) {
      thinking = metadata.thoughts.map((thought) => thought && (thought.content || thought.text || '')).filter(Boolean).join('\n\n');
    }
    if (!thinking && typeof metadata.reasoning_content === 'string') thinking = metadata.reasoning_content;
    return makeMessage({
      id: message.id || node.id,
      role,
      markdown,
      content: markdown,
      thinking,
      timestamp: toISO(message.create_time),
      contentType,
    });
  }

  async function fetchChatGPT(url) {
    const id = chatgptConversationId(url);
    if (!id) return null;
    const headers = {};
    try {
      const session = await requestJSON('/api/auth/session', { headers, timeoutMs: 4000 });
      if (session && session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    } catch (error) { /* cookie auth still works for many accounts */ }
    try {
      const device = document.cookie.match(/(?:^|;\s*)oai-did=([^;]+)/);
      if (device) headers['oai-device-id'] = decodeURIComponent(device[1]);
    } catch (error) { /* ignore */ }
    const payload = await requestJSON(`/backend-api/conversation/${id}`, { headers });
    if (!payload || !payload.mapping) return null;
    const chain = walkTree(payload.mapping, payload.current_node);
    const messages = chain.map(chatgptMessage).filter(Boolean);
    if (!messages.length) return null;
    return { title: payload.title || '', messages };
  }

  /* -------------------------------- DeepSeek -------------------------------- */

  function deepseekSessionId(url) {
    const match = String(url).match(/\/a\/chat\/s\/([a-zA-Z0-9_-]+)/) || String(url).match(/\/chat\/s\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  function deepseekToken() {
    try {
      const raw = localStorage.getItem('userToken');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed.value === 'string') return parsed.value;
      if (parsed && typeof parsed.token === 'string') return parsed.token;
    } catch (error) { /* ignore */ }
    return '';
  }

  async function fetchDeepSeek(url) {
    const id = deepseekSessionId(url);
    if (!id) return null;
    const headers = {};
    const token = deepseekToken();
    if (token) headers.Authorization = token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
    const payload = await requestJSON(
      `https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${encodeURIComponent(id)}&cache_version=0`,
      { headers }
    );
    const biz = payload && payload.data && payload.data.biz_data;
    const rows = biz && Array.isArray(biz.chat_messages) ? biz.chat_messages : [];
    if (!rows.length) return null;
    const byId = new Map(rows.map((row) => [row.message_id, row]));
    const chain = [];
    let cursor = biz.chat_session && biz.chat_session.current_message_id;
    const seen = new Set();
    while (cursor != null && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const row = byId.get(cursor);
      chain.push(row);
      cursor = row.parent_id;
    }
    const ordered = chain.length ? chain.reverse() : rows.slice();
    const messages = ordered
      .filter((row) => !row.status || row.status === 'FINISHED')
      .map((row) => {
        const markdown = String(row.content || '').trim();
        if (!markdown) return null;
        return makeMessage({
          id: row.message_id,
          role: row.role,
          markdown,
          content: markdown,
          thinking: row.thinking_content || row.thinking || row.reasoning_content || '',
          timestamp: toISO(row.inserted_at),
        });
      })
      .filter(Boolean);
    if (!messages.length) return null;
    return { title: (biz.chat_session && biz.chat_session.title) || '', messages };
  }

  /* ---------------------------------- Claude -------------------------------- */

  function claudeConversationId(url) {
    const match = String(url).match(/\/chat\/([a-zA-Z0-9-]{6,})/);
    return match ? match[1] : '';
  }

  async function claudeOrgId() {
    try {
      const cookie = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/);
      if (cookie) return decodeURIComponent(cookie[1]);
    } catch (error) { /* ignore */ }
    try {
      const orgs = await requestJSON('/api/organizations', { timeoutMs: 4000 });
      if (Array.isArray(orgs) && orgs.length && orgs[0].uuid) return orgs[0].uuid;
    } catch (error) { /* ignore */ }
    return '';
  }

  function claudeBlockText(blocks) {
    const text = [];
    const thinking = [];
    for (const block of Array.isArray(blocks) ? blocks : []) {
      if (!block || typeof block !== 'object') continue;
      const type = String(block.type || '');
      if (type === 'text' && block.text) text.push(block.text);
      else if (type === 'thinking' && block.thinking) thinking.push(block.thinking);
      else if (type === 'tool_result' && typeof block.content === 'string') text.push(block.content);
    }
    return { text: text.join('\n\n'), thinking: thinking.join('\n\n') };
  }

  async function fetchClaude(url) {
    const chatId = claudeConversationId(url);
    if (!chatId) return null;
    const org = await claudeOrgId();
    if (!org) return null;
    const payload = await requestJSON(
      `/api/organizations/${encodeURIComponent(org)}/chat_conversations/${encodeURIComponent(chatId)}?tree=True&rendering_mode=messages&render_all_tools=true`
    );
    const rows = payload && Array.isArray(payload.chat_messages) ? payload.chat_messages : [];
    if (!rows.length) return null;
    const byId = new Map(rows.map((row) => [row.uuid, row]));
    const chain = [];
    let cursor = payload.current_leaf_message_uuid || payload.current_message_uuid;
    const seen = new Set();
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const row = byId.get(cursor);
      chain.push(row);
      cursor = row.parent_message_uuid;
    }
    const ordered = chain.length ? chain.reverse() : rows.slice().sort((a, b) => (a.index || 0) - (b.index || 0));
    const messages = ordered
      .filter((row) => !row.truncated)
      .map((row) => {
        const blocks = claudeBlockText(row.content);
        let markdown = blocks.text || row.text || '';
        const images = [];
        for (const file of Array.isArray(row.files) ? row.files : []) {
          const src = file.preview_url || file.thumbnail_url || (file.preview_asset && file.preview_asset.url);
          if (src) images.push(`![${file.file_name || 'image'}](https://claude.ai${src})`);
        }
        for (const attachment of Array.isArray(row.attachments) ? row.attachments : []) {
          if (attachment.extracted_content) markdown += `\n\n${attachment.extracted_content}`;
        }
        if (images.length) markdown += `\n\n${images.join('\n\n')}`;
        if (!markdown.trim()) return null;
        return makeMessage({
          id: row.uuid,
          role: row.sender === 'human' ? 'user' : 'assistant',
          markdown,
          content: markdown,
          thinking: blocks.thinking,
          timestamp: toISO(row.created_at),
        });
      })
      .filter(Boolean);
    if (!messages.length) return null;
    return { title: payload.name || '', messages };
  }

  /* ----------------------------------- Qwen --------------------------------- */

  function qwenConversationId(url) {
    const match = String(url).match(/\/(?:c|chat)\/([a-zA-Z0-9-]{6,})/);
    return match ? match[1] : '';
  }

  function qwenToken() {
    try {
      const raw = localStorage.getItem('token');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed.access_token === 'string') return parsed.access_token;
      if (parsed && typeof parsed.token === 'string') return parsed.token;
    } catch (error) { /* ignore */ }
    return '';
  }

  async function fetchQwen(url) {
    const id = qwenConversationId(url);
    if (!id) return null;
    const headers = {};
    const token = qwenToken();
    if (token) headers.authorization = token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
    const payload = await requestJSON(`https://chat.qwen.ai/api/v2/chats/${encodeURIComponent(id)}`, { headers });
    const chat = payload && payload.data && payload.data.chat;
    const rows = chat && chat.history && Array.isArray(chat.history.messages) ? chat.history.messages : [];
    if (!rows.length) return null;
    const messages = rows
      .map((row, index) => {
        let markdown = String(row.content || '').trim();
        for (const file of Array.isArray(row.files) ? row.files : []) {
          const src = file.url || (file.file && file.file.url);
          const type = file.file_type || (file.file && file.file.meta && file.file.meta.content_type) || '';
          if (src && String(type).startsWith('image/')) markdown += `\n\n![image](${src})`;
        }
        if (!markdown) return null;
        let thinking = '';
        for (const block of Array.isArray(row.content_list) ? row.content_list : []) {
          if (block && block.phase === 'thinking_summary') {
            const summary = block.extra && block.extra.summary_thought && block.extra.summary_thought.content;
            if (Array.isArray(summary)) thinking += `${summary.join('\n')}\n`;
          }
        }
        return makeMessage({
          id: row.id || `qwen_${index + 1}`,
          role: row.role,
          markdown,
          content: markdown,
          thinking: thinking.trim(),
          timestamp: toISO(row.timestamp || row.created_at),
        });
      })
      .filter(Boolean);
    if (!messages.length) return null;
    return { title: (chat && chat.title) || '', messages };
  }

  /* ------------------------------ DOM hydration ----------------------------- */

  function messageCount() {
    const nodes = document.querySelectorAll(
      '[data-message-author-role], [data-turn-role], [data-message-role], article, model-response, .font-claude-message, .ds-markdown'
    );
    return nodes.length;
  }

  function scrollableCandidates() {
    const list = [];
    const seen = new Set();
    const push = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      if (el.scrollHeight > el.clientHeight + 120) list.push(el);
    };
    push(document.scrollingElement);
    push(document.documentElement);
    push(document.body);
    try {
      document.querySelectorAll('main, [role="main"], [class*="scroll"], [class*="overflow"]').forEach(push);
    } catch (error) { /* ignore */ }
    return list
      .map((el) => ({ el, score: el.scrollHeight - el.clientHeight, messages: el.querySelectorAll('[data-message-author-role], article, model-response').length }))
      .sort((a, b) => b.messages - a.messages || b.score - a.score);
  }

  /**
   * Walks a virtualized conversation to the top so lazy-loaded turns mount in
   * the DOM. Restores the previous scroll position afterwards.
   */
  async function hydrateDom(options) {
    const opts = Object.assign({ maxMs: 5000, stepMs: 160 }, options || {});
    const candidates = scrollableCandidates();
    if (!candidates.length) return { scrolled: 0, added: 0 };
    const target = candidates[0];
    const el = target.el;
    const before = messageCount();
    const start = Date.now();
    const originalTop = el.scrollTop;
    let lastHeight = el.scrollHeight;
    let stable = 0;
    let steps = 0;
    while (Date.now() - start < opts.maxMs) {
      el.scrollTop = 0;
      await sleep(opts.stepMs);
      steps += 1;
      const height = el.scrollHeight;
      if (height === lastHeight) stable += 1;
      else stable = 0;
      lastHeight = height;
      if (stable >= 2 && steps >= 3) break;
    }
    el.scrollTop = originalTop;
    await sleep(60);
    return { scrolled: steps, added: Math.max(0, messageCount() - before), container: el.tagName };
  }

  /* ---------------------------------- Merge --------------------------------- */

  function normalizeKey(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/[#>*_`~\-|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function imageUrls(text) {
    const out = [];
    const pattern = /!\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = pattern.exec(String(text || '')))) out.push(match[1]);
    return out;
  }

  /**
   * Two normalised texts describe the same turn. Exact equality is accepted at
   * any length; fuzzy containment only once both sides are long enough that a
   * coincidental prefix is implausible.
   */
  function sameTurn(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length < 24 || b.length < 24) return false;
    return a.includes(b.slice(0, 80)) || b.includes(a.slice(0, 80));
  }

  function mergeMessages(apiMessages, domMessages) {
    const api = Array.isArray(apiMessages) ? apiMessages.slice() : [];
    const dom = Array.isArray(domMessages) ? domMessages.slice() : [];
    if (!api.length) return dom.map((message, index) => Object.assign({}, message, { index }));

    const apiForDom = new Array(dom.length).fill(-1);
    const mergedApi = api.map((message) => Object.assign({}, message));

    for (let d = 0; d < dom.length; d += 1) {
      const domPlain = normalizeKey(dom[d].markdown || dom[d].content);
      if (!domPlain) continue;
      for (let a = 0; a < api.length; a += 1) {
        if (apiForDom.includes(a)) continue;
        const apiPlain = normalizeKey(api[a].markdown || api[a].content);
        if (!sameTurn(apiPlain, domPlain)) continue;

        apiForDom[d] = a;
        const domMessage = dom[d];
        const apiHasCode = /```|~~~/.test(api[a].markdown || '');
        const domHasCode = /```|~~~/.test(domMessage.markdown || '');
        const domIsRicher = domMessage.markdown && domMessage.markdown.length > (api[a].markdown || '').length * 1.35;
        const text = domHasCode && !apiHasCode ? domMessage.markdown : domMessage.markdown && domIsRicher ? domMessage.markdown : api[a].markdown;
        const missingImages = imageUrls(domMessage.markdown).filter((url) => !String(text).includes(url));
        mergedApi[a] = Object.assign({}, api[a], {
          markdown: missingImages.length ? `${text}\n\n${missingImages.map((url) => `![image](${url})`).join('\n\n')}` : text,
          content: domIsRicher ? domMessage.content : api[a].content || api[a].markdown,
          thinking: api[a].thinking || domMessage.thinking || '',
          sentAt: api[a].sentAt || domMessage.sentAt || null,
          timestamp: api[a].timestamp || domMessage.timestamp || null,
        });
        break;
      }
    }

    // Keep DOM-only turns next to the server turn they were rendered beside,
    // instead of appending them (which would reorder the conversation).
    const before = new Map();
    const trailing = [];
    for (let d = 0; d < dom.length; d += 1) {
      if (apiForDom[d] >= 0) continue;
      let nextApi = -1;
      for (let k = d + 1; k < dom.length; k += 1) {
        if (apiForDom[k] >= 0) {
          nextApi = apiForDom[k];
          break;
        }
      }
      if (nextApi >= 0) {
        if (!before.has(nextApi)) before.set(nextApi, []);
        before.get(nextApi).push(dom[d]);
      } else {
        trailing.push(dom[d]);
      }
    }

    const out = [];
    mergedApi.forEach((message, index) => {
      const extras = before.get(index);
      if (extras) extras.forEach((extra) => out.push(extra));
      out.push(message);
    });
    trailing.forEach((extra) => out.push(extra));
    return out.map((message, index) => Object.assign({}, message, { index }));
  }

  const ADAPTERS = {
    chatgpt: fetchChatGPT,
    claude: fetchClaude,
    deepseek: fetchDeepSeek,
    qwen: fetchQwen,
  };

  /**
   * @returns {Promise<{messages:Array, title:string, source:'api', platformId:string}|null>}
   */
  async function fetchFull(platformId, url, options) {
    const adapter = ADAPTERS[platformId];
    if (!adapter) return null;
    try {
      const result = await adapter(url || location.href, options);
      if (!result || !Array.isArray(result.messages) || !result.messages.length) return null;
      return Object.assign({}, result, { source: 'api', platformId });
    } catch (error) {
      console.info('A.max: full-history API unavailable, using DOM capture.', error);
      return null;
    }
  }

  AMTool.history = {
    fetchFull,
    hydrateDom,
    mergeMessages,
    adapters: Object.keys(ADAPTERS),
  };
})(typeof window !== 'undefined' ? window : globalThis);
