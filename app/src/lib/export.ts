import type { ConversationSnapshot, CapturedMessage, ExportOptions, ExportFormat, DocTheme, MessageRole } from './types';
import { platformName } from './platforms';
import { detectDirection } from './persian';
import { GENERATOR_LABEL } from './version';

export const FORMAT_META: Record<ExportFormat, { ext: string; mime: string; available: boolean }> = {
  pdf: { ext: 'pdf', mime: 'application/pdf', available: true },
  docx: { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', available: true },
  md: { ext: 'md', mime: 'text/markdown;charset=utf-8', available: true },
  txt: { ext: 'txt', mime: 'text/plain;charset=utf-8', available: true },
  png: { ext: 'png', mime: 'image/png', available: true },
  json: { ext: 'json', mime: 'application/json;charset=utf-8', available: true },
  html: { ext: 'html', mime: 'text/html;charset=utf-8', available: true },
  csv: { ext: 'csv', mime: 'text/csv;charset=utf-8', available: true },
};

export const DOC_THEMES: Record<DocTheme, { bg: string; fg: string; muted: string; border: string; accent: string }> = {
  light: { bg: '#ffffff', fg: '#14232B', muted: '#4C6270', border: '#D6E0E5', accent: '#0F766E' },
  dark: { bg: '#0B0F12', fg: '#F1F5F9', muted: '#94A3B8', border: '#24313A', accent: '#14B8A6' },
  note: { bg: '#FFFBEB', fg: '#3A2E10', muted: '#7A6A3A', border: '#F3E3A6', accent: '#B45309' },
  oldpaper: { bg: '#F3E9D2', fg: '#3B2F1E', muted: '#7B6A50', border: '#D9C9A3', accent: '#8A5A2B' },
  sakura: { bg: '#FFF1F5', fg: '#3F1B2A', muted: '#8A5D6E', border: '#F9C9D8', accent: '#DB2777' },
  bluemist: { bg: '#EFF6FF', fg: '#102A43', muted: '#486581', border: '#BFDBFE', accent: '#1D4ED8' },
  freshgreen: { bg: '#F0FDF4', fg: '#14321F', muted: '#3F6B4E', border: '#BBF7D0', accent: '#15803D' },
  lavender: { bg: '#F5F3FF', fg: '#2A1B4D', muted: '#6B5A8E', border: '#DDD6FE', accent: '#6D28D9' },
};

// ---------- Sanitization ----------
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function safeUrl(u: string): string | null {
  try { const p = new URL(u.trim()); return (p.protocol === 'https:' || p.protocol === 'http:' || p.protocol === 'mailto:') ? p.href : null; } catch { return null; }
}

// ---------- Minimal, safe Markdown → HTML (allowlist, no raw HTML passthrough) ----------
function inline(md: string): string {
  let s = escapeHtml(md);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => { const su = safeUrl(u); return su ? `<a href="${escapeHtml(su)}" rel="noopener noreferrer" target="_blank">${t}</a>` : t; });
  return s;
}
export function renderMarkdown(md: string, tableClass = ''): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];
  const flush = () => { if (para.length) { const t = para.join(' '); out.push(`<p dir="${detectDirection(t)}">${inline(t)}</p>`); para = []; } };
  while (i < lines.length) {
    const l = lines[i];
    const fence = l.match(/^(`{3,}|~{3,})\s*(\w+)?/);
    if (fence) {
      flush(); const close = fence[1]; const lang = fence[2] || ''; const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith(close)) { buf.push(lines[i]); i++; }
      i++; out.push(`<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(buf.join('\n'))}</code></pre>`); continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)/);
    if (h) { flush(); const n = Math.min(h[1].length, 3); out.push(`<h${n} dir="${detectDirection(h[2])}">${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^\s*[-*_]{3,}\s*$/.test(l)) { flush(); out.push('<hr/>'); i++; continue; }
    if (/^\s*>/.test(l)) { flush(); const buf: string[] = []; while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; } out.push(`<blockquote>${renderMarkdown(buf.join('\n'), tableClass)}</blockquote>`); continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush(); const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(l); i += 2; const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(`<table class="${tableClass}"><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td dir="${detectDirection(c)}">${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue;
    }
    const ul = l.match(/^\s*[-*+]\s+(.*)/); const ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      flush(); const tag = ul ? 'ul' : 'ol'; const re = ul ? /^\s*[-*+]\s+(.*)/ : /^\s*\d+[.)]\s+(.*)/; const items: string[] = [];
      while (i < lines.length) { const m = lines[i].match(re); if (!m) break; items.push(`<li dir="${detectDirection(m[1])}">${inline(m[1])}</li>`); i++; }
      out.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    if (l.trim() === '') { flush(); i++; continue; }
    para.push(l.trim()); i++;
  }
  flush();
  return out.join('\n');
}

// ---------- Helpers ----------
export const roleLabel = (r: MessageRole, lang: 'fa' | 'en') => ({
  fa: { user: 'شما', assistant: 'دستیار', system: 'سیستم', tool: 'ابزار', unknown: 'نامشخص' },
  en: { user: 'You', assistant: 'Assistant', system: 'System', tool: 'Tool', unknown: 'Unknown' },
}[lang][r]);

export function selectedMessages(s: ConversationSnapshot, ids: Set<string> | null): CapturedMessage[] {
  return ids ? s.messages.filter(m => ids.has(m.id)) : s.messages;
}
export function messageBody(m: CapturedMessage, includeThinking: boolean): string {
  return m.blocks.filter(b => b.type !== 'thinking' || includeThinking)
    .map(b => b.type === 'code' ? fence(b.text, b.language) : b.type === 'thinking' ? `> 💭 ${b.text.split('\n').join('\n> ')}` : b.text).join('\n\n');
}
function fence(code: string, lang?: string | null) {
  const longest = (code.match(/`+/g) || []).reduce((a, b) => Math.max(a, b.length), 0);
  const f = '`'.repeat(Math.max(3, longest + 1));
  return `${f}${lang || ''}\n${code}\n${f}`;
}

export function safeFileName(name: string, max = 90): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ').replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  const t = cleaned.slice(0, max).trim().replace(/^[. ]+|[. ]+$/g, '');
  return t || 'conversation';
}
export function buildFileName(snaps: ConversationSnapshot[], opts: ExportOptions, collectionTitle?: string): string {
  const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const ai = snaps.length === 1 ? platformName(snaps[0].platformId) : 'Collection';
  // An empty collection title must not win over the real conversation title.
  const requested = String(collectionTitle || '').trim();
  const title = requested || String(snaps[0]?.title || '').trim() || 'conversation';
  const patterns: Record<string, string> = {
    ai_title_date: `${ai}_${title}_${date}`,
    title_date: `${title}_${date}`,
    ai_title: `${ai}_${title}`,
    date_title: `${date}_${title}`,
  };
  const base = patterns[opts.fileNamePattern] || patterns.ai_title_date;
  return safeFileName(base) + '.' + FORMAT_META[opts.format].ext;
}

// ---------- Generators ----------
export interface ExportInput { snapshots: ConversationSnapshot[]; selection: Map<string, Set<string>> | null; collectionTitle?: string; lang: 'fa' | 'en'; }

const header = (s: ConversationSnapshot, o: ExportOptions, lang: 'fa' | 'en') => {
  const lines: string[] = [];
  if (o.includeSource) {
    lines.push(`${lang === 'fa' ? 'پلتفرم' : 'Platform'}: ${platformName(s.platformId)}`);
    lines.push(`${lang === 'fa' ? 'منبع' : 'Source'}: ${s.canonicalURL ? s.canonicalURL : (lang === 'fa' ? 'ناموجود' : 'unavailable')}`);
    lines.push(`${lang === 'fa' ? 'زمان برداشت' : 'Captured at'}: ${s.capturedAt}`);
    if (s.captureStatus !== 'complete') lines.push(`${lang === 'fa' ? 'وضعیت استخراج' : 'Capture status'}: ${s.captureStatus}`);
  }
  return lines;
};

export function toMarkdown(inp: ExportInput, o: ExportOptions): string {
  const parts: string[] = [];
  if (inp.collectionTitle) parts.push(`# ${inp.collectionTitle}\n`);
  inp.snapshots.forEach((s, ci) => {
    const msgs = selectedMessages(s, inp.selection?.get(s.id) ?? null);
    if (o.includeTitle) parts.push(`${inp.collectionTitle ? '## ' : '# '}${inp.collectionTitle ? `${ci + 1}. ` : ''}${s.title}`);
    const h = header(s, o, inp.lang); if (h.length) parts.push(h.map(l => `> ${l}`).join('\n'));
    msgs.forEach((m, i) => {
      const bits: string[] = [];
      if (o.includeRoles) bits.push(`### ${i + 1}. ${roleLabel(m.role, inp.lang)}${o.includeTimestamps && m.sentAt ? ` — ${m.sentAt}` : ''}`);
      bits.push(messageBody(m, o.includeThinking));
      parts.push(bits.join('\n\n'));
      if (o.separators && i < msgs.length - 1) parts.push('---');
    });
    if (ci < inp.snapshots.length - 1) parts.push('\n***\n');
  });
  if (o.brandingEnabled && o.brandingText) parts.push(`\n_${o.brandingText}_`);
  return parts.join('\n\n') + '\n';
}

export function toTxt(inp: ExportInput, o: ExportOptions): string {
  const parts: string[] = [];
  if (inp.collectionTitle) parts.push(inp.collectionTitle.toUpperCase());
  inp.snapshots.forEach(s => {
    const msgs = selectedMessages(s, inp.selection?.get(s.id) ?? null);
    if (o.includeTitle) parts.push(`=== ${s.title} ===`);
    parts.push(...header(s, o, inp.lang));
    msgs.forEach((m, i) => {
      const label = o.includeRoles ? `[${i + 1}] ${roleLabel(m.role, inp.lang)}${o.includeTimestamps && m.sentAt ? ` (${m.sentAt})` : ''}:\n` : '';
      parts.push(label + m.blocks.filter(b => b.type !== 'thinking' || o.includeThinking).map(b => b.text).join('\n\n'));
      if (o.separators) parts.push('-'.repeat(40));
    });
  });
  if (o.brandingEnabled && o.brandingText) parts.push(o.brandingText);
  return parts.join('\n\n') + '\n';
}

export function toJson(inp: ExportInput, o: ExportOptions): string {
  const doc = {
    schemaVersion: 1, generator: GENERATOR_LABEL, exportedAt: new Date().toISOString(),
    collection: inp.collectionTitle ? { title: inp.collectionTitle } : null,
    conversations: inp.snapshots.map(s => ({
      id: s.id, platform: s.platformId, title: s.title, externalConversationId: s.externalConversationId, sourceURL: s.canonicalURL,
      capturedAt: s.capturedAt, captureStatus: s.captureStatus, warnings: s.warnings,
      messages: selectedMessages(s, inp.selection?.get(s.id) ?? null).map(m => ({
        id: m.id, index: m.index, role: m.role, sentAt: m.sentAt,
        blocks: m.blocks.filter(b => b.type !== 'thinking' || o.includeThinking), plainText: m.plainText, captureWarnings: m.captureWarnings,
      })),
    })),
  };
  return JSON.stringify(doc, null, 2);
}

const csvCell = (v: string | number | null) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formula-injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(inp: ExportInput, o: ExportOptions): string {
  const rows = [['conversation_id', 'platform', 'conversation_title', 'message_index', 'role', 'message_text', 'sent_at', 'source_url', 'captured_at']];
  inp.snapshots.forEach(s => selectedMessages(s, inp.selection?.get(s.id) ?? null).forEach((m, i) => rows.push([
    s.externalConversationId ?? s.id, s.platformId, s.title, String(i + 1), m.role,
    m.blocks.filter(b => b.type !== 'thinking' || o.includeThinking).map(b => b.text).join('\n'), m.sentAt ?? '', s.canonicalURL ?? '', s.capturedAt,
  ])));
  return '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

export function toHtml(inp: ExportInput, o: ExportOptions, forPreview = false): string {
  const t = DOC_THEMES[o.theme];
  const fs = { small: 13, medium: 15, large: 17 }[o.fontSize];
  const dir = inp.lang === 'fa' ? 'rtl' : 'ltr';
  const tbl = o.tableStyle === 'solid' ? '' : `tbl-${o.tableStyle}`;
  const body = (inp.collectionTitle ? `<h1 class="coll">${escapeHtml(inp.collectionTitle)}</h1>` : '') + inp.snapshots.map((s, ci) => {
    const msgs = selectedMessages(s, inp.selection?.get(s.id) ?? null);
    const meta = header(s, o, inp.lang).map(l => `<div class="meta">${/https?:\/\//.test(l) ? l.replace(/(https?:\/\/\S+)/, (u) => { const su = safeUrl(u); return su ? `<a href="${escapeHtml(su)}" rel="noopener noreferrer">${escapeHtml(su)}</a>` : escapeHtml(u); }) : escapeHtml(l)}</div>`).join('');
    return `<section class="conv">${o.includeTitle ? `<h${inp.collectionTitle ? 2 : 1} dir="${detectDirection(s.title)}">${inp.collectionTitle ? `${ci + 1}. ` : ''}${escapeHtml(s.title)}</h${inp.collectionTitle ? 2 : 1}>` : ''}${meta}` +
      msgs.map((m, i) => `<article class="msg ${m.role}">${o.includeRoles ? `<header><span class="role">${i + 1}. ${roleLabel(m.role, inp.lang)}</span>${o.includeTimestamps && m.sentAt ? `<time class="ltr">${escapeHtml(m.sentAt)}</time>` : ''}</header>` : ''}<div class="md">${m.blocks.filter(b => b.type !== 'thinking' || o.includeThinking).map(b => b.type === 'code' ? `<pre><code>${escapeHtml(b.text)}</code></pre>` : b.type === 'thinking' ? `<div class="thinking">${renderMarkdown(b.text, tbl)}</div>` : renderMarkdown(b.text, tbl)).join('')}</div></article>${o.separators && i < msgs.length - 1 ? '<hr/>' : ''}`).join('') + '</section>';
  }).join('') + (o.brandingEnabled && o.brandingText ? `<footer class="brand">${escapeHtml(o.brandingText)}</footer>` : '');

  const css = `:root{color-scheme:${o.theme === 'dark' ? 'dark' : 'light'}}body{margin:0;background:${t.bg};color:${t.fg};font-family:Vazirmatn,Inter,system-ui,sans-serif;font-size:${fs}px;line-height:1.8;direction:${dir}}
.page{max-width:820px;margin:0 auto;padding:${forPreview ? '24px' : '40px 32px'}}h1,h2,h3{line-height:1.4}.coll{border-bottom:2px solid ${t.accent};padding-bottom:8px}
.meta{color:${t.muted};font-size:.85em}.meta a{color:${t.accent}}.msg{margin:18px 0;padding:14px 16px;border:1px solid ${t.border};border-radius:12px;break-inside:avoid}
.msg.user{border-inline-start:4px solid ${t.accent}}.msg header{display:flex;justify-content:space-between;gap:12px;font-weight:600;color:${t.accent};margin-bottom:6px;font-size:.92em}
.msg time{color:${t.muted};font-weight:400;font-size:.85em}.ltr{direction:ltr;unicode-bidi:isolate}hr{border:0;border-top:1px dashed ${t.border};margin:14px 0}
.md p{margin:.4em 0}.md pre{direction:ltr;text-align:left;background:rgba(127,127,127,.12);border:1px solid ${t.border};border-radius:8px;padding:10px 12px;overflow-x:auto;font-size:.88em}
.md code{direction:ltr;unicode-bidi:isolate;font-family:ui-monospace,Menlo,Consolas,monospace;background:rgba(127,127,127,.15);padding:1px 5px;border-radius:5px;font-size:.9em}.md pre code{background:none;padding:0}
.md table{border-collapse:collapse;margin:.6em 0;display:block;overflow-x:auto}.md th,.md td{border:1px solid ${t.border};padding:5px 10px}.md th{background:rgba(127,127,127,.1)}
.md .tbl-dashed th,.md .tbl-dashed td{border-style:dashed}.md .tbl-borderless th,.md .tbl-borderless td{border:0;border-bottom:1px solid ${t.border}}
.md blockquote{border-inline-start:3px solid ${t.accent};padding-inline-start:.8em;margin:.5em 0;color:${t.muted}}.md ul,.md ol{padding-inline-start:1.4em}.md a{color:${t.accent}}
.thinking{border:1px dashed ${t.border};border-radius:8px;padding:8px 10px;font-size:.9em;opacity:.85}.brand{margin-top:32px;color:${t.muted};font-size:.8em;text-align:center}
@page{size:${o.paperSize} ${o.orientation};margin:${{ small: '10mm', medium: '18mm', large: '26mm' }[o.margins]}}`;
  if (forPreview) return `<style>${css}</style><div class="page">${body}</div>`;
  return `<!doctype html><html lang="${inp.lang}" dir="${dir}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;"><title>${escapeHtml(inp.collectionTitle ?? inp.snapshots[0]?.title ?? 'A.max export')}</title><style>${css}</style></head><body><div class="page">${body}</div></body></html>`;
}

export function generate(inp: ExportInput, o: ExportOptions): { ok: true; content: string; mime: string } | { ok: false; code: string } {
  const total = inp.snapshots.reduce((n, s) => n + selectedMessages(s, inp.selection?.get(s.id) ?? null).length, 0);
  if (!inp.snapshots.length || total === 0) return { ok: false, code: 'NO_MESSAGES' };
  if (!FORMAT_META[o.format].available) return { ok: false, code: 'UNSUPPORTED_BLOCK' };
  try {
    const content = o.format === 'md' ? toMarkdown(inp, o) : o.format === 'txt' ? toTxt(inp, o) : o.format === 'json' ? toJson(inp, o) : o.format === 'csv' ? toCsv(inp, o) : toHtml(inp, o);
    return { ok: true, content, mime: FORMAT_META[o.format].mime };
  } catch { return { ok: false, code: 'RENDER_FAILURE' }; }
}

/** Triggers a real download; resolves only after the anchor click dispatched and blob was created. */
export async function downloadBlob(content: string, mime: string, fileName: string): Promise<{ ok: true; bytes: number } | { ok: false; code: string }> {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    await new Promise(r => setTimeout(r, 150));
    URL.revokeObjectURL(url);
    return { ok: true, bytes: blob.size };
  } catch { return { ok: false, code: 'DOWNLOAD_FAILED' }; }
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
